import { api } from "./client";
import type { components } from "./schema";

export type House = components["schemas"]["HouseOut"];
export type HouseIn = components["schemas"]["HouseIn"];
export type HousePatch = components["schemas"]["HousePatch"];

function parseApiError(error: unknown, status: number, defaultMsg: string): Error {
  let message = defaultMsg;
  if (status === 409) {
    message = "A house with this name already exists";
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

export async function getHousesApi(): Promise<House[]> {
  const result = await api.GET("/houses");
  if (result.data) {
    return result.data;
  }
  throw parseApiError(result.error, result.response.status, "Failed to load houses");
}

export async function getHouseApi(houseId: number): Promise<House> {
  const result = await api.GET("/houses/{house_id}", {
    params: {
      path: {
        house_id: houseId,
      },
    },
  });
  if (result.data) {
    return result.data;
  }
  throw parseApiError(result.error, result.response.status, "Failed to load house");
}

export async function createHouseApi(data: HouseIn): Promise<House> {
  const result = await api.POST("/houses", {
    body: data,
  });
  if (result.data) {
    return result.data;
  }
  throw parseApiError(result.error, result.response.status, "Failed to create house");
}

export async function updateHouseApi(houseId: number, data: HousePatch): Promise<House> {
  const result = await api.PATCH("/houses/{house_id}", {
    params: {
      path: {
        house_id: houseId,
      },
    },
    body: data,
  });
  if (result.data) {
    return result.data;
  }
  throw parseApiError(result.error, result.response.status, "Failed to update house");
}
