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
