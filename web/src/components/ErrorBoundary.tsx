import React from 'react';
import { Button } from '@/components/ui/button';

interface State {
  error: Error | null;
}

/** Shows a recovery screen instead of a blank page when rendering fails. */
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Unhandled UI error', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div role="alert" className="min-h-screen flex items-center justify-center bg-island-dark p-6 text-center">
        <div className="space-y-4 max-w-sm">
          <h1 className="text-xl font-semibold text-white">Something went wrong</h1>
          <p className="text-white/70 text-sm">The page hit an unexpected error. Reloading usually fixes it.</p>
          <Button onClick={() => window.location.reload()}>Reload</Button>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
