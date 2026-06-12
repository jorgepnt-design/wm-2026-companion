import { useLiveScores } from "../hooks/useLiveScores";

export function LiveDataAutoRefresh() {
  // 60 Sekunden: schnell genug fuer Live-Spielstaende, schonend fuer die FIFA-API.
  useLiveScores({ autoRefresh: true, intervalMs: 60 * 1000 });
  return null;
}
