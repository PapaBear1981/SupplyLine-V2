/**
 * Types for concurrent update collision handling (optimistic locking)
 *
 * When two users try to update the same resource simultaneously, the backend
 * detects the conflict and returns a 409 response with details about the
 * conflict and the current state of the resource.
 */

/**
 * Details about a version conflict returned by the API
 */
export interface ConflictDetails {
  /** The current version of the resource in the database */
  current_version: number;
  /** The version that was provided in the update request */
  provided_version: number;
  /** The type of resource (e.g., "Chemical", "Tool", "Kit") */
  resource_type?: string;
  /** The ID of the resource */
  resource_id?: number;
}

/**
 * Error response structure for 409 Conflict errors
 */
export interface ConflictErrorResponse {
  /** Human-readable error message */
  error: string;
  /** Error code (always "version_conflict" for conflicts) */
  error_code: 'version_conflict';
  /** Detailed information about the conflict */
  conflict_details: ConflictDetails;
  /** Current state of the resource (for client refresh) */
  current_data?: Record<string, unknown>;
  /** Hint for resolving the conflict */
  hint?: string;
  /** Error reference ID for support */
  reference?: string;
}

/**
 * Options for resolving a conflict
 */
export type ConflictResolution =
  | 'refresh' // Discard local changes and refresh from server
  | 'force' // Force the update (overwrite server changes)
  | 'cancel'; // Cancel the operation

/**
 * Props for the conflict error modal component
 */
export interface ConflictModalProps {
  /** Whether the modal is visible */
  open: boolean;
  /** The conflict error response from the API */
  conflictError: ConflictErrorResponse | null;
  /** Resource type for display (e.g., "chemical", "tool") */
  resourceType: string;
  /** Callback when user chooses to refresh (discard local changes) */
  onRefresh: () => void;
  /** Callback when user chooses to force update (optional) */
  onForce?: () => void;
  /** Callback when user cancels the operation */
  onCancel: () => void;
  /** Whether the refresh/force operation is loading */
  loading?: boolean;
}

/**
 * Type guard to check if an error is a conflict error response
 */
export function isConflictError(error: unknown): error is { data: ConflictErrorResponse; status: 409 } {
  if (!error || typeof error !== 'object') return false;

  const err = error as Record<string, unknown>;
  if (err.status !== 409) return false;

  const data = err.data as Record<string, unknown> | undefined;
  if (!data || typeof data !== 'object') return false;

  return data.error_code === 'version_conflict';
}

/**
 * Extract conflict error from RTK Query error
 */
export function extractConflictError(error: unknown): ConflictErrorResponse | null {
  if (isConflictError(error)) {
    return (error as { data: ConflictErrorResponse }).data;
  }
  return null;
}

/**
 * Interface for versioned resources
 * Models that support optimistic locking should include this version field
 */
export interface Versioned {
  version: number;
}

/**
 * Helper type to add version to an existing type
 */
export type WithVersion<T> = T & Versioned;
