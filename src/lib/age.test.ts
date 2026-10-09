import { describe, expect, it } from 'vitest';
import { calculateAge, isOfMinimumAge, MINIMUM_AGE, toDateOnlyString } from './age';

describe('calculateAge', () => {
  const today = new Date(2026, 9, 9); // 9 Oct 2026, local time

  it('counts a birthday that has already happened this year', () => {
    expect(calculateAge(new Date(2000, 0, 15), today)).toBe(26);
  });

  it('does not count a birthday later this year', () => {
    expect(calculateAge(new Date(2000, 11, 1), today)).toBe(25);
  });

  it('does not count a birthday later this month', () => {
    expect(calculateAge(new Date(2000, 9, 10), today)).toBe(25);
  });

  it('counts a birthday that is today', () => {
    expect(calculateAge(new Date(2000, 9, 9), today)).toBe(26);
  });
});

describe('isOfMinimumAge', () => {
  const today = new Date(2026, 9, 9);

  it(`accepts someone turning ${MINIMUM_AGE} today`, () => {
    expect(isOfMinimumAge(new Date(2026 - MINIMUM_AGE, 9, 9), today)).toBe(true);
  });

  it(`rejects someone turning ${MINIMUM_AGE} tomorrow`, () => {
    expect(isOfMinimumAge(new Date(2026 - MINIMUM_AGE, 9, 10), today)).toBe(false);
  });
});

describe('toDateOnlyString', () => {
  it('keeps the local calendar date regardless of UTC offset', () => {
    // Local midnight is the previous day in UTC for any timezone ahead of UTC.
    expect(toDateOnlyString(new Date(2000, 0, 1))).toBe('2000-01-01');
  });
});
