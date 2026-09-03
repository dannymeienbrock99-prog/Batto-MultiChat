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
- Einstellungen über das Zahnrad

## Sauberer Start unter Windows

```bat
cd /d "%USERPROFILE%\Desktop\Batto-MultiChat"
git pull
rmdir /s /q node_modules
npm install
npm test
npm start
```

## TikTok / Euler Stream

TikTok verwendet zwei getrennte Anmeldungen.

### Euler Sign API-Key

Für LIVE-Reader, Signierung und Gift-Katalog:

`Einstellungen → Konten → TikTok → Euler Stream LIVE-Verbindung`

Der Key wird ausschließlich lokal über Electron `safeStorage` gespeichert. Mit **Account & Limits prüfen** werden `/accounts/me` und `/accounts/me/rate_limits` abgefragt, ohne den Key an den Renderer zurückzugeben.

### TikTok Creator OAuth

Für Chat senden, Moderation und creatorbezogene LIVE-Center-/Analytics-Funktionen muss im Euler Dashboard einmal ein OAuth Client erstellt werden.

Redirect URI:

```text
http://127.0.0.1:48731/oauth/tiktok/callback
```

Benötigt werden Euler OAuth Client ID und Client Secret. Die App speichert keine TikTok-Passwörter.

Scopes:

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

Wenn sich Scopes ändern, TikTok einmal neu autorisieren.

### TikTok LIVE Funktionen

- Chat
- Gifts mit Gift-ID, Name, Bild, Diamanten und Combo
- Likes, Joins/Viewer, Follows, Shares, Subs
- Fragen, Poll Events, Rankings und Goals
- Stream-Ende
- LIVE Match / PK und PK-Punkte
- Mute / Unmute
- Ban / Unban
- Moderatoren verwalten
- Kommentare an/aus
- Sensitive Words
- Chat senden
- Gift-Katalog und Gift-Suche
- LIVE-Center-Daten soweit vom Konto/Plan freigegeben

## Twitch

BATTO verwendet für die Windows-/Electron-App den Twitch Device-Code-Flow.

Einmalig:

1. Twitch Developer App erstellen.
2. Die **Client ID** in BATTO eintragen.
3. **Mit Twitch anmelden** drücken und die Freigabe im Browser bestätigen.
4. Danach den Twitch-Chat verbinden.

Für diesen Flow wird in BATTO kein Twitch Client Secret benötigt. Lesen und Senden im verbundenen Twitch-Chat werden unterstützt.

## YouTube

Einmalig in Google Cloud:

1. YouTube Data API v3 aktivieren.
2. OAuth Client vom Typ **Desktop-App** erstellen.
3. Client ID in BATTO eintragen; Client Secret ist optional.
4. **Mit YouTube anmelden** drücken.
5. Live-Video-ID eintragen und Live-Chat verbinden.

BATTO verwendet PKCE + Loopback-Callback und den Scope `youtube.force-ssl`, damit Live-Chat gelesen und gesendet werden kann. Nach einer Scope-Änderung einmal neu anmelden.

## CNG

CNG wird nur über die tatsächlich vorhandenen Browserquellen integriert; es wird kein nicht dokumentierter Realtime-WebSocket erfunden.

In BATTO werden lokal gespeichert:

- Creator-ID
- Alert-TTS an/aus
- Chat-TTS an/aus
- OBS-Chat-Token verschlüsselt via `safeStorage`

BATTO kann daraus **CNG Alerts** und **CNG Chat** direkt als OBS-Browserquellen in eine ausgewählte Szene einfügen. Der Chat-Token wird nie im Status oder Repo ausgegeben.

Solange CNG keinen bestätigten Realtime-Datenendpunkt bereitstellt, können einzelne CNG-Nachrichten nicht in den gemeinsamen BATTO-Chat eingelesen oder über BATTO gesendet werden. Die offizielle CNG-OBS-Chatansicht und Alerts funktionieren unabhängig davon als Browserquellen.

## OBS

OBS WebSocket Standard:

```text
ws://127.0.0.1:4455
```

Unterstützt:

- WebSocket-5-Authentifizierung
- sichere Passwortspeicherung
- Szenen laden und wechseln
- Szenenquellen laden
- Quellen ein-/ausblenden
- BATTO Browserquelle anlegen
- Multi-Gast-Zuordnung zu OBS-Quellen
- Hologramm-Browserquelle
- CNG Alert-/Chat-Browserquellen

## Stream Overlay

OBS Browserquelle:

```text
http://127.0.0.1:48621/overlay
```

Editor:

```text
http://127.0.0.1:48621/editor
```

Enthalten:

- Chat
- Gift Feed / Gift Alarm
- Like-Zähler
- Top-Gifter
- Ziel
- Stream-Timer
- Co-Host
- TikTok-Ereignisse / PK
- Schatztruhe / Portal
- Glücksrad / Umfrage / Wortwolke
- Text / Bild / Logo

Gift-Events transportieren Bild, Name, Absender, Combo und Diamantwert. Für OBS stehen Tests für Rosennebel, Löwe und TikTok Universe bereit. Die App versucht zuerst den aktuellen Euler-Katalog; fest eingebaute Werte sind nur Overlay-Test-Fallbacks.

## TikTok LIVE Center

BATTO besitzt einen eigenen LIVE-Center-Bereich und kann zusätzlich das offizielle TikTok LIVE Center öffnen. Creator-/Room-Daten, Gift-Galerie, frühere LIVE-Räume und Earnings/Analytics werden nur angezeigt, wenn OAuth-Scope und Euler-Plan den jeweiligen Endpunkt freigeben.

## Hologramm

```text
http://127.0.0.1:17821/
```

Das Hologramm bleibt ein separater lokaler Dienst.

## Sicherheit

- Secrets nur im Electron Main Process
- Electron `safeStorage`
- keine TikTok-Passwörter
- keine Tokens in GitHub
- Context Isolation aktiv
- Renderer erhält nur definierte IPC-Methoden
- CNG OBS-Chat-Token wird nicht an Status-/Diagnoseansichten zurückgegeben

## Tests und Windows CI

Lokal:

```bat
npm test
```

GitHub Actions prüft zusätzlich auf `windows-latest`:

- Dependency-Installation
- Syntax aller JS/CJS-Dateien
- Unit-/Regressionstests
- TikTok Gift-/PK-Normalisierung
- CNG Browser-URL- und Token-Leak-Schutz
- Twitch-/YouTube-Sendepfade
- Euler API-Key-Accountpfad
- Ausschluss von Hardware-/Sensor-Overlayelementen

Die CI-Konfiguration liegt unter `.github/workflows/windows-ci.yml`.
