import { useState } from "react";
import { errorMessage } from "../../api";
import { AUTRE, CorporateClient, CorporateInput, DESIGNATIONS, FileChanges, OBSERVATIONS } from "./types";
import { isOneYearOld } from "./invoiceAge";
import { fmtSize, openLocalFile, openStoredFile } from "./files";

const inputCls =
  "w-full rounded-lg px-3 py-1.5 text-sm text-[#1C2235] bg-white border-2 border-gray-300 focus:outline-none focus:border-emerald-500 placeholder:text-gray-400 transition-colors";

const isAccepted = (f: File) => f.type === "application/pdf" || f.type.startsWith("image/");
const MAX_FILE_BYTES = 15 * 1024 * 1024; // same limit as the backend

/** A document picked in this form, not uploaded yet. */
interface Pending {
  key: string;
  file: File;
}

/** A <select> with preset options + "Autre" that reveals a free-text input. */
function ChoiceWithOther({
  label,
  options,
  value,
  onChange,
  otherLabel,
  placeholder,
}: {
  label: string;
  options: readonly string[];
  value: string;
  onChange: (v: string) => void;
  otherLabel: string;
  placeholder: string;
}) {
  const isPreset = value === "" || options.includes(value);
  const [other, setOther] = useState(!isPreset);

  return (
    <div>
      <label className="block text-[11px] text-gray-500 mb-0.5">{label} *</label>
      <select
        className={inputCls}
        value={other ? AUTRE : value}
        onChange={(e) => {
          if (e.target.value === AUTRE) {
            setOther(true);
            onChange(isPreset ? "" : value);
          } else {
            setOther(false);
            onChange(e.target.value);
          }
        }}
      >
        <option value="">— Choisir —</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
        <option value={AUTRE}>{otherLabel}</option>
      </select>
      {other && <input className={`${inputCls} mt-2`} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />}
    </div>
  );
}

interface Props {
  /** Undefined = new client. */
  initial?: CorporateClient;
  onCancel: () => void;
  onSave: (data: CorporateInput, changes: FileChanges) => Promise<void>;
}

