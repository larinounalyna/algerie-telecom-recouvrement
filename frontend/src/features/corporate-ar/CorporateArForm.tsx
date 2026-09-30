import { useMemo, useState } from "react";
import { errorMessage } from "../../api";
import { greenTheme } from "../../shared/theme/theme";
import { fmtDA, fmtDate } from "../../shared/lib/format";
import Field from "../../shared/ui/Field";
import Section from "../../shared/ui/Section";
import ConfirmDialog from "../../shared/ui/ConfirmDialog";
import { CorporateClient } from "./types";
import { CorporateStore } from "./useCorporateClients";
import { invoiceAgeLabel, isOneYearOld } from "./invoiceAge";
import { norm } from "./filters";
import { fmtSize, openStoredFile } from "./files";
import ClientFormModal from "./ClientFormModal";

interface Props {
  store: CorporateStore;
  initialCode: string | null;
  onOpenDB: (oneYearOnly?: boolean) => void;
}

const accent = greenTheme;

type Status = "idle" | "not_found" | "many";

/**
 * Corporate AR search screen — same layout as Hors Gaïa / Après Gaïa: type a
 * code or a company name, the form below fills up. Right-hand side shows the
 * client's factures (numéro, date, attached documents).
 */
export default function CorporateArForm({ store, initialCode, onOpenDB }: Props) {
  const { clients, loaded, error } = store;
  const [query, setQuery] = useState(initialCode ?? "");
  const [currentCode, setCurrentCode] = useState<string | null>(initialCode);
  const [status, setStatus] = useState<Status>("idle");
  const [matches, setMatches] = useState<CorporateClient[]>([]);
  const [modal, setModal] = useState<{ initial?: CorporateClient } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [fileWarning, setFileWarning] = useState<string | null>(null);

  const current = useMemo(() => clients.find((c) => c.code === currentCode) ?? null, [clients, currentCode]);
  const oldCount = useMemo(() => clients.filter((c) => isOneYearOld(c.dateFacture)).length, [clients]);
  const f = current !== null;
  const old = current ? isOneYearOld(current.dateFacture) : false;

  const pick = (c: CorporateClient) => {
    setCurrentCode(c.code);
    setQuery(c.code);
    setStatus("idle");
    setMatches([]);
  };

  const search = () => {
    const q = norm(query);
    if (!q) return;
    const byCode = clients.filter((c) => norm(c.code) === q);
    const byName = clients.filter((c) => norm(c.name) === q);
    const list =
      byCode.length > 0
        ? byCode
        : byName.length > 0
          ? byName
          : clients.filter((c) => norm(c.code).includes(q) || norm(c.name).includes(q));

    setCurrentCode(null);
    if (list.length === 0) {
      setStatus("not_found");
      setMatches([]);
    } else if (list.length === 1) {
      pick(list[0]);
    } else {
      setStatus("many");
      setMatches(list);
    }
  };

  const reset = () => {
    setFileWarning(null);
    setQuery("");
    setCurrentCode(null);
    setStatus("idle");
    setMatches([]);
  };

  const disabledBtn = "bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed";
  const enabledBtn = `bg-white ${accent.border} ${accent.text} ${accent.hoverLight}`;

  return (
    <div className="h-full flex flex-col overflow-hidden px-5 py-3 gap-2.5">
      {/* Search */}
      <div className="flex-shrink-0">
        <label className="block text-[11px] text-gray-500 mb-0.5">Code ou nom de l'entreprise *</label>
        <div className="flex gap-2">
          <input
            type="text"
            autoFocus
            placeholder="ex. CAR-000001 ou nom de la société"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && search()}
            className={`flex-1 font-mono rounded-lg px-3 py-1.5 text-sm focus:outline-none transition-colors ${
              f ? accent.filled : `bg-white border-2 border-gray-300 ${accent.focusBorder}`
            }`}
          />
          <button
            onClick={search}
            className={`px-5 py-1.5 text-white text-sm rounded-lg transition-colors whitespace-nowrap ${accent.bg} ${accent.hover}`}
          >
            Rechercher
          </button>
          <button
            onClick={() => current && setModal({ initial: current })}
            disabled={!f}
            className={`px-4 py-1.5 text-sm rounded-lg whitespace-nowrap border-2 transition-colors ${f ? enabledBtn : disabledBtn}`}
          >
            Modifier
          </button>
          <button
            onClick={() => setConfirmDelete(true)}
            disabled={!f}
            className={`px-4 py-1.5 text-sm rounded-lg whitespace-nowrap border-2 transition-colors ${
              f ? "bg-white border-red-300 text-red-600 hover:bg-red-50" : disabledBtn
            }`}
          >
            Supprimer
          </button>
          <button
            onClick={() => setModal({})}
            className="px-4 py-1.5 text-sm rounded-lg whitespace-nowrap border-2 border-emerald-300 text-emerald-700 hover:bg-emerald-50 transition-colors"
          >
            + Nouveau client
          </button>
        </div>

        {status === "not_found" && <p className="text-xs text-red-600 mt-1 font-medium">Entreprise introuvable.</p>}
        {error && <p className="text-xs text-red-600 mt-1 font-medium">{error}</p>}
        {actionError && <p className="text-xs text-red-600 mt-1 font-medium">{actionError}</p>}
        {fileWarning && (
          <p className="text-xs text-red-600 mt-1 font-medium">
            ⚠️ Entreprise enregistrée, mais ces documents n'ont pas pu être traités : {fileWarning}. Rouvrez « Modifier » pour réessayer.
          </p>
        )}
        {f && current && (
          <p className="text-xs text-green-600 mt-1 font-medium">
            ✓ Données chargées
            {old && <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] bg-red-100 text-red-700">Facture d'un an ou plus</span>}
          </p>
        )}
        {oldCount > 0 && (
          <p className="text-xs text-red-600 mt-1 font-medium">
            ⚠️ {oldCount === 1 ? "1 facture date" : `${oldCount} factures datent`} d'un an ou plus.{" "}
            <button onClick={() => onOpenDB(true)} className="underline hover:text-red-800">
              Voir la liste
            </button>
          </p>
        )}
      </div>

      {/* Several matches: pick one */}
      {status === "many" && !f ? (
        <div className="flex-1 min-h-0 flex flex-col">
          <Section title={`${matches.length} résultats — choisissez une entreprise`} accentClass={accent.bg} className="flex-1 min-h-0">
            <ul className="divide-y divide-gray-100">
              {matches.map((c) => (
                <li key={c.code}>
                  <button
                    onClick={() => pick(c)}
                    className={`w-full text-left px-2 py-2 text-sm flex items-center gap-4 rounded ${accent.hoverLight}`}
                  >
                    <span className={`font-mono w-28 ${accent.text}`}>{c.code}</span>
                    <span className="flex-1 truncate text-[#1C2235]">{c.name}</span>
                    <span className="font-mono text-gray-600">{fmtDA(c.creance)}</span>
                    {isOneYearOld(c.dateFacture) && (
                      <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-[10px]">Facture d'un an</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </Section>
        </div>
      ) : (
        /* Two-column body, fills remaining height without scrolling */
        <div className="flex-1 min-h-0 grid grid-cols-2 gap-4">
          {/* Left: client info */}
          <Section title="Informations Client" accentClass={accent.bg} className="min-h-0">
            <div className="grid grid-cols-2 gap-2">
              <Field label="Code" value={current?.code ?? ""} readOnly filled={f} filledClass={accent.filled} mono />
              <Field label="Nom" value={current?.name ?? ""} readOnly filled={f} filledClass={accent.filled} />
            </div>
            <Field label="Créance" value={current ? fmtDA(current.creance) : ""} readOnly filled={f} filledClass={accent.filled} mono />
            <div className="grid grid-cols-2 gap-2">
              <Field label="Désignation" value={current?.designation ?? ""} readOnly filled={f} filledClass={accent.filled} />
              <Field label="Observation" value={current?.observation ?? ""} readOnly filled={f} filledClass={accent.filled} />
            </div>
            {!f && loaded && (
              <p className="text-xs text-gray-400 italic pt-1">
                {clients.length === 0
                  ? "Aucune entreprise enregistrée. Ajoutez-en une avec « + Nouveau client » ou importez une base depuis « Base de Données »."
                  : "Saisissez le code ou le nom d'une entreprise pour afficher sa fiche."}
              </p>
            )}
          </Section>

          {/* Right: factures + actions */}
          <div className="flex flex-col min-h-0 gap-2">
            <Section title="Factures" accentClass={accent.bg} className="flex-1 min-h-0">
              {!current ? (
                <p className="text-xs text-gray-400 italic">Recherchez une entreprise pour afficher ses factures.</p>
              ) : (
                <>
                  {old && (
                    <div role="alert" className="rounded-lg border-2 border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
                      ⚠️ Cette facture a un an ou plus ({invoiceAgeLabel(current.dateFacture)}).
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <Field
                      label="Numéro de facture"
                      value={current.numeroFacture}
                      placeholder="Non renseigné"
                      readOnly
                      filled
                      filledClass={accent.filled}
                      mono
                    />
                    <Field
                      label="Date de facture"
                      value={current.dateFacture ? fmtDate(current.dateFacture) : ""}
                      placeholder="Non renseignée"
                      readOnly
                      filled
                      filledClass={old ? "bg-red-50 border-2 border-red-400" : accent.filled}
                      mono
                    />
                  </div>

                  <div>
                    <div className="mb-1 text-[11px] uppercase text-gray-400">Documents joints ({current.files.length})</div>
                    {current.files.length > 0 ? (
                      <div className="border border-gray-200 rounded-lg overflow-hidden">
                        <table className="w-full text-xs">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="text-left px-2.5 py-1.5 text-gray-500 font-medium">Fichier</th>
                              <th className="text-right px-2.5 py-1.5 text-gray-500 font-medium">Taille</th>
                              <th className="text-center px-2.5 py-1.5 text-gray-500 font-medium">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {current.files.map((file) => (
                              <tr key={file.id} className="border-t border-gray-100">
                                <td className="px-2.5 py-1.5">
                                  <span className="mr-1.5">{file.type === "application/pdf" ? "📄" : "🖼️"}</span>
                                  {file.name}
                                </td>
                                <td className="px-2.5 py-1.5 text-right font-mono text-gray-500">{fmtSize(file.size)}</td>
                                <td className="px-2.5 py-1.5">
                                  <div className="flex justify-center">
                                    <button
                                      onClick={() => openStoredFile(current.code, file.id)}
                                      title="Voir le document"
                                      className="w-6 h-6 rounded-full border border-gray-300 hover:bg-gray-100 flex items-center justify-center"
                                    >
                                      👁
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 italic">Aucun document joint.</p>
                    )}
                  </div>
                </>
              )}
            </Section>

            {/* Actions */}
            <div className="flex-shrink-0 grid grid-cols-2 gap-1.5">
              <button
                onClick={() => onOpenDB()}
                className={`py-2 rounded-lg text-sm bg-white border-2 ${accent.border} ${accent.text} ${accent.hoverLight} transition-colors`}
              >
                Base de Données
              </button>
              <button onClick={reset} className="py-2 rounded-lg text-sm text-gray-400 border border-gray-200 hover:text-gray-600 transition-colors">
                Réinitialiser
              </button>
            </div>
          </div>
        </div>
      )}

      {modal && (
        <ClientFormModal
          initial={modal.initial}
          onCancel={() => setModal(null)}
          onSave={async (data, changes) => {
            // The key of a new client is generated by the backend.
            const { client, failedFiles } = modal.initial
              ? await store.update(modal.initial, data, changes)
              : await store.create(data, changes);
            setActionError(null);
            setFileWarning(failedFiles.length > 0 ? failedFiles.join(" ; ") : null);
            pick(client);
            setModal(null);
          }}
        />
      )}

      {confirmDelete && current && (
        <ConfirmDialog
          title="Supprimer cette entreprise ?"
          confirmLabel="Supprimer"
          tone="danger"
          onCancel={() => setConfirmDelete(false)}
          onConfirm={async () => {
            try {
              await store.remove(current.code);
              setActionError(null);
              reset();
            } catch (e) {
              setActionError(`Suppression impossible : ${errorMessage(e)}`);
            }
            setConfirmDelete(false);
          }}
        >
          <p>
            <b>{current.name}</b> ({current.code}) et ses documents joints seront supprimés définitivement.
          </p>
        </ConfirmDialog>
      )}
    </div>
  );
}
