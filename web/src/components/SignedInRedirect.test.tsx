import { describe, expect, it } from 'vitest';
import { destinationFor } from './SignedInRedirect';

const me = (onboarding_completed: boolean, roles: string[] = []) => ({
  id: 'u',
  email: null,
  name: null,
  email_verified: true,
  onboarding_completed,
  roles,
});

describe('destinationFor', () => {
  it('sends onboarded users to Discover, moderators included', () => {
    expect(destinationFor(me(true))).toBe('/discover');
    expect(destinationFor(me(true, ['moderator']))).toBe('/discover');
  });

  it('sends staff without a dating profile to the moderation queue', () => {
    expect(destinationFor(me(false, ['moderator']))).toBe('/moderation');
  });

  it('sends everyone else to onboarding', () => {
    expect(destinationFor(me(false))).toBe('/onboarding');
  });

  it('falls back to Discover when the account could not be loaded', () => {
    expect(destinationFor(null)).toBe('/discover');
  });
});
