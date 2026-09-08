import { isValidElement, useMemo, useState, type ReactNode } from 'react';

export interface Column<T> {
  key: string;
  label: ReactNode;
  render?: (row: T) => ReactNode;
  /** 정렬 기준값 (없으면 row[key]). */
  sortValue?: (row: T) => number | string | null | undefined;
  align?: 'left' | 'right' | 'center';
  sortable?: boolean;
  width?: string;
}

interface Props<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T, i: number) => string | number;
  initialSort?: { key: string; dir: 'asc' | 'desc' };
  pageSize?: number;
  onRowClick?: (row: T) => void;
  selectedKey?: string | number | null;
  dense?: boolean;
  emptyText?: string;
  csvName?: string;
}

function cellValue<T>(row: T, col: Column<T>): number | string | null | undefined {
  if (col.sortValue) return col.sortValue(row);
  const v = (row as Record<string, unknown>)[col.key];
  if (v == null) return null;
  if (typeof v === 'number' || typeof v === 'string') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  return String(v);
}

/** CSV 헤더용 텍스트: 문자열이면 그대로, <Term>텍스트</Term> 같이 문자열 자식을 가진 요소면 그 텍스트, 아니면 key. */
function labelText(label: ReactNode, key: string): string {
  if (typeof label === 'string') return label;
  if (isValidElement<{ children?: unknown }>(label) && typeof label.props.children === 'string') return label.props.children;
  return key;
}
function toCsv<T>(columns: Column<T>[], rows: T[]): string {
  const esc = (s: unknown) => {
    const t = s == null ? '' : String(s);
    return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  const head = columns.map((c) => esc(labelText(c.label, c.key))).join(',');
  const body = rows.map((r) => columns.map((c) => esc(cellValue(r, c))).join(',')).join('\n');
  return `${head}\n${body}`;
}

/** 단순 정렬 테이블 (헤더 클릭 정렬, 페이지 크기 제한, CSV 내보내기). */
export default function DataTable<T>({
  columns,
  rows,
  rowKey,
  initialSort,
  pageSize,
  onRowClick,
  selectedKey,
  dense,
  emptyText = '데이터 없음',
  csvName,
}: Props<T>) {
  const [sort, setSort] = useState(initialSort ?? null);
  const [limit, setLimit] = useState(pageSize ?? Infinity);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col) return rows;
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const va = cellValue(a, col);
      const vb = cellValue(b, col);
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
      return String(va).localeCompare(String(vb), 'ko') * dir;
    });
  }, [rows, sort, columns]);

  const shown = sorted.slice(0, limit);

  const toggle = (key: string) => {
    setSort((s) => (s?.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' }));
  };

  const download = () => {
    const blob = new Blob([toCsv(columns, sorted)], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${csvName ?? 'table'}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const pad = dense ? 'px-2 py-1' : 'px-3 py-1.5';

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-md border border-neutral-200 dark:border-neutral-700">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-50 text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
            <tr>
              {columns.map((c) => {
                const sortable = c.sortable !== false;
                const active = sort?.key === c.key;
                return (
                  <th
                    key={c.key}
                    scope="col"
                    style={c.width ? { width: c.width } : undefined}
                    className={`${pad} whitespace-nowrap font-medium text-${c.align ?? 'left'} ${sortable ? 'cursor-pointer select-none hover:text-neutral-900 dark:hover:text-white' : ''}`}
                    onClick={sortable ? () => toggle(c.key) : undefined}
                    aria-sort={active ? (sort!.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                  >
                    {c.label}
                    {active && <span className="ml-1 text-[10px]">{sort!.dir === 'asc' ? '▲' : '▼'}</span>}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="p-4 text-center text-neutral-500">
                  {emptyText}
                </td>
              </tr>
            )}
            {shown.map((r, i) => {
              const k = rowKey(r, i);
              const sel = selectedKey != null && selectedKey === k;
              return (
                <tr
                  key={k}
                  onClick={onRowClick ? () => onRowClick(r) : undefined}
                  className={`border-t border-neutral-100 dark:border-neutral-800 ${onRowClick ? 'cursor-pointer hover:bg-blue-50 dark:hover:bg-neutral-800' : ''} ${sel ? 'bg-blue-50 dark:bg-neutral-800' : ''}`}
                >
                  {columns.map((c) => (
                    <td key={c.key} className={`${pad} whitespace-nowrap tabular-nums text-${c.align ?? 'left'}`}>
                      {c.render ? c.render(r) : (cellValue(r, c) ?? '—')}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between text-xs text-neutral-500">
        <span>
          {shown.length.toLocaleString()} / {rows.length.toLocaleString()} 행
        </span>
        <span className="flex gap-2">
          {shown.length < sorted.length && (
            <button type="button" className="underline" onClick={() => setLimit((l) => l + (pageSize ?? 50))}>
              더 보기
            </button>
          )}
          {rows.length > 0 && (
            <button type="button" className="underline" onClick={download}>
              CSV
            </button>
          )}
        </span>
      </div>
    </div>
  );
}
