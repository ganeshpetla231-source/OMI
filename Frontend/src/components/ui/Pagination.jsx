import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './Button';

export function Pagination({
  page,
  pages,
  onPageChange,
  label = 'Pagination',
  previousLabel = 'Previous',
  nextLabel = 'Next',
  pageLabel = 'Page {page} of {pages}',
}) {
  if (!pages || pages <= 1) return null;
  return (
    <nav aria-label={label} className="flex items-center justify-center gap-3">
      <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
        <ChevronLeft aria-hidden="true" className="h-4 w-4" /> {previousLabel}
      </Button>
      <span aria-current="page" className="text-sm text-muted dark:text-muted-dark">{pageLabel.replace('{page}', page).replace('{pages}', pages)}</span>
      <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => onPageChange(page + 1)}>
        {nextLabel} <ChevronRight aria-hidden="true" className="h-4 w-4" />
      </Button>
    </nav>
  );
}
