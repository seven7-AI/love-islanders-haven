import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useStreaksActions } from './use-streaks-actions';

const uploadStreakPhoto = vi.fn();
const createStreakPost = vi.fn();
const setStreakLike = vi.fn();
const toast = vi.fn();
vi.mock('@/lib/api/streaks', () => ({
  uploadStreakPhoto: (...a: unknown[]) => uploadStreakPhoto(...a),
  createStreakPost: (...a: unknown[]) => createStreakPost(...a),
  setStreakLike: (...a: unknown[]) => setStreakLike(...a),
}));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }));

const PNG = 'data:image/png;base64,iVBORw0KGgo=';

describe('useStreaksActions', () => {
  beforeEach(() => vi.clearAllMocks());

  it('uploads every photo, then creates the post', async () => {
    uploadStreakPhoto.mockResolvedValueOnce('me/streaks/1.png').mockResolvedValueOnce('me/streaks/2.png');
    createStreakPost.mockResolvedValue({ streak_count: 3 });
    const { result } = renderHook(() => useStreaksActions());
    let ok = false;
    await act(async () => {
      ok = await result.current.handlePostSubmit({ content: [PNG, PNG], duration: 12 });
    });
    expect(ok).toBe(true);
    expect(uploadStreakPhoto).toHaveBeenCalledTimes(2);
    expect(createStreakPost).toHaveBeenCalledWith({
      media_paths: ['me/streaks/1.png', 'me/streaks/2.png'],
      caption: undefined,
      duration_hours: 12,
    });
  });

  it('does not create a post when an upload fails', async () => {
    uploadStreakPhoto.mockRejectedValue(new Error('Upload failed'));
    const { result } = renderHook(() => useStreaksActions());
    let ok = true;
    await act(async () => {
      ok = await result.current.handlePostSubmit({ content: [PNG] });
    });
    expect(ok).toBe(false);
    expect(createStreakPost).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' }));
  });

  it('returns the server like count, or null on failure', async () => {
    setStreakLike.mockResolvedValueOnce({ liked: true, likes_count: 5 }).mockRejectedValueOnce(new Error('404'));
    const { result } = renderHook(() => useStreaksActions());
    await expect(result.current.handleLikePost('p1', true)).resolves.toBe(5);
    await expect(result.current.handleLikePost('p1', true)).resolves.toBeNull();
  });
});
