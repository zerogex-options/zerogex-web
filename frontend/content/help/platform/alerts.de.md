# Signalalarme

*Wie Signal-Trigger innerhalb der Plattform sichtbar werden, was auslöst und was still bleibt, und wie du nachsiehst, was ausgelöst hat.*

---

## Wo Alarme angezeigt werden

ZeroGEX zeigt Signal-Trigger **in der App** an, nicht per E-Mail, SMS oder Push-Benachrichtigung. Es gibt zwei Stellen, an denen sie auftauchen:

1. **Die Signalkarte** - im Advanced Signal Dashboard (Pro) wird die Karte bei einem Trigger umrandet, in Richtung des Scores eingefärbt, und ihr Status wechselt von *Stand by* zu *Triggered*.
2. **Die Event Timeline** - im Tab Event Timelines des Dashboards und unten auf jeder Signalseite: der jüngste Verlauf des Scores, mit markierten Richtungswechseln.

Trigger landen nicht im Live-Bulletin - das ist eine teilbare Karte des aktuellen Dealer-Gamma-Snapshots - und sie bewegen den Composite Score nicht.

Das ist Absicht. ZeroGEX ist darauf ausgelegt, **beobachtet, nicht unterbrochen** zu werden. Push-artige Alarme führen zu Overtrading; die Ansichten in der App lassen dich scannen, wann du es möchtest.

## Was auslöst

Es lösen nur die acht Advanced-Signale aus, jeweils wenn ihr Trigger-Schwellenwert überschritten wird (siehe Tabelle unten).

Basic-Signale lösen **nicht** aus. Sie sind fortlaufende, beratende Lesarten und haben kein Gewicht im Composite Score. Ihre Karten werden ab ±25 umrandet und als *Triggered* markiert, doch das hebt nur eine starke Lesart hervor.

Auch strukturelle Veränderungen - der Kurs kreuzt den Gamma-Flip, eine Wall verschiebt sich - sind keine Alarme. Die liest du im Gamma Chart und auf den Kennzahlen-Seiten ab.

## Wie ein Trigger ankommt

Wenn ein Trigger auslöst:

1. Die Signal-Engine markiert das Signal in dem Zyklus als ausgelöst, in dem sein Score den Schwellenwert überschreitet.
2. Die Karte im Advanced Signal Dashboard wechselt zu *Triggered* und nimmt die Farbe der Richtung an. Die Seite prüft alle paar Sekunden auf neue Werte, du musst also nicht neu laden.
3. Der Composite Score bleibt davon unberührt.

Eine Karte bleibt *Triggered*, solange der Score jenseits des Schwellenwerts bleibt, und kehrt zu *Stand by* zurück, sobald er wieder darunter fällt. Eine eigene Liste der Trigger-Ereignisse gibt es nicht - die Event Timeline ist die Aufzeichnung.

## Referenz der Trigger-Schwellenwerte

| Signal | Schwellenwert |
| --- | --- |
| EOD Pressure | \|score\| ≥ 20 |
| Gamma/VWAP Confluence | \|score\| ≥ 20 |
| Market Pressure Index | loading ≥ 50 AND \|direction\| ≥ 0.20 |
| Range Break Imminence | imminence ≥ 65 |
| Squeeze Setup | \|score\| ≥ 25 |
| Trap Detection | \|score\| ≥ 25 |
| Volatility Expansion | \|score\| ≥ 25 |
| 0DTE Position Imbalance | \|score\| ≥ 25 |

Scores laufen von -100 bis +100. Siehe [Die Score-Linie von -100 bis +100 lesen](/help/platform/score-line).

## Warum manche Signale nicht auslösen

Ein Signal kann einen beachtlichen Score zeigen und trotzdem nicht auslösen, oder bei 0 stehen, wenn du eine Aussage erwartest. Gründe:

- Sein Trigger hängt nicht allein am Score: Market Pressure Index braucht zusätzlich loading ≥ 50 und eine klare Richtung, und Range Break Imminence löst bei imminence ≥ 65 aus.
- Es ist an ein Sitzungsfenster gebunden: EOD Pressure läuft nur von 14:30 bis 16:00 ET und wird außerhalb davon auf 0 gesetzt, und 0DTE Position Imbalance zeigt *Inactive*, solange sein Fenster geschlossen ist.

Die Karte zeigt ihren aktuellen Zustand: *Triggered*, *Stand by* oder *Inactive* mit dem Grund.

## Nachsehen, was ausgelöst hat

Ein Trigger-Protokoll gibt es nicht. Um zu sehen, was ein Signal getan hat, während du weg warst, öffne den Tab **Event Timelines** im Advanced Signal Dashboard oder die Event Timeline unten auf der Seite des Signals. Sie zeigt den Score über die letzten zwei Sessions mit markierten Richtungswechseln, daneben, wie weit sich der Basiswert in den folgenden 30, 60 oder 120 Minuten bewegt hat, und du kannst von 30 Minuten bis zum gesamten Zeitraum zoomen.

Für einen bewerteten Rückblick auf eine ganze Session zeigt die öffentliche Scorecard **Signale - ein Tag** (unter Belege in der Seitenleiste), welche Signale gedreht haben, wie viele dieser Richtungswechsel bewertet werden konnten und wie sie ausgegangen sind.

## Ausgehende Alarme

Signal-Trigger werden **ausschließlich in der App** angezeigt - auf den Signalkarten und in den Event Timelines. Sie werden nicht per E-Mail, SMS, Push-Benachrichtigung oder Webhook versendet.

Die Kanal-Schalter unter [Konto → Benachrichtigungen](/account/notifications) gehören zu **TradeWorkz™ Bot-Trading** (Pro, Beta), nicht zu den Signal-Triggern: Sie betreffen Einstiegs- und Ausstiegsbenachrichtigungen von Bots, denen du folgst. In der App (die Glocke auf der Bot-Trading-Seite) und per E-Mail werden sie heute zugestellt; der Webhook-Kanal speichert deine Einstellung, stellt aber noch nichts zu - bau also nicht darauf auf. Für Automatisierung auf Basis der Signale fragst du heute besser die [API](/help/platform/api-access) (Pro) ab, statt auf einen Push zu warten, der nicht kommt.

Die ausgehende Zustellung steht auf der Liste, ist aber nicht ausgeliefert. Wenn sie ändern würde, wie du handelst, schreib an [support@zerogex.io](mailto:support@zerogex.io) und nenne Kanal und Signale - konkrete Angaben bringen das Thema nach vorn.

## Siehe auch

- [Wie Signale End-to-End funktionieren](/help/platform/signals-overview)
- [Advanced Signal Dashboard](/help/platform/advanced-signals-dashboard)
- [E-Mail-Einstellungen](/help/platform/email-preferences)
