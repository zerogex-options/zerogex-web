# Signalalarme

*Wie Signal-Trigger innerhalb der Plattform sichtbar werden, was auslöst und was still bleibt, und wie du das Live Bulletin als Alarmprotokoll nutzt.*

---

## Wo Alarme angezeigt werden

ZeroGEX liefert Alarme **in der App**, nicht per SMS oder Push-Benachrichtigung. Es gibt drei Stellen, an denen sie auftauchen:

1. **Live Bulletin** — jeder Trigger landet hier mit vollständigem Kontext. Dies ist dein Prüfprotokoll.
2. **Die Signalkarte** — im Dashboard oder auf der Signalliste-Seite leuchtet die Karte bei einem Trigger auf und wird in Richtung des Scores eingefärbt.
3. **Das Composite-Panel** — wenn ein Trigger eine ausreichend hohe Überzeugung hat, verschiebt er das Composite sichtbar.

Das ist Absicht. ZeroGEX ist darauf ausgelegt, **beobachtet, nicht unterbrochen** zu werden. Push-artige Alarme führen zu Overtrading; das In-App-Protokoll lässt dich scannen, wann du es möchtest.

## Was auslöst

Es lösen nur Advanced-Signal-Trigger und strukturelle Ereignisse aus:

- Die acht Advanced-Signale, wenn ihre Trigger-Schwellenwerte überschritten werden.
- Gamma-Flip-Kreuzungen.
- Regimewechsel (positives ↔ negatives Gamma am Spot).
- Wall-Migrationen von mehr als 0,5 % gegenüber dem vorherigen Level.
- Bemerkenswerte Flow-Ereignisse (Block-Prints, Sweep-Cluster, Smart-Money-Bewegungen).

Basic-Signale lösen **nicht** aus. Sie sind fortlaufende Inputs für das Composite.

## Wie ein Trigger ankommt

Wenn ein Trigger auslöst:

1. Der Signal-Score wird bei der Kreuzung protokolliert.
2. Die Live-Bulletin-Zeile wird mit Zeitstempel, Richtung, Score, Schwellenwert und Kontext erstellt.
3. Die Signalkarte auf jeder Seite spiegelt den neuen Zustand wider.
4. Das Composite wird aktualisiert.

Bleibt ein Signal über mehrere Bars hinweg im Trigger-Zustand, wird im Bulletin nur das **erste** Trigger-Ereignis protokolliert. Nachfolgende Bars werden in den bestehenden Eintrag aggregiert.

## Referenz der Trigger-Schwellenwerte

| Signal | Schwellenwert |
| --- | --- |
| EOD Pressure | abs(score) ≥ 0.20 |
| Gamma/VWAP Confluence | abs(score) ≥ 0.20 |
| Market Pressure Index | loading ≥ 50 AND \|direction\| ≥ 0.20 |
| Range Break Imminence | imminence ≥ 65 |
| Squeeze Setup | abs(score) ≥ 0.25 |
| Trap Detection | abs(score) ≥ 0.25 |
| Volatility Expansion | abs(score) ≥ 0.25 |
| 0DTE Position Imbalance | abs(score) ≥ 0.25 |

## Warum manche Signale nicht auslösen

Ein Signal kann bei +0.7 stehen und **trotzdem nicht** auslösen. Gründe:

- Der Trigger-Schwellenwert des Signals nutzt ein Composite (Market Pressure benötigt zusätzlich loading ≥ 50).
- Das Signal ist an ein Sitzungsfenster gebunden (EOD Pressure ist nur von 14:30–15:45 ET aktiv).
- Das Signal hat ein Debounce — es muss den Schwellenwert für eine Mindestanzahl von Bars halten.

Die Signalkarte auf der Seite erklärt den aktuellen Trigger-Zustand in einfacher Sprache.

## Das Bulletin als Alarmprotokoll nutzen

Das Live Bulletin ist das **maßgebliche System** für Trigger. Warst du in der Mittagspause, öffnest du nicht jede Seite einzeln, um zu sehen, was ausgelöst hat — du öffnest das Bulletin, filterst nach Symbol und Signalfamilie und liest die Ereignisse des Tages in chronologischer Reihenfolge.

## Was noch kommt

Aktuell senden wir keine Alarme per E-Mail, SMS, Push-Benachrichtigung oder Webhook. Wenn die Nachfrage es rechtfertigt, können diese Kanäle hinzugefügt werden — schreib an [support@zerogex.io](mailto:support@zerogex.io), um dafür zu stimmen.

## Siehe auch

- [Das Live Bulletin nutzen](/help/platform/live-bulletin)
- [Wie Signale End-to-End funktionieren](/help/platform/signals-overview)
- [E-Mail-Einstellungen](/help/platform/email-preferences)
