import { baseApi } from '@services/baseApi';
import type { DashboardStats } from '../components/StatsCards';

export const dashboardApi = baseApi.injectEndpoints({
    endpoints: (builder) => ({
        getDashboardStats: builder.query<DashboardStats, void>({
            query: () => '/api/dashboard/stats',
        }),
        getRecentActivity: builder.query<any, void>({
            query: () => '/api/history/recent',
        }),
        getAnnouncements: builder.query<any, void>({
            query: () => '/api/announcements?active_only=true&limit=5',
        }),
        getLateOrders: builder.query<any, void>({
            query: () => '/api/orders/late-alerts?limit=5',
        }),
        getOverdueCalibrations: builder.query<any, void>({
            query: () => '/api/calibrations/overdue',
        }),
        getDueCalibrations: builder.query<any, void>({
            query: () => '/api/calibrations/due?days=7',
        }),
        getRecentOrders: builder.query<any, void>({
            query: () => '/api/orders?sort=created&limit=5',
        }),
        getRecentRequests: builder.query<any, void>({
            query: () => '/api/user-requests?sort=created&limit=5',
        }),
    }),
});

export const {
    useGetDashboardStatsQuery,
    useGetAnnouncementsQuery,
    useGetLateOrdersQuery,
    useGetOverdueCalibrationsQuery,
    useGetDueCalibrationsQuery,
    useGetRecentOrdersQuery,
    useGetRecentRequestsQuery,
} = dashboardApi;
