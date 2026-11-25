import { Search, X } from 'lucide-react';
import { Input } from './Input';
import { Button } from './Button';

export function SearchInput({ value, onChange, onClear, label = 'Search', placeholder = 'Search…', ...props }) {
  return (
    <div className="relative w-full">
      <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted dark:text-muted-dark" />
      <Input
        label={label}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="pl-9 pr-12"
        {...props}
      />
      {value && (
        <Button
          variant="ghost"
          size="icon"
          aria-label="Clear search"
          className="absolute bottom-0 right-1"
          onClick={onClear}
        >
          <X aria-hidden="true" className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
