import { baseApi } from './baseApi';

interface GenerateLotNumberResponse {
  lot_number: string;
  generated: boolean;
  message: string;
}

interface GenerateLotNumberRequest {
  override?: string;
}

export const inventoryApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    generateLotNumber: builder.mutation<GenerateLotNumberResponse, GenerateLotNumberRequest | void>({
      query: (body) => ({
        url: '/api/lot-numbers/generate',
        method: 'POST',
        body: body || {},
      }),
    }),
  }),
});

export const { useGenerateLotNumberMutation } = inventoryApi;
