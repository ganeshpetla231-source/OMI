import { cn } from '../../utils/cn';

export function Tabs({ items, value, onChange, label = 'Content sections', className }) {
  return (
    <div role="tablist" aria-label={label} className={cn('flex max-w-full gap-1 overflow-x-auto border-b border-slate-200 dark:border-slate-700', className)}>
      {items.map((item) => {
        const selected = item.value === value;
        return (
          <button
            key={item.value}
            id={`tab-${item.value}`}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={`panel-${item.value}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(item.value)}
            className={cn('min-h-touch whitespace-nowrap border-b-2 px-4 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary', selected ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-slate-900 dark:text-muted-dark dark:hover:text-white')}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
