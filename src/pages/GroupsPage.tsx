import { GroupTable } from "../components/GroupTable";
import { SectionHeader } from "../components/SectionHeader";
import type { Group, Match, Team } from "../types";

export function GroupsPage({ groups, teams, favoriteIds, matches }: { groups: Group[]; teams: Team[]; favoriteIds: string[]; matches: Match[] }) {
  return (
    <>
      <SectionHeader
        eyebrow="Gruppen"
        title="Tabellen aller 12 Gruppen"
        description="Punkte, Tore und Platzierungen werden automatisch aus den offiziellen Ergebnissen berechnet. Platz 1 und 2 qualifizieren sich direkt, Platz 3 kann als bester Dritter weiterkommen."
      />
      <GroupTable groups={groups} teams={teams} favoriteIds={favoriteIds} matches={matches} />
    </>
  );
}
