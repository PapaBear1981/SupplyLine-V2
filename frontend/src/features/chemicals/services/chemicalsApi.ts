import { baseApi } from '@services/baseApi';
import type {
  Chemical,
  ChemicalFormData,
  ChemicalHistoryEvent,
  ChemicalIssuanceFormData,
  ChemicalIssuanceResponse,
  ChemicalsListResponse,
  ChemicalsQueryParams,
} from '../types';

export const chemicalsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getChemicals: builder.query<ChemicalsListResponse, ChemicalsQueryParams | void>({
      query: (params) => {
        const queryParams = params || {};
        return {
          url: '/api/chemicals',
          params: {
            page: queryParams.page || 1,
            per_page: queryParams.per_page || 50,
            ...(queryParams.q && { q: queryParams.q }),
            ...(queryParams.status && { status: queryParams.status }),
            ...(queryParams.category && { category: queryParams.category }),
            ...(queryParams.archived !== undefined && {
              archived: queryParams.archived,
            }),
          },
        };
      },
      providesTags: (result) =>
        result
          ? [
              ...result.chemicals.map(({ id }) => ({
                type: 'Chemical' as const,
                id,
              })),
              { type: 'Chemical', id: 'LIST' },
            ]
          : [{ type: 'Chemical', id: 'LIST' }],
    }),

    getChemical: builder.query<Chemical, number>({
      query: (id) => `/api/chemicals/${id}`,
      providesTags: (_result, _error, id) => [{ type: 'Chemical', id }],
    }),

    createChemical: builder.mutation<Chemical, ChemicalFormData>({
      query: (body) => ({
        url: '/api/chemicals',
        method: 'POST',
        body,
      }),
      invalidatesTags: [{ type: 'Chemical', id: 'LIST' }],
    }),

    updateChemical: builder.mutation<Chemical, { id: number; data: Partial<ChemicalFormData> }>(
      {
        query: ({ id, data }) => ({
          url: `/api/chemicals/${id}`,
          method: 'PUT',
          body: data,
        }),
        invalidatesTags: (_result, _error, { id }) => [
          { type: 'Chemical', id },
          { type: 'Chemical', id: 'LIST' },
        ],
      }
    ),

    deleteChemical: builder.mutation<void, number>({
      query: (id) => ({
        url: `/api/chemicals/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: [{ type: 'Chemical', id: 'LIST' }],
    }),

    issueChemical: builder.mutation<
      ChemicalIssuanceResponse,
      { id: number; data: ChemicalIssuanceFormData }
    >({
      query: ({ id, data }) => ({
        url: `/api/chemicals/${id}/issue`,
        method: 'POST',
        body: data,
      }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Chemical', id },
        { type: 'Chemical', id: 'LIST' },
      ],
    }),

    getChemicalHistory: builder.query<
      { chemical: Chemical; history: ChemicalHistoryEvent[]; total_issuances: number; total_child_lots: number },
      number
    >({
      query: (id) => `/api/chemicals/${id}/history`,
      providesTags: (_result, _error, id) => [{ type: 'Chemical', id }],
    }),
  }),
});

export const {
  useGetChemicalsQuery,
  useGetChemicalQuery,
  useCreateChemicalMutation,
  useUpdateChemicalMutation,
  useDeleteChemicalMutation,
  useIssueChemicalMutation,
  useGetChemicalHistoryQuery,
} = chemicalsApi;
