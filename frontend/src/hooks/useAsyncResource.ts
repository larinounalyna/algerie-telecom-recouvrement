import { useCallback, useEffect, useRef, useState } from "react";
import { errorMessage } from "../api";

/**
 * Loads something through `loader` (must be memoised with useCallback) and
 * exposes { data, loading, error }. Pass `null` to stay idle. `reload()`
 * refreshes silently (no loading flash), stale responses are dropped.
 */
export function useAsyncResource<T>(loader: (() => Promise<T>) | null) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(loader !== null);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  const run = useCallback(
    async (silent: boolean) => {
      const id = ++seq.current;
      if (!loader) {
        setData(null);
        setError(null);
        setLoading(false);
        return;
      }
      if (!silent) setLoading(true);
      try {
        const result = await loader();
        if (id !== seq.current) return;
        setData(result);
        setError(null);
      } catch (e) {
        if (id === seq.current) setError(errorMessage(e));
      } finally {
        if (id === seq.current) setLoading(false);
      }
    },
    [loader],
  );

  useEffect(() => {
    void run(false);
    return () => {
      seq.current++;
    };
  }, [run]);

  const reload = useCallback(() => run(true), [run]);
  return { data, loading, error, reload };
}
