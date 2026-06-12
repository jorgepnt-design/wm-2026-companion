import { teams } from "../data/teams";
import type { Match, MatchStatus, Player, PlayerPosition, Team, TeamSquad } from "../types";
import { storageService } from "./storageService";

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
  IdMatch?: string | null;
  IdStage?: string | null;
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

// --- Spieldetails (Tore, Aufstellungen) ---

interface FifaLocalized {
  Locale?: string;
  Description?: string;
}

interface FifaGoal {
  IdPlayer?: string | null;
  IdTeam?: string | null;
  Minute?: string | null;
}

interface FifaPlayer {
  IdPlayer?: string | null;
  ShirtNumber?: number | null;
  Status?: number | null; // 1 = Startelf, 2 = Bank
  Captain?: boolean | null;
  ShortName?: FifaLocalized[];
  PlayerName?: FifaLocalized[];
}

interface FifaLiveTeam {
  IdTeam?: string | null;
  Abbreviation?: string | null;
  Tactics?: string | null;
  Goals?: FifaGoal[];
  Players?: FifaPlayer[];
  TeamName?: FifaLocalized[];
}

interface FifaLiveMatch {
  HomeTeam?: FifaLiveTeam | null;
  AwayTeam?: FifaLiveTeam | null;
}

export interface GoalEvent {
  minute: string;
  sortMinute: number;
  playerName: string;
  teamCode: string;
}

export interface LineupPlayer {
  shirtNumber: number;
  name: string;
  captain: boolean;
}

export interface TeamMatchLineup {
  teamCode: string;
  teamName: string;
  formation: string | null;
  starters: LineupPlayer[];
  bench: LineupPlayer[];
}

export interface MatchDetails {
  goals: GoalEvent[];
  home?: TeamMatchLineup;
  away?: TeamMatchLineup;
}

const localized = (entries?: FifaLocalized[]) => entries?.[0]?.Description ?? "";

// "45'+2'" -> 45.2 fuer die Sortierung, Anzeige bleibt der Originalstring.
const goalSortValue = (minute: string) => {
  const parts = minute.match(/\d+/g) ?? [];
  return Number(parts[0] ?? 0) + Number(parts[1] ?? 0) / 10;
};

const toLineupPlayer = (player: FifaPlayer): LineupPlayer => ({
  shirtNumber: player.ShirtNumber ?? 0,
  name: localized(player.ShortName) || localized(player.PlayerName) || "Unbekannt",
  captain: player.Captain === true,
});

// --- Offizielle Kader ---

interface FifaSquadPlayer {
  IdPlayer?: string | null;
  PlayerName?: FifaLocalized[];
  ShortName?: FifaLocalized[];
  JerseyNum?: number | null;
  Position?: number | null; // 0 = Tor, 1 = Abwehr, 2 = Mittelfeld, 3 = Sturm
  BirthDate?: string | null;
}

interface FifaSquadResponse {
  Players?: FifaSquadPlayer[];
}

const positionByCode: Record<number, PlayerPosition> = { 0: "GK", 1: "DEF", 2: "MID", 3: "FWD" };

// Kader aendern sich waehrend des Turniers praktisch nicht -> grosszuegig cachen.
const SQUAD_TTL_MS = 12 * 60 * 60 * 1000;

const ageFromBirthDate = (birthDate: string | null | undefined): number | undefined => {
  if (!birthDate) return undefined;
  const ms = Date.now() - new Date(birthDate).getTime();
  return Number.isFinite(ms) && ms > 0 ? Math.floor(ms / 31_557_600_000) : undefined;
};

const toTeamLineup = (team: FifaLiveTeam | null | undefined): TeamMatchLineup | undefined => {
  if (!team) return undefined;
  const players = team.Players ?? [];
  const byShirt = (a: LineupPlayer, b: LineupPlayer) => a.shirtNumber - b.shirtNumber;
  return {
    teamCode: team.Abbreviation ?? "",
    teamName: localized(team.TeamName),
    formation: team.Tactics ?? null,
    starters: players.filter((player) => player.Status === 1).map(toLineupPlayer).sort(byShirt),
    bench: players.filter((player) => player.Status === 2).map(toLineupPlayer).sort(byShirt),
  };
};

