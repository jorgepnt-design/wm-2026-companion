# Jorge´s WM-Planer 2026

Moderne, responsive React-PWA für einen personalisierten Spielplan zur Fußball-WM 2026 mit echten Live-Ergebnissen. Ergebnisse, Spielstatus und Spielminute kommen von der offiziellen, öffentlichen FIFA-API (`api.fifa.com`) – ohne API-Key. Favoriten, Einstellungen und Kalenderexport funktionieren lokal und offline.

## Funktionen

- Auswahl von bis zu 8 Lieblingsmannschaften aus 48 Mock-Teams in 12 Gruppen
- Portugal ist automatisch als Favorit gesetzt
- Dashboard mit Portugal-Fokus, nächstem Portugal-Spiel, Kaderstatus und Kalender-CTA
- Kader- und Aufstellungsbereich pro Mannschaft mit Platz für offizielle Spieler, Formation, Startelf und Bank
- Team-Detailpanel mit großer Flagge, Gruppe, Spielen, Kader, Aufstellung und Favorit-Status
- Personalisierter Spielplan mit Favoriten-Hervorhebung und lokaler Zeitzone
- Filter nach Runde, Gruppe, Datum und Team-Suche
- Echte Ergebnisse und Live-Spielstände von der offiziellen FIFA-API (automatische Aktualisierung alle 90 Sekunden + manueller Refresh)
- Dashboard-Bereiche „Live jetzt“ und „Heute“ mit Status-Badges (Live mit Spielminute, Beendet, Geplant)
- Gruppentabellen werden automatisch aus den Ergebnissen berechnet (Punkte, Tore, Differenz, Platzierung)
- Live-Datenstatus mit letzter Aktualisierung, Quelle und Fehleranzeige
- Tor-Push-Benachrichtigungen pro Spiel (Glocke) – optional, via Cloudflare-Backend (`push-backend/`)
- Statistikbereich mit Favoriten, Lieblingsspielen und Gruppenspielen
- `.ics`-Export für Portugal, alle Favoriten oder alle Spiele
- PWA mit Manifest, Service Worker, Icons und Offline-Fallback
- Services und Typen für spätere Auth-, Cloud-, Live-API- und Push-Anbindung

## Installation

```bash
npm install
```

## Entwicklung starten

```bash
npm run dev
```

Die App ist danach lokal unter der von Vite ausgegebenen URL erreichbar, typischerweise `http://localhost:5173`.

## Build

```bash
npm run build
```

Optional kann der Produktionsbuild lokal getestet werden:

```bash
npm run preview
```

## Projektstruktur

```text
src/
  components/   Wiederverwendbare UI-Komponenten
  pages/        Hauptansichten der App
  hooks/        React-Hooks für App-Zustand und Service-Zugriff
  services/     Austauschbare Logikschicht für Storage, API, Kalender, Auth
  data/         Mock-Daten für Teams, Spiele, Tabellen und lokalen User
  types/        TypeScript-Datenmodelle für lokale und spätere Cloud-Daten
  utils/        Formatierung und kleine Hilfsfunktionen
  styles/       Tailwind-Einstieg
```

## Datenquellen

Die App trennt statische Turnierdaten von dynamischen Ergebnisdaten:

- **Statischer Spielplan** (`src/data/matches.ts`): aus dem offiziellen FIFA-Kalender generiert (Spielnummern, Stadien, Gruppen, Anstoßzeiten). Neu erzeugen mit `powershell -File scripts/generate-matches.ps1`. Dient gleichzeitig als Offline-Fallback.
- **Live-Ergebnisse** (`src/services/fifaApi.ts` + `footballApi.ts`): Ergebnisse, Spielstatus, Spielminute und K.-o.-Paarungen werden zur Laufzeit von `api.fifa.com` geladen, im `localStorage` gecacht und über `matchService` in den Spielplan gemerged.
- **Tabellen** (`src/services/standingsService.ts`): werden vollständig aus den Ergebnissen berechnet (Punkte, Tordifferenz, erzielte Tore; vereinfachte FIFA-Sortierung).
- **Kader/Aufstellungen** (`src/data/squads.ts`): weiterhin Platzhalter, bis eine offizielle Quelle angebunden ist.

Optional kann über `VITE_FOOTBALL_API_BASE_URL` und `VITE_FOOTBALL_API_KEY` eine eigene API vorgeschaltet werden; sie hat Vorrang vor der FIFA-Quelle und muss JSON im Format `LiveDataResponse` liefern. Die UI arbeitet ausschließlich gegen `teamService`, `groupService`, `matchService`, `standingsService` und `footballApi`.

## Spätere Supabase- oder Firebase-Anbindung

Die Datei `.env.example` enthält optionale Platzhalter:

```text
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FOOTBALL_API_BASE_URL=
VITE_FOOTBALL_API_KEY=
```

Vorgesehene Tabellen oder Collections:

- `users`
- `teams`
- `matches`
- `favorites`
- `groups`
- `standings`
- `notification_settings`

Empfohlene Integrationspunkte:

- `src/services/authService.ts` für Supabase Auth oder Firebase Authentication
- `src/services/storageService.ts` für Cloud-Speicherung statt `localStorage`
- `src/services/footballApi.ts` für Live-Ergebnisse und Tabellen
- `src/services/notificationService.ts` für Web Push oder Firebase Cloud Messaging
- `src/services/syncService.ts` für spätere Cloud- und Realtime-Synchronisierung

## Deployment

Das Projekt ist GitHub-kompatibel und kann auf GitHub Pages, Vercel, Netlify, Firebase Hosting oder Supabase Hosting deployt werden. Für Vercel und Netlify reicht typischerweise:

- Build command: `npm run build`
- Publish directory: `dist`

Die App verwendet keine geschützten FIFA-Logos oder offiziellen Markenassets. Das App-Icon liegt lokal unter `public/icons/`.
