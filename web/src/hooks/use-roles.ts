import { useEffect, useState } from 'react';
import { useAuth } from '@/context/auth';
import { getMe } from '@/lib/api/moderation';

// One /v1/me request per signed-in user, shared by the navigation and the pages that check roles.
let cached: { userId: string; roles: Promise<string[]> } | null = null;

const rolesFor = (userId: string) => {
  if (cached?.userId !== userId) {
    const roles = getMe().then((me) => me.roles);
    // A failed lookup is retried next time instead of being remembered.
    roles.catch(() => {
      if (cached?.roles === roles) cached = null;
    });
    cached = { userId, roles };
  }
  return cached.roles;
};

/** For tests. */
export const resetRolesCache = () => {
  cached = null;
};

/**
 * The signed-in user's roles. Only for showing or hiding moderator UI: the API enforces every permission itself.
 * `error` is set when the roles could not be loaded (then `roles` is empty).
 */
export const useRoles = () => {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [state, setState] = useState<{ roles: string[]; loading: boolean; error: string | null }>({
    roles: [],
    loading: Boolean(userId),
    error: null,
  });

  useEffect(() => {
    if (!userId) {
      setState({ roles: [], loading: false, error: null });
      return;
    }
    let cancelled = false;
    setState((s) => ({ ...s, loading: true }));
    rolesFor(userId)
      .then((roles) => !cancelled && setState({ roles, loading: false, error: null }))
      .catch(
        (err) =>
          !cancelled &&
          setState({ roles: [], loading: false, error: err instanceof Error ? err.message : 'Could not load roles' }),
      );
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return { ...state, isModerator: state.roles.includes('moderator') };
};
