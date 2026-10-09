import { createContext, useContext, useState, useEffect } from 'react';
import { AuthChangeEvent, Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isAuthenticated: boolean;
  loading: boolean;
  networkError: boolean;
  signIn: (email: string, password: string) => Promise<{
    error?: Error;
  }>;
  signOut: () => Promise<void>;
  /** True after the user opened a password recovery link, until the password is updated. */
  passwordRecovery: boolean;
  resetPassword: (email: string) => Promise<{ error?: Error }>;
  updatePassword: (password: string) => Promise<{ error?: Error }>;
  signInWithGoogle: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Captured at load time: supabase-js removes the hash once it has exchanged it for a session, and its
// PASSWORD_RECOVERY event can fire before the provider subscribes.
const openedFromRecoveryLink =
  typeof window !== 'undefined' && new URLSearchParams(window.location.hash.slice(1)).get('type') === 'recovery';

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [networkError, setNetworkError] = useState(false);
  const [passwordRecovery, setPasswordRecovery] = useState(openedFromRecoveryLink);

  useEffect(() => {
    const getSession = async () => {
      try {
        setLoading(true);
        const { data: { session } } = await supabase.auth.getSession();

        setUser(session?.user ?? null);
        setSession(session ?? null);
        setIsAuthenticated(!!session);
      } catch (error) {
        console.error("Network error:", error);
        setNetworkError(true);
      } finally {
        setLoading(false);
      }
    };

    getSession();

    // Subscribe to auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, session: Session | null) => {
        setUser(session?.user ?? null);
        setSession(session ?? null);
        setIsAuthenticated(!!session);
        setLoading(false);

        if (event === 'PASSWORD_RECOVERY') {
          setPasswordRecovery(true);
        } else if (event === 'SIGNED_OUT') {
          setPasswordRecovery(false);
        }
      }
    );

    // Unsubscribe from the subscription when the component unmounts
    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { error };
      }

      return {};
    } catch (error: any) {
      console.error('Sign-in error:', error);
      return { error };
    } finally {
      setLoading(false);
    }
  };

  const signInWithGoogle = async () => {
    setLoading(true);
    try {
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
    } finally {
      setLoading(false);
    }
  };

  // Supabase sends the recovery email and does not reveal whether the account exists.
  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return error ? { error } : {};
  };

  // Only valid inside the session created by the recovery link.
  const updatePassword = async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      return { error };
    }
    setPasswordRecovery(false);
    return {};
  };

  const signOut = async () => {
    setLoading(true);
    try {
      await supabase.auth.signOut();
      // Remove flags written by earlier versions of the app; they no longer affect anything.
      for (const key of ['emailVerificationCompleted', 'isAuthenticated', 'authMethod', 'authContact', 'verificationCode']) {
        localStorage.removeItem(key);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isAuthenticated,
        loading,
        networkError,
        signIn,
        signOut,
        passwordRecovery,
        resetPassword,
        updatePassword,
        signInWithGoogle
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
