# Das Live Bulletin nutzen

*Der Live-Feed mit Signalereignissen, Regimewechseln und bemerkenswerten Flows.*

---

## Was das Live Bulletin ist

Das Live Bulletin ist deine **Timeline des Handelstags**. Immer wenn ein Signal auslöst, sich das GEX-Regime verschiebt, ein Wall sich um einen relevanten Betrag verschiebt oder Smart-Money-Flow in nennenswertem Umfang auftaucht, landet ein Eintrag im Bulletin.

Stell es dir als die "Newsfeed-Ansicht" all dessen vor, was ZeroGEX erkennt, sortiert nach Bedeutung und Zeit.

## Was im Bulletin landet

Es gibt fünf Kategorien von Einträgen:

- **Signal triggers** — wenn ein Advanced-Signal seinen Auslöseschwellenwert überschreitet.
- **Regime events** — Gamma-Flip-Durchgang, Regimewechsel (positiv ↔ negativ).
- **Wall events** — Call Wall oder Put Wall verschiebt sich um einen relevanten Betrag.
- **Flow notables** — Prämienspitzen, Smart-Money-Läufe, ungewöhnliche Blöcke.
- **Schedule events** — Marktöffnung, Öffnung des EOD-Pressure-Fensters, Handelsschluss.

## Wie Einträge bewertet und geordnet werden

Jeder Eintrag hat:

- Einen **Zeitstempel** — wann er aufgetreten ist (und ein "fresh"-Badge für die neuesten Einträge)
- Einen **Direction Chip** — bullish, bearish oder neutral
- Einen **Conviction Score** — wie stark das Signal/Ereignis war

Einträge werden standardmäßig von oben nach unten zeitlich sortiert. Über das Sortier-Dropdown kannst du auf eine Sortierung nach Wichtigkeit umschalten.

## Einen Eintrag lesen

Jede Zeile enthält:

1. **Title** — der Name des Ereignisses ("EOD Pressure fired", "Trap Detection bearish", "Gamma flip crossed").
2. **Subtitle** — den wichtigsten Kontext (Symbol, Score, Level).
3. **Time** — relativ ("4m ago") und absolut beim Hovern.
4. **Action** — klicke auf "Open", um zur betreffenden Signal- oder Metrikseite zu springen.

Bei Triggern zeigen die Zeilen zusätzlich den **auslösenden Score** und den **Trigger-Schwellenwert**, sodass du erkennen kannst, ob es sich um einen Grenzfall oder ein starkes Ereignis gehandelt hat.

## Filtern

Über die Filterleiste kannst du den Feed eingrenzen nach:

- **Symbol** — SPY, SPX, QQQ (standardmäßig das Symbol, das du gerade aktiv hast)
- **Signal family** — Advanced, Basic, Regime, Flow, Schedule
- **Direction** — bullish, bearish, neutral
- **Time window** — letzte Stunde, heute, letzte 24h, letzte 5 Handelstage

Filter lassen sich kombinieren. Du kannst symbol = SPX mit signal family = Advanced und direction = bearish kombinieren, um nur Advanced-bearish-Trigger auf SPX anzuzeigen.

## Wann das Bulletin am nützlichsten ist

- **Am Morgen** — scrolle über die letzten Sessions zurück, um zu sehen, was über Nacht und im Pre-Market ausgelöst hat.
- **Rund um wichtige Levels** — wenn sich der Preis dem Gamma Flip, der Call Wall oder der Put Wall nähert, ist mit weiteren Ereignissen zu rechnen.
- **In der letzten Handelsstunde** — das EOD-Pressure-Signal liefert ab 14:30 ET oft verwertbare Signale.
- **Als Journaling-Werkzeug** — jedes ausgelöste Signal wird protokolliert, sodass das Bulletin das Audit-Log deines Handelstags ist.

## Was es nicht ist

Das Live Bulletin ist **kein Handelssignal-Feed**. Die Einträge sind Ereignisse, die deine Aufmerksamkeit verdienen; ob sie zu Trades werden, hängt von deiner Strategie ab. Das Composite-Score-Panel kommt einer Aussage über "was bedeutet das für die Richtung" am nächsten, und selbst das ist ein Filter, keine Prognose.

## Sichtbarkeit nach Stufe

- Die Basic-Stufe sieht Basic-Signalereignisse, Regime Events, Wall Events und Flow Notables.
- Die Pro-Stufe sieht zusätzlich Advanced-Signal-Trigger.

Gesperrte Einträge (für Upgrade-Hinweise) zeigen einen Schloss-Chip an, statt zu verschwinden.

## Der Admin-Spiegel

Es gibt eine wasserzeichenfreie Admin-Version des Bulletins, die für Screenshots und Demos verwendet wird. Das ist ein rein interner Pfad.

## Siehe auch

- [Wie Signale End-to-End funktionieren](/help/platform/signals-overview)
- [Composite Score](/help/platform/composite-score)
- [Signal Alerts](/help/platform/alerts)
