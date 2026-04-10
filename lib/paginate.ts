/** Rows per page for leaderboards, members, roster, friends table. */
export const PAGE_SIZE = 15;

export type PageSegment =
  | { type: "page"; value: number }
  | { type: "ellipsis"; key: string };

export function slicePage<T>(items: readonly T[], page: number, pageSize: number) {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const slice = items.slice(startIndex, startIndex + pageSize);
  return { slice, totalPages, startIndex, safePage };
}

/** Page numbers and ellipses for shadcn Pagination (compact when many pages). */
export function buildPageList(current: number, totalPages: number): PageSegment[] {
  if (totalPages <= 1) return [];
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => ({
      type: "page" as const,
      value: i + 1,
    }));
  }

  const pages = new Set<number>();
  pages.add(1);
  pages.add(totalPages);
  for (let i = current - 1; i <= current + 1; i++) {
    if (i >= 1 && i <= totalPages) pages.add(i);
  }

  const sorted = [...pages].sort((a, b) => a - b);
  const out: PageSegment[] = [];
  let prev = 0;
  for (const p of sorted) {
    if (p - prev > 1) {
      out.push({ type: "ellipsis", key: `e-${prev}-${p}` });
    }
    out.push({ type: "page", value: p });
    prev = p;
  }
  return out;
}
