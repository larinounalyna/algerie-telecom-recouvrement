import { useEffect, useState } from "react";
import { AccentTheme, DebtorView, PaymentTranche } from "../../types";
import { fmtDA, fmtDate, todayISO } from "../../shared/lib/format";
import { validateTranche, trancheBounds, MIN_TRANCHE } from "../../shared/lib/payments";
import { pendingTotal } from "../../services";
import TrancheStatusBadge from "../../shared/ui/TrancheStatusBadge";
import { buildTrancheDocument } from "../../shared/lib/trancheDocument";
import MiseEnDemeureModal from "../juridique/MiseEnDemeureModal";
import MedDocumentModal from "../juridique/MedDocumentModal";
import ConfirmDialog from "../../shared/ui/ConfirmDialog";
import FactureModal, { FactureData } from "../facture/FactureModal";
import JuridiqueTab from "../juridique/JuridiqueTab";
import { useAppData } from "../../store/AppData";
import { etatJuridiqueMedInfo, stadeInfo } from "../../shared/lib/juridique";
import { useApresGaiaMed } from "../../hooks/useApresGaiaMed";

interface Props {
  client: DebtorView;
  accent: AccentTheme;
  dbLabel?: string;
  numPrefix?: "HG" | "GA" | "EN";
  /** Absent when the database is read-only (Avant Gaïa). Resolves to null or an error message. */
  onRecordPayment?: (montant: number, note?: string, date?: string) => Promise<string | null>;
  onValidateTranche?: (trancheId: string) => Promise<string | null>;
  onRefuseTranche?: (trancheId: string) => Promise<string | null>;
  /** Supprime définitivement un versement (Après Gaïa). Une confirmation est demandée avant l'appel. */
  onDeleteTranche?: (trancheId: string, password: string) => Promise<string | null>;
  onClose: () => void;
  initialTab?: "finance" | "juridique";
}

