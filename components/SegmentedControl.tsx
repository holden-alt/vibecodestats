'use client';

type SegmentedControlProps<T extends string> = {
  options: readonly { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
};

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: SegmentedControlProps<T>) {
  return (
    <div
      className="flex flex-wrap gap-px rounded overflow-hidden border"
      style={{ borderColor: 'var(--color-border)' }}
      role="radiogroup"
    >
      {options.map((opt) => {
        const active = opt.id === value;
        return (
          <button
            key={opt.id}
            type="button"
            role="radio"
            aria-checked={active}
            data-segment={opt.id}
            data-active={active}
            onClick={() => onChange(opt.id)}
            className="px-2 py-1 text-[0.58rem] uppercase tracking-[0.08em] cursor-pointer"
            style={{
              background: active ? 'var(--color-magenta)' : 'var(--color-bg-2)',
              color: active ? 'var(--color-bg)' : 'var(--color-dim)',
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
