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


def build_codex_registry(jsonl_paths, home):
    """One pass over Codex session files -> dedupe registry of REAL turns.

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
        and the session-cumulative counter in payload.info.total_token_usage.
      - turn_context event carries the current model (e.g. "gpt-5.5") and cwd.
        Both can change per turn within a session.

    REPLAY DEDUPE (the 2026-07-21 3.3B-token blowup): VS Code Codex
    subagent/fork threads write a NEW rollout file per fork that REPLAYS the
    parent thread's entire event history — including every historical
    token_count — stamped with the file-creation time, then append live work.
    A long-running thread snapshotted ~25x/day therefore counts its whole
    history ~25x if rows are summed naively (observed: 3.32B for a real
    ~460M day). Replayed lines carry no marker, so dedupe is by CONTENT:
    (last_token_usage, total_token_usage) — the cumulative counter makes each
    real turn unique within a lineage, and identical across every replayed
    copy of it. Each key keeps its EARLIEST-timestamped instance (the live
    occurrence; replays are always stamped later), so date attribution
    follows the turn's real time. Old-schema rows without total_token_usage
    predate forking and get a per-(file,line) key — counted as-is, no dedupe.

    Registry value: {ts, total, model, project, session} for the earliest
    instance. Build ONCE per run and aggregate per date with
    codex_day_from_registry() — the registry is date-independent.
    """
    registry = {}
    for path in jsonl_paths:
        # Session id = filename UUID after "rollout-<timestamp>-".
        base = os.path.basename(path)
        session_id = base.replace('rollout-', '').replace('.jsonl', '')
        current_model = None
        current_cwd = None
        line_no = 0
        try:
            with open(path) as f:
                for line in f:
                    line_no += 1
                    try:
                        d = json.loads(line)
                    except json.JSONDecodeError:
                        continue
                    payload = d.get('payload')
                    if not isinstance(payload, dict):
                        continue
                    top = d.get('type')

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

                    if payload.get('type') != 'token_count':
                        continue
                    ts = d.get('timestamp')
                    if not ts:
                        continue

                    info = payload.get('info') or {}
                    last = info.get('last_token_usage') or {}
                    total_usage = info.get('total_token_usage')
                    in_tok = int(last.get('input_tokens') or 0)
                    out_tok = int(last.get('output_tokens') or 0)
                    reason = int(last.get('reasoning_output_tokens') or 0)
                    # Codex "input_tokens" already includes cached portion — so
                    # ccusage-equivalent total is input + output + reasoning.
                    turn_total = in_tok + out_tok + reason
                    if turn_total <= 0:
                        continue

                    if isinstance(total_usage, dict):
                        key = (tuple(sorted(last.items())),
                               tuple(sorted(total_usage.items())))
                    else:
                        key = (path, line_no)
                    prev = registry.get(key)
                    # ISO-8601 Z timestamps compare correctly as strings.
                    if prev is None or ts < prev['ts']:
                        registry[key] = {
                            'ts': ts,
                            'total': turn_total,
                            'model': current_model or 'gpt-unknown',
                            'project': short_project(current_cwd, home),
                            'session': session_id,
                        }
        except OSError:
            continue
    return registry


def codex_day_from_registry(registry, target_date):
    """Aggregate a codex registry for one LOCAL date. Same return shape as
    parse_day() so the two can be merged additively.

    sessions and deep-work timestamps come from the DEDUPED turns (not from
    user_message/agent_message events) — replayed history duplicates those
    too, so a fork file with zero new work must not register as a session or
    as deep-work minutes.
    """
    tokens_by_model = defaultdict(int)
    tokens_by_project = defaultdict(int)
    tokens_by_hour = defaultdict(int)
    sessions = set()
    timestamps = []
    grand_total = 0
    for rec in registry.values():
        ts = rec['ts']
        if local_date(ts) != target_date:
            continue
        local_hour = datetime.fromisoformat(
            ts.replace('Z', '+00:00')
        ).astimezone().hour
        tokens_by_model[rec['model']] += rec['total']
        tokens_by_project[rec['project']] += rec['total']
        tokens_by_hour[str(local_hour)] += rec['total']
        sessions.add(rec['session'])
        timestamps.append(ts)
        grand_total += rec['total']
    return {
        'tokens_total': grand_total,
        'tokens_by_model': dict(tokens_by_model),
        'sessions': len(sessions),
        'projects_touched': dict(tokens_by_project),
        'tokens_by_hour': dict(tokens_by_hour),
        'timestamps': timestamps,
    }


def parse_codex_day(jsonl_paths, target_date, home):
    """One-shot registry build + single-date aggregate (compat wrapper).
    Multi-date callers should build the registry once and call
    codex_day_from_registry() per date."""
    return codex_day_from_registry(build_codex_registry(jsonl_paths, home),
                                   target_date)


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


def _codex_roots(codex_sessions_dir):
    """The live sessions tree plus Codex's flat archive of closed threads.

    Codex MOVES a thread's rollout file into ~/.codex/archived_sessions when
    the thread is archived — scanning only the live tree made archived days'
    tokens vanish from history and the rolling re-push then overwrote the
    previously-correct rows with the shrunken recount (observed 2026-08-04:
    8/2 Codex 69M→28M, 8/3 114M→15M). mtimes survive the move, so the
    mtime-window filters below behave the same for archived files.
    """
    roots = [codex_sessions_dir]
    archived = os.path.join(os.path.dirname(codex_sessions_dir.rstrip('/')),
                            'archived_sessions')
    if os.path.isdir(archived):
        roots.append(archived)
    return [r for r in roots if os.path.isdir(r)]


