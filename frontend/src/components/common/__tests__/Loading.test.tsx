import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import Loading from '../Loading';

describe('Loading', () => {
  it('renders a spinner SVG', () => {
    const { container } = render(<Loading />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('renders with md size by default (h-12 w-12)', () => {
    const { container } = render(<Loading />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveClass('h-12', 'w-12');
  });

  it('renders with sm size', () => {
    const { container } = render(<Loading size="sm" />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveClass('h-6', 'w-6');
  });

  it('renders with lg size', () => {
    const { container } = render(<Loading size="lg" />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveClass('h-16', 'w-16');
  });

  it('renders text when provided', () => {
    render(<Loading text="Please wait..." />);
    expect(screen.getByText('Please wait...')).toBeInTheDocument();
  });

  it('does not render text when not provided', () => {
    render(<Loading />);
    expect(screen.queryByRole('paragraph')).not.toBeInTheDocument();
  });

  it('renders in fullscreen mode when fullScreen is true', () => {
    const { container } = render(<Loading fullScreen />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass('fixed', 'inset-0');
  });

  it('does not render fullscreen wrapper by default', () => {
    const { container } = render(<Loading />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).not.toHaveClass('fixed');
  });
});
