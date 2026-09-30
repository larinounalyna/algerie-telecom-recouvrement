import { useCallback, useEffect, useRef, useState } from "react";
import { errorMessage } from "../api";
import { countRappels, listRappelsActifs, marquerRappelLu, marquerTousRappelsLus, verifierRappels } from "../services";
import type { ApresGaiaRappel, RappelCount } from "../types";
import { useRealtime } from "./useRealtime";

const TOAST_MS = 12_000;
const POLL_MS = 5 * 60_000; // filet de sécurité si le WebSocket a été coupé un moment

export interface RappelsController {
  /** Rappels non résolus (nouveau + lu), le plus récent d'abord. */
  rappels: ApresGaiaRappel[];
  count: RappelCount;
  /** Notifications « pop-up » en cours d'affichage (rappels créés pendant que l'app est ouverte). */
  toasts: ApresGaiaRappel[];
  error: string | null;
  checking: boolean;
  dismissToast: (id: number) => void;
  markRead: (id: number) => Promise<void>;
  markAllRead: () => Promise<void>;
  /** Lance le contrôle côté serveur maintenant ; renvoie le nombre de nouveaux rappels. */
  checkNow: () => Promise<number>;
}

/**
 * Les rappels de versement (clients ENGAGÉS sans versement depuis un mois) :
 * chargés au démarrage, puis maintenus à jour par les événements WebSocket
 * `apres_gaia_rappel.*` (created → toast + pastille). Le backend garde les
 * rappels en base, donc un agent qui n'était pas connecté les retrouve ici.
 */
export function useRappels(): RappelsController {
  const [rappels, setRappels] = useState<ApresGaiaRappel[]>([]);
  const [count, setCount] = useState<RappelCount>({ non_lus: 0, actifs: 0 });
  const [toasts, setToasts] = useState<ApresGaiaRappel[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const refresh = useCallback(async () => {
    try {
      const [list, c] = await Promise.all([listRappelsActifs(), countRappels()]);
      setRappels(list);
      setCount(c);
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, []);

  const dismissToast = useCallback((id: number) => {
    const t = timers.current.get(id);
    if (t) clearTimeout(t);
    timers.current.delete(id);
    setToasts((prev) => prev.filter((r) => r.id !== id));
  }, []);

  useEffect(() => {
    void refresh();
    const poll = setInterval(() => void refresh(), POLL_MS);
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    const pending = timers.current;
    return () => {
      clearInterval(poll);
      window.removeEventListener("focus", onFocus);
      pending.forEach(clearTimeout);
      pending.clear();
    };
  }, [refresh]);

  useRealtime((msg) => {
    if (msg.event === "apres_gaia_rappel.created") {
      const r = msg.payload as unknown as ApresGaiaRappel;
      setToasts((prev) => [r, ...prev.filter((x) => x.id !== r.id)].slice(0, 4));
      const old = timers.current.get(r.id);
      if (old) clearTimeout(old);
      timers.current.set(r.id, setTimeout(() => dismissToast(r.id), TOAST_MS));
      void refresh();
    } else if (msg.event.startsWith("apres_gaia_rappel.")) {
      void refresh();
    }
  });

  const markRead = useCallback(
    async (id: number) => {
      try {
        await marquerRappelLu(id);
        await refresh();
      } catch (e) {
        setError(errorMessage(e));
      }
    },
    [refresh],
  );

  const markAllRead = useCallback(async () => {
    try {
      await marquerTousRappelsLus();
      await refresh();
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [refresh]);

  const checkNow = useCallback(async () => {
    setChecking(true);
    try {
      const res = await verifierRappels();
      await refresh();
      return res.crees.length;
    } catch (e) {
      setError(errorMessage(e));
      return 0;
    } finally {
      setChecking(false);
    }
  }, [refresh]);

  return { rappels, count, toasts, error, checking, dismissToast, markRead, markAllRead, checkNow };
}
