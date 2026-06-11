import { teams } from "../data/teams";
import type { Match, MatchStatus } from "../types";

// Offizielle, oeffentliche FIFA-API (kein API-Key noetig, CORS fuer Browser freigegeben).
// idCompetition 17 = FIFA World Cup, idSeason 285023 = WM 2026 (USA/Kanada/Mexiko).
const COMPETITION_ID = "17";
const SEASON_ID = "285023";
const CALENDAR_URL = `https://api.fifa.com/api/v3/calendar/matches?idCompetition=${COMPETITION_ID}&idSeason=${SEASON_ID}&language=de&count=200`;

interface FifaSide {
  Score?: number | null;
  Abbreviation?: string | null;
  IdCountry?: string | null;
}

interface FifaMatch {
  MatchNumber?: number | null;
  Date?: string | null;
  Home?: FifaSide | null;
  Away?: FifaSide | null;
  HomeTeamScore?: number | null;
  AwayTeamScore?: number | null;
  HomeTeamPenaltyScore?: number | null;
  AwayTeamPenaltyScore?: number | null;
  MatchStatus?: number | null;
  MatchTime?: string | null;
}

interface FifaCalendarResponse {
  Results?: FifaMatch[];
}

export type MatchUpdate = Partial<Match> & { id: string };

const teamIdByFifaCode = new Map(teams.map((team) => [team.fifaCode, team.id]));

// FIFA MatchStatus: 0 = beendet, 1 = angesetzt, 3 = live. Unbekannte Werte defensiv als "scheduled".
const mapStatus = (status: number | null | undefined): MatchStatus => {
  if (status === 0) return "finished";
  if (status === 3) return "live";
  if (status === 4 || status === 5) return "postponed";
  return "scheduled";
};

// MatchTime kommt als String wie "45'+2'" oder "98'".
const parseLiveMinute = (matchTime: string | null | undefined): number | null => {
  if (!matchTime) return null;
  const minute = Number.parseInt(matchTime, 10);
  return Number.isFinite(minute) ? minute : null;
};

const resolveTeamId = (side: FifaSide | null | undefined): string | undefined => {
  const code = side?.Abbreviation ?? side?.IdCountry;
  return code ? teamIdByFifaCode.get(code) : undefined;
};

export const fifaApi = {
  async fetchMatchUpdates(): Promise<MatchUpdate[]> {
    const response = await fetch(CALENDAR_URL, { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`FIFA-Datenabruf fehlgeschlagen (HTTP ${response.status})`);
    const data = (await response.json()) as FifaCalendarResponse;
    const results = data.Results ?? [];
    if (results.length === 0) throw new Error("FIFA-Datenabruf lieferte keine Spiele.");

    return results
      .filter((item): item is FifaMatch & { MatchNumber: number } => typeof item.MatchNumber === "number" && item.MatchNumber >= 1)
      .map((item) => {
        const status = mapStatus(item.MatchStatus);
        const update: MatchUpdate = {
          id: `match-${String(item.MatchNumber).padStart(3, "0")}`,
          status,
          scoreA: item.HomeTeamScore ?? item.Home?.Score ?? null,
          scoreB: item.AwayTeamScore ?? item.Away?.Score ?? null,
          penaltyA: item.HomeTeamPenaltyScore ?? null,
          penaltyB: item.AwayTeamPenaltyScore ?? null,
          liveMinute: status === "live" ? parseLiveMinute(item.MatchTime) : null,
        };
        if (item.Date) update.dateUtc = item.Date;
        // K.o.-Spiele: Teams werden ergaenzt, sobald die FIFA sie kennt (sonst bleiben Platzhalter).
        const teamAId = resolveTeamId(item.Home);
        const teamBId = resolveTeamId(item.Away);
        if (teamAId) update.teamAId = teamAId;
        if (teamBId) update.teamBId = teamBId;
        return update;
      });
  },
};
