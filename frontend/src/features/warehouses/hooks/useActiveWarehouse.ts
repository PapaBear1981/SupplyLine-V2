import { useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '@app/hooks';
import { setActiveWarehouse } from '../slices/activeWarehouseSlice';
import { useUpdateActiveWarehouseMutation } from '../services/activeWarehouseApi';
import { setCredentials } from '@features/auth/slices/authSlice';
import type { User } from '@features/users/types';

/**
 * Hook for reading and changing the user's active warehouse.
 *
 * Writes go through the server (POST /api/me/active-warehouse) which
 * re-issues the access token with the updated `active_warehouse_id`
 * claim. We then refresh the auth slice so the app's session state stays
 * in sync immediately.
 */
export function useActiveWarehouse() {
  const dispatch = useAppDispatch();
  const state = useAppSelector((s) => s.activeWarehouse);
  const user = useAppSelector((s) => s.auth.user) as User | null;
  const [update, updateStatus] = useUpdateActiveWarehouseMutation();

  const change = useCallback(
    async (warehouseId: number | null, warehouseName?: string | null) => {
      const result = await update({ warehouse_id: warehouseId }).unwrap();

      dispatch(
        setActiveWarehouse({
          id: result.active_warehouse_id,
          name: result.active_warehouse?.name ?? warehouseName ?? null,
        })
      );

      // Pull the freshly-issued JWT + updated user object back into auth.
      // Only include token/expiry when the server actually rotated the token —
      // dispatching { token: null } would clear the session in authSlice.
      if (user) {
        const payload: Parameters<typeof setCredentials>[0] = {
          user: {
            ...user,
            active_warehouse_id: result.active_warehouse_id,
            active_warehouse_name: result.active_warehouse?.name ?? null,
          },
        };
        if (result.tokens?.access_token) {
          payload.token = result.tokens.access_token;
          payload.expiresIn = result.tokens.expires_in;
        }
        dispatch(setCredentials(payload));
      }

      return result;
    },
    [dispatch, update, user]
  );

  return {
    activeWarehouseId: state.id,
    activeWarehouseName: state.name,
    setActiveWarehouse: change,
    isChanging: updateStatus.isLoading,
    error: updateStatus.error,
  };
}
