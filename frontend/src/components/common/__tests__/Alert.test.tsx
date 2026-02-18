import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import Alert from '../Alert';

describe('Alert', () => {
  it('renders children content', () => {
    render(<Alert>Test message</Alert>);
    expect(screen.getByText('Test message')).toBeInTheDocument();
  });

  it('renders with info type by default', () => {
    render(<Alert>Info alert</Alert>);
    const alertDiv = screen.getByText('Info alert').closest('.rounded-lg');
    expect(alertDiv).toHaveClass('bg-blue-50');
  });

  it('renders with success type', () => {
    render(<Alert type="success">Success message</Alert>);
    const alertDiv = screen.getByText('Success message').closest('.rounded-lg');
    expect(alertDiv).toHaveClass('bg-green-50');
  });

  it('renders with error type', () => {
    render(<Alert type="error">Error message</Alert>);
    const alertDiv = screen.getByText('Error message').closest('.rounded-lg');
    expect(alertDiv).toHaveClass('bg-red-50');
  });

  it('renders with warning type', () => {
    render(<Alert type="warning">Warning message</Alert>);
    const alertDiv = screen.getByText('Warning message').closest('.rounded-lg');
    expect(alertDiv).toHaveClass('bg-yellow-50');
  });

  it('renders close button when onClose is provided', () => {
    const handleClose = jest.fn();
    render(<Alert onClose={handleClose}>Closeable alert</Alert>);
    // The close button has a sr-only "Dismiss" span
    expect(screen.getByText('Dismiss')).toBeInTheDocument();
  });

  it('does not render close button when onClose is not provided', () => {
    render(<Alert>No close button</Alert>);
    expect(screen.queryByText('Dismiss')).not.toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    const handleClose = jest.fn();
    render(<Alert onClose={handleClose}>Alert content</Alert>);
    const dismissBtn = screen.getByText('Dismiss').closest('button')!;
    fireEvent.click(dismissBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('applies custom className', () => {
    render(<Alert className="my-custom-class">Alert</Alert>);
    const alertDiv = screen.getByText('Alert').closest('.rounded-lg');
    expect(alertDiv).toHaveClass('my-custom-class');
  });
});
