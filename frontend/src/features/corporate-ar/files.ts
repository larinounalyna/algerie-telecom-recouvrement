import { corporateArApi } from "../../api";

export const fmtSize = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} Ko` : `${(n / 1024 / 1024).toFixed(1)} Mo`);

/** Opens a document stored on the server in a new tab. */
export const openStoredFile = (code: string, fileId: number) => window.open(corporateArApi.fileUrl(code, fileId), "_blank", "noopener");

/** Previews a document picked in the form that has not been uploaded yet. */
export const openLocalFile = (f: File) => {
  const url = URL.createObjectURL(f);
  window.open(url, "_blank", "noopener");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
};
