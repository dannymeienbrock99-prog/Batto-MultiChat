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

Der lokale Farbeditor gestaltet BATTO und seine OBS-Browserquellen. Zusätzlich kann der Twitch-Bereich die eigene Namensfarbe direkt bei Twitch ändern. Fremde Konten werden nicht verändert. CNG-Farben greifen bei CNG-Nachrichten in BATTO; die derzeit separat eingebundene offizielle CNG-Chat-Browserquelle wird dadurch nicht umgestaltet.

### Eigene Namensfarbe direkt bei Twitch

1. In **Einstellungen → Hologramm** die Plattform **Twitch** auswählen.
2. **Twitch-Farben freigeben** öffnet die Anmeldung im Systembrowser. Den im Editor angezeigten Anmeldecode verwenden, falls Twitch danach fragt. Bestehende Chat-Berechtigungen bleiben erhalten; die Freigabe ergänzt `user:manage:chat_color`. Eine laufende Anmeldung lässt sich mit **Anmeldung abbrechen** beenden. Die Twitch Client ID muss wie bei der bestehenden Twitch-Anmeldung einmal unter Konten eingerichtet sein.
3. **Aktuelle Farbe laden** liest die eigene Twitch-Farbe und prüft die Berechtigung. Eine Standardfarbe auswählen oder einen eigenen Hex-Wert eingeben. **BATTO-Namensfarbe übernehmen** kopiert die Auswahl aus dem lokalen Editor in diesen Bereich.
4. **Bei Twitch speichern** ändert die eigene Namensfarbe bei Twitch. Standardfarben stehen allen zur Verfügung; freie Hex-Farben erfordern laut Twitch Prime oder Turbo. Ablehnungen werden angezeigt und nicht als Erfolg gemeldet.

Das lokale **Farben speichern** und die lokalen Rücksetzknöpfe lösen keine Änderung bei Twitch aus. Twitch speichert die eigene Namensfarbe im Twitch-Konto. Neue Twitch-Nachrichten liefern sie anschließend über den Connector an BATTO; ein aktivierter lokaler Farb-Override hat in BATTO weiter Vorrang. Namen anderer Personen und normale Nachrichtentextfarben im offiziellen Twitch-Chat werden nicht verändert.

Tokens bleiben im Hauptprozess. Benutzer-ID, Client-ID und Berechtigungen stammen aus der Validierung desselben Tokens, der für den API-Aufruf verwendet wird. Erfolgreiches Schreiben erfordert die dokumentierte Antwort HTTP 204.

Stand der geprüften Schnittstellen: 11.09.2026.

| Anbieter | Bestätigte Möglichkeit / Grenze |
| --- | --- |
| Twitch | Die API kann die **eigene Namensfarbe** ändern. Erforderlich sind ein eigener User-Token und `user:manage:chat_color`. Alle Nutzer dürfen die vorgegebenen Farbnamen wählen; freie Hex-Farben sind laut API für Prime/Turbo vorgesehen. Der Endpoint ändert weder andere Namen noch normalen Nachrichtentext. Der separate Bereich „Meine Farbe im Twitch-Chat“ liest die aktuelle Farbe und überträgt die gewählte Farbe auf ausdrücklichen Klick. |
| YouTube | Das dokumentierte Modell für normale Live-Chat-Textnachrichten enthält `messageText`, aber keine frei wählbaren Namens-/Textfarben. Daraus ergibt sich für diesen Connector keine bestätigte Farbübertragung. |
| TikTok / Euler Stream | Der verwendete Send-room-chat-Endpoint dokumentiert Chattext, keine frei wählbaren Namens-/Textfarben. Eine Farbübertragung ist nicht bestätigt. |
| CNG | Das Projekt nutzt offizielle Browserquellen. Eine bestätigte API zur Übertragung dieser Farben liegt nicht vor. |

Quellen: [Twitch: Update User Chat Color](https://dev.twitch.tv/docs/api/reference/#update-user-chat-color), [YouTube: LiveChatMessages](https://developers.google.com/youtube/v3/live/docs/liveChatMessages), [Euler Stream: TikTok LIVE Rooms](https://www.eulerstream.com/docs/api/tiktok-live-rooms), [CNG Guides](https://cng-plattform.com/guides).
