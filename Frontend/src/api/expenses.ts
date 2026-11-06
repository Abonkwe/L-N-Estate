import { api } from "./client";
import type { components } from "./schema";

export type ExpenseIn = components["schemas"]["ExpenseIn"];
export type ExpenseOut = components["schemas"]["ExpenseOut"];
export type ExpensePatch = components["schemas"]["ExpensePatch"];
export type ExpenseCategory = components["schemas"]["ExpenseCategory"];

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

export async function getExpensesApi(params?: {
  house_id?: number | null;
  category?: ExpenseCategory | null;
  date_from?: string | null;
  date_to?: string | null;
}): Promise<ExpenseOut[]> {
  const result = await api.GET("/expenses", {
    params: {
      query: {
        house_id: params?.house_id ?? undefined,
        category: params?.category ?? undefined,
        date_from: params?.date_from ?? undefined,
        date_to: params?.date_to ?? undefined,
      },
    },
  });

  if (result.data) {
    return result.data;
  }

  throw parseApiError(result.error, result.response.status, "Failed to load expenses");
}

export async function createExpenseApi(data: ExpenseIn): Promise<ExpenseOut> {
  const result = await api.POST("/expenses", {
    body: data,
  });

  if (result.data) {
    return result.data;
  }

  throw parseApiError(result.error, result.response.status, "Failed to record expense");
}

export async function updateExpenseApi(
  expenseId: number,
  data: ExpensePatch
): Promise<ExpenseOut> {
  const result = await api.PATCH("/expenses/{expense_id}", {
    params: {
      path: {
        expense_id: expenseId,
      },
    },
    body: data,
  });

  if (result.data) {
    return result.data;
  }

  throw parseApiError(result.error, result.response.status, "Failed to update expense");
}

