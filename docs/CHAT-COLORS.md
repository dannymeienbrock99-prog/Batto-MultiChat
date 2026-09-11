# Persönliche Hologramm- und Chatfarben

Im Multi-Chat unter **Einstellungen → Hologramm**:

1. Twitch, TikTok, YouTube oder CNG auswählen.
2. Eigene Namensfarbe und/oder eigene Nachrichtenfarbe aktivieren.
3. Farbe über Farbauswahl oder Hex-Wert festlegen. Die Vorschau zeigt Änderungen sofort, ohne eine Chatnachricht zu senden.
4. **Farben speichern** übernimmt alle Plattformen in den Multi-Chat, das BATTO-Hologramm und die Chat-Elemente des BATTO-Stream-Overlays. Auch vorhandene Nachrichten werden aktualisiert.

**Plattform zurücksetzen** und **Alle zurücksetzen** bereiten die Standardfarben vor; anschließend speichern. **Änderungen verwerfen** stellt die zuletzt gespeicherten Werte wieder her.

Die Einstellungen liegen im normalen Electron-Benutzerprofil (`userData/settings.json`, Schlüssel `chatAppearance`). Sie bleiben beim Neustart erhalten und gelten für die jeweilige Installation im Betriebssystem-Benutzerkonto. Es gibt keine zusätzliche BATTO-Anmeldung oder Synchronisation zwischen Geräten. Mehrere Personen im selben Betriebssystem-Benutzerkonto teilen dieses Profil.

Ohne aktivierte eigene Farbe werden übermittelte Namensfarben verwendet, andernfalls die Plattformfarbe. Nachrichtentext behält die Standardfarbe der jeweiligen Ansicht. Originalnachrichten bleiben unverändert; Zurücksetzen kann dadurch die ursprünglichen Farben wiederherstellen. Die Farbänderung verlängert die Einblendung einer bestehenden Hologramm-Nachricht nicht.

## Anbieter-Chats

Diese Funktion gestaltet BATTO und seine OBS-Browserquellen. Sie ändert keine fremden Konten oder offiziellen Chat-Oberflächen. CNG-Farben greifen bei CNG-Nachrichten in BATTO; die derzeit separat eingebundene offizielle CNG-Chat-Browserquelle wird dadurch nicht umgestaltet.

Stand der geprüften Schnittstellen: 11.09.2026.

| Anbieter | Bestätigte Möglichkeit / Grenze |
| --- | --- |
| Twitch | Die API kann die **eigene Namensfarbe** ändern. Erforderlich sind ein eigener User-Token und `user:manage:chat_color`. Alle Nutzer dürfen die vorgegebenen Farbnamen wählen; freie Hex-Farben sind laut API für Prime/Turbo vorgesehen. Der Endpoint ändert weder andere Namen noch normalen Nachrichtentext. Eine automatische Übertragung aus diesem Editor ist nicht implementiert. |
| YouTube | Das dokumentierte Modell für normale Live-Chat-Textnachrichten enthält `messageText`, aber keine frei wählbaren Namens-/Textfarben. Daraus ergibt sich für diesen Connector keine bestätigte Farbübertragung. |
| TikTok / Euler Stream | Der verwendete Send-room-chat-Endpoint dokumentiert Chattext, keine frei wählbaren Namens-/Textfarben. Eine Farbübertragung ist nicht bestätigt. |
| CNG | Das Projekt nutzt offizielle Browserquellen. Eine bestätigte API zur Übertragung dieser Farben liegt nicht vor. |

Quellen: [Twitch: Update User Chat Color](https://dev.twitch.tv/docs/api/reference/#update-user-chat-color), [YouTube: LiveChatMessages](https://developers.google.com/youtube/v3/live/docs/liveChatMessages), [Euler Stream: TikTok LIVE Rooms](https://www.eulerstream.com/docs/api/tiktok-live-rooms).
