import type { MouseEvent } from 'react'
import type { FileItem } from '../types/file'
import { getFileIcon, cn } from '../lib/format'
import { FileThumb } from './FileThumb'

interface GridViewProps {
  items: FileItem[]
  selectedIds?: Set<string>
  onToggleSelect?: (id: string) => void
  onSelectRange?: (id: string) => void
  onOpenFolder: (item: FileItem) => void
  onOpenFile?: (item: FileItem) => void
  /** Called on right-click to open the context menu. */
  onContextMenu: (item: FileItem, e: MouseEvent) => void
}

/**
 * Responsive card grid for file browsing. Cards show an icon preview area
 * and a truncated name label with checkbox selection overlays.
 */
export function GridView({
  items,
  selectedIds,
  onToggleSelect,
  onSelectRange,
  onOpenFolder,
  onOpenFile,
  onContextMenu,
}: GridViewProps) {
  return (
    <div className="flex-1 overflow-auto p-4">
      {items.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
          {items.map((item) => (
            <Card
              key={item.id}
              item={item}
              isSelected={selectedIds?.has(item.id) ?? false}
              onToggleSelect={onToggleSelect}
              onSelectRange={onSelectRange}
              onOpenFolder={onOpenFolder}
              onOpenFile={onOpenFile}
              onContextMenu={onContextMenu}
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface CardProps {
  item: FileItem
  isSelected: boolean
  onToggleSelect?: (id: string) => void
  onSelectRange?: (id: string) => void
  onOpenFolder: (f: FileItem) => void
  onOpenFile?: (f: FileItem) => void
  onContextMenu: (item: FileItem, e: MouseEvent) => void
}

function Card({
  item,
  isSelected,
  onToggleSelect,
  onSelectRange,
  onOpenFolder,
  onOpenFile,
  onContextMenu,
}: CardProps) {
  const icon = getFileIcon(item.name, item.is_directory)

  const handleClick = (e: MouseEvent) => {
    if (e.shiftKey && onSelectRange) {
      onSelectRange(item.id)
    } else if (onToggleSelect) {
      onToggleSelect(item.id)
    }
  }

  return (
    <div
      onClick={handleClick}
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
      role="button"
      aria-label={`${item.name}${item.is_directory ? ' (folder)' : ''}`}
      className={cn(
        'group relative flex flex-col items-center gap-3 rounded border bg-arch-900 p-3.5 shadow-sharp transition-all duration-150 cursor-default select-none',
        isSelected
          ? 'border-amber-500 bg-amber-500/10 ring-1 ring-amber-500/50'
          : 'border-arch-border hover:border-arch-700 hover:bg-arch-850/80',
      )}
    >
      {/* Selection checkbox overlay */}
      <div
        className={cn(
          'absolute top-2 left-2 transition-opacity',
          isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggleSelect?.(item.id)}
          className="h-3.5 w-3.5 rounded-xs border-arch-700 bg-arch-950 text-amber-500 focus:ring-amber-500/40"
          aria-label={`Select ${item.name}`}
        />
      </div>

      {/* Icon / preview area */}
      <FileThumb
        thumbnailUrl={item.thumbnail_url}
        iconVariant={icon}
        iconSize={item.is_directory ? 32 : 28}
        layout="grid"
      />

      {/* Name label */}
      <span className="w-full truncate text-center text-xs font-medium text-zinc-200 group-hover:text-white">
        {item.name}
      </span>
    </div>
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

export default GridView
