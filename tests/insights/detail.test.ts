import { describe, it, expect } from 'vitest';
import {
  buildActiveHours,
  buildModelWeeks,
  buildProjectLanes,
  buildWorkClock,
  canonicalProject,
  clockHourAt,
  deepWorkPerDay,
  weekStart,
  weeksThrough,
  workdayIndex,
  workdayMidpoint,
} from '@/lib/insights/compute';
import type { HourlyRow, ModelDailyRow, ProjectModelDailyRow } from '@/lib/insights/types';

function md(p: Partial<ModelDailyRow> & Pick<ModelDailyRow, 'date' | 'source' | 'model'>): ModelDailyRow {
  return {
    input_tokens: 0, output_tokens: 0, cache_read_tokens: 0, cache_create_tokens: 0, reasoning_tokens: 0,
    turns: 0, tool_calls: 0, sessions: 0, active_minutes: 0, cost_usd: null, ...p,
  };
}
const hr = (date: string, hour: number, source: string, model: string, tokens: number): HourlyRow => ({ date, hour, source, model, tokens });
const pm = (date: string, project: string, source: string, model: string, tokens_total: number): ProjectModelDailyRow => ({
  date, project, source, model, tokens_total, turns: 0,
});

// 2026-09-28 and 2026-10-05 and 2026-10-12 are Mondays; 2026-10-18 is a Sunday.
describe('week helpers', () => {
  it('finds Mondays and lists every week through today', () => {
    expect(weekStart('2026-10-18')).toBe('2026-10-12');
    expect(weekStart('2026-10-12')).toBe('2026-10-12');
    expect(weeksThrough('2026-09-30', '2026-10-13')).toEqual(['2026-09-28', '2026-10-05', '2026-10-12']);
  });
});

describe('buildModelWeeks', () => {
  const rows = [
    md({ date: '2026-09-28', source: 'claude-code', model: 'claude-opus-5', output_tokens: 50 }),
    md({ date: '2026-10-06', source: 'codex', model: 'gpt-6.1-sol', output_tokens: 70 }),
    md({ date: '2026-10-07', source: 'claude-code', model: 'claude-opus-5-5', output_tokens: 90 }),
    md({ date: '2026-10-13', source: 'grok', model: 'grok-4.6-build', output_tokens: 5 }),
  ];

  it('lists every model all time, biggest first, with when it ran', () => {
    const { list } = buildModelWeeks(rows, '2026-10-14');
    expect(list.map((m) => [m.model, m.total, m.first, m.last])).toEqual([
      ['claude-opus-5-5', 90, '2026-10-07', '2026-10-07'],
      ['gpt-6.1-sol', 70, '2026-10-06', '2026-10-06'],
      ['claude-opus-5', 50, '2026-09-28', '2026-09-28'],
      ['grok-4.6-build', 5, '2026-10-13', '2026-10-13'],
    ]);
  });

  it('stacks by vendor then arrival, folds the tail, and zero-fills weeks', () => {
    const { stack, weeks } = buildModelWeeks(rows, '2026-10-14', 3);
    expect(stack.map((m) => m.model)).toEqual(['claude-opus-5', 'claude-opus-5-5', 'gpt-6.1-sol', 'other']);
    expect(weeks.map((w) => [w.start, w.partial])).toEqual([
      ['2026-09-28', false],
      ['2026-10-05', false],
      ['2026-10-12', true],
    ]);
    expect(weeks[2]!.values).toEqual({ 'claude-opus-5': 0, 'claude-opus-5-5': 0, 'gpt-6.1-sol': 0, other: 5 });
  });
});

describe('work-day axis', () => {
  it('starts the day at 4 a.m. so late nights stay with the evening', () => {
    expect(workdayIndex(4)).toBe(0);
    expect(workdayIndex(23)).toBe(19);
    expect(workdayIndex(2)).toBe(22);
    expect(clockHourAt(22)).toBe(2);
    expect(clockHourAt(10.5)).toBe(14.5);
  });

  it('finds the point by which half the work was done', () => {
    const cells = new Array<number>(24).fill(0);
    cells[5] = 10; // 9 a.m.
    cells[11] = 10; // 3 p.m.
    expect(workdayMidpoint(cells)).toBe(6); // the end of the 9 a.m. hour
    expect(workdayMidpoint(new Array<number>(24).fill(0))).toBeNull();
  });
});

describe('buildWorkClock', () => {
  it('buckets tokens by week, work-day hour, and tool', () => {
    const weeks = buildWorkClock(
      [
        hr('2026-10-06', 9, 'claude-code', 'claude-opus-5-5', 100),
        hr('2026-10-07', 9, 'codex', 'gpt-6.1-sol', 40),
        hr('2026-10-13', 1, 'codex', 'gpt-6.1-sol', 7),
      ],
      '2026-10-14',
    );
    expect(weeks.map((w) => w.start)).toEqual(['2026-10-05', '2026-10-12']);
    expect(weeks[0]!.claude[5]).toBe(100);
    expect(weeks[0]!.codex[5]).toBe(40);
    expect(weeks[1]!.codex[21]).toBe(7);
  });
});

