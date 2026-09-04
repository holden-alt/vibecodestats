// Vendor-keyed chart colors for the insights station.
//
// The rule: hue family = vendor, shade = model. Anthropic models are warm
// (orange / amber / rust), OpenAI models are cool (blue / teal / periwinkle),
// xAI is white-to-grey, Moonshot is violet. Color follows the ENTITY (model
// name), never its rank, so filtering or re-windowing a chart never repaints
// the survivors. Unknown models fall back to their family base, shifted by a
// stable hash so two unknown siblings still separate.

export type Vendor = 'anthropic' | 'openai' | 'xai' | 'moonshot' | 'other';

/** Stacking + legend order. Anthropic sits at the bottom of every stack. */
export const VENDOR_ORDER: readonly Vendor[] = ['anthropic', 'openai', 'xai', 'moonshot', 'other'];

export const VENDOR_LABEL: Record<Vendor, string> = {
  anthropic: 'anthropic',
  openai: 'openai',
  xai: 'xai',
  moonshot: 'moonshot',
  other: 'other',
};

/** One anchor per vendor — used for source pills, legends, subtotals. */
export const VENDOR_COLOR: Record<Vendor, string> = {
  anthropic: '#d97757',
  openai: '#4f8ff7',
  xai: '#d6d4cf',
  moonshot: '#b28ce6',
  other: '#6b665f',
};

/** Folded-tail "other" series. Dark warm-neutral so it never reads as xAI grey. */
export const OTHER_COLOR = '#6b665f';

// Fixed per-model colors. Within a vendor the shades are spread across hue AND
// lightness so neighbours in a stack stay apart (OKLab ΔE ≥ ~9 for every pair
// of models that carry real volume; the legend + tooltip carry the rest).
const MODEL_COLORS: Record<string, string> = {
  // anthropic — warm
  'claude-fable-5': '#d97757', // hero orange
  'claude-fable-5-1': '#f4a67e', // apricot — the successor glows lighter
  'claude-opus-5': '#c0392b', // crimson
  'claude-opus-4-8': '#9c5a1e', // burnt orange
  'claude-opus-4-7': '#94493d', // rust
  'claude-sonnet-5': '#e2739f', // rose — kept off the brand amber
  'claude-sonnet-4-6': '#9c4b6e', // deep rose
  'claude-haiku-4-5-20251001': '#f0d5b0', // sand
  'approx-history': '#74604f', // muted brown — restored history, model unknown
  // openai — cool
  'gpt-5.6-sol': '#4f8ff7', // blue
  'gpt-5.6-terra': '#2fc4b2', // teal
  'gpt-5.6-luna': '#9fb3ff', // periwinkle
  'gpt-5.5': '#3468bf', // deep blue
  'gpt-5.4-mini': '#9ed0f5', // pale sky
  'codex-auto-review': '#4a6f8f', // slate
  // xai — white → grey
  'grok-4.6-build': '#ededea',
  'grok-4.5-build': '#b9b8b4',
  'grok-4.5': '#8b8a87',
  // moonshot
  'kimi-unknown': '#b28ce6',
};

// Family bases for models we have not seen yet ('claude-opus-5-1' → opus).
const FAMILY_BASE: Record<string, string> = {
  fable: '#d97757',
  opus: '#c0392b',
  sonnet: '#e2739f',
  haiku: '#f0d5b0',
  gpt: '#4f8ff7',
  o: '#2fc4b2',
  codex: '#4a6f8f',
  grok: '#b9b8b4',
  kimi: '#b28ce6',
};

const SOURCE_VENDOR: Record<string, Vendor> = {
  'claude-code': 'anthropic',
  codex: 'openai',
  grok: 'xai',
  kimi: 'moonshot',
};

/** Which vendor a model belongs to. The model name wins; the source breaks ties. */
export function vendorOf(model: string, source?: string | null): Vendor {
  const m = model.toLowerCase();
  if (/^(claude|anthropic)/.test(m) || m === 'approx-history') return 'anthropic';
  if (/^(gpt|o\d|codex|openai|chatgpt)/.test(m)) return 'openai';
  if (/^grok/.test(m)) return 'xai';
  if (/^(kimi|moonshot)/.test(m)) return 'moonshot';
  return (source && SOURCE_VENDOR[source]) || 'other';
}

/** Model family word: 'claude-opus-4-8' → 'opus', 'gpt-5.6-sol' → 'gpt', 'o3' → 'o'. */
function familyOf(model: string): string {
  const m = model.toLowerCase().replace(/^(claude|anthropic)-/, '');
  const word = m.match(/^[a-z]+/)?.[0] ?? '';
  return word;
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Mix a hex color toward white (amount > 0) or black (amount < 0). */
export function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const target = amount >= 0 ? 255 : 0;
  const t = Math.min(1, Math.abs(amount));
  const out = ch.map((c) => Math.round(c + (target - c) * t));
  return '#' + out.map((c) => c.toString(16).padStart(2, '0')).join('');
}

/** Stable color for a model. Known models use the fixed table; unknown ones take
 *  their family base shifted by a hash so siblings still separate. */
export function modelColor(model: string, source?: string | null): string {
  const fixed = MODEL_COLORS[model];
  if (fixed) return fixed;
  const base = FAMILY_BASE[familyOf(model)] ?? VENDOR_COLOR[vendorOf(model, source)];
  // Three deterministic steps: -18%, +0%, +18% lightness.
  const step = (hash(model) % 3) - 1;
  return step === 0 ? base : shade(base, step * 0.18);
}

/** Human label; the restored-history pseudo-model gets an honest name. */
export function modelLabel(model: string, pretty: (m: string) => string): string {
  if (model === 'approx-history') return 'claude (unattributed)';
  return pretty(model);
}
