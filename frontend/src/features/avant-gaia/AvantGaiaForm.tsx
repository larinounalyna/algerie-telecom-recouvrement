import { useMemo, useState } from "react";
import { PaymentTranche } from "../../types";
import { fmtDA, fmtDAOrBlank, fmtDate } from "../../shared/lib/format";
import { buildTrancheDocument } from "../../shared/lib/trancheDocument";
import FactureModal, { FactureData } from "../facture/FactureModal";
import Field from "../../shared/ui/Field";
import Section from "../../shared/ui/Section";
import TrancheStatusBadge from "../../shared/ui/TrancheStatusBadge";
import { stadeInfo } from "../../shared/lib/juridique";
import { useAppData } from "../../store/AppData";
import { useAvantGaiaLookup } from "../../hooks";
import { EMPTY_AVANT_FORM, AvantGaiaFormValues, avantProfileToDebtor, toAvantFormValues } from "../../services";

interface Props {
  onOpenDB: () => void;
  onViewHistory?: (numAbonne: string) => void;
  onViewJuridique?: (numAbonne: string) => void;
  onGoToApresGaia?: () => void;
}

/**
 * Avant Gaïa search screen (READ ONLY): type a N° abonné, the backend returns
 * the client, its facturation, the versement history and the consommation
 * history. Columns without a counterpart in `avant_gaia` stay blank.
 */
