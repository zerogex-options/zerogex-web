# So bekommst du SPX-Gamma-Levels in Claude, ChatGPT und Cursor

*Frag einen KI-Assistenten, wo der Gamma Flip liegt, und er wird sich meist eine Zahl ausdenken. Ihn mit einer Live-Quelle zu verbinden, behebt das. Hier erfährst du, wie das geht, was du fragen kannst und wie du eine echte Antwort von einer erfundenen unterscheidest.*

---

## Das Problem, wenn man einen Assistenten nach einem Level fragt

Frag Claude oder ChatGPT „Wo liegt heute der SPX-Gamma-Flip?“, und du bekommst eine Antwort. Sie wird selbstsicher klingen, sie wird wie ein echter Messwert formatiert sein, und sofern der Assistent sie nicht tatsächlich abgerufen hat, wird sie erfunden sein.

Das ist keine Nachlässigkeit des Modells. Ein Sprachmodell antwortet aus dem, was es im Training gelernt hat, und ein Gamma Flip ist eine Zahl, die sich heute Morgen geändert hat und sich heute Nachmittag wieder ändern wird. In den Trainingsdaten steht nichts, was richtig sein könnte. Wenn ein Modell keine Quelle hat, ist plausibel klingender Output genau die Art, wie es versagt, und ein erfundenes Level ist auf den ersten Blick nicht von einem echten zu unterscheiden.

Die Lösung ist kein besserer Prompt. Die Lösung ist, dem Assistenten eine Quelle zu geben, in der er nachsehen kann.

## Was MCP ist, in einem Absatz

