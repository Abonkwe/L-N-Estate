import { api } from "./client";
import type { components } from "./schema";

export type DashboardData = components["schemas"]["Dashboard"];
export type LeaseItem = components["schemas"]["LeaseOut"];
export type VacantUnitItem = components["schemas"]["UnitOut"];
export type DashboardCounts = components["schemas"]["DashboardCounts"];

export async function getDashboardApi(expiringDays = 30): Promise<DashboardData> {
  const result = await api.GET("/dashboard", {
    params: {
      query: {
        expiring_days: expiringDays,
      },
    },
  });

  if (result.data) {
    return result.data;
  }

  throw new Error(`Failed to load dashboard data (${result.response.status})`);
}

