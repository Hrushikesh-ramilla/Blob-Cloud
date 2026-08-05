import type { MouseEvent } from 'react'
import type { FileItem } from '../types/file'
import { formatFileSize, formatDate, getFileIcon, cn } from '../lib/format'
import { FileThumb } from './FileThumb'

interface ListViewProps {
  items: FileItem[]
  selectedIds?: Set<string>
  isTrash?: boolean
  isShared?: boolean
  onToggleSelect?: (id: string) => void
  onSelectRange?: (id: string) => void
  onSelectAll?: () => void
  /** Called when a directory row is double-clicked. */
  onOpenFolder: (item: FileItem) => void
  /** Called when a file row is double-clicked to preview. */
  onOpenFile?: (item: FileItem) => void
  /** Called on right-click to open the context menu. */
  onContextMenu: (item: FileItem, e: MouseEvent) => void
}

/**
 * Table-style file listing with dynamic columns for My Drive and Trash views.
 * Single click selects item; double-clicking a folder row navigates into it;
 * right-click opens context menu.
 */
export function ListView({
  items,
  selectedIds,
  isTrash = false,
  isShared = false,
  onToggleSelect,
  onSelectRange,
  onSelectAll,
  onOpenFolder,
  onOpenFile,
  onContextMenu,
}: ListViewProps) {
  const allSelected = items.length > 0 && items.every((it) => selectedIds?.has(it.id))

  return (
    <div className="flex-1 overflow-auto select-none">
      {items.length === 0 ? (
        <EmptyState />
      ) : (
        <table className="w-full text-[11px] table-fixed" role="grid">
          <thead>
            <tr className="border-b border-arch-border bg-arch-950 text-left font-mono text-[9px] font-semibold uppercase tracking-[0.15em] text-zinc-500">
              <th className="pl-4 pr-1 py-2.5 w-10">
                {(selectedIds?.size ?? 0) > 0 && (
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={onSelectAll}
                    className="h-3.5 w-3.5 rounded-xs border-arch-700 bg-arch-950 text-amber-500 focus:ring-amber-500/40"
                    aria-label="Select all items"
                  />
                )}
              </th>
              <th className="pl-0 pr-4 py-2.5 w-full">NAME</th>
              {isTrash && <th className="px-4 py-2.5 w-[20%]">ORIGINAL LOCATION</th>}
              <th className="px-4 py-2.5 w-[20%]">{isTrash ? 'DATE DELETED' : isShared ? 'DATE SHARED' : 'DATE MODIFIED'}</th>
              {isTrash && <th className="px-4 py-2.5 w-[10%]">ITEMS</th>}
              <th className="px-4 py-2.5 w-[15%]">SIZE</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-arch-border/50">
            {items.map((item) => (
              <Row
                key={item.id}
                item={item}
                isSelected={selectedIds?.has(item.id) ?? false}
                isTrash={isTrash}
                onToggleSelect={onToggleSelect}
                onSelectRange={onSelectRange}
                onOpenFolder={onOpenFolder}
                onOpenFile={onOpenFile}
                onContextMenu={onContextMenu}
              />
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

interface RowProps {
  item: FileItem
  isSelected: boolean
  isTrash?: boolean
  onToggleSelect?: (id: string) => void
  onSelectRange?: (id: string) => void
  onOpenFolder: (f: FileItem) => void
  onOpenFile?: (f: FileItem) => void
  onContextMenu: (item: FileItem, e: MouseEvent) => void
}

function Row({
  item,
  isSelected,
  isTrash = false,
  onToggleSelect,
  onSelectRange,
  onOpenFolder,
  onOpenFile,
  onContextMenu,
}: RowProps) {
  const icon = getFileIcon(item.name, item.is_directory)

  const handleClick = (e: MouseEvent) => {
    if (e.shiftKey && onSelectRange) {
      onSelectRange(item.id)
    } else if (onToggleSelect) {
      onToggleSelect(item.id)
    }
  }

  return (
    <tr
      onClick={handleClick}
      className={cn(
        'group cursor-default transition-colors duration-150',
        isSelected
          ? 'bg-amber-500/10 border-l-2 border-l-amber-500'
          : 'hover:bg-arch-850/60',
      )}
      onDoubleClick={() => {
        if (item.is_directory) {
          onOpenFolder(item)
        } else if (onOpenFile) {
          onOpenFile(item)
        }
      }}
      onContextMenu={(e) => {
        if (onToggleSelect && !isSelected) {
          onToggleSelect(item.id)
        }
        onContextMenu(item, e)
      }}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && item.is_directory) onOpenFolder(item)
      }}
      role="row"
      aria-label={item.name}
    >
      {/* Checkbox */}
      <td className="pl-4 pr-1 py-2 w-10" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggleSelect?.(item.id)}
          className="h-3.5 w-3.5 rounded-xs border-arch-700 bg-arch-950 text-amber-500 focus:ring-amber-500/40"
          aria-label={`Select ${item.name}`}
        />
      </td>

      {/* Name */}
      <td className="pl-0 pr-4 py-2 w-full max-w-[200px] sm:max-w-[300px] md:max-w-[400px]">
        <div className="flex items-center gap-2 overflow-hidden">
          <FileThumb iconVariant={icon} iconSize={16} layout="row" />
          <span className="truncate text-zinc-200 font-medium text-sm group-hover:text-white" title={item.name}>{item.name}</span>
          {item.is_directory && (
            <span className="font-mono text-[9px] font-semibold uppercase tracking-wider text-amber-400/80 bg-amber-500/10 border border-amber-500/20 px-1 py-0.2 rounded-xs flex-shrink-0">
              DIR
            </span>
          )}
        </div>
      </td>

      {/* Original Location (Trash view) */}
      {isTrash && (
        <td className="px-4 py-2 font-mono text-zinc-400 truncate text-[10px]">
          {item.original_location ?? 'My Drive'}
        </td>
      )}

      {/* Date */}
      <td className="px-4 py-2 font-mono text-zinc-400 text-xs">
        {item.shared_at
          ? formatDate(item.shared_at)
          : formatDate((isTrash && item.deleted_at) ? item.deleted_at : item.updated_at)}
      </td>

      {/* Items Count (Trash view) */}
      {isTrash && (
        <td className="px-4 py-2 font-mono text-zinc-400 text-[10px]">
          {item.is_directory ? (item.item_count ?? 0) : '—'}
        </td>
      )}

      {/* Size */}
      <td className="px-4 py-2 font-mono text-zinc-400 text-xs">
        {item.is_directory
          ? isTrash && item.aggregate_size !== undefined
            ? formatFileSize(item.aggregate_size)
            : '—'
          : formatFileSize(item.size_bytes)}
      </td>
    </tr>
  )
}

function EmptyState() {
  return (
    <div className="flex h-full min-h-[320px] flex-col items-center justify-center gap-3 text-center px-4 select-none">
      <div className="flex h-12 w-12 items-center justify-center rounded border border-dashed border-arch-border bg-arch-900 shadow-sharp">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400" aria-hidden="true">
          <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
        </svg>
      </div>
      <div>
        <p className="font-display text-sm font-bold text-zinc-200">No Items Located</p>
        <p className="mt-1 font-mono text-[11px] text-zinc-500">Upload files or initialize a directory to populate this view.</p>
      </div>
    </div>
  )
}

export default ListView
