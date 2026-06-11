import { CalendarExportButton } from "../components/CalendarExportButton";
import { CalendarExportPanel } from "../components/CalendarExportPanel";
import { LiveUpdateButton } from "../components/LiveUpdateButton";
import { MatchFilters } from "../components/MatchFilters";
import { MySchedule } from "../components/MySchedule";
import { SectionHeader } from "../components/SectionHeader";
import type { Group, Match, MatchFiltersState, Team, UserSettings } from "../types";

interface Props {
  groups: Group[];
  matches: Match[];
  allMatches: Match[];
  favoriteMatches: Match[];
  favoriteTeams: Team[];
  settings: UserSettings;
  filters: MatchFiltersState;
  setFilters: React.Dispatch<React.SetStateAction<MatchFiltersState>>;
}

export function SchedulePage({ groups, matches, allMatches, favoriteMatches, favoriteTeams, settings, filters, setFilters }: Props) {
  return (
    <>
      <SectionHeader eyebrow="Mein Spielplan" title="Alle Spiele, persönlich gefiltert" description="Favoriten werden hervorgehoben, Zeiten werden in deine lokale Zeitzone umgerechnet." />
      <div className="mb-4 flex flex-wrap gap-3">
        <CalendarExportButton matches={favoriteMatches} settings={settings} />
        <CalendarExportButton matches={allMatches} settings={settings} label="Alle Spiele exportieren" />
      </div>
      <div className="mb-4">
        <LiveUpdateButton />
      </div>
      <div className="mb-4">
        <CalendarExportPanel allMatches={allMatches} favoriteMatches={favoriteMatches} favoriteTeams={favoriteTeams} settings={settings} />
      </div>
      <MatchFilters groups={groups} filters={filters} setFilters={setFilters} />
      <MySchedule matches={matches} favoriteTeams={favoriteTeams} settings={settings} />
    </>
  );
}
