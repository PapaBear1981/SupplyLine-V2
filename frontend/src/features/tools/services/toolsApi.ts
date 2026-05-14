import { baseApi } from '@services/baseApi';
import type {
  Tool,
  ToolFormData,
  ToolsListResponse,
  ToolsQueryParams,
  ToolCalibration,
  ToolCheckout,
} from '../types';
import type { LabelSize, CodeType, LabelSizesResponse } from '@/types/label';

/**
 * Backend `/api/tools/{id}/calibrations` returns `{ calibrations, pagination }`,
 * but every consumer wants the bare array. Tolerate either shape so a future
 * backend change to a bare array doesn't break the UI.
 */
export type ToolCalibrationsResponse =
  | ToolCalibration[]
  | { calibrations: ToolCalibration[]; pagination?: unknown };

export const unwrapToolCalibrations = (
  response: ToolCalibrationsResponse
): ToolCalibration[] =>
  Array.isArray(response) ? response : response?.calibrations ?? [];

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
            ...(queryParams.sort_by && { sort_by: queryParams.sort_by }),
            ...(queryParams.order && { order: queryParams.order }),
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
      transformResponse: unwrapToolCalibrations,
      providesTags: (_result, _error, toolId) => [{ type: 'Tool', id: toolId }],
    }),

    // Add calibration record
    addToolCalibration: builder.mutation<
      { message: string; calibration: ToolCalibration },
      {
        toolId: number;
        data: {
          calibration_date: string;
          next_calibration_date?: string;
          calibration_status: 'pass' | 'fail' | 'limited';
          notes?: string;
        };
      }
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

    // Upload calibration certificate file (separate endpoint)
    uploadCalibrationCertificate: builder.mutation<
      { message: string; certificate: string },
      { calibrationId: number; toolId: number; file: File }
    >({
      query: ({ calibrationId, file }) => {
        const formData = new FormData();
        formData.append('certificate', file, file.name);
        return {
          url: `/api/calibrations/${calibrationId}/certificate`,
          method: 'POST',
          body: formData,
        };
      },
      invalidatesTags: (_result, _error, { toolId }) => [
        { type: 'Tool', id: toolId },
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

    /**
     * Print tool label as PDF
     * Generates a PDF label with barcode/QR code for the specified tool
     */
    printToolLabel: builder.mutation<Blob, {
      toolId: number;
      labelSize: LabelSize;
      codeType: CodeType;
    }>({
      query: ({ toolId, labelSize, codeType }) => ({
        url: `/api/barcode/tool/${toolId}`,
        params: {
          label_size: labelSize,
          code_type: codeType,
        },
        responseHandler: async (response: Response) => {
          if (!response.ok) {
            // Try to extract error message from response
            let errorMessage = 'Failed to generate label PDF';
            try {
              const errorData = await response.json();
              errorMessage = errorData.message || errorData.error || errorMessage;
            } catch {
              // Response is not JSON, use status text
              errorMessage = response.statusText || errorMessage;
            }
            throw new Error(errorMessage);
          }
          return response.blob();
        },
        // Prevent caching to ensure fresh label generation
        headers: {
          'Cache-Control': 'no-cache',
        },
      }),
    }),

    // Get available label sizes
    getLabelSizes: builder.query<LabelSizesResponse, void>({
      query: () => '/api/barcode/label-sizes',
    }),

    // Send a tool to a pre-registered field location (kit).
    sendToolToField: builder.mutation<
      ToolFieldDeploymentResponse,
      {
        toolId: number;
        kitId: number;
        notes?: string;
        expected_return_date?: string;
      }
    >({
      query: ({ toolId, kitId, notes, expected_return_date }) => ({
        url: `/api/tools/${toolId}/send-to-field`,
        method: 'POST',
        body: {
          kit_id: kitId,
          ...(notes !== undefined && { notes }),
          ...(expected_return_date !== undefined && { expected_return_date }),
        },
      }),
      invalidatesTags: (_result, _error, { toolId }) => [
        { type: 'Tool', id: toolId },
        { type: 'Tool', id: 'LIST' },
      ],
    }),

    // Return a tool from its active field deployment.
    returnToolFromField: builder.mutation<
      ToolFieldDeploymentResponse,
      { toolId: number; return_notes?: string }
    >({
      query: ({ toolId, return_notes }) => ({
        url: `/api/tools/${toolId}/return-from-field`,
        method: 'POST',
        body: return_notes !== undefined ? { return_notes } : {},
      }),
      invalidatesTags: (_result, _error, { toolId }) => [
        { type: 'Tool', id: toolId },
        { type: 'Tool', id: 'LIST' },
      ],
    }),

    // Field-deployment history for a tool.
    getToolFieldHistory: builder.query<ToolFieldHistoryResponse, number>({
      query: (toolId) => `/api/tools/${toolId}/field-history`,
      providesTags: (_result, _error, toolId) => [{ type: 'Tool', id: toolId }],
    }),
  }),
});

export interface ToolFieldDeploymentResponse {
  message: string;
  kit_tool_checkout: {
    id: number;
    tool_id: number;
    kit_id: number;
    kit_name: string | null;
    status: 'active' | 'returned';
    checkout_date: string | null;
    return_date: string | null;
  };
}

export interface ToolFieldHistoryEntry {
  id: number;
  tool_id: number;
  kit_id: number;
  kit_name: string | null;
  status: 'active' | 'returned';
  checkout_date: string | null;
  return_date: string | null;
  notes: string | null;
  return_notes: string | null;
}

export interface ToolFieldHistoryResponse {
  tool_id: number;
  active_deployment: ToolFieldHistoryEntry | null;
  active_kit: {
    kit_id: number;
    kit_name: string | null;
    aircraft_tail_number: string | null;
    tanker_scooper_number: string | null;
    trailer_number: string | null;
  } | null;
  history: ToolFieldHistoryEntry[];
  total: number;
}

export const {
  useGetToolsQuery,
  useGetToolQuery,
  useCreateToolMutation,
  useUpdateToolMutation,
  useDeleteToolMutation,
  useRetireToolMutation,
  useGetToolCalibrationsQuery,
  useAddToolCalibrationMutation,
  useUploadCalibrationCertificateMutation,
  useGetToolCheckoutsQuery,
  useSearchToolsQuery,
  useLazySearchToolsQuery,
  useGetToolBarcodeQuery,
  usePrintToolLabelMutation,
  useGetLabelSizesQuery,
  useSendToolToFieldMutation,
  useReturnToolFromFieldMutation,
  useGetToolFieldHistoryQuery,
} = toolsApi;
