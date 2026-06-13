import { ChevronDown, ChevronUp, Loader2, Users } from "lucide-react";
import { useState } from "react";
import { fifaApi, type MatchDetails, type TeamMatchLineup } from "../services/fifaApi";
import type { Match } from "../types";
import { CardBadge } from "./CardBadge";

interface Props {
  match: Match;
}

interface CacheEntry {
  details: MatchDetails;
  fetchedAt: number;
}

// Beendete Spiele aendern sich nicht mehr; Live-Spiele kurz cachen, damit Auf-/Zuklappen nicht neu laedt.
const detailsCache = new Map<string, CacheEntry>();
const LIVE_TTL_MS = 60 * 1000;

const hasLineup = (lineup?: TeamMatchLineup) => (lineup?.starters.length ?? 0) > 0;

function LineupColumn({ lineup }: { lineup: TeamMatchLineup }) {
  return (
    <div className="min-w-0">
      <p className="font-bold text-white/85">
        {lineup.teamName}
        {lineup.formation && <span className="ml-2 rounded bg-white/10 px-1.5 py-0.5 text-xs font-semibold text-white/60">{lineup.formation}</span>}
      </p>
      <ul className="mt-1.5 space-y-0.5 text-sm text-white/70">
        {lineup.starters.map((player) => (
          <li key={`${player.shirtNumber}-${player.name}`} className="flex items-center gap-1.5">
            <span className="inline-block w-6 shrink-0 text-right font-bold tabular-nums text-white/45">{player.shirtNumber}</span>
            <span className="truncate">{player.name}</span>
            {player.captain && <span className="text-xs font-bold text-gold">(C)</span>}
            <CardBadge card={player.card} className="ml-auto shrink-0" />
          </li>
        ))}
      </ul>
    </div>
  );
}

export function MatchDetailsPanel({ match }: Props) {
  const [open, setOpen] = useState(false);
  const [details, setDetails] = useState<MatchDetails | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!match.fifaMatchId || !match.fifaStageId) return null;
  const showGoals = match.status === "live" || match.status === "finished";
  const label = showGoals ? "Tore & Aufstellung" : "Aufstellung";

  const load = async () => {
    const cached = detailsCache.get(match.id);
    const maxAge = match.status === "finished" ? Number.POSITIVE_INFINITY : LIVE_TTL_MS;
    if (cached && Date.now() - cached.fetchedAt < maxAge) {
      setDetails(cached.details);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const fetched = await fifaApi.fetchMatchDetails(match.fifaStageId as string, match.fifaMatchId as string, match.status === "finished");
      detailsCache.set(match.id, { details: fetched, fetchedAt: Date.now() });
      setDetails(fetched);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Details konnten nicht geladen werden.");
    } finally {
      setIsLoading(false);
    }
  };

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && !details) void load();
  };

  return (
    <div className="mt-3 border-t border-white/10 pt-3">
      <button
        type="button"
        onClick={toggle}
        className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-bold text-white/60 transition hover:bg-white/10 hover:text-white"
        aria-expanded={open}
      >
        <Users size={15} aria-hidden /> {label}
        {open ? <ChevronUp size={15} aria-hidden /> : <ChevronDown size={15} aria-hidden />}
      </button>

      {open && (
        <div className="mt-2">
          {isLoading && (
            <p className="flex items-center gap-2 text-sm text-white/55">
              <Loader2 className="animate-spin" size={15} aria-hidden /> Details werden geladen …
            </p>
          )}
          {error && <p className="text-sm text-red-200">{error}</p>}
          {details && (
            <div className="space-y-3">
              {showGoals && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-white/45">Tore</p>
                  {details.goals.length > 0 ? (
                    <ul className="mt-1 space-y-0.5 text-sm text-white/80">
                      {details.goals.map((goal, index) => (
                        <li key={`${goal.minute}-${goal.playerName}-${index}`}>
                          <span className="inline-block w-12 font-bold tabular-nums text-gold">{goal.minute}</span>
                          ⚽ {goal.playerName}
                          {goal.teamCode && <span className="ml-1.5 text-xs font-bold text-white/45">{goal.teamCode}</span>}
                          {goal.isPenalty && <span className="ml-1.5 text-xs text-white/50">(Elfmeter)</span>}
                          {goal.isOwnGoal && <span className="ml-1.5 text-xs text-white/50">(Eigentor)</span>}
                          {goal.assistName && <span className="ml-1.5 text-xs text-white/45">Vorlage: {goal.assistName}</span>}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-1 text-sm text-white/55">Keine Tore{match.status === "live" ? " bisher" : ""}.</p>
                  )}
                </div>
              )}
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-white/45">Aufstellung</p>
                {hasLineup(details.home) || hasLineup(details.away) ? (
                  <div className="mt-1.5 grid gap-4 sm:grid-cols-2">
                    {details.home && hasLineup(details.home) && <LineupColumn lineup={details.home} />}
                    {details.away && hasLineup(details.away) && <LineupColumn lineup={details.away} />}
                  </div>
                ) : (
                  <p className="mt-1 text-sm text-white/55">Die Aufstellungen werden kurz vor Anstoß veröffentlicht.</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
