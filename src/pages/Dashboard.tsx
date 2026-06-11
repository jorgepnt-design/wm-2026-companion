import { CalendarDays, Radio, Shield, Sparkles, Sun } from "lucide-react";
import type { PageId } from "../components/Navigation";
import { CalendarExportButton } from "../components/CalendarExportButton";
import { CalendarExportPanel } from "../components/CalendarExportPanel";
import { EmptyState } from "../components/EmptyState";
import { FavoriteTeams } from "../components/FavoriteTeams";
import { LiveUpdateButton } from "../components/LiveUpdateButton";
import { MatchCard } from "../components/MatchCard";
import { PWAInstallPrompt } from "../components/PWAInstallPrompt";
import { PortugalFocusCard } from "../components/PortugalFocusCard";
import { StatsPanel } from "../components/StatsPanel";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import { teamService } from "../services/teamService";
import type { Match, Team, UserSettings } from "../types";
import { formatLocalDate } from "../utils/date";

interface Props {
  favoriteTeams: Team[];
  allMatches: Match[];
  favoriteMatches: Match[];
  nextFavoriteMatch?: Match;
  settings: UserSettings;
  onNavigate: (page: PageId) => void;
}

export function Dashboard({ favoriteTeams, allMatches, favoriteMatches, nextFavoriteMatch, settings, onNavigate }: Props) {
  const online = useOnlineStatus();
  const portugal = teamService.getTeamById("por");
  const favoriteIds = new Set(favoriteTeams.map((team) => team.id));
  const isFavorite = (match: Match) => favoriteIds.has(match.teamAId) || favoriteIds.has(match.teamBId);

  // Naechstes angesetztes Portugal-Spiel; ein laufendes Spiel zeigt die Fokus-Karte separat als Live-Banner.
  const nextPortugalMatch = allMatches
    .filter((match) => (match.teamAId === "por" || match.teamBId === "por") && match.status === "scheduled" && new Date(match.dateUtc).getTime() >= Date.now() - 3 * 60 * 60 * 1000)
    .sort((a, b) => new Date(a.dateUtc).getTime() - new Date(b.dateUtc).getTime())[0];

  const liveMatches = allMatches.filter((match) => match.status === "live");
  const todayKey = formatLocalDate(new Date().toISOString(), settings.timezone);
  const todayMatches = allMatches
    .filter((match) => formatLocalDate(match.dateUtc, settings.timezone) === todayKey)
    .sort((a, b) => new Date(a.dateUtc).getTime() - new Date(b.dateUtc).getTime());

  return (
    <div className="space-y-6">
      {!online && (
        <div className="rounded-lg border border-gold/30 bg-gold/10 px-4 py-3 text-sm font-semibold text-gold">
          Offline-Modus aktiv. Favoriten, Einstellungen und Spielplan bleiben lokal verfügbar – Ergebnisse aktualisieren sich, sobald du wieder online bist.
        </div>
      )}

      <section className="relative overflow-hidden rounded-lg border border-white/10 bg-[radial-gradient(circle_at_20%_0%,rgba(214,168,79,.24),transparent_28rem),linear-gradient(135deg,rgba(12,26,59,.95),rgba(3,9,24,.98))] p-5 shadow-2xl">
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="mb-2 inline-flex items-center gap-2 rounded-md border border-gold/30 bg-gold/10 px-3 py-1 text-sm font-bold text-gold">
              <Sparkles size={15} aria-hidden /> Jorge´s WM-Planer 2026
            </p>
            <h1 className="text-3xl font-black leading-tight md:text-4xl">WM 2026 · Spielplan, Live-Ergebnisse & Portugal</h1>
            <p className="mt-2 max-w-2xl text-sm text-white/70 md:text-base">
              {todayKey} · Ergebnisse kommen automatisch von der offiziellen FIFA-Quelle.
              {liveMatches.length > 0 ? ` Gerade ${liveMatches.length === 1 ? "läuft 1 Spiel" : `laufen ${liveMatches.length} Spiele`} live.` : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => onNavigate("teams")} className="inline-flex items-center gap-2 rounded-md bg-gold px-4 py-2.5 font-bold text-night">
              <Shield size={17} aria-hidden /> Teams
            </button>
            <button type="button" onClick={() => onNavigate("schedule")} className="inline-flex items-center gap-2 rounded-md border border-white/15 bg-white/10 px-4 py-2.5 font-bold text-white">
              <CalendarDays size={17} aria-hidden /> Spielplan
            </button>
            <CalendarExportButton matches={favoriteMatches} settings={settings} />
            <PWAInstallPrompt />
          </div>
        </div>
      </section>

      {portugal && (
        <PortugalFocusCard
          portugal={portugal}
          allMatches={allMatches}
          nextPortugalMatch={nextPortugalMatch}
          settings={settings}
          onOpenTeams={() => onNavigate("teams")}
          onOpenSchedule={() => onNavigate("schedule")}
        />
      )}

      {liveMatches.length > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-2xl font-black">
            <Radio className="text-ember" size={22} aria-hidden /> Live jetzt
          </h2>
          <div className="grid gap-4">
            {liveMatches.map((match) => (
              <MatchCard key={match.id} match={match} isFavorite={isFavorite(match)} timezone={settings.timezone} />
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 flex items-center gap-2 text-2xl font-black">
          <Sun className="text-gold" size={22} aria-hidden /> Heute
        </h2>
        {todayMatches.length > 0 ? (
          <div className="grid gap-4">
            {todayMatches.map((match) => (
              <MatchCard key={match.id} match={match} isFavorite={isFavorite(match)} timezone={settings.timezone} />
            ))}
          </div>
        ) : (
          <EmptyState title="Heute keine Spiele">Den vollständigen Spielplan findest du im Bereich „Spielplan“.</EmptyState>
        )}
      </section>

      <StatsPanel favoriteTeams={favoriteTeams} favoriteMatches={favoriteMatches} nextFavoriteMatch={nextFavoriteMatch} />

      <CalendarExportPanel allMatches={allMatches} favoriteMatches={favoriteMatches} favoriteTeams={favoriteTeams} settings={settings} />

      <section className="rounded-lg border border-white/10 bg-white/7 p-4">
        <h3 className="mb-3 text-xl font-black">Favoriten</h3>
        <FavoriteTeams teams={favoriteTeams} />
      </section>

      <LiveUpdateButton />
    </div>
  );
}
