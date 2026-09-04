import { describe, it, expect } from 'vitest';
import { modelColor, modelLabel, shade, vendorOf, VENDOR_COLOR, VENDOR_ORDER } from '@/lib/insights/colors';

describe('vendorOf', () => {
  it('keys Anthropic models warm regardless of source', () => {
    expect(vendorOf('claude-fable-5', 'claude-code')).toBe('anthropic');
    expect(vendorOf('claude-opus-4-8')).toBe('anthropic');
    expect(vendorOf('approx-history', 'claude-code')).toBe('anthropic');
  });
  it('keys OpenAI models cool even when logged under another source', () => {
    expect(vendorOf('gpt-5.6-sol', 'codex')).toBe('openai');
    expect(vendorOf('gpt-5.5', 'claude-code')).toBe('openai');
    expect(vendorOf('codex-auto-review', 'codex')).toBe('openai');
    expect(vendorOf('o3', 'codex')).toBe('openai');
  });
  it('keys xAI and Moonshot, and falls back on the source', () => {
    expect(vendorOf('grok-4.6-build', 'grok')).toBe('xai');
    expect(vendorOf('kimi-unknown', 'kimi')).toBe('moonshot');
    expect(vendorOf('mystery-model', 'codex')).toBe('openai');
    expect(vendorOf('mystery-model')).toBe('other');
  });
  it('stacks Anthropic first', () => {
    expect(VENDOR_ORDER[0]).toBe('anthropic');
    expect(VENDOR_ORDER[1]).toBe('openai');
  });
});

describe('modelColor', () => {
  it('is fixed per model — never per rank', () => {
    expect(modelColor('claude-fable-5')).toBe('#d97757');
    expect(modelColor('gpt-5.6-sol')).toBe('#4f8ff7');
    expect(modelColor('grok-4.6-build')).toBe('#ededea');
  });
  it('gives unknown models a stable family-based color', () => {
    const a = modelColor('claude-opus-9', 'claude-code');
    expect(a).toBe(modelColor('claude-opus-9', 'claude-code'));
    expect(a).toMatch(/^#[0-9a-f]{6}$/);
    // still warm: red channel dominates
    const r = parseInt(a.slice(1, 3), 16);
    const b = parseInt(a.slice(5, 7), 16);
    expect(r).toBeGreaterThan(b);
    const g = modelColor('gpt-7-nova', 'codex');
    const gr = parseInt(g.slice(1, 3), 16);
    const gb = parseInt(g.slice(5, 7), 16);
    expect(gb).toBeGreaterThan(gr);
  });
  it('vendor anchors match the fixed table for the flagship models', () => {
    expect(VENDOR_COLOR.anthropic).toBe(modelColor('claude-fable-5'));
    expect(VENDOR_COLOR.openai).toBe(modelColor('gpt-5.6-sol'));
  });
});

describe('shade + modelLabel', () => {
  it('mixes toward white or black', () => {
    expect(shade('#000000', 1)).toBe('#ffffff');
    expect(shade('#ffffff', -1)).toBe('#000000');
    expect(shade('#808080', 0)).toBe('#808080');
  });
  it('names restored history honestly', () => {
    const pretty = (m: string) => m.toUpperCase();
    expect(modelLabel('approx-history', pretty)).toBe('claude (unattributed)');
    expect(modelLabel('claude-opus-5', pretty)).toBe('CLAUDE-OPUS-5');
  });
});
