import { useState } from 'react';
import { KeyRound, Loader2 } from 'lucide-react';
import SettingsSection from './SettingsSection';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useAuth } from '@/context/auth';

const SecuritySettings = () => {
  const { user, resetPassword } = useAuth();
  const [isSending, setIsSending] = useState(false);

  const handleChangePassword = async () => {
    if (!user?.email) {
      toast.error('Your account has no email address to send a reset link to.');
      return;
    }
    setIsSending(true);
    try {
      const { error } = await resetPassword(user.email);
      if (error) {
        toast.error(error.message || 'Could not send the password reset email');
      } else {
        toast.success(`We sent a password reset link to ${user.email}`);
      }
    } finally {
      setIsSending(false);
    }
  };

  return (
    <SettingsSection title="Security Settings" icon={<KeyRound size={20} />}>
      <div className="space-y-6">
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-love">Password</h4>
          <p className="text-xs text-muted-foreground">We'll email you a link to choose a new password.</p>
          <Button variant="outline" className="w-full" onClick={handleChangePassword} disabled={isSending}>
            {isSending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Change password
          </Button>
        </div>

        <div className="space-y-2 pt-4 border-t border-island-light/30">
          <h4 className="text-sm font-medium text-love">Login Security</h4>
          <p className="text-xs text-muted-foreground">Two-factor authentication isn't available yet.</p>
          <p className="text-xs text-muted-foreground">Biometric login isn't available yet.</p>
          <p className="text-xs text-muted-foreground">Login notifications aren't available yet.</p>
        </div>
      </div>
    </SettingsSection>
  );
};

export default SecuritySettings;
