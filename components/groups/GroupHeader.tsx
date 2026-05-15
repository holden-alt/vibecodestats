type GroupHeaderProps = {
  name: string;
  color: string; // one of the design tokens: cyan, orange, yellow, green, magenta, etc.
  description: string | null;
  memberCount: number;
};

export function GroupHeader({ name, color, description, memberCount }: GroupHeaderProps) {
  return (
    <header className="mb-3" data-group-header>
      <div
        data-group-stripe
        className="h-[3px] w-12 mb-2 rounded-sm"
        style={{ background: `var(--color-${color})` }}
      />
      <h1
        className="text-[0.95rem] uppercase tracking-[0.14em] font-semibold"
        style={{ color: 'var(--color-fg)' }}
      >
        {name}
      </h1>
      <div className="text-[0.6rem] uppercase tracking-[0.12em] mt-1" style={{ color: 'var(--color-dim)' }}>
        {memberCount === 1 ? '1 member' : `${memberCount} members`}
      </div>
      {description ? (
        <p
          data-group-description
          className="text-[0.75rem] mt-2 max-w-[60ch]"
          style={{ color: 'var(--color-fg)' }}
        >
          {description}
        </p>
      ) : null}
    </header>
  );
}
