import { api } from "./client";
import type { components } from "./schema";

export type Unit = components["schemas"]["UnitOut"];
export type UnitType = components["schemas"]["UnitType"];
export type UnitIn = components["schemas"]["UnitIn"];
export type UnitPatch = components["schemas"]["UnitPatch"];

function parseApiError(error: unknown, status: number, defaultMsg: string): Error {
  let message = defaultMsg;
  if (status === 409) {
    message = "This house already has a unit with that label";
  }
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

export async function getUnitsApi(params?: {
  house_id?: number;
  vacant?: boolean;
}): Promise<Unit[]> {
  const result = await api.GET("/units", {
    params: {
      query: {
        house_id: params?.house_id,
        vacant: params?.vacant,
      },
    },
  });

  if (result.data) {
    return result.data;
  }

  throw parseApiError(result.error, result.response.status, "Failed to load units");
}

export async function getUnitApi(unitId: number): Promise<Unit> {
  const result = await api.GET("/units/{unit_id}", {
    params: {
      path: {
        unit_id: unitId,
      },
    },
  });

  if (result.data) {
    return result.data;
  }

  throw parseApiError(result.error, result.response.status, "Failed to load unit");
}

export async function createUnitApi(data: UnitIn): Promise<Unit> {
  const result = await api.POST("/units", {
    body: data,
  });

  if (result.data) {
    return result.data;
  }

  throw parseApiError(result.error, result.response.status, "Failed to create unit");
}

export async function updateUnitApi(unitId: number, data: UnitPatch): Promise<Unit> {
  const result = await api.PATCH("/units/{unit_id}", {
    params: {
      path: {
        unit_id: unitId,
      },
    },
    body: data,
  });

  if (result.data) {
    return result.data;
  }

  throw parseApiError(result.error, result.response.status, "Failed to update unit");
}
