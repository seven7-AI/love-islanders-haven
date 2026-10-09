import { format } from 'date-fns';

export const MINIMUM_AGE = 18;

/** Whole years between `birthdate` and `today`, counting a birthday only once it has been reached. */
export function calculateAge(birthdate: Date, today: Date = new Date()): number {
  let age = today.getFullYear() - birthdate.getFullYear();
  const m = today.getMonth() - birthdate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthdate.getDate())) {
    age--;
  }
  return age;
}

export function isOfMinimumAge(birthdate: Date, today: Date = new Date()): boolean {
  return calculateAge(birthdate, today) >= MINIMUM_AGE;
}

/** Calendar date as `yyyy-MM-dd` in local time (`toISOString` would shift it to UTC and can change the day). */
export function toDateOnlyString(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}