def today_codex_files(codex_sessions_dir):
    """Codex session JSONL files modified since local midnight. Codex stores
    sessions at ~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl (plus the flat
    archive — see _codex_roots). Returns [] if no directory exists — Codex is
    opt-in, not every user has it."""
    midnight = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    cutoff = midnight.timestamp()
    out = []
    for root in _codex_roots(codex_sessions_dir):
        for path in glob.glob(os.path.join(root, '**', 'rollout-*.jsonl'), recursive=True):
            try:
                if os.path.getmtime(path) >= cutoff:
                    out.append(path)
            except OSError:
                continue
    return out


def all_codex_files(codex_sessions_dir):
    """All Codex session JSONL files (full backfill set), live + archived."""
    out = []
    for root in _codex_roots(codex_sessions_dir):
        out.extend(glob.glob(os.path.join(root, '**', 'rollout-*.jsonl'), recursive=True))
    return out


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
    """Codex session JSONL files modified within the last `hours`, live +
    archived. Same boundary rationale as recent_jsonl_files. [] if Codex
    isn't installed."""
    if now_ts is None:
        now_ts = time.time()
    cutoff = now_ts - hours * 3600
    out = []
    for root in _codex_roots(codex_sessions_dir):
        for path in glob.glob(os.path.join(root, '**', 'rollout-*.jsonl'), recursive=True):
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
    xreg = build_codex_registry(xfiles, home)
    out = []
    for date in date_window(now_ts, back_days):
        day = merge_days(parse_day(cfiles, date, home),
                         codex_day_from_registry(xreg, date))
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


def stable_machine_name():
    """Stable per-machine label that does NOT drift with network/DHCP.

    socket.gethostname() on macOS returns the *transient* hostname, which
    silently falls back to the bare default 'Mac' when the static HostName is
    unset (the macOS default) and the network supplies no name — e.g. on a DHCP
    lease change or a network switch. That makes one physical Mac push under two
    different machine names ('MacBook-Air' normally, 'Mac' after a network
    event), and the dashboard SUMS rows across machine names — producing a
    phantom machine and ~2x double-counted tokens for the day. Diagnosed
    2026-06-09 after a single Mac created both 'MacBook-Air' and 'Mac' rows with
    byte-identical token breakdowns.

    Resolution order (first hit wins):
      1. CC_DASHBOARD_MACHINE env override — explicit pin, authoritative.
      2. macOS ComputerName via scutil — user-set, stable across networks.
      3. socket.gethostname() — last resort (Linux/other, or scutil missing).
    Spaces collapse to hyphens so 'MacBook Air' -> 'MacBook-Air', matching the
    historical row names.
    """
    pin = os.environ.get('CC_DASHBOARD_MACHINE')
    if pin and pin.strip():
        return pin.strip().replace(' ', '-')
    if sys.platform == 'darwin':
        try:
            out = subprocess.run(['scutil', '--get', 'ComputerName'],
                                 capture_output=True, text=True, timeout=5)
            name = out.stdout.strip()
            if out.returncode == 0 and name:
                return name.replace(' ', '-')
        except (subprocess.SubprocessError, OSError):
            pass
    return socket.gethostname().split('.')[0].replace(' ', '-')


def main():
    backfill = '--backfill' in sys.argv
    # --since YYYY-MM-DD (backfill only): re-push only dates >= since. The
    # codex dedupe registry still spans ALL files so pre-since history keeps
    # its true first-seen dates; claude files are mtime-pruned (a file can't
    # contain events later than its mtime, so mtime < since-midnight files
    # can't contribute to any pushed date).
    since = None
    if '--since' in sys.argv:
        try:
            since = sys.argv[sys.argv.index('--since') + 1]
            datetime.strptime(since, '%Y-%m-%d')
        except (IndexError, ValueError):
            print('dashboard-push: --since requires YYYY-MM-DD', file=sys.stderr)
            return 1

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

    machine = stable_machine_name()
    claude_dir = os.path.join(HOME, 'Claude')
    author_email = git_author_email()

    if backfill:
        # one row per date present across either Claude OR Codex sessions.
        all_claude = all_jsonl_files(PROJECTS_DIR)
        all_codex = all_codex_files(CODEX_SESSIONS_DIR)
        # Codex dedupe registry spans ALL files (never --since-pruned) so each
        # turn keys to its true first-seen date. Built once; per-date
        # aggregation is a cheap in-memory pass.
        codex_registry = build_codex_registry(all_codex, HOME)
        if since:
            since_cutoff = datetime.strptime(since, '%Y-%m-%d').timestamp()
            pruned = []
            for path in all_claude:
                try:
                    if os.path.getmtime(path) >= since_cutoff:
                        pruned.append(path)
                except OSError:
                    continue
            all_claude = pruned
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
        # Codex events carry UTC timestamps too; the registry already keyed
        # them by earliest instance — take dates from there so replay copies
        # don't invent extra days.
        for rec in codex_registry.values():
            dates.add(local_date(rec['ts']))
        dates.discard(None)  # malformed timestamps -> local_date() returned None
        if since:
            dates = {dt for dt in dates if dt >= since}
        for target_date in sorted(dates):
            claude_day = parse_day(all_claude, target_date, HOME)
            codex_day = codex_day_from_registry(codex_registry, target_date)
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
