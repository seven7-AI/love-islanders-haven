import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

interface EmailConfirmationNoticeProps {
  email: string;
}

/**
 * Tells the user to confirm their email address and lets them request another confirmation email.
 * Confirmation itself happens through the link in that email (Supabase Auth); the app never decides it.
 */
const EmailConfirmationNotice = ({ email }: EmailConfirmationNoticeProps) => {
  const [isSending, setIsSending] = useState(false);
  const [status, setStatus] = useState<{ kind: 'sent' | 'error'; message: string } | null>(null);

  const handleResend = async () => {
    setIsSending(true);
    setStatus(null);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) {
        setStatus({ kind: 'error', message: error.message || 'Could not resend the email. Please try again.' });
      } else {
        setStatus({ kind: 'sent', message: `We've sent a new confirmation link to ${email}.` });
      }
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-4 text-center">
      <p className="text-white">
        We sent a confirmation link to <span className="font-semibold">{email}</span>. Open it to confirm your email
        address.
      </p>
      {status && (
        <p
          role={status.kind === 'error' ? 'alert' : 'status'}
          className={status.kind === 'error' ? 'text-red-400 text-sm' : 'text-green-400 text-sm'}
        >
          {status.message}
        </p>
      )}
      <Button onClick={handleResend} disabled={isSending} variant="outline" className="w-full">
        {isSending ? (
          <span className="flex items-center justify-center">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Sending...
          </span>
        ) : (
          'Resend confirmation email'
        )}
      </Button>
    </div>
  );
};

export default EmailConfirmationNotice;
