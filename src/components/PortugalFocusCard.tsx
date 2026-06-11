import { CalendarDays, ListOrdered, ShieldCheck, Star, Timer } from "lucide-react";
import { useCountdown } from "../hooks/useCountdown";
import { matchService } from "../services/matchService";
import { standingsService } from "../services/standingsService";
import { teamService } from "../services/teamService";
import type { Match, Team, UserSettings } from "../types";
import { formatLocalDate, formatLocalTime } from "../utils/date";
import { CalendarExportButton } from "./CalendarExportButton";
import { FlagIcon } from "./FlagIcon";

interface Props {
  portugal: Team;
  allMatches: Match[];
  nextPortugalMatch?: Match;
  settings: UserSettings;
  onOpenTeams: () => void;
  onOpenSchedule: () => void;
}

const opponentOf = (match: Match, teamId: string) => (match.teamAId === teamId ? match.teamBId : match.teamAId);

const resultLetter = (match: Match, teamId: string): "S" | "U" | "N" => {
  const own = match.teamAId === teamId ? match.scoreA : match.scoreB;
  const other = match.teamAId === teamId ? match.scoreB : match.scoreA;
  if ((own ?? 0) > (other ?? 0)) return "S";
  if (own === other) return "U";
  return "N";
};

const resultStyle: Record<"S" | "U" | "N", string> = {
  S: "bg-pitch/20 text-pitch border-pitch/40",
  U: "bg-white/10 text-white/80 border-white/20",
  N: "bg-ember/20 text-red-200 border-ember/40",
};

function CompactCountdown({ dateUtc }: { dateUtc: string }) {
  const countdown = useCountdown(dateUtc);
  if (!countdown || countdown.isElapsed) return null;
  const text =
    countdown.days > 0
      ? `${countdown.days} Tg ${countdown.hours} Std`
      : countdown.hours > 0
        ? `${countdown.hours} Std ${countdown.minutes} Min`
        : `${countdown.minutes} Min ${countdown.seconds} Sek`;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-gold/40 bg-gold/10 px-2.5 py-1 text-sm font-bold text-gold">
      <Timer size={14} aria-hidden /> Anstoß in {text}
    </span>
  );
}

