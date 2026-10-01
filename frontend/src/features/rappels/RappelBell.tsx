import { useEffect, useRef, useState } from "react";
import { useRappels } from "../../hooks";
import { fmtDA, fmtDate } from "../../shared/lib/format";
import type { ApresGaiaRappel } from "../../types";
import ClientDetailHost from "../client-detail/ClientDetailHost";

const sourceLabel = (r: ApresGaiaRappel) => (r.reference_source === "engagement" ? "depuis l'engagement" : "depuis le dernier versement");

/**
 * Cloche de notifications — rappels de versement : un client ENGAGÉ n'a rien
 * versé depuis un mois. Flotte en haut à droite de toutes les pages ;
 * cliquer sur un rappel (ou son pop-up) ouvre la fiche du client.
 */
export default function RappelBell() {
  const { rappels, count, toasts, error, checking, dismissToast, markRead, markAllRead, checkNow } = useRappels();
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);

  // The list closes on Escape or on a click anywhere outside it.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onDown);
    };
  }, [open]);

  const openClient = (r: ApresGaiaRappel) => {
    dismissToast(r.id);
    if (r.statut === "nouveau") void markRead(r.id);
    setOpen(false);
    setDetail(String(r.n));
  };

  const runCheck = async () => {
    const created = await checkNow();
    setInfo(created > 0 ? `${created} nouveau(x) rappel(s).` : "Aucun nouveau rappel.");
    setTimeout(() => setInfo(null), 3000);
  };

  return (
    <>
      <div ref={box} className="no-print fixed top-3 right-4 z-40">
        <button
          onClick={() => setOpen((o) => !o)}
          aria-label={`Rappels de versement (${count.non_lus} non lu${count.non_lus > 1 ? "s" : ""})`}
          aria-expanded={open}
          className="relative w-11 h-11 rounded-full bg-white border-2 border-brand/30 shadow-md hover:bg-gray-50 flex items-center justify-center text-xl transition-colors"
        >
          🔔
          {count.non_lus > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[1.25rem] h-5 px-1 rounded-full bg-red-600 text-white text-[11px] flex items-center justify-center font-sans">
              {count.non_lus > 99 ? "99+" : count.non_lus}
            </span>
          )}
        </button>

        {open && (
          <div className="absolute right-0 mt-2 w-[26rem] max-w-[92vw] max-h-[70vh] flex flex-col bg-white rounded-xl border border-gray-200 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-gray-200 bg-gray-50">
              <div>
                <div className="text-sm text-[#1C2235]">Rappels de versement</div>
                <div className="text-[11px] text-gray-500">Clients engagés sans versement depuis un mois</div>
              </div>
              <button
                onClick={markAllRead}
                disabled={count.non_lus === 0}
                className="text-xs text-blue-700 hover:underline disabled:text-gray-300 disabled:no-underline whitespace-nowrap"
              >
                Tout marquer comme lu
              </button>
              <button onClick={() => setOpen(false)} aria-label="Fermer" className="w-7 h-7 rounded-full hover:bg-gray-200 text-gray-500 flex items-center justify-center">
                ✕
              </button>
            </div>

            <div className="overflow-auto flex-1 divide-y divide-gray-100">
              {rappels.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-gray-400 italic">Aucun rappel en cours.</p>
              ) : (
                rappels.map((r) => (
                  <button key={r.id} onClick={() => openClient(r)} className="w-full text-left px-4 py-3 hover:bg-amber-50 transition-colors">
                    <div className="flex items-center gap-2">
                      {r.statut === "nouveau" && <span className="w-2 h-2 rounded-full bg-red-600 flex-shrink-0" aria-label="Non lu" />}
                      <span className="text-sm text-[#1C2235]">Compte n° {r.n}</span>
                      <span className="ml-auto px-2 py-0.5 rounded-full text-[10px] bg-amber-100 text-amber-800 whitespace-nowrap">
                        {r.jours_ecoules} j{r.mois_impayes > 1 ? ` · ${r.mois_impayes} mois` : ""}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 mt-1 leading-snug">{r.message}</p>
                    <p className="text-[11px] text-gray-400 mt-1">
                      Sans versement {sourceLabel(r)} ({fmtDate(r.reference_date)})
                      {r.solde_du !== null && <> — solde dû <span className="font-mono">{fmtDA(r.solde_du)}</span></>}
                    </p>
                  </button>
                ))
              )}
            </div>

            <div className="flex items-center justify-between gap-2 px-4 py-2 border-t border-gray-200 bg-gray-50 text-xs">
              <span className={error ? "text-red-600" : "text-gray-500"}>{error ?? info ?? "Contrôle automatique chaque jour."}</span>
              <button onClick={runCheck} disabled={checking} className="text-blue-700 hover:underline disabled:opacity-60 whitespace-nowrap">
                {checking ? "Vérification…" : "Vérifier maintenant"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Pop-ups : un rappel vient d'être créé pendant que l'application est ouverte */}
      <div className="no-print fixed top-16 right-4 z-[70] w-80 max-w-[92vw] space-y-2">
        {toasts.map((r) => (
          <div key={r.id} role="status" className="bg-amber-50 border-2 border-amber-300 rounded-xl shadow-lg p-3">
            <div className="flex items-start gap-2">
              <span className="text-lg leading-none">🔔</span>
              <button onClick={() => openClient(r)} className="flex-1 text-left">
                <div className="text-sm text-amber-900">Rappel — compte n° {r.n}</div>
                <p className="text-xs text-amber-800 mt-0.5 leading-snug">{r.message}</p>
              </button>
              <button onClick={() => dismissToast(r.id)} aria-label="Fermer la notification" className="text-amber-700 hover:text-amber-900 leading-none">
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>

      {detail && <ClientDetailHost kind="apres" id={detail} initialTab="finance" onClose={() => setDetail(null)} />}
    </>
  );
}
