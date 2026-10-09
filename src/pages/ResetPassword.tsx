import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/context/auth';
import { newPasswordSchema } from '@/components/auth/authSchema';

const ResetPassword = () => {
  const { session, loading, passwordRecovery, updatePassword } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const parsed = newPasswordSchema.safeParse({ password, confirmPassword });
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await updatePassword(password);
      if (error) {
        setError(error.message || 'Could not update your password. Please try again.');
        return;
      }
      toast.success('Your password has been updated.');
      navigate('/discover', { replace: true });
    } finally {
      setIsSaving(false);
    }
  };

  let content: React.ReactNode;
  if (loading) {
    content = (
      <div className="flex justify-center" aria-label="Loading">
        <Loader2 className="h-8 w-8 animate-spin text-love" />
      </div>
    );
  } else if (!session || !passwordRecovery) {
    content = (
      <p role="alert" className="text-white text-center">
        This password reset link is invalid or has expired.{' '}
        <Link to="/forgot-password" className="text-love hover:underline">Request a new link</Link>.
      </p>
    );
  } else {
    content = (
      <form onSubmit={handleSubmit} className="space-y-6" noValidate>
        <div>
          <label htmlFor="password" className="block text-white text-lg mb-2">New password</label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="bg-island-light/20 border-island-light text-white h-12"
          />
        </div>
        <div>
          <label htmlFor="confirmPassword" className="block text-white text-lg mb-2">Confirm new password</label>
          <Input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="bg-island-light/20 border-island-light text-white h-12"
          />
        </div>

        {error && <p role="alert" className="text-red-400 text-sm">{error}</p>}

        <Button type="submit" className="w-full bg-love hover:bg-love-dark h-12 text-lg" disabled={isSaving}>
          {isSaving ? (
            <span className="flex items-center justify-center">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </span>
          ) : 'Update password'}
        </Button>
      </form>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-island-dark via-island to-island-dark p-4">
      <div className="glass-card w-full max-w-md p-6 rounded-xl shadow-lg">
        <h1 className="text-2xl font-bold text-center text-gradient mb-8">Choose a New Password</h1>
        {content}
      </div>
    </div>
  );
};

export default ResetPassword;
