import { CalendarDays, Info, Loader2, Shirt, Star, Users, X } from "lucide-react";
import { useEffect, useState } from "react";
import { fifaApi } from "../services/fifaApi";
import { matchService } from "../services/matchService";
import { teamService } from "../services/teamService";
import type { Match, PlayerPosition, Team, TeamSquad } from "../types";
import { formatLocalDate, formatLocalTime } from "../utils/date";
import { DataStatusBadge } from "./DataStatusBadge";
import { FlagIcon } from "./FlagIcon";
import { MatchCard } from "./MatchCard";

interface Props {
  team: Team;
  matches: Match[];
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onClose: () => void;
}

const positionLabels: Record<PlayerPosition, string> = {
  GK: "Tor",
  DEF: "Abwehr",
  MID: "Mittelfeld",
  FWD: "Angriff",
};

const positions: PlayerPosition[] = ["GK", "DEF", "MID", "FWD"];

export function TeamSquadPanel({ team, matches, isFavorite, onToggleFavorite, onClose }: Props) {
  // Mock-Kader als Startwert/Fallback, der offizielle FIFA-Kader ersetzt ihn nach dem Laden.
  const [squad, setSquad] = useState<TeamSquad | undefined>(() => teamService.getSquad(team.id));
  const [squadLoading, setSquadLoading] = useState(false);
  const lineup = teamService.getLineup(team.id);
  const nextMatch = matches
    .filter((match) => new Date(match.dateUtc).getTime() >= Date.now())
    .sort((a, b) => new Date(a.dateUtc).getTime() - new Date(b.dateUtc).getTime())[0];

  useEffect(() => {
    let cancelled = false;
    setSquad(teamService.getSquad(team.id));
    setSquadLoading(true);
    fifaApi
      .fetchTeamSquad(team)
      .then((officialSquad) => {
        if (!cancelled) setSquad(officialSquad);
      })
      .catch(() => {
        // FIFA nicht erreichbar -> Mock-Kader bleibt sichtbar, Badge zeigt "Vorlaeufige Daten".
      })
      .finally(() => {
        if (!cancelled) setSquadLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [team]);

  return (
    <section className="rounded-lg border border-gold/30 bg-night/95 p-4 shadow-glow">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-4">
          <div className="rounded-lg border border-white/10 bg-white/10 p-3 shadow-glow">
            <FlagIcon team={team} className="h-16 w-24" />
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-gold">{team.groupName}</p>
            <h3 className="mt-1 text-3xl font-black">{team.name}</h3>
            <p className="mt-2 text-sm text-white/60">{squad?.note}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onToggleFavorite}
                className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-bold transition ${
                  isFavorite ? "bg-gold text-night shadow-glow" : "border border-white/15 bg-white/10 text-white hover:border-gold/40"
                }`}
              >
                <Star size={16} fill={isFavorite ? "currentColor" : "none"} aria-hidden />
                {isFavorite ? "Favorit" : "Als Favorit wählen"}
              </button>
              <DataStatusBadge status={squad?.status ?? "mock"} compact />
            </div>
          </div>
        </div>
        <button type="button" onClick={onClose} className="rounded-md border border-white/10 bg-white/10 p-2 text-white hover:bg-white/15" aria-label="Kader schließen">
          <X size={18} aria-hidden />
        </button>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="space-y-3">
          <div className="rounded-lg border border-white/10 bg-white/7 p-4">
            <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-gold">
              <Shirt size={16} aria-hidden /> Aufstellung
            </p>
            {lineup?.formation ? (
              <div className="mt-3">
                <p className="text-3xl font-black">{lineup.formation}</p>
                <p className="mt-2 text-sm text-white/60">Startelf und Bank sind für dieses Team hinterlegt.</p>
              </div>
            ) : (
              <div className="mt-3 rounded-md border border-white/10 bg-white/8 p-3">
                <p className="font-bold">Wird kurz vor Anstoß veröffentlicht</p>
                <p className="mt-1 text-sm text-white/60">
                  Die offizielle Startelf findest du bei jedem Spiel unten unter „Tore & Aufstellung“, sobald die FIFA sie freigibt (ca. 1 Stunde vor Anstoß).
                </p>
              </div>
            )}
            <div className="mt-3 flex items-start gap-2 rounded-md border border-gold/20 bg-gold/10 p-3 text-sm text-gold">
              <Info className="mt-0.5 shrink-0" size={16} aria-hidden />
              <p>
                Kader: {squad?.status === "official" ? "offiziell (FIFA)" : "vorläufig"}
                {squad?.updatedAt ? ` · Stand ${new Date(squad.updatedAt).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" })}` : ""}
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-white/10 bg-white/7 p-4">
            <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-gold">
              <CalendarDays size={16} aria-hidden /> Spiele
            </p>
            <p className="mt-2 text-sm text-white/60">{matches.length} Spiele mit {team.name} in den aktuellen Daten.</p>
            {nextMatch && (
              <p className="mt-2 text-sm font-bold text-white">
                Nächstes Spiel: {matchService.getTeamLabel(nextMatch.teamAId)} vs {matchService.getTeamLabel(nextMatch.teamBId)} · {formatLocalDate(nextMatch.dateUtc)} · {formatLocalTime(nextMatch.dateUtc)}
              </p>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-white/10 bg-white/7 p-4">
          <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-gold">
            <Users size={16} aria-hidden /> Kader
            {squadLoading && <Loader2 className="animate-spin text-white/50" size={15} aria-hidden />}
          </p>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {positions.map((position) => (
              <div key={position} className="rounded-md border border-white/10 bg-night/70 p-3">
                <p className="mb-2 text-sm font-bold text-white/70">{positionLabels[position]}</p>
                <div className="space-y-2">
                  {squad?.players
                    .filter((player) => player.position === position)
                    .map((player) => (
                      <div key={player.id} className="flex items-center justify-between gap-3 rounded-md bg-white/7 px-3 py-2 text-sm">
                        <span className="font-semibold">
                          <span className="mr-2 inline-block w-7 text-right tabular-nums text-gold">#{player.shirtNumber}</span>
                          {player.name}
                        </span>
                        <span className="shrink-0 text-xs text-white/45">{player.club ?? (player.age ? `${player.age} J.` : "")}</span>
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3">
        {matches.slice(0, 3).map((match) => (
          <MatchCard key={match.id} match={match} isFavorite={isFavorite} timezone={Intl.DateTimeFormat().resolvedOptions().timeZone} />
        ))}
      </div>
    </section>
  );
}
