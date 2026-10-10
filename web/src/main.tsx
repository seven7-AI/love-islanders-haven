import { createRoot } from 'react-dom/client';
import { BrowserRouter as Router } from 'react-router-dom';
import App from './App.tsx';
import AppProviders from './AppProviders';
import ErrorBoundary from './components/ErrorBoundary';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <Router>
      <AppProviders>
        <App />
      </AppProviders>
    </Router>
  </ErrorBoundary>,
);
