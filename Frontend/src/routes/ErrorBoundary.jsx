import { Component } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { useTranslation } from '../context/LanguageContext';
import { Button } from '../components/ui/Button';

class Boundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

function CrashScreen() {
  const { t } = useTranslation();
  return (
    <main role="alert" className="flex min-h-screen flex-col items-center justify-center px-4 py-12 text-center">
      <AlertTriangle aria-hidden="true" className="mb-4 h-10 w-10 text-danger" />
      <h1 className="text-2xl font-bold text-slate-950 dark:text-white">{t('errors.crashTitle')}</h1>
      <p className="mt-2 max-w-md text-muted dark:text-muted-dark">{t('errors.crashMessage')}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Button onClick={() => window.location.reload()}>{t('errors.reload')}</Button>
        <Link to="/" className="inline-flex min-h-touch items-center rounded-lg border border-slate-300 px-4 text-sm font-medium hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800">{t('errors.backHome')}</Link>
      </div>
    </main>
  );
}

export function ErrorBoundary({ children }) {
  return <Boundary fallback={<CrashScreen />}>{children}</Boundary>;
}
