import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import StreakPostForm from './StreakPostForm';

const toast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }));

const photo = (name: string, type = 'image/jpeg', size = 100) => {
  const file = new File(['x'], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
};

const choose = (files: File[]) => {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(input, { target: { files } });
};

describe('StreakPostForm', () => {
  it('submits the caption with the photos', async () => {
    const onSubmit = vi.fn().mockResolvedValue(true);
    render(<StreakPostForm onSubmit={onSubmit} onCancel={vi.fn()} />);
    choose([photo('a.jpg')]);
    await screen.findByText(/1 of 5 photos/);
    fireEvent.change(screen.getByLabelText('Caption (optional)'), { target: { value: '  Sunset run  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Post Streak' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ caption: 'Sunset run', duration: 24 });
    expect(onSubmit.mock.calls[0][0].content).toHaveLength(1);
  });

  it('limits the caption to what the API accepts', () => {
    render(<StreakPostForm onSubmit={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByLabelText('Caption (optional)')).toHaveAttribute('maxLength', '300');
  });

  it('refuses more than 5 photos and unsupported files', async () => {
    render(<StreakPostForm onSubmit={vi.fn()} onCancel={vi.fn()} />);
    choose(Array.from({ length: 6 }, (_, i) => photo(`${i}.jpg`)));
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Too many images' }));
    toast.mockClear();
    choose([photo('a.gif', 'image/gif'), photo('big.jpg', 'image/jpeg', 6 * 1024 * 1024)]);
    await waitFor(() => expect(toast).toHaveBeenCalledTimes(2));
    expect(screen.getByRole('button', { name: 'Post Streak' })).toBeDisabled();
  });
});
