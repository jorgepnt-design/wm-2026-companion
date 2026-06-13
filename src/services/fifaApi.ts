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
  IdAssistPlayer?: string | null;
  Minute?: string | null;
  Type?: number | null; // 2 = regulaeres Tor, 3 = Elfmeter, 4 = Eigentor
}

interface FifaBooking {
  IdPlayer?: string | null;
  Card?: number | null; // 1 = Gelb, 2 = Gelb-Rot (zweite Gelbe), 3 = Rot
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
  Bookings?: FifaBooking[];
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
  idPlayer: string;
  playerName: string;
  teamCode: string;
  isPenalty: boolean;
  isOwnGoal: boolean;
  idAssistPlayer?: string;
  assistName?: string;
}

export interface ScorerRow {
  rank: number;
  idPlayer: string;
  playerName: string;
  teamId?: string;
  teamCode: string;
  goals: number;
  penalties: number;
  assists: number;
}

// "none" wird nie gerendert; erleichtert aber Live-Daten spaeter.
export type CardType = "none" | "yellow" | "yellow-red" | "red";

export interface LineupPlayer {
  shirtNumber: number;
  name: string;
  captain: boolean;
  card: CardType;
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

// --- Statistik & Spielverlauf (Timeline) ---

export interface TeamMatchStat {
  shots: number;
  corners: number;
  fouls: number;
  offsides: number;
  saves: number;
  yellow: number;
  red: number;
  substitutions: number;
}

export type TimelineSide = "home" | "away" | "neutral";

export interface TimelineEntry {
  minute: string;
  sortValue: number;
  order: number;
  type: number;
  label: string;
  description: string;
  side: TimelineSide;
}

export interface MatchTimeline {
  home: TeamMatchStat;
  away: TeamMatchStat;
  // Echter Ballbesitz, falls die FIFA ihn liefert; sonst Naeherung aus Offensivaktionen.
  possessionHome: number;
  possessionAway: number;
  possessionIsReal: boolean;
  hasPossession: boolean;
  events: TimelineEntry[];
}

interface FifaTimelineEvent {
  IdTeam?: string | null;
  MatchMinute?: string | null;
  Type?: number | null;
  TypeLocalized?: FifaLocalized[];
  EventDescription?: FifaLocalized[];
}

interface FifaTimelineResponse {
  Event?: FifaTimelineEvent[];
}

// FIFA-Timeline-Event-Typen (verifiziert): 12 = Torchance/Schuss, 16 = Eckstoss,
// 18 = Foul, 15 = Abseits, 57 = Parade, 2 = Gelbe Karte, 5 = Auswechslung.
const TIMELINE_TYPE = { shot: 12, corner: 16, foul: 18, offside: 15, save: 57, yellow: 2, substitution: 5 } as const;
const emptyStat = (): TeamMatchStat => ({ shots: 0, corners: 0, fouls: 0, offsides: 0, saves: 0, yellow: 0, red: 0, substitutions: 0 });

const localized = (entries?: FifaLocalized[]) => entries?.[0]?.Description ?? "";

// "45'+2'" -> 45.2 fuer die Sortierung, Anzeige bleibt der Originalstring.
const goalSortValue = (minute: string) => {
  const parts = minute.match(/\d+/g) ?? [];
  return Number(parts[0] ?? 0) + Number(parts[1] ?? 0) / 10;
};

// Karten eines Spielers aus seinen Verwarnungen ableiten.
// Zwei Gelbe oder eine "Card 2" ergeben Gelb-Rot; "Card 3" ist die glatte Rote.
const cardForPlayer = (bookings: FifaBooking[]): CardType => {
  if (bookings.some((booking) => booking.Card === 3)) return "red";
  const yellows = bookings.filter((booking) => booking.Card === 1).length;
  if (bookings.some((booking) => booking.Card === 2) || yellows >= 2) return "yellow-red";
  if (yellows === 1) return "yellow";
  return "none";
};

const toLineupPlayer = (player: FifaPlayer, bookingsByPlayer: Map<string, FifaBooking[]>): LineupPlayer => ({
  shirtNumber: player.ShirtNumber ?? 0,
  name: localized(player.ShortName) || localized(player.PlayerName) || "Unbekannt",
  captain: player.Captain === true,
  card: cardForPlayer(bookingsByPlayer.get(player.IdPlayer ?? "") ?? []),
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
  const bookingsByPlayer = new Map<string, FifaBooking[]>();
  for (const booking of team.Bookings ?? []) {
    const id = booking.IdPlayer ?? "";
    bookingsByPlayer.set(id, [...(bookingsByPlayer.get(id) ?? []), booking]);
  }
  const byShirt = (a: LineupPlayer, b: LineupPlayer) => a.shirtNumber - b.shirtNumber;
  const build = (status: number) => players.filter((player) => player.Status === status).map((player) => toLineupPlayer(player, bookingsByPlayer)).sort(byShirt);
  return {
    teamCode: team.Abbreviation ?? "",
    teamName: localized(team.TeamName),
    formation: team.Tactics ?? null,
    starters: build(1),
    bench: build(2),
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

  async fetchMatchDetails(stageId: string, matchId: string, finished = false): Promise<MatchDetails> {
    // Beendete Spiele aendern sich nie -> dauerhaft in localStorage cachen
    // (auch von der Torschuetzenliste genutzt, damit nicht jedes Spiel doppelt geladen wird).
    // v2: Eigentor-/Elfmeter-Logik korrigiert -> alte Cache-Eintraege nicht mehr verwenden.
    const cacheKey = `fifa-details-v2-${matchId}`;
    if (finished) {
      const cached = storageService.get<MatchDetails | null>(cacheKey, null);
      if (cached) return cached;
    }

    const url = `https://api.fifa.com/api/v3/live/football/${COMPETITION_ID}/${SEASON_ID}/${stageId}/${matchId}?language=de`;
    const response = await fetch(url, { headers: { Accept: "application/json" }, cache: "no-store" });
    if (!response.ok) throw new Error(`Spieldetails konnten nicht geladen werden (HTTP ${response.status})`);
    const data = (await response.json()) as FifaLiveMatch;

    const home = data.HomeTeam;
    const away = data.AwayTeam;
    const allPlayers = [...(home?.Players ?? []), ...(away?.Players ?? [])];
    const playerName = (idPlayer: string | null | undefined) => {
      const player = allPlayers.find((item) => item.IdPlayer === idPlayer);
      return player ? localized(player.ShortName) || localized(player.PlayerName) : "Unbekannt";
    };

    // Massgeblich ist, in welchem Team-Array das Tor steht (so zaehlt die FIFA den Spielstand) –
    // das ist die beguenstigte Mannschaft. Eigentor robust erkennen: der Torschuetze steht im
    // gegnerischen Kader (FIFA-Tor-Typ 3 ist ebenfalls ein Eigentor). Eigentore werden in der
    // Torschuetzenliste ueber isOwnGoal ausgeschlossen.
    const idSet = (players: FifaPlayer[] | undefined) => new Set((players ?? []).map((player) => player.IdPlayer));
    const homeIds = idSet(home?.Players);
    const awayIds = idSet(away?.Players);
    const mapGoals = (goalList: FifaGoal[] | undefined, teamCode: string, ownIds: Set<string | null | undefined>, oppIds: Set<string | null | undefined>): GoalEvent[] =>
      (goalList ?? []).map((goal) => {
        const minute = goal.Minute ?? "";
        const isOwnGoal = goal.Type === 3 || (oppIds.has(goal.IdPlayer) && !ownIds.has(goal.IdPlayer));
        return {
          minute,
          sortMinute: goalSortValue(minute),
          idPlayer: goal.IdPlayer ?? "",
          playerName: playerName(goal.IdPlayer),
          teamCode,
          isPenalty: goal.Type === 4,
          isOwnGoal,
          idAssistPlayer: goal.IdAssistPlayer ?? undefined,
          assistName: goal.IdAssistPlayer ? playerName(goal.IdAssistPlayer) : undefined,
        };
      });

    const goals: GoalEvent[] = [
      ...mapGoals(home?.Goals, home?.Abbreviation ?? "", homeIds, awayIds),
      ...mapGoals(away?.Goals, away?.Abbreviation ?? "", awayIds, homeIds),
    ].sort((a, b) => a.sortMinute - b.sortMinute);

    const details: MatchDetails = { goals, home: toTeamLineup(home), away: toTeamLineup(away) };
    if (finished) storageService.set(cacheKey, details);
    return details;
  },

  async fetchMatchTimeline(stageId: string, matchId: string, homeFifaId: string, awayFifaId: string, finished = false): Promise<MatchTimeline> {
    const cacheKey = `fifa-timeline-v1-${matchId}`;
    if (finished) {
      const cached = storageService.get<MatchTimeline | null>(cacheKey, null);
      if (cached) return cached;
    }

    const url = `https://api.fifa.com/api/v3/timelines/${COMPETITION_ID}/${SEASON_ID}/${stageId}/${matchId}?language=de`;
    const response = await fetch(url, { headers: { Accept: "application/json" }, cache: "no-store" });
    if (!response.ok) throw new Error(`Spielverlauf konnte nicht geladen werden (HTTP ${response.status})`);
    const data = (await response.json()) as FifaTimelineResponse;
    const rawEvents = data.Event ?? [];

    const home = emptyStat();
    const away = emptyStat();
    const sideOf = (idTeam: string | null | undefined): TimelineSide =>
      idTeam === homeFifaId ? "home" : idTeam === awayFifaId ? "away" : "neutral";

    const events: TimelineEntry[] = rawEvents.map((event, index) => {
      const side = sideOf(event.IdTeam);
      const label = localized(event.TypeLocalized);
      const stat = side === "home" ? home : side === "away" ? away : null;
      if (stat) {
        if (event.Type === TIMELINE_TYPE.shot) stat.shots += 1;
        else if (event.Type === TIMELINE_TYPE.corner) stat.corners += 1;
        else if (event.Type === TIMELINE_TYPE.foul) stat.fouls += 1;
        else if (event.Type === TIMELINE_TYPE.offside) stat.offsides += 1;
        else if (event.Type === TIMELINE_TYPE.save) stat.saves += 1;
        else if (event.Type === TIMELINE_TYPE.yellow) stat.yellow += 1;
        else if (event.Type === TIMELINE_TYPE.substitution) stat.substitutions += 1;
        // Rote Karte: Code variiert, daher robust ueber das Label erkennen.
        else if (/rot/i.test(label) && /karte/i.test(label)) stat.red += 1;
      }
      const minute = event.MatchMinute ?? "";
      return {
        minute,
        sortValue: goalSortValue(minute),
        order: index,
        type: event.Type ?? -1,
        label,
        description: localized(event.EventDescription),
        side,
      };
    });

    // Ballbesitz: echte FIFA-Werte sind bei der WM 2026 (Stand jetzt) leer ->
    // Naeherung "Spielkontrolle" aus Offensivaktionen (Schuesse + Ecken).
    const homeActions = home.shots + home.corners;
    const awayActions = away.shots + away.corners;
    const totalActions = homeActions + awayActions;
    const hasPossession = totalActions > 0;
    const possessionHome = hasPossession ? Math.round((homeActions / totalActions) * 100) : 50;

    const timeline: MatchTimeline = {
      home,
      away,
      possessionHome,
      possessionAway: 100 - possessionHome,
      possessionIsReal: false,
      hasPossession,
      events,
    };
    if (finished) storageService.set(cacheKey, timeline);
    return timeline;
  },

  // Torschuetzenliste aus allen gespielten Spielen aggregieren.
  // Beendete Spiele liegen im localStorage-Cache, daher ist der zweite Aufruf praktisch sofort.
  async fetchTopScorers(matches: Array<{ stageId: string; matchId: string; finished: boolean }>): Promise<ScorerRow[]> {
    const teamIdByCode = new Map(teams.map((team) => [team.fifaCode, team.id]));
    const scorers = new Map<string, ScorerRow>();
    const ensure = (idPlayer: string, name: string, teamCode: string): ScorerRow => {
      const existing = scorers.get(idPlayer);
      if (existing) return existing;
      const created: ScorerRow = { rank: 0, idPlayer, playerName: name, teamCode, teamId: teamIdByCode.get(teamCode), goals: 0, penalties: 0, assists: 0 };
      scorers.set(idPlayer, created);
      return created;
    };

    // Begrenzte Parallelitaet, um die FIFA-API nicht zu ueberlasten.
    const queue = [...matches];
    const worker = async () => {
      while (queue.length > 0) {
        const next = queue.shift();
        if (!next) break;
        try {
          const details = await this.fetchMatchDetails(next.stageId, next.matchId, next.finished);
          for (const goal of details.goals) {
            if (goal.isOwnGoal || !goal.idPlayer) continue;
            const row = ensure(goal.idPlayer, goal.playerName, goal.teamCode);
            row.goals += 1;
            if (goal.isPenalty) row.penalties += 1;
            if (goal.idAssistPlayer) {
              const assister = ensure(goal.idAssistPlayer, goal.assistName ?? "Unbekannt", goal.teamCode);
              assister.assists += 1;
            }
          }
        } catch {
          // Einzelnes Spiel ueberspringen, Rest der Liste trotzdem auswerten.
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(5, matches.length) }, worker));

    return [...scorers.values()]
      .filter((row) => row.goals > 0)
      .sort((a, b) => b.goals - a.goals || b.penalties - a.penalties || b.assists - a.assists || a.playerName.localeCompare(b.playerName, "de"))
      .map((row, index) => ({ ...row, rank: index + 1 }));
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
