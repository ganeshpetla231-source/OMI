import { Outlet } from 'react-router-dom';
import { useTranslation } from '../context/LanguageContext';
import { Navbar } from '../components/layout/Navbar';
import { OfflineBanner } from '../components/layout/OfflineBanner';
import { GuestBanner } from '../components/layout/GuestBanner';

export function PublicLayout({ children }) {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <OfflineBanner />
      <GuestBanner />
      <Navbar />
      <main className="flex-1">{children || <Outlet />}</main>
      <footer className="border-t border-slate-200 bg-white py-5 text-center text-sm text-muted dark:border-slate-800 dark:bg-slate-950 dark:text-muted-dark">
        <p>{t('layout.footer')}</p>
      </footer>
    </div>
  );
}