Das [Model Context Protocol](https://modelcontextprotocol.io) ist ein Standardweg, über den ein KI-Assistent eine externe Datenquelle abfragen kann. Ein Anbieter betreibt einen kleinen Server; du fügst dessen Adresse einmal zu deinem Assistenten hinzu; von da an kann der Assistent ihn aufrufen, wenn eine Frage Live-Daten braucht. Claude, ChatGPT und Cursor sprechen es alle. Es ist der Unterschied zwischen einem Assistenten, der einen Gamma Flip rät, und einem, der ihn nachschlägt.

## ZeroGEX verbinden

ZeroGEX veröffentlicht einen kostenlosen MCP-Server unter `https://zerogex.io/mcp`. Er liefert dieselben um 15 Minuten verzögerten Levels wie die öffentlichen [Gamma-Levels-Seiten](/spx-gamma-levels) - Gamma Flip, Call Wall, Put Wall, Max Pain, Same-Day-Pin-Strike und Netto-Dealer-Gamma am Spot, für SPX, SPY, QQQ, NDX, ES und NQ. Es gibt keinen Schlüssel, kein Konto und nichts zu installieren. Das Lesen ist kostenlos.

**Claude (Desktop oder Web).** Öffne deine Konnektor-Einstellungen, lege einen benutzerdefinierten Konnektor an und füge die URL ein. Falls nach einem Schlüssel gefragt wird, lass das Feld leer.

**Claude Code.**

```bash
claude mcp add --transport http zerogex https://zerogex.io/mcp
```

**Cursor.** Trag ihn in `~/.cursor/mcp.json` ein:

```json
{
  "mcpServers": {
    "zerogex": {
      "url": "https://zerogex.io/mcp"
    }
  }
}
```

**Alles andere.** Jeder Client, der die URL eines Remote-MCP-Servers akzeptiert, funktioniert. Clients, die die offizielle Registry durchsuchen, finden ihn unter dem Namen `io.zerogex/gamma-levels`. Wenn deiner nur lokale `stdio`-Server unterstützt, schalte eine Bridge wie `mcp-remote` davor.

Die vollständigen Einrichtungshinweise, einschließlich der Prüfung der Verbindung mit `curl` und was zu tun ist, wenn sich ein Client falsch verhält, findest du im [Hilfe-Center](/help/platform/mcp-server).

## Was du fragen kannst

Es geht nicht darum, eine Befehlssyntax zu lernen. Frag in ganz normaler Sprache, und der Assistent wählt das passende Tool:

- *„Wo liegt der SPX-Gamma-Flip gerade, und wie weit ist der Spot davon entfernt?“*
- *„Ist QQQ in positivem oder negativem Gamma?“*
- *„Wie sieht die Dealer-Positionierung heute über die Indizes hinweg aus?“*
- *„Wie weit ist SPY von seiner Call Wall entfernt, und was würde ein Bruch darüber bedeuten?“*
- *„Gibt es bei SPX einen Same-Day-Pin-Strike?“*

Bei den letzten beiden zeigt ein Assistent, was er einer Seite voller Zahlen voraushat. Er hat das Level *und* die Erklärung, kann dir also sagen, dass die Call Wall 1,4 % über dem Spot liegt und dass sich das Hedging in einem Regime mit positivem Gamma tendenziell gegen eine Rally in sie hinein stemmt - ohne dass du zwischen einem Dashboard und einem Erklärartikel hin- und herwechseln musst.

Zwei Fragen, die er gut beantwortet und eine Seite nicht:

- *„Vergleiche die Positionierung von SPX und SPY - stimmen die beiden Bücher überein?“* Ein Aufruf, beide Bücher, und die Abweichung wird klar benannt.
- *„Ich schaue mir einen Breakout über 6450 an. Was liegt zwischen hier und der Call Wall?“* Dein Kontext, seine Levels.

## Eine echte Antwort von einer erfundenen unterscheiden

Das ist wichtiger als die Einrichtung, denn ein verbundener und ein nicht verbundener Assistent sehen identisch aus, bis du nachprüfst.

**Eine echte Antwort nennt ihr Alter.** Jede Antwort des ZeroGEX-Servers beginnt mit dem Zeitstempel des Snapshots und seinem Alter und weist den Assistenten an, das zu wiederholen. Wenn du einen Gamma Flip bekommst, ohne dass erwähnt wird, wann er berechnet wurde, sei misstrauisch - die Zahl stammt wahrscheinlich vom Modell, nicht vom Server.

**Frag direkt nach.** *„Woher stammt diese Zahl, und wie alt ist sie?“* Ein verbundener Assistent nennt dir die Uhrzeit des Snapshots. Ein nicht verbundener wird ausweichen.

**Ein fehlendes Level sollte fehlen bleiben.** Wenn das modellierte Buch keinen Gamma Flip hergibt, liefert der Server „unavailable“ statt einer Zahl. Ein Assistent, der daraus `0` macht oder stillschweigend ein Level nachliefert, füllt eine Lücke. Frag ihn, woher der Wert stammt.

**Ausfälle sind sichtbar.** Wenn das Backend kurz nicht erreichbar ist, liefert das Tool ausdrücklich „temporarily unavailable“ und weist den Assistenten an, nicht aus dem Gedächtnis zu antworten. Das ist ein normaler, vorübergehender Zustand, keine fehlerhafte Konfiguration.

## Was das nicht ist

**Es ist nicht in Echtzeit.** Die kostenlose Stufe ist bewusst um mindestens 15 Minuten verzögert. Das ist gut für Orientierung und Struktur - wo die Walls liegen, in welchem Regime du dich befindest, wie weit der Spot vom Flip entfernt ist. Es ist nicht gut, um einen Einstieg zum aktuellen Preis zu timen, weil der Markt bei einem schnellen Tape ein Level schon hinter sich gelassen haben kann, bevor der Snapshot es zeigt. Der Echtzeit-Feed ist ein Pro-Feature hinter [einem API-Schlüssel](/help/platform/api-access).

**Es ist kein Signaldienst.** Der Server liefert Positionierung, keine Richtung. Ein Gamma Flip sagt dir, welches Hedging-Playbook das modellierte Buch fährt, nicht, ob du kaufen sollst. Das sagt der Server bei jedem Aufruf dazu.

**Die Levels sind modelliert, nicht beobachtet.** Die Dealer-Positionierung wird aus öffentlichen Optionsdaten unter einer offengelegten Vorzeichenkonvention abgeleitet - niemand veröffentlicht sein Buch. Die [Methodik-Seite](/methodology) legt ehrlich dar, was sich daraus ableiten lässt und was nicht.

**Assistenten machen trotzdem Fehler.** Die Verbindung mit einer echten Quelle beseitigt den Fehler erfundener Zahlen. Sie beseitigt nicht Fehlinterpretationen, Selbstüberschätzung oder einen Assistenten, der in einem langen Gespräch eine alte Antwort weiterträgt. Frag nach dem Alter, wenn es darauf ankommt.

## Lohnt sich das?

Wenn du ohnehin ein Dashboard offen hast, wahrscheinlich nicht - du bist nur einen Blick von denselben Zahlen entfernt.

Es lohnt sich, wenn du ohnehin in einem Assistenten arbeitest: wenn du einen Trade-Plan ausformulierst, ein Setup durchdenkst oder Folgefragen stellst, die sowohl das Level als auch seine Bedeutung brauchen. Die Ersparnis liegt nicht im Nachschlagen selbst, sondern darin, für das Nachschlagen nicht den Kontext verlassen zu müssen.

Es ist auch der schnellste Weg, ein Level zu prüfen: vom Handy aus, auf einem Laptop ohne dein Charting-Setup oder mitten in einem Gespräch über etwas anderes.

## Siehe auch

- [Der ZeroGEX-MCP-Server](/help/platform/mcp-server) - vollständige Einrichtung und Fehlerbehebung.
- [Kostenlose SPX-Gamma-Levels](/spx-gamma-levels) - dieselben Daten als Seite.
- [Was ist ein Gamma Flip?](/education/how-to-read-a-gamma-flip) - was das Level tatsächlich bedeutet.
- [Einen MCP-Server auf Basis der ZeroGEX-API bauen](/help/platform/mcp-integration) - für Pro-Nutzer, die Echtzeitdaten und eigene Tool-Zuschnitte wollen.

Nur zu Bildungszwecken - nichts davon ist eine Handelsempfehlung.
