import { baseApi } from '@services/baseApi';

export type BulkImportType = 'tools' | 'chemicals';

export interface BulkImportError {
  row: number;
  data: Record<string, unknown>;
  error: string;
}

export interface BulkImportSkipped {
  row: number;
  data: Record<string, unknown>;
  reason: string;
}

export interface BulkImportResponse {
  success_count: number;
  error_count: number;
  warning_count: number;
  skipped_count: number;
  errors: BulkImportError[];
  warnings: { row: number; data: Record<string, unknown>; warning: string }[];
  created_items: { data: Record<string, unknown>; created: Record<string, unknown> }[];
  skipped_items: BulkImportSkipped[];
  /** Master ChemicalPart numbers auto-created during this import. */
  created_master_parts?: string[];
  message: string;
}

interface BulkImportRequest {
  file: File;
  /** Skip rows that duplicate existing records. Defaults to true server-side. */
  skipDuplicates?: boolean;
  /**
   * Chemicals only: auto-create master ChemicalPart entries for any
   * part_number not already on the master list. Defaults to false.
   */
  createMissingParts?: boolean;
}

function toFormData(req: BulkImportRequest): FormData {
  const fd = new FormData();
  fd.append('file', req.file);
  if (req.skipDuplicates !== undefined) {
    fd.append('skip_duplicates', req.skipDuplicates ? 'true' : 'false');
  }
  if (req.createMissingParts !== undefined) {
    fd.append('create_missing_parts', req.createMissingParts ? 'true' : 'false');
  }
  return fd;
}

export const bulkImportApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    bulkImportTools: builder.mutation<BulkImportResponse, BulkImportRequest>({
      query: (req) => ({
        url: '/api/tools/bulk-import',
        method: 'POST',
        body: toFormData(req),
      }),
      invalidatesTags: ['Tool'],
    }),
    bulkImportChemicals: builder.mutation<BulkImportResponse, BulkImportRequest>({
      query: (req) => ({
        url: '/api/chemicals/bulk-import',
        method: 'POST',
        body: toFormData(req),
      }),
      invalidatesTags: ['Chemical'],
    }),
  }),
});

export const {
  useBulkImportToolsMutation,
  useBulkImportChemicalsMutation,
} = bulkImportApi;

/**
 * Download the CSV template for the given import type. Triggers a browser
 * save dialog. The template endpoints are admin-only, so we need to fetch
 * with the access token rather than navigating directly.
 */
export async function downloadTemplate(kind: BulkImportType): Promise<void> {
  const base = import.meta.env.VITE_API_BASE_URL ?? '';
  const path =
    kind === 'tools' ? '/api/tools/bulk-import/template' : '/api/chemicals/bulk-import/template';
  const token = localStorage.getItem('access_token');

  const resp = await fetch(`${base}${path}`, {
    credentials: 'include',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!resp.ok) {
    throw new Error(`Failed to download template (${resp.status})`);
  }
  const blob = await resp.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = kind === 'tools' ? 'tool_import_template.csv' : 'chemical_import_template.csv';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
