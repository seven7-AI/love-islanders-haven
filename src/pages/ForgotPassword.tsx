import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/context/auth';

const ForgotPassword = () => {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await resetPassword(email);
      if (error) {
        setError(error.message || 'Could not send the reset email. Please try again.');
        return;
      }
      setSent(true);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-island-dark via-island to-island-dark p-4">
      <div className="glass-card w-full max-w-md p-6 rounded-xl shadow-lg">
        <h1 className="text-2xl font-bold text-center text-gradient mb-8">Reset Password</h1>

        {sent ? (
          <p role="status" className="text-white text-center">
            If an account exists for {email}, we've sent a link to reset your password. Check your inbox.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6" noValidate>
            <div>
              <label htmlFor="email" className="block text-white text-lg mb-2">
                Email
              </label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@example.com"
                className="bg-island-light/20 border-island-light text-white h-12"
              />
            </div>

            {error && (
              <p role="alert" className="text-red-400 text-sm">
                {error}
              </p>
            )}

            <Button type="submit" className="w-full bg-love hover:bg-love-dark h-12 text-lg" disabled={isLoading}>
              {isLoading ? (
                <span className="flex items-center justify-center">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </span>
              ) : (
                'Send reset link'
              )}
            </Button>
          </form>
        )}

        <div className="text-center mt-6">
          <Link to="/login" className="text-love hover:underline text-sm">
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
