import { api } from "./client";
import type { components } from "./schema";

export type LeaseItem = components["schemas"]["LeaseOut"];

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

  throw new Error(`Failed to load active leases (${result.response.status})`);
}