export default function ClientFormModal({ initial, onCancel, onSave }: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [creance, setCreance] = useState(initial ? String(initial.creance) : "");
  const [numeroFacture, setNumeroFacture] = useState(initial?.numeroFacture ?? "");
  const [dateFacture, setDateFacture] = useState(initial?.dateFacture ?? "");
  const [designation, setDesignation] = useState(initial?.designation ?? "");
  const [observation, setObservation] = useState(initial?.observation ?? "");
  // Documents already stored on the server (can be removed) + documents picked now (uploaded on save).
  const [stored, setStored] = useState(initial?.files ?? []);
  const [pending, setPending] = useState<Pending[]>([]);
  const [rejected, setRejected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const ok: Pending[] = [];
    const bad: string[] = [];
    for (const f of Array.from(list)) {
      if (!isAccepted(f)) bad.push(f.name);
      else if (f.size > MAX_FILE_BYTES) bad.push(`${f.name} (plus de ${MAX_FILE_BYTES / 1024 / 1024} Mo)`);
      else ok.push({ key: crypto.randomUUID(), file: f });
    }
    setPending((p) => [...p, ...ok]);
    setRejected(bad);
  };

  const submit = async () => {
    const amount = Number(creance.replace(/\s/g, "").replace(",", "."));
    if (!name.trim()) return setErr("Le nom est obligatoire.");
    if (creance.trim() === "" || !Number.isFinite(amount) || amount < 0) return setErr("La créance doit être un montant valide.");
    if (!designation.trim()) return setErr("Choisissez ou saisissez une désignation.");
    if (!observation.trim()) return setErr("Choisissez ou saisissez une observation.");

    setBusy(true);
    setErr(null);
    try {
      await onSave({
        name: name.trim(),
        creance: amount,
        numeroFacture: numeroFacture.trim(),
        dateFacture,
        designation: designation.trim(),
        observation: observation.trim(),
      }, {
        add: pending.map((p) => p.file),
        removeIds: (initial?.files ?? []).filter((f) => !stored.some((s) => s.id === f.id)).map((f) => f.id),
      });
    } catch (e) {
      setErr(`Échec de l'enregistrement : ${errorMessage(e)}`);
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center gap-2">
          <div className="w-1 h-5 rounded-full bg-emerald-600" />
          <h2 className="text-xl text-[#1C2235]">{initial ? `Modifier ${initial.name}` : "Nouveau client Corporate AR"}</h2>
        </div>

        <div className="p-6 overflow-auto grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] text-gray-500 mb-0.5">Code</label>
            <input
              readOnly
              value={initial?.code ?? ""}
              placeholder="Généré automatiquement"
              className="w-full rounded-lg px-3 py-1.5 text-sm font-mono bg-gray-50 border-2 border-gray-200 text-gray-500 placeholder:text-gray-400 placeholder:font-sans"
            />
          </div>
          <div>
            <label className="block text-[11px] text-gray-500 mb-0.5">Nom *</label>
            <input autoFocus className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="col-span-2">
            <label className="block text-[11px] text-gray-500 mb-0.5">Créance (DA) *</label>
            <input className={`${inputCls} font-mono`} inputMode="decimal" value={creance} onChange={(e) => setCreance(e.target.value)} />
          </div>

          <ChoiceWithOther
            label="Désignation"
            options={DESIGNATIONS}
            value={designation}
            onChange={setDesignation}
            otherLabel="Autre…"
            placeholder="Saisir la désignation"
          />
          <ChoiceWithOther
            label="Observation"
            options={OBSERVATIONS}
            value={observation}
            onChange={setObservation}
            otherLabel="Autres…"
            placeholder="Saisir l'observation"
          />

          <div className="col-span-2 mt-1 flex items-center gap-2">
            <div className="w-1 h-3.5 rounded-full bg-emerald-600" />
            <span className="text-sm text-[#1C2235]">Factures</span>
            <span className="text-[11px] text-gray-400">numéro et date facultatifs</span>
          </div>
          <div>
            <label className="block text-[11px] text-gray-500 mb-0.5">Numéro de facture</label>
            <input className={inputCls} value={numeroFacture} onChange={(e) => setNumeroFacture(e.target.value)} />
          </div>
          <div>
            <label className="block text-[11px] text-gray-500 mb-0.5">Date de facture</label>
            <input type="date" className={`${inputCls} font-mono`} value={dateFacture} onChange={(e) => setDateFacture(e.target.value)} />
            {isOneYearOld(dateFacture) && <p className="text-xs text-red-600 mt-1">⚠️ Cette facture a un an ou plus.</p>}
          </div>

          <div className="col-span-2">
            <label className="block text-[11px] text-gray-500 mb-0.5">Documents (PDF ou images, plusieurs possibles, 15 Mo max chacun)</label>
            <input
              type="file"
              multiple
              accept="application/pdf,image/*"
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = ""; // allows re-picking the same file
              }}
              className="block w-full text-sm text-gray-600 file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-emerald-100 file:text-emerald-800 hover:file:bg-emerald-200 file:cursor-pointer"
            />
            {rejected.length > 0 && <p className="text-xs text-red-600 mt-1">Ignoré (ni PDF ni image) : {rejected.join(", ")}</p>}
            {stored.length + pending.length > 0 && (
              <ul className="mt-2 space-y-1.5">
                {stored.map((f) => (
                  <li key={`s${f.id}`} className="flex items-center gap-3 px-3 py-1.5 rounded-lg border border-gray-200 text-sm">
                    <span>{f.type === "application/pdf" ? "📄" : "🖼️"}</span>
                    <button type="button" onClick={() => initial && openStoredFile(initial.code, f.id)} className="flex-1 text-left truncate hover:underline">
                      {f.name}
                    </button>
                    <span className="text-xs text-gray-400">{fmtSize(f.size)}</span>
                    <button
                      type="button"
                      onClick={() => setStored((p) => p.filter((x) => x.id !== f.id))}
                      aria-label={`Retirer ${f.name}`}
                      className="text-gray-400 hover:text-red-600"
                    >
                      ✕
                    </button>
                  </li>
                ))}
                {pending.map((p) => (
                  <li key={p.key} className="flex items-center gap-3 px-3 py-1.5 rounded-lg border border-dashed border-emerald-300 bg-emerald-50/40 text-sm">
                    <span>{p.file.type === "application/pdf" ? "📄" : "🖼️"}</span>
                    <button type="button" onClick={() => openLocalFile(p.file)} className="flex-1 text-left truncate hover:underline">
                      {p.file.name}
                    </button>
                    <span className="text-xs text-emerald-700">à envoyer · {fmtSize(p.file.size)}</span>
                    <button
                      type="button"
                      onClick={() => setPending((x) => x.filter((y) => y.key !== p.key))}
                      aria-label={`Retirer ${p.file.name}`}
                      className="text-gray-400 hover:text-red-600"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {err && <p className="col-span-2 rounded-lg bg-red-50 border border-red-300 text-red-700 text-sm px-3 py-2">{err}</p>}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-2">
          <button onClick={onCancel} disabled={busy} className="px-5 py-2 rounded-xl text-sm border border-gray-300 text-gray-700 hover:bg-gray-50">
            Annuler
          </button>
          <button onClick={submit} disabled={busy} className="px-5 py-2 rounded-xl text-sm text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60">
            {busy ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      </div>
    </div>
  );
}
