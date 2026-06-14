import { storageService } from "./storageService";

// Web-Push fuer Tor-Benachrichtigungen.
// - Frontend abonniert pro Spiel (Glocke).
// - Ein Cloudflare-Backend (push-backend/) ueberwacht die Spielstaende und sendet die Push,
//   sobald ein Tor faellt – auch wenn die App geschlossen ist (auf dem iPhone als Home-Screen-PWA).
//
// Konfiguration ueber .env:
//   VITE_PUSH_BACKEND_URL  – URL des Cloudflare-Workers
//   VITE_VAPID_PUBLIC_KEY  – oeffentlicher VAPID-Schluessel (base64url)

const BACKEND = (import.meta.env.VITE_PUSH_BACKEND_URL as string | undefined)?.replace(/\/$/, "");
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

const MATCHES_KEY = "goal-alert-matches";

const urlBase64ToUint8Array = (base64: string): BufferSource => {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalized);
  const buffer = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i += 1) view[i] = raw.charCodeAt(i);
  return view;
};

// Damit der Service Worker (statische Datei, kennt keine ENV) das Backend erreichen kann,
// legen wir die URL in einem Cache ab, den der SW beim Push-Event ausliest.
const writeBackendForServiceWorker = async () => {
  if (!BACKEND || !("caches" in window)) return;
  const cache = await caches.open("wm-push-config");
  await cache.put("/backend-url", new Response(BACKEND));
};

const getSelectedMatchIds = (): string[] => storageService.get<string[]>(MATCHES_KEY, []);
const setSelectedMatchIds = (ids: string[]) => storageService.set(MATCHES_KEY, ids);

const getSubscription = async (): Promise<PushSubscription | null> => {
  if (!("serviceWorker" in navigator)) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  return (await reg?.pushManager.getSubscription()) ?? null;
};

const syncMatchesToBackend = async () => {
  if (!BACKEND) return;
  const subscription = await getSubscription();
  if (!subscription) return;
  await fetch(`${BACKEND}/matches`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: subscription.endpoint, matchIds: getSelectedMatchIds() }),
  });
};

export const pushService = {
  isSupported(): boolean {
    return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  },
  isConfigured(): boolean {
    return Boolean(BACKEND && VAPID_PUBLIC_KEY);
  },
  permission(): NotificationPermission | "unsupported" {
    return "Notification" in window ? Notification.permission : "unsupported";
  },
  async isEnabled(): Promise<boolean> {
    return Boolean(this.isSupported() && Notification.permission === "granted" && (await getSubscription()));
  },
  getSelectedMatchIds,
  isSelected(matchId: string): boolean {
    return getSelectedMatchIds().includes(matchId);
  },

  // Berechtigung anfragen + Push abonnieren + Backend informieren.
  async enable(): Promise<void> {
    if (!this.isSupported()) throw new Error("Dein Gerät/Browser unterstützt keine Push-Benachrichtigungen.");
    if (!this.isConfigured()) {
      throw new Error("Das Push-Backend ist noch nicht eingerichtet (VITE_PUSH_BACKEND_URL / VITE_VAPID_PUBLIC_KEY) – siehe push-backend/README.md.");
    }
    const permission = await Notification.requestPermission();
    if (permission !== "granted") throw new Error("Benachrichtigungen wurden nicht erlaubt. Auf dem iPhone die App zuerst zum Home-Bildschirm hinzufügen.");

    const reg = await navigator.serviceWorker.ready;
    const subscription =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY as string),
      }));

    await writeBackendForServiceWorker();
    await fetch(`${BACKEND}/subscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscription }),
    });
    await syncMatchesToBackend();
  },

  async disable(): Promise<void> {
    const subscription = await getSubscription();
    if (subscription && BACKEND) {
      await fetch(`${BACKEND}/unsubscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      }).catch(() => undefined);
      await subscription.unsubscribe().catch(() => undefined);
    }
  },

  // Glocke pro Spiel umschalten. Gibt den neuen Zustand zurueck.
  async toggleMatch(matchId: string): Promise<boolean> {
    const current = getSelectedMatchIds();
    const selected = current.includes(matchId);
    const next = selected ? current.filter((id) => id !== matchId) : [...current, matchId];
    setSelectedMatchIds(next);
    await syncMatchesToBackend().catch(() => undefined);
    return !selected;
  },
};
