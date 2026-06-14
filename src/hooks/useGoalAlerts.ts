import { useCallback, useEffect, useState } from "react";
import { notify } from "../components/Toast";
import { pushService } from "../services/pushService";

// Steuert die Tor-Benachrichtigungen pro Spiel (Glocke).
export const useGoalAlerts = () => {
  const [selected, setSelected] = useState<string[]>(() => pushService.getSelectedMatchIds());
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);

  const supported = pushService.isSupported();
  const configured = pushService.isConfigured();

  useEffect(() => {
    void pushService.isEnabled().then(setEnabled);
  }, []);

  // Beim ersten Auswaehlen eines Spiels die Berechtigung/Push einrichten.
  const ensureEnabled = useCallback(async (): Promise<boolean> => {
    if (enabled) return true;
    try {
      setBusy(true);
      await pushService.enable();
      setEnabled(true);
      notify("Tor-Benachrichtigungen aktiviert ⚽🔔");
      return true;
    } catch (error) {
      notify(error instanceof Error ? error.message : "Benachrichtigungen konnten nicht aktiviert werden.");
      return false;
    } finally {
      setBusy(false);
    }
  }, [enabled]);

  const toggleMatch = useCallback(
    async (matchId: string) => {
      const willSelect = !pushService.isSelected(matchId);
      // Nur beim Aktivieren die Berechtigung erzwingen; Abwaehlen geht immer.
      if (willSelect) {
        const ok = await ensureEnabled();
        if (!ok) return;
      }
      const nowSelected = await pushService.toggleMatch(matchId);
      setSelected(pushService.getSelectedMatchIds());
      notify(nowSelected ? "Du wirst bei Toren in diesem Spiel benachrichtigt." : "Benachrichtigung für dieses Spiel deaktiviert.");
    },
    [ensureEnabled],
  );

  const disableAll = useCallback(async () => {
    setBusy(true);
    await pushService.disable();
    setEnabled(false);
    setBusy(false);
    notify("Push-Benachrichtigungen deaktiviert.");
  }, []);

  return {
    supported,
    configured,
    enabled,
    busy,
    selectedMatchIds: selected,
    isSelected: (matchId: string) => selected.includes(matchId),
    ensureEnabled,
    toggleMatch,
    disableAll,
  };
};
