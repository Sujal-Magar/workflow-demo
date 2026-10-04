import { cn } from "@/lib/cn";

interface PaginationControlsProps {
  page: number;
  total: number;
  limit: number;
  onPageChange: (page: number) => void;
}

export function PaginationControls({ page, total, limit, onPageChange }: Readonly<PaginationControlsProps>) {
  const pageCount = Math.max(1, Math.ceil(total / limit));
  const isFirstPage = page <= 1;
  const isLastPage = page >= pageCount;
  const pages = Array.from({ length: pageCount }, (_, index) => index + 1);

  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-center gap-2 py-6">
      <button
        type="button"
        disabled={isFirstPage}
        onClick={() => onPageChange(page - 1)}
        className="h-10 rounded-md border border-gray-300 bg-white px-4 text-sm font-medium text-brand-ink hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Prev
      </button>
      {pages.map((pageNumber) => (
        <button
          key={pageNumber}
          type="button"
          aria-current={pageNumber === page ? "page" : undefined}
          onClick={() => onPageChange(pageNumber)}
          className={cn(
            "h-10 w-10 rounded-md border text-sm font-medium",
            pageNumber === page
              ? "border-brand-teal bg-brand-teal text-white"
              : "border-gray-300 bg-white text-brand-ink hover:bg-slate-50"
          )}
        >
          {pageNumber}
        </button>
      ))}
      <button
        type="button"
        disabled={isLastPage}
        onClick={() => onPageChange(page + 1)}
        className="h-10 rounded-md border border-gray-300 bg-white px-4 text-sm font-medium text-brand-ink hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Next
      </button>
    </nav>
  );
}
