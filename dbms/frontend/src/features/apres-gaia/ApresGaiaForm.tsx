import { useMemo, useState } from "react";
import { PaymentTranche } from "../../types";
import { fmtDA, fmtDAOrBlank, fmtDate } from "../../shared/lib/format";
import { validateTranche, trancheBounds, MIN_TRANCHE } from "../../shared/lib/payments";
import { buildTrancheDocument } from "../../shared/lib/trancheDocument";
import { blueTheme } from "../../shared/theme/theme";
import { stadeInfo } from "../../shared/lib/juridique";
import { useAppData } from "../../store/AppData";
import { useApresGaiaLookup } from "../../hooks";
import {
  EMPTY_APRES_FORM,
  apresProfileToDebtor,
  isValidAccountNumber,
  pendingTotal,
  toApresFormValues,
} from "../../services";
import FactureModal, { FactureData } from "../facture/FactureModal";
import Field from "../../shared/ui/Field";
import Section from "../../shared/ui/Section";
import TrancheStatusBadge from "../../shared/ui/TrancheStatusBadge";

interface Props {
  onOpenDB: () => void;
  onViewHistory?: (n: string) => void;
  onViewJuridique?: (n: string) => void;
  onGoToHorsGaia?: () => void;
}

const accent = blueTheme;

/**
 * Après Gaïa search screen: type the account number `n`, the backend returns
 * the client, its facturation and its règlements. "Encaisser" records a
 * règlement (starts "En attente"), "Valider" / "Refuser" settle it. Columns
 * without a counterpart in `apres_gaia` stay blank.
 */
