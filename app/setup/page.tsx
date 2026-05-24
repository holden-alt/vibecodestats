import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { CopyButton } from './CopyButton';
import { RegenerateButton } from './RegenerateButton';
import { PrivacyToggle } from './PrivacyToggle';

export const runtime = 'edge';

export default async function SetupPage() {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    redirect('/auth/signin?next=/setup');
  }

  const { data: profile } = await supabase
    .from('users')
    .select('github_handle, ingest_token, private_project_names')
    .eq('auth_id', authUser.id)
    .single();

  if (!profile) {
    redirect('/');
  }

  // ingest_token is always populated by the DB migration backfill + default,
  // but the generated types say string | null — coerce safely.
  const token = profile.ingest_token ?? '';
  const handle = profile.github_handle;

  const origin =
    process.env.NEXT_PUBLIC_SITE_URL ?? 'https://cc-dashboard-qab.pages.dev';
  const installCmd = `curl -fsSL ${origin}/install.sh | TOKEN=${token} HANDLE=${handle} URL=${origin} bash`;

  const sectionStyle: React.CSSProperties = {
    border: '1px solid var(--color-border)',
    borderRadius: 3,
    padding: '20px 24px',
  };
  const labelStyle: React.CSSProperties = {
    fontSize: '0.65rem',
    opacity: 0.55,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    marginBottom: 8,
  };
  const bodyStyle: React.CSSProperties = {
    margin: '0 0 12px',
    fontSize: '0.85rem',
    opacity: 0.85,
  };
  const preStyle: React.CSSProperties = {
    background: 'var(--color-bg-2)',
    border: '1px solid var(--color-border)',
    borderRadius: 2,
    padding: '12px 14px',
    fontSize: '0.8rem',
    overflow: 'auto',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
    margin: 0,
  };
  const linkStyle: React.CSSProperties = { color: 'var(--chart-1, #d97757)' };

  return (
    <main
      style={{
        maxWidth: 900,
        margin: '0 auto',
        padding: '64px 24px 64px',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        color: 'var(--color-text)',
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
      }}
    >
      <h1 style={{ fontSize: '1.6rem', margin: 0 }}>set up your stats sync</h1>

      {/* Step 1 — install command */}
      <section style={sectionStyle}>
        <div style={labelStyle}>step 1 — install the push hook</div>
        <p style={bodyStyle}>
          One command. macOS only. Installs the Claude Code Stop hook so every
          CC turn pushes your stats to{' '}
          <a href={`/${handle}`} style={linkStyle}>
            /{handle}
          </a>
          .
        </p>
        <pre style={preStyle}>
          <code>{installCmd}</code>
        </pre>
        <CopyButton text={installCmd} label="copy command" />
        <p style={{ ...bodyStyle, marginTop: 12, opacity: 0.7, fontSize: '0.75rem' }}>
          <strong>Codex CLI users:</strong> if you also have Codex installed at{' '}
          <code>~/.codex/sessions/</code>, the push script auto-detects it and
          includes your Codex tokens, tool calls, and per-model usage in the
          same daily total. Zero extra setup if you use both tools.
        </p>
      </section>

      {/* Step 2 — token */}
      <section style={sectionStyle}>
        <div style={labelStyle}>step 2 — your ingest token</div>
        <p style={bodyStyle}>
          This token authenticates your machine to the dashboard. Treat it like
          a password. If exposed, regenerate it — any existing installs will
          need to be re-run with the new token.
        </p>
        <pre style={{ ...preStyle, fontSize: '0.85rem', whiteSpace: 'normal' }}>
          <code>{token}</code>
        </pre>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <CopyButton text={token} label="copy token" />
          <RegenerateButton />
        </div>
      </section>

      {/* Step 3 — verify */}
      <section style={sectionStyle}>
        <div style={labelStyle}>step 3 — verify</div>
        <p style={{ ...bodyStyle, margin: 0 }}>
          Open a Claude Code session anywhere. After your next turn, refresh{' '}
          <a href={`/${handle}`} style={linkStyle}>
            your profile
          </a>
          . Your tokens-today number should start showing real values.
        </p>
      </section>

      {/* Codex-only users — optional schedule trigger */}
      <section style={sectionStyle}>
        <div style={labelStyle}>codex-only? (optional)</div>
        <p style={bodyStyle}>
          If you use Codex CLI <em>without</em> Claude Code, the Stop hook
          won&apos;t fire — there&apos;s no Claude Code to attach it to. Run the
          push on a schedule instead with a single launchd entry:
        </p>
        <pre style={preStyle}>
          <code>{`# Codex-only push schedule — runs every 5 minutes
cat > ~/Library/LaunchAgents/dev.vibecodestats.push.plist <<'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>dev.vibecodestats.push</string>
  <key>ProgramArguments</key><array>
    <string>/bin/bash</string><string>-lc</string>
    <string>source ~/.config/cc-dashboard/config && python3 ~/.config/cc-dashboard/dashboard_push.py</string>
  </array>
  <key>StartInterval</key><integer>300</integer>
  <key>RunAtLoad</key><true/>
</dict></plist>
EOF
launchctl load ~/Library/LaunchAgents/dev.vibecodestats.push.plist`}</code>
        </pre>
        <CopyButton text={`cat > ~/Library/LaunchAgents/dev.vibecodestats.push.plist <<'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>dev.vibecodestats.push</string>
  <key>ProgramArguments</key><array>
    <string>/bin/bash</string><string>-lc</string>
    <string>source ~/.config/cc-dashboard/config && python3 ~/.config/cc-dashboard/dashboard_push.py</string>
  </array>
  <key>StartInterval</key><integer>300</integer>
  <key>RunAtLoad</key><true/>
</dict></plist>
EOF
launchctl load ~/Library/LaunchAgents/dev.vibecodestats.push.plist`} label="copy launchd setup" />
        <p style={{ ...bodyStyle, marginTop: 12, opacity: 0.7, fontSize: '0.75rem' }}>
          The install command above still runs first — it downloads{' '}
          <code>dashboard_push.py</code> and writes the config. Codex-only
          users will see the Stop-hook install step fail silently if Claude
          Code isn&apos;t installed, which is fine; the launchd entry takes
          over the trigger.
        </p>
      </section>

      {/* Privacy */}
      <section style={sectionStyle}>
        <div style={labelStyle}>privacy</div>
        <PrivacyToggle initial={profile.private_project_names ?? false} />
      </section>
    </main>
  );
}
