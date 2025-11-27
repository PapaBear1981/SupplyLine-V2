import { baseApi } from '@services/baseApi';
import type {
  Tool,
  ToolFormData,
  ToolsListResponse,
  ToolsQueryParams,
  ToolCalibration,
  ToolCheckout,
} from '../types';

export const toolsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // Get paginated list of tools with optional filters
    getTools: builder.query<ToolsListResponse, ToolsQueryParams | void>({
      query: (params) => {
        const queryParams = params || {};
        return {
          url: '/api/tools',
          params: {
            page: queryParams.page || 1,
            per_page: queryParams.per_page || 50,
            ...(queryParams.q && { q: queryParams.q }),
            ...(queryParams.status && { status: queryParams.status }),
            ...(queryParams.category && { category: queryParams.category }),
            ...(queryParams.warehouse_id && { warehouse_id: queryParams.warehouse_id }),
            ...(queryParams.calibration_status && { calibration_status: queryParams.calibration_status }),
          },
        };
      },
      providesTags: (result) =>
        result
          ? [
              ...result.tools.map(({ id }) => ({ type: 'Tool' as const, id })),
              { type: 'Tool', id: 'LIST' },
            ]
          : [{ type: 'Tool', id: 'LIST' }],
    }),

    // Get single tool by ID
    getTool: builder.query<Tool, number>({
      query: (id) => `/api/tools/${id}`,
      providesTags: (_result, _error, id) => [{ type: 'Tool', id }],
    }),

    // Create new tool
    createTool: builder.mutation<Tool, ToolFormData>({
      query: (body) => ({
        url: '/api/tools',
        method: 'POST',
        body,
      }),
      invalidatesTags: [{ type: 'Tool', id: 'LIST' }],
    }),

    // Update existing tool
    updateTool: builder.mutation<Tool, { id: number; data: Partial<ToolFormData> }>({
      query: ({ id, data }) => ({
        url: `/api/tools/${id}`,
        method: 'PUT',
        body: data,
      }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Tool', id },
        { type: 'Tool', id: 'LIST' },
      ],
    }),

    // Delete tool
    deleteTool: builder.mutation<void, number>({
      query: (id) => ({
        url: `/api/tools/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: [{ type: 'Tool', id: 'LIST' }],
    }),

    // Retire tool with reason
    retireTool: builder.mutation<Tool, { id: number; reason: string }>({
      query: ({ id, reason }) => ({
        url: `/api/tools/${id}/retire`,
        method: 'POST',
        body: { reason },
      }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Tool', id },
        { type: 'Tool', id: 'LIST' },
      ],
    }),

    // Get tool calibration history
    getToolCalibrations: builder.query<ToolCalibration[], number>({
      query: (toolId) => `/api/tools/${toolId}/calibrations`,
      providesTags: (_result, _error, toolId) => [{ type: 'Tool', id: toolId }],
    }),

    // Add calibration record
    addToolCalibration: builder.mutation<
      ToolCalibration,
      { toolId: number; data: FormData }
    >({
      query: ({ toolId, data }) => ({
        url: `/api/tools/${toolId}/calibrations`,
        method: 'POST',
        body: data,
      }),
      invalidatesTags: (_result, _error, { toolId }) => [
        { type: 'Tool', id: toolId },
        { type: 'Tool', id: 'LIST' },
      ],
    }),

    // Get tool checkout history
    getToolCheckouts: builder.query<ToolCheckout[], number>({
      query: (toolId) => `/api/tools/${toolId}/checkouts`,
      providesTags: (_result, _error, toolId) => [{ type: 'Tool', id: toolId }],
    }),

    // Search tools
    searchTools: builder.query<Tool[], string>({
      query: (searchTerm) => ({
        url: '/api/tools/search',
        params: { q: searchTerm },
      }),
      providesTags: [{ type: 'Tool', id: 'LIST' }],
    }),

    // Get tool barcode/QR code
    getToolBarcode: builder.query<{ qr_code: string; barcode: string }, number>({
      query: (toolId) => `/api/tools/${toolId}/barcode`,
    }),
  }),
});

export const {
  useGetToolsQuery,
  useGetToolQuery,
  useCreateToolMutation,
  useUpdateToolMutation,
  useDeleteToolMutation,
  useRetireToolMutation,
  useGetToolCalibrationsQuery,
  useAddToolCalibrationMutation,
  useGetToolCheckoutsQuery,
  useSearchToolsQuery,
  useLazySearchToolsQuery,
  useGetToolBarcodeQuery,
} = toolsApi;
