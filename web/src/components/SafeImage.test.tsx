import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import SafeImage from './SafeImage';

describe('SafeImage', () => {
  it('loads lazily by default', () => {
    render(<SafeImage src="https://img/a.jpg" alt="Amani" />);
    expect(screen.getByRole('img', { name: 'Amani' })).toHaveAttribute('loading', 'lazy');
  });

  it('shows a same-size placeholder instead of a broken image', () => {
    render(<SafeImage src="https://img/a.jpg" alt="Amani" className="h-10 w-10" />);
    fireEvent.error(screen.getByRole('img', { name: 'Amani' }));
    const placeholder = screen.getByRole('img', { name: 'Amani (unavailable)' });
    expect(placeholder.tagName).toBe('DIV');
    expect(placeholder).toHaveClass('h-10', 'w-10');
  });

  it('shows the placeholder when there is no source', () => {
    render(<SafeImage src={null} alt="Amani" />);
    expect(screen.getByRole('img', { name: 'Amani (unavailable)' })).toBeInTheDocument();
  });

  it('asks once for a fresh source when an expiring one fails', async () => {
    const onExpired = vi.fn().mockResolvedValue('https://img/fresh.jpg');
    render(<SafeImage src="https://img/old.jpg" alt="Photo" onExpired={onExpired} />);
    fireEvent.error(screen.getByRole('img', { name: 'Photo' }));
    await waitFor(() =>
      expect(screen.getByRole('img', { name: 'Photo' })).toHaveAttribute('src', 'https://img/fresh.jpg'),
    );
    fireEvent.error(screen.getByRole('img', { name: 'Photo' }));
    await screen.findByRole('img', { name: 'Photo (unavailable)' });
    expect(onExpired).toHaveBeenCalledTimes(1);
  });

  it('falls back when no fresh source is available', async () => {
    render(<SafeImage src="https://img/old.jpg" alt="Photo" onExpired={vi.fn().mockRejectedValue(new Error('404'))} />);
    fireEvent.error(screen.getByRole('img', { name: 'Photo' }));
    expect(await screen.findByRole('img', { name: 'Photo (unavailable)' })).toBeInTheDocument();
  });

  it('starts over when the source changes', () => {
    const { rerender } = render(<SafeImage src="https://img/a.jpg" alt="Photo" />);
    fireEvent.error(screen.getByRole('img', { name: 'Photo' }));
    rerender(<SafeImage src="https://img/b.jpg" alt="Photo" />);
    expect(screen.getByRole('img', { name: 'Photo' })).toHaveAttribute('src', 'https://img/b.jpg');
  });
});
