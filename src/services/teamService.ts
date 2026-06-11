import { groups } from "../data/groups";
import { lineups, squads } from "../data/squads";
import { teams } from "../data/teams";
import type { Group, GroupId, Team, TeamLineup, TeamSquad } from "../types";
import { liveDataService } from "./liveDataService";
import { storageService } from "./storageService";

export const teamService = {
  getTeams(): Team[] {
    return teams;
  },
  getGroups(): Group[] {
    return groups;
  },
  getTeamsByGroup(groupId: GroupId): Team[] {
    return teams.filter((team) => team.group === groupId);
  },
  getTeamById(teamId: string): Team | undefined {
    return teams.find((team) => team.id === teamId);
  },
  getTeamName(teamId: string): string {
    return this.getTeamById(teamId)?.name ?? teamId;
  },
  getSquad(teamId: string): TeamSquad | undefined {
    // Bevorzugt den zwischengespeicherten offiziellen FIFA-Kader (siehe fifaApi.fetchTeamSquad).
    const officialSquad = storageService.get<TeamSquad | null>(`fifa-squad-${teamId}`, null);
    if (officialSquad && officialSquad.players.length > 0) return officialSquad;
    return liveDataService.getSquad(teamId) ?? squads.find((squad) => squad.teamId === teamId);
  },
  getLineup(teamId: string): TeamLineup | undefined {
    return liveDataService.getLineup(teamId) ?? lineups.find((lineup) => lineup.teamId === teamId);
  },
};
