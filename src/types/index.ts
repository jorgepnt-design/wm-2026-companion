export type GroupId = "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "I" | "J" | "K" | "L";

export type Round =
  | "Gruppenphase"
  | "Sechzehntelfinale"
  | "Achtelfinale"
  | "Viertelfinale"
  | "Halbfinale"
  | "Spiel um Platz 3"
  | "Finale";

export type MatchStatus = "scheduled" | "live" | "finished" | "postponed";
export type LiveDataSource = "mock" | "fifa" | "api";
export type CalendarProvider = "google" | "apple" | "outlook" | "other";
export type ThemeMode = "dark" | "light" | "system";
export type PlayerPosition = "GK" | "DEF" | "MID" | "FWD";
export type OfficialDataStatus = "mock" | "provisional" | "official";

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  createdAt: string;
}

export interface UserSettings {
  userId: string;
  timezone: string;
  reminder24h: boolean;
  reminder1h: boolean;
  reminder15min: boolean;
  calendarProvider: CalendarProvider;
  theme: ThemeMode;
}

export interface NotificationSettings {
  userId: string;
  reminder24h: boolean;
  reminder1h: boolean;
  reminder15min: boolean;
  pushEnabled: boolean;
}

export interface Team {
  id: string;
  name: string;
  group: GroupId;
  groupName: string;
  flag: string;
  fifaCode: string;
}

export interface Player {
  id: string;
  teamId: string;
  name: string;
  shirtNumber: number;
  position: PlayerPosition;
  club?: string;
  age?: number;
  status: OfficialDataStatus;
}

export interface TeamSquad {
  teamId: string;
  updatedAt: string;
  status: OfficialDataStatus;
  note: string;
  players: Player[];
}

export interface TeamLineup {
  teamId: string;
  matchId?: string;
  formation: string | null;
  status: OfficialDataStatus;
  updatedAt: string;
  startingPlayerIds: string[];
  benchPlayerIds: string[];
  unavailablePlayerIds: string[];
  note: string;
}

export interface Group {
  id: GroupId;
  name: string;
  teams: string[];
}

export interface Stadium {
  id: string;
  name: string;
  city: string;
  country: "USA" | "Kanada" | "Mexiko";
}

export interface Match {
  id: string;
  round: Round;
  group?: GroupId;
  groupName?: string;
  dateUtc: string;
  teamAId: string;
  teamBId: string;
  stadium: string;
  city: string;
  country: string;
  status: MatchStatus;
  scoreA: number | null;
  scoreB: number | null;
  penaltyA?: number | null;
  penaltyB?: number | null;
  liveMinute?: number | null;
}

export interface EnrichedMatch extends Match {
  teamAName: string;
  teamBName: string;
  teamAFlag?: string;
  teamBFlag?: string;
}

export interface Favorite {
  id: string;
  userId: string;
  teamId: string;
  createdAt: string;
}

export interface Standing {
  teamId: string;
  group: GroupId;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}

export interface MatchFiltersState {
  round: Round | "Alle Spiele" | "Nur meine Teams";
  search: string;
  group: "" | GroupId;
  date: string;
  status: "" | MatchStatus;
}
