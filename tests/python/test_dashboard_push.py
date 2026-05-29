import json
import os
import subprocess
import tempfile
import time
import unittest
import sys
from datetime import datetime, timezone

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'public'))
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
                 'message': {'id': 'm1', 'model': 'claude-opus-4-7',
                             'usage': {'input_tokens': 100, 'output_tokens': 200,
                                       'cache_creation_input_tokens': 500,
                                       'cache_read_input_tokens': 9999}},
                 'requestId': 'r1'},
                {'type': 'assistant', 'timestamp': '2026-05-14T10:05:00.000Z',
                 'cwd': '/Users/holden/Claude/holden-alt/cc-dashboard', 'sessionId': 'sess-1',
                 'message': {'id': 'm2', 'model': 'claude-opus-4-7',
                             'usage': {'input_tokens': 50, 'output_tokens': 50}},
                 'requestId': 'r2'},
                # different day — must be ignored
                {'type': 'assistant', 'timestamp': '2026-05-13T10:00:00.000Z',
                 'cwd': '/Users/holden/Claude/holden-alt/cc-dashboard', 'sessionId': 'sess-1',
                 'message': {'id': 'm3', 'model': 'claude-opus-4-7',
                             'usage': {'input_tokens': 1, 'output_tokens': 1}},
                 'requestId': 'r3'},
            ])
            write_jsonl(os.path.join(proj, 'sess-2.jsonl'), [
                {'type': 'assistant', 'timestamp': '2026-05-14T12:00:00.000Z',
                 'cwd': '/Users/holden/Claude/realsavvy/agnt-portal', 'sessionId': 'sess-2',
                 'message': {'id': 'm4', 'model': 'claude-sonnet-4-6',
                             'usage': {'input_tokens': 10, 'output_tokens': 5}},
                 'requestId': 'r4'},
            ])

            result = dashboard_push.parse_day(
                [os.path.join(proj, 'sess-1.jsonl'), os.path.join(proj, 'sess-2.jsonl')],
                target_date='2026-05-14',
                home='/Users/holden',
            )

            # ccusage formula: input + output + cache_creation + cache_read
            # opus turn 1: 100+200+500+9999 = 10799; turn 2: 50+50 = 100 → 10899
            # sonnet:      10+5 = 15
            self.assertEqual(result['tokens_total'], 10914)
            self.assertEqual(result['tokens_by_model'], {
                'claude-opus-4-7': 10899,
                'claude-sonnet-4-6': 15,
            })
            self.assertEqual(result['sessions'], 2)
            self.assertEqual(result['projects_touched'], {
                'holden-alt/cc-dashboard': 10899,
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

    def test_dedupes_repeated_message_id_within_a_turn(self):
        # A single API turn that returns thinking + text + 2 tool_use blocks
        # is written to the JSONL as 4 lines — same message.id, same usage
        # object on every line. The parser must count usage once per id.
        with tempfile.TemporaryDirectory() as d:
            p = os.path.join(d, 'sess.jsonl')
            write_jsonl(p, [
                # turn 1: 4 blocks (thinking/text/tool/tool), all share msg id
                {'type': 'assistant', 'timestamp': '2026-05-14T10:00:00.000Z',
                 'cwd': '/Users/holden/Claude/p', 'sessionId': 's',
                 'message': {'id': 'msg_aaa', 'model': 'claude-opus-4-7',
                             'usage': {'input_tokens': 100, 'output_tokens': 500}}},
                {'type': 'assistant', 'timestamp': '2026-05-14T10:00:01.000Z',
                 'cwd': '/Users/holden/Claude/p', 'sessionId': 's',
                 'message': {'id': 'msg_aaa', 'model': 'claude-opus-4-7',
                             'usage': {'input_tokens': 100, 'output_tokens': 500}}},
                {'type': 'assistant', 'timestamp': '2026-05-14T10:00:02.000Z',
                 'cwd': '/Users/holden/Claude/p', 'sessionId': 's',
                 'message': {'id': 'msg_aaa', 'model': 'claude-opus-4-7',
                             'usage': {'input_tokens': 100, 'output_tokens': 500}}},
                {'type': 'assistant', 'timestamp': '2026-05-14T10:00:03.000Z',
                 'cwd': '/Users/holden/Claude/p', 'sessionId': 's',
                 'message': {'id': 'msg_aaa', 'model': 'claude-opus-4-7',
                             'usage': {'input_tokens': 100, 'output_tokens': 500}}},
                # turn 2: separate id, counts independently
                {'type': 'assistant', 'timestamp': '2026-05-14T10:01:00.000Z',
                 'cwd': '/Users/holden/Claude/p', 'sessionId': 's',
                 'message': {'id': 'msg_bbb', 'model': 'claude-opus-4-7',
                             'usage': {'input_tokens': 10, 'output_tokens': 20}}},
            ])
            result = dashboard_push.parse_day([p], target_date='2026-05-14', home='/Users/holden')
            # msg_aaa counted once (600) + msg_bbb (30) = 630
            self.assertEqual(result['tokens_total'], 630)
            self.assertEqual(result['tokens_by_model'], {'claude-opus-4-7': 630})

    def test_keeps_max_usage_when_streaming_snapshots_vary(self):
        # During streaming, CC writes intermediate usage snapshots. Earlier
        # lines for the same message.id carry partial output_tokens; the LAST
        # line carries the final cumulative total. We must keep the MAX.
        with tempfile.TemporaryDirectory() as d:
            p = os.path.join(d, 'sess.jsonl')
            write_jsonl(p, [
                # streaming snapshot 1: small output (text just landed)
                {'type': 'assistant', 'timestamp': '2026-05-14T10:00:00.000Z',
                 'cwd': '/Users/holden/Claude/p', 'sessionId': 's',
                 'message': {'id': 'msg_x', 'model': 'claude-opus-4-7',
                             'usage': {'input_tokens': 6, 'output_tokens': 1}}},
                # streaming snapshot 2: final total (tool_use finished streaming)
                {'type': 'assistant', 'timestamp': '2026-05-14T10:00:01.000Z',
                 'cwd': '/Users/holden/Claude/p', 'sessionId': 's',
                 'message': {'id': 'msg_x', 'model': 'claude-opus-4-7',
                             'usage': {'input_tokens': 6, 'output_tokens': 341}}},
            ])
            result = dashboard_push.parse_day([p], target_date='2026-05-14', home='/Users/holden')
            # Should pick the max: 6 + 341 = 347, not the first snapshot (7).
            self.assertEqual(result['tokens_total'], 347)

    def test_dedupes_message_id_across_files(self):
        # Session resume / file copy: same message.id appears in 2 files.
        # Should still count once.
        with tempfile.TemporaryDirectory() as d:
            p1 = os.path.join(d, 'sess-a.jsonl')
            p2 = os.path.join(d, 'sess-b.jsonl')
            rec = {'type': 'assistant', 'timestamp': '2026-05-14T10:00:00.000Z',
                   'cwd': '/Users/holden/Claude/p', 'sessionId': 's',
                   'message': {'id': 'msg_shared', 'model': 'claude-opus-4-7',
                               'usage': {'input_tokens': 200, 'output_tokens': 300}}}
            write_jsonl(p1, [rec])
            write_jsonl(p2, [rec])
            result = dashboard_push.parse_day([p1, p2], target_date='2026-05-14', home='/Users/holden')
            self.assertEqual(result['tokens_total'], 500)

    def test_counts_tool_use_blocks_per_turn(self):
        # Multi-block turn: thinking + text + 3 tool_use. Streaming snapshot
        # variants exist where tool_use count grows as content streams. Parser
        # should report the MAX tool_use count seen across the snapshots.
        with tempfile.TemporaryDirectory() as d:
            p = os.path.join(d, 'sess.jsonl')
            write_jsonl(p, [
                # Snapshot 1: only thinking visible
                {'type': 'assistant', 'timestamp': '2026-05-14T10:00:00.000Z',
                 'cwd': '/Users/holden/Claude/p', 'sessionId': 's', 'requestId': 'r1',
                 'message': {'id': 'mA', 'model': 'claude-opus-4-7',
                             'content': [{'type': 'thinking'}],
                             'usage': {'input_tokens': 10, 'output_tokens': 50}}},
                # Snapshot 2: thinking + text + 1 tool_use
                {'type': 'assistant', 'timestamp': '2026-05-14T10:00:01.000Z',
                 'cwd': '/Users/holden/Claude/p', 'sessionId': 's', 'requestId': 'r1',
                 'message': {'id': 'mA', 'model': 'claude-opus-4-7',
                             'content': [{'type': 'thinking'}, {'type': 'text'}, {'type': 'tool_use'}],
                             'usage': {'input_tokens': 10, 'output_tokens': 150}}},
                # Snapshot 3 (final): full turn with 3 tool_use blocks
                {'type': 'assistant', 'timestamp': '2026-05-14T10:00:02.000Z',
                 'cwd': '/Users/holden/Claude/p', 'sessionId': 's', 'requestId': 'r1',
                 'message': {'id': 'mA', 'model': 'claude-opus-4-7',
                             'content': [{'type': 'thinking'}, {'type': 'text'},
                                         {'type': 'tool_use'}, {'type': 'tool_use'},
                                         {'type': 'tool_use'}],
                             'usage': {'input_tokens': 10, 'output_tokens': 200}}},
                # Different turn, 1 more tool_use
                {'type': 'assistant', 'timestamp': '2026-05-14T10:01:00.000Z',
                 'cwd': '/Users/holden/Claude/p', 'sessionId': 's', 'requestId': 'r2',
                 'message': {'id': 'mB', 'model': 'claude-opus-4-7',
                             'content': [{'type': 'tool_use'}],
                             'usage': {'input_tokens': 5, 'output_tokens': 5}}},
            ])
            result = dashboard_push.parse_day([p], target_date='2026-05-14', home='/Users/holden')
            # tool_calls = 3 (final snapshot of mA) + 1 (mB) = 4
            self.assertEqual(result['tool_calls'], 4)
            # output_tokens = max of mA snapshots (200) + mB (5) = 205
            self.assertEqual(result['output_tokens'], 205)

    def test_subagent_message_ids_count_independently(self):
        # Subagent JSONLs have their own message.ids, distinct from the parent.
        # Their tokens are genuine new API calls — must NOT be deduped away.
        with tempfile.TemporaryDirectory() as d:
            parent = os.path.join(d, 'sess.jsonl')
            sub = os.path.join(d, 'sess', 'subagents', 'agent-1.jsonl')
            os.makedirs(os.path.dirname(sub))
            write_jsonl(parent, [
                {'type': 'assistant', 'timestamp': '2026-05-14T10:00:00.000Z',
                 'cwd': '/Users/holden/Claude/p', 'sessionId': 's',
                 'message': {'id': 'msg_parent', 'model': 'claude-opus-4-7',
                             'usage': {'input_tokens': 100, 'output_tokens': 200}}},
            ])
            write_jsonl(sub, [
                {'type': 'assistant', 'timestamp': '2026-05-14T10:00:01.000Z',
                 'cwd': '/Users/holden/Claude/p', 'sessionId': 'sa',
                 'message': {'id': 'msg_subagent', 'model': 'claude-sonnet-4-6',
                             'usage': {'input_tokens': 50, 'output_tokens': 75}}},
            ])
            result = dashboard_push.parse_day([parent, sub], target_date='2026-05-14', home='/Users/holden')
            self.assertEqual(result['tokens_total'], 425)
            self.assertEqual(result['tokens_by_model'], {
                'claude-opus-4-7': 300, 'claude-sonnet-4-6': 125,
            })


class TestParseCodexDay(unittest.TestCase):
    """Codex JSONL parser — same return shape as parse_day, but a totally
    different on-disk schema (event_msg / response_item wrappers, token_count
    events, turn_context for model+cwd)."""

    def _write_codex_jsonl(self, path, records):
        with open(path, 'w') as f:
            for r in records:
                f.write(json.dumps(r) + '\n')

    def test_sums_token_count_events_with_model_and_cwd(self):
        with tempfile.TemporaryDirectory() as d:
            sess_dir = os.path.join(d, '2026', '05', '14')
            os.makedirs(sess_dir)
            p = os.path.join(sess_dir, 'rollout-2026-05-14T10-00-00-aaa.jsonl')
            self._write_codex_jsonl(p, [
                # session_meta — establishes initial cwd
                {'type': 'session_meta', 'timestamp': '2026-05-14T10:00:00.000Z',
                 'payload': {'id': 'aaa', 'cwd': '/Users/holden/Claude/codex-proj',
                             'originator': 'codex-cli'}},
                # turn_context — sets model + cwd for this turn
                {'type': 'turn_context', 'timestamp': '2026-05-14T10:00:00.500Z',
                 'payload': {'turn_id': 't1', 'model': 'gpt-5.5',
                             'cwd': '/Users/holden/Claude/codex-proj'}},
                # user_message
                {'type': 'event_msg', 'timestamp': '2026-05-14T10:00:01.000Z',
                 'payload': {'type': 'user_message', 'message': 'hi'}},
                # function_call — tool invocation
                {'type': 'response_item', 'timestamp': '2026-05-14T10:00:02.000Z',
                 'payload': {'type': 'function_call', 'name': 'exec_command',
                             'arguments': '{}', 'call_id': 'c1'}},
                # custom_tool_call — apply_patch counts too
                {'type': 'response_item', 'timestamp': '2026-05-14T10:00:02.500Z',
                 'payload': {'type': 'custom_tool_call', 'name': 'apply_patch',
                             'call_id': 'c2', 'input': '*** Begin Patch'}},
                # agent_message
                {'type': 'event_msg', 'timestamp': '2026-05-14T10:00:03.000Z',
                 'payload': {'type': 'agent_message', 'message': 'done'}},
                # token_count — turn 1
                {'type': 'event_msg', 'timestamp': '2026-05-14T10:00:03.100Z',
                 'payload': {'type': 'token_count',
                             'info': {'last_token_usage': {
                                 'input_tokens': 1000, 'cached_input_tokens': 200,
                                 'output_tokens': 300, 'reasoning_output_tokens': 50,
                                 'total_tokens': 1300}}}},
                # turn_context — model switches mid-session
                {'type': 'turn_context', 'timestamp': '2026-05-14T10:01:00.000Z',
                 'payload': {'turn_id': 't2', 'model': 'gpt-5-mini',
                             'cwd': '/Users/holden/Claude/codex-proj'}},
                # token_count — turn 2 attributed to new model
                {'type': 'event_msg', 'timestamp': '2026-05-14T10:01:01.000Z',
                 'payload': {'type': 'token_count',
                             'info': {'last_token_usage': {
                                 'input_tokens': 500, 'cached_input_tokens': 100,
                                 'output_tokens': 80, 'reasoning_output_tokens': 0,
                                 'total_tokens': 580}}}},
                # wrong-day token_count — must be ignored
                {'type': 'event_msg', 'timestamp': '2026-05-13T10:00:00.000Z',
                 'payload': {'type': 'token_count',
                             'info': {'last_token_usage': {
                                 'input_tokens': 9999, 'cached_input_tokens': 0,
                                 'output_tokens': 9999, 'reasoning_output_tokens': 0,
                                 'total_tokens': 19998}}}},
            ])
            result = dashboard_push.parse_codex_day(
                [p], target_date='2026-05-14', home='/Users/holden')
            # ccusage-canonical for Codex = input + output + reasoning per turn
            # turn 1: 1000 + 300 + 50 = 1350
            # turn 2:  500 +  80 +  0 =  580
            self.assertEqual(result['tokens_total'], 1930)
            self.assertEqual(result['tokens_by_model'], {
                'gpt-5.5': 1350, 'gpt-5-mini': 580,
            })
            self.assertEqual(result['output_tokens'], 300 + 50 + 80)  # 430
            # cache_creation analog = new input (input - cached) per turn
            # turn 1: 1000-200=800; turn 2: 500-100=400
            self.assertEqual(result['cache_creation_tokens'], 1200)
            # tool_calls = function_call + custom_tool_call
            self.assertEqual(result['tool_calls'], 2)
            # projects_touched attributed via short_project()
            self.assertEqual(result['projects_touched'], {'codex-proj': 1930})
            self.assertEqual(result['sessions'], 1)

    def test_empty_when_no_codex_files(self):
        result = dashboard_push.parse_codex_day([], target_date='2026-05-14',
                                                home='/Users/holden')
        self.assertEqual(result['tokens_total'], 0)
        self.assertEqual(result['tool_calls'], 0)


class TestMergeDays(unittest.TestCase):
    """merge_days combines Claude and Codex per-day stats into one payload."""

    def test_merges_scalars_and_dicts(self):
        a = {
            'tokens_total': 1000, 'output_tokens': 300, 'cache_creation_tokens': 100,
            'tool_calls': 5, 'sessions': 2,
            'tokens_by_model': {'claude-opus-4-7': 1000},
            'projects_touched': {'cc-dashboard': 700, 'shared': 300},
            'tokens_by_hour': {'10': 1000},
            'timestamps': ['2026-05-14T10:00:00Z'],
        }
        b = {
            'tokens_total': 500, 'output_tokens': 80, 'cache_creation_tokens': 400,
            'tool_calls': 2, 'sessions': 1,
            'tokens_by_model': {'gpt-5.5': 500},
            'projects_touched': {'codex-proj': 200, 'shared': 300},
            'tokens_by_hour': {'10': 500, '11': 0},
            'timestamps': ['2026-05-14T10:30:00Z'],
        }
        merged = dashboard_push.merge_days(a, b)
        self.assertEqual(merged['tokens_total'], 1500)
        self.assertEqual(merged['output_tokens'], 380)
        self.assertEqual(merged['cache_creation_tokens'], 500)
        self.assertEqual(merged['tool_calls'], 7)
        self.assertEqual(merged['sessions'], 3)
        self.assertEqual(merged['tokens_by_model'], {
            'claude-opus-4-7': 1000, 'gpt-5.5': 500,
        })
        # Overlapping project key sums; distinct ones preserved
        self.assertEqual(merged['projects_touched'], {
            'cc-dashboard': 700, 'shared': 600, 'codex-proj': 200,
        })
        self.assertEqual(merged['tokens_by_hour']['10'], 1500)
        self.assertEqual(len(merged['timestamps']), 2)

    def test_handles_missing_side(self):
        a = {'tokens_total': 100, 'tokens_by_model': {'claude-opus-4-7': 100}}
        # Empty codex side (Codex-not-installed user) preserves Claude data.
        result = dashboard_push.merge_days(a, None)
        self.assertEqual(result, a)


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

            today = datetime.now().strftime('%Y-%m-%d')  # local day (matches git's local-time log filtering)
            result = dashboard_push.count_ships(
                claude_dir=os.path.join(d, 'Claude'),
                target_date=today,
                author_email='h@x.com',
            )
            self.assertEqual(result['repos'], 1)
            self.assertEqual(result['commits'], 1)
            # Single 1-line non-test file: log10(1+1) * 1 file * 1.0 non-test ≈ 0.301
            self.assertAlmostEqual(result['ship_quality'], 0.30103, places=4)

    def test_ship_quality_discounts_test_only_commits(self):
        with tempfile.TemporaryDirectory() as d:
            repo = os.path.join(d, 'Claude', 'demo-repo')
            os.makedirs(repo)
            env = {**os.environ, 'GIT_AUTHOR_NAME': 'H', 'GIT_AUTHOR_EMAIL': 'h@x.com',
                   'GIT_COMMITTER_NAME': 'H', 'GIT_COMMITTER_EMAIL': 'h@x.com'}
            subprocess.run(['git', 'init', '-q'], cwd=repo, check=True, env=env)
            # All test files — should produce ship_quality = 0 (non_test_ratio = 0)
            os.makedirs(os.path.join(repo, 'tests'))
            with open(os.path.join(repo, 'tests', 'a.test.ts'), 'w') as f:
                f.write('test_a\n')
            with open(os.path.join(repo, 'tests', 'b.spec.ts'), 'w') as f:
                f.write('test_b\n')
            subprocess.run(['git', 'add', '.'], cwd=repo, check=True, env=env)
            subprocess.run(['git', 'commit', '-q', '-m', 'tests only'], cwd=repo, check=True, env=env)
            today = datetime.now().strftime('%Y-%m-%d')  # local day (matches git's local-time log filtering)
            result = dashboard_push.count_ships(
                claude_dir=os.path.join(d, 'Claude'),
                target_date=today,
                author_email='h@x.com',
            )
            self.assertEqual(result['commits'], 1)
            self.assertEqual(result['ship_quality'], 0.0)

    def test_no_repos_returns_zero(self):
        with tempfile.TemporaryDirectory() as d:
            os.makedirs(os.path.join(d, 'Claude'))
            result = dashboard_push.count_ships(
                claude_dir=os.path.join(d, 'Claude'),
                target_date='2026-05-14',
                author_email='h@x.com',
            )
            self.assertEqual(result, {'commits': 0, 'repos': 0, 'ship_quality': 0.0})


class TestHourlyBucketing(unittest.TestCase):
    def setUp(self):
        self._orig_tz = os.environ.get('TZ')
        os.environ['TZ'] = 'America/New_York'
        time.tzset()

    def tearDown(self):
        if self._orig_tz is None:
            os.environ.pop('TZ', None)
        else:
            os.environ['TZ'] = self._orig_tz
        time.tzset()

    def test_parse_day_buckets_tokens_by_local_hour(self):
        with tempfile.TemporaryDirectory() as d:
            p = os.path.join(d, 'sess.jsonl')
            write_jsonl(p, [
                # 2026-05-14T18:00Z is 14:00 EDT (UTC-4)
                {'type': 'assistant', 'timestamp': '2026-05-14T18:00:00.000Z',
                 'cwd': '/Users/holden/Claude/x', 'sessionId': 's',
                 'message': {'model': 'claude-opus-4-7',
                             'usage': {'input_tokens': 100, 'output_tokens': 200}}},
                # 2026-05-14T18:30Z is 14:30 EDT -> same hour-14 bucket
                {'type': 'assistant', 'timestamp': '2026-05-14T18:30:00.000Z',
                 'cwd': '/Users/holden/Claude/x', 'sessionId': 's',
                 'message': {'model': 'claude-opus-4-7',
                             'usage': {'input_tokens': 50, 'output_tokens': 50}}},
                # 2026-05-15T02:00Z is 22:00 EDT on 2026-05-14 -> still the user's
                # LOCAL 05-14 (hour 22). Must be counted, not dropped.
                {'type': 'assistant', 'timestamp': '2026-05-15T02:00:00.000Z',
                 'cwd': '/Users/holden/Claude/x', 'sessionId': 's',
                 'message': {'model': 'claude-opus-4-7',
                             'usage': {'input_tokens': 100, 'output_tokens': 100}}},
                # 2026-05-15T12:00Z is 08:00 EDT on 2026-05-15 -> a different LOCAL
                # day, correctly ignored for target 05-14.
                {'type': 'assistant', 'timestamp': '2026-05-15T12:00:00.000Z',
                 'cwd': '/Users/holden/Claude/x', 'sessionId': 's',
                 'message': {'model': 'claude-opus-4-7',
                             'usage': {'input_tokens': 999, 'output_tokens': 999}}},
            ])
            result = dashboard_push.parse_day([p], target_date='2026-05-14', home='/Users/holden')
            # local hour 14: 300 + 100 = 400; local hour 22 (the 02:00Z event): 200
            self.assertEqual(result['tokens_by_hour'], {'14': 400, '22': 200})
            self.assertEqual(result['tokens_total'], 600)

    def test_build_payload_includes_hourly_tokens(self):
        day = {
            'tokens_total': 400,
            'tokens_by_model': {'claude-opus-4-7': 400},
            'sessions': 1,
            'projects_touched': {'holden-alt/cc-dashboard': 400},
            'timestamps': ['2026-05-14T18:00:00.000Z'],
            'tokens_by_hour': {'14': 400},
        }
        payload = dashboard_push.build_payload(
            day, {'commits': 0, 'repos': 0},
            github_handle='holden-alt', machine='iMac', target_date='2026-05-14',
        )
        self.assertEqual(payload['hourly_tokens'], {'14': 400})


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
            'tokens_by_hour': {'10': 415},
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
        self.assertEqual(payload['hourly_tokens'], {'10': 415})


class TestFileSelection(unittest.TestCase):
    def test_today_files_only_picks_recently_modified(self):
        with tempfile.TemporaryDirectory() as d:
            projects = os.path.join(d, 'projects')
            proj = os.path.join(projects, 'p')
            os.makedirs(proj)
            recent = os.path.join(proj, 'recent.jsonl')
            old = os.path.join(proj, 'old.jsonl')
            open(recent, 'w').close()
            open(old, 'w').close()
            # set 'old' mtime to 3 days ago
            old_time = time.time() - 3 * 86400
            os.utime(old, (old_time, old_time))

            picked = dashboard_push.today_jsonl_files(projects)
            self.assertIn(recent, picked)
            self.assertNotIn(old, picked)

    def test_all_files_picks_everything(self):
        with tempfile.TemporaryDirectory() as d:
            projects = os.path.join(d, 'projects')
            proj = os.path.join(projects, 'p')
            os.makedirs(proj)
            a = os.path.join(proj, 'a.jsonl')
            b = os.path.join(proj, 'b.jsonl')
            open(a, 'w').close()
            open(b, 'w').close()
            old_time = time.time() - 30 * 86400
            os.utime(b, (old_time, old_time))
            picked = dashboard_push.all_jsonl_files(projects)
            self.assertEqual(sorted(picked), sorted([a, b]))


class TestDebounce(unittest.TestCase):
    def test_debounced_when_recent(self):
        with tempfile.TemporaryDirectory() as d:
            marker = os.path.join(d, 'last-push')
            with open(marker, 'w') as f:
                f.write(str(time.time()))  # just now
            self.assertTrue(dashboard_push.is_debounced(marker, window=90))

    def test_not_debounced_when_stale(self):
        with tempfile.TemporaryDirectory() as d:
            marker = os.path.join(d, 'last-push')
            with open(marker, 'w') as f:
                f.write(str(time.time() - 200))
            self.assertFalse(dashboard_push.is_debounced(marker, window=90))

    def test_not_debounced_when_missing(self):
        self.assertFalse(dashboard_push.is_debounced('/nonexistent/marker', window=90))


class TestIncrementalWindow(unittest.TestCase):
    """Incremental pushes must re-cover a window of recent days using a
    time-windowed file glob, so day-boundary events living in files that have
    gone cold (mtime before local midnight) are still captured. This is the
    class of bug that silently dropped ~94M tokens from 2026-05-27: a heavy
    block of work sat in a session file that went cold before local midnight,
    so the mtime>=midnight glob never re-read it and no push ever re-covered
    that day over the full file set. Day keys are LOCAL dates (the user's day)."""

    def setUp(self):
        self._orig_tz = os.environ.get('TZ')
        os.environ['TZ'] = 'America/New_York'
        time.tzset()

    def tearDown(self):
        if self._orig_tz is None:
            os.environ.pop('TZ', None)
        else:
            os.environ['TZ'] = self._orig_tz
        time.tzset()

    def _ts(self, iso_z):
        return datetime.fromisoformat(iso_z.replace('Z', '+00:00')).timestamp()

    def test_recent_jsonl_files_includes_cold_but_recent(self):
        with tempfile.TemporaryDirectory() as d:
            projects = os.path.join(d, 'projects')
            proj = os.path.join(projects, 'p')
            os.makedirs(proj)
            warm = os.path.join(proj, 'warm.jsonl')
            cold = os.path.join(proj, 'cold.jsonl')
            ancient = os.path.join(proj, 'ancient.jsonl')
            for f in (warm, cold, ancient):
                open(f, 'w').close()
            now_ts = 1_700_000_000.0
            os.utime(warm, (now_ts - 3600, now_ts - 3600))          # 1h ago
            os.utime(cold, (now_ts - 30 * 3600, now_ts - 30 * 3600))  # 30h ago — within 48h window
            os.utime(ancient, (now_ts - 5 * 86400, now_ts - 5 * 86400))  # 5 days ago
            picked = dashboard_push.recent_jsonl_files(projects, now_ts, hours=48)
            self.assertIn(warm, picked)
            self.assertIn(cold, picked)        # the file today_jsonl_files would miss
            self.assertNotIn(ancient, picked)

    def test_incremental_payloads_captures_yesterday_boundary_events(self):
        with tempfile.TemporaryDirectory() as d:
            projects = os.path.join(d, 'projects')
            proj = os.path.join(projects, 'p')
            os.makedirs(proj)
            now_ts = self._ts('2026-05-28T16:00:00Z')  # UTC today = 05-28, yesterday = 05-27

            # Cold file: a heavy 05-27 (UTC) turn in a session that went cold 30h ago.
            cold = os.path.join(proj, 'cold.jsonl')
            write_jsonl(cold, [
                {'type': 'assistant', 'timestamp': '2026-05-27T12:00:00.000Z',
                 'cwd': '/Users/holden/Claude/p', 'sessionId': 's1',
                 'message': {'id': 'mY', 'model': 'claude-opus-4-7',
                             'usage': {'input_tokens': 1000, 'output_tokens': 2000,
                                       'cache_creation_input_tokens': 0,
                                       'cache_read_input_tokens': 5000}}}])
            os.utime(cold, (now_ts - 30 * 3600, now_ts - 30 * 3600))

            # Warm file: today's (05-28 UTC) work.
            warm = os.path.join(proj, 'warm.jsonl')
            write_jsonl(warm, [
                {'type': 'assistant', 'timestamp': '2026-05-28T15:00:00.000Z',
                 'cwd': '/Users/holden/Claude/p', 'sessionId': 's2',
                 'message': {'id': 'mT', 'model': 'claude-opus-4-7',
                             'usage': {'input_tokens': 10, 'output_tokens': 20}}}])
            os.utime(warm, (now_ts - 1800, now_ts - 1800))

            codex_dir = os.path.join(d, 'codex')  # not present — Codex-less user
            payloads = dashboard_push.incremental_payloads(
                projects, codex_dir, now_ts, home='/Users/holden',
                back_days=1, window_hours=48)
            by_date = {date: day for date, day in payloads}

            self.assertIn('2026-05-27', by_date)
            self.assertIn('2026-05-28', by_date)
            # 05-27 must include the cold-file turn: 1000+2000+0+5000 = 8000
            self.assertEqual(by_date['2026-05-27']['tokens_total'], 8000)
            # 05-28 picks up the warm turn: 10+20 = 30
            self.assertEqual(by_date['2026-05-28']['tokens_total'], 30)


class TestLocalDayBoundary(unittest.TestCase):
    """Day totals follow the user's LOCAL day, not UTC. Evening work (after UTC
    midnight, i.e. ~20:00 ET) must stay on the local day it actually happened on
    — not roll forward to the next day. That UTC rollover is what emptied
    'today' on the dashboard at 8pm ET on 2026-05-28."""

    def setUp(self):
        self._orig_tz = os.environ.get('TZ')
        os.environ['TZ'] = 'America/New_York'
        time.tzset()

    def tearDown(self):
        if self._orig_tz is None:
            os.environ.pop('TZ', None)
        else:
            os.environ['TZ'] = self._orig_tz
        time.tzset()

    def _ts(self, iso_z):
        return datetime.fromisoformat(iso_z.replace('Z', '+00:00')).timestamp()

    def test_evening_event_counts_on_local_day_not_utc(self):
        with tempfile.TemporaryDirectory() as d:
            p = os.path.join(d, 'sess.jsonl')
            # 2026-05-29T00:39Z == 2026-05-28 20:39 EDT -> the user's local 05-28.
            write_jsonl(p, [
                {'type': 'assistant', 'timestamp': '2026-05-29T00:39:00.000Z',
                 'cwd': '/Users/holden/Claude/p', 'sessionId': 's',
                 'message': {'id': 'mE', 'model': 'claude-opus-4-7',
                             'usage': {'input_tokens': 1000, 'output_tokens': 2000,
                                       'cache_creation_input_tokens': 0,
                                       'cache_read_input_tokens': 5000}}}])
            r28 = dashboard_push.parse_day([p], target_date='2026-05-28', home='/Users/holden')
            r29 = dashboard_push.parse_day([p], target_date='2026-05-29', home='/Users/holden')
            self.assertEqual(r28['tokens_total'], 8000)  # belongs to local 05-28
            self.assertEqual(r29['tokens_total'], 0)      # NOT the UTC day 05-29

    def test_incremental_window_uses_local_today(self):
        with tempfile.TemporaryDirectory() as d:
            projects = os.path.join(d, 'projects')
            proj = os.path.join(projects, 'p')
            os.makedirs(proj)
            now_ts = self._ts('2026-05-29T00:39:00Z')  # local 05-28 20:39 EDT
            warm = os.path.join(proj, 'warm.jsonl')
            write_jsonl(warm, [
                {'type': 'assistant', 'timestamp': '2026-05-29T00:39:00.000Z',
                 'cwd': '/Users/holden/Claude/p', 'sessionId': 's',
                 'message': {'id': 'mE', 'model': 'claude-opus-4-7',
                             'usage': {'input_tokens': 100, 'output_tokens': 200}}}])
            os.utime(warm, (now_ts - 600, now_ts - 600))
            codex_dir = os.path.join(d, 'codex')
            payloads = dashboard_push.incremental_payloads(
                projects, codex_dir, now_ts, home='/Users/holden', back_days=1)
            by_date = {date: day for date, day in payloads}
            # window is LOCAL today + yesterday, not the UTC day
            self.assertIn('2026-05-28', by_date)
            self.assertIn('2026-05-27', by_date)
            self.assertNotIn('2026-05-29', by_date)
            self.assertEqual(by_date['2026-05-28']['tokens_total'], 300)


if __name__ == '__main__':
    unittest.main()