export const fifaApi = {
  async fetchMatchUpdates(): Promise<MatchUpdate[]> {
    // no-store: FIFA sendet max-age=300 – ohne das wuerde der Browser 5 Minuten lang
    // dieselbe Antwort liefern und Live-Spielstaende einfrieren.
    const response = await fetch(CALENDAR_URL, { headers: { Accept: "application/json" }, cache: "no-store" });
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
          fifaMatchId: item.IdMatch ?? null,
          fifaStageId: item.IdStage ?? null,
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

  async fetchMatchDetails(stageId: string, matchId: string): Promise<MatchDetails> {
    const url = `https://api.fifa.com/api/v3/live/football/${COMPETITION_ID}/${SEASON_ID}/${stageId}/${matchId}?language=de`;
    const response = await fetch(url, { headers: { Accept: "application/json" }, cache: "no-store" });
    if (!response.ok) throw new Error(`Spieldetails konnten nicht geladen werden (HTTP ${response.status})`);
    const data = (await response.json()) as FifaLiveMatch;

    const home = data.HomeTeam;
    const away = data.AwayTeam;
    // Eigentore werden dem gegnerischen Team gutgeschrieben -> Spielername in beiden Kadern suchen.
    const allPlayers = [...(home?.Players ?? []), ...(away?.Players ?? [])];
    const playerName = (idPlayer: string | null | undefined) => {
      const player = allPlayers.find((item) => item.IdPlayer === idPlayer);
      return player ? localized(player.ShortName) || localized(player.PlayerName) : "Unbekannt";
    };
    const teamCode = (idTeam: string | null | undefined) =>
      idTeam === home?.IdTeam ? home?.Abbreviation ?? "" : idTeam === away?.IdTeam ? away?.Abbreviation ?? "" : "";

    const goals: GoalEvent[] = [...(home?.Goals ?? []), ...(away?.Goals ?? [])]
      .map((goal) => {
        const minute = goal.Minute ?? "";
        return {
          minute,
          sortMinute: goalSortValue(minute),
          playerName: playerName(goal.IdPlayer),
          teamCode: teamCode(goal.IdTeam),
        };
      })
      .sort((a, b) => a.sortMinute - b.sortMinute);

    return { goals, home: toTeamLineup(home), away: toTeamLineup(away) };
  },

  async fetchTeamSquad(team: Team): Promise<TeamSquad> {
    const cacheKey = `fifa-squad-${team.id}`;
    const cached = storageService.get<TeamSquad | null>(cacheKey, null);
    if (cached && cached.players.length > 0 && Date.now() - new Date(cached.updatedAt).getTime() < SQUAD_TTL_MS) {
      return cached;
    }

    const url = `https://api.fifa.com/api/v3/teams/${team.fifaTeamId}/squad?idCompetition=${COMPETITION_ID}&idSeason=${SEASON_ID}&language=de`;
    const response = await fetch(url, { headers: { Accept: "application/json" }, cache: "no-store" });
    if (!response.ok) throw new Error(`Kader konnte nicht geladen werden (HTTP ${response.status})`);
    const data = (await response.json()) as FifaSquadResponse;

    const players: Player[] = (data.Players ?? [])
      .map((player) => ({
        id: player.IdPlayer ?? `${team.id}-${player.JerseyNum ?? 0}`,
        teamId: team.id,
        name: localized(player.PlayerName) || localized(player.ShortName) || "Unbekannt",
        shirtNumber: player.JerseyNum ?? 0,
        position: positionByCode[player.Position ?? -1] ?? "MID",
        age: ageFromBirthDate(player.BirthDate),
        status: "official" as const,
      }))
      .sort((a, b) => a.shirtNumber - b.shirtNumber);
    if (players.length === 0) throw new Error("Die FIFA hat fuer dieses Team noch keinen Kader veroeffentlicht.");

    const squad: TeamSquad = {
      teamId: team.id,
      updatedAt: new Date().toISOString(),
      status: "official",
      note: "Offizieller WM-2026-Kader (Quelle: FIFA).",
      players,
    };
    storageService.set(cacheKey, squad);
    return squad;
  },
};
