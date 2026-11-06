import { api } from "./client";
import type { components } from "./schema";

export type MonthlyReport = components["schemas"]["MonthlyReport"];
export type HouseMonth = components["schemas"]["HouseMonth"];

function parseApiError(error: unknown, status: number, defaultMsg: string): Error {
  let message = defaultMsg;
  const err = error as { detail?: unknown };
  if (typeof err === "object" && err !== null && "detail" in err) {
    if (typeof err.detail === "string") {
      message = err.detail;
    } else if (Array.isArray(err.detail) && err.detail[0]?.msg) {
      message = err.detail[0].msg;
    }
  }
  return new Error(message || `${defaultMsg} (${status})`);
}

export async function getMonthlyReportApi(
  year: number,
  month: number
): Promise<MonthlyReport> {
  const result = await api.GET("/reports/monthly", {
    params: {
      query: {
        year,
        month,
      },
    },
  });

  if (result.data) {
    return result.data;
  }

  throw parseApiError(result.error, result.response.status, "Failed to load monthly report");
}

