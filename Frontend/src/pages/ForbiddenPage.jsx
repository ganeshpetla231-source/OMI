import { Link } from 'react-router-dom';
import { ShieldX } from 'lucide-react';
import { useTranslation } from '../context/LanguageContext';

export default function ForbiddenPage() {
  const { t } = useTranslation();
  return (
    <main className="flex min-h-[70vh] flex-col items-center justify-center px-4 py-12 text-center">
      <ShieldX aria-hidden="true" className="mb-4 h-10 w-10 text-danger" />
      <h1 className="text-2xl font-bold text-slate-950 dark:text-white">{t('errors.forbiddenTitle')}</h1>
      <p className="mt-2 max-w-md text-muted dark:text-muted-dark">{t('errors.forbiddenMessage')}</p>
      <Link to="/" className="mt-6 inline-flex min-h-touch items-center rounded-lg bg-primary px-4 text-sm font-medium text-white hover:bg-primary-dark">{t('errors.backHome')}</Link>
    </main>
  );
}
