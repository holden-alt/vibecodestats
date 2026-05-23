#!/usr/bin/env python3
"""
dashboard_push.py — push today's Claude Code stats to the cc-dashboard ingest API.

Stdlib only. Parses ~/.claude/projects/*/*.jsonl for the target date, computes a
per-machine daily stats payload, and POSTs to /api/ingest.

Supports two auth modes:
  1. Bearer token (preferred): CC_DASHBOARD_TOKEN
  2. HMAC signature (legacy): CC_DASHBOARD_HMAC_SECRET + CC_DASHBOARD_HANDLE

Default mode parses only files modified today (fast — runs after every CC turn
via the Stop hook). --backfill parses everything for a one-time history load.

Env vars required:
  CC_DASHBOARD_URL                   e.g. https://cc-dashboard-qab.pages.dev
  CC_DASHBOARD_TOKEN                 (preferred) per-user Bearer token
    OR
  CC_DASHBOARD_HMAC_SECRET           (legacy) same value as deploy's INGEST_HMAC_SECRET
  CC_DASHBOARD_HANDLE                (legacy) the GitHub handle whose profile this machine feeds
"""

import glob
import hashlib
import hmac
import json
import math
import os
import re
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


def _usage_total(usage):
    """Total tokens for one usage row, ccusage convention: sum all four fields."""
    return ((usage.get('input_tokens') or 0)
            + (usage.get('output_tokens') or 0)
            + (usage.get('cache_creation_input_tokens') or 0)
            + (usage.get('cache_read_input_tokens') or 0))


