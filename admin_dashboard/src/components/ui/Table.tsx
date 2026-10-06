import { forwardRef, HTMLAttributes, ReactNode } from "react"
import { cn } from "../../lib/utils"
import { Checkbox } from "./Checkbox"
import { Button } from "./Button"
import { motion } from "framer-motion"

interface Column<T> {
  key: string
  header: string
  render?: (row: T, index: number) => ReactNode
  className?: string
  sortable?: boolean
  width?: string
}

interface TableProps<T> {
  columns: Column<T>[]
  data: T[]
  keyExtractor: (row: T) => string | number
  isLoading?: boolean
  emptyMessage?: string
  onRowClick?: (row: T) => void
  selection?: {
    selectedKeys: Set<string | number>
    onSelectionChange: (keys: Set<string | number>) => void
  }
  className?: string
  rowClassName?: (row: T) => string
  pagination?: {
    page: number
    pageSize: number
    total: number
    onPageChange: (page: number) => void
    onPageSizeChange: (size: number) => void
  }
  sortConfig?: {
    key: string
    direction: "asc" | "desc"
  }
  onSort?: (key: string) => void
}

function Table<T>({
  columns,
  data,
  keyExtractor,
  isLoading,
  emptyMessage = "No data available",
  onRowClick,
  selection,
  className,
  rowClassName,
  pagination,
  sortConfig,
  onSort,
}: TableProps<T>) {
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc")
  const [sortKey, setSortKey] = useState<string>("")

  const handleSort = (key: string) => {
    if (onSort) {
      onSort(key)
    } else {
      if (sortKey === key) {
        setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"))
      } else {
        setSortKey(key)
        setSortDirection("asc")
      }
    }
  }

  const isSorted = (key: string) => sortKey === key
  const getSortIcon = (key: string) => {
    if (!isSorted(key)) return null
    return sortDirection === "asc" ? "↑" : "↓"
  }

  const handleSelectAll = () => {
    if (selection) {
      if (selection.selectedKeys.size === data.length) {
        selection.onSelectionChange(new Set())
      } else {
        selection.onSelectionChange(new Set(data.map(keyExtractor)))
      }
    }
  }

  const isAllSelected = selection && selection.selectedKeys.size === data.length && data.length > 0
  const isIndeterminate = selection && selection.selectedKeys.size > 0 && selection.selectedKeys.size < data.length

  if (isLoading) {
    return (
      <div className="rounded-lg border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                {selection && <th className="p-4 w-12" />}
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={cn(
                      "p-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider",
                      col.className
                    )}
                    style={{ width: col.width }}
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-border">
                  {selection && <td className="p-4 w-12" />}
                  {columns.map((col) => (
                    <td key={col.key} className={cn("p-4", col.className)}>
                      <div className="h-4 bg-muted animate-pulse rounded w-3/4" />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="rounded-lg border border-border overflow-hidden">
        <div className="p-12 text-center">
          <p className="text-muted-foreground">{emptyMessage}</p>
        </div>
      </div>
    )
  }

  return (
    <div className={cn("rounded-lg border border-border overflow-hidden", className)}>
      {selection && (
        <div className="px-4 py-3 border-b border-border bg-muted/50">
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>{selection.selectedKeys.size} selected</span>
            <Button variant="ghost" size="sm" onClick={() => selection.onSelectionChange(new Set())}>
              Clear
            </Button>
          </div>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full" role="grid">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              {selection && (
                <th className="p-4 w-12">
                  <Checkbox
                    id="select-all"
                    checked={isAllSelected}
                    onChange={handleSelectAll}
                    label=""
                    aria-label="Select all rows"
                  />
                </th>
              )}
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    "p-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider",
                    "hover:bg-muted/50 transition-colors",
                    col.sortable && "cursor-pointer select-none",
                    col.className
                  )}
                  style={{ width: col.width }}
                  onClick={col.sortable ? () => handleSort(col.key) : undefined}
                  aria-sort={isSorted(col.key) ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
                >
                  <div className="flex items-center gap-1.5">
                    {col.header}
                    {col.sortable && getSortIcon(col.key) && (
                      <span className="text-xs">{getSortIcon(col.key)}</span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, index) => {
              const rowKey = keyExtractor(row)
              const isSelected = selection?.selectedKeys.has(rowKey)
              return (
                <motion.tr
                  key={rowKey}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03, duration: 0.2 }}
                  className={cn(
                    "border-b border-border transition-colors",
                    "hover:bg-muted/50",
                    isSelected && "bg-primary/5",
                    onRowClick && "cursor-pointer",
                    rowClassName?.(row)
                  )}
                  onClick={() => onRowClick?.(row)}
                  role="row"
                  aria-selected={isSelected}
                >
                  {selection && (
                    <td className="p-4 w-12">
                      <Checkbox
                        id={`select-${rowKey}`}
                        checked={isSelected}
                        onChange={(checked) => {
                          const newKeys = new Set(selection.selectedKeys)
                          if (checked) newKeys.add(rowKey)
                          else newKeys.delete(rowKey)
                          selection.onSelectionChange(newKeys)
                        }}
                        label=""
                        aria-label={`Select row ${index + 1}`}
                      />
                    </td>
                  )}
                  {columns.map((col) => (
                    <td key={col.key} className={cn("p-4 align-top", col.className)}>
                      {col.render ? col.render(row, index) : (row as Record<string, unknown>)[col.key] as ReactNode}
                    </td>
                  ))}
                </motion.tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {pagination && (
        <div className="px-4 py-3 border-t border-border bg-muted/50 flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Showing {(pagination.page - 1) * pagination.pageSize + 1} to{" "}
            {Math.min(pagination.page * pagination.pageSize, pagination.total)} of{" "}
            {pagination.total} results
          </div>
          <div className="flex items-center gap-2">
            <select
              value={pagination.pageSize}
              onChange={(e) => pagination.onPageSizeChange(Number(e.target.value))}
              className="h-8 px-2 text-sm border border-input rounded-lg bg-background"
              aria-label="Page size"
            >
              {[10, 25, 50, 100].map((size) => (
                <option key={size} value={size}>
                  {size} per page
                </option>
              ))}
            </select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => pagination.onPageChange(pagination.page - 1)}
              disabled={pagination.page === 1}
              aria-label="Previous page"
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => pagination.onPageChange(pagination.page + 1)}
              disabled={pagination.page * pagination.pageSize >= pagination.total}
              aria-label="Next page"
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

import { useState } from "react"

export { Table }