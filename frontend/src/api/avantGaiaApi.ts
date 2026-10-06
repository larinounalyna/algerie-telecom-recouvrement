import type {
  AvantGaiaInsert,
  AvantGaiaProfile,
  AvantGaiaRow,
  AvantGaiaVersementInsert,
  AvantGaiaVersementRow,
  BulkInsertResult,
  DeleteAllResult,
} from "../types";
import { deletePasswordHeader, fetchAllPages, request } from "./httpClient";

/**
 * Avant Gaïa (« Hors Gaïa ») — reads, plus bulk insert (CSV import) and "vider la table" for both
 * tables. The deletes need the delete password (backend .env, header X-Delete-Password).
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

  /** Inserts one or many rows into `avant_gaia` (CSV import). All or nothing per request. */
  createRows: (rows: AvantGaiaInsert[]) => request<BulkInsertResult>("/api/avant-gaia", { method: "POST", body: rows }),

  /** Inserts one or many rows into `avant_gaia_versement` (CSV import). */
  createVersements: (rows: AvantGaiaVersementInsert[]) =>
    request<BulkInsertResult>("/api/avant-gaia/versements", { method: "POST", body: rows }),

  /** Empties `avant_gaia`. Irreversible. */
  deleteAllRows: (password: string) =>
    request<DeleteAllResult>("/api/avant-gaia", { method: "DELETE", headers: deletePasswordHeader(password) }),

  /** Empties `avant_gaia_versement`. Irreversible. */
  deleteAllVersements: (password: string) =>
    request<DeleteAllResult>("/api/avant-gaia/versements", { method: "DELETE", headers: deletePasswordHeader(password) }),
};
