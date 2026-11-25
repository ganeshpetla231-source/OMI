import { useId } from 'react';
import { cn } from '../../utils/cn';

export function Checkbox({ label, id, className, ...props }) {
  const generatedId = useId();
  const checkboxId = id || generatedId;
  return (
    <div className={cn('flex min-h-touch items-center gap-3', className)}>
      <input
        id={checkboxId}
        type="checkbox"
        className="h-5 w-5 rounded border-slate-300 text-primary focus:ring-2 focus:ring-primary/30 dark:border-slate-600"
        {...props}
      />
      {label && <label htmlFor={checkboxId} className="cursor-pointer text-sm text-slate-800 dark:text-slate-100">{label}</label>}
    </div>
  );
}
