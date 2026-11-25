import { Home, SearchX } from 'lucide-react';
import { useTranslation } from '../context/LanguageContext';
import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <main className="flex min-h-[70vh] flex-col items-center justify-center px-4 py-16 text-center">
      <SearchX aria-hidden="true" className="mb-5 h-12 w-12 text-primary" />
      <p className="text-sm font-semibold text-primary">404</p>
      <h1 className="mt-2 text-3xl font-bold text-slate-950 dark:text-white">{t('errors.notFoundTitle')}</h1>
      <p className="mt-3 max-w-md text-muted dark:text-muted-dark">{t('errors.notFoundMessage')}</p>
      <Link to="/" className="mt-6 inline-flex min-h-touch items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-white hover:bg-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950">
        <Home aria-hidden="true" className="h-4 w-4" /> {t('errors.backHome')}
      </Link>
    </main>
  );
}
