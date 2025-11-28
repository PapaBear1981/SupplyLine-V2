import { baseApi } from '@services/baseApi';
import type {
  Warehouse,
  WarehouseFormData,
  WarehousesListResponse,
  WarehousesQueryParams,
} from '../types';

export const warehousesApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getWarehouses: builder.query<WarehousesListResponse, WarehousesQueryParams | void>({
      query: (params) => {
        const queryParams = params || {};
        return {
          url: '/api/warehouses',
          params: {
            page: queryParams.page || 1,
            per_page: queryParams.per_page || 50,
            ...(queryParams.include_inactive !== undefined && {
              include_inactive: queryParams.include_inactive,
            }),
            ...(queryParams.warehouse_type && {
              warehouse_type: queryParams.warehouse_type,
            }),
          },
        };
      },
      providesTags: (result) =>
        result
          ? [
              ...result.warehouses.map(({ id }) => ({
                type: 'Warehouse' as const,
                id,
              })),
              { type: 'Warehouse', id: 'LIST' },
            ]
          : [{ type: 'Warehouse', id: 'LIST' }],
    }),

    getWarehouse: builder.query<Warehouse, number>({
      query: (id) => `/api/warehouses/${id}`,
      providesTags: (_result, _error, id) => [{ type: 'Warehouse', id }],
    }),

    createWarehouse: builder.mutation<Warehouse, WarehouseFormData>({
      query: (body) => ({
        url: '/api/warehouses',
        method: 'POST',
        body,
      }),
      invalidatesTags: [{ type: 'Warehouse', id: 'LIST' }],
    }),

    updateWarehouse: builder.mutation<Warehouse, { id: number; data: Partial<WarehouseFormData> }>(
      {
        query: ({ id, data }) => ({
          url: `/api/warehouses/${id}`,
          method: 'PUT',
          body: data,
        }),
        invalidatesTags: (_result, _error, { id }) => [
          { type: 'Warehouse', id },
          { type: 'Warehouse', id: 'LIST' },
        ],
      }
    ),

    deleteWarehouse: builder.mutation<void, number>({
      query: (id) => ({
        url: `/api/warehouses/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: [{ type: 'Warehouse', id: 'LIST' }],
    }),
  }),
});

export const {
  useGetWarehousesQuery,
  useGetWarehouseQuery,
  useCreateWarehouseMutation,
  useUpdateWarehouseMutation,
  useDeleteWarehouseMutation,
} = warehousesApi;
