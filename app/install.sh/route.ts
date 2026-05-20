export const runtime = 'edge';

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

echo "[1/5] cc-dashboard installer for @\${HANDLE}"
echo "      install dir: \${INSTALL_DIR}"

mkdir -p "\${INSTALL_DIR}"

echo "[2/5] downloading dashboard_push.py..."
curl -fsSL "\${URL}/dashboard_push.py" -o "\${SCRIPT_PATH}"
chmod +x "\${SCRIPT_PATH}"

echo "[3/5] writing config..."
cat > "\${CONFIG_PATH}" <<EOF
export CC_DASHBOARD_URL="\${URL}"
export CC_DASHBOARD_TOKEN="\${TOKEN}"
export CC_DASHBOARD_HANDLE="\${HANDLE}"
EOF
chmod 600 "\${CONFIG_PATH}"

echo "[4/5] installing Claude Code Stop hook..."
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

echo "[5/5] verifying with a test push..."
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
