import { useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/context/auth';
import EmailConfirmationNotice from '@/components/auth/EmailConfirmationNotice';

const Verify = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const email = user?.email || searchParams.get('email') || '';

  useEffect(() => {
    if (user?.email_confirmed_at) {
      navigate('/discover', { replace: true });
    }
  }, [user, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-island-dark via-island to-island-dark p-4">
      <div className="glass-card w-full max-w-md p-6 rounded-xl shadow-lg space-y-6">
        <h1 className="text-2xl font-bold text-center text-gradient">Confirm your email</h1>
        {email ? (
          <EmailConfirmationNotice email={email} />
        ) : (
          <p className="text-white text-center">
            Check your inbox for the confirmation link we sent when you signed up.
          </p>
        )}
        <div className="text-center">
          <Link to="/login" className="text-love hover:underline text-sm">
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Verify;
