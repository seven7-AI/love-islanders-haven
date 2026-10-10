import React, { useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/auth';

import Login from '@/pages/Login';
import Profile from '@/pages/Profile';
import Discover from '@/pages/Discover';
import Verify from '@/pages/Verify';
import Settings from '@/pages/Settings';
import Feedback from '@/pages/Feedback';
import Safety from '@/pages/Safety';
import Support from '@/pages/Support';
import Terms from '@/pages/Terms';
import Privacy from '@/pages/Privacy';
import Signup from '@/pages/Signup';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import AuthCallback from '@/pages/AuthCallback';
import CalendarCallback from '@/pages/CalendarCallback';
import NotFound from '@/pages/NotFound';
import { Toaster as ToastContainer } from 'sonner';
import { Toaster } from '@/components/ui/toaster';
import AppNavigation from '@/components/AppNavigation';
import useOnline from '@/hooks/useOnline';
import OfflinePlaceholder from '@/components/OfflinePlaceholder';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import Streaks from '@/pages/Streaks';
import Matches from '@/pages/Matches';
import Moderation from '@/pages/Moderation';
import Onboarding from './pages/Onboarding';
import AICompanion from '@/components/companion/AICompanion';
import OnboardingGuard from '@/components/OnboardingGuard';
import SignedInRedirect from '@/components/SignedInRedirect';

/**
 * Signed-in pages. Declared at module level: a component declared inside App would be a new type on every App render,
 * and React would remount the whole page each time (losing its state and reloading its data).
 */
const PrivateRoute = ({
  children,
  guardOnboarding = true,
}: {
  children: React.ReactNode;
  guardOnboarding?: boolean;
}) => {
  const { isAuthenticated, loading, user } = useAuth();
  const hasAuthenticatedUser = !!user?.id || isAuthenticated;

  if (loading && !hasAuthenticatedUser) {
    return (
      <div className="flex h-screen items-center justify-center bg-island-dark">
        <Loader2 className="h-12 w-12 animate-spin text-love" />
      </div>
    );
  }

  if (!hasAuthenticatedUser) {
    return <Navigate to="/login" replace />;
  }

  return guardOnboarding ? <OnboardingGuard>{children}</OnboardingGuard> : <>{children}</>;
};

function App() {
  const { isAuthenticated, loading, user } = useAuth();
  const online = useOnline();
  const location = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    if (!online) {
      toast({
        title: 'No internet connection',
        description: 'Some features may be unavailable',
        duration: 5000,
      });
    }
  }, [online, toast]);

  return (
    <>
      {online ? (
        <>
          <Routes>
            <Route path="/login" element={isAuthenticated && user ? <SignedInRedirect /> : <Login />} />
            <Route path="/signup" element={isAuthenticated && user ? <SignedInRedirect /> : <Signup />} />
            <Route path="/verify" element={<Verify />} />
            <Route
              path="/forgot-password"
              element={isAuthenticated && user ? <SignedInRedirect /> : <ForgotPassword />}
            />
            {/* Not redirected when signed in: the recovery link itself creates the session. */}
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route
              path="/calendar/callback"
              element={
                <PrivateRoute guardOnboarding={false}>
                  <CalendarCallback />
                </PrivateRoute>
              }
            />

            <Route
              path="/onboarding"
              element={
                <PrivateRoute guardOnboarding={false}>
                  <Onboarding />
                </PrivateRoute>
              }
            />

            <Route
              path="/profile"
              element={
                <PrivateRoute>
                  <Profile />
                </PrivateRoute>
              }
            />
            <Route
              path="/discover"
              element={
                <PrivateRoute>
                  <Discover />
                </PrivateRoute>
              }
            />
            <Route
              path="/matches"
              element={
                <PrivateRoute>
                  <Matches />
                </PrivateRoute>
              }
            />
            <Route
              path="/ai-companion"
              element={
                <PrivateRoute>
                  <div className="min-h-screen bg-gradient-to-b from-neutral-950 via-neutral-900 to-neutral-950 pb-20">
                    <AICompanion />
                  </div>
                </PrivateRoute>
              }
            />
            <Route
              path="/streaks"
              element={
                <PrivateRoute>
                  <Streaks />
                </PrivateRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <PrivateRoute>
                  <Settings />
                </PrivateRoute>
              }
            />
            <Route
              path="/feedback"
              element={
                <PrivateRoute>
                  <Feedback />
                </PrivateRoute>
              }
            />
            <Route
              path="/safety"
              element={
                <PrivateRoute>
                  <Safety />
                </PrivateRoute>
              }
            />
            <Route
              path="/support"
              element={
                <PrivateRoute>
                  <Support />
                </PrivateRoute>
              }
            />
            {/* Staff may have no dating profile, so onboarding is not required; the page checks the role. */}
            <Route
              path="/moderation"
              element={
                <PrivateRoute guardOnboarding={false}>
                  <Moderation />
                </PrivateRoute>
              }
            />
            <Route path="/terms" element={<Terms />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route
              path="/"
              element={isAuthenticated && user ? <SignedInRedirect /> : <Navigate to="/login" replace />}
            />
            <Route path="*" element={<NotFound />} />
          </Routes>

          {/* No navigation on auth and onboarding routes */}
          {isAuthenticated &&
            user &&
            ![
              '/onboarding',
              '/login',
              '/signup',
              '/verify',
              '/forgot-password',
              '/reset-password',
              '/auth/callback',
            ].includes(location.pathname) && <AppNavigation />}

          <ToastContainer />
        </>
      ) : (
        <OfflinePlaceholder />
      )}
      {/* Messages from useToast(); sonner's toast() uses ToastContainer above. Both are in use across the app. */}
      <Toaster />
    </>
  );
}

export default App;
