import type { AnalyticsFilters, DashboardAnalytics } from "./types";

export class AnalyticsApiError extends Error {
  constructor(public readonly status: number, public readonly code: string) { super(code); }
}

export const analyticsRepository = {
  async getDashboard(filters: AnalyticsFilters, page = 1, pageSize = 25): Promise<DashboardAnalytics> {
    const params = new URLSearchParams({ range: filters.dateRange, page: String(page), pageSize: String(pageSize) });
    for (const [key, value] of Object.entries(filters)) if (key !== "dateRange" && value !== "all") params.set(key, value);
    const response = await fetch(`/.netlify/functions/admin-analytics?${params}`, { credentials: "same-origin", headers: { accept: "application/json" } });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new AnalyticsApiError(response.status, typeof body?.error === "string" ? body.error : "server_error");
    return body.data as DashboardAnalytics;
  },
};
