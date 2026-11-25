import { cn } from '../../utils/cn';

export function Card({ className, ...props }) {
  return <section className={cn('rounded-2xl border border-slate-200 bg-surface p-5 shadow-sm dark:border-slate-700 dark:bg-surface-dark', className)} {...props} />;
}
