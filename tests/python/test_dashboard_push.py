import json
import os
import subprocess
import tempfile
import time
import unittest
import sys
from datetime import datetime, timezone

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'scripts'))
import dashboard_push  # noqa: E402


def write_jsonl(path, records):
    with open(path, 'w') as f:
        for r in records:
            f.write(json.dumps(r) + '\n')


class TestParseSessions(unittest.TestCase):
    def test_aggregates_tokens_sessions_projects_for_target_date(self):
        with tempfile.TemporaryDirectory() as d:
            proj = os.path.join(d, '-Users-holden-Claude-cc')
            os.makedirs(proj)
            write_jsonl(os.path.join(proj, 'sess-1.jsonl'), [
                {'type': 'assistant', 'timestamp': '2026-05-14T10:00:00.000Z',
                 'cwd': '/Users/holden/Claude/holden-alt/cc-dashboard', 'sessionId': 'sess-1',
                 'message': {'model': 'claude-opus-4-7',
                             'usage': {'input_tokens': 100, 'output_tokens': 200,
                                       'cache_read_input_tokens': 9999}}},
                {'type': 'assistant', 'timestamp': '2026-05-14T10:05:00.000Z',
                 'cwd': '/Users/holden/Claude/holden-alt/cc-dashboard', 'sessionId': 'sess-1',
                 'message': {'model': 'claude-opus-4-7',
                             'usage': {'input_tokens': 50, 'output_tokens': 50}}},
                # different day — must be ignored
                {'type': 'assistant', 'timestamp': '2026-05-13T10:00:00.000Z',
                 'cwd': '/Users/holden/Claude/holden-alt/cc-dashboard', 'sessionId': 'sess-1',
                 'message': {'model': 'claude-opus-4-7',
                             'usage': {'input_tokens': 1, 'output_tokens': 1}}},
            ])
            write_jsonl(os.path.join(proj, 'sess-2.jsonl'), [
                {'type': 'assistant', 'timestamp': '2026-05-14T12:00:00.000Z',
                 'cwd': '/Users/holden/Claude/realsavvy/agnt-portal', 'sessionId': 'sess-2',
                 'message': {'model': 'claude-sonnet-4-6',
                             'usage': {'input_tokens': 10, 'output_tokens': 5}}},
            ])

            result = dashboard_push.parse_day(
                [os.path.join(proj, 'sess-1.jsonl'), os.path.join(proj, 'sess-2.jsonl')],
                target_date='2026-05-14',
                home='/Users/holden',
            )

            # fresh tokens only: (100+200) + (50+50) = 400 opus, (10+5)=15 sonnet
            self.assertEqual(result['tokens_total'], 415)
            self.assertEqual(result['tokens_by_model'], {
                'claude-opus-4-7': 400,
                'claude-sonnet-4-6': 15,
            })
            # two distinct session ids active on the target date
            self.assertEqual(result['sessions'], 2)
            # project labels are home-relative under ~/Claude
            self.assertEqual(result['projects_touched'], {
                'holden-alt/cc-dashboard': 400,
                'realsavvy/agnt-portal': 15,
            })

    def test_synthetic_model_is_skipped(self):
        with tempfile.TemporaryDirectory() as d:
            p = os.path.join(d, 'sess.jsonl')
            write_jsonl(p, [
                {'type': 'assistant', 'timestamp': '2026-05-14T10:00:00.000Z',
                 'cwd': '/Users/holden/Claude/x', 'sessionId': 's',
                 'message': {'model': '<synthetic>',
                             'usage': {'input_tokens': 999, 'output_tokens': 999}}},
            ])
            result = dashboard_push.parse_day([p], target_date='2026-05-14', home='/Users/holden')
            self.assertEqual(result['tokens_total'], 0)


class TestDeepWork(unittest.TestCase):
    def test_continuous_block_under_15min_gap(self):
        # three messages 5 min apart -> one 10-minute block
        timestamps = [
            '2026-05-14T10:00:00.000Z',
            '2026-05-14T10:05:00.000Z',
            '2026-05-14T10:10:00.000Z',
        ]
        self.assertEqual(dashboard_push.deep_work_minutes(timestamps), 10)

    def test_gap_over_15min_splits_blocks(self):
        # block 1: 10:00-10:05 (5 min). gap 30 min. block 2: 10:35-10:40 (5 min). total 10.
        timestamps = [
            '2026-05-14T10:00:00.000Z',
            '2026-05-14T10:05:00.000Z',
            '2026-05-14T10:35:00.000Z',
            '2026-05-14T10:40:00.000Z',
        ]
        self.assertEqual(dashboard_push.deep_work_minutes(timestamps), 10)

    def test_single_message_is_zero(self):
        self.assertEqual(dashboard_push.deep_work_minutes(['2026-05-14T10:00:00.000Z']), 0)

    def test_empty_is_zero(self):
        self.assertEqual(dashboard_push.deep_work_minutes([]), 0)


