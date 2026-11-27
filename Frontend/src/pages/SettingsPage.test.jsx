import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from '../context/AuthContext';
import { LanguageProvider } from '../context/LanguageContext';
import { ThemeProvider } from '../context/ThemeContext';
import { ToastProvider } from '../components/ui/Toast';
import { settingsApi } from '../services/api/settingsApi';
import { questionsApi } from '../services/api/questionsApi';
import SettingsPage from './SettingsPage';

vi.mock('../hooks/useOffline', () => ({
  useOffline: () => ({
    isOnline: true,
    pendingCount: 2,
    lastSyncAt: null,
    syncing: false,
    syncNow: vi.fn().mockResolvedValue({ synced: 1 }),
  }),
}));

vi.mock('../services/api/settingsApi', () => ({
  settingsApi: {
    get: vi.fn(),
    update: vi.fn(),
    deleteData: vi.fn(),
    clearQuestionCache: vi.fn(),
  },
}));

vi.mock('../services/api/profileApi', () => ({
  profileApi: {
    get: vi.fn(),
    updatePreferences: vi.fn(),
    deleteAccount: vi.fn(),
  },
}));

vi.mock('../services/api/questionsApi', () => ({
  questionsApi: {
    getCategories: vi.fn(),
    initialize: vi.fn(),
    getRoles: vi.fn(),
    getSkills: vi.fn(),
    list: vi.fn(),
  },
}));

vi.mock('../services/api/interviewsApi', () => ({ interviewsApi: { list: vi.fn() } }));
vi.mock('../services/api/notesApi', () => ({ notesApi: { list: vi.fn() } }));
vi.mock('../services/api/reportsApi', () => ({ reportsApi: { list: vi.fn() } }));

function renderSettings(authOverrides = {}) {
  const auth = {
    user: null,
    isAuthenticated: false,
    isGuest: true,
    logout: vi.fn(),
    finishAccountDeletion: vi.fn(),
    updateCurrentUser: vi.fn(),
    ...authOverrides,
  };
  return render(
    <AuthContext.Provider value={auth}>
      <ThemeProvider>
        <ToastProvider>
          <LanguageProvider>
            <MemoryRouter><SettingsPage /></MemoryRouter>
          </LanguageProvider>
        </ToastProvider>
      </ThemeProvider>
    </AuthContext.Provider>,
  );
}

describe('SettingsPage', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    settingsApi.get.mockResolvedValue({
      language: 'en',
      theme: 'system',
      interviewPreferences: {
        category: 'general',
        difficulty: 'beginner',
        duration: 15,
        questionCount: 5,
        style: 'standard',
        mode: 'text',
      },
      offline: { autoSync: true },
    });
    settingsApi.update.mockImplementation(async (updates) => ({
      language: updates.language || 'en',
      theme: updates.theme || 'system',
      interviewPreferences: updates.interviewPreferences || {
        category: 'general', difficulty: 'beginner', duration: 15, questionCount: 5, style: 'standard', mode: 'text',
      },
      offline: updates.offline || { autoSync: true },
    }));
    settingsApi.deleteData.mockResolvedValue({ message: 'deleted' });
    settingsApi.clearQuestionCache.mockResolvedValue(undefined);
    questionsApi.getCategories.mockResolvedValue({ items: ['general', 'technical', 'hr'] });
    questionsApi.getRoles.mockResolvedValue({ items: [] });
    questionsApi.getSkills.mockResolvedValue({ items: [] });
  });

  it('switches the whole interface language immediately and updates document lang', async () => {
    renderSettings();
    const languageSelect = await screen.findByLabelText('App language');
    fireEvent.change(languageSelect, { target: { value: 'te' } });

    expect(await screen.findByRole('heading', { name: 'సెట్టింగ్‌లు' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'ఇంటర్వ్యూ ప్రాధాన్యతలు' })).toBeInTheDocument();
    await waitFor(() => expect(document.documentElement.lang).toBe('te'));
  });

  it('requires the exact DELETE text before clearing data', async () => {
    renderSettings();
    fireEvent.click(await screen.findByRole('button', { name: 'Delete all data' }));
    const dialog = await screen.findByRole('dialog', { name: 'Delete your TalkReady data?' });
    const confirmButton = within(dialog).getByRole('button', { name: 'Delete all data' });
    expect(confirmButton).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Type DELETE to confirm'), { target: { value: 'delete' } });
    expect(confirmButton).toBeDisabled();
    expect(settingsApi.deleteData).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Type DELETE to confirm'), { target: { value: 'DELETE' } });
    expect(confirmButton).toBeEnabled();
    fireEvent.click(confirmButton);
    await waitFor(() => expect(settingsApi.deleteData).toHaveBeenCalledOnce());
    expect(screen.queryByRole('dialog', { name: 'Delete your TalkReady data?' })).not.toBeInTheDocument();
  });

  it('saves interview defaults to settings and profile preferences', async () => {
    const { profileApi } = await import('../services/api/profileApi');
    renderSettings();
    fireEvent.change(await screen.findByLabelText('Default category'), { target: { value: 'technical' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save interview preferences' }));

    await waitFor(() => {
      expect(profileApi.updatePreferences).toHaveBeenCalledWith({
        interviewPreferences: expect.objectContaining({ category: 'technical' }),
      });
      expect(settingsApi.update).toHaveBeenCalledWith({
        interviewPreferences: expect.objectContaining({ category: 'technical' }),
      });
    });
  });
});
