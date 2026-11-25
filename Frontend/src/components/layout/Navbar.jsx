import { Link } from 'react-router-dom';
import { useTranslation } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { ROUTES } from '../../config/routes';
import { ThemeToggle } from './ThemeToggle';

export function Navbar() {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  return (
    <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
      <div className="container flex min-h-16 items-center justify-between gap-4">
        <Link to="/" className="rounded-md text-lg font-bold tracking-tight text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          {t('app.name')}
        </Link>
        <nav aria-label="Main navigation" className="flex items-center gap-1">
          <Link to="/" className="hidden min-h-touch items-center rounded-lg px-3 text-sm font-medium text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:text-slate-200 dark:hover:bg-slate-800 sm:inline-flex">
            {t('nav.home')}
          </Link>
          {!isAuthenticated && (
            <>
              <Link to={ROUTES.LOGIN} className="inline-flex min-h-touch items-center rounded-lg px-2 text-sm font-medium text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:text-slate-200 dark:hover:bg-slate-800 sm:px-3">
                {t('nav.signIn')}
              </Link>
              <Link to={ROUTES.REGISTER} className="inline-flex min-h-touch items-center rounded-lg bg-primary px-3 text-sm font-medium text-white hover:bg-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                {t('nav.register')}
              </Link>
            </>
          )}
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
