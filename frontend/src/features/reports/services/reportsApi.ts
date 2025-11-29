import { baseApi } from '@services/baseApi';
import type {
  ReportQueryParams,
  ToolInventoryReport,
  CheckoutHistoryReport,
  CalibrationReport,
  DepartmentUsageReport,
  ChemicalInventoryReport,
  ChemicalExpirationReport,
  ChemicalUsageReport,
  ChemicalWasteReport,
  KitInventoryReport,
  KitIssuanceReport,
  KitTransferReport,
  KitReorderReport,
  ProcurementOrderReport,
  UserRequestReport,
  UserActivityReport,
  SystemStatsReport,
  AuditLogReport,
  ExportFormat,
} from '../types';

export const reportsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // ========================================================================
    // Tool Reports
    // ========================================================================

    getToolInventoryReport: builder.query<ToolInventoryReport, ReportQueryParams | void>({
      query: (params) => ({
        url: '/api/reports/tools/inventory',
        params: params || {},
      }),
      providesTags: ['Tool'],
    }),

    getCheckoutHistoryReport: builder.query<CheckoutHistoryReport, ReportQueryParams | void>({
      query: (params) => ({
        url: '/api/reports/tools/checkouts',
        params: params || {},
      }),
      providesTags: ['Tool'],
    }),

    getCalibrationReport: builder.query<CalibrationReport, ReportQueryParams | void>({
      query: (params) => ({
        url: '/api/reports/tools/calibration',
        params: params || {},
      }),
      providesTags: ['Tool'],
    }),

    getDepartmentUsageReport: builder.query<DepartmentUsageReport, ReportQueryParams | void>({
      query: (params) => ({
        url: '/api/reports/tools/department-usage',
        params: params || {},
      }),
      providesTags: ['Tool', 'User'],
    }),

    // ========================================================================
    // Chemical Reports
    // ========================================================================

    getChemicalInventoryReport: builder.query<ChemicalInventoryReport, ReportQueryParams | void>({
      query: (params) => ({
        url: '/api/reports/chemicals/inventory',
        params: params || {},
      }),
      providesTags: ['Chemical'],
    }),

    getChemicalExpirationReport: builder.query<ChemicalExpirationReport, ReportQueryParams | void>({
      query: (params) => ({
        url: '/api/reports/chemicals/expiration',
        params: params || {},
      }),
      providesTags: ['Chemical'],
    }),

    getChemicalUsageReport: builder.query<ChemicalUsageReport, ReportQueryParams | void>({
      query: (params) => ({
        url: '/api/reports/chemicals/usage',
        params: params || {},
      }),
      providesTags: ['Chemical'],
    }),

    getChemicalWasteReport: builder.query<ChemicalWasteReport, ReportQueryParams | void>({
      query: (params) => ({
        url: '/api/reports/chemicals/waste',
        params: params || {},
      }),
      providesTags: ['Chemical'],
    }),

    // ========================================================================
    // Kit Reports
    // ========================================================================

    getKitInventoryReport: builder.query<KitInventoryReport, ReportQueryParams | void>({
      query: (params) => ({
        url: '/api/reports/kits/inventory',
        params: params || {},
      }),
      providesTags: ['Kit'],
    }),

    getKitIssuanceReport: builder.query<KitIssuanceReport, ReportQueryParams | void>({
      query: (params) => ({
        url: '/api/reports/kits/issuances',
        params: params || {},
      }),
      providesTags: ['Kit'],
    }),

    getKitTransferReport: builder.query<KitTransferReport, ReportQueryParams | void>({
      query: (params) => ({
        url: '/api/reports/kits/transfers',
        params: params || {},
      }),
      providesTags: ['Kit'],
    }),

    getKitReorderReport: builder.query<KitReorderReport, ReportQueryParams | void>({
      query: (params) => ({
        url: '/api/reports/kits/reorders',
        params: params || {},
      }),
      providesTags: ['Kit'],
    }),

    // ========================================================================
    // Order Reports
    // ========================================================================

    getProcurementOrderReport: builder.query<ProcurementOrderReport, ReportQueryParams | void>({
      query: (params) => ({
        url: '/api/reports/orders/procurement',
        params: params || {},
      }),
      providesTags: ['Order'],
    }),

    getUserRequestReport: builder.query<UserRequestReport, ReportQueryParams | void>({
      query: (params) => ({
        url: '/api/reports/orders/requests',
        params: params || {},
      }),
      providesTags: ['Request'],
    }),

    // ========================================================================
    // Admin Reports
    // ========================================================================

    getUserActivityReport: builder.query<UserActivityReport, ReportQueryParams | void>({
      query: (params) => ({
        url: '/api/reports/admin/user-activity',
        params: params || {},
      }),
      providesTags: ['User'],
    }),

    getSystemStatsReport: builder.query<SystemStatsReport, void>({
      query: () => '/api/reports/admin/system-stats',
      providesTags: ['User', 'Tool', 'Chemical', 'Kit', 'Order', 'Request'],
    }),

    getAuditLogReport: builder.query<AuditLogReport, ReportQueryParams | void>({
      query: (params) => ({
        url: '/api/reports/admin/audit-log',
        params: params || {},
      }),
      providesTags: ['User'],
    }),

    // ========================================================================
    // Export
    // ========================================================================

    exportReport: builder.mutation<Blob, { reportType: string; reportData: unknown; format: ExportFormat; timeframe?: string }>({
      query: ({ reportType, reportData, format, timeframe }) => ({
        url: `/api/reports/export/${format}`,
        method: 'POST',
        body: {
          report_type: reportType,
          report_data: reportData,
          timeframe: timeframe || 'month',
        },
        responseHandler: async (response) => {
          if (response.ok) {
            return response.blob();
          }
          throw new Error('Export failed');
        },
      }),
    }),
  }),
});

export const {
  // Tool Reports
  useGetToolInventoryReportQuery,
  useGetCheckoutHistoryReportQuery,
  useGetCalibrationReportQuery,
  useGetDepartmentUsageReportQuery,
  useLazyGetToolInventoryReportQuery,
  useLazyGetCheckoutHistoryReportQuery,
  useLazyGetCalibrationReportQuery,
  useLazyGetDepartmentUsageReportQuery,

  // Chemical Reports
  useGetChemicalInventoryReportQuery,
  useGetChemicalExpirationReportQuery,
  useGetChemicalUsageReportQuery,
  useGetChemicalWasteReportQuery,
  useLazyGetChemicalInventoryReportQuery,
  useLazyGetChemicalExpirationReportQuery,
  useLazyGetChemicalUsageReportQuery,
  useLazyGetChemicalWasteReportQuery,

  // Kit Reports
  useGetKitInventoryReportQuery,
  useGetKitIssuanceReportQuery,
  useGetKitTransferReportQuery,
  useGetKitReorderReportQuery,
  useLazyGetKitInventoryReportQuery,
  useLazyGetKitIssuanceReportQuery,
  useLazyGetKitTransferReportQuery,
  useLazyGetKitReorderReportQuery,

  // Order Reports
  useGetProcurementOrderReportQuery,
  useGetUserRequestReportQuery,
  useLazyGetProcurementOrderReportQuery,
  useLazyGetUserRequestReportQuery,

  // Admin Reports
  useGetUserActivityReportQuery,
  useGetSystemStatsReportQuery,
  useGetAuditLogReportQuery,
  useLazyGetUserActivityReportQuery,
  useLazyGetAuditLogReportQuery,

  // Export
  useExportReportMutation,
} = reportsApi;
