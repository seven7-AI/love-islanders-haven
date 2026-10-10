import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { OnboardingPersonality } from './OnboardingPersonality';

describe('OnboardingPersonality', () => {
  it('submits a relationship goal value the API accepts', async () => {
    const onNext = vi.fn();
    render(<OnboardingPersonality initialData={{}} onNext={onNext} onBack={vi.fn()} isSubmitting={false} />);
    fireEvent.change(screen.getByPlaceholderText(/What makes you unique/), {
      target: { value: 'I love long walks and terrible puns.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Something casual/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(onNext).toHaveBeenCalled());
    expect(onNext.mock.calls[0][0].relationship_goal).toBe('casual');
  });
});
