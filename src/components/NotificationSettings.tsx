import { Bell, BellRing, Smartphone } from "lucide-react";
import { useGoalAlertsContext } from "../context/GoalAlertsContext";
import type { UserSettings } from "../types";

interface Props {
  settings: UserSettings;
  onChange: (settings: UserSettings) => void;
}

export function NotificationSettings({ settings, onChange }: Props) {
  const update = (key: keyof UserSettings, value: UserSettings[keyof UserSettings]) => onChange({ ...settings, [key]: value });
  const alerts = useGoalAlertsContext();
  const count = alerts.selectedMatchIds.length;

  return (
    <section className="space-y-4">
      {/* Tor-Push */}
      <div className="rounded-lg border border-gold/20 bg-gold/5 p-4">
        <h3 className="flex items-center gap-2 text-xl font-black">
          <BellRing className="text-gold" size={20} aria-hidden /> Tor-Benachrichtigungen
        </h3>
        <p className="mt-1 text-sm text-white/65">
          Wähle bei einem Spiel die <span className="font-bold text-gold">🔔 Glocke</span>, um bei jedem Tor eine Push-Benachrichtigung zu bekommen – auch wenn die App geschlossen ist.
        </p>

        {!alerts.supported ? (
          <p className="mt-3 rounded-md border border-white/10 bg-night/60 p-3 text-sm text-white/70">
            Dein Browser unterstützt keine Push-Benachrichtigungen.
          </p>
        ) : !alerts.configured ? (
          <p className="mt-3 rounded-md border border-white/10 bg-night/60 p-3 text-sm text-white/70">
            Das Push-Backend ist noch nicht eingerichtet. Anleitung: <code className="text-gold">push-backend/README.md</code>.
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-white/10 bg-night/60 p-3">
              <span className="text-sm">
                Status:{" "}
                <span className={alerts.enabled ? "font-bold text-pitch" : "font-bold text-white/70"}>
                  {alerts.enabled ? "aktiv" : "nicht aktiviert"}
                </span>
                {count > 0 && <span className="text-white/55"> · {count} {count === 1 ? "Spiel" : "Spiele"} ausgewählt</span>}
              </span>
              {alerts.enabled ? (
                <button type="button" onClick={() => void alerts.disableAll()} disabled={alerts.busy} className="rounded-md border border-white/15 bg-white/10 px-3 py-2 text-sm font-bold text-white">
                  Deaktivieren
                </button>
              ) : (
                <button type="button" onClick={() => void alerts.ensureEnabled()} disabled={alerts.busy} className="inline-flex items-center gap-2 rounded-md bg-gold px-3 py-2 text-sm font-bold text-night">
                  <Bell size={15} aria-hidden /> Aktivieren
                </button>
              )}
            </div>
            <p className="flex items-start gap-2 text-xs text-white/55">
              <Smartphone className="mt-0.5 shrink-0" size={14} aria-hidden />
              iPhone: Die App zuerst über „Teilen → Zum Home-Bildschirm“ installieren, danach öffnen und Benachrichtigungen erlauben. Nur so sind Push-Meldungen unter iOS möglich.
            </p>
          </div>
        )}
      </div>

      {/* Termin-Erinnerungen (Kalender) */}
      <div className="rounded-lg border border-white/10 bg-white/7 p-4">
        <h3 className="text-xl font-black">Termin-Erinnerungen</h3>
        <p className="mt-1 text-sm text-white/60">Für den Kalender-Export deiner Favoriten-Spiele.</p>
        <div className="mt-4 grid gap-3">
          {[
            ["reminder24h", "24 Stunden vorher"],
            ["reminder1h", "1 Stunde vorher"],
            ["reminder15min", "15 Minuten vorher"],
          ].map(([key, label]) => (
            <label key={key} className="flex items-center justify-between rounded-md bg-night/70 px-3 py-3">
              <span>{label}</span>
              <input
                type="checkbox"
                checked={Boolean(settings[key as keyof UserSettings])}
                onChange={(event) => update(key as keyof UserSettings, event.target.checked)}
                className="h-5 w-5 accent-gold"
              />
            </label>
          ))}
        </div>
      </div>
    </section>
  );
}
