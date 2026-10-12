import { API_BASE_URL } from "./config";
import { request } from "./httpClient";
import type { ProjectFile, ProjectInput, ProjectRecord } from "../features/projects/types";

interface ProjectFileDto {
  id: number;
  name: string;
  content_type: string;
  size: number;
}

interface ProjectDto {
  id: number;
  project_name: string;
  contract_number: string;
  amendment_numbers: number[];
  launch_date: string;
  pieces_remises: string[];
  end_date: string | null;
  estimated_amount: number | string | null;
  final_invoice_amount: number | string | null;
  payment_date: string | null;
  files: ProjectFileDto[];
}

const BASE = "/api/projects";

const fileFromDto = (file: ProjectFileDto): ProjectFile => ({
  id: file.id,
  name: file.name,
  type: file.content_type,
  size: file.size,
});

const projectFromDto = (project: ProjectDto): ProjectRecord => ({
  id: project.id,
  projectName: project.project_name,
  contractNumber: project.contract_number,
  amendmentNumbers: project.amendment_numbers,
  launchDate: project.launch_date,
  piecesRemises: project.pieces_remises,
  endDate: project.end_date ?? "",
  estimatedAmount: project.estimated_amount === null ? null : Number(project.estimated_amount),
  finalInvoiceAmount: project.final_invoice_amount === null ? null : Number(project.final_invoice_amount),
  paymentDate: project.payment_date ?? "",
  files: project.files.map(fileFromDto),
});

const inputToDto = (project: ProjectInput) => ({
  project_name: project.projectName.trim(),
  contract_number: project.contractNumber.trim(),
  amendment_numbers: project.amendmentNumbers,
  launch_date: project.launchDate,
  pieces_remises: project.piecesRemises,
  end_date: project.endDate || null,
  estimated_amount: project.estimatedAmount,
  final_invoice_amount: project.finalInvoiceAmount,
  payment_date: project.paymentDate || null,
});

export const projectsApi = {
  list: async (signal?: AbortSignal) => (await request<ProjectDto[]>(BASE, { signal })).map(projectFromDto),
  create: async (data: ProjectInput) =>
    projectFromDto(await request<ProjectDto>(BASE, { method: "POST", body: inputToDto(data) })),
  update: async (id: number, data: ProjectInput) =>
    projectFromDto(await request<ProjectDto>(`${BASE}/${id}`, { method: "PUT", body: inputToDto(data) })),
  remove: (id: number) => request<void>(`${BASE}/${id}`, { method: "DELETE" }),
  uploadFile: async (id: number, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return fileFromDto(await request<ProjectFileDto>(`${BASE}/${id}/files`, { method: "POST", body: form }));
  },
  deleteFile: (id: number, fileId: number) => request<void>(`${BASE}/${id}/files/${fileId}`, { method: "DELETE" }),
  fileUrl: (id: number, fileId: number) => `${API_BASE_URL}${BASE}/${id}/files/${fileId}`,
};
