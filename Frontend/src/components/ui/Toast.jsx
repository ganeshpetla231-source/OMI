import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { Button } from './Button';
import { cn } from '../../utils/cn';

const ToastContext = createContext(null);

const toneStyles = {
  success: 'border-green-200 bg-white text-green-900 dark:border-green-900 dark:bg-slate-900 dark:text-green-200',
  error: 'border-red-200 bg-white text-red-900 dark:border-red-900 dark:bg-slate-900 dark:text-red-200',
  info: 'border-blue-200 bg-white text-blue-900 dark:border-blue-900 dark:bg-slate-900 dark:text-blue-200',
};

const icons = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(0);
  const timers = useRef(new Map());

  useEffect(() => () => {
    timers.current.forEach((timer) => window.clearTimeout(timer));
    timers.current.clear();
  }, []);

  const dismiss = useCallback((id) => {
    const timer = timers.current.get(id);
    if (timer) window.clearTimeout(timer);
    timers.current.delete(id);
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback((message, tone = 'info', duration = 4000) => {
    const id = ++nextId.current;
    setToasts((current) => [...current, { id, message, tone }]);
    if (duration > 0) timers.current.set(id, window.setTimeout(() => dismiss(id), duration));
    return id;
  }, [dismiss]);

  const value = useMemo(() => ({
    showToast,
    success: (message, duration) => showToast(message, 'success', duration),
    error: (message, duration) => showToast(message, 'error', duration),
    info: (message, duration) => showToast(message, 'info', duration),
    dismiss,
  }), [dismiss, showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div aria-live="polite" aria-relevant="additions removals" className="fixed inset-x-3 top-3 z-[100] ml-auto flex max-w-sm flex-col gap-2 sm:right-5 sm:top-5">
        {toasts.map((toast) => {
          const Icon = icons[toast.tone] || Info;
          return (
            <div key={toast.id} role={toast.tone === 'error' ? 'alert' : 'status'} className={cn('flex min-h-touch items-center gap-3 rounded-xl border p-3 shadow-lg', toneStyles[toast.tone] || toneStyles.info)}>
              <Icon aria-hidden="true" className="h-5 w-5 shrink-0" />
              <p className="min-w-0 flex-1 text-sm font-medium">{toast.message}</p>
              <Button variant="ghost" size="icon" aria-label="Dismiss notification" onClick={() => dismiss(toast.id)}>
                <X aria-hidden="true" className="h-4 w-4" />
              </Button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
}
