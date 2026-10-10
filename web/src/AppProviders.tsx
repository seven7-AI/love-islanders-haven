import { ReactNode } from 'react';
import { AuthProvider } from '@/context/auth';
import { SettingsProvider } from '@/context/SettingsContext';

/** Application-wide context providers. Used by main.tsx and by tests that render the real route tree. */
const AppProviders = ({ children }: { children: ReactNode }) => (
  <AuthProvider>
    <SettingsProvider>{children}</SettingsProvider>
  </AuthProvider>
);

export default AppProviders;
