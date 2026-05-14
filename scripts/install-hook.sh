#!/usr/bin/env bash
# install-hook.sh — idempotently add the cc-dashboard Stop hook to a Claude settings.json.
# Usage: install-hook.sh <settings.json path> <absolute path to dashboard_push.py>
set -euo pipefail

SETTINGS="${1:?settings.json path required}"
PUSH_SCRIPT="${2:?dashboard_push.py path required}"

if [ ! -f "$SETTINGS" ]; then
  echo '{}' > "$SETTINGS"
fi

python3 - "$SETTINGS" "$PUSH_SCRIPT" <<'PY'
import json, os, sys

settings_path, push_script = sys.argv[1], sys.argv[2]
with open(settings_path) as f:
    cfg = json.load(f)

cfg.setdefault('hooks', {})
# Background the push so it never adds latency to a CC turn.
command = f'nohup python3 {push_script} >/dev/null 2>&1 &'

# Idempotency key: match on the push script's basename (e.g. dashboard_push.py).
# Keying off the actual arg rather than a hardcoded string keeps this correct
# regardless of how the script is named or where it lives.
push_basename = os.path.basename(push_script)

stop_hooks = cfg['hooks'].get('Stop', [])
# Idempotency: drop any prior cc-dashboard Stop entry before re-adding.
stop_hooks = [
    group for group in stop_hooks
    if not any(push_basename in h.get('command', '')
               for h in group.get('hooks', []))
]
stop_hooks.append({'hooks': [{'type': 'command', 'command': command}]})
cfg['hooks']['Stop'] = stop_hooks

with open(settings_path, 'w') as f:
    json.dump(cfg, f, indent=2)
    f.write('\n')
print(f'Stop hook installed -> {push_script}')
PY
