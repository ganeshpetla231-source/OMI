import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, RefreshCw, Trash2 } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { ErrorState } from '../components/ui/ErrorState';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { Select } from '../components/ui/Select';
import { Skeleton } from '../components/ui/Skeleton';
import { ChangePasswordModal } from '../components/auth/ChangePasswordModal';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { useOffline } from '../hooks/useOffline';
import { interviewsApi } from '../services/api/interviewsApi';
import { notesApi } from '../services/api/notesApi';
import { profileApi } from '../services/api/profileApi';
import { questionsApi } from '../services/api/questionsApi';
import { reportsApi } from '../services/api/reportsApi';
import { settingsApi } from '../services/api/settingsApi';
import { clearCurrentUserData } from '../services/offline/profileSettings';
import { Language, Theme } from '../config/constants';
import { getStorageStatus } from '../services/offline/db';
import { normalizeOptions } from '../utils/questionData';

const PREFERENCES = {
  category: 'general',
  difficulty: 'beginner',
  duration: 15,
  questionCount: 5,
  style: 'standard',
  mode: 'text',
};

function formatBytes(bytes, t) {
  const value = Number(bytes);
  if (!Number.isFinite(value) || value < 0) return t('settings.unknownSize');
  if (value < 1024) return t('settings.bytes', { count: value });
  if (value < 1024 * 1024) return t('settings.kilobytes', { count: (value / 1024).toFixed(1) });
  return t('settings.megabytes', { count: (value / (1024 * 1024)).toFixed(1) });
}

async function listAllPages(list) {
  const first = await list({ page: 1, limit: 500 });
  const items = [...(first.items || [])];
  const pages = Math.min(1000, Number(first.pagination?.pages) || 1);
  for (let page = 2; page <= pages; page += 1) {
    const response = await list({ page, limit: 500 });
    items.push(...(response.items || []));
  }
  return items;
}

