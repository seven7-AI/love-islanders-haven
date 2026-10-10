import { onboardedUser } from './stack';

let counter = 0;

/**
 * An onboarded user with a unique name (tests run in parallel against one stack). Women look for men and men for
 * women, so a woman and a man can match.
 */
export async function person(firstName: string, sex: 'female' | 'male' = 'female') {
  const name = `${firstName}${Date.now().toString(36)}${counter++}${Math.random().toString(36).slice(2, 6)}`;
  const user = await onboardedUser(firstName.toLowerCase(), {
    name,
    dob: sex === 'female' ? '1995-06-06' : '1993-03-03',
    gender: sex,
    gender_preference: sex === 'female' ? 'male' : 'female',
  });
  return { ...user, name };
}
