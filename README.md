# BATTO MULTI-CHAT

Twitch · CNG · TikTok · YouTube

Eigenständiges Testprojekt für den neuen sauberen Multi-Chat-Aufbau.

## Fenster

- Standard: 560 × 760 px
- Minimum: 420 × 520 px
- bestehende BATTO-MULTI-CHAT-Oberfläche bleibt die Basis
- Einstellungen werden sauber über das Zahnrad geöffnet

## Start ohne Installer

```bat
npm install
npm start
```

## Struktur

```text
src/
├── main.cjs
├── preload.cjs
├── renderer/
│   ├── multi-chat.html
│   ├── multi-chat.css
│   └── multi-chat.js
├── services/
│   ├── chat-core.cjs
│   ├── chat-window-manager.cjs
│   ├── obs-websocket.cjs
│   └── platform-manager.cjs
├── storage/
│   └── secret-store.cjs
└── platforms/
    ├── base-adapter.cjs
    └── tiktok/
        ├── tiktok-adapter.cjs
        └── euler/
            └── euler-client.cjs
```

## Zielmodule

- gemeinsame Chat-Normalisierung
- Twitch Connector + OAuth
- CNG Connector
- TikTok LIVE + Euler Stream
- YouTube Connector + OAuth
- Moderation: Mute, Ban, Moderatoren, Filter
- TikTok Gifts, Likes, Follows, Shares, Subs, Viewer, PK/Battle
- Multi-Gast
- TTS
- OBS WebSocket + Overlay/Hologramm/Alerts
- verschlüsselte Tokens/Secrets
- Diagnosebereich

## Stand dieses Testgerüsts

Bereits funktionsfähig vorbereitet:
- Electron-Fenster
- ursprüngliche Multi-Chat-Abmessungen
- Multi-Chat-UI mit Plattformfiltern
- saubere Einstellungen innerhalb der App
- Chat-Core und Normalisierung
- Plattform-Manager
- TikTok LIVE Basisadapter
- OBS-WebSocket-Verbindungsgerüst
- verschlüsselter SecretStore
- Euler REST-Client-Grundlage

Noch nicht als echte Produktfunktion freigeschaltet:
- OAuth-Login für TikTok/Twitch/YouTube
- Euler Moderation
- Gift-Katalog
- echte Twitch/CNG/YouTube-Connectoren
- Multi-Gast
- vollständiges TTS-Modul
- OBS-Szenen-/Quellensteuerung

Diese Funktionen werden modular ergänzt, ohne das bestehende Multi-Chat-Fenster neu zu bauen.
