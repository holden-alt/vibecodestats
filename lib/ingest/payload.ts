export type IngestPayload = {
  github_handle: string;
  machine: string;
  date: string; // YYYY-MM-DD
  tokens_total: number;
  tokens_by_model: Record<string, number>;
  sessions: number;
  deep_work_minutes: number;
  projects_touched: Record<string, number>;
  ships: { commits: number; repos: number };
  // hourly_tokens is optional on the wire; the validator normalises missing → {}
  hourly_tokens: Record<string, number>;
};

export type ValidationResult =
  | { ok: true; value: IngestPayload }
  | { ok: false; error: string };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isNonNegNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0;
}

function isNumberRecord(v: unknown): v is Record<string, number> {
  return isPlainObject(v) && Object.values(v).every(isNonNegNumber);
}

export function validateIngestPayload(body: unknown): ValidationResult {
  if (!isPlainObject(body)) {
    return { ok: false, error: 'body must be an object' };
  }
  if (typeof body.github_handle !== 'string' || body.github_handle.length === 0) {
    return { ok: false, error: 'github_handle required' };
  }
  if (typeof body.machine !== 'string' || body.machine.length === 0) {
    return { ok: false, error: 'machine required' };
  }
  if (typeof body.date !== 'string' || !DATE_RE.test(body.date)) {
    return { ok: false, error: 'date must be YYYY-MM-DD' };
  }
  if (!isNonNegNumber(body.tokens_total)) {
    return { ok: false, error: 'tokens_total must be a non-negative number' };
  }
  if (!isNumberRecord(body.tokens_by_model)) {
    return { ok: false, error: 'tokens_by_model must be a record of non-negative numbers' };
  }
  if (!isNonNegNumber(body.sessions)) {
    return { ok: false, error: 'sessions must be a non-negative number' };
  }
  if (!isNonNegNumber(body.deep_work_minutes)) {
    return { ok: false, error: 'deep_work_minutes must be a non-negative number' };
  }
  if (!isNumberRecord(body.projects_touched)) {
    return { ok: false, error: 'projects_touched must be a record of non-negative numbers' };
  }
  if (
    !isPlainObject(body.ships) ||
    !isNonNegNumber(body.ships.commits) ||
    !isNonNegNumber(body.ships.repos)
  ) {
    return { ok: false, error: 'ships must be { commits, repos }' };
  }

  let hourly_tokens: Record<string, number> = {};
  if (body.hourly_tokens !== undefined) {
    if (!isNumberRecord(body.hourly_tokens)) {
      return { ok: false, error: 'hourly_tokens must be a record of non-negative numbers' };
    }
    hourly_tokens = body.hourly_tokens;
  }

  return {
    ok: true,
    value: {
      github_handle: body.github_handle,
      machine: body.machine,
      date: body.date,
      tokens_total: body.tokens_total,
      tokens_by_model: body.tokens_by_model,
      sessions: body.sessions,
      deep_work_minutes: body.deep_work_minutes,
      projects_touched: body.projects_touched,
      ships: { commits: body.ships.commits, repos: body.ships.repos },
      hourly_tokens,
    },
  };
}
