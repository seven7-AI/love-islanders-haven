import { useState } from 'react';
import { useAuth } from '@/context/auth';

/** Whether to remind the signed-in user to confirm their email. Confirmation state comes from Supabase Auth. */
export function useEmailVerification() {
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState(false);

  const needsConfirmation = !!user && !user.email_confirmed_at;

  return {
    showVerificationPopup: needsConfirmation && !dismissed,
    email: user?.email ?? '',
    handleVerificationComplete: () => setDismissed(true),
  };
}
