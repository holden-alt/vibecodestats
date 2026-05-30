
export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = url.origin;
  const script = INSTALLER_SCRIPT.replaceAll('__ORIGIN__', origin);
  return new Response(script, {
    headers: { 'content-type': 'text/x-shellscript; charset=utf-8' },
  });
}

const INSTALLER_SCRIPT = `#!/usr/bin/env bash
# cc-dashboard installer — macOS
# Usage:
#   curl -fsSL __ORIGIN__/install.sh | TOKEN=xxx HANDLE=yyy URL=__ORIGIN__ bash
set -euo pipefail

: "\${TOKEN:?TOKEN env var required (your ingest token from /setup)}"
: "\${HANDLE:?HANDLE env var required (your github handle)}"
URL="\${URL:-__ORIGIN__}"

INSTALL_DIR="\${HOME}/.config/cc-dashboard"
SCRIPT_PATH="\${INSTALL_DIR}/dashboard_push.py"
CONFIG_PATH="\${INSTALL_DIR}/config"
SETTINGS_PATH="\${HOME}/.claude/settings.json"

echo "[1/6] cc-dashboard installer for @\${HANDLE}"
echo "      install dir: \${INSTALL_DIR}"

mkdir -p "\${INSTALL_DIR}"

echo "[2/6] downloading dashboard_push.py..."
curl -fsSL "\${URL}/dashboard_push.py" -o "\${SCRIPT_PATH}"
chmod +x "\${SCRIPT_PATH}"

echo "[3/6] writing config..."
cat > "\${CONFIG_PATH}" <<EOF
export CC_DASHBOARD_URL="\${URL}"
export CC_DASHBOARD_TOKEN="\${TOKEN}"
export CC_DASHBOARD_HANDLE="\${HANDLE}"
EOF
chmod 600 "\${CONFIG_PATH}"

if [ -d "\${HOME}/.claude" ]; then
  echo "[4/6] installing Claude Code Stop hook (instant refresh on every CC turn)..."
  mkdir -p "\$(dirname "\${SETTINGS_PATH}")"
  [ -f "\${SETTINGS_PATH}" ] || echo '{}' > "\${SETTINGS_PATH}"

  python3 - "\${SETTINGS_PATH}" "\${SCRIPT_PATH}" "\${CONFIG_PATH}" <<'PY'
import json, os, sys
settings_path, push_script, config_path = sys.argv[1], sys.argv[2], sys.argv[3]
with open(settings_path) as f:
    cfg = json.load(f)
cfg.setdefault('hooks', {})
command = f'nohup bash -c "source {config_path} && python3 {push_script}" >/dev/null 2>&1 &'
push_basename = os.path.basename(push_script)
stop_hooks = cfg['hooks'].get('Stop', [])
stop_hooks = [g for g in stop_hooks if not any(push_basename in h.get('command', '') for h in g.get('hooks', []))]
stop_hooks.append({'hooks': [{'type': 'command', 'command': command}]})
cfg['hooks']['Stop'] = stop_hooks
with open(settings_path, 'w') as f:
    json.dump(cfg, f, indent=2); f.write('\\n')
print(f'  Stop hook installed -> {push_script}')
PY
else
  echo "[4/6] no ~/.claude found — skipping CC Stop hook (Codex-only mode)"
fi

# launchd schedule — fires every 5 minutes as a safety net. For Codex-only
# users this IS the primary trigger. For dual-tool users it's a backup that
# catches Codex activity during long Codex-only stretches between CC turns.
# The script's 90-second debounce ensures no duplicate work if both trigger.
echo "[5/6] installing launchd 5-minute schedule (catches Codex sessions)..."
PLIST_LABEL="dev.vibecodestats.push"
PLIST_PATH="\${HOME}/Library/LaunchAgents/\${PLIST_LABEL}.plist"
mkdir -p "\${HOME}/Library/LaunchAgents"
cat > "\${PLIST_PATH}" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>\${PLIST_LABEL}</string>
  <key>ProgramArguments</key><array>
    <string>/bin/bash</string><string>-lc</string>
    <string>source \${CONFIG_PATH} && python3 \${SCRIPT_PATH}</string>
  </array>
  <key>StartInterval</key><integer>300</integer>
  <key>RunAtLoad</key><false/>
  <key>StandardOutPath</key><string>/tmp/cc-dashboard-launchd.log</string>
  <key>StandardErrorPath</key><string>/tmp/cc-dashboard-launchd.log</string>
</dict></plist>
PLIST
# Reload if already loaded (idempotent re-install).
launchctl unload "\${PLIST_PATH}" 2>/dev/null || true
launchctl load "\${PLIST_PATH}"
echo "  launchd schedule active -> \${PLIST_LABEL} (every 5 min)"

echo "[6/6] verifying with a test push..."
source "\${CONFIG_PATH}"
if python3 "\${SCRIPT_PATH}" 2>&1 | tee /tmp/cc-dashboard-install.log; then
  echo ""
  echo "cc-dashboard sync set up for @\${HANDLE}"
  echo "  open: \${URL}/\${HANDLE}"
else
  echo ""
  echo "first push had an issue — check /tmp/cc-dashboard-install.log"
  exit 1
fi
`;
