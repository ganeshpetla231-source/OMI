import { LoaderCircle } from 'lucide-react';
import { cn } from '../../utils/cn';

export function Spinner({ label = 'Loading', className }) {
  return (
    <span role="status" className={cn('inline-flex items-center gap-2 text-sm text-muted dark:text-muted-dark', className)}>
      <LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin text-primary" />
      <span>{label}</span>
    </span>
  );
}
