import { api } from "./client";
import type { components } from "./schema";

export type House = components["schemas"]["HouseOut"];

export async function getHousesApi(): Promise<House[]> {
  const result = await api.GET("/houses");
  if (result.data) {
    return result.data;
  }
  throw new Error(`Failed to load houses (${result.response.status})`);
}
