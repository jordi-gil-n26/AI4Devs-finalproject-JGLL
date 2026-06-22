import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { Button } from './Button';

describe('Button', () => {
  it('renders children and defaults to the primary (terracotta) variant', () => {
    render(<Button>Reserve</Button>);
    const el = screen.getByRole('button', { name: 'Reserve' });
    expect(el.className).toContain('bg-terracotta');
  });

  it('renders the ghost variant with uppercase terracotta text', () => {
    render(<Button variant="ghost">View details</Button>);
    const el = screen.getByRole('button', { name: 'View details' });
    expect(el.className).toContain('text-terracotta');
    expect(el.className).toContain('uppercase');
    expect(el.className).not.toContain('bg-terracotta');
  });

  it('forwards onClick and type', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<Button type="submit" onClick={onClick}>Go</Button>);
    const el = screen.getByRole('button', { name: 'Go' });
    expect(el).toHaveAttribute('type', 'submit');
    await user.click(el);
    expect(onClick).toHaveBeenCalledOnce();
  });
});
