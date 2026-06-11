import { groups } from "../data/groups";
import type { Group, GroupId, Match, Standing } from "../types";
import { matchService } from "./matchService";
import { standingsService } from "./standingsService";

export const groupService = {
  getGroups(): Group[] {
    return groups;
  },
  getGroupById(groupId: GroupId): Group | undefined {
    return groups.find((group) => group.id === groupId);
  },
  getStandings(groupId: GroupId, matches: Match[] = matchService.getMatches()): Standing[] {
    return standingsService.getGroupStandings(matches, groupId);
  },
};