export default function AvantGaiaForm({ onOpenDB, onViewHistory, onViewJuridique, onGoToApresGaia }: Props) {
  const [form, setForm] = useState<AvantGaiaFormValues>(EMPTY_AVANT_FORM);
  const [doc, setDoc] = useState<FactureData | null>(null);
  const { profile, status, error, search: lookup, clear } = useAvantGaiaLookup();
  const { getJuridique } = useAppData();

  const debtor = useMemo(() => (profile ? avantProfileToDebtor(profile) : null), [profile]);
  const f = profile !== null;
  const loading = status === "loading";
  const facturation = profile?.details_facturation;

  const set = (k: keyof AvantGaiaFormValues) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  const search = async () => {
    const id = form.numAbonne.trim();
    if (!id) return;
    const p = await lookup(id);
    setForm(p ? toAvantFormValues(p) : { ...EMPTY_AVANT_FORM, numAbonne: form.numAbonne });
  };

  const reset = () => {
    setForm(EMPTY_AVANT_FORM);
    clear();
  };

  const viewTranche = (t: PaymentTranche) => {
    if (!debtor || !profile) return;
    setDoc(
      buildTrancheDocument(debtor, t, "Hors Gaïa", "N° Abonné", "HG", {
        montantHT: facturation?.somme_ht ?? undefined,
        tvaAmount: facturation?.tva ?? undefined,
        montantTTC: facturation?.ttc ?? undefined,
        service: "Service Recouvrement & Contentieux",
        actel: profile.informations_client.actel ?? undefined,
        extraFields: [
          { label: "Groupement", value: form.groupement },
          { label: "Code payeur", value: form.codePayeur },
        ],
      }),
    );
  };

  return (
    <div className="h-full flex flex-col overflow-hidden px-5 py-3 gap-2.5">
      {/* Search */}
      <div className="flex-shrink-0">
        <label className="block text-[11px] text-gray-500 mb-0.5">N° Abonné *</label>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="ex. 021123456"
            value={form.numAbonne}
            onChange={set("numAbonne")}
            onKeyDown={(e) => e.key === "Enter" && search()}
            className={`flex-1 font-mono rounded-lg px-3 py-1.5 text-sm focus:outline-none transition-colors ${
              f ? "bg-amber-50 border-2 border-amber-400" : "bg-white border-2 border-gray-300 focus:border-amber-500"
            }`}
          />
          <button
            onClick={search}
            disabled={loading}
            className="px-5 py-1.5 bg-amber-500 text-white text-sm rounded-lg hover:bg-amber-600 transition-colors whitespace-nowrap disabled:opacity-60"
          >
            {loading ? "Recherche…" : "Rechercher"}
          </button>
          {onViewHistory && (
            <button
              onClick={() => debtor && onViewHistory(debtor.id)}
              disabled={!f}
              className={`px-4 py-1.5 text-sm rounded-lg whitespace-nowrap border-2 transition-colors ${
                f
                  ? "bg-white border-amber-400 text-amber-700 hover:bg-amber-50"
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
                  ? "bg-white border-amber-400 text-amber-700 hover:bg-amber-50"
                  : "bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed"
              }`}
            >
              État juridique
            </button>
          )}
          {onGoToApresGaia && (
            <button
              onClick={onGoToApresGaia}
              className="px-4 py-1.5 text-sm rounded-lg whitespace-nowrap border-2 border-blue-300 text-blue-700 hover:bg-blue-50 transition-colors"
            >
              Voir en Après Gaïa →
            </button>
          )}
        </div>
        {status === "not_found" && <p className="text-xs text-red-600 mt-1 font-medium">Abonné introuvable.</p>}
        {status === "error" && <p className="text-xs text-red-600 mt-1 font-medium">{error}</p>}
        {f && debtor && (
          <p className="text-xs text-green-600 mt-1 font-medium">
            ✓ Données chargées
            <span className={`ml-2 px-2 py-0.5 rounded-full text-[10px] ${stadeInfo(getJuridique("avant", debtor.id).stade).badge}`}>
              {stadeInfo(getJuridique("avant", debtor.id).stade).label}
            </span>
          </p>
        )}
      </div>

      {/* Two-column body, fills remaining height without scrolling */}
      <div className="flex-1 min-h-0 grid grid-cols-2 gap-4">
        {/* Left: client info */}
        <Section title="Informations Client" accentClass="bg-amber-500" className="min-h-0">
          <div className="grid grid-cols-2 gap-2">
            <Field label="Nom" value={form.nom} readOnly filled={f} />
            <Field label="Prénom" value={form.prenom} readOnly filled={f} />
          </div>
          <Field label="Adresse" value={form.adresse} readOnly filled={f} />
          <div className="grid grid-cols-2 gap-2">
            <Field label="Wilaya" value={form.wilaya} readOnly filled={f} />
            <Field label="Commune" value={form.commune} readOnly filled={f} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Téléphone" value={form.telephone} readOnly filled={f} mono />
            <Field label="Type de service" value={form.typeService} readOnly filled={f} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Field label="Groupement" value={form.groupement} readOnly filled={f} mono />
            <Field label="Code payeur" value={form.codePayeur} readOnly filled={f} mono />
            <Field label="CCP" value={form.ccp} readOnly filled={f} mono />
          </div>
          <div className="grid grid-cols-4 gap-2">
            <Field label="Bimestre" value={form.bimestre} readOnly filled={f} mono />
            <Field label="Anc. Index" value={form.ancienIndex} readOnly filled={f} mono />
            <Field label="Nouv. Index" value={form.nouvelIndex} readOnly filled={f} mono />
            <Field label="Cons." value={form.consommation} readOnly filled={f} mono />
          </div>

          {/* Détails de facturation — TTC est la base, TVA en est soustraite */}
          <div className="pt-1">
            <div className="mb-1 flex items-center gap-2">
              <div className="w-1 h-3.5 rounded-full bg-amber-500" />
              <span className="text-sm text-[#1C2235]">Détails de Facturation</span>
            </div>
            {facturation ? (
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5">
                  <div className="text-[10px] uppercase text-gray-400">Abonnement</div>
                  <div className="font-mono min-h-[1lh]">{fmtDAOrBlank(facturation.abonnement)}</div>
                </div>
                <div className="rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5">
                  <div className="text-[10px] uppercase text-gray-400">Mont. Compteur</div>
                  <div className="font-mono min-h-[1lh]">{fmtDAOrBlank(facturation.montant_compteur)}</div>
                </div>
                <div className="rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5">
                  <div className="text-[10px] uppercase text-gray-400">Dû antérieur</div>
                  <div className="font-mono min-h-[1lh]">{fmtDAOrBlank(facturation.dus_anterieur)}</div>
                </div>
                <div className="rounded-lg border-2 border-amber-300 bg-amber-50 px-2.5 py-1.5">
                  <div className="text-[10px] uppercase text-amber-600">Montant TTC</div>
                  <div className="font-mono font-semibold text-amber-800 min-h-[1lh]">{fmtDAOrBlank(facturation.ttc)}</div>
                </div>
                <div className="rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5">
                  <div className="text-[10px] uppercase text-gray-400">− TVA</div>
                  <div className="font-mono min-h-[1lh]">{fmtDAOrBlank(facturation.tva)}</div>
                </div>
                <div className="rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5">
                  <div className="text-[10px] uppercase text-gray-400">= Montant HT</div>
                  <div className="font-mono min-h-[1lh]">{fmtDAOrBlank(facturation.somme_ht)}</div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-gray-400 italic">Recherchez un abonné pour afficher le détail TTC / TVA / HT.</p>
            )}
          </div>
        </Section>

        {/* Right: history + actions */}
        <div className="flex flex-col min-h-0 gap-2">
          <Section title="Historique" accentClass="bg-amber-500" className="flex-1 min-h-0">
            {!debtor ? (
              <p className="text-xs text-gray-400 italic">Recherchez un abonné pour afficher son historique.</p>
            ) : (
              <>
                {/* Solde */}
                <div className="flex items-center justify-between px-3 py-2 rounded-lg border-2 text-sm bg-gray-50 border-gray-200">
                  <span>Solde dû actuellement</span>
                  <span className={`font-mono font-medium ${debtor.solde > 0 ? "text-red-600" : "text-green-600"}`}>
                    {fmtDA(debtor.solde)}
                  </span>
                </div>

                {/* Historique des versements (lecture seule : pas d'encaissement côté Avant Gaïa) */}
                <div>
                  <div className="mb-1 text-[11px] uppercase text-gray-400">Versements</div>
                  {debtor.historique.length > 0 ? (
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="text-left px-2.5 py-1.5 text-gray-500 font-medium">Date</th>
                            <th className="text-left px-2.5 py-1.5 text-gray-500 font-medium">Agent</th>
                            <th className="text-right px-2.5 py-1.5 text-gray-500 font-medium">Montant</th>
                            <th className="text-center px-2.5 py-1.5 text-gray-500 font-medium">Statut</th>
                            <th className="text-center px-2.5 py-1.5 text-gray-500 font-medium">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...debtor.historique].reverse().map((t) => (
                            <tr key={t.id} className="border-t border-gray-100">
                              <td className="px-2.5 py-1.5 font-mono">{fmtDate(t.date)}</td>
                              <td className="px-2.5 py-1.5">{/* no agent column in avant_gaia_versement */}</td>
                              <td className="px-2.5 py-1.5 text-right font-mono">{fmtDA(t.montant)}</td>
                              <td className="px-2.5 py-1.5 text-center">
                                <TrancheStatusBadge tranche={t} tracked={false} validClass="" />
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

                {/* Historique de consommation */}
                <div>
                  <div className="mb-1 text-[11px] uppercase text-gray-400">Consommation (par bimestre)</div>
                  {debtor.consommationHistorique && debtor.consommationHistorique.length > 0 ? (
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="text-left px-2.5 py-1.5 text-gray-500 font-medium">Bimestre</th>
                            <th className="text-right px-2.5 py-1.5 text-gray-500 font-medium">Anc.</th>
                            <th className="text-right px-2.5 py-1.5 text-gray-500 font-medium">Nouv.</th>
                            <th className="text-right px-2.5 py-1.5 text-gray-500 font-medium">Cons.</th>
                          </tr>
                        </thead>
                        <tbody>
                          {debtor.consommationHistorique.map((c) => (
                            <tr key={c.id} className="border-t border-gray-100">
                              <td className="px-2.5 py-1.5 font-mono">{c.bimestre}</td>
                              <td className="px-2.5 py-1.5 text-right font-mono">{c.ancienIndex}</td>
                              <td className="px-2.5 py-1.5 text-right font-mono">{c.nouvelIndex}</td>
                              <td className="px-2.5 py-1.5 text-right font-mono">{c.consommation ?? ""}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 italic">Aucun historique de consommation.</p>
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
                className="py-2 rounded-lg text-sm bg-white border-2 border-amber-400 text-amber-700 hover:bg-amber-50 transition-colors"
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
