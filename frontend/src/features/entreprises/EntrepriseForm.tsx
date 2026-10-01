import { useState } from "react";
import { EntrepriseClient, PaymentTranche } from "../../types";
import { fmtDA, fmtDate, todayISO } from "../../shared/lib/format";
import { generateTrancheId } from "../../shared/lib/generators";
import { validateTranche, trancheBounds, MIN_TRANCHE } from "../../shared/lib/payments";
import { entrepriseToDebtor } from "../../shared/lib/debtor";
import { buildTrancheDocument } from "../../shared/lib/trancheDocument";
import { greenTheme } from "../../shared/theme/theme";
import { splitTTC } from "../../shared/lib/tva";
import { stadeInfo } from "../../shared/lib/juridique";
import { useAppData } from "../../store/AppData";
import FactureModal, { FactureData } from "../facture/FactureModal";
import Field from "../../shared/ui/Field";
import Section from "../../shared/ui/Section";

interface FormState {
  numCompte: string;
  numClient: string;
  nom: string;
  prenom: string;
  adresse: string;
  commune: string;
  wilaya: string;
  codePostal: string;
  telephoneFixe: string;
  gsm: string;
  email: string;
  typeService: string;
  debit: string;
  statut: string;
  motifRes: string;
  commentaire: string;
  agent: string;
  // Entreprises
  formeJuridique: string;
  nif: string;
  rc: string;
  nis: string;
  secteur: string;
  representant: string;
  fonctionRepresentant: string;
}

const empty: FormState = {
  numCompte: "",
  numClient: "",
  nom: "",
  prenom: "",
  adresse: "",
  commune: "",
  wilaya: "",
  codePostal: "",
  telephoneFixe: "",
  gsm: "",
  email: "",
  typeService: "",
  debit: "",
  statut: "",
  motifRes: "",
  commentaire: "",
  agent: "",
  formeJuridique: "",
  nif: "",
  rc: "",
  nis: "",
  secteur: "",
  representant: "",
  fonctionRepresentant: "",
};

interface Props {
  data: EntrepriseClient[];
  onOpenDB: () => void;
  onViewHistory?: (numCompte: string) => void;
  onViewJuridique?: (numCompte: string) => void;
  onRecordPayment?: (numCompte: string, tranche: PaymentTranche) => void;
  onValidateTranche?: (numCompte: string, trancheId: string) => void;
}

/**
 * Entreprises screen. Companies have no table in the backend yet, so this
 * screen keeps working on the local (mock) data held by the store; the
 * Avant / Après Gaïa screens are the ones wired to the API.
 */
