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
      // Scope changes invalidate tool & chemical lists so they re-fetch
      invalidatesTags: [
        { type: 'ActiveWarehouse', id: 'ME' },
        { type: 'Tool', id: 'LIST' },
        { type: 'Chemical', id: 'LIST' },
        { type: 'Transfer', id: 'LIST' },
        { type: 'User', id: 'ME' },
      ],
    }),
  }),
});

export const {
  useGetActiveWarehouseQuery,
  useUpdateActiveWarehouseMutation,
} = activeWarehouseApi;
