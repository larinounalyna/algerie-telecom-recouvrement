export const DESIGNATIONS = [
  "Équipement",
  "Maintenance",
  "Déviation fibre optique",
  "Liaison spécialisée",
  "Canalisation",
  "Pose câble",
  "Raccordement fibre optique",
] as const;

export const OBSERVATIONS = [
  "À jour",
  "Client inconnu",
  "Non payé",
  "Dossier remis à la SAJ",
  "Facture remise",
  "Décédé",
] as const;

/** Sentinel value of the <select> when the user wants to type their own text. */
export const AUTRE = "__autre__";

/** A document already stored on the server (the bytes are fetched on demand, see corporateArApi.fileUrl). */
export interface CorporateFile {
  id: number;
  name: string;
  type: string;
  size: number;
}

/** What the form changes on the documents of a client when it is saved. */
export interface FileChanges {
  /** New documents picked in the form, still to be uploaded. */
  add: File[];
  /** Ids of stored documents the user removed. */
  removeIds: number[];
}

export interface CorporateClient {
  /** Primary key, generated automatically (CAR-000001…) — never typed by hand. */
  code: string;
  name: string;
  creance: number;
  /** Optional. */
  numeroFacture: string;
  /** Optional, ISO yyyy-mm-dd or "". */
  dateFacture: string;
  designation: string; // one of DESIGNATIONS or free text
  observation: string; // one of OBSERVATIONS or free text
  files: CorporateFile[];
}

/** The editable fields of a client (no key yet, and documents are handled separately). */
export type CorporateInput = Omit<CorporateClient, "code" | "files">;
