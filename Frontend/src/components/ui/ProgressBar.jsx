import { cn } from '../../utils/cn';

export function ProgressBar({ value, label, className }) {
  const percentage = Math.min(100, Math.max(0, Number(value) || 0));
  return (
    <div className={cn('w-full', className)}>
      {label && <div className="mb-1 flex justify-between text-sm text-muted dark:text-muted-dark"><span>{label}</span><span>{percentage}%</span></div>}
      <div
        role="progressbar"
        aria-label={label || 'Progress'}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percentage}
        className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"
      >
        <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}
