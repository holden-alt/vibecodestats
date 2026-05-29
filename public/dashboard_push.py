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
import os
import re
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request
from collections import defaultdict
from datetime import datetime, timedelta, timezone

HOME = os.path.expanduser('~')
PROJECTS_DIR = os.path.join(HOME, '.claude', 'projects')
CODEX_SESSIONS_DIR = os.path.join(HOME, '.codex', 'sessions')
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


def local_date(ts):
    """Local calendar date ('YYYY-MM-DD') for an ISO-8601 timestamp.

    Events are stamped in UTC (trailing 'Z'), but the dashboard reports by the
    user's LOCAL day — matching tokens_by_hour, which is already local. Keying
    on the UTC date instead rolls evening work (anything after UTC midnight,
    ~20:00 US-Eastern) onto the next day, which empties 'today' in the evening.
    astimezone() with no argument converts to the machine's local timezone.
    Returns None for a missing/malformed timestamp so callers skip it rather
    than crash (None never equals a target date).
    """
    try:
        return datetime.fromisoformat(ts.replace('Z', '+00:00')).astimezone().strftime('%Y-%m-%d')
    except (ValueError, AttributeError, TypeError):
        return None


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
    # (message.id, requestId) -> {total, model, project, hour}
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
                    if not ts or local_date(ts) != target_date:
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
                            'model': model,
                            'project': label,
                            'hour': str(local_hour),
                        }
        except OSError:
            continue

    for rec in by_msg.values():
        tokens_by_model[rec['model']] += rec['total']
        tokens_by_project[rec['project']] += rec['total']
        tokens_by_hour[rec['hour']] += rec['total']

    return {
        'tokens_total': sum(tokens_by_model.values()),
        'tokens_by_model': dict(tokens_by_model),
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


def parse_codex_day(jsonl_paths, target_date, home):
    """Parse Codex CLI session files for target_date. Same return shape as
    parse_day() so the two can be merged additively.

    Codex JSONL schema (different from Claude's, fully decoded):
      - Each line: {type: "response_item"|"event_msg"|"turn_context"|"session_meta",
                    payload: {type: "...", ...}}
      - token_count event (event_msg) carries per-turn marginal usage in
        payload.info.last_token_usage:
            input_tokens (ALREADY includes cached portion)
            cached_input_tokens (subset of input — analog of cache_read)
            output_tokens
            reasoning_output_tokens (thinking — added to output for our purposes)
            total_tokens (= input + output, EXCLUDES reasoning)
      - turn_context event carries the current model (e.g. "gpt-5.5") and cwd.
        Both can change per turn within a session.
      - function_call + custom_tool_call response_items = tool invocations.
      - user_message + agent_message event_msgs = turn boundaries for sessions
        and deep_work timestamp collection.

    No dedupe needed (one token_count per turn, marginal, no streaming
    snapshots). We DO carry forward the most-recent (model, cwd) seen so each
    token_count is attributed correctly even on long sessions that switch
    cwd mid-stream.
    """
    tokens_by_model = defaultdict(int)
    tokens_by_project = defaultdict(int)
    tokens_by_hour = defaultdict(int)
    sessions = set()
    timestamps = []
    grand_total = 0

    for path in jsonl_paths:
        # Session id = filename UUID after "rollout-<timestamp>-".
        base = os.path.basename(path)
        session_id = base.replace('rollout-', '').replace('.jsonl', '')
        current_model = None
        current_cwd = None
        try:
            with open(path) as f:
                for line in f:
                    try:
                        d = json.loads(line)
                    except json.JSONDecodeError:
                        continue
                    payload = d.get('payload')
                    if not isinstance(payload, dict):
                        continue
                    top = d.get('type')
                    kind = payload.get('type')

                    # Pick up cwd from session_meta (one-time, session-wide
                    # default) — turn_context.cwd overrides on the fly.
                    if top == 'session_meta':
                        if payload.get('cwd'):
                            current_cwd = payload['cwd']
                        continue

                    if top == 'turn_context':
                        if payload.get('model'):
                            current_model = payload['model']
                        if payload.get('cwd'):
                            current_cwd = payload['cwd']
                        continue

                    ts = d.get('timestamp')
                    if not ts or local_date(ts) != target_date:
                        continue

                    if kind in ('user_message', 'agent_message'):
                        sessions.add(session_id)
                        timestamps.append(ts)

                    if kind not in ('token_count',):
                        continue

                    info = payload.get('info') or {}
                    last = info.get('last_token_usage') or {}
                    in_tok = int(last.get('input_tokens') or 0)
                    out_tok = int(last.get('output_tokens') or 0)
                    reason = int(last.get('reasoning_output_tokens') or 0)
                    # Codex "input_tokens" already includes cached portion — so
                    # ccusage-equivalent total is input + output + reasoning.
                    turn_total = in_tok + out_tok + reason
                    if turn_total <= 0:
                        continue

                    model = current_model or 'gpt-unknown'
                    label = short_project(current_cwd, home)
                    local_hour = datetime.fromisoformat(
                        ts.replace('Z', '+00:00')
                    ).astimezone().hour

                    tokens_by_model[model] += turn_total
                    tokens_by_project[label] += turn_total
                    tokens_by_hour[str(local_hour)] += turn_total
                    grand_total += turn_total
        except OSError:
            continue

    return {
        'tokens_total': grand_total,
        'tokens_by_model': dict(tokens_by_model),
        'sessions': len(sessions),
        'projects_touched': dict(tokens_by_project),
        'tokens_by_hour': dict(tokens_by_hour),
        'timestamps': timestamps,
    }


def merge_days(a, b):
    """Combine two parsed-day dicts (Claude + Codex) into one summed dict.

    Scalar fields sum. Dict fields merge by key (summing values). Sets and
    lists union. Used to produce a single ingest payload that represents
    ALL AI usage on this Mac for the day, regardless of tool.
    """
    if not a:
        return b
    if not b:
        return a

    def merge_records(x, y):
        out = dict(x or {})
        for k, v in (y or {}).items():
            out[k] = (out.get(k, 0) or 0) + v
        return out

    return {
        'tokens_total': (a.get('tokens_total', 0) or 0) + (b.get('tokens_total', 0) or 0),
        'tokens_by_model': merge_records(a.get('tokens_by_model'), b.get('tokens_by_model')),
        'sessions': (a.get('sessions', 0) or 0) + (b.get('sessions', 0) or 0),
        'projects_touched': merge_records(a.get('projects_touched'), b.get('projects_touched')),
        'tokens_by_hour': merge_records(a.get('tokens_by_hour'), b.get('tokens_by_hour')),
        'timestamps': (a.get('timestamps') or []) + (b.get('timestamps') or []),
    }


def count_ships(claude_dir, target_date, author_email):
    """Count commits authored by author_email on target_date across git repos
    directly under claude_dir and one level deeper (claude_dir/*/ and claude_dir/*/*/).
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
        'ships': {'commits': ships['commits'], 'repos': ships['repos']},
        'hourly_tokens': day.get('tokens_by_hour', {}),
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


def today_codex_files(codex_sessions_dir):
    """Codex session JSONL files modified since local midnight. Codex stores
    sessions at ~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl. Returns [] if
    the directory doesn't exist — Codex is opt-in, not every user has it."""
    if not os.path.isdir(codex_sessions_dir):
        return []
    midnight = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    cutoff = midnight.timestamp()
    out = []
    for path in glob.glob(os.path.join(codex_sessions_dir, '**', 'rollout-*.jsonl'), recursive=True):
        try:
            if os.path.getmtime(path) >= cutoff:
                out.append(path)
        except OSError:
            continue
    return out


def all_codex_files(codex_sessions_dir):
    """All Codex session JSONL files (full backfill set)."""
    if not os.path.isdir(codex_sessions_dir):
        return []
    return glob.glob(os.path.join(codex_sessions_dir, '**', 'rollout-*.jsonl'), recursive=True)


def recent_jsonl_files(projects_dir, now_ts=None, hours=48):
    """JSONL files modified within the last `hours` (default 48).

    Wider than today_jsonl_files' since-local-midnight cutoff on purpose: an
    event whose UTC date is "today" can occur as early as local yesterday
    evening (UTC midnight = ~20:00 in US timezones), and if that session goes
    cold before local midnight its file's mtime falls *before* the midnight
    cutoff. The narrow glob then never re-reads it, so the day's tokens are
    silently dropped (the 2026-05-27 ~94M undercount). A 48h window covers the
    boundary for any timezone; parse_day still filters events by date, so
    over-including files only costs a little parse time.
    """
    if now_ts is None:
        now_ts = time.time()
    cutoff = now_ts - hours * 3600
    out = []
    for path in glob.glob(os.path.join(projects_dir, '**', '*.jsonl'), recursive=True):
        try:
            if os.path.getmtime(path) >= cutoff:
                out.append(path)
        except OSError:
            continue
    return out


def recent_codex_files(codex_sessions_dir, now_ts=None, hours=48):
    """Codex session JSONL files modified within the last `hours`. Same
    boundary rationale as recent_jsonl_files. [] if Codex isn't installed."""
    if not os.path.isdir(codex_sessions_dir):
        return []
    if now_ts is None:
        now_ts = time.time()
    cutoff = now_ts - hours * 3600
    out = []
    for path in glob.glob(os.path.join(codex_sessions_dir, '**', 'rollout-*.jsonl'), recursive=True):
        try:
            if os.path.getmtime(path) >= cutoff:
                out.append(path)
        except OSError:
            continue
    return out


def date_window(now_ts, back_days=1):
    """LOCAL date strings 'YYYY-MM-DD' from (today - back_days) .. today inclusive.

    Day totals are keyed by LOCAL date (parse_day filters via local_date()).
    Re-covering yesterday as well as today means a day's late-arriving or
    boundary events get re-pushed by the next day's runs instead of being
    stranded after that day's last same-day push.
    """
    today = datetime.fromtimestamp(now_ts).date()  # machine-local date
    return [(today - timedelta(days=n)).strftime('%Y-%m-%d')
            for n in range(back_days, -1, -1)]


def incremental_payloads(projects_dir, codex_sessions_dir, now_ts, home,
                         back_days=1, window_hours=48):
    """Parse the recent file window and return [(date, merged_day_dict), ...]
    for each LOCAL date in the window (oldest first, today last).

    This is the incremental analog of the backfill: it re-covers a rolling
    window so boundary/late events are captured rather than dropped. Pure (no
    network, no git) so the capture behavior is unit-testable.
    """
    cfiles = recent_jsonl_files(projects_dir, now_ts, window_hours)
    xfiles = recent_codex_files(codex_sessions_dir, now_ts, window_hours)
    out = []
    for date in date_window(now_ts, back_days):
        day = merge_days(parse_day(cfiles, date, home),
                         parse_codex_day(xfiles, date, home))
        out.append((date, day))
    return out


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
        # one row per date present across either Claude OR Codex sessions.
        all_claude = all_jsonl_files(PROJECTS_DIR)
        all_codex = all_codex_files(CODEX_SESSIONS_DIR)
        dates = set()
        for path in all_claude:
            try:
                with open(path) as f:
                    for line in f:
                        try:
                            ts = json.loads(line).get('timestamp')
                        except json.JSONDecodeError:
                            continue
                        if ts:
                            dates.add(local_date(ts))
            except OSError:
                continue
        # Codex events carry UTC timestamps too; key them by local date so they
        # land on the same day as parse_codex_day attributes them (the by-path
        # YYYY/MM/DD only marks the session's start dir, which can differ).
        for path in all_codex:
            try:
                with open(path) as f:
                    for line in f:
                        try:
                            ts = json.loads(line).get('timestamp')
                        except json.JSONDecodeError:
                            continue
                        if ts:
                            dates.add(local_date(ts))
            except OSError:
                continue
        dates.discard(None)  # malformed timestamps -> local_date() returned None
        for target_date in sorted(dates):
            claude_day = parse_day(all_claude, target_date, HOME)
            codex_day = parse_codex_day(all_codex, target_date, HOME)
            day = merge_days(claude_day, codex_day)
            if day['tokens_total'] == 0:
                continue
            ships = count_ships(claude_dir, target_date, author_email)
            payload = build_payload(day, ships, handle, machine, target_date)
            status, text = post_payload(url, payload, token=token, secret=secret)
            sources = []
            if claude_day['tokens_total'] > 0:
                sources.append(f'cc={claude_day["tokens_total"]:,}')
            if codex_day['tokens_total'] > 0:
                sources.append(f'codex={codex_day["tokens_total"]:,}')
            src_label = ' + '.join(sources) if sources else 'empty'
            print(f'  {target_date}: {status} [{src_label}] {text[:60]}')
        return 0

    # default: incremental over a rolling window (today + yesterday UTC), so a
    # day's boundary/late events in files that have gone cold are still
    # captured rather than dropped. Claude + Codex merged per date.
    now_ts = time.time()
    today_date = datetime.fromtimestamp(now_ts).strftime('%Y-%m-%d')  # machine-local
    today_status, today_text, today_payload = None, None, None
    for target_date, day in incremental_payloads(PROJECTS_DIR, CODEX_SESSIONS_DIR,
                                                  now_ts, HOME):
        ships = count_ships(claude_dir, target_date, author_email)
        payload = build_payload(day, ships, handle, machine, target_date)
        status, text = post_payload(url, payload, token=token, secret=secret)
        if target_date == today_date:
            today_status, today_text, today_payload = status, text, payload
        if status != 200:
            print(f'dashboard-push: ingest {target_date} returned {status}: '
                  f'{text[:200]}', file=sys.stderr)

    if today_status == 200:
        with open(LAST_PUSH_FILE, 'w') as f:
            f.write(str(time.time()))
        # Cache the token total for the statusline. Refreshed every Stop hook
        # (which is every CC turn end).
        try:
            cache_dir = os.path.join(HOME, '.claude', 'daily-tokens')
            os.makedirs(cache_dir, exist_ok=True)
            cache_ts = int(time.time())
            # tokens-today.json — authoritative ccusage daily total for this Mac.
            with open(os.path.join(cache_dir, 'tokens-today.json'), 'w') as f:
                json.dump({
                    'tokens': int(today_payload['tokens_total']),
                    'date': today_date,
                    'ts': cache_ts,
                }, f)
        except OSError:
            pass
    return 0 if today_status == 200 else 1


if __name__ == '__main__':
    sys.exit(main())
