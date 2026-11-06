import { api } from "./client";
import type { components } from "./schema";

export type LeaseItem = components["schemas"]["LeaseOut"];
export type LeaseDetail = components["schemas"]["LeaseDetail"];
export type LeaseIn = components["schemas"]["LeaseIn"];
export type LeaseStatus = components["schemas"]["LeaseStatus"];
export type RentSheetRow = components["schemas"]["RentSheetRow"];
export type TermIn = components["schemas"]["TermIn"];
export type TermOut = components["schemas"]["TermOut"];
export type LeaseEnd = components["schemas"]["LeaseEnd"];
export type DepositStatus = components["schemas"]["DepositStatus"];

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

export async function getActiveLeasesApi(): Promise<LeaseItem[]> {
  const result = await api.GET("/leases", {
    params: {
      query: {
        status: "active",
      },
    },
  });

  if (result.data) {
    return result.data;
  }

  throw parseApiError(result.error, result.response.status, "Failed to load active leases");
}

export async function getLeasesApi(params?: {
  status?: LeaseStatus | null;
  tenant_id?: number | null;
  unit_id?: number | null;
}): Promise<LeaseItem[]> {
  const result = await api.GET("/leases", {
    params: {
      query: {
        status: params?.status ?? undefined,
        tenant_id: params?.tenant_id ?? undefined,
        unit_id: params?.unit_id ?? undefined,
      },
    },
  });

  if (result.data) {
    return result.data;
  }

  throw parseApiError(result.error, result.response.status, "Failed to load leases");
}

export async function getLeaseApi(leaseId: number): Promise<LeaseDetail> {
  const result = await api.GET("/leases/{lease_id}", {
    params: {
      path: {
        lease_id: leaseId,
      },
    },
  });

  if (result.data) {
    return result.data;
  }

  throw parseApiError(result.error, result.response.status, "Failed to load lease details");
}

export async function createLeaseApi(data: LeaseIn): Promise<LeaseDetail> {
  const result = await api.POST("/leases", {
    body: data,
  });

  if (result.data) {
    return result.data;
  }

  // Handle 409 conflict specifically
  if (result.response.status === 409) {
    let msg = "This unit already has an active lease";
    const err = result.error as { detail?: unknown };
    if (typeof err === "object" && err !== null && typeof err.detail === "string") {
      msg = err.detail;
    }
    throw new Error(msg);
  }

  throw parseApiError(result.error, result.response.status, "Failed to create lease");
}

export async function getRentSheetApi(leaseId: number): Promise<RentSheetRow[]> {
  const result = await api.GET("/leases/{lease_id}/rent-sheet", {
    params: {
      path: {
        lease_id: leaseId,
      },
    },
  });

  if (result.data) {
    return result.data;
  }

  throw parseApiError(result.error, result.response.status, "Failed to load rent sheet");
}

export async function addRentTermApi(leaseId: number, data: TermIn): Promise<TermOut> {
  const result = await api.POST("/leases/{lease_id}/terms", {
    params: {
      path: {
        lease_id: leaseId,
      },
    },
    body: data,
  });

  if (result.data) {
    return result.data;
  }

  throw parseApiError(result.error, result.response.status, "Failed to record rent change");
}

export async function endLeaseApi(leaseId: number, data: LeaseEnd): Promise<LeaseDetail> {
  const result = await api.POST("/leases/{lease_id}/end", {
    params: {
      path: {
        lease_id: leaseId,
      },
    },
    body: data,
  });

  if (result.data) {
    return result.data;
  }

  throw parseApiError(result.error, result.response.status, "Failed to end lease");
}
