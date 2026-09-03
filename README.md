# BATTO MULTI-CHAT

Twitch · CNG · TikTok · YouTube · OBS

Eigenständige Electron-Anwendung mit sauber getrennten Plattform-, Auth-, Moderations-, OBS- und Overlay-Modulen. Das bekannte BATTO-MULTI-CHAT-Fenster bleibt die Hauptoberfläche.

## Bewusst nicht enthalten

- keine Hardware-/Sensorfunktionen
- kein Hardware-Monitoring
- keine Heart-Rate-/Watch-Integration
- kein Plugin-System
- kein Stream Deck / Touch Deck

## Fenster

- Standard: 560 × 760 px
- Minimum: 420 × 520 px
- bestehende BATTO-MULTI-CHAT-Optik bleibt die Basis
- Einstellungen über das Zahnrad

## Start ohne Installer

```bat
npm install
npm test
npm start
```

Nach Änderungen am `tiktok-live-connector` bei ungewöhnlichen Laufzeitfehlern einmal sauber neu installieren:

```bat
rmdir /s /q node_modules
npm install
npm test
npm start
```

## TikTok – zwei getrennte Verbindungen

### 1. Euler Stream API-Key

Der API-Key ist für den TikTok-LIVE-Reader / Sign-Server und den Euler-Gift-Katalog vorgesehen.

In der App:

`Einstellungen → Konten → TikTok → Euler Stream LIVE-Verbindung`

Der Key wird über Electron `safeStorage` verschlüsselt gespeichert und nicht wieder im Renderer angezeigt.

### 2. TikTok/Euler OAuth

OAuth ist für Creator-Funktionen wie Moderation, Chat senden und LIVE-Center-/Analytics-Funktionen vorgesehen. Die App speichert keine TikTok-Passwörter.

Aktuell angeforderte Scopes:

- `webcast:fetch`
- `webcast:chat`
- `webcast:mute`
- `webcast:ban`
- `webcast:comments`
- `webcast:moderators`
- `webcast:sensitive_words`
- `webcast:live_analytics`
- `webcast:user_earnings`
- `webcast:rankings`
- `user:info`

Wenn neue Scopes hinzukommen, muss TikTok einmal neu autorisiert werden.

## TikTok LIVE Funktionen

- Chat
- Gifts mit Gift-ID, Name, Bild, Diamanten und Combo
- Likes
- Joins / Viewer-Updates
- Follows
- Shares
- Subs
- Fragen / Poll Events
- Rankings
- Goals
- Stream-Ende
- LIVE Match / PK (`linkMicBattle`)
- PK-Punkte (`linkMicArmies`)
- weitere Link-Mic-/Battle-Ereignisse
- Mute / Unmute
- Ban / Unban
- Moderatoren verwalten
- Kommentare an/aus
- Sensitive Words
- Chat senden
- Gift-Katalog und Gift-Suche
- LIVE-Center-Daten, soweit vom angemeldeten Euler/TikTok-Konto freigegeben

## OBS

OBS WebSocket Standard:

```text
ws://127.0.0.1:4455
```

Unterstützt:

- sichere Passwortspeicherung
- Szenen laden und wechseln
- Szenenquellen laden
- Quellen ein-/ausblenden
- BATTO Browserquelle anlegen
- Multi-Gast-Zuordnung zu OBS-Quellen
- Hologramm-Browserquelle

## Stream Overlay

OBS Browserquelle:

```text
http://127.0.0.1:48621/overlay
```

Editor:

```text
http://127.0.0.1:48621/editor
```

Enthaltene Overlay-Typen:

- Chat
- Gift Feed
- Gift Alarm
- Like-Zähler
- Top-Gifter
- Follower-/frei konfigurierbares Ziel
- Stream-Timer
- Co-Host
- TikTok-Ereignisse / PK
- Schatztruhe
- Portal
- Glücksrad
- Umfrage
- Wortwolke
- Text / Bild / Logo

Gift-Events werden mit Bild, Name, Absender, Combo und Diamantwert an das OBS-Overlay weitergegeben. Größere Gifts erhalten einen stärkeren Gift-Alarm.

### Geschenk-Test

Unter `Einstellungen → Geschenke` stehen Tests für:

- Rosennebel
- Löwe
- TikTok Universe

Die App versucht zuerst, das Geschenk im aktuellen Euler-Katalog zu finden. Nur wenn dieser nicht erreichbar ist, werden fest eingebaute Test-Metadaten verwendet. Diese Fallback-Daten sind ausschließlich für den Overlay-Test gedacht.

## TikTok LIVE Center

Die App hat einen eigenen Bereich `TikTok LIVE Center` und kann zusätzlich das offizielle TikTok LIVE Center im Systembrowser öffnen.

Je nach OAuth-Berechtigungen werden Creator-/Room-Daten, Gift-Galerie, frühere LIVE-Räume und Earnings/Analytics geladen. Fehler einzelner optionaler Endpunkte legen dabei nicht das gesamte LIVE Center lahm.

## Hologramm

Lokale Browserquelle:

```text
http://127.0.0.1:17821/
```

Das Hologramm bleibt ein eigener Dienst und ist nicht mit dem großen Stream-Overlay vermischt.

## Projektstruktur

```text
src/
├── main.cjs
├── preload.cjs
├── runtime/
│   └── app-runtime.cjs
├── renderer/
│   ├── multi-chat.html
│   ├── multi-chat.css
│   ├── multi-chat.js
│   ├── hologram-controls.js
│   └── tiktok-live-tools.js
├── platforms/
│   ├── tiktok/
│   │   ├── tiktok-adapter.cjs
│   │   ├── euler-client.cjs
│   │   └── euler-oauth.cjs
│   ├── twitch/
│   ├── youtube/
│   └── cng/
├── services/
│   ├── chat-core.cjs
│   ├── platform-manager.cjs
│   ├── obs-websocket.cjs
│   ├── stream-overlay-server.cjs
│   └── hologram-server.cjs
├── storage/
│   ├── settings-store.cjs
│   └── secret-store.cjs
└── stream-overlay/
    ├── overlay.html
    ├── overlay.css
    ├── overlay.js
    ├── editor.html
    ├── editor.css
    └── editor.js
```

## Sicherheit

- Secrets nur im Electron Main Process
- Electron `safeStorage`
- keine Tokens in Logs
- keine TikTok-Passwörter
- Context Isolation aktiv
- Renderer erhält nur klar definierte IPC-Methoden

## Tests

```bat
npm test
```

Die Tests prüfen unter anderem Chat-Normalisierung, Gift-Normalisierung, PK-Daten, Overlay-Grundstruktur und dass keine Hardware-/Sensor-Elemente versehentlich wieder eingebaut werden.
