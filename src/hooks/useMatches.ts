import { useEffect, useMemo, useState } from "react";
import { matchService } from "../services/matchService";
import type { MatchFiltersState, Team } from "../types";

const defaultFilters: MatchFiltersState = {
  round: "Alle Spiele",
  search: "",
  group: "",
  date: "",
  status: "",
};

export const useMatches = (favoriteTeams: Team[]) => {
  const [filters, setFilters] = useState<MatchFiltersState>(defaultFilters);
  // Render-Trigger: zaehlt hoch, sobald neue Live-Daten gespeichert wurden.
  const [dataVersion, setDataVersion] = useState(0);

  useEffect(() => {
    const bump = () => setDataVersion((version) => version + 1);
    window.addEventListener("wm2026:live-data-updated", bump);
    return () => window.removeEventListener("wm2026:live-data-updated", bump);
  }, []);

  const matches = useMemo(() => matchService.getMatches(), [dataVersion]);
  const filteredMatches = useMemo(
    () => matchService.filterMatches(filters, favoriteTeams),
    [filters, favoriteTeams, dataVersion],
  );
  const favoriteMatches = useMemo(() => matchService.getFavoriteMatches(favoriteTeams), [favoriteTeams, dataVersion]);
  const nextFavoriteMatch = useMemo(() => matchService.getNextFavoriteMatch(favoriteTeams), [favoriteTeams, dataVersion]);

  return {
    matches,
    filteredMatches,
    favoriteMatches,
    nextFavoriteMatch,
    filters,
    setFilters,
    isFavoriteMatch: (matchId: string) => {
      const match = matches.find((item) => item.id === matchId);
      return match ? matchService.isFavoriteMatch(match, favoriteTeams) : false;
    },
  };
};
