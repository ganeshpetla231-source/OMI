import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from '../../context/LanguageContext';
import { ROUTES } from '../../config/routes';
import { Button } from '../ui/Button';

const DISMISSED_KEY = 'talkready_guest_banner_dismissed';

export function GuestBanner() {
  const { isGuest } = useAuth();
  const { t } = useTranslation();
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISSED_KEY) === 'true');

  useEffect(() => {
    if (isGuest) setDismissed(localStorage.getItem(DISMISSED_KEY) === 'true');
  }, [isGuest]);

  if (!isGuest || dismissed) return null;
  return (
    <aside role="status" className="flex flex-wrap items-center justify-center gap-2 bg-primary-light px-3 py-2 text-sm text-indigo-950 dark:bg-indigo-950 dark:text-indigo-100 sm:justify-between sm:px-5">
      <span className="text-center font-medium">{t('guest.notice')}</span>
      <div className="flex items-center gap-1">
        <Link to={ROUTES.REGISTER} className="inline-flex min-h-touch items-center rounded-lg px-3 font-semibold text-primary hover:bg-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:text-indigo-200 dark:hover:bg-white/10">
          {t('guest.createAccount')}
        </Link>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t('guest.dismiss')}
          onClick={() => {
            localStorage.setItem(DISMISSED_KEY, 'true');
            setDismissed(true);
          }}
        >
          <X aria-hidden="true" className="h-4 w-4" />
        </Button>
      </div>
    </aside>
  );
}
