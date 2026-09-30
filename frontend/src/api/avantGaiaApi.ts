import type { AvantGaiaProfile, AvantGaiaRow, AvantGaiaVersementRow } from "../types";
import { fetchAllPages, request } from "./httpClient";

/**
 * Avant Gaïa — READ ONLY (the backend exposes no write endpoint for
 * avant_gaia / avant_gaia_versement).
 */
export const avantGaiaApi = {
  /** Profile + consommation + versements for one N° abonné. 404 → ApiError.isNotFound. */
  getClientProfile: (nAbonne: string, signal?: AbortSignal) =>
    request<AvantGaiaProfile>(`/api/avant-gaia/client/${encodeURIComponent(nAbonne)}`, { signal }),

  /** The whole `avant_gaia` table. */
  listDatabase: (signal?: AbortSignal) => request<AvantGaiaRow[]>("/api/avant-gaia/database", { signal }),

  /** The whole `avant_gaia_versement` table (paged under the hood). */
  listAllVersements: () =>
    fetchAllPages((skip, limit) => request<AvantGaiaVersementRow[]>("/api/avant-gaia/versements", { query: { skip, limit } })),
};
