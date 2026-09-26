# Streaming & Performance

*Wie Echtzeit-Updates deinen Browser erreichen, was zu tun ist, wenn eine Seite veraltet wirkt, und die einfachsten Lösungen für eine langsame Verbindung.*

---

## So funktionieren die Live-Updates

Jede Seite hält sich selbst aktuell - du musst nichts neu laden. Der Kurs in der Kopfzeile aktualisiert sich etwa einmal pro Sekunde, und jedes Panel ruft in seinem eigenen kurzen Takt frische Zahlen ab, bei den meisten Bereichen alle paar Sekunden. Die Daten kommen an, sobald die Seite geladen ist.

Schlägt eine Anfrage fehl, zeigt die Seite weiter die letzten gültigen Werte an und versucht es im nächsten Takt erneut. Die Seiten Gesamtscore und Trade Bias zeigen zusätzlich eine Live-Anzeige mit dem Hinweis "Reconnecting…", falls keine Updates mehr eintreffen.

## Was "live" wirklich bedeutet

Die Seiten fragen alle paar Sekunden nach neuen Zahlen, aber jede Zahl ändert sich nur so oft, wie sie berechnet wird:

| Bereich | Wie oft er sich ändert |
| --- | --- |
| Kursnotierung | Etwa jede Sekunde |
| Dealer-Positionierung (GEX, Walls, Flip, Max Pain) | Etwa einmal pro Minute neu berechnet |
| Signal-Scores und Gesamtscore | Etwa einmal pro Minute; die Signalseiten fragen alle 5 Sekunden ab |
| Options-Flow | Fünf-Minuten-Balken |
| Volatilitätsanzeigen (VIX / VXN) | Fünf-Minuten-Balken |

Wenn sich die Seite in einem Hintergrund-Tab befindet, kann der Browser die Updates drosseln. Bringe den Tab in den Vordergrund, und die Updates werden sofort fortgesetzt.

## Wenn eine Seite veraltet wirkt

Die häufigsten Ursachen, geordnet danach, wie oft wir sie sehen:

1. **Der Tab war stundenlang im Hintergrund.** Die Updates sind möglicherweise ins Stocken geraten. Lade die Seite neu.
2. **Du hast eine langsame Verbindung.** Anfragen stauen sich; die neuesten Daten setzen sich zwar durch, aber die Updates wirken träge. Wechsle das Netzwerk oder schließe andere ressourcenintensive Tabs.
3. **Ein Werbeblocker oder eine Erweiterung stört.** Manche übermäßig aggressiven Blocker blockieren die Hintergrund-Anfragen, die frische Daten abrufen. Probiere es in einem privaten Fenster mit deaktivierten Erweiterungen.
4. **Der Markt ist geschlossen.** Das Session-Badge zeigt das an. Es werden die zuletzt berechneten Werte angezeigt.

## Was zuerst zu prüfen ist

Wenn etwas nicht richtig aussieht, die dreistufige Diagnose:

1. Sieh dir das **Session-Badge** an - ist der Markt geöffnet?
2. Fahre mit der Maus über den **Kurs in der Kopfzeile** - wirkt die "as of"-Zeit aktuell?
3. Erzwinge ein Neuladen der Seite (Cmd+Shift+R oder Ctrl+Shift+R).

Das deckt die meisten Fälle ab, in denen "irgendetwas kaputt wirkt".

## Tipps zur Performance

### Einen aktuellen Browser verwenden

ZeroGEX ist für aktuelle Versionen von Chrome, Edge, Firefox und Safari konzipiert. Verhält sich etwas in einem älteren Browser seltsam, aktualisiere ihn zuerst.

### Andere ressourcenintensive Tabs schließen

Das Dashboard aktualisiert mehrere Charts live. Wenn ein YouTube-Tab streamt und gleichzeitig drei TradingView-Fenster geöffnet sind, muss sich der Browser die CPU teilen. Schließe, was du nicht brauchst.

### Unnötige Erweiterungen deaktivieren

Datenschutz- und Werbeblocker-Erweiterungen sind in der Regel unproblematisch. Aggressive Skriptblocker (NoScript mit restriktiven Standardeinstellungen) benötigen die ZeroGEX-Domains auf einer Allowlist.

### Symbolwechsel ist aufwendiger als Zeitrahmenwechsel

Beim Wechsel des Symbols ruft jedes Panel der Seite seine Daten neu ab; beim Wechsel des Zeitrahmens eines Charts wird nur dieser Chart neu geladen.

## Mobil

ZeroGEX läuft auch auf Smartphones - jede Seite ist responsiv - aber die Plattform ist **für den Desktop konzipiert**. Die Chartdichte geht von einem Bildschirm breiter als 1024px aus. Auf dem Smartphone passen sich die Charts der Bildschirmbreite an und zeigen weniger Beschriftungen; alle Daten sind vorhanden, das Layout ist nur dichter. Wische nach oben oder unten, um die Seite zu scrollen - Charts reagieren nur auf seitliches Ziehen.

## Wann du dich an den Support wenden solltest

Wenn die Plattform selbst festzuhängen scheint (nicht deine Verbindung, nicht ein veralteter Tab) und auch erzwungenes Neuladen nicht hilft, schreibe eine E-Mail an [support@zerogex.io](mailto:support@zerogex.io) mit:

- Der Seite, auf der du dich befandest
- Dem Zeitpunkt des Vorfalls (mit Zeitzone)
- Deinem Browser und Betriebssystem

Unsere Logs sind zeitgestempelt - das reicht aus, um dem Problem nachzugehen.

## Siehe auch

- [Fehlerbehebung](/help/platform/troubleshooting)
- [Datenabdeckung & Aktualisierung](/help/platform/data-coverage)
