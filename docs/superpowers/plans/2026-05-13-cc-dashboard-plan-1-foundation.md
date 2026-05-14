# cc-dashboard Plan 1 — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the cc-dashboard project so Holden can sign in via GitHub, navigate to `/holden` at a deployed URL, and see his profile chrome (powerline status bar, 3-pane TUI hero, heatmap) rendered with placeholder data.

**Architecture:** Next.js 15 App Router + TypeScript strict + Tailwind v4. Supabase for auth (GitHub OAuth, `read:user` scope) and database. CSS custom properties drive the polychrome terminal palette. Profile page server-renders against Supabase. Deployed on Cloudflare Pages at a `*.pages.dev` URL for v1 (custom domain `vibecodestats.dev` configured in Plan 7).

**Tech Stack:** Next.js 15, React 19, TypeScript 5 (strict), Tailwind CSS v4, pnpm, Supabase JS v2 + `@supabase/ssr`, Vitest + React Testing Library + jsdom, Playwright for E2E.

**Spec reference:** `docs/superpowers/specs/2026-05-13-cc-dashboard-design.md`

**Plan sequence:** This is Plan 1 of an estimated 7. Subsequent plans (ingestion pipeline, charts, leaderboard, badges/personas, etc.) will be written when we get to them.

---

## File Structure (after Plan 1)

```
cc-dashboard/
  app/
    layout.tsx                    Root layout, font stack, palette mount
    page.tsx                      / → redirect to /holden
    globals.css                   Palette CSS vars, terminal base styles
    [handle]/
      page.tsx                    Profile page server component
      not-found.tsx               404 styled in terminal aesthetic
    me/
      route.ts                    Redirect signed-in user to their /:handle
    auth/
      signin/route.ts             Initiates GitHub OAuth via Supabase
      callback/route.ts           Supabase OAuth callback handler
      signout/route.ts            Signs out and clears session
  components/
    StatusBar.tsx                 Powerline status bar
    BuildsPane.tsx                Left pane (placeholder data)
    ActivityPane.tsx              Center pane (placeholder + heatmap)
    PersonaPane.tsx               Right pane (placeholder data)
    Heatmap.tsx                   52-week × 7-row heatmap grid
  lib/
    supabase/
      server.ts                   Server-component Supabase client
      browser.ts                  Browser Supabase client
      middleware.ts               Middleware Supabase client (cookie refresh)
    types/
      database.ts                 Generated from Supabase schema
  supabase/
    migrations/
      20260513000001_initial_schema.sql
    config.toml
  tests/
    setup.ts                      Vitest setup (jest-dom matchers)
    components/
      StatusBar.test.tsx
      Heatmap.test.tsx
      BuildsPane.test.tsx
      ActivityPane.test.tsx
      PersonaPane.test.tsx
    routes/
      profile-page.test.tsx
      home-redirect.test.tsx
  e2e/
    signin.spec.ts
    profile.spec.ts
  middleware.ts                   Auth cookie refresh
  next.config.ts
  tsconfig.json
  package.json
  pnpm-lock.yaml
  vitest.config.ts
  playwright.config.ts
  .env.local.example
  .env.local                      (gitignored)
  .gitignore                      (already created)
  README.md
```

---

## Phase 0 — Project initialization

### Task 0.1: Initialize Next.js project with pnpm

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `app/layout.tsx`, `app/page.tsx`, `app/globals.css`, `README.md`, `next-env.d.ts`
- Modify: `.gitignore` (extend Node.js patterns)

- [ ] **Step 1: Smoke test — `pnpm dev` starts and serves a 200**

Create `tests/smoke/dev-server.test.ts`:

```ts
import { describe, it, expect } from 'vitest';

describe('dev server smoke', () => {
  it('package.json declares Next.js 15 and pnpm', async () => {
    const pkg = await import('../../package.json');
    expect(pkg.dependencies?.next).toMatch(/^15\./);
    expect(pkg.packageManager).toMatch(/^pnpm@/);
  });
});
```

- [ ] **Step 2: Run test — it should fail (no package.json yet)**

```sh
cd ~/Claude/holden-alt/cc-dashboard
# Will fail: cannot resolve '../../package.json'
```

- [ ] **Step 3: Initialize the project**

Run:
```sh
cd ~/Claude/holden-alt/cc-dashboard
pnpm dlx create-next-app@15 . --typescript --tailwind --eslint --app --src-dir false --import-alias '@/*' --no-turbo
```

When prompted "would you like to use Turbopack" → No (we'll add it later if needed).

Then pin pnpm in `package.json`:

```json
{
  "packageManager": "pnpm@9.0.0"
}
```

- [ ] **Step 4: Run test — it should pass**

```sh
pnpm install
pnpm vitest run tests/smoke/dev-server.test.ts
```

Expected: PASS.

Also verify the dev server starts:
```sh
pnpm dev
# Browse to http://localhost:3000 — should see the Next.js default page
# Ctrl-C to stop
```

- [ ] **Step 5: Commit**

```sh
git add -A
git commit -m "chore: initialize Next.js 15 + pnpm + TS + Tailwind"
```

---

### Task 0.2: Install test dependencies

**Files:**
- Modify: `package.json` (add devDependencies)
- Create: `vitest.config.ts`, `tests/setup.ts`, `playwright.config.ts`

- [ ] **Step 1: Failing test — Vitest config + setup file must exist and be valid**

Create `tests/smoke/test-infra.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { existsSync } from 'fs';
import { resolve } from 'path';

describe('test infra', () => {
  it('vitest.config.ts exists', () => {
    expect(existsSync(resolve(__dirname, '../../vitest.config.ts'))).toBe(true);
  });
  it('playwright.config.ts exists', () => {
    expect(existsSync(resolve(__dirname, '../../playwright.config.ts'))).toBe(true);
  });
  it('jest-dom is loaded (toBeInTheDocument is a matcher)', () => {
    const div = document.createElement('div');
    document.body.appendChild(div);
    expect(div).toBeInTheDocument();
    document.body.removeChild(div);
  });
});
```

- [ ] **Step 2: Run test — it should fail**

```sh
pnpm vitest run tests/smoke/test-infra.test.ts
```

Expected: FAIL — `vitest.config.ts` missing, `toBeInTheDocument` not defined.

- [ ] **Step 3: Install and configure**

```sh
pnpm add -D vitest @vitest/ui jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event @vitejs/plugin-react
pnpm add -D @playwright/test
pnpm exec playwright install --with-deps chromium
```

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    globals: true,
    exclude: ['node_modules', 'e2e/**', '.next/**'],
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, '.'),
    },
  },
});
```

Create `tests/setup.ts`:

```ts
import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
});
```

Create `playwright.config.ts`:

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
```

