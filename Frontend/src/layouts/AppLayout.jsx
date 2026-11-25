import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { ROUTES } from '../config/routes';
import { useTranslation } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { useOffline } from '../hooks/useOffline';
import { Button } from '../components/ui/Button';
import { ThemeToggle } from '../components/layout/ThemeToggle';
import { OfflineBanner } from '../components/layout/OfflineBanner';
import { GuestBanner } from '../components/layout/GuestBanner';
import { ChangePasswordModal } from '../components/auth/ChangePasswordModal';
import { UserRole } from '../config/constants';

export function AppLayout({ children }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const menuButtonRef = useRef(null);
  const drawerRef = useRef(null);
  const { isOnline, isServerReachable, pendingCount } = useOffline();
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const links = [
    { to: ROUTES.DASHBOARD, label: t('layout.dashboard') },
    { to: ROUTES.PRACTICE, label: t('nav.practice') },
    { to: ROUTES.QUESTION_BANK, label: t('nav.questions') },
    { to: ROUTES.NOTES, label: t('nav.notes') },
    { to: ROUTES.RESUME, label: t('nav.resume') },
    { to: ROUTES.REPORTS, label: t('layout.reports') },
    { to: ROUTES.PROFILE, label: t('nav.profile') },
    { to: ROUTES.SETTINGS, label: t('layout.settings') },
  ];
  const isAdmin = user?.role === UserRole.ADMIN;
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);

  useEffect(() => {
    if (!drawerOpen) return undefined;
    const drawer = drawerRef.current;
    const getFocusable = () => [...drawer.querySelectorAll('a[href], button:not([disabled])')];
    getFocusable()[0]?.focus();
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setDrawerOpen(false);
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = getFocusable();
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      menuButtonRef.current?.focus();
    };
  }, [drawerOpen]);

  const navigation = (
    <nav aria-label="Application navigation" className="flex flex-col gap-1">
      {links.map((link) => (
        <Link key={link.to} to={link.to} onClick={() => setDrawerOpen(false)} className="flex min-h-touch items-center rounded-lg px-3 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800">
          {link.label}
        </Link>
      ))}
      {isAdmin && (
        <div className="mt-4 border-t border-slate-200 pt-3 dark:border-slate-700">
          <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-muted">{t('admin.sectionTitle')}</p>
          <Link to={ROUTES.ADMIN} onClick={() => setDrawerOpen(false)} className="flex min-h-touch items-center rounded-lg px-3 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800">{t('admin.dashboardTitle')}</Link>
          <Link to={ROUTES.ADMIN_QUESTIONS} onClick={() => setDrawerOpen(false)} className="flex min-h-touch items-center rounded-lg px-3 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800">{t('admin.questionsTitle')}</Link>
        </div>
      )}
    </nav>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div data-print-hide><OfflineBanner /></div>
      <div data-print-hide><GuestBanner /></div>
      <header data-print-hide className="sticky top-0 z-30 flex min-h-16 items-center justify-between border-b border-slate-200 bg-white px-4 dark:border-slate-800 dark:bg-slate-950 lg:pl-72">
        <div className="flex items-center gap-2">
          <Button ref={menuButtonRef} variant="ghost" size="icon" className="lg:hidden" aria-label={t('layout.menu')} aria-expanded={drawerOpen} aria-controls="mobile-navigation" onClick={() => setDrawerOpen(true)}>
            <Menu aria-hidden="true" className="h-5 w-5" />
          </Button>
          <span className="font-semibold lg:hidden">{t('app.name')}</span>
          <span className="hidden items-center gap-2 text-sm text-muted dark:text-muted-dark sm:inline-flex">
            <span className={`h-2 w-2 rounded-full ${isOnline && isServerReachable ? 'bg-success' : 'bg-warning'}`} />
            {!isOnline ? t('offline.offline') : !isServerReachable ? t('offline.serverUnreachable') : pendingCount ? t('offline.pending', { count: pendingCount }) : t('layout.online')}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <div className="relative">
            <Button variant="ghost" aria-label={t('nav.userMenu')} aria-expanded={userMenuOpen} onClick={() => setUserMenuOpen((open) => !open)}>
              <span className="max-w-32 truncate">{user?.name || t('layout.menu')}</span>
            </Button>
            {userMenuOpen && (
              <div className="absolute right-0 top-full z-40 mt-2 min-w-40 rounded-xl border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-700 dark:bg-slate-900">
                <Link to={ROUTES.PROFILE} onClick={() => setUserMenuOpen(false)} className="flex min-h-touch items-center rounded-lg px-3 text-sm hover:bg-slate-100 dark:hover:bg-slate-800">{t('nav.profile')}</Link>
                <Link to={ROUTES.SETTINGS} onClick={() => setUserMenuOpen(false)} className="flex min-h-touch items-center rounded-lg px-3 text-sm hover:bg-slate-100 dark:hover:bg-slate-800">{t('layout.settings')}</Link>
                <Button variant="ghost" className="w-full justify-start" onClick={() => { setUserMenuOpen(false); setChangePasswordOpen(true); }}>{t('layout.changePassword')}</Button>
                <Button variant="ghost" className="w-full justify-start" onClick={() => { void logout(); }}>{t('layout.signOut')}</Button>
              </div>
            )}
          </div>
        </div>
      </header>
      <aside data-print-hide className="fixed inset-y-0 left-0 hidden w-64 border-r border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950 lg:block">
        <Link to="/" className="mb-8 inline-flex min-h-touch items-center text-xl font-bold text-primary">{t('app.name')}</Link>
        {navigation}
      </aside>
      {drawerOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 lg:hidden" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setDrawerOpen(false);
        }}>
          <aside ref={drawerRef} id="mobile-navigation" role="dialog" aria-modal="true" aria-label={t('layout.menu')} className="h-full w-[min(20rem,85vw)] bg-white p-5 dark:bg-slate-900">
            <div className="mb-8 flex items-center justify-between">
              <span className="font-bold text-primary">{t('app.name')}</span>
              <Button variant="ghost" size="icon" aria-label={t('layout.closeMenu')} onClick={() => setDrawerOpen(false)}>
                <X aria-hidden="true" className="h-5 w-5" />
              </Button>
            </div>
            {navigation}
          </aside>
        </div>
      )}
      <main className="container py-6 lg:ml-64 lg:w-[calc(100%-16rem)]">{children}</main>
      <ChangePasswordModal open={changePasswordOpen} onClose={() => setChangePasswordOpen(false)} />
    </div>
  );
}