function downloadJson(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export default function SettingsPage() {
  const { t, language, setLanguage } = useTranslation();
  const { theme, setTheme } = useTheme();
  const {
    user,
    isAuthenticated,
    isGuest,
    logout,
    finishAccountDeletion,
    updateCurrentUser,
  } = useAuth();
  const {
    isOnline,
    pendingCount,
    lastSyncAt,
    syncing,
    syncNow,
  } = useOffline();

  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [categories, setCategories] = useState([]);
  const [categoriesError, setCategoriesError] = useState(null);
  const [saving, setSaving] = useState('');
  const [feedback, setFeedback] = useState('');
  const [storageUsage, setStorageUsage] = useState(null);
  const [storageWarning, setStorageWarning] = useState(null);
  const [operationError, setOperationError] = useState(null);
  const [cacheBusy, setCacheBusy] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [cacheDialog, setCacheDialog] = useState(false);
  const [deleteDataOpen, setDeleteDataOpen] = useState(false);
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
  const [deleteDataText, setDeleteDataText] = useState('');
  const [deleteAccountText, setDeleteAccountText] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);

  const preferences = settings?.interviewPreferences || PREFERENCES;
  const autoSync = settings?.offline?.autoSync !== false;
  const canDeleteAccount = isAuthenticated && isOnline;
  const canDeleteAllData = !isAuthenticated || isOnline || import.meta.env.VITE_USE_MOCK === 'true';
  const languageOptions = useMemo(() => [
    { value: Language.ENGLISH, label: t('settings.languageEnglish') },
    { value: Language.TELUGU, label: t('settings.languageTelugu') },
    { value: Language.HINDI, label: t('settings.languageHindi') },
  ], [t]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const saved = await settingsApi.get();
      setSettings({
        ...saved,
        interviewPreferences: { ...PREFERENCES, ...(saved.interviewPreferences || {}) },
        offline: { autoSync: true, ...(saved.offline || {}) },
      });
      if ([Language.ENGLISH, Language.TELUGU, Language.HINDI].includes(saved.language)) {
        setLanguage(saved.language);
      }
      if ([Theme.LIGHT, Theme.DARK, Theme.SYSTEM].includes(saved.theme)) setTheme(saved.theme);
    } catch (error) {
      setLoadError(error);
    } finally {
      setLoading(false);
    }
  }, [setLanguage, setTheme]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    let active = true;
    questionsApi.getCategories().then((result) => {
      if (active) {
        setCategories(normalizeOptions(result.items));
        setCategoriesError(null);
      }
    }).catch((error) => { if (active) setCategoriesError(error); });
    return () => { active = false; };
  }, []);

  const refreshStorage = useCallback(async () => {
    try {
      const estimate = await navigator.storage?.estimate?.();
      setStorageUsage(estimate ? { usage: estimate.usage || 0, quota: estimate.quota || 0 } : null);
      const status = getStorageStatus();
      setStorageWarning(status.warning);
    } catch (error) {
      setStorageWarning(error.message || t('settings.storageUnavailable'));
    }
  }, [t]);

  useEffect(() => { void refreshStorage(); }, [refreshStorage]);

  const saveSection = async (section, updates) => {
    setSaving(section);
    setFeedback('');
    setOperationError(null);
    try {
      const saved = await settingsApi.update(updates);
      setSettings((current) => ({
        ...current,
        ...saved,
        interviewPreferences: { ...current.interviewPreferences, ...(saved.interviewPreferences || {}) },
        offline: { ...current.offline, ...(saved.offline || {}) },
      }));
      setFeedback(t('settings.saveSuccess'));
      return saved;
    } catch (error) {
      setOperationError(error);
      return null;
    } finally {
      setSaving('');
    }
  };

  const saveGeneral = async () => {
    const saved = await saveSection('general', { language, theme });
    if (saved) {
      setLanguage(language);
      setTheme(theme);
    }
  };

  const savePreferences = async () => {
    setSaving('preferences');
    setFeedback('');
    setOperationError(null);
    try {
      const updatedProfile = await profileApi.updatePreferences({ interviewPreferences: preferences });
      await settingsApi.update({ interviewPreferences: preferences });
      if (updatedProfile?.preferences) updateCurrentUser({ preferences: updatedProfile.preferences });
      setFeedback(t('settings.saveSuccess'));
    } catch (error) {
      setOperationError(error);
    } finally {
      setSaving('');
    }
  };

  const toggleAutoSync = async (event) => {
    const offline = { ...(settings.offline || {}), autoSync: event.target.checked };
    setSettings((current) => ({ ...current, offline }));
    await saveSection('offline', { offline });
  };

  const sync = async () => {
    setOperationError(null);
    const result = await syncNow({ retryFailed: true });
    if (!result) setOperationError(new Error(t('settings.syncError')));
    else setFeedback(t('settings.syncStarted'));
  };

  const downloadQuestions = async () => {
    setCacheBusy(true);
    setOperationError(null);
    try {
      await questionsApi.initialize();
      await Promise.all([
        questionsApi.getCategories(),
        questionsApi.getRoles({}),
        questionsApi.getSkills({}),
      ]);
      const first = await questionsApi.list({ page: 1, limit: 500 });
      const pages = Math.min(1000, Number(first.pagination?.pages) || 1);
      for (let page = 2; page <= pages; page += 1) {
        await questionsApi.list({ page, limit: 500 });
      }
      setFeedback(t('settings.questionsDownloaded'));
    } catch (error) {
      setOperationError(error);
    } finally {
      setCacheBusy(false);
    }
  };

  const clearCache = async () => {
    setCacheBusy(true);
    setOperationError(null);
    try {
      await settingsApi.clearQuestionCache();
      setCacheDialog(false);
      setFeedback(t('settings.cacheCleared'));
      await refreshStorage();
    } catch (error) {
      setOperationError(error);
    } finally {
      setCacheBusy(false);
    }
  };

  const exportData = async () => {
    setExportBusy(true);
    setOperationError(null);
    try {
      const [profile, interviews, reports, notes] = await Promise.all([
        profileApi.get(),
        listAllPages(interviewsApi.list),
        listAllPages(reportsApi.list),
        listAllPages(notesApi.list),
      ]);
      downloadJson({
        exportedAt: new Date().toISOString(),
        profile,
        interviews,
        reports,
        notes,
      }, 'talkready-data-export.json');
      setFeedback(t('settings.exportSuccess'));
    } catch (error) {
      setOperationError(error);
    } finally {
      setExportBusy(false);
    }
  };

  const deleteData = async () => {
    if (deleteDataText !== 'DELETE') return;
    setDeleting(true);
    setOperationError(null);
    try {
      await settingsApi.deleteData();
      setSettings(null);
      setLanguage(Language.ENGLISH);
      setTheme(Theme.SYSTEM);
      setDeleteDataText('');
      setDeleteDataOpen(false);
      setFeedback(t('settings.dataDeleted'));
      await load();
    } catch (error) {
      setOperationError(error);
    } finally {
      setDeleting(false);
    }
  };

  const deleteAccount = async () => {
    if (deleteAccountText !== 'DELETE' || !deletePassword || !canDeleteAccount) return;
    setDeleting(true);
    setOperationError(null);
    try {
      await profileApi.deleteAccount(deletePassword);
      await clearCurrentUserData();
      localStorage.removeItem('talkready_language');
      localStorage.removeItem('talkready_theme');
      setDeleteAccountOpen(false);
      finishAccountDeletion();
    } catch (error) {
      setOperationError(error);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return <main className="mx-auto max-w-5xl space-y-4" aria-label={t('settings.loading')}><Skeleton className="h-10 w-2/3" /><Skeleton className="h-48 w-full" /><Skeleton className="h-48 w-full" /></main>;
  }
  if (loadError || !settings) {
    return <main className="mx-auto max-w-5xl"><ErrorState title={t('settings.loadError')} message={loadError?.message || t('settings.loadError')} retryLabel={t('common.retry')} onRetry={() => { void load(); }} /></main>;
  }

  const lastSyncLabel = lastSyncAt ? new Date(lastSyncAt).toLocaleString(language) : t('settings.neverSynced');

  return (
    <main className="mx-auto max-w-5xl space-y-6">
      <header>
        <p className="text-sm font-semibold text-primary">{t('settings.eyebrow')}</p>
        <h1 className="mt-1 text-3xl font-bold">{t('settings.title')}</h1>
        <p className="mt-2 text-muted dark:text-muted-dark">{t('settings.description')}</p>
      </header>

      {feedback && <p role="status" className="rounded-lg bg-success-light p-3 text-sm text-success">{feedback}</p>}
      {operationError && <p role="alert" className="rounded-lg bg-danger-light p-3 text-sm text-danger">{operationError.message}</p>}

      <Card>
        <h2 className="text-xl font-semibold">{t('settings.generalTitle')}</h2>
        <p className="mt-1 text-sm text-muted dark:text-muted-dark">{t('settings.generalDescription')}</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Select label={t('settings.language')} value={language} options={languageOptions} onChange={(event) => setLanguage(event.target.value)} />
          <Select
            label={t('settings.theme')}
            value={theme}
            onChange={(event) => setTheme(event.target.value)}
            options={[
              { value: Theme.LIGHT, label: t('settings.themeLight') },
              { value: Theme.DARK, label: t('settings.themeDark') },
              { value: Theme.SYSTEM, label: t('settings.themeSystem') },
            ]}
          />
        </div>
        <Button className="mt-4" loading={saving === 'general'} onClick={() => { void saveGeneral(); }}>{t('settings.saveGeneral')}</Button>
      </Card>

      <Card>
        <h2 className="text-xl font-semibold">{t('settings.preferencesTitle')}</h2>
        <p className="mt-1 text-sm text-muted dark:text-muted-dark">{t('settings.preferencesDescription')}</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Select label={t('settings.defaultCategory')} value={preferences.category} onChange={(event) => setSettings((current) => ({ ...current, interviewPreferences: { ...current.interviewPreferences, category: event.target.value } }))} options={[
            { value: '', label: t('settings.selectCategory'), disabled: true },
            ...categories.map((option) => ({
              ...option,
              label: t(`questionBank.categories.${option.value}`) === `questionBank.categories.${option.value}`
                ? option.label
                : t(`questionBank.categories.${option.value}`),
            })),
          ]} />
          <Select label={t('settings.defaultDifficulty')} value={preferences.difficulty} onChange={(event) => setSettings((current) => ({ ...current, interviewPreferences: { ...current.interviewPreferences, difficulty: event.target.value } }))} options={['beginner', 'intermediate', 'advanced'].map((value) => ({ value, label: t(`questionBank.difficulties.${value}`) }))} />
          <Select label={t('settings.defaultDuration')} value={String(preferences.duration)} onChange={(event) => setSettings((current) => ({ ...current, interviewPreferences: { ...current.interviewPreferences, duration: Number(event.target.value) } }))} options={[5, 10, 15, 30].map((value) => ({ value: String(value), label: t('interviewSetup.minutes', { count: value }) }))} />
          <Select label={t('settings.defaultQuestionCount')} value={String(preferences.questionCount)} onChange={(event) => setSettings((current) => ({ ...current, interviewPreferences: { ...current.interviewPreferences, questionCount: Number(event.target.value) } }))} options={[5, 10, 15].map((value) => ({ value: String(value), label: t('interviewSetup.questionsCount', { count: value }) }))} />
          <Select label={t('settings.defaultStyle')} value={preferences.style} onChange={(event) => setSettings((current) => ({ ...current, interviewPreferences: { ...current.interviewPreferences, style: event.target.value } }))} options={['friendly', 'standard', 'strict', 'rapid-fire'].map((value) => ({ value, label: t(`interviewSetup.styles.${value}`) }))} />
          <Select label={t('settings.defaultMode')} value={preferences.mode} onChange={(event) => setSettings((current) => ({ ...current, interviewPreferences: { ...current.interviewPreferences, mode: event.target.value } }))} options={[{ value: 'text', label: t('interviewSetup.textMode') }, { value: 'voice', label: t('interviewSetup.voiceMode') }]} />
        </div>
        {categoriesError && <p role="status" className="mt-3 text-sm text-warning">{t('settings.categoriesUnavailable')} {categoriesError.message}</p>}
        <Button className="mt-4" loading={saving === 'preferences'} onClick={() => { void savePreferences(); }}>{t('settings.savePreferences')}</Button>
      </Card>

      <Card>
        <h2 className="text-xl font-semibold">{t('settings.offlineTitle')}</h2>
        <p className="mt-1 text-sm text-muted dark:text-muted-dark">{t('settings.offlineDescription')}</p>
        <label className="mt-4 flex min-h-touch items-center gap-3">
          <input type="checkbox" checked={autoSync} onChange={toggleAutoSync} disabled={Boolean(saving)} className="h-4 w-4 accent-primary" />
          <span>{t('settings.autoSync')}</span>
        </label>
        <div className="mt-4 grid gap-3 rounded-lg bg-slate-50 p-4 text-sm dark:bg-slate-800 sm:grid-cols-2">
          <p>{t('settings.pendingItems', { count: pendingCount })}</p>
          <p>{t('settings.lastSync', { time: lastSyncLabel })}</p>
          <p>{storageUsage ? t('settings.storageUsage', { usage: formatBytes(storageUsage.usage, t), quota: formatBytes(storageUsage.quota, t) }) : t('settings.storageUnavailable')}</p>
          {storageWarning && <p role="status" className="text-warning">{storageWarning}</p>}
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button variant="secondary" loading={syncing} onClick={() => { void sync(); }}><RefreshCw aria-hidden="true" className="h-4 w-4" />{t('settings.syncNow')}</Button>
          <Button variant="secondary" loading={cacheBusy} onClick={() => { void downloadQuestions(); }}><Download aria-hidden="true" className="h-4 w-4" />{t('settings.downloadQuestions')}</Button>
          <Button variant="ghost" onClick={() => setCacheDialog(true)}><Trash2 aria-hidden="true" className="h-4 w-4" />{t('settings.clearCache')}</Button>
        </div>
      </Card>

      <Card>
        <h2 className="text-xl font-semibold">{t('settings.accountTitle')}</h2>
        <p className="mt-1 text-sm text-muted dark:text-muted-dark">{t(isGuest ? 'settings.guestAccountDescription' : 'settings.accountDescription')}</p>
        <div className="mt-4 flex flex-wrap gap-3">
          {isAuthenticated && <Button variant="secondary" onClick={() => setChangePasswordOpen(true)}>{t('layout.changePassword')}</Button>}
          <Button variant="ghost" onClick={() => { void logout(); }}>{t('layout.signOut')}</Button>
        </div>
      </Card>

      <Card>
        <h2 className="text-xl font-semibold">{t('settings.privacyTitle')}</h2>
        <p className="mt-2 text-sm text-muted dark:text-muted-dark">{t('settings.privacyDescription')}</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button variant="secondary" loading={exportBusy} onClick={() => { void exportData(); }}><Download aria-hidden="true" className="h-4 w-4" />{t('settings.exportData')}</Button>
          <Button variant="danger" disabled={!canDeleteAllData} title={!canDeleteAllData ? t('settings.dataDeleteOnlineOnly') : undefined} onClick={() => { setDeleteDataText(''); setDeleteDataOpen(true); }}><Trash2 aria-hidden="true" className="h-4 w-4" />{t('settings.deleteData')}</Button>
          {isAuthenticated && (
            <Button variant="danger" disabled={!canDeleteAccount} title={!isOnline ? t('settings.accountDeleteOnlineOnly') : undefined} onClick={() => { setDeleteAccountText(''); setDeletePassword(''); setDeleteAccountOpen(true); }}>
              <Trash2 aria-hidden="true" className="h-4 w-4" />{t('settings.deleteAccount')}
            </Button>
          )}
        </div>
        {!canDeleteAccount && isAuthenticated && <p className="mt-3 text-sm text-warning">{t('settings.accountDeleteOnlineOnly')}</p>}
        {!canDeleteAllData && <p className="mt-3 text-sm text-warning">{t('settings.dataDeleteOnlineOnly')}</p>}
      </Card>

      <ConfirmDialog
        open={cacheDialog}
        onClose={() => setCacheDialog(false)}
        onConfirm={() => { void clearCache(); }}
        title={t('settings.clearCacheTitle')}
        description={t('settings.clearCacheDescription')}
        confirmLabel={t('settings.clearCacheConfirm')}
        cancelLabel={t('common.cancel')}
        loading={cacheBusy}
      />

      <Modal open={deleteDataOpen} onClose={() => !deleting && setDeleteDataOpen(false)} title={t('settings.deleteDataTitle')} description={t('settings.deleteDataDescription')} closeLabel={t('common.close')}>
        <div className="space-y-4">
          <Input label={t('settings.typeDelete')} value={deleteDataText} onChange={(event) => setDeleteDataText(event.target.value)} autoComplete="off" />
          <p className="text-sm text-muted dark:text-muted-dark">{t('settings.dataDeleteAccountKept')}</p>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" disabled={deleting} onClick={() => setDeleteDataOpen(false)}>{t('common.cancel')}</Button>
            <Button variant="danger" disabled={deleting || deleteDataText !== 'DELETE'} loading={deleting} onClick={() => { void deleteData(); }}>{t('settings.deleteDataConfirm')}</Button>
          </div>
        </div>
      </Modal>

      <Modal open={deleteAccountOpen} onClose={() => !deleting && setDeleteAccountOpen(false)} title={t('settings.deleteAccountTitle')} description={t('settings.deleteAccountDescription')} closeLabel={t('common.close')}>
        <div className="space-y-4">
          <Input label={t('settings.accountPassword')} type="password" autoComplete="current-password" value={deletePassword} onChange={(event) => setDeletePassword(event.target.value)} />
          <Input label={t('settings.typeDelete')} value={deleteAccountText} onChange={(event) => setDeleteAccountText(event.target.value)} autoComplete="off" />
          <div className="flex justify-end gap-3">
            <Button variant="secondary" disabled={deleting} onClick={() => setDeleteAccountOpen(false)}>{t('common.cancel')}</Button>
            <Button variant="danger" disabled={deleting || !deletePassword || deleteAccountText !== 'DELETE' || !canDeleteAccount} loading={deleting} onClick={() => { void deleteAccount(); }}>{t('settings.deleteAccountConfirm')}</Button>
          </div>
        </div>
      </Modal>

      <ChangePasswordModal open={changePasswordOpen} onClose={() => setChangePasswordOpen(false)} />
    </main>
  );
}
