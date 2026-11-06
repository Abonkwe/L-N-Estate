import { api } from "./client";
import type { components } from "./schema";

export type Tenant = components["schemas"]["TenantOut"];
export type TenantIn = components["schemas"]["TenantIn"];
export type TenantPatch = components["schemas"]["TenantPatch"];
export type IdDocType = components["schemas"]["IdDocType"];

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

export async function getTenantsApi(searchQuery?: string): Promise<Tenant[]> {
  const result = await api.GET("/tenants", {
    params: {
      query: {
        q: searchQuery?.trim() || undefined,
      },
    },
  });

  if (result.data) {
    return result.data;
  }

  throw parseApiError(result.error, result.response.status, "Failed to load tenants");
}

export async function getTenantApi(tenantId: number): Promise<Tenant> {
  const result = await api.GET("/tenants/{tenant_id}", {
    params: {
      path: {
        tenant_id: tenantId,
      },
    },
  });

  if (result.data) {
    return result.data;
  }

  throw parseApiError(result.error, result.response.status, "Failed to load tenant details");
}

export async function createTenantApi(data: TenantIn): Promise<Tenant> {
  const result = await api.POST("/tenants", {
    body: data,
  });

  if (result.data) {
    return result.data;
  }

  throw parseApiError(result.error, result.response.status, "Failed to create tenant");
}

export async function updateTenantApi(tenantId: number, data: TenantPatch): Promise<Tenant> {
  const result = await api.PATCH("/tenants/{tenant_id}", {
    params: {
      path: {
        tenant_id: tenantId,
      },
    },
    body: data,
  });

  if (result.data) {
    return result.data;
  }

  throw parseApiError(result.error, result.response.status, "Failed to update tenant");
}

