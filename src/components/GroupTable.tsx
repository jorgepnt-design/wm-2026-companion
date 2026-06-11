import { Star } from "lucide-react";
import { standingsService } from "../services/standingsService";
import type { Group, Match, Team } from "../types";
import { FlagIcon } from "./FlagIcon";

interface Props {
  groups: Group[];
  teams: Team[];
  favoriteIds: string[];
  matches: Match[];
}

// Platz 1+2 qualifizieren sich direkt, Platz 3 kann als bester Dritter weiterkommen.
const rankIndicator = (rank: number) => {
  if (rank <= 2) return "bg-pitch";
  if (rank === 3) return "bg-gold/70";
  return "bg-white/15";
};

export function GroupTable({ groups, teams, favoriteIds, matches }: Props) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {groups.map((group) => {
        const standings = standingsService.getGroupStandings(matches, group.id);
        return (
          <section key={group.id} className="overflow-hidden rounded-lg border border-white/10 bg-white/7">
            <h3 className="border-b border-white/10 px-4 py-3 text-xl font-black">{group.name}</h3>
            <table className="w-full text-sm">
              <thead className="bg-night/80 text-xs uppercase tracking-wide text-white/55">
                <tr>
                  <th className="py-2.5 pl-3 text-left" aria-label="Platz">#</th>
                  <th className="py-2.5 text-left">Team</th>
                  <th className="px-1.5 py-2.5 text-center">Sp</th>
                  <th className="hidden px-1.5 py-2.5 text-center sm:table-cell">S</th>
                  <th className="hidden px-1.5 py-2.5 text-center sm:table-cell">U</th>
                  <th className="hidden px-1.5 py-2.5 text-center sm:table-cell">N</th>
                  <th className="px-1.5 py-2.5 text-center">Tore</th>
                  <th className="px-1.5 py-2.5 text-center">Diff</th>
                  <th className="px-1.5 py-2.5 pr-3 text-center">Pkt</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((row) => {
                  const team = teams.find((item) => item.id === row.teamId);
                  if (!team) return null;
                  const favorite = favoriteIds.includes(team.id);
                  return (
                    <tr key={team.id} className={`border-t border-white/5 ${favorite ? "bg-gold/15 text-gold" : ""}`}>
                      <td className="py-2.5 pl-3">
                        <span className="inline-flex items-center gap-1.5">
                          <span className={`h-4 w-1 rounded-full ${rankIndicator(row.rank)}`} aria-hidden />
                          <span className="font-bold tabular-nums">{row.rank}</span>
                        </span>
                      </td>
                      <td className="w-full max-w-0 truncate py-2.5 pr-1 font-bold">
                        <span className="mr-2 inline-flex align-middle"><FlagIcon team={team} /></span>
                        <span className="sm:hidden">{team.fifaCode}</span>
                        <span className="hidden sm:inline">{team.name}</span>
                        {favorite && <Star className="ml-1.5 inline" size={14} fill="currentColor" aria-hidden />}
                      </td>
                      <td className="px-1.5 text-center tabular-nums">{row.played}</td>
                      <td className="hidden px-1.5 text-center tabular-nums sm:table-cell">{row.won}</td>
                      <td className="hidden px-1.5 text-center tabular-nums sm:table-cell">{row.drawn}</td>
                      <td className="hidden px-1.5 text-center tabular-nums sm:table-cell">{row.lost}</td>
                      <td className="px-1.5 text-center tabular-nums">{row.goalsFor}:{row.goalsAgainst}</td>
                      <td className="px-1.5 text-center tabular-nums">{row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}</td>
                      <td className="px-1.5 pr-3 text-center font-black tabular-nums">{row.points}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        );
      })}
    </div>
  );
}
