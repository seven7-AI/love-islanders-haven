import type { Me } from '@/lib/api/moderation';

/**
 * Where a signed-in user starts: Discover once onboarded; the moderation queue for staff without a dating profile;
 * otherwise onboarding. If the account cannot be loaded, Discover (whose guard sends unfinished profiles onward).
 */
export const destinationFor = (me: Me | null) => {
  if (!me || me.onboarding_completed) return '/discover';
  return me.roles.includes('moderator') ? '/moderation' : '/onboarding';
};
