import { Bell, BellRing, Loader2 } from "lucide-react";
import { useGoalAlertsContext } from "../context/GoalAlertsContext";
import type { Match } from "../types";

// Glocke pro Spiel: Tor-Benachrichtigung an/aus. Nur fuer anstehende/laufende Spiele sinnvoll.
export function GoalAlertBell({ match }: { match: Match }) {
  const alerts = useGoalAlertsContext();
  if (!alerts.supported || match.status === "finished" || match.status === "postponed") return null;

  const active = alerts.isSelected(match.id);

  return (
    <button
      type="button"
      onClick={() => void alerts.toggleMatch(match.id)}
      disabled={alerts.busy}
      aria-pressed={active}
      title={active ? "Tor-Benachrichtigung aktiv – zum Deaktivieren tippen" : "Bei Toren in diesem Spiel benachrichtigen"}
      className={`inline-flex min-h-9 items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-bold transition ${
        active ? "border-gold bg-gold/15 text-gold" : "border-white/15 bg-white/5 text-white/60 hover:text-white"
      }`}
    >
      {alerts.busy ? <Loader2 className="animate-spin" size={15} aria-hidden /> : active ? <BellRing size={15} aria-hidden /> : <Bell size={15} aria-hidden />}
      <span>{active ? "Tor-Alarm an" : "Tor-Alarm"}</span>
    </button>
  );
}
