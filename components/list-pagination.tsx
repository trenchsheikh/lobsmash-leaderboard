"use client";

import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { buildPageList } from "@/lib/paginate";
import { cn } from "@/lib/utils";

type ListPaginationProps = {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
};

export function ListPagination({
  currentPage,
  totalPages,
  onPageChange,
  className,
}: ListPaginationProps) {
  if (totalPages <= 1) return null;

  const segments = buildPageList(currentPage, totalPages);
  const canPrev = currentPage > 1;
  const canNext = currentPage < totalPages;

  return (
    <Pagination className={cn("mt-4", className)}>
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            href="#"
            className={cn(!canPrev && "pointer-events-none opacity-50")}
            aria-disabled={!canPrev}
            onClick={(e) => {
              e.preventDefault();
              if (canPrev) onPageChange(currentPage - 1);
            }}
          />
        </PaginationItem>
        {segments.map((seg) =>
          seg.type === "ellipsis" ? (
            <PaginationItem key={seg.key}>
              <PaginationEllipsis />
            </PaginationItem>
          ) : (
            <PaginationItem key={seg.value}>
              <PaginationLink
                href="#"
                size="icon-sm"
                isActive={seg.value === currentPage}
                onClick={(e) => {
                  e.preventDefault();
                  onPageChange(seg.value);
                }}
              >
                {seg.value}
              </PaginationLink>
            </PaginationItem>
          ),
        )}
        <PaginationItem>
          <PaginationNext
            href="#"
            className={cn(!canNext && "pointer-events-none opacity-50")}
            aria-disabled={!canNext}
            onClick={(e) => {
              e.preventDefault();
              if (canNext) onPageChange(currentPage + 1);
            }}
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}
