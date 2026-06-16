# Tor-Push-Backend (Cloudflare Worker)

Überwacht per Cron die FIFA-Spielstände und schickt eine **Web-Push-Benachrichtigung**, sobald
in einem von dir ausgewählten Spiel ein **Tor** fällt – auch wenn die App geschlossen ist.

Die App (Frontend) braucht dafür zwei `.env`-Werte: `VITE_PUSH_BACKEND_URL` (die Worker-URL) und
`VITE_VAPID_PUBLIC_KEY` (der öffentliche VAPID-Schlüssel von unten).

## Voraussetzungen auf dem iPhone
Web-Push funktioniert unter iOS **nur**, wenn die App über Safari **„Teilen → Zum Home-Bildschirm“**
installiert wurde. Danach die App öffnen und in den Einstellungen „Tor-Benachrichtigungen → Aktivieren“.

## Einrichtung (einmalig)

1. **VAPID-Schlüsselpaar erzeugen**
   ```bash
   npx web-push generate-vapid-keys
   ```
   Du bekommst `Public Key` und `Private Key` (beide base64url).

2. **Cloudflare-Konto** (kostenlos) + Wrangler
   ```bash
   cd push-backend
   npx wrangler login
   ```

3. **KV-Namespace anlegen** und die ausgegebene `id` in `wrangler.toml` eintragen
   ```bash
   npx wrangler kv namespace create PUSH
   ```

4. **Secrets setzen**
   ```bash
   npx wrangler secret put VAPID_PUBLIC_KEY     # Public Key aus Schritt 1
   npx wrangler secret put VAPID_PRIVATE_KEY    # Private Key aus Schritt 1
   npx wrangler secret put VAPID_SUBJECT        # z. B. mailto:jorgepnt@gmail.com
   ```

5. **Deployen**
   ```bash
   npx wrangler deploy
   ```
   Wrangler gibt eine URL aus, z. B. `https://wm-goal-push.dein-name.workers.dev`.

6. **Frontend verbinden** – in der `.env` der App (Projektwurzel):
   ```
   VITE_PUSH_BACKEND_URL=https://wm-goal-push.dein-name.workers.dev
   VITE_VAPID_PUBLIC_KEY=<derselbe Public Key aus Schritt 1>
   ```
   Dann die App neu bauen/deployen.

## Schnelltest
```
https://wm-goal-push.dein-name.workers.dev/status   ->  {"ok":true,...}
```
Danach: App als PWA installieren, Benachrichtigungen erlauben, bei einem **laufenden** Spiel die
Glocke aktivieren. Beim nächsten Tor (innerhalb ~1 Min) kommt die Push.

## Wie es funktioniert
- `POST /subscribe` – speichert deine Push-Subscription.
- `POST /matches` – speichert, welche Spiele du beobachtest.
- **Cron (jede Minute)** – holt die FIFA-Stände, vergleicht mit dem zuletzt gespeicherten Stand
  je beobachtetem Spiel; bei einem Tor wird eine Meldung in die Warteschlange gelegt und ein
  (payloadloser) Push gesendet, der den Service Worker weckt.
- `GET /pending` – der Service Worker holt die Meldungen ab und zeigt die Benachrichtigung.
- Beim ersten Sehen eines Spiels wird nur die Basislinie gesetzt (keine Falsch-Tore).

## Kosten / Limits
Der Worker vermeidet `KV.list()` im normalen Cron-Lauf. Abos werden zusätzlich in `sub:index`
gespeichert, damit der Minutentakt nicht das kostenlose Cloudflare-Workers-KV-List-Limit auslöst.
Es werden keine sensiblen Daten gespeichert (nur anonyme Push-Endpunkte).

Wenn alte Abos vor dieser Index-Version gespeichert wurden, müssen die Benachrichtigungen in der
App einmal deaktiviert und wieder aktiviert werden. Dadurch wird das Abo automatisch in den neuen
Index übernommen.

## Hinweis
Der Push-Versand (VAPID + Web-Push) ist sorgfältig implementiert, konnte hier aber nicht
end-to-end auf einem echten Gerät getestet werden. Bitte nach dem Deploy einmal mit einem
laufenden Spiel verifizieren. Bei Problemen: `npx wrangler tail` zeigt die Worker-Logs live.
