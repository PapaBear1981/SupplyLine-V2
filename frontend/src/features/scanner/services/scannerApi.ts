import { baseApi } from '@services/baseApi';

export type ScannerItemType = 'tool' | 'chemical' | 'kit';

export interface ScannerLookupResponse {
  item_type: ScannerItemType;
  item_id: number;
  warning?: string;
  item_data: Record<string, unknown>;
}

export interface ScannerLookupRequest {
  code: string;
}

export const scannerApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    scannerLookup: builder.mutation<ScannerLookupResponse, ScannerLookupRequest>({
      query: (body) => ({
        url: '/api/scanner/lookup',
        method: 'POST',
        body,
      }),
    }),
  }),
});

export const { useScannerLookupMutation } = scannerApi;
