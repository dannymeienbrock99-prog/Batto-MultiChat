# Auto-Broadcast

Unter **Einstellungen → Auto-Broadcast** kannst du eigene Nachrichten automatisch in die verbundenen Plattform-Chats senden lassen. Der Statusknopf unten im Multi-Chat öffnet denselben Bereich.

1. Die gewünschten Konten unter **Konten** anmelden und ihre Chats verbinden.
2. Unter **Auto-Broadcast** ein Intervall von 1 bis 1440 ganzen Minuten einstellen und Twitch, TikTok und/oder YouTube auswählen.
3. Mit **Nachricht hinzufügen** bis zu 20 eigene Vorlagen anlegen. Jede Vorlage erlaubt bis zu 200 Zeichen; bei vielen mehrbyteigen Zeichen wird zusätzlich die vorhandene Twitch-Grenze von 450 UTF-8-Bytes geprüft. Zeilenumbrüche werden beim Speichern durch Leerzeichen ersetzt.
4. **Speichern** sichert die Einstellungen, ohne den Versand zu starten. **Speichern & starten** aktiviert ihn. Die erste Nachricht wird nach dem eingestellten Intervall gesendet.
5. **Pause** stoppt weitere Runden und gibt die Eingabefelder wieder zum Bearbeiten frei. Bereits an eine Plattform übergebene Nachrichten lassen sich dadurch nicht zurückholen.

Pro Runde geht **eine** Vorlage an alle ausgewählten, verbundenen Chats. Danach folgt die nächste Vorlage; nach der letzten beginnt die Reihenfolge erneut. Der nächste Timer startet nach Abschluss der Runde. Sind alle ausgewählten Chats offline, bleibt die nächste Vorlage erhalten. Einzelne Fehler halten die anderen Plattformen nicht auf.

Die Zeitsteuerung läuft im Electron-Hauptprozess und bleibt beim Schließen der Einstellungen aktiv. BATTO muss geöffnet bleiben. Ein App-Neustart beginnt immer pausiert. Vorlagen, Intervall und Auswahl bleiben unter `autoBroadcast` in `userData/settings.json` gespeichert, getrennt nach Betriebssystem-Benutzerprofil; sie werden nicht zwischen Geräten synchronisiert. Im selben Betriebssystem-Benutzerprofil teilen sich mehrere Personen die Einstellungen.

## Plattformen und Status

| Plattform | Voraussetzung und Versand |
| --- | --- |
| Twitch | Angemeldeter, verbundener Twitch-Chat mit `chat:edit`. Die vorhandene IRC-Verbindung übergibt `PRIVMSG` an den gewählten Kanal. Die Anzeige meldet **an Twitch übergeben**; IRC bestätigt die tatsächliche Anzeige im Chat nicht. |
| TikTok | Verbundener LIVE-Reader und Euler Creator OAuth mit Chat-Berechtigung. Der aktuelle Raum des Readers wird verwendet. `POST /webcast/rooms/{room_id}/chat` sendet `content` und `targetRoomId` im JSON-Body. Ein Reader-API-Key allein reicht zum Senden nicht aus. |
| YouTube | Verbundener Live-Chat und YouTube-Schreibberechtigung (`youtube.force-ssl` oder `youtube`). Bestehende reine Leseanmeldungen unter **Konten** neu autorisieren. Der Connector verwendet `liveChatMessages.insert`; eine Nachrichten-ID bestätigt die API-Annahme. |
| CNG | Derzeit nicht auswählbar. Für diese Integration liegt kein bestätigter Chat-Sendeendpunkt vor. Die bestehenden CNG-OBS-Browserquellen sind keine Sende-Anbindung. |

**Versandstatus** zeigt die letzte Vorlage und für jede ausgewählte Plattform API-Annahme/Übergabe, Fehler, Überspringen oder Abbruch. Es werden keine lokalen Chat-Einträge als erfolgreicher Plattformversand ausgegeben. Moderation, Anbieterregeln oder nachträgliche Ablehnungen können die Anzeige einer angenommenen Nachricht verhindern.

Getrennte Chats werden übersprungen. Bei Wiederverbindung oder nach einem Rechner-Ruhezustand werden keine vergangenen Runden gesammelt nachgeholt. Ein Sendeversuch wird nach 20 Sekunden abgebrochen und als unklar/fehlgeschlagen angezeigt; es gibt keinen sofortigen Wiederholungsversuch. Eine laufende Runde kann nicht parallel ein zweites Mal starten. Pause, Speichern und App-Ende brechen ausstehende Anfragen ab. Nach einer verspäteten OAuth-Antwort darf kein abgebrochener Chat-Versand mehr beginnen. Beim Abmelden eines Kontos wird auch dessen Chat-Verbindung getrennt.

## Prüfung

Automatisierte Tests decken Speicherung/Neustart, Vorlagenwechsel, Plattformauswahl, Offline-Phasen, Fehler, Zeitüberschreitungen, Pause während des Speicherns/Sendens, Wechsel des Zielchats, Renderer-Steuerung sowie die echten Preload-/Runtime-IPC-Methoden ab. Netzwerkanfragen werden in diesen Tests ersetzt; dabei werden keine Nachrichten in echte Chats gesendet.

Ein Test mit angemeldeten Live-Konten und die visuelle Prüfung im Browser stehen noch aus. Die lokale Browser-Vorschau wurde in der Arbeitsumgebung durch die Browser-Zugriffsrichtlinie blockiert.

Schnittstellen geprüft am 11.09.2026: [Twitch Chat](https://dev.twitch.tv/docs/chat), [Euler Stream: Send room chat](https://www.eulerstream.com/docs/api/tiktok-live-rooms), [YouTube: LiveChatMessages.insert](https://developers.google.com/youtube/v3/live/docs/liveChatMessages/insert).
