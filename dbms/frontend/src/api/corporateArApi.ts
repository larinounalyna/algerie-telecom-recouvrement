import type { CorporateClient, CorporateFile, CorporateInput } from "../features/corporate-ar/types";
import { API_BASE_URL } from "./config";
import { request } from "./httpClient";

/* Wire format of the backend (snake_case, see backend/app/schemas.py). */
interface FileDto {
  id: number;
  name: string;
  content_type: string;
  size: number;
}

interface ClientDto {
  code: string;
  name: string;
  creance: number;
  numero_facture: string | null;
  date_facture: string | null;
  designation: string;
  observation: string;
  files: FileDto[];
}

type InputDto = Omit<ClientDto, "code" | "files">;

const fileFromDto = (f: FileDto): CorporateFile => ({ id: f.id, name: f.name, type: f.content_type, size: f.size });

const clientFromDto = (c: ClientDto): CorporateClient => ({
  code: c.code,
  name: c.name,
  creance: Number(c.creance),
  numeroFacture: c.numero_facture ?? "",
  dateFacture: c.date_facture ?? "",
  designation: c.designation,
  observation: c.observation,
  files: c.files.map(fileFromDto),
});

const inputToDto = (c: CorporateInput): InputDto => ({
  name: c.name,
  creance: c.creance,
  numero_facture: c.numeroFacture.trim() || null,
  date_facture: c.dateFacture || null,
  designation: c.designation,
  observation: c.observation,
});

export interface CorporateImportResult {
  added: number;
  updated: number;
  generated: number;
}

const BASE = "/api/corporate-ar";

/** Corporate AR (entreprises) — stored in PostgreSQL by the FastAPI backend. */
export const corporateArApi = {
  /** The whole table, each client with the list of its documents. */
  list: async (signal?: AbortSignal) => (await request<ClientDto[]>(`${BASE}/clients`, { signal })).map(clientFromDto),

  /** The backend generates the key (CAR-000001…). */
  create: async (data: CorporateInput) => clientFromDto(await request<ClientDto>(`${BASE}/clients`, { method: "POST", body: inputToDto(data) })),

  update: async (code: string, data: CorporateInput) =>
    clientFromDto(await request<ClientDto>(`${BASE}/clients/${encodeURIComponent(code)}`, { method: "PUT", body: inputToDto(data) })),

  /** Also deletes the client's documents. */
  remove: (code: string) => request<void>(`${BASE}/clients/${encodeURIComponent(code)}`, { method: "DELETE" }),

  /** CSV import: a known code updates that client, a row without code gets a generated one. */
  importRows: (rows: (CorporateInput & { code?: string })[]) =>
    request<CorporateImportResult>(`${BASE}/clients/import`, {
      method: "POST",
      body: { rows: rows.map((r) => ({ ...inputToDto(r), ...(r.code ? { code: r.code } : {}) })) },
    }),

  uploadFile: async (code: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return fileFromDto(await request<FileDto>(`${BASE}/clients/${encodeURIComponent(code)}/files`, { method: "POST", body: form }));
  },

  deleteFile: (code: string, fileId: number) => request<void>(`${BASE}/clients/${encodeURIComponent(code)}/files/${fileId}`, { method: "DELETE" }),

  /** URL that streams the document (used to open it in a new tab). */
  fileUrl: (code: string, fileId: number) => `${API_BASE_URL}${BASE}/clients/${encodeURIComponent(code)}/files/${fileId}`,
};
