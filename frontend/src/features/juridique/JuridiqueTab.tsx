import { useMemo, useState } from "react";
import { AccentTheme, DebtorView, EtatJuridique, StadeJuridique } from "../../types";
import { useAppData } from "../../store/AppData";
import { DELAI_MED_JOURS, STADES, lastMED, stadeInfo } from "../../shared/lib/juridique";
import { fmtDA, fmtDate, todayISO } from "../../shared/lib/format";
import { ApresGaiaMedController } from "../../hooks/useApresGaiaMed";
import ApresGaiaMedPanel from "./ApresGaiaMedPanel";

interface Props {
  client: DebtorView;
  accent: AccentTheme;
  /** Only used for kind === "apres" — the real backend-backed MED dossier. */
  medController?: ApresGaiaMedController;
}

type TimelineItem = { id: string; date: string; label: string; note?: string; tone: "med" | "event" };

const inputCls =
  "w-full bg-white border-2 border-gray-300 rounded-lg px-3 py-1.5 text-sm text-[#1C2235] focus:outline-none transition-colors";

/**
 * Clients particuliers — Après Gaïa (kind === "apres") get the real,
 * backend-backed mises en demeure / état juridique dossier
 * (apres_gaia_med). Avant Gaïa and Entreprises keep the original
 * localStorage-based "dossier contentieux" below, unchanged.
 */
export default function JuridiqueTab({ client, accent, medController }: Props) {
  if (client.kind === "apres" && medController) {
    return <ApresGaiaMedPanel client={client} accent={accent} controller={medController} />;
  }

  return <LegacyJuridiqueTab client={client} accent={accent} />;
}

