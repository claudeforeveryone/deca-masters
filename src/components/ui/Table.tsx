import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import type {
  HTMLAttributes,
  ReactNode,
  TdHTMLAttributes,
  ThHTMLAttributes,
} from "react";

/**
 * Data tables: 44px rows, a hairline between rows only, right-aligned tabular numbers (`numeric`), mono codes
 * (`code`), a sticky header. Wrap in TableFrame so a wide table scrolls inside itself, never the page.
 */
export function TableFrame({
  children,
  label,
  className = "",
}: {
  children: ReactNode;
  /** Names the scroll region for screen readers (and makes it keyboard scrollable) when the table can scroll. */
  label?: string;
  className?: string;
}) {
  return (
    <div
      role={label ? "region" : undefined}
      aria-label={label}
      tabIndex={label ? 0 : undefined}
      className={`max-w-full overflow-x-auto rounded border border-line bg-surface ${className}`}
    >
      {children}
    </div>
  );
}

export function Table({
  className = "",
  ...rest
}: HTMLAttributes<HTMLTableElement>) {
  return (
    <table
      {...rest}
      className={`w-full border-collapse text-left text-[0.95rem] ${className}`}
    />
  );
}

export function THead({
  className = "",
  ...rest
}: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      {...rest}
      className={`sticky top-0 z-1 border-b border-line bg-surface-2 text-micro font-semibold text-ink-2 ${className}`}
    />
  );
}

export function TBody({
  className = "",
  ...rest
}: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody {...rest} className={`divide-y divide-line ${className}`} />;
}

export function Tr({
  className = "",
  selected,
  ...rest
}: HTMLAttributes<HTMLTableRowElement> & { selected?: boolean }) {
  return (
    <tr
      {...rest}
      aria-selected={selected}
      className={`transition-colors duration-(--dur-1) hover:bg-surface-2/60 aria-selected:bg-surface-2 ${className}`}
    />
  );
}

type Align = { numeric?: boolean; code?: boolean };

export type SortDirection = "ascending" | "descending" | "none";

export function Th({
  numeric,
  sort,
  onSort,
  children,
  className = "",
  ...rest
}: ThHTMLAttributes<HTMLTableCellElement> &
  Align & {
    /** Current sort on this column. Pass with onSort to make the header a sort button. */
    sort?: SortDirection;
    onSort?: () => void;
  }) {
  const Icon =
    sort === "ascending"
      ? ArrowUp
      : sort === "descending"
        ? ArrowDown
        : ArrowUpDown;
  return (
    <th
      scope="col"
      aria-sort={onSort ? (sort ?? "none") : undefined}
      {...rest}
      className={`h-10 px-4 font-semibold whitespace-nowrap ${numeric ? "text-right" : ""} ${className}`}
    >
      {onSort ? (
        <button
          type="button"
          onClick={onSort}
          className={`-mx-1 inline-flex min-h-9 items-center gap-1.5 rounded-xs px-1 hover:text-ink ${numeric ? "flex-row-reverse" : ""}`}
        >
          {children}
          <Icon
            aria-hidden="true"
            className={`size-3.5 ${sort && sort !== "none" ? "text-link" : "text-ink-3"}`}
          />
        </button>
      ) : (
        children
      )}
    </th>
  );
}

export function Td({
  numeric,
  code,
  className = "",
  ...rest
}: TdHTMLAttributes<HTMLTableCellElement> & Align) {
  return (
    <td
      {...rest}
      className={`h-11 px-4 py-2 align-middle ${numeric ? "text-right font-mono tabular-nums" : ""} ${code ? "font-mono text-sm font-medium" : ""} ${className}`}
    />
  );
}
