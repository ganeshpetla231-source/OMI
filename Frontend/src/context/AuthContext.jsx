import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { authApi } from '../services/api';
import { createGuestProfile, readGuestProfile } from '../services/offline/guestProfile';
import {
  clearAuth,
  GUEST_MODE_KEY,
  TOKEN_KEY,
  getStoredToken,
  getStoredUser,
  saveAuth,
  USER_KEY,
} from '../utils/authStorage';
import { setUnauthorizedHandler } from '../services/api/client';
import { ROUTES } from '../config/routes';
import { useToast } from '../components/ui/Toast';
import { useTranslation } from './LanguageContext';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const locationRef = useRef(location);
  locationRef.current = location;
  const toast = useToast();
  const { t } = useTranslation();
  const expiredRef = useRef(false);
  const [user, setUser] = useState(() => getStoredUser());
  const [token, setToken] = useState(() => getStoredToken());
  const [isGuest, setIsGuest] = useState(() => localStorage.getItem(GUEST_MODE_KEY) === 'true');
  const [guestProfile, setGuestProfile] = useState(() => readGuestProfile());
  const [loading, setLoading] = useState(() => Boolean(getStoredToken()));
  const [restoreError, setRestoreError] = useState(null);

  const expireSession = useCallback(() => {
    if (expiredRef.current) return;
    expiredRef.current = true;
    clearAuth();
    localStorage.removeItem(GUEST_MODE_KEY);
    setUser(null);
    setToken(null);
    setIsGuest(false);
    setLoading(false);
    setRestoreError(null);
    toast.error(t('auth.sessionExpired'));
    const currentLocation = locationRef.current;
    const from = currentLocation.pathname === ROUTES.LOGIN ? undefined : currentLocation;
    navigate(ROUTES.LOGIN, { replace: true, ...(from ? { state: { from } } : {}) });
  }, [navigate, t, toast]);

  useEffect(() => {
    setUnauthorizedHandler(expireSession);
    return () => setUnauthorizedHandler(null);
  }, [expireSession]);

  const persistSession = useCallback((session) => {
    const nextUser = session?.user;
    const nextToken = session?.token;
    if (!nextUser || typeof nextUser !== 'object' || typeof nextToken !== 'string' || !nextToken.trim()) {
      throw new Error(t('auth.incompleteResponse'));
    }
    saveAuth({ user: nextUser, token: nextToken });
    expiredRef.current = false;
    setUser(nextUser);
    setToken(nextToken);
    setIsGuest(false);
    setRestoreError(null);
  }, [t]);

  useEffect(() => {
    let active = true;
    const restoreSession = async () => {
      try {
        if (!getStoredToken()) {
          if (localStorage.getItem(GUEST_MODE_KEY) === 'true') {
            const profile = readGuestProfile() || createGuestProfile();
            if (active) {
              setGuestProfile(profile);
              setIsGuest(true);
            }
          }
          return;
        }

        setLoading(true);
        const restoredUser = await authApi.getMe();
        if (!restoredUser || typeof restoredUser !== 'object') {
          throw new Error(t('auth.incompleteResponse'));
        }
        if (!active) return;
        const currentToken = getStoredToken();
        if (!currentToken) return;
        localStorage.setItem(USER_KEY, JSON.stringify(restoredUser));
        setUser(restoredUser);
        setToken(currentToken);
        setRestoreError(null);
      } catch (error) {
        if (!active) return;
        if (error.status === 401) {
          expireSession();
        } else if ((error.code === 'NETWORK_ERROR' || error.status >= 500) && getStoredUser() && getStoredToken()) {
          setUser(getStoredUser());
          setToken(getStoredToken());
          setRestoreError(null);
        } else {
          setRestoreError(error);
          toast.error(error.message || 'Unable to verify your session. Check your connection and retry.');
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    restoreSession();
    return () => {
      active = false;
    };
  }, [expireSession, t, toast]);

  const login = useCallback(async (payload) => {
    const result = await authApi.login(payload);
    persistSession(result);
    return result.user;
  }, [persistSession]);

  const register = useCallback(async (payload) => {
    const result = await authApi.register(payload);
    persistSession(result);
    return result.user;
  }, [persistSession]);

  const logout = useCallback(async () => {
    let logoutError = null;
    if (getStoredToken()) {
      try {
        await authApi.logout();
      } catch (error) {
        logoutError = error;
      }
    }
    clearAuth();
    localStorage.removeItem(GUEST_MODE_KEY);
    setUser(null);
    setToken(null);
    setIsGuest(false);
    setRestoreError(null);
    setLoading(false);
    expiredRef.current = false;
    if (logoutError) {
    toast.error(t('auth.logoutFailed'));
    }
    navigate(ROUTES.LOGIN, { replace: true });
  }, [navigate, t, toast]);

  const continueAsGuest = useCallback(() => {
    if (getStoredToken()) throw new Error('Sign out before continuing as a guest.');
    const profile = createGuestProfile();
    clearAuth();
    localStorage.setItem(GUEST_MODE_KEY, 'true');
    setUser(null);
    setToken(null);
    setGuestProfile(profile);
    setIsGuest(true);
    setRestoreError(null);
    return profile;
  }, []);

  const changePassword = useCallback(async (payload) => {
    const result = await authApi.changePassword(payload);
    if (!result?.token) throw new Error(t('auth.incompleteResponse'));
    localStorage.setItem(TOKEN_KEY, result.token);
    setToken(result.token);
    expiredRef.current = false;
    return result;
  }, [t]);

  const finishAccountDeletion = useCallback(() => {
    clearAuth();
    localStorage.removeItem(GUEST_MODE_KEY);
    setUser(null);
    setToken(null);
    setIsGuest(false);
    setGuestProfile(null);
    setRestoreError(null);
    setLoading(false);
    expiredRef.current = false;
    navigate(ROUTES.HOME, { replace: true });
  }, [navigate]);

  const refreshUser = useCallback(async () => {
    setLoading(true);
    setRestoreError(null);
    try {
      const restoredUser = await authApi.getMe();
      if (!restoredUser || typeof restoredUser !== 'object') {
        throw new Error(t('auth.incompleteResponse'));
      }
      const currentToken = getStoredToken();
      if (!currentToken) throw new Error('Your session expired. Please sign in again.');
      localStorage.setItem(USER_KEY, JSON.stringify(restoredUser));
      setUser(restoredUser);
      setToken(currentToken);
      return restoredUser;
    } catch (error) {
      if (error.status === 401) {
        expireSession();
      } else {
        setRestoreError(error);
      }
      throw error;
    } finally {
      setLoading(false);
    }
  }, [expireSession, t]);

  const updateCurrentUser = useCallback((updates) => {
    setUser((current) => {
      if (!current) return current;
      const next = { ...current, ...updates };
      localStorage.setItem(USER_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const value = useMemo(() => ({
    user,
    token,
    isAuthenticated: Boolean(user && token),
    isGuest: Boolean(isGuest && !token),
    guestProfile,
    loading,
    restoreError,
    login,
    register,
    logout,
    continueAsGuest,
    refreshUser,
    updateCurrentUser,
    changePassword,
    finishAccountDeletion,
  }), [user, token, isGuest, guestProfile, loading, restoreError, login, register, logout, continueAsGuest, refreshUser, updateCurrentUser, changePassword, finishAccountDeletion]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
