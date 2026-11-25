import { cn } from '../../utils/cn';

export function Skeleton({ className, ...props }) {
  return <div aria-hidden="true" className={cn('animate-pulse rounded-lg bg-slate-200 dark:bg-slate-700', className)} {...props} />;
}
