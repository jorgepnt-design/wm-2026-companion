import { matches as staticMatches } from "../data/matches";
import { lineups, squads } from "../data/squads";
import type { LiveDataSource, Match, TeamLineup, TeamSquad } from "../types";
import { fifaApi, type MatchUpdate } from "./fifaApi";
import { liveDataService } from "./liveDataService";

export interface LiveDataResponse {
  matches: Match[];
  squads: TeamSquad[];
  lineups: TeamLineup[];
  source: LiveDataSource;
  updatedAt: string;
}

const apiBaseUrl = import.meta.env.VITE_FOOTBALL_API_BASE_URL as string | undefined;
const apiKey = import.meta.env.VITE_FOOTBALL_API_KEY as string | undefined;

// Statischer Spielplan bleibt die Basis (Stadien, Gruppen, Runden) –
// die API liefert nur Ergebnis-, Status- und Team-Updates dazu.
const mergeWithSchedule = (updates: MatchUpdate[]): Match[] => {
  const byId = new Map(updates.map((update) => [update.id, update]));
  return staticMatches.map((match) => {
    const update = byId.get(match.id);
    return update ? { ...match, ...update } : match;
  });
};

export const footballApi = {
  async fetchLiveData(): Promise<LiveDataResponse> {
    // 1) Eigene API, falls per .env konfiguriert (liefert fertiges LiveDataResponse-JSON).
    if (apiBaseUrl && apiKey) {
      try {
        const response = await fetch(apiBaseUrl, {
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        });
        if (!response.ok) throw new Error(`Live data request failed: ${response.status}`);
        const data = (await response.json()) as LiveDataResponse;
        const normalized = { ...data, source: "api" as const, updatedAt: data.updatedAt ?? new Date().toISOString() };
        liveDataService.saveLiveData(normalized);
        return normalized;
      } catch {
        // Eigene API nicht erreichbar -> auf die oeffentliche FIFA-Quelle ausweichen.
      }
    }

    // 2) Offizielle FIFA-API (Standardquelle, kein Key noetig). Wirft bei Fehler,
    //    damit die UI einen klaren Fehler zeigt; der zuletzt gespeicherte Stand bleibt erhalten.
    const updates = await fifaApi.fetchMatchUpdates();
    const liveData: LiveDataResponse = {
      matches: mergeWithSchedule(updates),
      squads,
      lineups,
      source: "fifa",
      updatedAt: new Date().toISOString(),
    };
    liveDataService.saveLiveData(liveData);
    return liveData;
  },
};
