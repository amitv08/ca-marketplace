import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import Modal from '../Modal';

describe('Modal', () => {
  it('does not render when isOpen is false', () => {
    render(
      <Modal isOpen={false} onClose={jest.fn()}>
        Modal content
      </Modal>
    );
    expect(screen.queryByText('Modal content')).not.toBeInTheDocument();
  });

  it('renders when isOpen is true', () => {
    render(
      <Modal isOpen={true} onClose={jest.fn()}>
        Modal content
      </Modal>
    );
    expect(screen.getByText('Modal content')).toBeInTheDocument();
  });

  it('renders title when provided', () => {
    render(
      <Modal isOpen={true} onClose={jest.fn()} title="Test Title">
        Content
      </Modal>
    );
    expect(screen.getByText('Test Title')).toBeInTheDocument();
  });

  it('does not render title when not provided', () => {
    render(
      <Modal isOpen={true} onClose={jest.fn()}>
        Content
      </Modal>
    );
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  });

  it('calls onClose when overlay is clicked', () => {
    const handleClose = jest.fn();
    const { container } = render(
      <Modal isOpen={true} onClose={handleClose}>
        Content
      </Modal>
    );
    // The overlay div (bg-gray-500 bg-opacity-75)
    const overlay = container.querySelector('.fixed.inset-0.transition-opacity') as HTMLElement;
    fireEvent.click(overlay);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Escape key is pressed', () => {
    const handleClose = jest.fn();
    render(
      <Modal isOpen={true} onClose={handleClose}>
        Content
      </Modal>
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('removes event listener when closed', () => {
    const handleClose = jest.fn();
    const { rerender } = render(
      <Modal isOpen={true} onClose={handleClose}>
        Content
      </Modal>
    );
    rerender(
      <Modal isOpen={false} onClose={handleClose}>
        Content
      </Modal>
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(handleClose).not.toHaveBeenCalled();
  });

  it('applies max-w-lg for default md size', () => {
    const { container } = render(
      <Modal isOpen={true} onClose={jest.fn()}>
        Content
      </Modal>
    );
    const modalBox = container.querySelector('.inline-block');
    expect(modalBox).toHaveClass('max-w-lg');
  });

  it('applies max-w-2xl for lg size', () => {
    const { container } = render(
      <Modal isOpen={true} onClose={jest.fn()} size="lg">
        Content
      </Modal>
    );
    const modalBox = container.querySelector('.inline-block');
    expect(modalBox).toHaveClass('max-w-2xl');
  });
});
