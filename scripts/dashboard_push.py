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
