import { AlertTriangle, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { useTranslation } from '../../context/LanguageContext';
import { useOffline } from '../../hooks/useOffline';
import { Button } from '../ui/Button';

export function OfflineBanner() {
  const { isOnline, isServerReachable, pendingCount, failedCount, syncing, storageWarning, syncNow } = useOffline();
  const { t } = useTranslation();
  const message = !isOnline
    ? t('offline.offline')
    : !isServerReachable
      ? t('offline.serverUnreachable')
      : pendingCount
        ? t('offline.pending', { count: pendingCount })
        : '';
  if (!message && !storageWarning) return null;
  const Icon = !isOnline ? WifiOff : !isServerReachable ? AlertTriangle : Wifi;
  return (
    <div role="status" className="flex flex-wrap items-center justify-center gap-2 bg-warning-light px-4 py-2 text-center text-sm font-medium text-warning dark:bg-amber-950 dark:text-amber-200">
      <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
      {message && <span>{message}</span>}
      {storageWarning && <span>{storageWarning}</span>}
      {pendingCount > 0 && isServerReachable && (
        <Button
          size="sm"
          variant="ghost"
          disabled={syncing}
          onClick={() => { void syncNow({ retryFailed: failedCount > 0 }); }}
        >
          <RefreshCw aria-hidden="true" className="h-4 w-4" />
          {failedCount ? t('offline.retrySync') : t('offline.syncNow')}
        </Button>
      )}
    </div>
  );
}