def parse_day(jsonl_paths, target_date, home):
    """Parse the given JSONL files, return aggregates for target_date (YYYY-MM-DD).

    cwd is tracked PER EVENT (not pinned to the first cwd seen), because Claude
    Code sessions frequently cd around — the session's first cwd is often the
    user's home dir, not the project they end up working in. Each token-bearing
    event is attributed to the most recent cwd seen up to that point.

    Token formula matches ccusage (the canonical community parser):
      total = input_tokens + output_tokens
            + cache_creation_input_tokens + cache_read_input_tokens

    Dedupe handling: a single API response with multiple content blocks
    (thinking + text + each tool_use) is written to the JSONL as one line per
    block. All lines share the same `(message.id, requestId)`. Usage is often
    identical across lines; sometimes earlier lines carry partial output_tokens
    (streaming snapshots) and the last line carries the cumulative total. We
    dedupe by `(message.id, requestId)` and keep the row with the LARGEST
    usage-sum so streaming snapshots collapse to the final value. Subagent
    JSONLs use distinct message.ids from the parent, so this does not erase
    real subagent work.
    """
    tokens_by_model = defaultdict(int)
    tokens_by_project = defaultdict(int)
    tokens_by_hour = defaultdict(int)
    sessions = set()
    timestamps = []
    # (message.id, requestId) -> {total, output, cache_creation, tool_uses, model, project, hour}
    by_msg = {}
    for path in jsonl_paths:
        session_id = os.path.basename(path).replace('.jsonl', '')
        current_cwd = None
        try:
            with open(path) as f:
                for line in f:
                    try:
                        d = json.loads(line)
                    except json.JSONDecodeError:
                        continue
                    if d.get('cwd'):
                        current_cwd = d['cwd']
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
                    total = _usage_total(usage)
                    output = usage.get('output_tokens') or 0
                    cache_creation = usage.get('cache_creation_input_tokens') or 0
                    content = msg.get('content')
                    tool_uses = 0
                    if isinstance(content, list):
                        tool_uses = sum(
                            1 for c in content
                            if isinstance(c, dict) and c.get('type') == 'tool_use'
                        )
                    label = short_project(current_cwd, home)
                    local_hour = datetime.fromisoformat(
                        ts.replace('Z', '+00:00')
                    ).astimezone().hour
                    mid = msg.get('id')
                    rid = d.get('requestId') or msg.get('id')
                    if mid is None:
                        tokens_by_model[model] += total
                        tokens_by_project[label] += total
                        tokens_by_hour[str(local_hour)] += total
                        continue
                    key = (mid, rid)
                    prev = by_msg.get(key)
                    if prev is None or total > prev['total']:
                        by_msg[key] = {
                            'total': total,
                            'output': output,
                            'cache_creation': cache_creation,
                            # tool_uses can vary across the duplicated lines —
                            # take the MAX seen so we don't undercount when the
                            # final cumulative line has more tool_use blocks
                            # than the earlier streaming snapshots.
                            'tool_uses': max(tool_uses, (prev or {}).get('tool_uses', 0)),
                            'model': model,
                            'project': label,
                            'hour': str(local_hour),
                        }
                    elif prev is not None and tool_uses > prev.get('tool_uses', 0):
                        prev['tool_uses'] = tool_uses
        except OSError:
            continue

    total_output = 0
    total_cache_creation = 0
    total_tool_uses = 0
    for rec in by_msg.values():
        tokens_by_model[rec['model']] += rec['total']
        tokens_by_project[rec['project']] += rec['total']
        tokens_by_hour[rec['hour']] += rec['total']
        total_output += rec['output']
        total_cache_creation += rec['cache_creation']
        total_tool_uses += rec['tool_uses']

    return {
        'tokens_total': sum(tokens_by_model.values()),
        'tokens_by_model': dict(tokens_by_model),
        'output_tokens': total_output,
        'cache_creation_tokens': total_cache_creation,
        'tool_calls': total_tool_uses,
        'sessions': len(sessions),
        'projects_touched': dict(tokens_by_project),
        'tokens_by_hour': dict(tokens_by_hour),
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


_TEST_PATH_RE = re.compile(r'(^|/)(tests?|__tests__|spec|specs|e2e|fixtures?)(/|$)|\.test\.|\.spec\.', re.IGNORECASE)


def _per_commit_quality(repo, sha):
    """Compute ship_quality for one commit:
        log10(lines_changed + 1) * unique_files * non_test_ratio
    Capped at 20 to prevent one mega-commit gaming.
    """
    try:
        out = subprocess.run(
            ['git', 'show', '--numstat', '--format=', sha],
            cwd=repo, capture_output=True, text=True, timeout=10,
        )
    except (subprocess.SubprocessError, OSError):
        return 0.0
    if out.returncode != 0:
        return 0.0
    files = []
    total_lines = 0
    for ln in out.stdout.splitlines():
        parts = ln.split('\t')
        if len(parts) < 3:
            continue
        add_str, del_str, path = parts[0], parts[1], parts[2]
        try:
            added = int(add_str) if add_str != '-' else 0
            removed = int(del_str) if del_str != '-' else 0
        except ValueError:
            continue
        files.append(path)
        total_lines += added + removed
    if not files:
        return 0.0
    file_count = len(files)
    test_files = sum(1 for p in files if _TEST_PATH_RE.search(p))
    non_test_ratio = (file_count - test_files) / file_count if file_count else 0
    raw = math.log10(total_lines + 1) * file_count * non_test_ratio
    return min(20.0, raw)


def count_ships(claude_dir, target_date, author_email):
    """Count commits authored by author_email on target_date across git repos
    directly under claude_dir and one level deeper (claude_dir/*/  and claude_dir/*/*/).

    Also computes ship_quality = sum over commits of
      log10(lines_changed + 1) * unique_files * non_test_ratio    (per-commit cap 20)
    """
    candidates = []
    for depth1 in glob.glob(os.path.join(claude_dir, '*')):
        if os.path.isdir(os.path.join(depth1, '.git')):
            candidates.append(depth1)
        for depth2 in glob.glob(os.path.join(depth1, '*')):
            if os.path.isdir(os.path.join(depth2, '.git')):
                candidates.append(depth2)

    commits = 0
    repos_with_commits = 0
    ship_quality = 0.0
    since = target_date + 'T00:00:00'
    until = target_date + 'T23:59:59'
    for repo in candidates:
        try:
            out = subprocess.run(
                ['git', 'log', '--author=' + author_email,
                 '--since=' + since, '--until=' + until, '--format=%H'],
                cwd=repo, capture_output=True, text=True, timeout=10,
            )
        except (subprocess.SubprocessError, OSError):
            continue
        if out.returncode != 0:
            continue
        shas = [ln.strip() for ln in out.stdout.splitlines() if ln.strip()]
        if not shas:
            continue
        commits += len(shas)
        repos_with_commits += 1
        for sha in shas:
            ship_quality += _per_commit_quality(repo, sha)
    return {'commits': commits, 'repos': repos_with_commits, 'ship_quality': ship_quality}


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
        # ships payload keeps the {commits, repos} shape the endpoint expects;
        # ship_quality is sent alongside, not inside ships, for backwards-compat.
        'ships': {'commits': ships['commits'], 'repos': ships['repos']},
        'hourly_tokens': day.get('tokens_by_hour', {}),
        # VBW raw inputs — endpoint sums these across machines and computes the
        # 5 dimensions + final VBW server-side.
        'output_tokens': day.get('output_tokens', 0),
        'cache_creation_tokens': day.get('cache_creation_tokens', 0),
        'tool_calls': day.get('tool_calls', 0),
        'ship_quality': ships.get('ship_quality', 0.0),
    }


