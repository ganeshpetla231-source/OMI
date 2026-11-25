import { AlertCircle } from 'lucide-react';
import { Button } from './Button';

export function ErrorState({ title = 'Something went wrong', message, onRetry, retryLabel = 'Retry' }) {
  return (
    <div role="alert" className="flex flex-col items-center px-5 py-12 text-center">
      <AlertCircle aria-hidden="true" className="mb-3 h-9 w-9 text-danger" />
      <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h2>
      {message && <p className="mt-1 max-w-md text-sm text-muted dark:text-muted-dark">{message}</p>}
      {onRetry && <Button className="mt-5" onClick={onRetry}>{retryLabel}</Button>}
    </div>
  );
}
