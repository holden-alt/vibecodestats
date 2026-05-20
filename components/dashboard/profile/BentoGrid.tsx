import type { ReactNode } from 'react';

type Props = { children: ReactNode };

export function BentoGrid({ children }: Props) {
  return (
    <div className="cc-bento-grid">
      {children}
    </div>
  );
}
