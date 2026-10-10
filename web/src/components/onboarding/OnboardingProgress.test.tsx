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

  it('aligns the step columns at the top so the circles stay level', () => {
    const { container } = render(<OnboardingProgress currentStep="photos" steps={['basics', 'photos']} />);
    expect(container.querySelector('.flex.justify-between')).toHaveClass('items-start');
  });
});
