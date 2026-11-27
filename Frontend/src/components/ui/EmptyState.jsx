import { Inbox } from 'lucide-react';

export function EmptyState({ title, description, action }) {
  return (
    <div className="flex flex-col items-center px-5 py-12 text-center">
      <Inbox aria-hidden="true" className="mb-3 h-9 w-9 text-muted dark:text-muted-dark" />
      <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h2>
      {description && <p className="mt-1 max-w-md text-sm text-muted dark:text-muted-dark">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