function LegacyJuridiqueTab({ client, accent }: Props) {
  const { getJuridique, changeStade, updateJuridique, addEvent } = useAppData();
  const j = getJuridique(client.kind, client.id);
  const info = stadeInfo(j.stade);

  const [draft, setDraft] = useState<EtatJuridique>(j);
  const [saved, setSaved] = useState(false);
  const [note, setNote] = useState("");

  // The dossier form is edited as a draft and only written to the store on
  // "Enregistrer le dossier".
  const dossierDirty =
    draft.numDossier !== j.numDossier ||
    draft.tribunal !== j.tribunal ||
    draft.huissier !== j.huissier ||
    draft.avocat !== j.avocat ||
    draft.dateAudience !== j.dateAudience ||
    draft.montantReclame !== j.montantReclame ||
    draft.fraisJustice !== j.fraisJustice ||
    draft.observations !== j.observations;

  const setD = <K extends keyof EtatJuridique>(k: K, v: EtatJuridique[K]) => {
    setDraft((p) => ({ ...p, [k]: v }));
    setSaved(false);
  };

  const saveDossier = () => {
    updateJuridique(client.kind, client.id, {
      numDossier: draft.numDossier,
      tribunal: draft.tribunal,
      huissier: draft.huissier,
      avocat: draft.avocat,
      dateAudience: draft.dateAudience,
      montantReclame: draft.montantReclame,
      fraisJustice: draft.fraisJustice,
      observations: draft.observations,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const last = lastMED(j);
  const deadline = useMemo(() => {
    if (!last) return null;
    const d = new Date(last.date);
    d.setDate(d.getDate() + DELAI_MED_JOURS);
    return d.toISOString().slice(0, 10);
  }, [last]);
  const expired = deadline !== null && deadline < todayISO();

  const timeline: TimelineItem[] = useMemo(() => {
    const items: TimelineItem[] = [
      ...j.mises.map((m) => ({
        id: m.numero,
        date: m.date,
        label: `Mise en demeure n° ${m.numero}`,
        note: `Envoi : ${m.canal}${m.lot ? ` (${m.lot})` : ""}`,
        tone: "med" as const,
      })),
      ...j.evenements.map((e) => ({ id: e.id, date: e.date, label: e.label, note: e.note, tone: "event" as const })),
    ];
    return items.sort((a, b) => b.date.localeCompare(a.date));
  }, [j.mises, j.evenements]);

  const inProcedure = j.stade !== "aucune" && j.stade !== "cloture";

  return (
    <div className="space-y-5">
      {/* Current stage */}
      <div className="rounded-xl border-2 border-gray-200 bg-gray-50 p-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="text-[11px] uppercase text-gray-400">État juridique actuel</div>
            <div className="mt-1 flex items-center gap-2">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${info.badge}`}>{info.label}</span>
            </div>
            <p className="text-xs text-gray-500 mt-1.5">{info.description}</p>
          </div>
          <div className="text-right text-xs text-gray-500">
            <div>Mises en demeure envoyées</div>
            <div className="text-lg font-mono text-[#1C2235]">{j.mises.length}</div>
          </div>
        </div>

        <div className="mt-3">
          <div className="text-[11px] uppercase text-gray-400 mb-1.5">Faire avancer le dossier</div>
          <div className="flex flex-wrap gap-1.5">
            {STADES.map((s) => (
              <button
                key={s.id}
                onClick={() => changeStade(client.kind, client.id, s.id as StadeJuridique)}
                aria-pressed={s.id === j.stade}
                className={`px-2.5 py-1 rounded-lg text-xs border-2 transition-colors ${
                  s.id === j.stade
                    ? `${accent.bg} text-white border-transparent`
                    : `bg-white border-gray-200 text-gray-600 hover:border-gray-400`
                }`}
              >
                {s.court}
              </button>
            ))}
          </div>
        </div>

        {j.stade === "med_envoyee" && deadline && (
          <div
            className={`mt-3 rounded-lg px-3 py-2 text-sm border ${
              expired ? "bg-red-50 border-red-200 text-red-700" : "bg-amber-50 border-amber-200 text-amber-800"
            }`}
          >
            {expired ? (
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <span>
                  Le délai de {DELAI_MED_JOURS} jours a expiré le <b>{fmtDate(deadline)}</b> sans règlement complet.
                </span>
                <button
                  onClick={() => changeStade(client.kind, client.id, "contentieux")}
                  className="px-3 py-1 rounded-lg bg-red-600 text-white text-xs hover:bg-red-700 transition-colors"
                >
                  Passer au contentieux
                </button>
              </div>
            ) : (
              <>
                Délai de règlement en cours, jusqu'au <b>{fmtDate(deadline)}</b>.
              </>
            )}
          </div>
        )}
      </div>

      {/* Mises en demeure */}
      <div>
        <div className="mb-2 flex items-center gap-2">
          <div className={`w-1 h-4 rounded-full ${accent.bg}`} />
          <span className="text-sm text-[#1C2235]">Mises en demeure</span>
        </div>
        {j.mises.length === 0 ? (
          <p className="text-sm text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
            Aucune mise en demeure envoyée à ce client.
            {client.solde > 0
              ? " Il figurera dans la prochaine extraction mensuelle."
              : " Aucun montant n'est dû actuellement."}
          </p>
        ) : (
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-2 text-xs text-gray-500 font-medium">N°</th>
                  <th className="text-left px-4 py-2 text-xs text-gray-500 font-medium">Date d'envoi</th>
                  <th className="text-left px-4 py-2 text-xs text-gray-500 font-medium">Envoi</th>
                  <th className="text-left px-4 py-2 text-xs text-gray-500 font-medium">Lot</th>
                </tr>
              </thead>
              <tbody>
                {[...j.mises].reverse().map((m) => (
                  <tr key={m.numero} className="border-t border-gray-100">
                    <td className="px-4 py-2 font-mono">{m.numero}</td>
                    <td className="px-4 py-2 font-mono">{fmtDate(m.date)}</td>
                    <td className="px-4 py-2">{m.canal}</td>
                    <td className="px-4 py-2 font-mono text-xs text-gray-500">{m.lot ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Dossier contentieux */}
      <div>
        <div className="mb-2 flex items-center gap-2">
          <div className={`w-1 h-4 rounded-full ${accent.bg}`} />
          <span className="text-sm text-[#1C2235]">Dossier juridique</span>
          {!inProcedure && j.stade === "aucune" && (
            <span className="text-xs text-gray-400">(à renseigner une fois la procédure engagée)</span>
          )}
        </div>
        <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-[11px] text-gray-500">
              N° de dossier
              <input className={`${inputCls} font-mono mt-0.5 ${accent.focusBorder}`} value={draft.numDossier} onChange={(e) => setD("numDossier", e.target.value)} />
            </label>
            <label className="block text-[11px] text-gray-500">
              Tribunal
              <input className={`${inputCls} mt-0.5 ${accent.focusBorder}`} value={draft.tribunal} onChange={(e) => setD("tribunal", e.target.value)} placeholder="ex. Tribunal de Sidi M'hamed" />
            </label>
            <label className="block text-[11px] text-gray-500">
              Huissier de justice
              <input className={`${inputCls} mt-0.5 ${accent.focusBorder}`} value={draft.huissier} onChange={(e) => setD("huissier", e.target.value)} />
            </label>
            <label className="block text-[11px] text-gray-500">
              Avocat
              <input className={`${inputCls} mt-0.5 ${accent.focusBorder}`} value={draft.avocat} onChange={(e) => setD("avocat", e.target.value)} />
            </label>
            <label className="block text-[11px] text-gray-500">
              Prochaine audience
              <input type="date" className={`${inputCls} font-mono mt-0.5 ${accent.focusBorder}`} value={draft.dateAudience} onChange={(e) => setD("dateAudience", e.target.value)} />
            </label>
            <label className="block text-[11px] text-gray-500">
              Montant réclamé (DA)
              <input
                type="number"
                min={0}
                step="0.01"
                className={`${inputCls} font-mono mt-0.5 ${accent.focusBorder}`}
                value={draft.montantReclame || ""}
                placeholder={String(client.solde)}
                onChange={(e) => setD("montantReclame", Number(e.target.value) || 0)}
              />
            </label>
            <label className="block text-[11px] text-gray-500">
              Frais de justice (DA)
              <input
                type="number"
                min={0}
                step="0.01"
                className={`${inputCls} font-mono mt-0.5 ${accent.focusBorder}`}
                value={draft.fraisJustice || ""}
                onChange={(e) => setD("fraisJustice", Number(e.target.value) || 0)}
              />
            </label>
            <div className="text-[11px] text-gray-500">
              Solde dû actuellement
              <div className="mt-0.5 px-3 py-1.5 rounded-lg bg-white border-2 border-gray-200 text-sm font-mono text-[#1C2235]">
                {fmtDA(client.solde)}
              </div>
            </div>
          </div>
          <label className="block text-[11px] text-gray-500">
            Observations
            <textarea
              rows={2}
              className={`${inputCls} mt-0.5 resize-none ${accent.focusBorder}`}
              value={draft.observations}
              onChange={(e) => setD("observations", e.target.value)}
            />
          </label>
          <div className="flex items-center gap-3">
            <button
              onClick={saveDossier}
              disabled={!dossierDirty}
              className={`px-4 py-1.5 rounded-lg text-sm text-white transition-colors ${
                dossierDirty ? `${accent.bg} ${accent.hover}` : "bg-gray-300 cursor-not-allowed"
              }`}
            >
              Enregistrer le dossier
            </button>
            {saved && <span className="text-sm text-green-600">✓ Dossier enregistré.</span>}
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div>
        <div className="mb-2 flex items-center gap-2">
          <div className={`w-1 h-4 rounded-full ${accent.bg}`} />
          <span className="text-sm text-[#1C2235]">Historique juridique</span>
        </div>
        <div className="flex gap-2 mb-3">
          <input
            className={`${inputCls} ${accent.focusBorder}`}
            placeholder="Ajouter une note (ex. appel du client, courrier de l'avocat…)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && note.trim()) {
                addEvent(client.kind, client.id, note.trim());
                setNote("");
              }
            }}
          />
          <button
            onClick={() => {
              if (!note.trim()) return;
              addEvent(client.kind, client.id, note.trim());
              setNote("");
            }}
            disabled={!note.trim()}
            className={`px-4 py-1.5 rounded-lg text-sm whitespace-nowrap text-white transition-colors ${
              note.trim() ? `${accent.bg} ${accent.hover}` : "bg-gray-300 cursor-not-allowed"
            }`}
          >
            Ajouter
          </button>
        </div>
        {timeline.length === 0 ? (
          <p className="text-sm text-gray-400 italic">Aucun événement juridique enregistré.</p>
        ) : (
          <ol className="border-l-2 border-gray-200 ml-2 space-y-3">
            {timeline.map((t) => (
              <li key={t.id} className="pl-4 relative">
                <span
                  className={`absolute -left-[7px] top-1.5 w-3 h-3 rounded-full border-2 border-white ${
                    t.tone === "med" ? "bg-amber-500" : "bg-gray-400"
                  }`}
                />
                <div className="text-sm text-[#1C2235]">{t.label}</div>
                <div className="text-xs text-gray-500">
                  <span className="font-mono">{fmtDate(t.date)}</span>
                  {t.note ? ` — ${t.note}` : ""}
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
