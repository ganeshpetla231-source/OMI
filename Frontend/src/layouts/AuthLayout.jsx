import { Link } from 'react-router-dom';
import { useTranslation } from '../context/LanguageContext';
import { OfflineBanner } from '../components/layout/OfflineBanner';
import { GuestBanner } from '../components/layout/GuestBanner';
import { ThemeToggle } from '../components/layout/ThemeToggle';

export function AuthLayout({ title, children }) {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-screen flex-col bg-slate-50 dark:bg-slate-950">
      <OfflineBanner />
      <GuestBanner />
      <header className="flex min-h-16 items-center justify-between border-b border-slate-200 bg-white px-4 dark:border-slate-800 dark:bg-slate-950 sm:px-6">
        <Link to="/" className="text-lg font-bold text-primary">{t('app.name')}</Link>
        <ThemeToggle />
      </header>
      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-8">
            {title && <h1 className="mb-5 text-xl font-semibold text-slate-900 dark:text-white">{title}</h1>}
            {children}
          </section>
        </div>
      </main>
    </div>
  );
}