def post_payload(url, payload, token=None, secret=None):
    """POST the payload with Bearer token (preferred) or HMAC signature (fallback).

    Returns (status_code, response_text).
    """
    body = json.dumps(payload, separators=(',', ':'), sort_keys=True)
    headers = {
        'Content-Type': 'application/json',
        # Cloudflare's WAF 403s the default Python-urllib User-Agent (error 1010).
        'User-Agent': 'cc-dashboard-push/1.0',
    }

    # Prefer Bearer token; fall back to HMAC signature.
    if token:
        headers['Authorization'] = f'Bearer {token}'
    elif secret:
        signature = sign_body(body, secret)
        headers['X-CC-Signature'] = signature

    req = urllib.request.Request(
        url.rstrip('/') + '/api/ingest',
        data=body.encode(),
        headers=headers,
        method='POST',
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return resp.status, resp.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()


def today_jsonl_files(projects_dir):
    """JSONL files modified since local midnight.

    Recursive glob — Claude Code subagents log to
    `projects/<dir>/<session-id>/subagents/agent-*.jsonl` (4-level deep),
    and those events use haiku/sonnet while the main session is mostly
    opus. A 2-level glob misses every non-opus token.
    """
    midnight = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    cutoff = midnight.timestamp()
    out = []
    for path in glob.glob(os.path.join(projects_dir, '**', '*.jsonl'), recursive=True):
        try:
            if os.path.getmtime(path) >= cutoff:
                out.append(path)
        except OSError:
            continue
    return out


def all_jsonl_files(projects_dir):
    """All JSONL files (recursive — includes subagent logs)."""
    return glob.glob(os.path.join(projects_dir, '**', '*.jsonl'), recursive=True)


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
    token = os.environ.get('CC_DASHBOARD_TOKEN')
    secret = os.environ.get('CC_DASHBOARD_HMAC_SECRET')
    handle = os.environ.get('CC_DASHBOARD_HANDLE')

    # Validate: require URL and either (token) or (secret + handle).
    if not url:
        print('dashboard-push: missing CC_DASHBOARD_URL and either '
              'CC_DASHBOARD_TOKEN or both CC_DASHBOARD_HMAC_SECRET + '
              'CC_DASHBOARD_HANDLE — skipping', file=sys.stderr)
        return 0
    if not token and not (secret and handle):
        print('dashboard-push: missing CC_DASHBOARD_URL and either '
              'CC_DASHBOARD_TOKEN or both CC_DASHBOARD_HMAC_SECRET + '
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
            status, text = post_payload(url, payload, token=token, secret=secret)
            print(f'  {target_date}: {status} {text[:80]}')
        return 0

    # default: today only, incremental
    target_date = datetime.now().strftime('%Y-%m-%d')
    files = today_jsonl_files(PROJECTS_DIR)
    day = parse_day(files, target_date, HOME)
    ships = count_ships(claude_dir, target_date, author_email)
    payload = build_payload(day, ships, handle, machine, target_date)
    status, text = post_payload(url, payload, token=token, secret=secret)

    if status == 200:
        with open(LAST_PUSH_FILE, 'w') as f:
            f.write(str(time.time()))
        # Cache today's VBW + token total for the statusline. Both share the
        # same dashboard formula, so the statusline always matches vibecodestats
        # exactly (no diverging per-session-delta accounting). Refreshed every
        # Stop hook (which is every CC turn end).
        try:
            cache_dir = os.path.join(HOME, '.claude', 'daily-tokens')
            os.makedirs(cache_dir, exist_ok=True)
            now_ts = int(time.time())
            # tokens-today.json — authoritative ccusage daily total for this Mac.
            with open(os.path.join(cache_dir, 'tokens-today.json'), 'w') as f:
                json.dump({
                    'tokens': int(payload['tokens_total']),
                    'date': target_date,
                    'ts': now_ts,
                }, f)
            # vbw-today.json — parsed from the API response.
            resp = json.loads(text)
            vbw_val = resp.get('vbw')
            if isinstance(vbw_val, (int, float)):
                with open(os.path.join(cache_dir, 'vbw-today.json'), 'w') as f:
                    json.dump({
                        'vbw': int(vbw_val),
                        'date': target_date,
                        'ts': now_ts,
                    }, f)
        except (json.JSONDecodeError, OSError, TypeError):
            pass
    else:
        print(f'dashboard-push: ingest returned {status}: {text[:200]}', file=sys.stderr)
    return 0 if status == 200 else 1


if __name__ == '__main__':
    sys.exit(main())