export default function ClientDetailModal({
  client,
  accent,
  dbLabel,
  numPrefix = "HG",
  onRecordPayment,
  onValidateTranche,
  onRefuseTranche,
  onDeleteTranche,
  onClose,
  initialTab = "finance",
}: Props) {
  const [montant, setMontant] = useState("");
  const [agent, setAgent] = useState("");
  const [dateVersement, setDateVersement] = useState(todayISO());
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showMED, setShowMED] = useState(false);
  const [doc, setDoc] = useState<FactureData | null>(null);
  const [tab, setTab] = useState<"finance" | "juridique">(initialTab);
  const [toDelete, setToDelete] = useState<PaymentTranche | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [showAttestation, setShowAttestation] = useState(false);
  const { getJuridique } = useAppData();
  const isApres = client.kind === "apres";
  const medController = useApresGaiaMed(isApres ? client.id : null, client.med ?? null);
  const stade = isApres ? null : stadeInfo(getJuridique(client.kind, client.id).stade);
  const apresEtatInfo = isApres && medController.med ? etatJuridiqueMedInfo(medController.med.etat_juridique) : null;

  const pending = pendingTotal(client.historique);
  const { min, max } = trancheBounds(client.solde, pending);
  const noteLabel = client.kind === "apres" ? "Lieu de versement" : "Agent";
  const statusTracked = client.kind !== "avant"; // avant_gaia_versement has no status column

  const submit = async () => {
    if (!onRecordPayment) return;
    const amount = Number(montant);
    const err = validateTranche(amount, client.solde, pending);
    if (err) {
      setError(err);
      setSuccess(false);
      return;
    }
    setBusy(true);
    const failure = await onRecordPayment(amount, agent.trim() || undefined, dateVersement || undefined);
    setBusy(false);
    if (failure) {
      setError(failure);
      setSuccess(false);
      return;
    }
    setMontant("");
    setAgent("");
    setDateVersement(todayISO());
    setError(null);
    setSuccess(true);
    setTimeout(() => setSuccess(false), 2500);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !doc && !showMED && !showAttestation && !toDelete && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, doc, showMED, showAttestation, toDelete]);

  const act = async (fn: (id: string) => Promise<string | null>, id: string) => {
    setActionError(await fn(id));
  };

  const openDelete = (t: PaymentTranche) => {
    setDeletePassword("");
    setShowPassword(false);
    setDeleteError(null);
    setToDelete(t);
  };

  const closeDelete = () => {
    setToDelete(null);
    setDeletePassword("");
    setShowPassword(false);
    setDeleteError(null);
  };

  // The dialog stays open on any failure (wrong password, locked out, server error) so the
  // agent can retry; it only closes once the versement is really deleted.
  const confirmDelete = async () => {
    if (!toDelete || !onDeleteTranche || deleting) return;
    if (!deletePassword) {
      setDeleteError("Saisissez le mot de passe pour supprimer ce versement.");
      return;
    }
    setDeleting(true);
    const failure = await onDeleteTranche(toDelete.id, deletePassword);
    setDeleting(false);
    if (failure) {
      setDeleteError(failure);
      setDeletePassword("");
      return;
    }
    setActionError(null);
    closeDelete();
  };

  const viewTranche = (t: PaymentTranche) => {
    setDoc(buildTrancheDocument(client, t, dbLabel ?? client.idLabel, client.idLabel, numPrefix));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`no-print flex items-center justify-between px-6 py-4 rounded-t-2xl flex-shrink-0 ${accent.bg}`}>
          <div>
            <h2 className="text-xl text-white">
              {client.nom} {client.prenom}
            </h2>
            <p className="text-sm text-white/80 font-mono">
              {client.idLabel} : {client.id}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {tab === "finance" && (
              <button
                onClick={() => window.print()}
                className="px-3 py-1.5 text-sm bg-white/20 text-white rounded-lg hover:bg-white/30 transition-colors"
              >
                Imprimer l'historique
              </button>
            )}
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-white/20 text-white hover:bg-white/30 flex items-center justify-center transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="no-print flex gap-1 px-6 border-b border-gray-200 flex-shrink-0" role="tablist">
          {(
            [
              ["finance", "Situation financière"],
              ["juridique", "État juridique"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={`px-4 py-3 text-sm border-b-2 -mb-px transition-colors flex items-center gap-2 ${
                tab === id ? accent.tabActive : "border-transparent text-gray-500 hover:text-gray-800"
              }`}
            >
              {label}
              {id === "juridique" && apresEtatInfo && (
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${apresEtatInfo.badge}`}>{apresEtatInfo.court}</span>
              )}
              {id === "juridique" && stade && stade.id !== "aucune" && (
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${stade.badge}`}>{stade.court}</span>
              )}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto p-6 space-y-5">
          {tab === "juridique" && <JuridiqueTab client={client} accent={accent} medController={isApres ? medController : undefined} />}
          <div className={`print-area space-y-5 ${tab === "finance" && !showAttestation ? "" : "hidden"}`}>
            {/* Print-only letterhead */}
            <div className="print-only text-center mb-6 pb-4 border-b-2 border-black">
              <p className="text-[9px] uppercase tracking-widest text-gray-500">
                République Algérienne Démocratique et Populaire
              </p>
              <p className="text-[9px] text-gray-500">Ministère de la Poste et des Télécommunications</p>
              <div className="text-2xl font-extrabold mt-2 tracking-tight" style={{ fontFamily: "Georgia, serif" }}>
                ALGÉRIE TÉLÉCOM
              </div>
              <div className="text-sm text-gray-700 mt-0.5">
                Relevé d'historique — {client.idLabel} {client.id}
              </div>
            </div>

            {/* Rappel de versement — client engagé sans versement depuis un mois */}
            {client.rappel && (
              <div role="alert" className="no-print rounded-xl border-2 border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                <div className="flex items-center gap-2">
                  <span aria-hidden>🔔</span>
                  <span className="font-medium">Rappel de versement</span>
                  <span className="ml-auto px-2 py-0.5 rounded-full text-[10px] bg-amber-200 text-amber-900 whitespace-nowrap">
                    {client.rappel.jours_ecoules} jours{client.rappel.mois_impayes > 1 ? ` · ${client.rappel.mois_impayes} mois` : ""}
                  </span>
                </div>
                <p className="mt-1 text-xs leading-snug">{client.rappel.message}</p>
              </div>
            )}

            {/* Info */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="block text-[11px] uppercase text-gray-400">Adresse</span>
                {client.adresse || "—"}
              </div>
              <div>
                <span className="block text-[11px] uppercase text-gray-400">Commune / Wilaya</span>
                {[client.commune, client.wilaya].filter(Boolean).join(" — ") || "—"}
              </div>
              <div>
                <span className="block text-[11px] uppercase text-gray-400">Téléphone</span>
                <span className="font-mono">{client.telephone || "—"}</span>
              </div>
              <div>
                <span className="block text-[11px] uppercase text-gray-400">Service</span>
                {client.typeService || "—"}
              </div>
              <div>
                <span className="block text-[11px] uppercase text-gray-400">{client.dateRefLabel}</span>
                {client.dateRef || "—"}
              </div>
              {client.entreprise && (
                <>
                  <div>
                    <span className="block text-[11px] uppercase text-gray-400">Forme juridique / NIF</span>
                    {client.entreprise.formeJuridique || "—"} — <span className="font-mono">{client.entreprise.nif || "NIF manquant"}</span>
                  </div>
                  <div>
                    <span className="block text-[11px] uppercase text-gray-400">Registre de commerce</span>
                    <span className="font-mono">{client.entreprise.rc || "—"}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="block text-[11px] uppercase text-gray-400">Représentant légal</span>
                    {client.entreprise.representant || "—"}
                    {client.entreprise.fonctionRepresentant ? ` (${client.entreprise.fonctionRepresentant})` : ""}
                  </div>
                </>
              )}
            </div>

            {/* Balance */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-gray-200 p-4 bg-gray-50">
                <div className="text-[11px] uppercase text-gray-400">Montant total</div>
                <div className="text-lg font-mono">{fmtDA(client.montantTotal)}</div>
              </div>
              <div
                className={`rounded-xl border-2 p-4 ${
                  client.solde > 0 ? "bg-red-50 border-red-300" : "bg-green-50 border-green-300"
                }`}
              >
                <div className="text-[11px] uppercase text-gray-500">Montant dû actuellement</div>
                <div
                  className={`text-lg font-mono font-semibold ${
                    client.solde > 0 ? "text-red-700" : "text-green-700"
                  }`}
                >
                  {fmtDA(client.solde)}
                </div>
              </div>
            </div>
          </div>

          {/* Tranche form — screen only */}
          <div className={`no-print ${tab === "finance" ? "" : "hidden"}`}>
            <div className="mb-2 flex items-center gap-2">
              <div className={`w-1 h-4 rounded-full ${accent.bg}`} />
              <span className="text-sm text-[#1C2235]">Encaisser une tranche</span>
            </div>
            {!onRecordPayment ? (
              <p className="text-sm text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
                Les versements de cette base proviennent de la base de données en lecture seule : ils ne peuvent pas être saisis ici.
              </p>
            ) : client.solde <= 0 ? (
              <div className="flex items-center justify-between gap-3 flex-wrap text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
                <span>✓ Ce client est à jour, aucun montant restant.</span>
                {isApres && medController.med && (
                  <button
                    onClick={() => setShowAttestation(true)}
                    className="px-4 py-1.5 rounded-lg text-xs border-2 border-green-600 text-green-800 bg-white hover:bg-green-100 transition-colors whitespace-nowrap"
                  >
                    Imprimer l'attestation de règlement
                  </button>
                )}
              </div>
            ) : (
              <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 space-y-3">
                <p className="text-xs text-gray-500">
                  Montant entre {fmtDA(min)} et {fmtDA(max)}
                  {max > MIN_TRANCHE ? ` (minimum ${fmtDA(MIN_TRANCHE)} par tranche).` : "."}
                  {pending > 0 && ` ${fmtDA(pending)} de versements en attente de validation déjà déduits.`}
                </p>
                <div className="flex flex-wrap gap-3">
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="Montant (DA)"
                    value={montant}
                    onChange={(e) => {
                      setMontant(e.target.value);
                      setError(null);
                    }}
                    className="flex-1 min-w-[10rem] bg-white border-2 border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-blue-500 transition-colors"
                  />
                  <label className="flex items-center gap-2 text-xs text-muted">
                    Date du versement
                    <input
                      type="date"
                      value={dateVersement}
                      max={todayISO()}
                      onChange={(e) => setDateVersement(e.target.value)}
                      className="bg-white border-2 border-gray-300 rounded-lg px-2.5 py-2 text-sm font-mono focus:outline-none focus:border-blue-500 transition-colors"
                    />
                  </label>
                  <input
                    type="text"
                    placeholder={noteLabel}
                    value={agent}
                    onChange={(e) => setAgent(e.target.value)}
                    className={`${client.kind === "apres" ? "w-48" : "w-36"} bg-white border-2 border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 transition-colors`}
                  />
                  <button
                    onClick={submit}
                    disabled={busy}
                    className={`px-5 py-2 text-white rounded-lg text-sm transition-colors whitespace-nowrap disabled:opacity-60 ${accent.bg} ${accent.hover}`}
                  >
                    {busy ? "Enregistrement…" : "Encaisser"}
                  </button>
                </div>
                {error && <p className="text-sm text-red-600">{error}</p>}
                {success && <p className="text-sm text-green-600">✓ Tranche enregistrée.</p>}
              </div>
            )}
          </div>

          <div className={`print-area space-y-5 ${tab === "finance" && !showAttestation ? "" : "hidden"}`}>
            {/* History — versements */}
            {actionError && <p className="no-print text-sm text-red-600">{actionError}</p>}
            {client.historique.length > 0 && (
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <div className={`w-1 h-4 rounded-full ${accent.bg}`} />
                  <span className="text-sm text-[#1C2235]">Historique des versements</span>
                </div>
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left px-4 py-2 text-xs text-gray-500 font-medium">Date</th>
                        <th className="text-left px-4 py-2 text-xs text-gray-500 font-medium">{client.kind === "apres" ? "Lieu" : "Agent"}</th>
                        <th className="text-right px-4 py-2 text-xs text-gray-500 font-medium">Montant</th>
                        <th className="no-print text-center px-4 py-2 text-xs text-gray-500 font-medium">Statut</th>
                        <th className="no-print text-center px-4 py-2 text-xs text-gray-500 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...client.historique].reverse().map((t) => (
                        <tr key={t.id} className="border-t border-gray-100">
                          <td className="px-4 py-2 font-mono">{fmtDate(t.date)}</td>
                          <td className="px-4 py-2">{(client.kind === "apres" ? t.lieu : t.agent) || "—"}</td>
                          <td className="px-4 py-2 text-right font-mono">{fmtDA(t.montant)}</td>
                          <td className="no-print px-4 py-2 text-center">
                            <TrancheStatusBadge tranche={t} tracked={statusTracked} validClass={accent.badge} className="text-[11px]" />
                          </td>
                          <td className="no-print px-4 py-2">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => viewTranche(t)}
                                title="Voir le document"
                                className="w-7 h-7 rounded-full border border-gray-300 hover:bg-gray-100 flex items-center justify-center transition-colors"
                              >
                                👁
                              </button>
                              {onValidateTranche && !t.valide && t.statut !== "refuse" && (
                                <button
                                  onClick={() => act(onValidateTranche, t.id)}
                                  className={`px-2.5 py-1 rounded-lg text-[11px] text-white ${accent.bg} ${accent.hover} transition-colors`}
                                >
                                  Valider
                                </button>
                              )}
                              {onDeleteTranche && (
                                <button
                                  onClick={() => openDelete(t)}
                                  title="Supprimer ce versement"
                                  aria-label={`Supprimer le versement du ${fmtDate(t.date)}`}
                                  className="w-7 h-7 rounded-full border border-red-300 text-red-600 hover:bg-red-50 flex items-center justify-center transition-colors"
                                >
                                  🗑
                                </button>
                              )}
                              {onRefuseTranche && t.statut === "en_attente" && (
                                <button
                                  onClick={() => act(onRefuseTranche, t.id)}
                                  className="px-2.5 py-1 rounded-lg text-[11px] border border-red-300 text-red-700 hover:bg-red-50 transition-colors"
                                >
                                  Refuser
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* History — consommation (Avant Gaïa) */}
            {client.consommationHistorique && client.consommationHistorique.length > 0 && (
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <div className={`w-1 h-4 rounded-full ${accent.bg}`} />
                  <span className="text-sm text-[#1C2235]">Historique de consommation (par bimestre)</span>
                </div>
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left px-4 py-2 text-xs text-gray-500 font-medium">Bimestre</th>
                        <th className="text-right px-4 py-2 text-xs text-gray-500 font-medium">Ancien Index</th>
                        <th className="text-right px-4 py-2 text-xs text-gray-500 font-medium">Nouvel Index</th>
                        <th className="text-right px-4 py-2 text-xs text-gray-500 font-medium">Consommation</th>
                      </tr>
                    </thead>
                    <tbody>
                      {client.consommationHistorique.map((c) => (
                        <tr key={c.id} className="border-t border-gray-100">
                          <td className="px-4 py-2 font-mono">{c.bimestre}</td>
                          <td className="px-4 py-2 text-right font-mono">{c.ancienIndex}</td>
                          <td className="px-4 py-2 text-right font-mono">{c.nouvelIndex}</td>
                          <td className="px-4 py-2 text-right font-mono">{c.consommation ?? ""}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {client.historique.length === 0 && !client.consommationHistorique?.length && (
              <p className="text-sm text-gray-400 italic">Aucun historique disponible pour ce client.</p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="no-print px-6 py-4 border-t border-gray-200 flex justify-between gap-3 flex-shrink-0">
          {isApres ? (
            <button
              onClick={() => setTab("juridique")}
              className="px-5 py-2.5 rounded-xl text-sm border-2 border-blue-300 text-blue-700 hover:bg-blue-50 transition-colors"
            >
              Voir l'état juridique &amp; les mises en demeure
            </button>
          ) : (
            <button
              onClick={() => setShowMED(true)}
              disabled={client.solde <= 0}
              className={`px-5 py-2.5 rounded-xl text-sm border-2 transition-colors ${
                client.solde > 0
                  ? "border-red-400 text-red-700 hover:bg-red-50"
                  : "border-gray-200 text-gray-300 cursor-not-allowed"
              }`}
            >
              Générer une mise en demeure
            </button>
          )}
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm hover:bg-gray-200 transition-colors border border-gray-300"
          >
            Fermer
          </button>
        </div>
      </div>

      {toDelete && (
        <ConfirmDialog
          title="Supprimer ce versement ?"
          confirmLabel="Oui, supprimer"
          tone="danger"
          busy={deleting}
          confirmDisabled={!deletePassword}
          autoFocusConfirm={false}
          onConfirm={confirmDelete}
          onCancel={closeDelete}
        >
          <div className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2 font-mono text-[13px] text-[#1C2235]">
            {fmtDate(toDelete.date)} — {fmtDA(toDelete.montant)}
            {toDelete.lieu ? ` — ${toDelete.lieu}` : ""}
          </div>
          {toDelete.valide ? (
            <p className="text-red-700">
              Ce versement est <b>validé</b> : après suppression, le montant dû passera de {fmtDA(client.solde)} à{" "}
              <b>{fmtDA(client.solde + toDelete.montant)}</b>.
            </p>
          ) : (
            <p>Ce versement n'est pas encore validé : le montant dû ne change pas.</p>
          )}
          <p>Cette action est <b>irréversible</b>.</p>
          <label className="block pt-1">
            <span className="block text-xs font-medium text-gray-700 mb-1">Mot de passe de suppression</span>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                autoFocus
                autoComplete="off"
                value={deletePassword}
                disabled={deleting}
                onChange={(e) => {
                  setDeletePassword(e.target.value);
                  setDeleteError(null);
                }}
                onKeyDown={(e) => e.key === "Enter" && void confirmDelete()}
                aria-invalid={deleteError ? true : undefined}
                aria-describedby={deleteError ? "delete-password-error" : undefined}
                className={`w-full rounded-lg border-2 pl-3 pr-11 py-2 text-sm text-gray-900 focus:outline-none ${
                  deleteError ? "border-red-400 bg-red-50" : "border-gray-300 focus:border-red-400"
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                disabled={deleting}
                aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                aria-pressed={showPassword}
                title={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-lg text-gray-500 hover:text-gray-800 disabled:opacity-50"
              >
                {showPassword ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                    <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
                    <path d="M1 1l22 22" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </label>
          {deleteError && (
            <p id="delete-password-error" role="alert" className="text-sm text-red-700">
              {deleteError}
            </p>
          )}
        </ConfirmDialog>
      )}

      {showAttestation && isApres && medController.med && (
        <MedDocumentModal
          client={client}
          med={medController.med}
          type="attestation"
          accent={accent}
          busy={false}
          alreadySentDate={null}
          onEnvoyer={async () => null}
          onClose={() => setShowAttestation(false)}
        />
      )}

      {showMED && <MiseEnDemeureModal client={client} onClose={() => setShowMED(false)} />}
      {doc && <FactureModal data={doc} onClose={() => setDoc(null)} />}
    </div>
  );
}