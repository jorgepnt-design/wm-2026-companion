import { useLiveScores } from "../hooks/useLiveScores";

export function LiveDataAutoRefresh() {
  // 90 Sekunden: schnell genug fuer Live-Spielstaende, schonend fuer die FIFA-API.
  useLiveScores({ autoRefresh: true, intervalMs: 90 * 1000 });
  return null;
}
