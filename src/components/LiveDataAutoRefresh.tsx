import { useLiveScores } from "../hooks/useLiveScores";

export function LiveDataAutoRefresh() {
  // 30 Sekunden: fluessiges Live-Erlebnis, weiterhin unkritisch fuer die FIFA-API.
  useLiveScores({ autoRefresh: true, intervalMs: 30 * 1000 });
  return null;
}
