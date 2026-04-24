import { baseApi } from '@services/baseApi';
import type { Warehouse } from '../types';

interface ActiveWarehouseResponse {
  active_warehouse: Warehouse | null;
  active_warehouse_id: number | null;
}

interface SetActiveWarehouseResponse {
  message: string;
  active_warehouse_id: number | null;
  active_warehouse: Warehouse | null;
  tokens?: {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    token_type: string;
  };
}

export const activeWarehouseApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getActiveWarehouse: builder.query<ActiveWarehouseResponse, void>({
      query: () => ({ url: '/api/me/active-warehouse' }),
      providesTags: [{ type: 'ActiveWarehouse', id: 'ME' }],
    }),

    updateActiveWarehouse: builder.mutation<
      SetActiveWarehouseResponse,
      { warehouse_id: number | null }
    >({
      query: (body) => ({
        url: '/api/me/active-warehouse',
        method: 'POST',
        body,
      }),
      // Invalidate every warehouse-scoped cache so each list re-fetches with
      // the new JWT after the switch. Checkout tags cover the tool-checkout
      // page (active / overdue / due-today / my / stats) and audit history.
      invalidatesTags: [
        { type: 'ActiveWarehouse', id: 'ME' },
        { type: 'Tool', id: 'LIST' },
        { type: 'Chemical', id: 'LIST' },
        { type: 'Transfer' as const },   // clears inbound, outbound, list (all warehouses)
        { type: 'User', id: 'ME' },
        { type: 'Checkout', id: 'ACTIVE' },
        { type: 'Checkout', id: 'OVERDUE' },
        { type: 'Checkout', id: 'DUE_TODAY' },
        { type: 'Checkout', id: 'MY' },
        { type: 'Checkout', id: 'STATS' },
        { type: 'Checkout', id: 'LIST' },
        { type: 'Checkout', id: 'HISTORY' },
      ],
    }),
  }),
});

export const {
  useGetActiveWarehouseQuery,
  useUpdateActiveWarehouseMutation,
} = activeWarehouseApi;
