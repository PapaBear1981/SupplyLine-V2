/**
 * useConflictHandler Hook
 *
 * A custom hook for handling concurrent update conflicts (409 Conflict errors).
 * Provides state management and handlers for the conflict resolution workflow.
 *
 * Usage:
 * ```tsx
 * const {
 *   conflictError,
 *   isConflictModalOpen,
 *   handleError,
 *   handleRefresh,
 *   handleCancel,
 *   clearConflict,
 * } = useConflictHandler();
 *
 * // In your mutation handler:
 * try {
 *   await updateResource(data).unwrap();
 * } catch (error) {
 *   if (!handleError(error)) {
 *     // Handle non-conflict errors
 *   }
 * }
 * ```
 */

import { useState, useCallback } from 'react';
import { message } from 'antd';
import {
  isConflictError,
  extractConflictError,
  type ConflictErrorResponse,
} from '../types/conflict';

export interface UseConflictHandlerOptions {
  /** Callback to refresh/refetch the resource data */
  onRefresh?: () => void | Promise<void>;
  /** Resource type name for display messages */
  resourceType?: string;
  /** Custom message to show on conflict */
  conflictMessage?: string;
}

export interface UseConflictHandlerResult {
  /** The current conflict error, if any */
  conflictError: ConflictErrorResponse | null;
  /** Whether the conflict modal should be shown */
  isConflictModalOpen: boolean;
  /** Handle an error - returns true if it was a conflict error */
  handleError: (error: unknown) => boolean;
  /** Handle the refresh action from the modal */
  handleRefresh: () => Promise<void>;
  /** Handle the cancel action from the modal */
  handleCancel: () => void;
  /** Clear the conflict state */
  clearConflict: () => void;
  /** Whether a refresh operation is in progress */
  isRefreshing: boolean;
}

export function useConflictHandler(
  options: UseConflictHandlerOptions = {}
): UseConflictHandlerResult {
  const { onRefresh, resourceType = 'resource', conflictMessage } = options;

  const [conflictError, setConflictError] = useState<ConflictErrorResponse | null>(null);
  const [isConflictModalOpen, setIsConflictModalOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  /**
   * Handle an error - checks if it's a conflict error and shows the modal
   * Returns true if the error was a conflict error, false otherwise
   */
  const handleError = useCallback((error: unknown): boolean => {
    if (isConflictError(error)) {
      const conflictData = extractConflictError(error);
      setConflictError(conflictData);
      setIsConflictModalOpen(true);

      // Show a message notification
      message.warning(
        conflictMessage ||
          `This ${resourceType} was modified by another user. Please review the changes.`
      );

      return true;
    }
    return false;
  }, [resourceType, conflictMessage]);

  /**
   * Handle the refresh action - closes modal, refreshes data, and clears conflict
   */
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      if (onRefresh) {
        await onRefresh();
      }
      setIsConflictModalOpen(false);
      setConflictError(null);
      message.success(`${resourceType} data refreshed. Please review and retry your changes.`);
    } catch (refreshError) {
      message.error('Failed to refresh data. Please try again.');
      console.error('Failed to refresh after conflict:', refreshError);
    } finally {
      setIsRefreshing(false);
    }
  }, [onRefresh, resourceType]);

  /**
   * Handle the cancel action - closes modal but keeps conflict state
   * (in case user wants to manually resolve)
   */
  const handleCancel = useCallback(() => {
    setIsConflictModalOpen(false);
  }, []);

  /**
   * Clear all conflict state
   */
  const clearConflict = useCallback(() => {
    setConflictError(null);
    setIsConflictModalOpen(false);
    setIsRefreshing(false);
  }, []);

  return {
    conflictError,
    isConflictModalOpen,
    handleError,
    handleRefresh,
    handleCancel,
    clearConflict,
    isRefreshing,
  };
}

export default useConflictHandler;
