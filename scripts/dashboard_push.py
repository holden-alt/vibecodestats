#!/usr/bin/env python3
"""
dashboard_push.py — push today's Claude Code stats to the cc-dashboard ingest API.

Stdlib only. Parses ~/.claude/projects/*/*.jsonl for the target date, computes a
per-machine daily stats payload, HMAC-signs it, and POSTs to /api/ingest.

Default mode parses only files modified today (fast — runs after every CC turn
via the Stop hook). --backfill parses everything for a one-time history load.

Env vars required:
  CC_DASHBOARD_URL          e.g. https://cc-dashboard-qab.pages.dev
  CC_DASHBOARD_HMAC_SECRET  same value as the deploy's INGEST_HMAC_SECRET
  CC_DASHBOARD_HANDLE       the GitHub handle whose profile this machine feeds
"""

import glob
import hashlib
import hmac
import json
import os
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request
from collections import defaultdict
from datetime import datetime, timezone

HOME = os.path.expanduser('~')
PROJECTS_DIR = os.path.join(HOME, '.claude', 'projects')
LAST_PUSH_FILE = os.path.join(HOME, '.claude', '.cc-dashboard-last-push')
DEBOUNCE_SECONDS = 90
DEEP_WORK_GAP_SECONDS = 15 * 60


def short_project(cwd, home):
    """Absolute cwd -> short label. /Users/x/Claude/realsavvy/p -> realsavvy/p."""
    if not cwd:
        return 'unknown'
    claude_root = os.path.join(home, 'Claude') + '/'
    if cwd.startswith(claude_root):
        return cwd[len(claude_root):]
    if cwd == home:
        return '~'
    if cwd.startswith(home + '/'):
        return cwd[len(home) + 1:]
    return cwd


def parse_day(jsonl_paths, target_date, home):
    """Parse the given JSONL files, return aggregates for target_date (YYYY-MM-DD)."""
    tokens_by_model = defaultdict(int)
    tokens_by_project = defaultdict(int)
    sessions = set()
    timestamps = []
    for path in jsonl_paths:
        session_id = os.path.basename(path).replace('.jsonl', '')
        session_cwd = None
        try:
            with open(path) as f:
                for line in f:
                    try:
                        d = json.loads(line)
                    except json.JSONDecodeError:
                        continue
                    if session_cwd is None and d.get('cwd'):
                        session_cwd = d['cwd']
                    ts = d.get('timestamp')
                    if not ts or ts[:10] != target_date:
                        continue
                    if d.get('type') in ('user', 'assistant'):
                        sessions.add(session_id)
                        timestamps.append(ts)
                    msg = d.get('message')
                    if not isinstance(msg, dict):
                        continue
                    usage = msg.get('usage')
                    if not isinstance(usage, dict):
                        continue
                    model = msg.get('model') or 'unknown'
                    if model == '<synthetic>':
                        continue
                    fresh = (usage.get('input_tokens') or 0) + (usage.get('output_tokens') or 0)
                    tokens_by_model[model] += fresh
                    label = short_project(session_cwd, home)
                    tokens_by_project[label] += fresh
        except OSError:
            continue
    return {
        'tokens_total': sum(tokens_by_model.values()),
        'tokens_by_model': dict(tokens_by_model),
        'sessions': len(sessions),
        'projects_touched': dict(tokens_by_project),
        'timestamps': timestamps,
    }


