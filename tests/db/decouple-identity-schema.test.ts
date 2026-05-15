import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('decouple_user_identity migration', () => {
  const sql = readFileSync(
    resolve(__dirname, '../../supabase/migrations/20260514000005_decouple_user_identity.sql'),
    'utf8',
  );

  it('drops the users.id -> auth.users foreign key', () => {
    expect(sql).toMatch(/drop constraint/i);
    expect(sql).toMatch(/confrelid = 'auth\.users'::regclass/i);
  });

  it('adds a nullable auth_id column referencing auth.users', () => {
    expect(sql).toMatch(/add column auth_id uuid references auth\.users \(id\)/i);
  });

  it('backfills auth_id from the existing id', () => {
    expect(sql).toMatch(/update public\.users set auth_id = id/i);
  });

  it('gives users.id a gen_random_uuid default', () => {
    expect(sql).toMatch(/alter column id set default gen_random_uuid\(\)/i);
  });

  it('rewrites the signup trigger to populate auth_id', () => {
    expect(sql).toMatch(/insert into public\.users \(auth_id,/i);
    expect(sql).toMatch(/on conflict \(auth_id\) do nothing/i);
  });

  it('updates the users_update_self RLS policy to match on auth_id', () => {
    expect(sql).toMatch(/drop policy users_update_self/i);
    expect(sql).toMatch(/using \(auth\.uid\(\) = auth_id\)/i);
  });
});
