import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import StreakPost from './StreakPost';

const post = {
  id: 'p1', user_id: 'u1', content: ['https://img/1.jpg'], created_at: new Date().toISOString(),
  streak_count: 2, likes_count: 4, liked_by_me: false, user_name: 'Ava',
};

describe('StreakPost', () => {
  it('shows the server count after liking and unliking', async () => {
    const onLike = vi.fn().mockResolvedValueOnce(5).mockResolvedValueOnce(4);
    render(<StreakPost post={post} onLike={onLike} />);
    fireEvent.click(screen.getByRole('button', { name: 'Like' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Unlike' })).toHaveTextContent('5'));
    fireEvent.click(screen.getByRole('button', { name: 'Unlike' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Like' })).toHaveTextContent('4'));
    expect(onLike.mock.calls).toEqual([[true], [false]]);
  });

  it('keeps the previous state when saving fails', async () => {
    const onLike = vi.fn().mockResolvedValue(null);
    render(<StreakPost post={{ ...post, liked_by_me: true }} onLike={onLike} />);
    fireEvent.click(screen.getByRole('button', { name: 'Unlike' }));
    await waitFor(() => expect(onLike).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: 'Unlike' })).toHaveTextContent('4');
  });
});
