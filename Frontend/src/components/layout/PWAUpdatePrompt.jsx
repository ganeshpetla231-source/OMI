import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from '../ui/Button';
import { useTranslation } from '../../context/LanguageContext';

export function PWAUpdatePrompt() {
  const { t } = useTranslation();
  const [registrationError, setRegistrationError] = useState(null);
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    immediate: true,
    onRegisterError(error) {
      setRegistrationError(error.message);
    },
  });

  if (!needRefresh && !registrationError) return null;
  return (
    <div role={registrationError ? 'alert' : 'status'} className="fixed bottom-4 right-4 z-[90] flex max-w-sm items-center gap-3 rounded-xl border border-primary/30 bg-white p-4 text-sm shadow-lg dark:bg-slate-900">
      <p className="flex-1">{registrationError ? `${t('offline.updateError')} ${registrationError}` : t('offline.newVersion')}</p>
      {needRefresh && (
        <Button size="sm" onClick={() => { void updateServiceWorker(true); }}>
          <RefreshCw aria-hidden="true" className="h-4 w-4" />
          {t('offline.refresh')}
        </Button>
      )}
    </div>
  );
}