export default function EntrepriseForm({
  data,
  onOpenDB,
  onViewHistory,
  onViewJuridique,
  onRecordPayment,
  onValidateTranche,
}: Props) {
  const [form, setForm] = useState<FormState>(empty);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [doc, setDoc] = useState<FactureData | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [montant, setMontant] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const accent = greenTheme;
  const { getJuridique, commentaires, setCommentaire } = useAppData();
  const current = selectedId ? data.find((c) => c.numCompte === selectedId) ?? null : null;

  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  const populate = (c: EntrepriseClient) => {
    const e = c;
    setForm({
      numCompte: c.numCompte,
      numClient: c.numClient,
      nom: c.nom,
      prenom: c.prenom,
      adresse: c.adresse,
      commune: c.commune,
      wilaya: c.wilaya,
      codePostal: c.codePostal,
      telephoneFixe: c.telephoneFixe,
      gsm: c.gsm,
      email: c.email,
      typeService: c.typeService,
      debit: c.debit,
      statut: c.statut,
      motifRes: c.motifRes,
      commentaire: commentaires[`entreprise:${c.numCompte}`] ?? c.commentaire ?? "",
      agent: form.agent,
      formeJuridique: e.formeJuridique ?? "",
      nif: e.nif ?? "",
      rc: e.rc ?? "",
      nis: e.nis ?? "",
      secteur: e.secteur ?? "",
      representant: e.representant ?? "",
      fonctionRepresentant: e.fonctionRepresentant ?? "",
    });
    setNotFound(false);
  };

  const search = () => {
    const id = form.numCompte.trim().toUpperCase();
    const found = data.find((r) => r.numCompte.toUpperCase() === id || r.numClient.toUpperCase() === id);
    if (found) {
      setSelectedId(found.numCompte);
      populate(found);
    } else {
      setSelectedId(null);
      setNotFound(true);
    }
  };

  const f = current !== null;

  // La TVA est incluse dans le TTC : TVA = TTC × taux / (100 + taux), HT = TTC − TVA
  const { tva: tvaAmount, ht: montantHT } = current ? splitTTC(current.montantTTC, current.tva) : { tva: 0, ht: 0 };

  const { min, max } = trancheBounds(current?.solde ?? 0);

  const encaisser = () => {
    if (!current) return;
    const amount = Number(montant);
    const err = validateTranche(amount, current.solde);
    if (err) {
      setError(err);
      setSuccess(false);
      return;
    }
    const tranche: PaymentTranche = {
      id: generateTrancheId(),
      montant: amount,
      date: todayISO(),
      agent: form.agent || undefined,
    };
    onRecordPayment?.(current.numCompte, tranche);
    setMontant("");
    setError(null);
    setSuccess(true);
    setTimeout(() => setSuccess(false), 2500);
  };

  const viewTranche = (t: PaymentTranche) => {
    if (!current) return;
    setDoc(
      buildTrancheDocument(
        entrepriseToDebtor(current),
        t,
        "Entreprises",
        "N° Compte",
        "EN",
        {
        numClient: current.numClient,
        dateResiliation: current.dateResiliation,
        montantHT,
        tvaRate: current.tva,
        montantTTC: current.montantTTC,
        debit: current.debit,
        actel: current.actel,
          service: "Service Recouvrement & Contentieux",
          extraFields: [
            ...(form.nif ? [{ label: "NIF", value: form.nif }] : []),
            ...(form.representant ? [{ label: "Représentant légal", value: form.representant }] : []),
            ...(current.motifRes ? [{ label: "Motif de résiliation", value: current.motifRes }] : []),
          ],
        },
      ),
    );
  };

  const reset = () => {
    setForm(empty);
    setSelectedId(null);
    setNotFound(false);
    setMontant("");
    setError(null);
  };

  return (
    <div className="h-full flex flex-col overflow-hidden px-5 py-3 gap-2.5">
      {/* Search */}
      <div className="flex-shrink-0">
        <label className="block text-[11px] text-gray-500 mb-0.5">
          N° Compte / N° Client de l'entreprise *
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="ex. EN-2024-000101"
            value={form.numCompte}
            onChange={set("numCompte")}
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
          {onViewHistory && (
            <button
              onClick={() => current && onViewHistory(current.numCompte)}
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
              onClick={() => current && onViewJuridique(current.numCompte)}
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
        </div>
        {notFound && <p className="text-xs text-red-600 mt-1 font-medium">Compte introuvable.</p>}
        {f && !notFound && current && (
          <p className="text-xs text-green-600 mt-1 font-medium">
            ✓ Données chargées
            <span className={`ml-2 px-2 py-0.5 rounded-full text-[10px] ${stadeInfo(getJuridique("entreprise", current.numCompte).stade).badge}`}>
              {stadeInfo(getJuridique("entreprise", current.numCompte).stade).label}
            </span>
          </p>
        )}
      </div>

      {/* Two-column body, fills remaining height without scrolling */}
      <div className="flex-1 min-h-0 grid grid-cols-2 gap-4">
        {/* Left: client info */}
        <Section title="Informations Client" accentClass={accent.bg} className="min-h-0">
          <div className="grid grid-cols-2 gap-2">
            <Field label="N° Client" value={form.numClient} onChange={set("numClient")} filled={f} filledClass={accent.filled} mono />
            <Field label="Statut" value={form.statut} onChange={set("statut")} filled={f} filledClass={accent.filled} />
          </div>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Raison sociale" value={form.nom} onChange={set("nom")} filled={f} filledClass={accent.filled} />
                <Field label="Forme juridique" value={form.formeJuridique} onChange={set("formeJuridique")} filled={f} filledClass={accent.filled} />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Field label="NIF" value={form.nif} onChange={set("nif")} filled={f} filledClass={accent.filled} mono />
                <Field label="Registre de commerce" value={form.rc} onChange={set("rc")} filled={f} filledClass={accent.filled} mono />
                <Field label="NIS" value={form.nis} onChange={set("nis")} filled={f} filledClass={accent.filled} mono />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Représentant légal" value={form.representant} onChange={set("representant")} filled={f} filledClass={accent.filled} />
                <Field label="Fonction" value={form.fonctionRepresentant} onChange={set("fonctionRepresentant")} filled={f} filledClass={accent.filled} />
              </div>
              <Field label="Secteur d'activité" value={form.secteur} onChange={set("secteur")} filled={f} filledClass={accent.filled} />
          <Field label="Adresse" value={form.adresse} onChange={set("adresse")} filled={f} filledClass={accent.filled} />
          <div className="grid grid-cols-3 gap-2">
            <Field label="Wilaya" value={form.wilaya} onChange={set("wilaya")} filled={f} filledClass={accent.filled} />
            <Field label="Commune" value={form.commune} onChange={set("commune")} filled={f} filledClass={accent.filled} />
            <Field label="Code postal" value={form.codePostal} onChange={set("codePostal")} filled={f} filledClass={accent.filled} mono />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Tél fixe" value={form.telephoneFixe} onChange={set("telephoneFixe")} filled={f} filledClass={accent.filled} mono />
            <Field label="GSM" value={form.gsm} onChange={set("gsm")} filled={f} filledClass={accent.filled} mono />
          </div>
          <Field label="Email" type="email" value={form.email} onChange={set("email")} filled={f} filledClass={accent.filled} />
          <Field label="Type service" value={form.typeService} onChange={set("typeService")} filled={f} filledClass={accent.filled} />
          {form.motifRes && (
            <Field label="Motif de résiliation" value={form.motifRes} onChange={set("motifRes")} filled={f} filledClass={accent.filled} />
          )}

          {/* Détails de facturation — TTC est la base, TVA en est soustraite */}
          <div className="pt-1">
            <div className="mb-1 flex items-center gap-2">
              <div className={`w-1 h-3.5 rounded-full ${accent.bg}`} />
              <span className="text-sm text-[#1C2235]">Facturation &amp; TVA</span>
            </div>
            {current ? (
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className={`rounded-lg px-2.5 py-1.5 ${accent.card}`}>
                  <div className={`text-[10px] uppercase ${accent.cardLabel}`}>Montant TTC</div>
                  <div className={`font-mono font-semibold ${accent.cardValue}`}>{fmtDA(current.montantTTC)}</div>
                </div>
                <div className="rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5">
                  <div className="text-[10px] uppercase text-gray-400">− TVA ({current.tva}%)</div>
                  <div className="font-mono">{fmtDA(tvaAmount)}</div>
                </div>
                <div className="rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5">
                  <div className="text-[10px] uppercase text-gray-400">= Montant HT</div>
                  <div className="font-mono">{fmtDA(montantHT)}</div>
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
            <Field label="Débit" placeholder="ex. 20 Mb/s" value={form.debit} onChange={set("debit")} filled={f} filledClass={accent.filled} mono />
          </div>

          {/* Commentaire */}
          <div className="pt-1">
            <div className="mb-1 flex items-center gap-2">
              <div className={`w-1 h-3.5 rounded-full ${accent.bg}`} />
              <span className="text-sm text-[#1C2235]">Commentaire</span>
            </div>
            <textarea
              rows={2}
              placeholder="Note libre sur ce dossier…"
              value={form.commentaire}
              onChange={(e) => {
                set("commentaire")(e);
                if (current) setCommentaire("entreprise", current.numCompte, e.target.value);
              }}
              className={`w-full rounded-lg px-3 py-1.5 text-sm text-[#1C2235] bg-white border-2 border-gray-300 focus:outline-none ${accent.focusBorder} transition-colors resize-none`}
            />
          </div>
        </Section>

        {/* Right: history */}
        <div className="flex flex-col min-h-0 gap-2">
          <Section title="Historique" accentClass={accent.bg} className="flex-1 min-h-0">
            {!current ? (
              <p className="text-xs text-gray-400 italic">Recherchez un compte pour afficher son historique.</p>
            ) : (
              <>
                <div className="flex items-center justify-between px-3 py-2 rounded-lg border-2 text-sm bg-gray-50 border-gray-200">
                  <span>Solde dû actuellement</span>
                  <span className={`font-mono font-medium ${current.solde > 0 ? "text-red-600" : "text-green-600"}`}>
                    {fmtDA(current.solde)}
                  </span>
                </div>

                {current.solde > 0 && (
                  <div className="bg-gray-50 rounded-lg border border-gray-200 p-2.5 space-y-1.5">
                    <p className="text-[11px] text-gray-500">
                      Montant entre {fmtDA(min)} et {fmtDA(max)}
                      {max > MIN_TRANCHE ? ` (min. ${fmtDA(MIN_TRANCHE)}).` : "."}
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
                        placeholder="Agent"
                        value={form.agent}
                        onChange={set("agent")}
                        className={`w-28 bg-white border-2 border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none ${accent.focusBorder} transition-colors`}
                      />
                      <button
                        onClick={encaisser}
                        className={`px-4 py-1.5 text-white rounded-lg text-sm transition-colors whitespace-nowrap ${accent.bg} ${accent.hover}`}
                      >
                        Encaisser
                      </button>
                    </div>
                    {error && <p className="text-xs text-red-600">{error}</p>}
                    {success && <p className="text-xs text-green-600">✓ Versement enregistré.</p>}
                  </div>
                )}

                <div>
                  <div className="mb-1 text-[11px] uppercase text-gray-400">Versements</div>
                  {current.historique && current.historique.length > 0 ? (
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
                          {[...current.historique].reverse().map((t) => (
                            <tr key={t.id} className="border-t border-gray-100">
                              <td className="px-2.5 py-1.5 font-mono">{fmtDate(t.date)}</td>
                              <td className="px-2.5 py-1.5">{t.agent || "—"}</td>
                              <td className="px-2.5 py-1.5 text-right font-mono">{fmtDA(t.montant)}</td>
                              <td className="px-2.5 py-1.5 text-center">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                                    t.valide ? accent.badge : "bg-gray-100 text-gray-500"
                                  }`}
                                >
                                  {t.valide ? "Validé" : "En attente"}
                                </span>
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
                                  {onValidateTranche && !t.valide && (
                                    <button
                                      onClick={() => onValidateTranche(current.numCompte, t.id)}
                                      className={`px-2 py-0.5 rounded-lg text-[10px] text-white ${accent.bg} ${accent.hover}`}
                                    >
                                      Valider
                                    </button>
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
