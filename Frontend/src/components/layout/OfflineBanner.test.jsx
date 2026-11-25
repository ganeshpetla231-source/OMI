import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LanguageProvider } from '../../context/LanguageContext';

const useOfflineMock = vi.hoisted(() => vi.fn());

vi.mock('../../hooks/useOffline', () => ({ useOffline: useOfflineMock }));

import { OfflineBanner } from './OfflineBanner';

const defaultOfflineState = {
  isOnline: true,
  isServerReachable: true,
  pendingCount: 0,
  failedCount: 0,
  syncing: false,
  storageWarning: null,
  syncNow: vi.fn().mockResolvedValue(null),
};

describe('OfflineBanner', () => {
  afterEach(() => vi.clearAllMocks());

  it('shows offline status and locally available data', () => {
    useOfflineMock.mockReturnValue({ ...defaultOfflineState, isOnline: false, isServerReachable: false });
    render(<LanguageProvider><OfflineBanner /></LanguageProvider>);

    expect(screen.getByRole('status')).toHaveTextContent('Offline – saved data is available.');
  });

  it('distinguishes browser connectivity from server reachability', () => {
    useOfflineMock.mockReturnValue({ ...defaultOfflineState, isServerReachable: false });
    render(<LanguageProvider><OfflineBanner /></LanguageProvider>);

    expect(screen.getByRole('status')).toHaveTextContent('Server unreachable – working locally.');
  });

  it('shows a manual sync action when queued changes are waiting', () => {
    const syncNow = vi.fn();
    useOfflineMock.mockReturnValue({ ...defaultOfflineState, pendingCount: 2, syncNow });
    render(<LanguageProvider><OfflineBanner /></LanguageProvider>);

    fireEvent.click(screen.getByRole('button', { name: 'Sync now' }));
    expect(syncNow).toHaveBeenCalledWith({ retryFailed: false });
  });
});
