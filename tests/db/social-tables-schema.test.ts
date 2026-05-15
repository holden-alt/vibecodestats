import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('social_tables migration', () => {
  const sql = readFileSync(
    resolve(__dirname, '../../supabase/migrations/20260514000006_social_tables.sql'),
    'utf8',
  );

  it('creates public.groups with a slug and owner_id', () => {
    expect(sql).toMatch(/create table public\.groups/i);
    expect(sql).toMatch(/slug text not null unique/i);
    expect(sql).toMatch(/owner_id uuid not null references public\.users \(id\)/i);
  });

  it('creates public.group_members with a (group_id, user_id) primary key', () => {
    expect(sql).toMatch(/create table public\.group_members/i);
    expect(sql).toMatch(/primary key\s*\(group_id, user_id\)/i);
  });

  it('creates public.friendships with a (user_id, friend_id) primary key', () => {
    expect(sql).toMatch(/create table public\.friendships/i);
    expect(sql).toMatch(/primary key\s*\(user_id, friend_id\)/i);
    expect(sql).toMatch(/create index friendships_friend_idx on public\.friendships \(friend_id\)/i);
  });

  it('enables RLS with public select policies on all three tables', () => {
    expect(sql.match(/enable row level security/gi)?.length).toBe(3);
    expect(sql).toMatch(/groups_select_all/);
    expect(sql).toMatch(/group_members_select_all/);
    expect(sql).toMatch(/friendships_select_all/);
  });
});
