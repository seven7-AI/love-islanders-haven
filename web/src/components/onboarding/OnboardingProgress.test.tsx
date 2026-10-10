import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OnboardingProgress } from './OnboardingProgress';

describe('OnboardingProgress', () => {
  it('labels only the current step on phones', () => {
    render(<OnboardingProgress currentStep="photos" steps={['basics', 'photos', 'interests']} />);
    expect(screen.getByText('Photos')).not.toHaveClass('hidden');
    expect(screen.getByText('Basics')).toHaveClass('hidden', 'sm:block');
    expect(screen.getByText('Interests')).toHaveClass('hidden', 'sm:block');
  });
});