export function PortugalFocusCard({ portugal, allMatches, nextPortugalMatch, settings, onOpenTeams, onOpenSchedule }: Props) {
  const portugalMatches = allMatches
    .filter((match) => match.teamAId === portugal.id || match.teamBId === portugal.id)
    .sort((a, b) => new Date(a.dateUtc).getTime() - new Date(b.dateUtc).getTime());
  const liveMatch = portugalMatches.find((match) => match.status === "live");
  const finishedMatches = portugalMatches.filter((match) => match.status === "finished" && match.scoreA !== null).reverse();
  const groupStandings = standingsService.getGroupStandings(allMatches, portugal.group);
  const ownStanding = groupStandings.find((standing) => standing.teamId === portugal.id);
  const squad = teamService.getSquad(portugal.id);

  return (
    <section className="relative overflow-hidden rounded-lg border border-gold/30 bg-[linear-gradient(135deg,rgba(214,168,79,.18),rgba(255,255,255,.06))] p-4 shadow-glow md:p-5">
      <div className="absolute -right-8 -top-10 h-36 w-36 rounded-full bg-pitch/20 blur-3xl" />

      <div className="relative flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-gold">
            <Star size={16} fill="currentColor" aria-hidden /> Portugal im Fokus
          </p>
          <h2 className="mt-2 flex items-center gap-3 text-3xl font-black">
            <FlagIcon team={portugal} className="h-10 w-14" />
            {portugal.name}
          </h2>
          <p className="mt-1 text-sm text-white/70">
            {portugal.groupName}
            {ownStanding && ownStanding.played > 0 && (
              <> · Platz {ownStanding.rank} · {ownStanding.points} Punkte · {ownStanding.goalsFor}:{ownStanding.goalsAgainst} Tore</>
            )}
          </p>
        </div>
        {liveMatch ? (
          <span className="inline-flex items-center gap-1.5 rounded-md bg-ember px-3 py-1.5 text-sm font-black uppercase text-white">
            <span className="h-2 w-2 animate-pulse rounded-full bg-white" aria-hidden /> Portugal spielt jetzt
          </span>
        ) : (
          nextPortugalMatch && <CompactCountdown dateUtc={nextPortugalMatch.dateUtc} />
        )}
      </div>

      {liveMatch && (
        <div className="relative mt-4 rounded-lg border border-ember/50 bg-night/70 p-4">
          <p className="text-sm font-bold uppercase tracking-wide text-ember">
            Live{liveMatch.liveMinute != null ? ` · ${liveMatch.liveMinute}. Minute` : ""}
          </p>
          <p className="mt-2 text-2xl font-black tabular-nums">
            {matchService.getTeamLabel(liveMatch.teamAId)} {liveMatch.scoreA ?? 0} : {liveMatch.scoreB ?? 0} {matchService.getTeamLabel(liveMatch.teamBId)}
          </p>
        </div>
      )}

      <div className="relative mt-4 grid gap-3 lg:grid-cols-2">
        <article className="rounded-lg border border-white/10 bg-night/60 p-4">
          <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-white/55">
            <CalendarDays size={16} aria-hidden /> Nächstes Portugal-Spiel
          </p>
          {nextPortugalMatch ? (
            <>
              <p className="mt-2 text-xl font-black">
                {matchService.getTeamLabel(nextPortugalMatch.teamAId)} vs {matchService.getTeamLabel(nextPortugalMatch.teamBId)}
              </p>
              <p className="mt-1 text-sm text-white/65">
                {formatLocalDate(nextPortugalMatch.dateUtc, settings.timezone)} · {formatLocalTime(nextPortugalMatch.dateUtc, settings.timezone)}
              </p>
              <p className="text-sm text-white/65">{nextPortugalMatch.stadium}, {nextPortugalMatch.city}</p>
            </>
          ) : (
            <p className="mt-2 text-white/65">Aktuell ist kein weiteres Portugal-Spiel angesetzt.</p>
          )}

          <p className="mt-4 text-sm font-bold uppercase tracking-wide text-white/55">Bisherige Ergebnisse</p>
          {finishedMatches.length > 0 ? (
            <ul className="mt-2 space-y-1.5">
              {finishedMatches.map((match) => {
                const opponent = teamService.getTeamById(opponentOf(match, portugal.id));
                const letter = resultLetter(match, portugal.id);
                return (
                  <li key={match.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="inline-flex min-w-0 items-center gap-2">
                      <span className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border text-xs font-black ${resultStyle[letter]}`}>{letter}</span>
                      {opponent && <FlagIcon team={opponent} className="h-4 w-6" />}
                      <span className="truncate">gegen {opponent?.name ?? "Unbekannt"}</span>
                    </span>
                    <span className="font-black tabular-nums">
                      {match.teamAId === portugal.id ? `${match.scoreA}:${match.scoreB}` : `${match.scoreB}:${match.scoreA}`}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-white/55">Noch kein Spiel gespielt – das erste Ergebnis erscheint hier automatisch.</p>
          )}
        </article>

        <article className="rounded-lg border border-white/10 bg-night/60 p-4">
          <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-white/55">
            <ListOrdered size={16} aria-hidden /> Tabelle {portugal.groupName}
          </p>
          <table className="mt-2 w-full text-sm">
            <thead className="text-xs uppercase text-white/45">
              <tr>
                <th className="py-1 text-left" aria-label="Platz">#</th>
                <th className="py-1 text-left">Team</th>
                <th className="py-1 text-center">Sp</th>
                <th className="py-1 text-center">Tore</th>
                <th className="py-1 text-center">Pkt</th>
              </tr>
            </thead>
            <tbody>
              {groupStandings.map((row) => {
                const team = teamService.getTeamById(row.teamId);
                if (!team) return null;
                const isPortugal = team.id === portugal.id;
                return (
                  <tr key={team.id} className={`border-t border-white/5 ${isPortugal ? "bg-gold/15 font-black text-gold" : ""}`}>
                    <td className="py-1.5 tabular-nums">{row.rank}</td>
                    <td className="w-full max-w-0 truncate py-1.5 pr-1">
                      <span className="mr-1.5 inline-flex align-middle"><FlagIcon team={team} className="h-3.5 w-5" /></span>
                      <span className="sm:hidden">{team.fifaCode}</span>
                      <span className="hidden sm:inline">{team.name}</span>
                    </td>
                    <td className="py-1.5 text-center tabular-nums">{row.played}</td>
                    <td className="py-1.5 text-center tabular-nums">{row.goalsFor}:{row.goalsAgainst}</td>
                    <td className="py-1.5 text-center font-black tabular-nums">{row.points}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onOpenSchedule}
              className="inline-flex items-center justify-center gap-2 rounded-md border border-white/15 bg-white/10 px-3 py-2 text-sm font-bold text-white transition hover:bg-white/15"
            >
              <CalendarDays size={16} aria-hidden /> Alle Portugal-Spiele
            </button>
            <button
              type="button"
              onClick={onOpenTeams}
              className="inline-flex items-center justify-center gap-2 rounded-md border border-white/15 bg-white/10 px-3 py-2 text-sm font-bold text-white transition hover:bg-white/15"
            >
              <ShieldCheck size={16} aria-hidden /> Kader ansehen
            </button>
            <CalendarExportButton matches={portugalMatches} settings={settings} label="Spiele exportieren" filename="jorge-wm-2026-portugal.ics" />
          </div>
        </article>
      </div>

      <p className="relative mt-3 text-xs text-white/50">
        Automatisch als Favorit gesetzt · {portugalMatches.length} Spiele im Kalender · Kaderstatus: {squad?.status === "official" ? "offiziell" : "vorläufig"}
      </p>
    </section>
  );
}
