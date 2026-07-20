# Streaming & Performance

*Wie Echtzeit-Updates deinen Browser erreichen, was zu tun ist, wenn eine Seite veraltet wirkt, und die einfachsten Lösungen für eine langsame Verbindung.*

---

## So funktioniert das Streaming

ZeroGEX sendet Live-Daten über eine dauerhafte Verbindung an deinen Browser — öffne das Dashboard, und die Daten fließen innerhalb einer Sekunde nach dem Laden der Seite. Clientseitig gibt es kein Polling.

Die Verbindung erneuert sich selbst, wenn sie abbricht. Schlägt eine Erneuerung wiederholt fehl, zeigt die Benutzeroberfläche ein "Verbindung wird wiederhergestellt…"-Label an und startet einen neuen Versuch mit Backoff.

## Was "live" wirklich bedeutet

| Bereich | Aktualisierungsintervall |
| --- | --- |
| Kursnotierung | ~1 Sekunde |
| Flow / Tape | ~1 Sekunde |
| Signal-Scores | 1–5 Sekunden je nach Signal |
| GEX-Oberfläche | 5–15 Sekunden (Engpass: Chain-Snapshot) |
| Composite Score | ~5 Sekunden |

Wenn sich die Seite in einem Hintergrund-Tab befindet, kann der Browser die Updates drosseln. Bringe den Tab in den Vordergrund, und die Updates werden sofort fortgesetzt.

## Wenn eine Seite veraltet wirkt

Die häufigsten Ursachen, geordnet danach, wie oft wir sie sehen:

1. **Der Tab war stundenlang im Hintergrund.** Die Verbindung ist möglicherweise abgebrochen. Lade die Seite neu.
2. **Du hast eine langsame Verbindung.** WebSocket-Nachrichten stauen sich; die neuesten Daten setzen sich zwar durch, aber die Updates wirken träge. Wechsle das Netzwerk oder schließe andere ressourcenintensive Tabs.
3. **Ein Werbeblocker oder eine Erweiterung stört.** Manche übermäßig aggressiven Blocker verwerfen WebSocket-Frames. Probiere es in einem privaten Fenster mit deaktivierten Erweiterungen.
4. **Der Markt ist geschlossen.** Das Session-Badge zeigt das an. Es werden die zuletzt berechneten Werte angezeigt.

## Was zuerst zu prüfen ist

Wenn etwas nicht richtig aussieht, die vierstufige Diagnose:

1. Sieh dir das **Session-Badge** an — ist der Markt geöffnet?
2. Sieh dir die **Preis-Kachel** an — ist der Zeitstempel aktuell?
3. Sieh dir das **Verbindungssymbol** im Header an — ist es grün?
4. Erzwinge ein Neuladen der Seite (Cmd+Shift+R oder Ctrl+Shift+R).

Das deckt etwa 95 % der Fälle ab, in denen "irgendetwas kaputt wirkt".

## Tipps zur Performance

### Einen aktuellen Browser verwenden

ZeroGEX ist für die evergreen Versionen von Chrome, Edge, Firefox und Safari (Tech Preview) konzipiert. Ältere Browser-Versionen funktionieren technisch, erhalten aber keine Performance-Optimierungen.

### Andere ressourcenintensive Tabs schließen

Das Dashboard überträgt mehrere Charts live. Wenn ein YouTube-Tab streamt und gleichzeitig drei TradingView-Fenster geöffnet sind, muss sich der Browser die CPU teilen. Schließe, was du nicht brauchst.

### Unnötige Erweiterungen deaktivieren

Datenschutz- und Werbeblocker-Erweiterungen sind in der Regel unproblematisch. Aggressive Skriptblocker (NoScript mit restriktiven Standardeinstellungen) benötigen die ZeroGEX-Domains auf einer Allowlist.

### Der helle Modus ist etwas schneller

Das helle Theme rendert auf den meisten Systemen etwas schneller als das dunkle Theme, aufgrund der Art, wie Schatten und Farbtöne zusammengesetzt werden. Marginal — aber auf einem leistungsschwachen Gerät durchaus erwähnenswert.

### Symbolwechsel ist aufwendiger als Zeitrahmenwechsel

Beim Wechsel des Symbols werden alle Daten neu abgerufen; beim Wechsel des Zeitrahmens wird der zugrunde liegende Stream weiterverwendet. Wenn du schnell arbeiten willst, bevorzuge den Zeitrahmen-Selektor.

## Mobil

ZeroGEX läuft auch auf Smartphones — jede Seite ist responsiv — aber die Plattform ist **für den Desktop konzipiert**. Die Chartdichte geht von einem Bildschirm breiter als 1024px aus. Scrolle auf Mobilgeräten horizontal über die Charts; alle Daten sind vorhanden, das Layout ist nur dichter.

## Wann du dich an den Support wenden solltest

Wenn die Plattform selbst festzuhängen scheint (nicht deine Verbindung, nicht ein veralteter Tab), prüfe das Verbindungssymbol unten rechts. Bleibt es über mehrere erzwungene Neuladevorgänge hinweg rot, schreibe eine E-Mail an [support@zerogex.io](mailto:support@zerogex.io) mit:

- Der Seite, auf der du dich befandest
- Dem Zeitpunkt des Vorfalls (mit Zeitzone)
- Deinem Browser und Betriebssystem

Unsere Logs sind zeitgestempelt — das reicht aus, um dem Problem nachzugehen.

## Siehe auch

- [Fehlerbehebung](/help/platform/troubleshooting)
- [Datenabdeckung & Aktualisierung](/help/platform/data-coverage)