describe('buildActiveHours', () => {
  const hourly = [
    hr('2026-10-12', 9, 'claude-code', 'claude-opus-5-5', 100),
    hr('2026-10-12', 9, 'claude-code', 'claude-sonnet-5', 5), // same hour, same tool
    hr('2026-10-12', 10, 'claude-code', 'claude-opus-5-5', 100),
    hr('2026-10-12', 10, 'codex', 'gpt-6.1-sol', 100), // parallel
    hr('2026-10-13', 2, 'codex', 'gpt-6.1-sol', 100),
    hr('2026-10-13', 3, 'grok', 'grok-4.6-build', 1),
    hr('2026-10-13', 4, 'codex', 'gpt-6.1-sol', 0), // no tokens, not running
  ];

  it('sizes each week by deep work and splits it by which tools were running', () => {
    const history = [
      { date: '2026-10-12', tokens_total: 1, sessions: 1, deep_work_minutes: 120 },
      { date: '2026-10-13', tokens_total: 1, sessions: 1, deep_work_minutes: 120 },
    ];
    expect(buildActiveHours(hourly, history, '2026-10-14')).toEqual([
      { start: '2026-10-12', days: 3, claudeOnly: 1, codexOnly: 1, both: 1, other: 1, total: 4, running: 4, partial: true },
    ]);
  });

  it('keeps deep work from before hourly tracking as Claude time', () => {
    const weeks = buildActiveHours([], [{ date: '2026-10-05', tokens_total: 1, sessions: 1, deep_work_minutes: 90 }], '2026-10-11');
    expect(weeks[0]).toMatchObject({ claudeOnly: 1.5, total: 1.5, running: 0, partial: false });
  });
});

describe('deepWorkPerDay', () => {
  it('averages deep work over the window or since the first day', () => {
    const history = [
      { date: '2026-10-10', tokens_total: 1, sessions: 1, deep_work_minutes: 360 },
      { date: '2026-10-12', tokens_total: 1, sessions: 1, deep_work_minutes: 180 },
    ];
    expect(deepWorkPerDay(history, '2026-10-12', 3)).toBe(3);
    expect(deepWorkPerDay(history, '2026-10-12', null)).toBe(3);
    expect(deepWorkPerDay([], '2026-10-12', 30)).toBe(0);
  });
});

describe('project folding', () => {
  it('folds a worktree inside a project into that project', () => {
    expect(canonicalProject('watch-desk/.claude/worktrees/agent-a74b7d1e904eae123')).toBe('watch-desk');
    expect(canonicalProject('richardsonappliedai/rai-ops/.codex/worktrees/x/sub')).toBe('richardsonappliedai/rai-ops');
    expect(canonicalProject('.codex/worktrees/f76d/brain', ['brain'])).toBe('brain');
  });
});

describe('buildProjectLanes', () => {
  const rows = [
    pm('2026-09-29', 'holden-alt/cc-dashboard', 'claude-code', 'claude-opus-5', 400),
    pm('2026-10-06', 'watch-desk', 'claude-code', 'claude-opus-5-5', 300),
    pm('2026-10-07', 'watch-desk/.claude/worktrees/agent-1', 'codex', 'gpt-6.1-sol', 200),
    pm('2026-10-13', 'richardsonappliedai', 'codex', 'gpt-6.1-sol', 100),
    pm('2026-10-13', 'tiny', 'codex', 'gpt-6.1-sol', 1),
  ];

  it('makes one lane per project, ordered by when it started, with tool splits per week', () => {
    const lanes = buildProjectLanes(rows, '2026-10-14', 3);
    expect(lanes.weeks).toEqual(['2026-09-28', '2026-10-05', '2026-10-12']);
    expect(lanes.lanes.map((l) => [l.label, l.total, l.first])).toEqual([
      ['cc-dashboard', 400, '2026-09-29'],
      ['watch-desk', 500, '2026-10-06'],
      ['richardsonappliedai', 100, '2026-10-13'],
    ]);
    expect(lanes.lanes[1]!.cells[1]).toEqual({ claude: 300, codex: 200, other: 0 });
    expect(lanes.maxCell).toBe(500);
    expect(lanes.rest).toEqual({ count: 1, total: 1 });
  });

  it('disambiguates projects that share a last path segment', () => {
    const lanes = buildProjectLanes(
      [
        pm('2026-10-13', 'richardsonappliedai', 'codex', 'gpt-6.1-sol', 10),
        pm('2026-10-13', 'richardsonappliedai/richardsonappliedai', 'codex', 'gpt-6.1-sol', 5),
        pm('2026-10-13', '~', 'claude-code', 'claude-opus-5-5', 3),
      ],
      '2026-10-14',
    );
    expect(lanes.lanes.map((l) => l.label).sort()).toEqual([
      'home folder',
      'richardsonappliedai',
      'richardsonappliedai/richardsonappliedai',
    ]);
  });
});
