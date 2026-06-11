import type { LiveDataSource, Match, TeamLineup, TeamSquad } from "../types";
import { storageService } from "./storageService";

export interface CachedLiveData {
  matches: Match[];
  squads: TeamSquad[];
  lineups: TeamLineup[];
  source: LiveDataSource;
  updatedAt: string;
}

const KEY = "live-data";

// In-Memory-Kopie, damit nicht bei jedem Render localStorage geparst wird.
let memoryCache: CachedLiveData | null | undefined;

export const liveDataService = {
  getCachedLiveData(): CachedLiveData | null {
    if (memoryCache === undefined) {
      memoryCache = storageService.get<CachedLiveData | null>(KEY, null);
    }
    return memoryCache;
  },
  saveLiveData(data: CachedLiveData): void {
    memoryCache = data;
    storageService.set(KEY, data);
    window.dispatchEvent(new CustomEvent("wm2026:live-data-updated", { detail: data }));
  },
  getSquad(teamId: string): TeamSquad | undefined {
    return this.getCachedLiveData()?.squads.find((squad) => squad.teamId === teamId);
  },
  getLineup(teamId: string): TeamLineup | undefined {
    return this.getCachedLiveData()?.lineups.find((lineup) => lineup.teamId === teamId);
  },
};