Add scripts to `package.json`:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "typecheck": "tsc --noEmit"
  }
}
```

- [ ] **Step 4: Run test — should pass**

```sh
pnpm vitest run tests/smoke/test-infra.test.ts
```

Expected: PASS (all three assertions).

- [ ] **Step 5: Commit**

```sh
git add -A
git commit -m "chore: add Vitest + RTL + Playwright"
```

---

### Task 0.3: TypeScript strict mode

**Files:**
- Modify: `tsconfig.json`

- [ ] **Step 1: Failing test — tsconfig.json must have strict-ish flags**

Create `tests/smoke/tsconfig.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('tsconfig strict mode', () => {
  it('enables strict + noUncheckedIndexedAccess + exactOptionalPropertyTypes', () => {
    const raw = readFileSync(resolve(__dirname, '../../tsconfig.json'), 'utf8');
    const cfg = JSON.parse(raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, ''));
    expect(cfg.compilerOptions.strict).toBe(true);
    expect(cfg.compilerOptions.noUncheckedIndexedAccess).toBe(true);
    expect(cfg.compilerOptions.exactOptionalPropertyTypes).toBe(true);
  });
});
```

- [ ] **Step 2: Run test — should fail**

```sh
pnpm vitest run tests/smoke/tsconfig.test.ts
```

Expected: FAIL on at least `noUncheckedIndexedAccess`.

- [ ] **Step 3: Update tsconfig.json**

Add to `compilerOptions`:

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "forceConsistentCasingInFileNames": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

- [ ] **Step 4: Run test + typecheck**

```sh
pnpm vitest run tests/smoke/tsconfig.test.ts
pnpm typecheck
```

Expected: both PASS.

- [ ] **Step 5: Commit**

```sh
git add tsconfig.json tests/smoke/tsconfig.test.ts
git commit -m "chore: TypeScript strict mode"
```

---

## Phase 1 — Terminal palette + base layout

### Task 1.1: Palette CSS variables + globals.css

**Files:**
- Replace: `app/globals.css`

- [ ] **Step 1: Failing test — globals.css must define palette vars**

Create `tests/smoke/palette.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('palette CSS variables', () => {
  const css = readFileSync(resolve(__dirname, '../../app/globals.css'), 'utf8');
  it('defines --color-orange #d97757', () => {
    expect(css).toMatch(/--color-orange:\s*#d97757/);
  });
  it('defines --color-cyan #6bbfd9', () => {
    expect(css).toMatch(/--color-cyan:\s*#6bbfd9/);
  });
  it('defines --color-magenta #c47cb8', () => {
    expect(css).toMatch(/--color-magenta:\s*#c47cb8/);
  });
  it('defines --color-yellow #e3c466', () => {
    expect(css).toMatch(/--color-yellow:\s*#e3c466/);
  });
  it('defines --color-green #8fbc8f', () => {
    expect(css).toMatch(/--color-green:\s*#8fbc8f/);
  });
  it('defines --color-blue #7a9cd9', () => {
    expect(css).toMatch(/--color-blue:\s*#7a9cd9/);
  });
  it('defines --color-red #d97373', () => {
    expect(css).toMatch(/--color-red:\s*#d97373/);
  });
  it('sets body to bg #0d0d0d, text #ece6dc, monospace', () => {
    expect(css).toMatch(/--color-bg:\s*#0d0d0d/);
    expect(css).toMatch(/--color-text:\s*#ece6dc/);
    expect(css).toMatch(/ui-monospace/);
  });
});
```

- [ ] **Step 2: Run test — should fail (current globals.css is the default)**

```sh
pnpm vitest run tests/smoke/palette.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Write palette + base into globals.css**

Replace `app/globals.css`:

```css
@import "tailwindcss";

:root {
  /* Background + text */
  --color-bg: #0d0d0d;
  --color-bg-2: #1a1715;
  --color-border: #2a2622;
  --color-text: #ece6dc;
  --color-dim: #777;

  /* Polychrome palette */
  --color-orange: #d97757;
  --color-cyan: #6bbfd9;
  --color-magenta: #c47cb8;
  --color-yellow: #e3c466;
  --color-green: #8fbc8f;
  --color-blue: #7a9cd9;
  --color-red: #d97373;

  /* Heatmap ramp */
  --color-heat-0: #1a1715;
  --color-heat-1: #3a2a1f;
  --color-heat-2: #6b3e26;
  --color-heat-3: #a8623f;
  --color-heat-4: #d97757;

  /* Fonts */
  --font-mono: ui-monospace, "SF Mono", Menlo, Monaco, "Cascadia Mono", Consolas, monospace;
}

@theme inline {
  --color-bg: var(--color-bg);
  --color-bg-2: var(--color-bg-2);
  --color-border: var(--color-border);
  --color-text: var(--color-text);
  --color-dim: var(--color-dim);
  --color-orange: var(--color-orange);
  --color-cyan: var(--color-cyan);
  --color-magenta: var(--color-magenta);
  --color-yellow: var(--color-yellow);
  --color-green: var(--color-green);
  --color-blue: var(--color-blue);
  --color-red: var(--color-red);
  --font-mono: var(--font-mono);
}

html, body {
  background: var(--color-bg);
  color: var(--color-text);
  font-family: var(--font-mono);
  font-feature-settings: "ss01", "cv01", "tnum";
  -webkit-font-smoothing: antialiased;
}

::selection { background: var(--color-orange); color: var(--color-bg); }
```

- [ ] **Step 4: Run test**

```sh
pnpm vitest run tests/smoke/palette.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```sh
git add app/globals.css tests/smoke/palette.test.ts
git commit -m "style: terminal palette + base typography"
```

---

### Task 1.2: Root layout with mono font + dark background

**Files:**
- Replace: `app/layout.tsx`

- [ ] **Step 1: Failing test — root layout sets `lang`, mono font class, and renders children**

Create `tests/components/root-layout.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('app/layout.tsx', () => {
  const src = readFileSync(resolve(__dirname, '../../app/layout.tsx'), 'utf8');
  it('declares <html lang="en">', () => {
    expect(src).toMatch(/<html lang="en">/);
  });
  it('does not import a sans-serif Google font', () => {
    expect(src).not.toMatch(/next\/font\/google/);
  });
  it('renders {children}', () => {
    expect(src).toMatch(/\{children\}/);
  });
});
```

- [ ] **Step 2: Run test — should fail**

```sh
pnpm vitest run tests/components/root-layout.test.tsx
```

Expected: FAIL (default layout uses Google fonts).

- [ ] **Step 3: Replace `app/layout.tsx`**

```tsx
import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'vibecodestats.dev',
  description: 'Your public Claude Code vibe-coding profile.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 4: Run tests + dev server**

```sh
pnpm vitest run tests/components/root-layout.test.tsx
pnpm typecheck
```

Both PASS. Then `pnpm dev` and visit `localhost:3000` — page should now be dark with mono font (with the default `/` page until we change it next).

- [ ] **Step 5: Commit**

```sh
git add app/layout.tsx tests/components/root-layout.test.tsx
git commit -m "feat: root layout with terminal aesthetic"
```

---

## Phase 2 — Supabase + GitHub OAuth

### Task 2.1: Supabase local dev + initial migration

**Files:**
- Create: `supabase/config.toml`, `supabase/migrations/20260513000001_initial_schema.sql`
- Create: `.env.local.example`

- [ ] **Step 1: Failing test — migration file exists with users + daily_stats tables**

Create `tests/db/schema.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('initial schema migration', () => {
  const sql = readFileSync(
    resolve(__dirname, '../../supabase/migrations/20260513000001_initial_schema.sql'),
    'utf8',
  );
  it('creates public.users with required columns', () => {
    expect(sql).toMatch(/create table public\.users/i);
    expect(sql).toMatch(/github_id/);
    expect(sql).toMatch(/github_handle/);
    expect(sql).toMatch(/display_name/);
  });
  it('creates public.daily_stats with composite primary key', () => {
    expect(sql).toMatch(/create table public\.daily_stats/i);
    expect(sql).toMatch(/primary key\s*\(user_id, date\)/i);
    expect(sql).toMatch(/tokens_total/);
    expect(sql).toMatch(/tokens_by_model/);
  });
  it('enables RLS on both tables', () => {
    expect(sql).toMatch(/alter table public\.users enable row level security/i);
    expect(sql).toMatch(/alter table public\.daily_stats enable row level security/i);
  });
});
```

- [ ] **Step 2: Run test — should fail**

```sh
pnpm vitest run tests/db/schema.test.ts
```

Expected: FAIL (file doesn't exist).

- [ ] **Step 3: Initialize Supabase + write migration**

```sh
pnpm add -D supabase
pnpm exec supabase init
```

Replace the generated `supabase/migrations/20260513000001_initial_schema.sql` (or create it):

```sql
-- 20260513000001_initial_schema.sql
-- cc-dashboard v1: minimal multi-user-ready schema.

create extension if not exists "pgcrypto";

-- Users mirror auth.users with vibecoder profile fields.
create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  github_id bigint unique,
  github_handle text unique not null,
  display_name text,
  avatar_url text,
  primary_persona text,
  secondary_personas text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index users_github_handle_idx on public.users (lower(github_handle));

-- Daily aggregated stats per user.
create table public.daily_stats (
  user_id uuid not null references public.users (id) on delete cascade,
  date date not null,
  tokens_total bigint not null default 0,
  tokens_by_model jsonb not null default '{}'::jsonb,
  sessions integer not null default 0,
  deep_work_minutes integer not null default 0,
  machines text[] not null default '{}',
  projects_touched jsonb not null default '{}'::jsonb,
  ships jsonb not null default '{}'::jsonb,
  source_synced_at timestamptz,
  primary key (user_id, date)
);

create index daily_stats_user_date_idx on public.daily_stats (user_id, date desc);

-- RLS: public read of users/daily_stats (this is a public dashboard).
alter table public.users enable row level security;
alter table public.daily_stats enable row level security;

create policy users_select_all on public.users for select using (true);
create policy daily_stats_select_all on public.daily_stats for select using (true);

-- Only owner can update their own user row.
create policy users_update_self on public.users for update
  using (auth.uid() = id) with check (auth.uid() = id);

-- Writes to daily_stats happen via service_role only (ingestion webhook). No public insert/update policy.

-- Trigger to mirror new auth.users into public.users on signup.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, github_id, github_handle, display_name, avatar_url)
  values (
    new.id,
    nullif(new.raw_user_meta_data->>'provider_id', '')::bigint,
    coalesce(new.raw_user_meta_data->>'user_name', new.raw_user_meta_data->>'preferred_username'),
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();
```

Create `.env.local.example`:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
GITHUB_OAUTH_CLIENT_ID=
GITHUB_OAUTH_CLIENT_SECRET=
INGEST_HMAC_SECRET=
```

- [ ] **Step 4: Run tests + start local Supabase**

```sh
pnpm vitest run tests/db/schema.test.ts
pnpm exec supabase start
# Output includes the local API URL + anon key + service_role key. Save them.
pnpm exec supabase db reset    # applies the migration
```

Verify the migration applied:
```sh
pnpm exec supabase db diff --linked  # should show no drift
```

Then write `.env.local` (not committed) with the local values:

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<from supabase start output>
SUPABASE_SERVICE_ROLE_KEY=<from supabase start output>
```

- [ ] **Step 5: Commit**

```sh
git add supabase/ tests/db/ .env.local.example package.json pnpm-lock.yaml
git commit -m "feat(db): initial schema with users + daily_stats"
```

---

### Task 2.2: Generate Supabase TypeScript types

**Files:**
- Create: `lib/types/database.ts`

- [ ] **Step 1: Failing test — generated types must include `Database` with `users` and `daily_stats`**

Create `tests/db/types.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

describe('generated database types', () => {
  const path = resolve(__dirname, '../../lib/types/database.ts');
  it('file exists', () => {
    expect(existsSync(path)).toBe(true);
  });
  it('exports a Database type with users and daily_stats', () => {
    const src = readFileSync(path, 'utf8');
    expect(src).toMatch(/export\s+(type|interface)\s+Database/);
    expect(src).toMatch(/users:/);
    expect(src).toMatch(/daily_stats:/);
  });
});
```

- [ ] **Step 2: Run test — should fail**

```sh
pnpm vitest run tests/db/types.test.ts
```

Expected: FAIL — file missing.

- [ ] **Step 3: Generate types**

Add script to `package.json`:

```json
{
  "scripts": {
    "db:types": "supabase gen types typescript --local > lib/types/database.ts"
  }
}
```

Run:

```sh
mkdir -p lib/types
pnpm db:types
```

- [ ] **Step 4: Run test + typecheck**

```sh
pnpm vitest run tests/db/types.test.ts
pnpm typecheck
```

Both PASS.

- [ ] **Step 5: Commit**

```sh
git add lib/types/database.ts package.json
git commit -m "feat(db): generate TypeScript types from schema"
```

---

### Task 2.3: Supabase clients (server + browser + middleware)

**Files:**
- Create: `lib/supabase/server.ts`, `lib/supabase/browser.ts`, `lib/supabase/middleware.ts`
- Create: `middleware.ts`

- [ ] **Step 1: Failing test — clients export the right names + middleware refreshes cookies**

Create `tests/db/clients.test.ts`:

```ts
import { describe, it, expect } from 'vitest';

describe('supabase clients', () => {
  it('server.ts exports createClient', async () => {
    const mod = await import('../../lib/supabase/server');
    expect(typeof mod.createClient).toBe('function');
  });
  it('browser.ts exports createClient', async () => {
    const mod = await import('../../lib/supabase/browser');
    expect(typeof mod.createClient).toBe('function');
  });
  it('middleware.ts exports updateSession', async () => {
    const mod = await import('../../lib/supabase/middleware');
    expect(typeof mod.updateSession).toBe('function');
  });
});
```

- [ ] **Step 2: Run test — should fail**

```sh
pnpm vitest run tests/db/clients.test.ts
```

Expected: FAIL (modules don't exist).

- [ ] **Step 3: Install + create clients**

```sh
pnpm add @supabase/supabase-js @supabase/ssr
```

Create `lib/supabase/server.ts`:

```ts
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/lib/types/database';

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options as CookieOptions),
            );
          } catch {
            // Called from a Server Component — cookies are read-only there.
          }
        },
      },
    },
  );
}
```

Create `lib/supabase/browser.ts`:

```ts
import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/lib/types/database';

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
```

Create `lib/supabase/middleware.ts`:

```ts
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from '@/lib/types/database';

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );
  // Force a session refresh (sets refresh cookies if expired).
  await supabase.auth.getUser();
  return response;
}
```

Create `middleware.ts` (project root):

```ts
import { updateSession } from '@/lib/supabase/middleware';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
```

- [ ] **Step 4: Run test + typecheck**

```sh
pnpm vitest run tests/db/clients.test.ts
pnpm typecheck
```

Both PASS.

- [ ] **Step 5: Commit**

```sh
git add lib/supabase/ middleware.ts package.json pnpm-lock.yaml tests/db/clients.test.ts
git commit -m "feat(auth): Supabase clients (server, browser, middleware)"
```

---

### Task 2.4: GitHub OAuth app + Supabase config

**Files:**
- Modify: `supabase/config.toml` (local) — enable GitHub provider
- Modify: `.env.local` (not committed)

> **Manual step:** This task requires creating a GitHub OAuth App through GitHub's web UI — there is no test that can verify it from inside the codebase. The "test" is the next task's E2E sign-in spec.

- [ ] **Step 1: Create the GitHub OAuth App**

On GitHub: Settings → Developer settings → OAuth Apps → New OAuth App.

Fill in:
- **Application name:** `vibecodestats.dev (local)`
- **Homepage URL:** `http://localhost:3000`
- **Authorization callback URL:** `http://127.0.0.1:54321/auth/v1/callback`

After creation, generate a client secret. Save Client ID + Client Secret.

- [ ] **Step 2: Configure local Supabase to use GitHub OAuth**

Edit `supabase/config.toml`. In the `[auth.external.github]` section:

```toml
[auth.external.github]
enabled = true
client_id = "env(GITHUB_OAUTH_CLIENT_ID)"
secret = "env(GITHUB_OAUTH_CLIENT_SECRET)"
redirect_uri = ""
url = ""
skip_nonce_check = false
```

Add `GITHUB_OAUTH_CLIENT_ID` and `GITHUB_OAUTH_CLIENT_SECRET` to `.env.local` with the values from step 1.

- [ ] **Step 3: Restart Supabase to pick up the new auth config**

```sh
pnpm exec supabase stop
pnpm exec supabase start
```

- [ ] **Step 4: Verify GitHub provider shows up**

```sh
curl -s http://127.0.0.1:54321/auth/v1/settings | grep -o '"github":[^,}]*'
```

Expected: `"github":true` (or includes `"enabled":true`).

- [ ] **Step 5: Commit (config only; no secrets)**

```sh
git add supabase/config.toml
git commit -m "feat(auth): enable GitHub OAuth provider in local Supabase"
```

---

### Task 2.5: Sign-in + callback + sign-out routes

**Files:**
- Create: `app/auth/signin/route.ts`, `app/auth/callback/route.ts`, `app/auth/signout/route.ts`

- [ ] **Step 1: Failing test — each route is callable and the signin route redirects to a GitHub auth URL**

Create `tests/routes/auth.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: {
      signInWithOAuth: vi.fn(async () => ({
        data: { url: 'https://github.com/login/oauth/authorize?...' },
        error: null,
      })),
      exchangeCodeForSession: vi.fn(async () => ({ error: null })),
      signOut: vi.fn(async () => ({ error: null })),
    },
  })),
}));

describe('auth routes', () => {
  it('signin → 302 to a github.com authorize URL', async () => {
    const mod = await import('../../app/auth/signin/route');
    const req = new Request('http://localhost:3000/auth/signin');
    const res = await mod.GET(req as any);
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toMatch(/github\.com\/login\/oauth/);
  });
  it('callback handles missing code with 400', async () => {
    const mod = await import('../../app/auth/callback/route');
    const req = new Request('http://localhost:3000/auth/callback');
    const res = await mod.GET(req as any);
    expect(res.status).toBe(400);
  });
  it('signout redirects to /', async () => {
    const mod = await import('../../app/auth/signout/route');
    const req = new Request('http://localhost:3000/auth/signout', { method: 'POST' });
    const res = await mod.POST(req as any);
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('/');
  });
});
```

- [ ] **Step 2: Run test — should fail**

```sh
pnpm vitest run tests/routes/auth.test.ts
```

Expected: FAIL (routes don't exist).

- [ ] **Step 3: Implement routes**

Create `app/auth/signin/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const supabase = await createClient();
  const url = new URL(request.url);
  const next = url.searchParams.get('next') ?? '/me';
  const origin = url.origin;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'github',
    options: {
      scopes: 'read:user',
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });

  if (error || !data.url) {
    return NextResponse.json({ error: error?.message ?? 'unknown' }, { status: 500 });
  }

  return NextResponse.redirect(data.url, { status: 302 });
}
```

Create `app/auth/callback/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next') ?? '/me';

  if (!code) {
    return NextResponse.json({ error: 'missing code' }, { status: 400 });
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }

  return NextResponse.redirect(`${url.origin}${next}`, { status: 302 });
}
```

Create `app/auth/signout/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const origin = new URL(request.url).origin;
  return NextResponse.redirect(`${origin}/`, { status: 302 });
}
```

- [ ] **Step 4: Run tests**

```sh
pnpm vitest run tests/routes/auth.test.ts
pnpm typecheck
```

Both PASS.

- [ ] **Step 5: Commit**

```sh
git add app/auth/ tests/routes/auth.test.ts
git commit -m "feat(auth): signin/callback/signout routes"
```

---

### Task 2.6: E2E — sign in flow works end-to-end

**Files:**
- Create: `e2e/signin.spec.ts`

> This spec runs Playwright against a real local Supabase + GitHub OAuth. It's marked `skip` by default since it requires manual GitHub login. Holden runs it once to verify the end-to-end flow on his machine.

- [ ] **Step 1: Write the spec (marked skip by default)**

Create `e2e/signin.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

test.describe.skip('GitHub OAuth sign-in (manual)', () => {
  test('sign in → land on /me → see Holden handle', async ({ page }) => {
    await page.goto('/auth/signin');
    // Playwright will navigate to GitHub; this requires manual interaction.
    await page.waitForURL(/github\.com|localhost/);
    // After Holden completes GitHub auth manually, we expect redirect to /me → /:handle
    await page.waitForURL(/\/[a-zA-Z0-9-]+$/, { timeout: 60_000 });
    await expect(page.locator('body')).toContainText('holden');
  });
});
```

- [ ] **Step 2: Run the spec with `.skip` removed (one-time manual run)**

```sh
# Edit signin.spec.ts and remove ".skip" temporarily.
pnpm test:e2e e2e/signin.spec.ts --headed
# Walk through the GitHub OAuth flow in the opened browser.
# Then restore ".skip" so CI doesn't try to run it.
```

- [ ] **Step 3: Verify Holden's row exists in `public.users`**

```sh
pnpm exec supabase db psql -c "select id, github_handle, display_name from public.users;"
```

Expected: at least one row with `github_handle = 'holdenrichardson'` (or whatever Holden's GH handle is).

- [ ] **Step 4: Verify row creation trigger fired correctly**

If the row is missing, debug the `handle_new_auth_user` trigger function:

```sh
pnpm exec supabase db psql -c "select id, raw_user_meta_data from auth.users;"
```

Verify the trigger function maps `user_name` from `raw_user_meta_data` correctly.

- [ ] **Step 5: Commit**

```sh
git add e2e/signin.spec.ts
git commit -m "test(e2e): manual GitHub OAuth sign-in spec"
```

---

## Phase 3 — Profile page

### Task 3.1: `/me` redirect to signed-in user's profile

**Files:**
- Create: `app/me/route.ts`

- [ ] **Step 1: Failing test — `/me` redirects to `/:handle` or `/`**

Create `tests/routes/me.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';

function mockSupabase(handle: string | null) {
  return {
    auth: { getUser: vi.fn(async () => ({ data: { user: handle ? { id: 'u1' } : null }, error: null })) },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(async () => ({
            data: handle ? { github_handle: handle } : null,
            error: handle ? null : new Error('not found'),
          })),
        })),
      })),
    })),
  };
}

describe('GET /me', () => {
  it('redirects signed-in user to their /:handle', async () => {
    vi.doMock('@/lib/supabase/server', () => ({ createClient: vi.fn(async () => mockSupabase('holden')) }));
    const mod = await import('../../app/me/route');
    const res = await mod.GET(new Request('http://localhost:3000/me') as any);
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('http://localhost:3000/holden');
    vi.doUnmock('@/lib/supabase/server');
  });

  it('redirects unsigned visitors to /', async () => {
    vi.doMock('@/lib/supabase/server', () => ({ createClient: vi.fn(async () => mockSupabase(null)) }));
    const mod = await import('../../app/me/route');
    const res = await mod.GET(new Request('http://localhost:3000/me') as any);
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('http://localhost:3000/');
    vi.doUnmock('@/lib/supabase/server');
  });
});
```

- [ ] **Step 2: Run test — should fail**

```sh
pnpm vitest run tests/routes/me.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement `/me` route**

Create `app/me/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const origin = new URL(request.url).origin;

  if (!user) {
    return NextResponse.redirect(`${origin}/`, { status: 302 });
  }

  const { data: row } = await supabase
    .from('users')
    .select('github_handle')
    .eq('id', user.id)
    .single();

  if (!row?.github_handle) {
    return NextResponse.redirect(`${origin}/`, { status: 302 });
  }

  return NextResponse.redirect(`${origin}/${row.github_handle}`, { status: 302 });
}
```

- [ ] **Step 4: Run tests**

```sh
pnpm vitest run tests/routes/me.test.ts
pnpm typecheck
```

Both PASS.

- [ ] **Step 5: Commit**

```sh
git add app/me/route.ts tests/routes/me.test.ts
git commit -m "feat(auth): /me redirect to signed-in user profile"
```

---

### Task 3.2: `/[handle]` page — fetch user + 404 fallback

**Files:**
- Create: `app/[handle]/page.tsx`, `app/[handle]/not-found.tsx`

- [ ] **Step 1: Failing test — profile page renders user handle + 404 for unknown**

Create `tests/routes/profile-page.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { notFound } from 'next/navigation';

vi.mock('next/navigation', () => ({ notFound: vi.fn(() => { throw new Error('NEXT_NOT_FOUND'); }) }));

function mockSupabase(handle: string, exists: boolean) {
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(async () => ({
            data: exists ? { id: 'u1', github_handle: handle, display_name: 'Holden', avatar_url: null, primary_persona: null, secondary_personas: [] } : null,
            error: null,
          })),
        })),
      })),
    })),
  };
}

describe('GET /[handle]', () => {
  it('renders the handle when user exists', async () => {
    vi.doMock('@/lib/supabase/server', () => ({ createClient: vi.fn(async () => mockSupabase('holden', true)) }));
    const { default: Page } = await import('../../app/[handle]/page');
    const ui = await Page({ params: Promise.resolve({ handle: 'holden' }) });
    render(ui as any);
    expect(screen.getByText(/holden/i)).toBeInTheDocument();
    vi.doUnmock('@/lib/supabase/server');
  });

  it('calls notFound when user is missing', async () => {
    vi.doMock('@/lib/supabase/server', () => ({ createClient: vi.fn(async () => mockSupabase('ghost', false)) }));
    const { default: Page } = await import('../../app/[handle]/page');
    await expect(Page({ params: Promise.resolve({ handle: 'ghost' }) })).rejects.toThrow('NEXT_NOT_FOUND');
    expect(notFound).toHaveBeenCalled();
    vi.doUnmock('@/lib/supabase/server');
  });
});
```

- [ ] **Step 2: Run test — should fail**

```sh
pnpm vitest run tests/routes/profile-page.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: Implement profile page + not-found page**

Create `app/[handle]/page.tsx`:

```tsx
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { StatusBar } from '@/components/StatusBar';
import { BuildsPane } from '@/components/BuildsPane';
import { ActivityPane } from '@/components/ActivityPane';
import { PersonaPane } from '@/components/PersonaPane';

type ProfilePageProps = {
  params: Promise<{ handle: string }>;
};

export default async function ProfilePage({ params }: ProfilePageProps) {
  const { handle } = await params;
  const supabase = await createClient();

  const { data: user } = await supabase
    .from('users')
    .select('id, github_handle, display_name, avatar_url, primary_persona, secondary_personas')
    .eq('github_handle', handle)
    .maybeSingle();

  if (!user) {
    notFound();
  }

  return (
    <main className="min-h-screen px-6 py-4 max-w-[1400px] mx-auto">
      <StatusBar handle={user.github_handle} primaryPersona={user.primary_persona ?? null} />

      <section className="grid grid-cols-1 lg:grid-cols-[1.2fr_2fr_1.2fr] gap-3 mt-4">
        <BuildsPane />
        <ActivityPane />
        <PersonaPane primary={user.primary_persona ?? null} secondary={user.secondary_personas ?? []} />
      </section>
    </main>
  );
}
```

Create `app/[handle]/not-found.tsx`:

```tsx
export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="font-mono text-center space-y-2">
        <p className="text-[color:var(--color-orange)]">404</p>
        <p className="text-[color:var(--color-dim)]">no vibecoder by that handle</p>
        <a href="/" className="text-[color:var(--color-cyan)] underline">$ cd ..</a>
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Run test (will still fail — components don't exist yet)**

```sh
pnpm vitest run tests/routes/profile-page.test.tsx
```

Expected: FAIL with "Cannot find module @/components/StatusBar". That's the next task. Don't fix it here.

- [ ] **Step 5: Commit (failing tests OK — the next tasks fix them)**

```sh
git add app/[handle]/ tests/routes/profile-page.test.tsx
git commit -m "feat(profile): /[handle] page + not-found shell (components stub)"
```

---

## Phase 4 — Terminal chrome components

### Task 4.1: `StatusBar` component (powerline)

**Files:**
- Create: `components/StatusBar.tsx`, `tests/components/StatusBar.test.tsx`

- [ ] **Step 1: Failing test — StatusBar renders all 6 colored segments**

Create `tests/components/StatusBar.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusBar } from '@/components/StatusBar';

describe('StatusBar', () => {
  it('renders handle, persona, streak, rank, tokens, badges segments', () => {
    render(<StatusBar handle="holden" primaryPersona="THE FOUNDER" />);
    expect(screen.getByText(/\$ holden/)).toBeInTheDocument();
    expect(screen.getByText(/THE FOUNDER/)).toBeInTheDocument();
    expect(screen.getByText(/streak/i)).toBeInTheDocument();
    expect(screen.getByText(/#\d+/)).toBeInTheDocument();
    expect(screen.getByText(/tokens/i)).toBeInTheDocument();
    expect(screen.getByText(/badges/i)).toBeInTheDocument();
  });

  it('uses NO PERSONA placeholder when primaryPersona is null', () => {
    render(<StatusBar handle="holden" primaryPersona={null} />);
    expect(screen.getByText(/NO PERSONA YET/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test — should fail**

```sh
pnpm vitest run tests/components/StatusBar.test.tsx
```

Expected: FAIL (component doesn't exist).

- [ ] **Step 3: Implement StatusBar**

Create `components/StatusBar.tsx`:

```tsx
import { format } from 'date-fns';

type Segment = {
  text: string;
  bg: string;
  fg: string;
};

type StatusBarProps = {
  handle: string;
  primaryPersona: string | null;
  // Placeholder stats — Plan 2 wires real data.
  streakDays?: number;
  rank?: number;
  tokensToday?: number;
  tokensDeltaPct?: number;
  badgesEarned?: number;
  badgesTotal?: number;
  now?: Date;
};

export function StatusBar({
  handle,
  primaryPersona,
  streakDays = 0,
  rank = 1,
  tokensToday = 0,
  tokensDeltaPct = 0,
  badgesEarned = 0,
  badgesTotal = 50,
  now = new Date(),
}: StatusBarProps) {
  const segments: Segment[] = [
    { text: `$ ${handle}`, bg: 'var(--color-orange)', fg: 'var(--color-bg)' },
    { text: primaryPersona ?? 'NO PERSONA YET', bg: 'var(--color-magenta)', fg: 'var(--color-bg)' },
    { text: `${streakDays}d streak`, bg: 'var(--color-yellow)', fg: 'var(--color-bg)' },
    { text: `#${rank}`, bg: 'var(--color-green)', fg: 'var(--color-bg)' },
    { text: `${formatTokens(tokensToday)} tokens ${tokensDeltaPct >= 0 ? '▲' : '▼'} ${Math.abs(tokensDeltaPct)}%`, bg: 'var(--color-cyan)', fg: 'var(--color-bg)' },
    { text: `${badgesEarned} / ${badgesTotal} badges`, bg: 'var(--color-blue)', fg: 'var(--color-bg)' },
  ];

  return (
    <div className="flex items-stretch text-[0.7rem] font-semibold">
      {segments.map((seg, i) => (
        <div
          key={i}
          style={{
            background: seg.bg,
            color: seg.fg,
            padding: '0.4rem 0.85rem 0.4rem 1rem',
            clipPath:
              i === 0
                ? 'polygon(0 0, calc(100% - 0.5rem) 0, 100% 50%, calc(100% - 0.5rem) 100%, 0 100%)'
                : 'polygon(0 0, calc(100% - 0.5rem) 0, 100% 50%, calc(100% - 0.5rem) 100%, 0 100%, 0.5rem 50%)',
          }}
        >
          {seg.text}
        </div>
      ))}
      <div className="flex-1 bg-[color:var(--color-bg-2)]" />
      <div
        className="px-3 py-2 text-[color:var(--color-dim)]"
        style={{ background: 'var(--color-bg-2)' }}
      >
        {format(now, 'yyyy-MM-dd · HH:mm')}
      </div>
    </div>
  );
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
  if (n >= 1_000) return Math.round(n / 1_000) + 'K';
  return String(n);
}
```

```sh
pnpm add date-fns
```

- [ ] **Step 4: Run test + typecheck**

```sh
pnpm vitest run tests/components/StatusBar.test.tsx
pnpm typecheck
```

Both PASS.

- [ ] **Step 5: Commit**

```sh
git add components/StatusBar.tsx tests/components/StatusBar.test.tsx package.json pnpm-lock.yaml
git commit -m "feat(ui): StatusBar powerline component"
```

---

### Task 4.2: `Heatmap` component (52w × 7 grid)

**Files:**
- Create: `components/Heatmap.tsx`, `tests/components/Heatmap.test.tsx`

- [ ] **Step 1: Failing test — Heatmap renders 364 cells and applies levels**

Create `tests/components/Heatmap.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Heatmap } from '@/components/Heatmap';

describe('Heatmap', () => {
  it('renders 52 weeks × 7 days = 364 cells', () => {
    const today = new Date('2026-05-13');
    const { container } = render(<Heatmap days={[]} today={today} />);
    const cells = container.querySelectorAll('[data-cell]');
    expect(cells.length).toBe(52 * 7);
  });

  it('applies level class based on tokens', () => {
    const today = new Date('2026-05-13');
    const days = [
      { date: '2026-05-13', tokens: 500_000 }, // level 4
      { date: '2026-05-12', tokens: 200_000 }, // level 3
      { date: '2026-05-11', tokens: 50_000 },  // level 2
      { date: '2026-05-10', tokens: 5_000 },   // level 1
    ];
    const { container } = render(<Heatmap days={days} today={today} />);
    expect(container.querySelector('[data-date="2026-05-13"]')?.getAttribute('data-level')).toBe('4');
    expect(container.querySelector('[data-date="2026-05-12"]')?.getAttribute('data-level')).toBe('3');
    expect(container.querySelector('[data-date="2026-05-11"]')?.getAttribute('data-level')).toBe('2');
    expect(container.querySelector('[data-date="2026-05-10"]')?.getAttribute('data-level')).toBe('1');
  });
});
```

- [ ] **Step 2: Run test — should fail**

```sh
pnpm vitest run tests/components/Heatmap.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: Implement Heatmap**

Create `components/Heatmap.tsx`:

```tsx
import { addDays, format, startOfDay, subDays } from 'date-fns';

type Day = { date: string; tokens: number };

type HeatmapProps = {
  days: Day[];
  today: Date;
};

const COLS = 52;
const ROWS = 7;

const LEVEL_COLORS = [
  'var(--color-heat-0)',
  'var(--color-heat-1)',
  'var(--color-heat-2)',
  'var(--color-heat-3)',
  'var(--color-heat-4)',
];

function levelFor(tokens: number): 0 | 1 | 2 | 3 | 4 {
  if (tokens >= 300_000) return 4;
  if (tokens >= 100_000) return 3;
  if (tokens >= 10_000) return 2;
  if (tokens >= 1_000) return 1;
  return 0;
}

export function Heatmap({ days, today }: HeatmapProps) {
  const byDate = new Map(days.map((d) => [d.date, d.tokens]));
  const start = startOfDay(subDays(today, COLS * ROWS - 1));

  const cells: { date: string; level: 0 | 1 | 2 | 3 | 4 }[] = [];
  for (let i = 0; i < COLS * ROWS; i++) {
    const d = addDays(start, i);
    const iso = format(d, 'yyyy-MM-dd');
    cells.push({ date: iso, level: levelFor(byDate.get(iso) ?? 0) });
  }

  return (
    <div
      className="grid gap-[2px]"
      style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }}
      role="img"
      aria-label="52-week activity heatmap"
    >
      {cells.map((c) => (
        <div
          key={c.date}
          data-cell
          data-date={c.date}
          data-level={c.level}
          title={`${c.date} · level ${c.level}`}
          className="h-[9px] rounded-[1px]"
          style={{ background: LEVEL_COLORS[c.level] }}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run test**

```sh
pnpm vitest run tests/components/Heatmap.test.tsx
pnpm typecheck
```

Both PASS.

- [ ] **Step 5: Commit**

```sh
git add components/Heatmap.tsx tests/components/Heatmap.test.tsx
git commit -m "feat(ui): 52w × 7 day heatmap"
```

---

### Task 4.3: `BuildsPane` (left pane, placeholder data)

**Files:**
- Create: `components/BuildsPane.tsx`, `tests/components/BuildsPane.test.tsx`

- [ ] **Step 1: Failing test — BuildsPane renders header + at least 3 build rows**

Create `tests/components/BuildsPane.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BuildsPane } from '@/components/BuildsPane';

describe('BuildsPane', () => {
  it('renders the "· builds" header', () => {
    render(<BuildsPane />);
    expect(screen.getByText(/· builds/i)).toBeInTheDocument();
  });
  it('renders placeholder build rows', () => {
    render(<BuildsPane />);
    const rows = screen.getAllByTestId('build-row');
    expect(rows.length).toBeGreaterThanOrEqual(3);
  });
});
```

- [ ] **Step 2: Run test — should fail**

```sh
pnpm vitest run tests/components/BuildsPane.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: Implement BuildsPane**

Create `components/BuildsPane.tsx`:

```tsx
type BuildStatus = 'active' | 'shipped' | 'live' | 'paused' | 'work';

type Build = {
  name: string;
  status: BuildStatus;
  hint: string;
};

const PLACEHOLDER_BUILDS: Build[] = [
  { name: 'cc-dashboard', status: 'active', hint: 'new' },
  { name: 'holdengr.com', status: 'live', hint: 'live' },
  { name: 'watch-whisperer', status: 'shipped', hint: 'shipped 1w' },
];

const DOT_COLOR: Record<BuildStatus, string> = {
  active: 'var(--color-orange)',
  shipped: 'var(--color-green)',
  live: 'var(--color-green)',
  paused: '#333',
  work: 'var(--color-yellow)',
};

export function BuildsPane() {
  return (
    <div
      className="rounded border p-2.5 min-h-[210px]"
      style={{ borderColor: 'var(--color-border)', borderTop: '2px solid var(--color-cyan)' }}
    >
      <h4 className="text-[0.6rem] uppercase tracking-[0.1em] font-semibold mb-2" style={{ color: 'var(--color-cyan)' }}>
        · builds
      </h4>
      {PLACEHOLDER_BUILDS.map((b) => (
        <div key={b.name} data-testid="build-row" className="flex items-center gap-2 py-0.5">
          <span className="inline-block w-2 h-2 rounded-full" style={{ background: DOT_COLOR[b.status] }} />
          <span className="text-[0.7rem]">{b.name}</span>
          <span className="text-[0.6rem] ml-auto" style={{ color: 'var(--color-dim)' }}>
            {b.hint}
          </span>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run test**

```sh
pnpm vitest run tests/components/BuildsPane.test.tsx
pnpm typecheck
```

Both PASS.

- [ ] **Step 5: Commit**

```sh
git add components/BuildsPane.tsx tests/components/BuildsPane.test.tsx
git commit -m "feat(ui): BuildsPane (left, placeholder data)"
```

---

### Task 4.4: `ActivityPane` (center pane with Heatmap + stat row)

**Files:**
- Create: `components/ActivityPane.tsx`, `tests/components/ActivityPane.test.tsx`

- [ ] **Step 1: Failing test — ActivityPane renders 4 stat tiles + Heatmap + model stack**

Create `tests/components/ActivityPane.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ActivityPane } from '@/components/ActivityPane';

describe('ActivityPane', () => {
  it('renders "tokens today", "vs avg", "streak", "machines" stat labels', () => {
    render(<ActivityPane />);
    expect(screen.getByText(/tokens today/i)).toBeInTheDocument();
    expect(screen.getByText(/vs avg/i)).toBeInTheDocument();
    expect(screen.getByText(/streak/i)).toBeInTheDocument();
    expect(screen.getByText(/machines/i)).toBeInTheDocument();
  });
  it('renders model stack legend (opus, sonnet, haiku)', () => {
    render(<ActivityPane />);
    expect(screen.getByText(/opus/i)).toBeInTheDocument();
    expect(screen.getByText(/sonnet/i)).toBeInTheDocument();
    expect(screen.getByText(/haiku/i)).toBeInTheDocument();
  });
  it('embeds the heatmap (role=img)', () => {
    render(<ActivityPane />);
    expect(screen.getByRole('img', { name: /52-week activity heatmap/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test — should fail**

```sh
pnpm vitest run tests/components/ActivityPane.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: Implement ActivityPane**

Create `components/ActivityPane.tsx`:

```tsx
import { Heatmap } from '@/components/Heatmap';

type Stat = { n: string; l: string; color: string };

const PLACEHOLDER_STATS: Stat[] = [
  { n: '0', l: 'tokens today', color: 'var(--color-orange)' },
  { n: '—', l: 'vs avg', color: 'var(--color-green)' },
  { n: '0d', l: 'streak', color: 'var(--color-yellow)' },
  { n: '0', l: 'machines', color: 'var(--color-cyan)' },
];

export function ActivityPane() {
  const today = new Date();
  return (
    <div
      className="rounded border p-2.5 min-h-[210px]"
      style={{ borderColor: 'var(--color-border)', borderTop: '2px solid var(--color-orange)' }}
    >
      <h4 className="text-[0.6rem] uppercase tracking-[0.1em] font-semibold mb-2" style={{ color: 'var(--color-orange)' }}>
        · activity
      </h4>

      <div className="flex gap-4 my-1.5">
        {PLACEHOLDER_STATS.map((s) => (
          <div key={s.l} className="flex flex-col">
            <span className="text-[1.1rem] font-semibold leading-none" style={{ color: s.color }}>
              {s.n}
            </span>
            <span className="text-[0.58rem] uppercase tracking-[0.08em]" style={{ color: 'var(--color-dim)' }}>
              {s.l}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-2 flex h-[18px] rounded-[3px] overflow-hidden">
        <div style={{ background: 'var(--color-orange)', width: '0%' }} />
        <div style={{ background: 'var(--color-cyan)', width: '0%' }} />
        <div style={{ background: 'var(--color-green)', width: '0%' }} />
      </div>
      <div className="flex gap-3 text-[0.6rem] mt-1" style={{ color: 'var(--color-dim)' }}>
        <span>
          <i className="inline-block w-2 h-2 rounded-[2px] mr-1 align-middle" style={{ background: 'var(--color-orange)' }} />
          opus
        </span>
        <span>
          <i className="inline-block w-2 h-2 rounded-[2px] mr-1 align-middle" style={{ background: 'var(--color-cyan)' }} />
          sonnet
        </span>
        <span>
          <i className="inline-block w-2 h-2 rounded-[2px] mr-1 align-middle" style={{ background: 'var(--color-green)' }} />
          haiku
        </span>
      </div>

      <div className="mt-2.5">
        <div className="text-[0.55rem] uppercase tracking-[0.08em] mb-1" style={{ color: 'var(--color-dim)' }}>
          52w activity
        </div>
        <Heatmap days={[]} today={today} />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test**

```sh
pnpm vitest run tests/components/ActivityPane.test.tsx
pnpm typecheck
```

Both PASS.

- [ ] **Step 5: Commit**

```sh
git add components/ActivityPane.tsx tests/components/ActivityPane.test.tsx
git commit -m "feat(ui): ActivityPane with heatmap + model stack"
```

---

### Task 4.5: `PersonaPane` (right pane)

**Files:**
- Create: `components/PersonaPane.tsx`, `tests/components/PersonaPane.test.tsx`

- [ ] **Step 1: Failing test — PersonaPane renders persona name and "next up"**

Create `tests/components/PersonaPane.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PersonaPane } from '@/components/PersonaPane';

describe('PersonaPane', () => {
  it('renders the primary persona name', () => {
    render(<PersonaPane primary="THE FOUNDER" secondary={['NIGHT-OWL']} />);
    expect(screen.getByText(/THE FOUNDER/)).toBeInTheDocument();
    expect(screen.getByText(/NIGHT-OWL/)).toBeInTheDocument();
  });
  it('renders "NO PERSONA YET" placeholder when primary is null', () => {
    render(<PersonaPane primary={null} secondary={[]} />);
    expect(screen.getByText(/NO PERSONA YET/)).toBeInTheDocument();
  });
  it('renders "· badges" and "· next up" subheadings', () => {
    render(<PersonaPane primary="THE FOUNDER" secondary={[]} />);
    expect(screen.getByText(/· badges/i)).toBeInTheDocument();
    expect(screen.getByText(/· next up/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test — should fail**

```sh
pnpm vitest run tests/components/PersonaPane.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: Implement PersonaPane**

Create `components/PersonaPane.tsx`:

```tsx
type PersonaPaneProps = {
  primary: string | null;
  secondary: string[];
};

export function PersonaPane({ primary, secondary }: PersonaPaneProps) {
  return (
    <div
      className="rounded border p-2.5 min-h-[210px]"
      style={{ borderColor: 'var(--color-border)', borderTop: '2px solid var(--color-magenta)' }}
    >
      <h4 className="text-[0.6rem] uppercase tracking-[0.1em] font-semibold mb-2" style={{ color: 'var(--color-magenta)' }}>
        · persona
      </h4>
      <div
        className="font-bold leading-tight text-[1.1rem] tracking-wider"
        style={{ color: primary ? 'var(--color-magenta)' : 'var(--color-dim)' }}
      >
        {primary ?? 'NO PERSONA YET'}
      </div>
      {secondary.length > 0 && (
        <div className="text-[0.6rem] mt-0.5" style={{ color: 'var(--color-dim)' }}>
          + {secondary.join(' · ')}
        </div>
      )}

      <h4 className="text-[0.6rem] uppercase tracking-[0.1em] font-semibold mt-3 mb-2" style={{ color: 'var(--color-magenta)' }}>
        · badges <span style={{ color: 'var(--color-dim)' }} className="font-normal">0/50</span>
      </h4>
      <div className="text-[0.6rem]" style={{ color: 'var(--color-dim)' }}>
        Earn your first badge by shipping today.
      </div>

      <h4 className="text-[0.6rem] uppercase tracking-[0.1em] font-semibold mt-3 mb-2" style={{ color: 'var(--color-magenta)' }}>
        · next up
      </h4>
      <div className="text-[0.6rem]" style={{ color: 'var(--color-dim)' }}>
        first-day-shipped
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test**

```sh
pnpm vitest run tests/components/PersonaPane.test.tsx
pnpm typecheck
```

Both PASS.

- [ ] **Step 5: Commit**

```sh
git add components/PersonaPane.tsx tests/components/PersonaPane.test.tsx
git commit -m "feat(ui): PersonaPane with placeholder data"
```

---

### Task 4.6: Profile-page integration test passes

**Files:**
- Re-run: `tests/routes/profile-page.test.tsx`

- [ ] **Step 1: Run the previously-failing profile-page test**

```sh
pnpm vitest run tests/routes/profile-page.test.tsx
```

Expected: PASS — all three component imports now resolve.

- [ ] **Step 2: Manual visual smoke**

```sh
pnpm dev
```

Sign in via GitHub (or insert a row manually if Task 2.6 was skipped):

```sh
pnpm exec supabase db psql -c "
insert into auth.users (id, email, raw_user_meta_data)
values ('00000000-0000-0000-0000-000000000001', 'holden@holdengr.com', '{\"user_name\":\"holden\",\"full_name\":\"Holden\",\"provider_id\":\"123\",\"avatar_url\":null}'::jsonb)
on conflict do nothing;
"
```

The `handle_new_auth_user` trigger should populate `public.users`. Then visit `http://localhost:3000/holden` — should render the powerline + 3 panes.

- [ ] **Step 3: Take a Playwright screenshot for the record**

Create `e2e/profile.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

test('profile page renders chrome', async ({ page }) => {
  await page.goto('/holden');
  // StatusBar segments
  await expect(page.getByText('$ holden')).toBeVisible();
  await expect(page.getByText(/streak/i)).toBeVisible();
  // 3 panes
  await expect(page.getByText('· builds')).toBeVisible();
  await expect(page.getByText('· activity')).toBeVisible();
  await expect(page.getByText('· persona')).toBeVisible();
  // Heatmap
  await expect(page.getByRole('img', { name: /52-week activity heatmap/i })).toBeVisible();

  await page.screenshot({ path: 'e2e/screenshots/profile.png', fullPage: true });
});
```

- [ ] **Step 4: Run E2E**

```sh
pnpm test:e2e e2e/profile.spec.ts
```

Expected: PASS, screenshot saved.

- [ ] **Step 5: Commit**

```sh
git add e2e/profile.spec.ts e2e/screenshots/profile.png
git commit -m "test(e2e): profile page chrome renders"
```

---

## Phase 5 — `/` redirect + final commit

### Task 5.1: `/` redirects to `/holden`

**Files:**
- Replace: `app/page.tsx`

- [ ] **Step 1: Failing test — root page calls `redirect('/holden')`**

Create `tests/routes/home-redirect.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';

const redirectMock = vi.fn(() => { throw new Error('NEXT_REDIRECT'); });
vi.mock('next/navigation', () => ({ redirect: redirectMock }));

describe('GET /', () => {
  it('redirects to /holden', async () => {
    const { default: Page } = await import('../../app/page');
    expect(() => Page()).toThrow('NEXT_REDIRECT');
    expect(redirectMock).toHaveBeenCalledWith('/holden');
  });
});
```

- [ ] **Step 2: Run test — should fail**

```sh
pnpm vitest run tests/routes/home-redirect.test.tsx
```

Expected: FAIL (default page.tsx renders the Next.js welcome screen).

- [ ] **Step 3: Replace `app/page.tsx`**

```tsx
import { redirect } from 'next/navigation';

export default function HomePage() {
  redirect('/holden');
}
```

- [ ] **Step 4: Run test**

```sh
pnpm vitest run tests/routes/home-redirect.test.tsx
pnpm typecheck
```

Both PASS.

- [ ] **Step 5: Commit**

```sh
git add app/page.tsx tests/routes/home-redirect.test.tsx
git commit -m "feat(routing): / redirects to /holden in v1"
```

---

## Phase 6 — Deploy to Cloudflare Pages

### Task 6.1: Cloudflare Pages config

**Files:**
- Create: `wrangler.toml`
- Modify: `next.config.ts`
- Modify: `package.json` (add deploy scripts)

> **Manual step:** Connecting the repo to Cloudflare Pages is done in the CF dashboard, not via code. The test below verifies the local build succeeds (which is what CF Pages runs).

- [ ] **Step 1: Failing test — `pnpm build` succeeds**

Create `tests/smoke/build.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';

describe('production build', () => {
  it('builds without errors', () => {
    expect(() => execSync('pnpm build', { stdio: 'pipe', timeout: 180_000 })).not.toThrow();
  }, 180_000);
});
```

- [ ] **Step 2: Run test — may fail if anything is misconfigured**

```sh
pnpm vitest run tests/smoke/build.test.ts
```

If it fails, fix the build errors before continuing.

- [ ] **Step 3: Add Cloudflare-friendly config**

Update `next.config.ts`:

```ts
import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    typedRoutes: true,
  },
};

export default config;
```

Add deploy scripts to `package.json`:

```json
{
  "scripts": {
    "pages:build": "pnpm exec @cloudflare/next-on-pages",
    "pages:deploy": "pnpm pages:build && pnpm exec wrangler pages deploy .vercel/output/static"
  }
}
```

```sh
pnpm add -D @cloudflare/next-on-pages wrangler
```

- [ ] **Step 4: Verify Cloudflare adapter build works**

```sh
pnpm pages:build
```

Expected: builds `.vercel/output/static/` without errors.

- [ ] **Step 5: Commit**

```sh
git add next.config.ts package.json pnpm-lock.yaml tests/smoke/build.test.ts
git commit -m "build: Cloudflare Pages adapter + production build smoke test"
```

---

### Task 6.2: Deploy via CF Pages dashboard

> **Manual step.** No code change here — Holden walks through the Cloudflare dashboard.

- [ ] **Step 1: Push repo to GitHub**

```sh
gh repo create cc-dashboard --private --source=. --remote=origin --push
```

- [ ] **Step 2: Connect to Cloudflare Pages**

In Cloudflare dashboard → Workers & Pages → Create application → Pages → Connect to Git.

- Select the `cc-dashboard` repo.
- Build command: `pnpm pages:build`
- Build output directory: `.vercel/output/static`
- Root directory: `/`
- Environment variables (Production):
  - `NEXT_PUBLIC_SUPABASE_URL` = (production Supabase URL — see Step 3)
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = (production anon key)
  - `SUPABASE_SERVICE_ROLE_KEY` = (production service role)
  - `GITHUB_OAUTH_CLIENT_ID` = (production GitHub OAuth client ID — see Step 4)
  - `GITHUB_OAUTH_CLIENT_SECRET` = (production client secret)

- [ ] **Step 3: Create a production Supabase project**

In Supabase dashboard → New project. Save the URL, anon key, service role key. Then link locally and push the migration:

```sh
pnpm exec supabase link --project-ref <project-ref>
pnpm exec supabase db push
```

- [ ] **Step 4: Create a production GitHub OAuth app**

Same flow as Task 2.4 but with:
- **Homepage URL:** the CF Pages URL (e.g., `https://cc-dashboard-abc.pages.dev`)
- **Callback URL:** `https://<your-supabase-ref>.supabase.co/auth/v1/callback`

In Supabase dashboard → Authentication → Providers → GitHub: paste the Client ID + Secret. Enable.

- [ ] **Step 5: Verify production deploy**

After Cloudflare finishes the first build, visit the `*.pages.dev` URL. Then `/auth/signin` → sign in with GitHub → land on `/holden`. Screenshot. Done.

Commit a note about the deploy URL:

```sh
echo "Production URL: <cf-pages-url>" >> README.md
git add README.md
git commit -m "docs: production URL"
```

---

## End-of-plan checklist

After all tasks complete:

- [ ] `pnpm test` passes (unit + component tests)
- [ ] `pnpm test:e2e` passes (profile.spec.ts at least; signin.spec.ts requires manual run)
- [ ] `pnpm typecheck` passes
- [ ] `pnpm build` succeeds
- [ ] Production URL responds with the profile chrome at `/holden`
- [ ] Sign-in flow round-trips: `/auth/signin` → GitHub → `/auth/callback` → `/me` → `/holden`
- [ ] A row exists in `public.users` for Holden with his GitHub handle

## What this plan does NOT cover (next plans)

- Real ingestion pipeline (Stop hook + `dashboard-push.py` + `/api/ingest`) — **Plan 2**
- Supabase Realtime live updates — **Plan 2**
- 30-day trend chart, model donut, time-of-day histogram, day-of-week, stacked area — **Plan 3**
- Leaderboard with filters + group bar comparison + head-to-head — **Plan 4**
- Stats explorer tabbed view — **Plan 4**
- Badge engine + persona inference — **Plan 5**
- Skills/Notes/Goals/Machines sections — **Plan 6**
- SSR optimization + OG image generation + AEO metadata — **Plan 7**
- Custom domain `vibecodestats.dev` — **Plan 7**
