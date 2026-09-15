import { ChevronLeft, ChevronRight } from 'lucide-react';

export const PAGE_SIZE = 25;

// Client-side paging for lists the API already returns in full.
export function paginate(rows, page, pageSize = PAGE_SIZE) {
  const pageCount = Math.max(1, Math.ceil((rows?.length || 0) / pageSize));
  const currentPage = Math.min(Math.max(page, 1), pageCount);
  const start = (currentPage - 1) * pageSize;
  return { pageRows: rows ? rows.slice(start, start + pageSize) : [], currentPage, pageCount };
}

export default function Pagination({ page, pageCount, total, pageSize = PAGE_SIZE, onPageChange }) {
  if (total <= pageSize) return null;

  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 px-4 py-3 text-sm text-zinc-500">
      <span className="tabular-nums">
        Showing {first}–{last} of {total}
      </span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
        >
          <ChevronLeft className="h-4 w-4" strokeWidth={2} />Previous
        </button>
        <span className="px-2 tabular-nums">
          Page {page} of {pageCount}
        </span>
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= pageCount}
        >
          Next<ChevronRight className="h-4 w-4" strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