export default function ApresGaiaForm({ onOpenDB, onViewHistory, onViewJuridique, onGoToHorsGaia }: Props) {
  const [numInput, setNumInput] = useState("");
  const [doc, setDoc] = useState<FactureData | null>(null);
  const [montant, setMontant] = useState("");
  const [lieu, setLieu] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);

  const { profile, status, error: lookupError, search: lookup, clear, encaisser, valider, refuser } = useApresGaiaLookup();
  const { getJuridique, commentaires, setCommentaire } = useAppData();

  const debtor = useMemo(() => (profile ? apresProfileToDebtor(profile) : null), [profile]);
  const values = useMemo(
    () => (profile ? toApresFormValues(profile) : { ...EMPTY_APRES_FORM, numCompte: numInput }),
    [profile, numInput],
  );
  const f = profile !== null;
  const loading = status === "loading";
  const facturation = profile?.details_facturation;
  const commentaire = debtor ? commentaires[`apres:${debtor.id}`] ?? "" : "";

  const pending = debtor ? pendingTotal(debtor.historique) : 0;
  const { min, max } = trancheBounds(debtor?.solde ?? 0, pending);

  const search = async () => {
    if (!numInput.trim()) return;
    setError(null);
    await lookup(numInput);
  };

  const submitEncaisser = async () => {
    if (!debtor) return;
    const amount = Number(montant);
    const err = validateTranche(amount, debtor.solde, pending);
    if (err) {
      setError(err);
      setSuccess(false);
      return;
    }
    setBusy(true);
    const failure = await encaisser(amount, lieu);
    setBusy(false);
    if (failure) {
      setError(failure);
      setSuccess(false);
      return;
    }
    setMontant("");
    setLieu("");
    setError(null);
    setSuccess(true);
    setTimeout(() => setSuccess(false), 2500);
  };

  const settle = async (fn: (ref: string) => Promise<string | null>, ref: string) => {
    setError(await fn(ref));
  };

  const viewTranche = (t: PaymentTranche) => {
    if (!debtor) return;
    setDoc(
      buildTrancheDocument(debtor, t, "Après Gaïa", "N° Compte", "GA", {
        numClient: values.numClient,
        montantHT: facturation?.montant_ht ?? undefined,
        tvaAmount: facturation?.tva ?? undefined,
        montantTTC: facturation?.montant_ttc ?? undefined,
        service: "Service Recouvrement & Contentieux",
        extraFields: values.motifRes ? [{ label: "Motif de résiliation", value: values.motifRes }] : [],
      }),
    );
  };

  const reset = () => {
    setNumInput("");
    clear();
    setMontant("");
    setLieu("");
    setError(null);
  };

  return (
    <div className="h-full flex flex-col overflow-hidden px-5 py-3 gap-2.5">
      {/* Search */}
      <div className="flex-shrink-0">
        <label className="block text-[11px] text-gray-500 mb-0.5">N° Compte *</label>
        <div className="flex gap-2">
          <input
            type="text"
            inputMode="numeric"
            placeholder="ex. 1042"
            value={numInput}
            onChange={(e) => setNumInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && search()}
            className={`flex-1 font-mono rounded-lg px-3 py-1.5 text-sm focus:outline-none transition-colors ${
              f ? accent.filled : `bg-white border-2 border-gray-300 ${accent.focusBorder}`
            }`}
          />
          <button
            onClick={search}
            disabled={loading}
            className={`px-5 py-1.5 text-white text-sm rounded-lg transition-colors whitespace-nowrap disabled:opacity-60 ${accent.bg} ${accent.hover}`}
          >
            {loading ? "Recherche…" : "Rechercher"}
          </button>
          {onViewHistory && (
            <button
              onClick={() => debtor && onViewHistory(debtor.id)}
              disabled={!f}
              className={`px-4 py-1.5 text-sm rounded-lg whitespace-nowrap border-2 transition-colors ${
                f
                  ? `bg-white ${accent.border} ${accent.text} ${accent.hoverLight}`
                  : "bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed"
              }`}
            >
              Imprimer l'historique
            </button>
          )}
          {onViewJuridique && (
            <button
              onClick={() => debtor && onViewJuridique(debtor.id)}
              disabled={!f}
              className={`px-4 py-1.5 text-sm rounded-lg whitespace-nowrap border-2 transition-colors ${
                f
                  ? `bg-white ${accent.border} ${accent.text} ${accent.hoverLight}`
                  : "bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed"
              }`}
            >
              État juridique
            </button>
          )}
          {onGoToHorsGaia && (
            <button
              onClick={onGoToHorsGaia}
              className="px-4 py-1.5 text-sm rounded-lg whitespace-nowrap border-2 border-amber-300 text-amber-700 hover:bg-amber-50 transition-colors"
            >
              Voir en Hors Gaïa →
            </button>
          )}
        </div>
        {status === "not_found" && (
          <p className="text-xs text-red-600 mt-1 font-medium">
            {isValidAccountNumber(numInput) ? "Compte introuvable." : "Le N° de compte doit être un nombre entier."}
          </p>
        )}
        {status === "error" && <p className="text-xs text-red-600 mt-1 font-medium">{lookupError}</p>}
        {f && debtor && (
          <p className="text-xs text-green-600 mt-1 font-medium">
            ✓ Données chargées
            <span className={`ml-2 px-2 py-0.5 rounded-full text-[10px] ${stadeInfo(getJuridique("apres", debtor.id).stade).badge}`}>
              {stadeInfo(getJuridique("apres", debtor.id).stade).label}
            </span>
          </p>
        )}
      </div>

      {/* Two-column body, fills remaining height without scrolling */}
      <div className="flex-1 min-h-0 grid grid-cols-2 gap-4">
        {/* Left: client info */}
        <Section title="Informations Client" accentClass={accent.bg} className="min-h-0">
          <div className="grid grid-cols-2 gap-2">
            <Field label="N° Client" value={values.numClient} readOnly filled={f} filledClass={accent.filled} mono />
            <Field label="Statut" value={values.statut} readOnly filled={f} filledClass={accent.filled} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Nom" value={values.nom} readOnly filled={f} filledClass={accent.filled} />
            <Field label="Prénom" value={values.prenom} readOnly filled={f} filledClass={accent.filled} />
          </div>
          <Field label="Adresse" value={values.adresse} readOnly filled={f} filledClass={accent.filled} />
          <div className="grid grid-cols-3 gap-2">
            <Field label="Wilaya" value={values.wilaya} readOnly filled={f} filledClass={accent.filled} />
            <Field label="Commune" value={values.commune} readOnly filled={f} filledClass={accent.filled} />
            <Field label="Code postal" value={values.codePostal} readOnly filled={f} filledClass={accent.filled} mono />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Tél fixe" value={values.telephoneFixe} readOnly filled={f} filledClass={accent.filled} mono />
            <Field label="GSM" value={values.gsm} readOnly filled={f} filledClass={accent.filled} mono />
          </div>
          <Field label="Email" type="email" value={values.email} readOnly filled={f} filledClass={accent.filled} />
          <Field label="Type service" value={values.typeService} readOnly filled={f} filledClass={accent.filled} />
          {values.motifRes && (
            <Field label="Motif de résiliation" value={values.motifRes} readOnly filled={f} filledClass={accent.filled} />
          )}

          {/* Détails de facturation — TTC est la base, TVA en est soustraite */}
          <div className="pt-1">
            <div className="mb-1 flex items-center gap-2">
              <div className={`w-1 h-3.5 rounded-full ${accent.bg}`} />
              <span className="text-sm text-[#1C2235]">Facturation &amp; TVA</span>
            </div>
            {facturation ? (
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className={`rounded-lg px-2.5 py-1.5 ${accent.card}`}>
                  <div className={`text-[10px] uppercase ${accent.cardLabel}`}>Montant TTC</div>
                  <div className={`font-mono font-semibold min-h-[1lh] ${accent.cardValue}`}>{fmtDAOrBlank(facturation.montant_ttc)}</div>
                </div>
                <div className="rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5">
                  <div className="text-[10px] uppercase text-gray-400">− TVA</div>
                  <div className="font-mono min-h-[1lh]">{fmtDAOrBlank(facturation.tva)}</div>
                </div>
                <div className="rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5">
                  <div className="text-[10px] uppercase text-gray-400">= Montant HT</div>
                  <div className="font-mono min-h-[1lh]">{fmtDAOrBlank(facturation.montant_ht)}</div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-gray-400 italic">Recherchez un compte pour afficher le détail TTC / TVA / HT.</p>
            )}
          </div>

          {/* Débit — attribut technique de la ligne, pas du client, placé sous la Facturation */}
          <div className="pt-1">
            <div className="mb-1 flex items-center gap-2">
              <div className={`w-1 h-3.5 rounded-full ${accent.bg}`} />
              <span className="text-sm text-[#1C2235]">Débit de la ligne</span>
            </div>
            <Field label="Débit" placeholder="ex. 20 Mb/s" value={values.debit} readOnly filled={f} filledClass={accent.filled} mono />
          </div>

          {/* Commentaire (note locale : pas de colonne correspondante dans apres_gaia) */}
          <div className="pt-1">
            <div className="mb-1 flex items-center gap-2">
              <div className={`w-1 h-3.5 rounded-full ${accent.bg}`} />
              <span className="text-sm text-[#1C2235]">Commentaire</span>
            </div>
            <textarea
              rows={2}
              placeholder="Note libre sur ce dossier…"
              value={commentaire}
              disabled={!debtor}
              onChange={(e) => debtor && setCommentaire("apres", debtor.id, e.target.value)}
              className={`w-full rounded-lg px-3 py-1.5 text-sm text-[#1C2235] bg-white border-2 border-gray-300 focus:outline-none ${accent.focusBorder} transition-colors resize-none disabled:bg-gray-50`}
            />
          </div>
        </Section>

        {/* Right: history */}
        <div className="flex flex-col min-h-0 gap-2">
          <Section title="Historique" accentClass={accent.bg} className="flex-1 min-h-0">
            {!debtor ? (
              <p className="text-xs text-gray-400 italic">Recherchez un compte pour afficher son historique.</p>
            ) : (
              <>
                <div className="flex items-center justify-between px-3 py-2 rounded-lg border-2 text-sm bg-gray-50 border-gray-200">
                  <span>Solde dû actuellement</span>
                  <span className={`font-mono font-medium ${debtor.solde > 0 ? "text-red-600" : "text-green-600"}`}>
                    {fmtDA(debtor.solde)}
                  </span>
                </div>

                {debtor.solde > 0 && (
                  <div className="bg-gray-50 rounded-lg border border-gray-200 p-2.5 space-y-1.5">
                    <p className="text-[11px] text-gray-500">
                      Montant entre {fmtDA(min)} et {fmtDA(max)}
                      {max > MIN_TRANCHE ? ` (min. ${fmtDA(MIN_TRANCHE)}).` : "."}
                      {pending > 0 && ` ${fmtDA(pending)} en attente de validation déjà déduits.`}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder="Montant versé (DA)"
                        value={montant}
                        onChange={(e) => {
                          setMontant(e.target.value);
                          setError(null);
                        }}
                        className={`flex-1 min-w-[8rem] bg-white border-2 border-gray-300 rounded-lg px-2.5 py-1.5 text-sm font-mono focus:outline-none ${accent.focusBorder} transition-colors`}
                      />
                      <input
                        type="text"
                        placeholder="Lieu de versement"
                        value={lieu}
                        onChange={(e) => setLieu(e.target.value)}
                        className={`w-40 bg-white border-2 border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none ${accent.focusBorder} transition-colors`}
                      />
                      <button
                        onClick={submitEncaisser}
                        disabled={busy}
                        className={`px-4 py-1.5 text-white rounded-lg text-sm transition-colors whitespace-nowrap disabled:opacity-60 ${accent.bg} ${accent.hover}`}
                      >
                        {busy ? "Enregistrement…" : "Encaisser"}
                      </button>
                    </div>
                  </div>
                )}
                {error && <p className="text-xs text-red-600">{error}</p>}
                {success && <p className="text-xs text-green-600">✓ Versement enregistré (en attente de validation).</p>}

                <div>
                  <div className="mb-1 text-[11px] uppercase text-gray-400">Versements</div>
                  {debtor.historique.length > 0 ? (
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="text-left px-2.5 py-1.5 text-gray-500 font-medium">Date</th>
                            <th className="text-left px-2.5 py-1.5 text-gray-500 font-medium">Lieu</th>
                            <th className="text-right px-2.5 py-1.5 text-gray-500 font-medium">Montant</th>
                            <th className="text-center px-2.5 py-1.5 text-gray-500 font-medium">Statut</th>
                            <th className="text-center px-2.5 py-1.5 text-gray-500 font-medium">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...debtor.historique].reverse().map((t) => (
                            <tr key={t.id} className="border-t border-gray-100">
                              <td className="px-2.5 py-1.5 font-mono">{fmtDate(t.date)}</td>
                              <td className="px-2.5 py-1.5">{t.lieu ?? ""}</td>
                              <td className="px-2.5 py-1.5 text-right font-mono">{fmtDA(t.montant)}</td>
                              <td className="px-2.5 py-1.5 text-center">
                                <TrancheStatusBadge tranche={t} validClass={accent.badge} />
                              </td>
                              <td className="px-2.5 py-1.5">
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    onClick={() => viewTranche(t)}
                                    title="Voir le document"
                                    className="w-6 h-6 rounded-full border border-gray-300 hover:bg-gray-100 flex items-center justify-center"
                                  >
                                    👁
                                  </button>
                                  {t.statut === "en_attente" && (
                                    <>
                                      <button
                                        onClick={() => settle(valider, t.id)}
                                        className={`px-2 py-0.5 rounded-lg text-[10px] text-white ${accent.bg} ${accent.hover}`}
                                      >
                                        Valider
                                      </button>
                                      <button
                                        onClick={() => settle(refuser, t.id)}
                                        className="px-2 py-0.5 rounded-lg text-[10px] border border-red-300 text-red-700 hover:bg-red-50"
                                      >
                                        Refuser
                                      </button>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 italic">Aucun versement enregistré.</p>
                  )}
                </div>
              </>
            )}
          </Section>

          {/* Actions */}
          <div className="flex-shrink-0 flex flex-col gap-1.5">
            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={onOpenDB}
                className={`py-2 rounded-lg text-sm bg-white border-2 ${accent.border} ${accent.text} ${accent.hoverLight} transition-colors`}
              >
                Base de Données
              </button>
              <button
                onClick={reset}
                className="py-2 rounded-lg text-sm text-gray-400 border border-gray-200 hover:text-gray-600 transition-colors"
              >
                Réinitialiser
              </button>
            </div>
          </div>
        </div>
      </div>

      {doc && <FactureModal data={doc} onClose={() => setDoc(null)} />}
    </div>
  );
}
