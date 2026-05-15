import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { GroupHeader } from '@/components/groups/GroupHeader';

describe('GroupHeader', () => {
  it('renders the group name and the member count', () => {
    const { container } = render(
      <GroupHeader
        name="The Squad"
        color="cyan"
        description="demo vibecoders"
        memberCount={6}
      />,
    );
    expect(container.textContent).toContain('The Squad');
    expect(container.textContent).toContain('6 members');
    expect(container.textContent).toContain('demo vibecoders');
  });

  it('omits the description block when description is null', () => {
    const { container } = render(
      <GroupHeader name="Opus Club" color="orange" description={null} memberCount={3} />,
    );
    expect(container.querySelector('[data-group-description]')).toBeFalsy();
    expect(container.textContent).toContain('Opus Club');
  });

  it('applies the group color via a CSS variable on the accent stripe', () => {
    const { container } = render(
      <GroupHeader name="Squad" color="cyan" description={null} memberCount={2} />,
    );
    const stripe = container.querySelector('[data-group-stripe]') as HTMLElement;
    expect(stripe).toBeTruthy();
    expect(stripe.style.background).toContain('var(--color-cyan)');
  });

  it('singularizes when memberCount is 1', () => {
    const { container } = render(
      <GroupHeader name="Solo" color="cyan" description={null} memberCount={1} />,
    );
    expect(container.textContent).toContain('1 member');
    expect(container.textContent).not.toContain('1 members');
  });
});
