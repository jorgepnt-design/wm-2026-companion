import { AlertTriangle, CheckCircle2, Database, RefreshCcw, Wifi } from "lucide-react";
import { useLiveScores } from "../hooks/useLiveScores";

export function LiveUpdateButton() {
  const { lastUpdate, isUpdating, error, refreshLiveData } = useLiveScores();
  const sourceLabel = lastUpdate?.source === "fifa" ? "FIFA (offiziell)" : lastUpdate?.source === "api" ? "Eigene API" : "Demo-Daten";
  const lastChecked = lastUpdate ? new Date(lastUpdate.updatedAt).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" }) : "Noch nicht geprüft";

  return (
    <div className="rounded-lg border border-white/10 bg-white/7 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-gold">
            <Wifi size={16} aria-hidden /> Live-Datenstatus
          </p>
          <div className="mt-2 flex flex-wrap gap-2 text-sm">
            <span className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-night/70 px-3 py-2 text-white/70">
              <Database size={15} aria-hidden /> Quelle: {sourceLabel}
            </span>
            <span className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-night/70 px-3 py-2 text-white/70">
              <CheckCircle2 size={15} aria-hidden /> Letzte Aktualisierung: {lastChecked}
            </span>
            {error && (
              <span className="inline-flex items-center gap-2 rounded-md border border-ember/30 bg-ember/15 px-3 py-2 text-red-100">
                <AlertTriangle size={15} aria-hidden /> {error}
              </span>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={refreshLiveData}
          className="inline-flex items-center gap-2 rounded-md border border-gold/40 bg-gold/10 px-4 py-3 font-bold text-gold transition hover:-translate-y-0.5 hover:bg-gold/15 hover:shadow-glow"
        >
          <RefreshCcw className={isUpdating ? "animate-spin" : ""} size={18} aria-hidden />
          Live-Daten aktualisieren
        </button>
      </div>
      <p className="mt-3 text-xs text-white/50">Ergebnisse und Spielstände kommen von der offiziellen FIFA-Datenquelle und aktualisieren sich automatisch alle 90 Sekunden.</p>
    </div>
  );
}
