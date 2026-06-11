import { matches as staticMatches } from "../data/matches";
import type { EnrichedMatch, Match, MatchFiltersState, Team } from "../types";
import { liveDataService } from "./liveDataService";
import { teamService } from "./teamService";

// K.o.-Platzhalter im offiziellen FIFA-Format: "1a" = Sieger Gruppe A, "2b" = Zweiter Gruppe B,
// "3abcdf" = Dritter aus den Gruppen A/B/C/D/F, "w73" = Sieger Spiel 73, "ru101" = Verlierer Spiel 101.
const placeholderLabel = (teamId: string): string => {
  if (teamId === "tbd") return "Noch offen";
  const groupRank = /^([123])([a-l]+)$/.exec(teamId);
  if (groupRank) {
    const rankWord = { "1": "Sieger", "2": "Zweiter", "3": "Dritter" }[groupRank[1]];
    const groupLetters = groupRank[2].toUpperCase().split("").join("/");
    return `${rankWord} Gruppe ${groupLetters}`;
  }
  const winner = /^w(\d+)$/.exec(teamId);
  if (winner) return `Sieger Spiel ${winner[1]}`;
  const loser = /^ru(\d+)$/.exec(teamId);
  if (loser) return `Verlierer Spiel ${loser[1]}`;
  return teamId.toUpperCase();
};

const teamLabel = (teamId: string) => teamService.getTeamById(teamId)?.name ?? placeholderLabel(teamId);
const teamFlag = (teamId: string) => teamService.getTeamById(teamId)?.flag;
const teamDisplayLabel = (teamId: string) => {
  const team = teamService.getTeamById(teamId);
  return team ? `${team.flag} ${team.name}` : placeholderLabel(teamId);
};
const favoriteIds = (favoriteTeams: Team[]) => new Set(favoriteTeams.map((team) => team.id));

const isFavoriteMatch = (match: Match, favoriteTeams: Team[]) => {
  const ids = favoriteIds(favoriteTeams);
  return ids.has(match.teamAId) || ids.has(match.teamBId);
};

const enrich = (match: Match): EnrichedMatch => ({
  ...match,
  teamAName: teamLabel(match.teamAId),
  teamBName: teamLabel(match.teamBId),
  teamAFlag: teamFlag(match.teamAId),
  teamBFlag: teamFlag(match.teamBId),
});

export const matchService = {
  // Statischer Spielplan + zwischengespeicherte Live-Updates (Ergebnisse, Status, K.o.-Teams).
  // Praesentationsfelder wie Stadion und Gruppe kommen immer aus den statischen Daten.
  getMatches(): Match[] {
    const cached = liveDataService.getCachedLiveData()?.matches;
    if (!cached?.length) return staticMatches;
    const byId = new Map(cached.map((match) => [match.id, match]));
    return staticMatches.map((match) => {
      const update = byId.get(match.id);
      if (!update) return match;
      return {
        ...match,
        teamAId: update.teamAId ?? match.teamAId,
        teamBId: update.teamBId ?? match.teamBId,
        dateUtc: update.dateUtc ?? match.dateUtc,
        status: update.status ?? match.status,
        scoreA: update.scoreA ?? null,
        scoreB: update.scoreB ?? null,
        penaltyA: update.penaltyA ?? null,
        penaltyB: update.penaltyB ?? null,
        liveMinute: update.liveMinute ?? null,
      };
    });
  },
  getEnrichedMatches(matches?: Match[]): EnrichedMatch[] {
    return (matches ?? this.getMatches()).map(enrich);
  },
  getFavoriteMatches(favoriteTeams: Team[]): Match[] {
    return this.getMatches().filter((match) => isFavoriteMatch(match, favoriteTeams));
  },
  getTeamMatches(teamId: string): Match[] {
    return this.getMatches().filter((match) => match.teamAId === teamId || match.teamBId === teamId);
  },
  getNextFavoriteMatch(favoriteTeams: Team[]): Match | undefined {
    const now = Date.now();
    return this.getFavoriteMatches(favoriteTeams)
      .filter((match) => new Date(match.dateUtc).getTime() >= now)
      .sort((a, b) => new Date(a.dateUtc).getTime() - new Date(b.dateUtc).getTime())[0];
  },
  filterMatches(filters: MatchFiltersState, favoriteTeams: Team[]): Match[] {
    return this.getMatches().filter((match) => {
      const favorite = isFavoriteMatch(match, favoriteTeams);
      const labels = `${teamLabel(match.teamAId)} ${teamLabel(match.teamBId)}`.toLowerCase();
      const byRound =
        filters.round === "Alle Spiele" ||
        (filters.round === "Nur meine Teams" ? favorite : match.round === filters.round);
      const bySearch = !filters.search || labels.includes(filters.search.trim().toLowerCase());
      const byGroup = !filters.group || match.group === filters.group;
      const byDate = !filters.date || match.dateUtc.slice(0, 10) === filters.date;
      const byStatus = !filters.status || match.status === filters.status;
      return byRound && bySearch && byGroup && byDate && byStatus;
    });
  },
  getTeamLabel: teamLabel,
  getTeamDisplayLabel: teamDisplayLabel,
  isFavoriteMatch,
  enrich,
};
