import { Activity, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { useState } from "react";
import { fifaApi, type MatchTimeline, type TeamMatchStat, type TimelineEntry } from "../services/fifaApi";
import { teamService } from "../services/teamService";
import type { Match, Team } from "../types";
import { CardBadge } from "./CardBadge";
import { FlagIcon } from "./FlagIcon";

interface Props {
  match: Match;
}

// Beidseitiger Vergleichsbalken (Heim links, Gast rechts).
function StatBar({ label, home, away }: { label: string; home: number; away: number }) {
  const total = home + away;
  const homePct = total > 0 ? (home / total) * 100 : 50;
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="font-black tabular-nums">{home}</span>
        <span className="text-xs uppercase tracking-wide text-white/55">{label}</span>
        <span className="font-black tabular-nums">{away}</span>
      </div>
      <div className="mt-1 flex h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className="bg-gold" style={{ width: `${homePct}%` }} />
        <div className="bg-sky-400/80" style={{ width: `${100 - homePct}%` }} />
      </div>
    </div>
  );
}

function PossessionBar({ timeline, home, away }: { timeline: MatchTimeline; home?: Team; away?: Team }) {
  return (
    <div className="rounded-lg border border-white/10 bg-night/60 p-4">
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-white/55">{timeline.possessionIsReal ? "Ballbesitz" : "Spielkontrolle"}</p>
      <div className="flex items-center justify-between text-2xl font-black tabular-nums">
        <span className="text-gold">{timeline.possessionHome}%</span>
        <span className="text-sky-300">{timeline.possessionAway}%</span>
      </div>
      <div className="mt-2 flex h-2.5 overflow-hidden rounded-full bg-white/10">
        <div className="bg-gold" style={{ width: `${timeline.possessionHome}%` }} />
        <div className="bg-sky-400/80" style={{ width: `${timeline.possessionAway}%` }} />
      </div>
      <div className="mt-1.5 flex items-center justify-between text-xs text-white/55">
        <span className="inline-flex items-center gap-1.5">{home && <FlagIcon team={home} className="h-3.5 w-5" />} {home?.name ?? "Heim"}</span>
        <span className="inline-flex items-center gap-1.5">{away?.name ?? "Gast"} {away && <FlagIcon team={away} className="h-3.5 w-5" />}</span>
      </div>
      {!timeline.possessionIsReal && (
        <p className="mt-2 text-[11px] leading-snug text-white/40">Näherung aus Offensivaktionen (Schüsse + Ecken) – die FIFA liefert für dieses Spiel keinen echten Ballbesitz.</p>
      )}
    </div>
  );
}

function TickerRow({ event, home, away }: { event: TimelineEntry; home?: Team; away?: Team }) {
  const team = event.side === "home" ? home : event.side === "away" ? away : undefined;
  const isGoal = event.type === 0 || event.type === 34;
  const isCard = /karte/i.test(event.label);
  const cardType = isCard ? (/gelb.?rot/i.test(event.label) ? "yellow-red" : /rot/i.test(event.label) ? "red" : "yellow") : "none";
  return (
    <li className={`flex gap-3 rounded-md px-2 py-1.5 ${isGoal ? "bg-gold/12" : ""}`}>
      <span className="inline-block w-11 shrink-0 text-right text-sm font-bold tabular-nums text-gold">{event.minute}</span>
      <span className="mt-0.5 shrink-0">{team && <FlagIcon team={team} className="h-3.5 w-5" />}</span>
      <div className="min-w-0">
        <p className={`text-sm ${isGoal ? "font-black" : "font-semibold text-white/80"}`}>
          {isGoal ? "⚽ " : ""}
          {event.label}
          {isCard && <CardBadge card={cardType} className="ml-1.5" />}
        </p>
        {event.description && <p className="text-xs leading-snug text-white/55">{event.description}</p>}
      </div>
    </li>
  );
}

export function MatchStatsPanel({ match }: Props) {
  const [open, setOpen] = useState(false);
  const [timeline, setTimeline] = useState<MatchTimeline | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const home = teamService.getTeamById(match.teamAId);
  const away = teamService.getTeamById(match.teamBId);
  // Statistik gibt es nur fuer laufende/beendete Spiele mit echten (nicht Platzhalter-)Teams.
  const available = (match.status === "live" || match.status === "finished") && match.fifaMatchId && match.fifaStageId && home?.fifaTeamId && away?.fifaTeamId;
  if (!available) return null;

  const load = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await fifaApi.fetchMatchTimeline(
        match.fifaStageId as string,
        match.fifaMatchId as string,
        home.fifaTeamId,
        away.fifaTeamId,
        match.status === "finished",
      );
      setTimeline(result);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Statistik konnte nicht geladen werden.");
    } finally {
      setIsLoading(false);
    }
  };

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && !timeline) void load();
  };

  const statRows: Array<{ label: string; pick: (stat: TeamMatchStat) => number }> = [
    { label: "Torschüsse", pick: (s) => s.shots },
    { label: "Ecken", pick: (s) => s.corners },
    { label: "Fouls", pick: (s) => s.fouls },
    { label: "Abseits", pick: (s) => s.offsides },
    { label: "Paraden", pick: (s) => s.saves },
    { label: "Gelbe Karten", pick: (s) => s.yellow },
    { label: "Auswechslungen", pick: (s) => s.substitutions },
  ];

  return (
    <div className="mt-2 border-t border-white/10 pt-3">
      <button
        type="button"
        onClick={toggle}
        className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-bold text-white/60 transition hover:bg-white/10 hover:text-white"
        aria-expanded={open}
      >
        <Activity size={15} aria-hidden /> Statistik & Verlauf
        {open ? <ChevronUp size={15} aria-hidden /> : <ChevronDown size={15} aria-hidden />}
      </button>

      {open && (
        <div className="mt-2">
          {isLoading && (
            <p className="flex items-center gap-2 text-sm text-white/55">
              <Loader2 className="animate-spin" size={15} aria-hidden /> Statistik wird geladen …
            </p>
          )}
          {error && <p className="text-sm text-red-200">{error}</p>}
          {timeline && (
            <div className="space-y-4">
              <PossessionBar timeline={timeline} home={home} away={away} />

              <div className="space-y-2.5 rounded-lg border border-white/10 bg-night/60 p-4">
                {statRows.map((row) => (
                  <StatBar key={row.label} label={row.label} home={row.pick(timeline.home)} away={row.pick(timeline.away)} />
                ))}
              </div>

              <div>
                <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-white/45">Spielverlauf (neueste zuerst)</p>
                {timeline.events.length > 0 ? (
                  <ul className="space-y-0.5">
                    {[...timeline.events]
                      .sort((a, b) => b.sortValue - a.sortValue || b.order - a.order)
                      .map((event) => (
                        <TickerRow key={`${event.order}`} event={event} home={home} away={away} />
                      ))}
                  </ul>
                ) : (
                  <p className="text-sm text-white/55">Noch keine Ereignisse erfasst.</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
