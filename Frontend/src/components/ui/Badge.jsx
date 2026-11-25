import { cn } from '../../utils/cn';

const styles = {
  neutral: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-100',
  success: 'bg-success-light text-success dark:bg-green-950 dark:text-green-300',
  warning: 'bg-warning-light text-warning dark:bg-amber-950 dark:text-amber-300',
  danger: 'bg-danger-light text-danger dark:bg-red-950 dark:text-red-300',
  primary: 'bg-primary-light text-primary dark:bg-indigo-950 dark:text-indigo-200',
};

export function Badge({ tone = 'neutral', className, ...props }) {
  return <span className={cn('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold', styles[tone], className)} {...props} />;
}
