import { useId } from 'react';
import { cn } from '../../utils/cn';

export function Select({ label, error, options = [], id, className, ...props }) {
  const generatedId = useId();
  const selectId = id || generatedId;
  const messageId = `${selectId}-message`;
  return (
    <div className="w-full">
      {label && <label htmlFor={selectId} className="mb-1.5 block text-sm font-medium text-slate-800 dark:text-slate-100">{label}</label>}
      <select
        id={selectId}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? messageId : undefined}
        className={cn('min-h-touch w-full rounded-lg border border-slate-300 bg-white px-3 text-base text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100', error && 'border-danger', className)}
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
      {error && <p id={messageId} role="alert" className="mt-1 text-sm text-danger">{error}</p>}
    </div>
  );
}
