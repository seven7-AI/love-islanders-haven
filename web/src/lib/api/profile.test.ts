import { describe, expect, it } from 'vitest';
import { toProfileUpdate } from './profile';

describe('toProfileUpdate', () => {
  it('keeps editable fields and maps camelCase aliases', () => {
    expect(toProfileUpdate({ name: 'Ava', showAge: false, heightCm: 170, genderPreference: 'male' })).toEqual({
      name: 'Ava',
      show_age: false,
      height_cm: 170,
      gender_preference: 'male',
    });
  });

  it('drops server-managed and unknown fields', () => {
    expect(
      toProfileUpdate({ verified: true, email_verified: true, streak_count: 5, age: 30, id: 'x', images: [] }),
    ).toEqual({});
  });

  it('prefers the snake_case value when both spellings are present', () => {
    expect(toProfileUpdate({ show_age: true, showAge: false })).toEqual({ show_age: true });
    expect(toProfileUpdate({ showAge: false, show_age: true })).toEqual({ show_age: true });
  });

  it('turns empty strings into null so fields can be cleared', () => {
    expect(toProfileUpdate({ bio: '' })).toEqual({ bio: null });
  });
});
