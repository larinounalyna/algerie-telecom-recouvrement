export interface ProjectFile {
  id: number;
  name: string;
  type: string;
  size: number;
}

export interface ProjectRecord {
  id: number;
  projectName: string;
  contractNumber: string;
  amendmentNumbers: number[];
  launchDate: string;
  piecesRemises: string[];
  endDate: string;
  estimatedAmount: number | null;
  finalInvoiceAmount: number | null;
  paymentDate: string;
  files: ProjectFile[];
}

export type ProjectInput = Omit<ProjectRecord, "id" | "files">;

export interface ProjectFileChanges {
  add: File[];
  removeIds: number[];
}
