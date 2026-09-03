# BATTO MULTI-CHAT – verbindlicher Funktionsumfang

## Grundsatz

Das bestehende BATTO MULTI-CHAT-Fenster bleibt die zentrale Oberfläche. Es wird gepflegt und erweitert, aber nicht durch ein komplett anderes Chatfenster ersetzt.

Standard-Fenstergröße: 560 × 760 px
Mindestgröße: 420 × 520 px

## Plattformen

- Twitch
- CNG
- TikTok
- YouTube

Jede Plattform erhält einen eigenen Connector. Alle Plattformereignisse werden in ein gemeinsames internes Nachrichten- und Ereignismodell normalisiert.

## Funktionen, die enthalten sein sollen

### Multi-Chat
- gemeinsamer Live-Chat
- Plattformfilter
- Avatare
- Rollen und Badges
- Moderatorstatus
- Zeitstempel
- Rechtsklick-Schnellmoderation
- lokaler Chatverlauf
- Senden pro Plattform, sobald die jeweilige Plattform authentifiziert ist

### Konten & Verbindungen
- saubere Kontokarten
- OAuth/QR-Anmeldung statt manueller Token-Eingabe, soweit technisch möglich
- Twitch OAuth
- TikTok/Euler OAuth mit QR
- YouTube/Google OAuth
- CNG-Verbindung
- Verbindungsstatus und Berechtigungsstatus
- sichere Token-Aktualisierung

### TikTok LIVE / Euler Stream
- Chat
- Gifts
- Likes
- Follows
- Shares
- Viewer Joins
- Subscriptions
- Viewer-/Room-Updates
- Stream Start/Ende
- PK/Battle-Ereignisse
- Gift-Katalog
- Gift-ID, Name, Bild, Diamanten, Combo/Streak
- Chat senden
- Mute/Unmute
- Ban/Unban
- Moderatoren hinzufügen/entfernen
- Kommentare an/aus
- Sensitive-Words-Verwaltung

### Moderation
- Rechtsklick auf Nutzer
- Moderatoren
- gesperrte Nutzer
- stummgeschaltete Nutzer
- Chatfilter
- sensible Wörter
- Kommentare
- rollenbasierte Moderationsaktionen

### OBS
- OBS WebSocket 127.0.0.1:4455
- Passwort verschlüsselt speichern
- Szenen laden
- Quellen laden
- Quellen ein-/ausblenden
- Browserquellen verwalten
- Chat-Overlay
- Live-Alerts
- Hologramm
- Multi-Gast-Quellen

### Stream-Overlay
- lokaler Overlay-Server auf Port 48621
- OBS-Browserquelle: http://127.0.0.1:48621/overlay
- Chat-Ingest: http://127.0.0.1:48621/api/chat
- Event-Ingest: http://127.0.0.1:48621/api/event
- transparente Browserquelle
- Chat
- Gifts
- Alerts
- Ziele
- Timer
- Like-Zähler
- Topliste
- Co-Host
- TikTok-Ereignisse
- Herzfrequenz/Sensorwerte, wenn verfügbar
- weitere frei positionierbare Overlay-Elemente

### Multi-Gast
- Gast-Slots
- OBS-Quellen zuordnen
- Sichtbarkeit steuern
- Status pro Gast
- Plattformfunktionen nur dort aktivieren, wo die jeweilige API sie tatsächlich unterstützt

### TTS
- Stimme
- Sprache
- Lautstärke
- Geschwindigkeit
- Tonhöhe
- Plattformfilter
- Nutzerfilter
- Cooldown
- maximale Nachrichtenlänge

### Sicherheit / Storage
- Electron safeStorage für Secrets
- Access Tokens verschlüsselt
- Refresh Tokens verschlüsselt
- API Keys verschlüsselt
- OBS-Passwort verschlüsselt
- keine Secrets im Renderer
- keine Secrets in Logs
- getrennte normale Einstellungen und geheime Daten

### Diagnose
- Plattformstatus
- OAuth-Status
- WebSocket-Status
- OBS-Status
- Overlay-Server-Status
- Room-ID / Streamstatus
- Eventrate
- letzte Ereignisse
- technische Fehlerdetails nur im Diagnosebereich

### Weitere bestehende sinnvolle Funktionen
- Hardware-/Sensorinformationen, soweit sie für Overlay oder Stream relevant sind
- lokale Heart-Rate-/Sensoranbindung
- Hologramm-Funktionen
- OBS-Browserquellen
- lokale Server/Bridges, soweit sie für Multi-Chat und Streamfunktionen benötigt werden

## Bewusst NICHT enthalten

### Kein Plugin-System
- kein Plugin-Loader
- keine Plugin-Registry
- kein Marketplace
- keine externen Plugin-Pakete
- keine Plugin-Actions

Benötigte Funktionen werden nativ im Projekt implementiert.

### Kein Stream Deck / Touch Deck
- kein Stream-Deck-Plugin
- kein Touch-Deck
- keine AJAZZ-/StreamDeck-Geräteverwaltung in diesem Projekt
- keine Stream-Deck-Profile
- keine Stream-Deck-Actions

## Architekturregel

UI, Plattformconnectoren, Moderation, OBS, Overlay, TTS, Storage und Authentifizierung bleiben getrennte Module. Plattformcode wird nicht direkt in das Chatfenster eingebaut.