class TestParseDayTimestamps(unittest.TestCase):
    def test_parse_day_returns_timestamps_for_deep_work(self):
        with tempfile.TemporaryDirectory() as d:
            p = os.path.join(d, 'sess.jsonl')
            write_jsonl(p, [
                {'type': 'assistant', 'timestamp': '2026-05-14T10:00:00.000Z',
                 'cwd': '/Users/holden/Claude/x', 'sessionId': 's',
                 'message': {'model': 'claude-opus-4-7',
                             'usage': {'input_tokens': 1, 'output_tokens': 1}}},
                {'type': 'user', 'timestamp': '2026-05-14T10:05:00.000Z',
                 'cwd': '/Users/holden/Claude/x', 'sessionId': 's', 'message': {}},
            ])
            result = dashboard_push.parse_day([p], target_date='2026-05-14', home='/Users/holden')
            self.assertIn('timestamps', result)
            self.assertEqual(sorted(result['timestamps']), [
                '2026-05-14T10:00:00.000Z',
                '2026-05-14T10:05:00.000Z',
            ])


class TestCountShips(unittest.TestCase):
    def test_counts_commits_today_across_repos(self):
        with tempfile.TemporaryDirectory() as d:
            # make a git repo with a commit "today"
            repo = os.path.join(d, 'Claude', 'demo-repo')
            os.makedirs(repo)
            env = {**os.environ, 'GIT_AUTHOR_NAME': 'Holden', 'GIT_AUTHOR_EMAIL': 'h@x.com',
                   'GIT_COMMITTER_NAME': 'Holden', 'GIT_COMMITTER_EMAIL': 'h@x.com'}
            subprocess.run(['git', 'init', '-q'], cwd=repo, check=True, env=env)
            with open(os.path.join(repo, 'f.txt'), 'w') as f:
                f.write('hi')
            subprocess.run(['git', 'add', '.'], cwd=repo, check=True, env=env)
            subprocess.run(['git', 'commit', '-q', '-m', 'today commit'], cwd=repo, check=True, env=env)

            today = datetime.now(timezone.utc).strftime('%Y-%m-%d')
            result = dashboard_push.count_ships(
                claude_dir=os.path.join(d, 'Claude'),
                target_date=today,
                author_email='h@x.com',
            )
            self.assertEqual(result['repos'], 1)
            self.assertEqual(result['commits'], 1)

    def test_no_repos_returns_zero(self):
        with tempfile.TemporaryDirectory() as d:
            os.makedirs(os.path.join(d, 'Claude'))
            result = dashboard_push.count_ships(
                claude_dir=os.path.join(d, 'Claude'),
                target_date='2026-05-14',
                author_email='h@x.com',
            )
            self.assertEqual(result, {'commits': 0, 'repos': 0})


class TestSignAndPayload(unittest.TestCase):
    def test_sign_body_matches_known_hmac(self):
        # HMAC-SHA256 of 'hello' with key 'k' — precomputed.
        import hmac as _hmac, hashlib as _hashlib
        expected = _hmac.new(b'k', b'hello', _hashlib.sha256).hexdigest()
        self.assertEqual(dashboard_push.sign_body('hello', 'k'), expected)

    def test_build_payload_shape(self):
        day = {
            'tokens_total': 415,
            'tokens_by_model': {'claude-opus-4-7': 400, 'claude-sonnet-4-6': 15},
            'sessions': 2,
            'projects_touched': {'holden-alt/cc-dashboard': 400},
            'timestamps': ['2026-05-14T10:00:00.000Z', '2026-05-14T10:05:00.000Z'],
        }
        ships = {'commits': 3, 'repos': 2}
        payload = dashboard_push.build_payload(
            day, ships, github_handle='holden-alt', machine='iMac', target_date='2026-05-14',
        )
        self.assertEqual(payload['github_handle'], 'holden-alt')
        self.assertEqual(payload['machine'], 'iMac')
        self.assertEqual(payload['date'], '2026-05-14')
        self.assertEqual(payload['tokens_total'], 415)
        self.assertEqual(payload['deep_work_minutes'], 5)  # two ts 5 min apart
        self.assertEqual(payload['ships'], {'commits': 3, 'repos': 2})
        self.assertNotIn('timestamps', payload)  # internal-only, not sent


if __name__ == '__main__':
    unittest.main()
