import { Crown, Loader2, RefreshCcw, Trophy } from "lucide-react";
import { EmptyState } from "../components/EmptyState";
import { FlagIcon } from "../components/FlagIcon";
import { SectionHeader } from "../components/SectionHeader";
import { useTopScorers } from "../hooks/useTopScorers";
import { teamService } from "../services/teamService";
import type { Match } from "../types";

interface Props {
  matches: Match[];
  favoriteIds: string[];
}

export function ScorersPage({ matches, favoriteIds }: Props) {
  const { scorers, isLoading, error, refresh, playedCount } = useTopScorers(matches);
  const leader = scorers[0];
  const leaderTeam = leader?.teamId ? teamService.getTeamById(leader.teamId) : undefined;

  return (
    <>
      <SectionHeader
        eyebrow="Torschützen"
        title="Wer trifft am häufigsten?"
        description="Automatisch aus den offiziellen FIFA-Ergebnissen berechnet – sortiert nach den meisten Toren. Der Führende ist auf Kurs zum Torschützenkönig (Goldener Schuh)."
      />

      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm text-white/55">{playedCount > 0 ? `Stand nach ${playedCount} ${playedCount === 1 ? "Spiel" : "Spielen"}` : "Noch keine Spiele gespielt"}</p>
        <button
          type="button"
          onClick={() => void refresh()}
          className="inline-flex items-center gap-2 rounded-md border border-white/15 bg-white/10 px-3 py-2 text-sm font-bold text-white transition hover:bg-white/15"
        >
          <RefreshCcw className={isLoading ? "animate-spin" : ""} size={16} aria-hidden /> Aktualisieren
        </button>
      </div>

      {error && <div className="mb-4 rounded-lg border border-ember/30 bg-ember/15 px-4 py-3 text-sm text-red-100">{error}</div>}

      {/* Hervorhebung des Führenden / Torschützenkönig-Kandidaten */}
      {leader && (
        <section className="relative mb-4 overflow-hidden rounded-lg border border-gold/40 bg-[linear-gradient(135deg,rgba(214,168,79,.22),rgba(255,255,255,.05))] p-5 shadow-glow">
          <div className="absolute -right-6 -top-8 h-32 w-32 rounded-full bg-gold/20 blur-3xl" />
          <div className="relative flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-gold/40 bg-night/60">
              <Crown className="text-gold" size={28} aria-hidden />
            </div>
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-gold">
                <Trophy size={14} aria-hidden /> Aktuell auf Kurs zum Torschützenkönig
              </p>
              <h2 className="mt-1 flex items-center gap-2 text-2xl font-black md:text-3xl">
                {leaderTeam && <FlagIcon team={leaderTeam} className="h-6 w-9" />}
                <span className="truncate">{leader.playerName}</span>
              </h2>
              <p className="mt-0.5 text-sm text-white/70">
                {leaderTeam?.name ?? leader.teamCode} · <span className="font-black text-gold">{leader.goals} {leader.goals === 1 ? "Tor" : "Tore"}</span>
                {leader.assists > 0 && ` · ${leader.assists} ${leader.assists === 1 ? "Vorlage" : "Vorlagen"}`}
              </p>
            </div>
          </div>
        </section>
      )}

      {isLoading && scorers.length === 0 ? (
        <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/7 p-6 text-white/65">
          <Loader2 className="animate-spin" size={18} aria-hidden /> Torschützen werden berechnet …
        </div>
      ) : scorers.length === 0 ? (
        <EmptyState title="Noch keine Tore">Sobald das erste Tor der WM fällt, erscheint hier die Torschützenliste.</EmptyState>
      ) : (
        <div className="overflow-hidden rounded-lg border border-white/10 bg-white/7">
          <table className="w-full text-sm">
            <thead className="bg-night/80 text-xs uppercase tracking-wide text-white/55">
              <tr>
                <th className="py-2.5 pl-4 text-left" aria-label="Rang">#</th>
                <th className="py-2.5 text-left">Spieler</th>
                <th className="hidden px-2 py-2.5 text-center sm:table-cell" title="Elfmetertore">11m</th>
                <th className="hidden px-2 py-2.5 text-center sm:table-cell" title="Vorlagen">Vorl.</th>
                <th className="py-2.5 pr-4 text-center">Tore</th>
              </tr>
            </thead>
            <tbody>
              {scorers.map((row) => {
                const team = row.teamId ? teamService.getTeamById(row.teamId) : undefined;
                const isFavorite = row.teamId ? favoriteIds.includes(row.teamId) : false;
                const isLeader = row.rank === 1;
                return (
                  <tr
                    key={row.idPlayer}
                    className={`border-t border-white/5 ${isLeader ? "bg-gold/15" : isFavorite ? "bg-gold/[0.07]" : ""}`}
                  >
                    <td className="py-2.5 pl-4 align-top">
                      <span className="inline-flex items-center gap-1.5 font-bold tabular-nums">
                        {isLeader && <Crown className="text-gold" size={14} aria-hidden />}
                        {row.rank}
                      </span>
                    </td>
                    <td className="max-w-0 py-2.5 pr-2">
                      <div className="flex items-center gap-2">
                        {team && <span className="shrink-0"><FlagIcon team={team} className="h-4 w-6" /></span>}
                        <div className="min-w-0">
                          <p className={`truncate font-bold ${isLeader ? "text-gold" : ""}`}>{row.playerName}</p>
                          <p className="truncate text-xs text-white/45">{team?.name ?? row.teamCode}</p>
                        </div>
                      </div>
                    </td>
                    <td className="hidden px-2 text-center align-middle tabular-nums text-white/55 sm:table-cell">{row.penalties || "–"}</td>
                    <td className="hidden px-2 text-center align-middle tabular-nums text-white/55 sm:table-cell">{row.assists || "–"}</td>
                    <td className="py-2.5 pr-4 text-center align-middle text-lg font-black tabular-nums">{row.goals}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-3 text-xs text-white/40">
        Hinweis: Eigentore zählen nicht für die Torschützenliste. Quelle: offizielle FIFA-Daten.
      </p>
    </>
  );
}
