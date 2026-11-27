import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { apiClient } from '../services/api/client';
import {
  getLastSyncAt,
  getPendingSyncCount,
  processSyncQueue,
  retryFailedSync,
} from '../services/offline/syncQueue';
import { getSyncQueue } from '../services/offline/syncQueue';
import { getStorageStatus } from '../services/offline/db';
import { getLocalSettings } from '../services/offline/profileSettings';
import { useToast } from '../components/ui/Toast';
import { useTranslation } from './LanguageContext';

const OfflineContext = createContext(null);

export function OfflineProvider({ children }) {
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [isServerReachable, setIsServerReachable] = useState(() => navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [lastSyncAt, setLastSyncAt] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [storageWarning, setStorageWarning] = useState(null);
  const activeSync = useRef(false);
  const toast = useToast();
  const { t } = useTranslation();

  const refreshQueue = useCallback(async () => {
    const [count, entries, lastSync] = await Promise.all([
      getPendingSyncCount(),
      getSyncQueue(),
      getLastSyncAt(),
    ]);
    setPendingCount(count);
    setFailedCount(entries.filter((entry) => entry.status === 'failed').length);
    setLastSyncAt(lastSync);
  }, []);

  const checkServer = useCallback(async () => {
    if (!navigator.onLine) {
      setIsOnline(false);
      setIsServerReachable(false);
      return false;
    }
    setIsOnline(true);
    try {
      await apiClient.get('/health', { timeout: 5000 });
      setIsServerReachable(true);
      return true;
    } catch {
      setIsServerReachable(false);
      return false;
    }
  }, []);

  const syncNow = useCallback(async ({ retryFailed = false } = {}) => {
    if (activeSync.current) return null;
    activeSync.current = true;
    setSyncing(true);
    try {
      const result = retryFailed
        ? await retryFailedSync()
        : await processSyncQueue({ force: true });
      await refreshQueue();
      const storage = getStorageStatus();
      setStorageWarning(storage.warning);
      return result;
    } catch (error) {
      toast.error(`${t('offline.syncFailed')} ${error.message}`);
      return null;
    } finally {
      activeSync.current = false;
      setSyncing(false);
    }
  }, [refreshQueue, t, toast]);

  useEffect(() => {
    let disposed = false;
    const initializeStorage = async () => {
      try {
        await navigator.storage?.persist?.();
        const estimate = await navigator.storage?.estimate?.();
        if (estimate?.quota && estimate.usage / estimate.quota >= 0.9) {
          setStorageWarning(t('offline.storageLow'));
        }
      } catch {
        setStorageWarning(t('offline.storageWarning'));
      }
      const status = getStorageStatus();
      if (status.warning) setStorageWarning(status.warning);
    };
    const startup = async () => {
      await initializeStorage();
      const reachable = await checkServer();
      await refreshQueue();
      let settings;
      try {
        settings = await getLocalSettings();
      } catch (error) {
        if (!disposed) toast.error(error.message || t('settings.loadError'));
        return;
      }
      if (!disposed && reachable && settings.offline?.autoSync !== false) {
        try {
          await processSyncQueue();
          await refreshQueue();
        } catch (error) {
          toast.error(`${t('offline.syncFailed')} ${error.message}`);
        }
      }
    };
    void startup();

    const handleOnline = () => {
      setIsOnline(true);
      void startup();
    };
    const handleOffline = () => {
      setIsOnline(false);
      setIsServerReachable(false);
    };
    const handleQueueChanged = () => { void refreshQueue(); };
    const handleStorageWarning = (event) => setStorageWarning(event.detail?.message || t('offline.storageWarning'));
    const handleSyncComplete = (event) => {
      void refreshQueue();
      if (event.detail?.synced) toast.success(t('offline.synced', { count: event.detail.synced }));
    };
    const healthInterval = window.setInterval(() => { void checkServer(); }, 30_000);
    const syncInterval = window.setInterval(() => {
      if (!navigator.onLine) return;
      void getLocalSettings()
        .then((settings) => settings.offline?.autoSync === false ? false : checkServer())
        .then((reachable) => reachable && processSyncQueue())
        .then(refreshQueue).catch((error) => {
        toast.error(`${t('offline.syncFailed')} ${error.message}`);
      });
    }, 60_000);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('talkready:sync-queue-changed', handleQueueChanged);
    window.addEventListener('talkready:storage-warning', handleStorageWarning);
    window.addEventListener('talkready:sync-complete', handleSyncComplete);
    return () => {
      disposed = true;
      window.clearInterval(healthInterval);
      window.clearInterval(syncInterval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('talkready:sync-queue-changed', handleQueueChanged);
      window.removeEventListener('talkready:storage-warning', handleStorageWarning);
      window.removeEventListener('talkready:sync-complete', handleSyncComplete);
    };
  }, [checkServer, refreshQueue, t, toast]);

  const value = useMemo(() => ({
    isOnline,
    isServerReachable,
    pendingCount,
    failedCount,
    lastSyncAt,
    syncing,
    storageWarning,
    syncNow,
  }), [failedCount, isOnline, isServerReachable, lastSyncAt, pendingCount, storageWarning, syncing, syncNow]);

  return <OfflineContext.Provider value={value}>{children}</OfflineContext.Provider>;
}

export function useOffline() {
  const context = useContext(OfflineContext);
  if (!context) throw new Error('useOffline must be used within OfflineProvider.');
  return context;
}
