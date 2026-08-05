package domain

import (
	"context"
	"errors"
	"time"
)

// ErrPermissionNotFound is returned when no explicit or inherited permission exists for a user.
var ErrPermissionNotFound = errors.New("permission not found")

// File represents both files and directories in the `files` table. The
// is_directory flag discriminates them; parent_id forms the folder hierarchy
// (adjacency-list model).
type File struct {
	ID               string     `json:"id"`
	UserID           string     `json:"user_id"`
	Name             string     `json:"name"`
	ParentID         *string    `json:"parent_id,omitempty"`
	IsDirectory      bool       `json:"is_directory"`
	SizeBytes        int64      `json:"size_bytes"`
	CreatedAt        time.Time  `json:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at"`
	DeletedAt        *time.Time `json:"deleted_at,omitempty"`
	AggregateSize    *int64     `json:"aggregate_size,omitempty"`
	ItemCount        *int64     `json:"item_count,omitempty"`
	OriginalLocation *string    `json:"original_location,omitempty"`
	SharedAt         *time.Time `json:"shared_at,omitempty"`
	TargetID         *string    `json:"target_id,omitempty"`
	Role             string     `json:"role,omitempty"`
}

// StorageCategoryUsage breaks down byte usage by file type.
type StorageCategoryUsage struct {
	Images    int64 `json:"images"`
	Documents int64 `json:"documents"`
	Media     int64 `json:"media"`
	Code      int64 `json:"code"`
	Other     int64 `json:"other"`
}

// UserStorageUsage represents real database-calculated storage metrics.
type UserStorageUsage struct {
	TotalUsedBytes      int64                `json:"total_used_bytes"`
	StorageLimit        int64                `json:"storage_limit_bytes"`
	ActiveSessionsCount int                  `json:"active_sessions_count"`
	Categories          StorageCategoryUsage `json:"categories"`
}

// BulkDeleteRequest represents POST /api/files/bulk/delete or DELETE /api/files/bulk/permanent.
type BulkDeleteRequest struct {
	IDs []string `json:"ids"`
}

// BulkRestoreRequest represents POST /api/files/bulk/restore.
type BulkRestoreRequest struct {
	IDs []string `json:"ids"`
}

// BulkMoveRequest represents POST /api/files/bulk/move.
type BulkMoveRequest struct {
	IDs      []string `json:"ids"`
	ParentID *string  `json:"parent_id"`
}

// BulkShareRequest represents POST /api/files/bulk/share.
type BulkShareRequest struct {
	IDs          []string `json:"ids"`
	GranteeEmail string   `json:"grantee_email"`
	Role         string   `json:"role"`
}

// FileRepository abstracts persistence for File aggregates.
type FileRepository interface {
	// Create inserts a new file or directory row.
	Create(ctx context.Context, file *File) error
	// GetByID returns the file with the given id, or an error wrapping
	// sql.ErrNoRows when not found.
	GetByID(ctx context.Context, id string) (*File, error)
	// GetResolvedPermission checks permissions recursively up the folder tree.
	GetResolvedPermission(ctx context.Context, fileID string, userEmail string) (string, error)
	// GetFolderByNameAndParent checks if a non-deleted directory with name and parentID exists for user.
	GetFolderByNameAndParent(ctx context.Context, userID, name string, parentID *string) (*File, error)
	// ListDirectory returns the immediate children of parentID for a user.
	// A nil parentID lists the user's root (top-level) entries.
	ListDirectory(ctx context.Context, userID string, parentID *string) ([]*File, error)
	// ListTrash returns all files/directories owned by user where deleted_at IS NOT NULL.
	ListTrash(ctx context.Context, userID string) ([]*File, error)
	// GetDescendants recursively retrieves all non-deleted files and subfolders nested under rootID.
	GetDescendants(ctx context.Context, rootID string) ([]*File, error)
	// GetSubtreeForItems recursively finds all nested files inside multiple file/folder roots and calculates their relative path.
	GetSubtreeForItems(ctx context.Context, ids []string) ([]*ZippableFile, error)
	// SoftDelete recursively sets deleted_at = CURRENT_TIMESTAMP for rootID and all nested descendants.
	SoftDelete(ctx context.Context, rootID string, userID string) error
	// BulkSoftDelete soft-deletes multiple file/folder roots in a single transaction.
	BulkSoftDelete(ctx context.Context, ids []string, userID string) error
	// Restore recursively sets deleted_at = NULL for rootID and all nested descendants.
	Restore(ctx context.Context, rootID string, userID string) error
	// BulkRestore restores multiple file/folder roots in a single transaction.
	BulkRestore(ctx context.Context, ids []string, userID string) error
	// BulkMove updates parent_id for multiple specified file IDs.
	BulkMove(ctx context.Context, ids []string, parentID *string, userID string) error
	// Update changes a file/folder's name and/or parent_id, refreshing
	// updated_at. Either field may be omitted by passing the zero value of the
	// pointer (nil parentID means "move to root"; empty name means "leave
	// unchanged"). The updated row is read back onto file.
	Update(ctx context.Context, file *File) error
	// IsDescendant reports whether candidateID is the same as ancestorID or
	// nested anywhere beneath it in the folder tree. Used to reject moves that
	// would create a parent-cycle (moving a folder into itself or one of its
	// own descendants).
	IsDescendant(ctx context.Context, candidateID, ancestorID string) (bool, error)
	// DeleteRecursive removes a file/folder and, for directories, every nested
	// descendant. It runs against the receiver's DBTX (use WithTx to enroll it
	// in a caller-owned transaction). file_blocks and permissions rows are
	// purged by the schema's ON DELETE CASCADE.
	//
	// It returns the number of file rows removed and the sha256 hashes of
	// blocks that became orphaned (no remaining file_blocks references) as a
	// result of the delete — the caller deletes those physical objects from
	// storage as garbage collection.
	DeleteRecursive(ctx context.Context, rootID string) (deletedCount int64, orphanedBlockHashes []string, err error)
	// BulkHardDelete recursively hard-deletes multiple file/folder roots and compiles orphaned block hashes.
	BulkHardDelete(ctx context.Context, ids []string, userID string) (deletedCount int64, orphanedBlockHashes []string, err error)
}

// ZippableFile represents a nested file returned by the recursive CTE for archiving.
type ZippableFile struct {
	FileID       string
	RelativePath string
	Size_Bytes   int64
	TargetID     *string
}

