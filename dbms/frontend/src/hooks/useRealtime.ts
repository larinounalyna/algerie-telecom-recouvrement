import { useEffect, useRef } from "react";
import { subscribeRealtime, type RealtimeMessage } from "../api";

/** Calls `onMessage` for every push event sent by the backend while the component is mounted. */
export function useRealtime(onMessage: (msg: RealtimeMessage) => void) {
  const latest = useRef(onMessage);
  latest.current = onMessage;
  useEffect(() => subscribeRealtime((m) => latest.current(m)), []);
}
