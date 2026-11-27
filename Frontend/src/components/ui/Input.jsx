import { useId } from 'react';
import { cn } from '../../utils/cn';

export function Input({ label, error, hint, id, className, ...props }) {
  const generatedId = useId();
  const inputId = id || generatedId;
  const messageId = `${inputId}-message`;
  return (
    <div className="w-full">
      {label && <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-slate-800 dark:text-slate-100">{label}</label>}
      <input
        id={inputId}
        aria-invalid={Boolean(error)}
        aria-describedby={error || hint ? messageId : undefined}
        className={cn(
          'min-h-touch w-full rounded-lg border border-slate-300 bg-white px-3 text-base text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:bg-slate-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:disabled:bg-slate-800',
          error && 'border-danger focus:border-danger focus:ring-danger/20',
          className,
        )}
        {...props}
      />
      {(error || hint) && <p id={messageId} className={cn('mt-1 text-sm', error ? 'text-danger' : 'text-muted dark:text-muted-dark')} role={error ? 'alert' : undefined}>{error || hint}</p>}
    </div>
  );
}
