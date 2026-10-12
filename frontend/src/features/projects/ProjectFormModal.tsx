import { useState } from "react";
import { errorMessage, projectsApi } from "../../api";
import type { ProjectFileChanges, ProjectInput, ProjectRecord } from "./types";

const inputClass =
  "w-full rounded-lg px-3 py-2 text-sm text-[#1C2235] bg-white border-2 border-gray-300 focus:outline-none focus:border-violet-500 placeholder:text-gray-400";
const MAX_FILE_BYTES = 15 * 1024 * 1024;

interface Props {
  initial?: ProjectRecord;
  onCancel: () => void;
  onSave: (data: ProjectInput, changes: ProjectFileChanges) => Promise<void>;
}

export default function ProjectFormModal({ initial, onCancel, onSave }: Props) {
  const [projectName, setProjectName] = useState(initial?.projectName ?? "");
  const [contractNumber, setContractNumber] = useState(initial?.contractNumber ?? "");
  const [amendments, setAmendments] = useState((initial?.amendmentNumbers ?? []).map(String));
  const [launchDate, setLaunchDate] = useState(initial?.launchDate ?? "");
  const [endDate, setEndDate] = useState(initial?.endDate ?? "");
  const [estimatedAmount, setEstimatedAmount] = useState(initial?.estimatedAmount == null ? "" : String(initial.estimatedAmount));
  const [finalInvoiceAmount, setFinalInvoiceAmount] = useState(initial?.finalInvoiceAmount == null ? "" : String(initial.finalInvoiceAmount));
  const [paymentDate, setPaymentDate] = useState(initial?.paymentDate ?? "");
  const [pieces, setPieces] = useState(initial?.piecesRemises ?? []);
  const [storedFiles, setStoredFiles] = useState(initial?.files ?? []);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const good: File[] = [];
    const rejected: string[] = [];
    for (const file of Array.from(files)) {
      if (file.type !== "application/pdf" && !file.type.startsWith("image/")) rejected.push(`${file.name} (format non accepté)`);
      else if (file.size > MAX_FILE_BYTES) rejected.push(`${file.name} (plus de 15 Mo)`);
      else good.push(file);
    }
    setPendingFiles((current) => [...current, ...good]);
    if (rejected.length) setError(`Fichiers ignorés : ${rejected.join(", ")}.`);
  };

  const submit = async () => {
    const parsedAmendments = amendments.map((number) => Number(number.trim()));
    if (!projectName.trim()) return setError("Le nom du projet est obligatoire.");
    if (!contractNumber.trim()) return setError("Le numéro de contrat projet est obligatoire.");
    if (!launchDate) return setError("La date de lancement est obligatoire.");
    if (parsedAmendments.some((number) => !Number.isInteger(number) || number < 1)) {
      return setError("Chaque numéro d'avenant doit être un entier positif.");
    }
    if (new Set(parsedAmendments).size !== parsedAmendments.length) return setError("Les numéros d'avenant doivent être uniques.");
    const parseAmount = (value: string, label: string): number | null => {
      if (!value.trim()) return null;
      const amount = Number(value.replace(/\s/g, "").replace(",", "."));
      if (!Number.isFinite(amount) || amount < 0) throw new Error(`${label} doit être un montant positif ou nul.`);
      return amount;
    };

    let estimate: number | null;
    let finalAmount: number | null;
    try {
      estimate = parseAmount(estimatedAmount, "Le montant du devis estimatif");
      finalAmount = parseAmount(finalInvoiceAmount, "Le montant de la facture définitive");
    } catch (e) {
      return setError(errorMessage(e));
    }

    setBusy(true);
    setError(null);
    try {
      await onSave(
        {
          projectName: projectName.trim(),
          contractNumber: contractNumber.trim(),
          amendmentNumbers: parsedAmendments,
          launchDate,
          endDate,
          estimatedAmount: estimate,
          finalInvoiceAmount: finalAmount,
          paymentDate,
          piecesRemises: pieces.map((piece) => piece.trim()).filter(Boolean),
        },
        {
          add: pendingFiles,
          removeIds: (initial?.files ?? []).filter((file) => !storedFiles.some((stored) => stored.id === file.id)).map((file) => file.id),
        },
      );
      onCancel();
    } catch (e) {
      setError(`Échec de l'enregistrement : ${errorMessage(e)}`);
      setBusy(false);
    }
  };

  const addAmendment = () => {
    const next = Math.max(0, ...amendments.map((value) => Number(value) || 0)) + 1;
    setAmendments((current) => [...current, String(next)]);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center gap-2">
          <div className="w-1 h-5 rounded-full bg-violet-600" />
          <h2 className="text-xl text-[#1C2235]">{initial ? `Modifier ${initial.projectName}` : "Nouveau projet"}</h2>
        </div>

        <div className="p-6 overflow-auto grid grid-cols-2 gap-4">
          {initial && (
            <div className="col-span-2">
              <label className="block text-xs text-gray-500 mb-1">Référence</label>
              <input readOnly value={`PROJ-${String(initial.id).padStart(6, "0")}`} className={`${inputClass} bg-gray-50 font-mono`} />
            </div>
          )}
          <label className="block text-xs text-gray-600">
            Nom du projet *
            <input autoFocus className={`${inputClass} mt-1`} value={projectName} onChange={(e) => setProjectName(e.target.value)} />
          </label>
          <label className="block text-xs text-gray-600">
            Numéro contrat projet *
            <input className={`${inputClass} mt-1`} value={contractNumber} onChange={(e) => setContractNumber(e.target.value)} />
          </label>

          <div className="col-span-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-600">Numéros d'avenant</span>
              <button type="button" onClick={addAmendment} className="text-xs font-medium text-violet-700 hover:text-violet-900">
                + Ajouter un avenant
              </button>
            </div>
            {amendments.length === 0 ? (
              <p className="text-xs text-gray-400">Aucun avenant enregistré.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {amendments.map((number, index) => (
                  <div key={`${index}`} className="flex items-center gap-1 rounded-lg bg-violet-50 p-1.5">
                    <label className="text-xs text-violet-800">
                      Numéro
                      <input
                        aria-label={`Numéro d'avenant ${index + 1}`}
                        className="ml-1 w-20 rounded border border-violet-200 px-2 py-1 text-sm"
                        type="number"
                        min={1}
                        step={1}
                        value={number}
                        onChange={(e) => setAmendments((current) => current.map((value, i) => (i === index ? e.target.value : value)))}
                      />
                    </label>
                    <button
                      type="button"
                      aria-label={`Supprimer l'avenant ${number || index + 1}`}
                      onClick={() => setAmendments((current) => current.filter((_, i) => i !== index))}
                      className="px-1 text-gray-500 hover:text-red-600"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <label className="block text-xs text-gray-600">
            Date de lancement *
            <input type="date" className={`${inputClass} mt-1 font-mono`} value={launchDate} onChange={(e) => setLaunchDate(e.target.value)} />
          </label>
          <label className="block text-xs text-gray-600">
            Date fin du projet
            <input type="date" className={`${inputClass} mt-1 font-mono`} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </label>
          <label className="block text-xs text-gray-600">
            Montant devis estimatif (DA)
            <input inputMode="decimal" className={`${inputClass} mt-1 font-mono`} value={estimatedAmount} onChange={(e) => setEstimatedAmount(e.target.value)} />
          </label>
          <label className="block text-xs text-gray-600">
            Montant de la facture définitive (DA)
            <input inputMode="decimal" className={`${inputClass} mt-1 font-mono`} value={finalInvoiceAmount} onChange={(e) => setFinalInvoiceAmount(e.target.value)} />
          </label>
          <label className="block text-xs text-gray-600">
            Date de paiement de la facture
            <input type="date" className={`${inputClass} mt-1 font-mono`} value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
          </label>

          <div className="col-span-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-600">Pièces remises au client</span>
              <button type="button" onClick={() => setPieces((current) => [...current, ""])} className="text-xs font-medium text-violet-700 hover:text-violet-900">
                + Ajouter une pièce
              </button>
            </div>
            <datalist id="project-document-suggestions">
              <option value="Plan de déviation" />
              <option value="Attachements" />
            </datalist>
            <div className="space-y-2">
              {pieces.map((piece, index) => (
                <div className="flex gap-2" key={index}>
                  <input
                    className={inputClass}
                    list="project-document-suggestions"
                    aria-label={`Pièce remise ${index + 1}`}
                    placeholder="ex. Plan de déviation, Attachements…"
                    value={piece}
                    onChange={(e) => setPieces((current) => current.map((value, i) => (i === index ? e.target.value : value)))}
                  />
                  <button type="button" onClick={() => setPieces((current) => current.filter((_, i) => i !== index))} className="px-3 text-gray-500 hover:text-red-600">
                    Retirer
                  </button>
                </div>
              ))}
              {pieces.length === 0 && <p className="text-xs text-gray-400">Aucune pièce renseignée.</p>}
            </div>
          </div>

          <div className="col-span-2">
            <label className="block text-xs text-gray-600 mb-1">Documents à joindre (PDF ou images, 15 Mo maximum chacun)</label>
            <input
              type="file"
              multiple
              accept="application/pdf,image/*"
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = "";
              }}
              className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-violet-50 file:px-3 file:py-2 file:text-violet-800"
            />
            {(storedFiles.length > 0 || pendingFiles.length > 0) && (
              <ul className="mt-2 divide-y divide-gray-100 rounded-lg border border-gray-200">
                {storedFiles.map((file) => (
                  <li key={file.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                    <a className="truncate text-violet-700 underline" href={projectsApi.fileUrl(initial!.id, file.id)} target="_blank" rel="noreferrer">
                      {file.name}
                    </a>
                    <button type="button" onClick={() => setStoredFiles((current) => current.filter((item) => item.id !== file.id))} className="text-red-600">
                      Retirer
                    </button>
                  </li>
                ))}
                {pendingFiles.map((file, index) => (
                  <li key={`${file.name}-${index}`} className="flex items-center justify-between gap-3 px-3 py-2 text-sm text-gray-600">
                    <span className="truncate">{file.name} <span className="text-gray-400">(à envoyer)</span></span>
                    <button type="button" onClick={() => setPendingFiles((current) => current.filter((_, i) => i !== index))} className="text-red-600">
                      Retirer
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {error && <p role="alert" className="col-span-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-2">
          <button disabled={busy} onClick={onCancel} className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50">
            Annuler
          </button>
          <button disabled={busy} onClick={() => void submit()} className="px-5 py-2 rounded-lg bg-violet-600 text-sm text-white hover:bg-violet-700 disabled:opacity-50">
            {busy ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      </div>
    </div>
  );
}
