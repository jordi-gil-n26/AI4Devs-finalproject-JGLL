import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Footer } from './Footer';

describe('Footer', () => {
  it('renders the STAYHUB wordmark and tagline', () => {
    render(<Footer />);
    expect(screen.getByText('STAYHUB')).toBeInTheDocument();
    expect(screen.getByText(/curated hospitality/i)).toBeInTheDocument();
  });

  it('renders Company and Legal link groups', () => {
    render(<Footer />);
    expect(screen.getByText('Company')).toBeInTheDocument();
    expect(screen.getByText('Legal')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Privacy Policy' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Contact' })).toBeInTheDocument();
  });

  it('renders a copyright line', () => {
    render(<Footer />);
    expect(screen.getByText(/StayHub/)).toBeInTheDocument();
    expect(screen.getByText(/rights reserved/i)).toBeInTheDocument();
  });
});
