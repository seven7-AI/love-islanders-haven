import { useState } from 'react';
import { Loader2, User } from 'lucide-react';
import SettingsSection from './SettingsSection';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/auth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const AccountSettings = () => {
  const { user } = useAuth();
  const currentEmail = user?.email ?? '';
  const [newEmail, setNewEmail] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);

  const trimmed = newEmail.trim();
  const canSubmit = trimmed.length > 0 && trimmed.toLowerCase() !== currentEmail.toLowerCase() && !isSaving;

  const handleChangeEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setIsSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ email: trimmed });
      if (error) {
        toast.error(error.message || 'Could not change your email address');
        return;
      }
      setPendingEmail(trimmed);
      setNewEmail('');
      toast.success(`Check ${trimmed} and open the confirmation link to finish changing your email.`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SettingsSection title="Account Settings" icon={<User size={20} />}>
      <div className="space-y-4">
        <h4 className="text-sm font-medium text-love">Email Address</h4>
        <div>
          <Label htmlFor="current-email" className="text-xs text-muted-foreground">Current email</Label>
          <Input
            id="current-email"
            type="email"
            value={currentEmail}
            readOnly
            className="bg-island-light/20 border-island-light"
          />
        </div>
        <form onSubmit={handleChangeEmail} className="space-y-2">
          <Label htmlFor="new-email" className="text-xs text-muted-foreground">New email</Label>
          <Input
            id="new-email"
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="you@example.com"
            className="bg-island-light/20 border-island-light"
            disabled={isSaving}
          />
          <Button type="submit" variant="outline" className="w-full" disabled={!canSubmit}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Change email
          </Button>
          {pendingEmail && (
            <p className="text-xs text-muted-foreground" role="status">
              We sent a confirmation link to {pendingEmail}. Your email changes once you open it.
            </p>
          )}
        </form>
      </div>
    </SettingsSection>
  );
};

export default AccountSettings;
