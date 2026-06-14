import { useState } from "react";
import { Layout } from "./components/Layout";
import { LiveDataAutoRefresh } from "./components/LiveDataAutoRefresh";
import type { PageId } from "./components/Navigation";
import { Toast } from "./components/Toast";
import { GoalAlertsProvider } from "./context/GoalAlertsContext";
import { useFavorites } from "./hooks/useFavorites";
import { useMatches } from "./hooks/useMatches";
import { useTeams } from "./hooks/useTeams";
import { useUserSettings } from "./hooks/useUserSettings";
import { Dashboard } from "./pages/Dashboard";
import { GroupsPage } from "./pages/GroupsPage";
import { ScorersPage } from "./pages/ScorersPage";
import { SchedulePage } from "./pages/SchedulePage";
import { SettingsPage } from "./pages/SettingsPage";
import { TeamsPage } from "./pages/TeamsPage";

export default function App() {
  const [page, setPage] = useState<PageId>("dashboard");
  const { teams, groups } = useTeams();
  const { favoriteTeams, favoriteIds, maxFavorites, toggleFavorite, resetFavorites } = useFavorites();
  const { settings, setSettings } = useUserSettings();
  const { matches, filteredMatches, favoriteMatches, nextFavoriteMatch, filters, setFilters } = useMatches(favoriteTeams);

  return (
    <GoalAlertsProvider>
      <Layout page={page} onNavigate={setPage}>
      <LiveDataAutoRefresh />
      {page === "dashboard" && (
        <Dashboard
          favoriteTeams={favoriteTeams}
          allMatches={matches}
          favoriteMatches={favoriteMatches}
          nextFavoriteMatch={nextFavoriteMatch}
          settings={settings}
          onNavigate={setPage}
        />
      )}
      {page === "teams" && (
        <TeamsPage
          groups={groups}
          matches={matches}
          teams={teams}
          favoriteTeams={favoriteTeams}
          favoriteIds={favoriteIds}
          maxFavorites={maxFavorites}
          onToggle={toggleFavorite}
          onReset={resetFavorites}
        />
      )}
      {page === "schedule" && (
        <SchedulePage
          groups={groups}
          matches={filteredMatches}
          allMatches={matches}
          favoriteMatches={favoriteMatches}
          favoriteTeams={favoriteTeams}
          settings={settings}
          filters={filters}
          setFilters={setFilters}
        />
      )}
      {page === "groups" && <GroupsPage groups={groups} teams={teams} favoriteIds={favoriteIds} matches={matches} />}
      {page === "scorers" && <ScorersPage matches={matches} favoriteIds={favoriteIds} />}
      {page === "settings" && <SettingsPage settings={settings} onChange={setSettings} calendarMatches={favoriteMatches} />}
      </Layout>
      <Toast />
    </GoalAlertsProvider>
  );
}