def deep_work_minutes(timestamps):
    """Sum of continuous-block spans (gaps < 15min keep a block alive), in whole minutes."""
    if len(timestamps) < 2:
        return 0
    parsed = sorted(
        datetime.fromisoformat(t.replace('Z', '+00:00')) for t in timestamps
    )
    total_seconds = 0
    block_start = parsed[0]
    prev = parsed[0]
    for cur in parsed[1:]:
        gap = (cur - prev).total_seconds()
        if gap > DEEP_WORK_GAP_SECONDS:
            total_seconds += (prev - block_start).total_seconds()
            block_start = cur
        prev = cur
    total_seconds += (prev - block_start).total_seconds()
    return int(total_seconds // 60)


def count_ships(claude_dir, target_date, author_email):
    """Count commits authored by author_email on target_date across git repos
    directly under claude_dir and one level deeper (claude_dir/*/  and claude_dir/*/*/)."""
    candidates = []
    for depth1 in glob.glob(os.path.join(claude_dir, '*')):
        if os.path.isdir(os.path.join(depth1, '.git')):
            candidates.append(depth1)
        for depth2 in glob.glob(os.path.join(depth1, '*')):
            if os.path.isdir(os.path.join(depth2, '.git')):
                candidates.append(depth2)

    commits = 0
    repos_with_commits = 0
    since = target_date + 'T00:00:00'
    until = target_date + 'T23:59:59'
    for repo in candidates:
        try:
            out = subprocess.run(
                ['git', 'log', '--author=' + author_email,
                 '--since=' + since, '--until=' + until, '--oneline'],
                cwd=repo, capture_output=True, text=True, timeout=10,
            )
        except (subprocess.SubprocessError, OSError):
            continue
        if out.returncode != 0:
            continue
        n = len([ln for ln in out.stdout.splitlines() if ln.strip()])
        if n > 0:
            commits += n
            repos_with_commits += 1
    return {'commits': commits, 'repos': repos_with_commits}


def sign_body(body, secret):
    """HMAC-SHA256 hex digest — must match lib/ingest/hmac.ts signPayload()."""
    return hmac.new(secret.encode(), body.encode(), hashlib.sha256).hexdigest()


def build_payload(day, ships, github_handle, machine, target_date):
    """Assemble the IngestPayload dict the /api/ingest route expects."""
    return {
        'github_handle': github_handle,
        'machine': machine,
        'date': target_date,
        'tokens_total': day['tokens_total'],
        'tokens_by_model': day['tokens_by_model'],
        'sessions': day['sessions'],
        'deep_work_minutes': deep_work_minutes(day.get('timestamps', [])),
        'projects_touched': day['projects_touched'],
        'ships': ships,
    }


def post_payload(url, payload, secret):
    """Sign and POST the payload. Returns (status_code, response_text)."""
    body = json.dumps(payload, separators=(',', ':'), sort_keys=True)
    signature = sign_body(body, secret)
    req = urllib.request.Request(
        url.rstrip('/') + '/api/ingest',
        data=body.encode(),
        headers={
            'Content-Type': 'application/json',
            'X-CC-Signature': signature,
            # Cloudflare's WAF 403s the default Python-urllib User-Agent (error 1010).
            'User-Agent': 'cc-dashboard-push/1.0',
        },
        method='POST',
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return resp.status, resp.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()


def today_jsonl_files(projects_dir):
    """JSONL files modified since local midnight."""
    midnight = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    cutoff = midnight.timestamp()
    out = []
    for path in glob.glob(os.path.join(projects_dir, '*', '*.jsonl')):
        try:
            if os.path.getmtime(path) >= cutoff:
                out.append(path)
        except OSError:
            continue
    return out


def all_jsonl_files(projects_dir):
    return glob.glob(os.path.join(projects_dir, '*', '*.jsonl'))


def is_debounced(marker_path, window):
    """True if the last push was less than `window` seconds ago."""
    try:
        with open(marker_path) as f:
            last = float(f.read().strip())
    except (OSError, ValueError):
        return False
    return (time.time() - last) < window


def git_author_email():
    # Prefer an explicitly configured user.email.
    try:
        out = subprocess.run(['git', 'config', 'user.email'],
                             capture_output=True, text=True, timeout=5)
        email = out.stdout.strip()
        if email:
            return email
    except (subprocess.SubprocessError, OSError):
        pass
    # Fall back to git's effective identity (auto-detected when user.email is unset).
    # `git var GIT_AUTHOR_IDENT` -> "Name <email> <timestamp> <tz>".
    try:
        out = subprocess.run(['git', 'var', 'GIT_AUTHOR_IDENT'],
                             capture_output=True, text=True, timeout=5)
        ident = out.stdout.strip()
        if '<' in ident and '>' in ident:
            return ident[ident.index('<') + 1:ident.index('>')]
    except (subprocess.SubprocessError, OSError):
        pass
    return 'unknown@local'


def main():
    backfill = '--backfill' in sys.argv

    url = os.environ.get('CC_DASHBOARD_URL')
    secret = os.environ.get('CC_DASHBOARD_HMAC_SECRET')
    handle = os.environ.get('CC_DASHBOARD_HANDLE')
    if not url or not secret or not handle:
        print('dashboard-push: missing CC_DASHBOARD_URL / CC_DASHBOARD_HMAC_SECRET / '
              'CC_DASHBOARD_HANDLE — skipping', file=sys.stderr)
        return 0

    if not backfill and is_debounced(LAST_PUSH_FILE, DEBOUNCE_SECONDS):
        return 0  # pushed recently — skip silently

    machine = socket.gethostname().split('.')[0]
    claude_dir = os.path.join(HOME, 'Claude')
    author_email = git_author_email()

    if backfill:
        # one row per date present across all sessions
        all_files = all_jsonl_files(PROJECTS_DIR)
        dates = set()
        for path in all_files:
            try:
                with open(path) as f:
                    for line in f:
                        try:
                            ts = json.loads(line).get('timestamp')
                        except json.JSONDecodeError:
                            continue
                        if ts:
                            dates.add(ts[:10])
            except OSError:
                continue
        for target_date in sorted(dates):
            day = parse_day(all_files, target_date, HOME)
            if day['tokens_total'] == 0:
                continue
            ships = count_ships(claude_dir, target_date, author_email)
            payload = build_payload(day, ships, handle, machine, target_date)
            status, text = post_payload(url, payload, secret)
            print(f'  {target_date}: {status} {text[:80]}')
        return 0

    # default: today only, incremental
    target_date = datetime.now().strftime('%Y-%m-%d')
    files = today_jsonl_files(PROJECTS_DIR)
    day = parse_day(files, target_date, HOME)
    ships = count_ships(claude_dir, target_date, author_email)
    payload = build_payload(day, ships, handle, machine, target_date)
    status, text = post_payload(url, payload, secret)

    if status == 200:
        with open(LAST_PUSH_FILE, 'w') as f:
            f.write(str(time.time()))
    else:
        print(f'dashboard-push: ingest returned {status}: {text[:200]}', file=sys.stderr)
    return 0 if status == 200 else 1


if __name__ == '__main__':
    sys.exit(main())
