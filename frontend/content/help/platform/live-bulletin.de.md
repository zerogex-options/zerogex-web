# Das Live Bulletin nutzen

*Ein teilbereiter Live-Snapshot der Dealer-Gamma-Positionierung für das Symbol, das du beobachtest.*

---

## Was das Live Bulletin ist

Das Live Bulletin ist eine **Live-Übersichtskarte zur Dealer-Gamma-Positionierung** — für jeweils einen Basiswert. Wähle ein Symbol, und es holt den aktuellen Positionierungs-Snapshot direkt aus dem Backend und stellt ihn auf einer einzigen Karte dar: das Gamma-Regime, die wichtigsten Levels (Gamma Flip, Call Wall, Put Wall, Max Pain), das Net GEX, das Put/Call-Verhältnis, ein Expected-Range-Band und eine Positionierungskarte, die den Spot im Verhältnis zu diesen Levels verortet.

Sie ist darauf ausgelegt, auf einen Blick gelesen — und geteilt — zu werden. Du kannst Überschrift und Zusammenfassung anpassen und dann ein sauberes PNG der Karte für deine Notizen, einen Trading-Chat oder Social Media herunterladen oder kopieren.

## Was auf der Karte steht

- **Gamma-Regime-Badge** — positiv (Dealer long Gamma; verankert, niedrige Vola), negativ (Dealer short Gamma; im Trend, hohe Vola), am Flip (Übergang) oder unaufgelöst, wenn die Chain zu dünn ist, um einen Flip zuverlässig zu bestimmen.
- **Überschrift + Zusammenfassung** — eine automatisch aus den Live-Zahlen generierte Klartext-Lesart: die Dealer-Positionierung, wo der Spot relativ zum Flip steht, der Korridor zwischen den Walls und was das Regime für die Tape bedeutet. Bearbeitbar — siehe unten.
- **Spot** — der Kurs des Basiswerts und die Tagesveränderung. Wenn ein Cash-Index außerhalb seiner Session ist (z. B. der SPX über Nacht), ist der Spot **aus den Futures (ES/NQ) impliziert** und wird klar als solcher gekennzeichnet — niemals als Live-Cash-Kurs dargestellt.
- **Metrik-Raster** — Gamma Flip, Net GEX, Put/Call-Verhältnis, Call Wall, Put Wall und Max Pain.
- **Expected Range** — ein 1σ-Band (~68 %) der impliziten Bewegung für den gewählten Horizont, abgeleitet aus dem VIX (SPX/SPY) oder dem VXN (QQQ/NDX), plus ein Hinweis darauf, wo die Dealer-Walls relativ zu diesem Band liegen.
- **Positionierungskarte** — Put Wall, Gamma Flip, Spot und Call Wall auf einer gemeinsamen Preisachse, mit schattiertem Expected-Range-Band, sodass du auf einen Blick siehst, wo der Preis zwischen den Magneten liegt.

## Steuerung

- **Basiswert** — SPX, SPY, QQQ oder NDX.
- **Expected-Range-Horizont** — Daily, Weekly oder Monthly. „Daily" ist eine Handelssession implizite Vola (die Expected Daily Range), kein Kalendertag; Weekly sind 5 Sessions, Monthly ~21. Ist der Index für die implizite Vola nicht verfügbar, wird das Band ausgeblendet statt geschätzt.
- **Überschrift / Zusammenfassung** — der automatisch generierte Text ist ein Ausgangspunkt; bearbeite eines der Felder, und die Karte aktualisiert sich live. „Reset to auto" stellt den generierten Text wieder her.
- **Download PNG / Copy to clipboard** — exportiere die Karte als teilbereites Bild (die Karte trägt ein zerogex.io-Wasserzeichen).

## Wie sie sich aktualisiert

Die Karte ist **live**. Sie fragt das Backend über die gesamte Session hinweg ab — den Spot alle paar Sekunden, die Gamma-Zusammenfassung und das Gamma-Profil alle ~10 Sekunden, die Volatilitätsanzeige alle ~30 Sekunden — sodass sich die Levels, das Regime, das Expected-Range-Band und die automatisch generierte Lesart aktualisieren, wenn sich die Bedingungen ändern. Die Dealer-Gamma-Levels selbst werden von der Analytics-Engine während der regulären Session in einem Zyklus von rund einer Minute neu berechnet, sodass sich Walls, Flip und Max Pain intraday verschieben können, wenn sich Spot und Positionierung entwickeln. Ein „as of"-Zeitstempel (ET) auf der Karte zeigt dir, wie frisch der Snapshot ist.

## Wann sie am nützlichsten ist

- **Vor der Eröffnung** — eine schnelle Lesart, wo Walls, Flip und Expected Range in die Session hineingehen, mit dem aus den Futures implizierten Spot, solange der Cash-Index noch geschlossen ist.
- **Rund um wichtige Levels** — wirf einen Blick auf die Positionierungskarte, wenn sich der Preis dem Flip, der Call Wall oder der Put Wall nähert.
- **Um eine Lesart zu teilen** — exportiere die Karte, wenn du jemandem das Dealer-Gamma-Bild des Tages weitergeben willst, ohne die ganze App zu screenshotten.

## Was es nicht ist

Das Live Bulletin ist **kein Handelssignal-Feed**. Es ist ein Positionierungs-/Kontext-Snapshot — es zeigt dir, *wo* das Dealer-Gamma liegt und welches Regime das impliziert, nicht *wann* du handeln sollst. Für auslösende Signale und Trigger nutze die Basic- und Advanced-Signal-Dashboards sowie die [Signal Alerts](/help/platform/alerts); für eine Richtungslesart siehe den Trade Bias und den [Composite Score](/help/platform/composite-score).

## Sichtbarkeit nach Stufe

Das Live Bulletin ist eine **Basic**-Funktion — in Basic und Pro enthalten. Die Advanced-Signale, auf die es dich hinweist, sind separat der Pro-Stufe vorbehalten.

## Der Admin-Spiegel

Es gibt eine wasserzeichenfreie Admin-Version derselben Karte, die für Screenshots und Demos verwendet wird. Das ist ein rein interner Pfad.

## Siehe auch

- [Das Dashboard lesen](/help/platform/dashboard)
- [Dealer Positioning](/help/platform/dealer-positioning)
- [Max Pain](/help/platform/max-pain)
