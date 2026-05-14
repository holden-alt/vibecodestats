import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Strip JSONC comments while preserving string contents (path mappings like "@/*" contain /*).
function stripJsonComments(input: string): string {
  let out = '';
  let inString = false;
  let inLineComment = false;
  let inBlockComment = false;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    const next = input[i + 1];
    if (inLineComment) {
      if (ch === '\n') {
        inLineComment = false;
        out += ch;
      }
      continue;
    }
    if (inBlockComment) {
      if (ch === '*' && next === '/') {
        inBlockComment = false;
        i++;
      }
      continue;
    }
    if (inString) {
      out += ch;
      if (ch === '\\' && next !== undefined) {
        out += next;
        i++;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      out += ch;
      continue;
    }
    if (ch === '/' && next === '/') {
      inLineComment = true;
      i++;
      continue;
    }
    if (ch === '/' && next === '*') {
      inBlockComment = true;
      i++;
      continue;
    }
    out += ch;
  }
  return out;
}

describe('tsconfig strict mode', () => {
  it('enables strict + noUncheckedIndexedAccess + exactOptionalPropertyTypes', () => {
    const raw = readFileSync(resolve(__dirname, '../../tsconfig.json'), 'utf8');
    const cfg = JSON.parse(stripJsonComments(raw));
    expect(cfg.compilerOptions.strict).toBe(true);
    expect(cfg.compilerOptions.noUncheckedIndexedAccess).toBe(true);
    expect(cfg.compilerOptions.exactOptionalPropertyTypes).toBe(true);
  });
});
