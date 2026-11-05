import { api } from "./client";
import type { components } from "./schema";

export type PaymentIn = components["schemas"]["PaymentIn"];
export type PaymentOut = components["schemas"]["PaymentOut"];
export type PaymentPreview = components["schemas"]["PaymentPreview"];
export type PaymentMethod = components["schemas"]["PaymentMethod"];

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

  let message = "Failed to calculate preview";
  const err = result.error as { detail?: unknown };
  if (typeof err === "object" && err !== null && "detail" in err) {
    if (typeof err.detail === "string") {
      message = err.detail;
    } else if (Array.isArray(err.detail) && err.detail[0]?.msg) {
      message = err.detail[0].msg;
    }
  }

  throw new Error(message || `Preview error (${result.response.status})`);
}

export async function createPaymentApi(data: PaymentIn): Promise<PaymentOut> {
  const result = await api.POST("/payments", {
    body: data,
  });

  if (result.data) {
    return result.data;
  }

  let message = "Failed to record payment";
  const err = result.error as { detail?: unknown };
  if (typeof err === "object" && err !== null && "detail" in err) {
    if (typeof err.detail === "string") {
      message = err.detail;
    } else if (Array.isArray(err.detail) && err.detail[0]?.msg) {
      message = err.detail[0].msg;
    }
  }

  throw new Error(message || `Payment error (${result.response.status})`);
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

  throw new Error(`Failed to load receipt PDF (${result.response.status})`);
}

