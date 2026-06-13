import { useCallback, useEffect, useState } from "react";
import { fifaApi, type ScorerRow } from "../services/fifaApi";
import type { Match } from "../types";

// Aggregiert die Torschuetzen aus allen gespielten Spielen.
// Beendete Spiele liegen im Cache, daher laedt nur das erste Mal spuerbar.
export const useTopScorers = (matches: Match[]) => {
  const [scorers, setScorers] = useState<ScorerRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const playedMatches = matches.filter(
    (match) => (match.status === "finished" || match.status === "live") && match.fifaMatchId && match.fifaStageId,
  );
  // Stabiler Schluessel: nur neu laden, wenn sich gespielte Spiele oder deren Status aendern.
  const signature = playedMatches.map((match) => `${match.id}:${match.status}`).join(",");

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const rows = await fifaApi.fetchTopScorers(
        playedMatches.map((match) => ({
          stageId: match.fifaStageId as string,
          matchId: match.fifaMatchId as string,
          finished: match.status === "finished",
        })),
      );
      setScorers(rows);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Torschützenliste konnte nicht geladen werden.");
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  useEffect(() => {
    void load();
  }, [load]);

  return { scorers, isLoading, error, refresh: load, playedCount: playedMatches.length };
};
