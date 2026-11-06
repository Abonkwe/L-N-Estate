import { api } from "./client";
import type { components } from "./schema";

export type PaymentIn = components["schemas"]["PaymentIn"];
export type PaymentOut = components["schemas"]["PaymentOut"];
export type PaymentPreview = components["schemas"]["PaymentPreview"];
export type PaymentMethod = components["schemas"]["PaymentMethod"];
export type VoidIn = components["schemas"]["VoidIn"];
export type AdjustmentIn = components["schemas"]["AdjustmentIn"];
export type AdjustmentOut = components["schemas"]["AdjustmentOut"];

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

export async function previewPaymentApi(
  data: PaymentIn,
  signal?: AbortSignal
): Promise<PaymentPreview> {
  const result = await api.POST("/payments/preview", {
    body: data,
    signal,
  });

  if (result.data) {
    return result.data;
  }

  throw parseApiError(result.error, result.response.status, "Failed to calculate preview");
}

export async function createPaymentApi(data: PaymentIn): Promise<PaymentOut> {
  const result = await api.POST("/payments", {
    body: data,
  });

  if (result.data) {
    return result.data;
  }

  throw parseApiError(result.error, result.response.status, "Failed to record payment");
}

export async function getPaymentsApi(
  leaseId?: number,
  includeVoid: boolean = true
): Promise<PaymentOut[]> {
  const result = await api.GET("/payments", {
    params: {
      query: {
        lease_id: leaseId,
        include_void: includeVoid,
      },
    },
  });

  if (result.data) {
    return result.data;
  }

  throw parseApiError(result.error, result.response.status, "Failed to load payments");
}

export async function voidPaymentApi(paymentId: number, data: VoidIn): Promise<PaymentOut> {
  const result = await api.POST("/payments/{payment_id}/void", {
    params: {
      path: {
        payment_id: paymentId,
      },
    },
    body: data,
  });

  if (result.data) {
    return result.data;
  }

  throw parseApiError(result.error, result.response.status, "Failed to void payment");
}

export async function createAdjustmentApi(data: AdjustmentIn): Promise<AdjustmentOut> {
  const result = await api.POST("/adjustments", {
    body: data,
  });

  if (result.data) {
    return result.data;
  }

  throw parseApiError(result.error, result.response.status, "Failed to record adjustment");
}

export async function getReceiptPdfBlob(paymentId: number): Promise<Blob> {
  const result = await api.GET("/payments/{payment_id}/receipt.pdf", {
    params: {
      path: {
        payment_id: paymentId,
      },
    },
    parseAs: "blob",
  });

  if (result.data) {
    return result.data as Blob;
  }

  throw parseApiError(result.error, result.response.status, "Failed to load receipt PDF");
}

export async function openReceiptPdf(paymentId: number): Promise<void> {
  const blob = await getReceiptPdfBlob(paymentId);
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
