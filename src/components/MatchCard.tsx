import { MapPin, Star } from "lucide-react";
import { FlagIcon } from "./FlagIcon";
import { MatchDetailsPanel } from "./MatchDetailsPanel";
import { matchService } from "../services/matchService";
import { teamService } from "../services/teamService";
import type { Match } from "../types";
import { formatLocalDate, formatLocalTime } from "../utils/date";

interface Props {
  match: Match;
  isFavorite: boolean;
  timezone: string;
  children?: React.ReactNode;
}

const hasScore = (match: Match) => match.scoreA !== null && match.scoreB !== null;

function StatusBadge({ match }: { match: Match }) {
  if (match.status === "live") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md bg-ember px-2.5 py-1 text-xs font-black uppercase text-white">
        <span className="h-2 w-2 animate-pulse rounded-full bg-white" aria-hidden />
        Live{match.liveMinute != null ? ` · ${match.liveMinute}'` : ""}
      </span>
    );
  }
  if (match.status === "finished") {
    return <span className="rounded-md bg-pitch/15 px-2.5 py-1 text-xs font-bold uppercase text-pitch">Beendet</span>;
  }
  if (match.status === "postponed") {
    return <span className="rounded-md bg-gold/15 px-2.5 py-1 text-xs font-bold uppercase text-gold">Verschoben</span>;
  }
  return <span className="rounded-md bg-white/10 px-2.5 py-1 text-xs font-bold uppercase text-white/70">Geplant</span>;
}

export function MatchCard({ match, isFavorite, timezone, children }: Props) {
  const enriched = matchService.enrich(match);
  const teamA = teamService.getTeamById(match.teamAId);
  const teamB = teamService.getTeamById(match.teamBId);
  const showScore = hasScore(match) && match.status !== "scheduled";
  const hadPenalties = match.penaltyA != null && match.penaltyB != null;

  return (
    <article
      className={`rounded-lg border p-4 transition duration-200 hover:-translate-y-0.5 ${
        match.status === "live"
          ? "border-ember/50 bg-ember/10"
          : isFavorite
            ? "border-gold bg-gold/12 shadow-glow"
            : "border-white/10 bg-white/7 hover:border-white/20"
      }`}
    >
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-gold">
            {match.round}
            {match.groupName ? ` · ${match.groupName}` : ""}
          </p>
          <p className="mt-1 text-sm text-white/65">
            {formatLocalDate(match.dateUtc, timezone)} · {formatLocalTime(match.dateUtc, timezone)}
          </p>
        </div>
        <StatusBadge match={match} />
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-3">
        <p className="inline-flex min-w-0 items-center gap-2 text-base font-black sm:text-lg">
          {teamA ? <FlagIcon team={teamA} /> : <span>{enriched.teamAFlag}</span>}
          <span className="truncate">{enriched.teamAName}</span>
        </p>
        <div className={`rounded-md px-3 py-2 text-center font-black tabular-nums ${match.status === "live" ? "bg-ember text-white" : "bg-night"}`}>
          {showScore ? (
            <>
              {match.scoreA} : {match.scoreB}
              {hadPenalties && <span className="block text-[11px] font-bold opacity-80">{match.penaltyA}:{match.penaltyB} i. E.</span>}
            </>
          ) : (
            <span className="text-white/50">vs</span>
          )}
        </div>
        <p className="inline-flex min-w-0 items-center justify-end gap-2 text-right text-base font-black sm:text-lg">
          {teamB ? <FlagIcon team={teamB} /> : <span>{enriched.teamBFlag}</span>}
          <span className="truncate">{enriched.teamBName}</span>
        </p>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm text-white/60">
        <span className="flex items-center gap-1">
          <MapPin size={16} aria-hidden /> {match.stadium}, {match.city}
        </span>
        {isFavorite && (
          <span className="flex items-center gap-1 text-gold">
            <Star size={16} fill="currentColor" aria-hidden /> Meine Teams
          </span>
        )}
      </div>
      <MatchDetailsPanel match={match} />
      {children && <div className="mt-4 border-t border-white/10 pt-4">{children}</div>}
    </article>
  );
}
