import { teams } from "../data/teams";
import type { GroupId, Match, Standing } from "../types";
import { teamService } from "./teamService";

export interface RankedStanding extends Standing {
  rank: number;
}

const emptyStanding = (teamId: string, group: GroupId): Standing => ({
  teamId,
  group,
  played: 0,
  won: 0,
  drawn: 0,
  lost: 0,
  goalsFor: 0,
  goalsAgainst: 0,
  goalDifference: 0,
  points: 0,
});

// Gruppenspiele zaehlen, sobald ein Ergebnis existiert (live oder beendet).
const countsForTable = (match: Match) =>
  match.round === "Gruppenphase" && match.group && match.scoreA !== null && match.scoreB !== null && (match.status === "finished" || match.status === "live");

const applyResult = (row: Standing, goalsFor: number, goalsAgainst: number) => {
  row.played += 1;
  row.goalsFor += goalsFor;
  row.goalsAgainst += goalsAgainst;
  row.goalDifference = row.goalsFor - row.goalsAgainst;
  if (goalsFor > goalsAgainst) {
    row.won += 1;
    row.points += 3;
  } else if (goalsFor === goalsAgainst) {
    row.drawn += 1;
    row.points += 1;
  } else {
    row.lost += 1;
  }
};

// Vereinfachte FIFA-Sortierung: Punkte, Tordifferenz, erzielte Tore, dann Name.
// (Direkter Vergleich und Fairplay-Wertung sind ohne Detaildaten nicht abbildbar.)
const compareStandings = (a: Standing, b: Standing) =>
  b.points - a.points ||
  b.goalDifference - a.goalDifference ||
  b.goalsFor - a.goalsFor ||
  teamService.getTeamName(a.teamId).localeCompare(teamService.getTeamName(b.teamId), "de");

export const standingsService = {
  computeStandings(matches: Match[]): Standing[] {
    const table = new Map<string, Standing>(teams.map((team) => [team.id, emptyStanding(team.id, team.group)]));
    for (const match of matches) {
      if (!countsForTable(match)) continue;
      const home = table.get(match.teamAId);
      const away = table.get(match.teamBId);
      if (!home || !away) continue;
      applyResult(home, match.scoreA as number, match.scoreB as number);
      applyResult(away, match.scoreB as number, match.scoreA as number);
    }
    return [...table.values()];
  },
  getGroupStandings(matches: Match[], groupId: GroupId): RankedStanding[] {
    return this.computeStandings(matches)
      .filter((standing) => standing.group === groupId)
      .sort(compareStandings)
      .map((standing, index) => ({ ...standing, rank: index + 1 }));
  },
  getTeamStanding(matches: Match[], teamId: string): RankedStanding | undefined {
    const team = teams.find((item) => item.id === teamId);
    if (!team) return undefined;
    return this.getGroupStandings(matches, team.group).find((standing) => standing.teamId === teamId);
  },
};
