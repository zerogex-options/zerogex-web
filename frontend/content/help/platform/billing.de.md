# Abrechnung & Stripe-Portal

*Wie die Abrechnung über Stripe funktioniert, der Unterschied zwischen monatlich und jährlich, Tarifwechsel, Zahlungsmethoden und Rechnungen.*

---

## Wie die Abrechnung funktioniert

ZeroGEX rechnet über **Stripe** ab. Wir sehen oder speichern keine Zahlungskartendaten — das übernimmt vollständig Stripe. Jede Abrechnungsaktion erfolgt im von Stripe gehosteten Abrechnungsportal, das du über deine [Account](/account)-Seite erreichst.

## Tarife und Zahlungsrhythmen

Zwei Stufen — **Basic** und **Pro** — jeweils verfügbar mit **monatlicher** oder **jährlicher** Abrechnung.

- Die jährliche Abrechnung wird gegenüber der monatlichen vergünstigt angeboten. Den genauen Satz findest du auf der [Pricing](/pricing)-Seite.
- Der Wechsel zwischen den Zahlungsrhythmen wird über das Portal unterstützt.

## Kostenlose Testphase

Wenn du einen kostenpflichtigen Plan startest, erhältst du eine kostenlose Testphase (die Dauer wird auf der Pricing-Seite angezeigt). Am Ende der Testphase läuft das Abonnement automatisch zu dem Satz weiter, zu dem du dich angemeldet hast — ohne einen zweiten Bestätigungsschritt.

Um diese automatische Verlängerung zu verhindern: kündige im Portal, bevor die Testphase endet. Du behältst den Zugang bis zum Ende der Testphase.

## So verwaltest du dein Abonnement

1. Öffne [Account](/account).
2. Klicke auf "Manage subscription" — dies öffnet das Stripe-Portal in einem neuen Tab.
3. Im Portal kannst du:
   - Die Stufe wechseln (Basic ↔ Pro)
   - Den Zahlungsrhythmus wechseln (monatlich ↔ jährlich)
   - Die Zahlungsmethode aktualisieren
   - Rechnungen einsehen und herunterladen
   - Das Abonnement kündigen

## Upgrades und Downgrades

- **Upgrade (Basic → Pro)** — es wird eine anteilige Berechnung (Proration) angewendet. Der Zugang zur Stufe wird sofort aktualisiert; die anteilige Differenz (eine Gutschrift für nicht genutzte Zeit plus die Gebühr der neuen Stufe) erscheint auf deiner **nächsten Rechnung**, statt sofort abgebucht zu werden.
- **Downgrade (Pro → Basic)** — die Änderung tritt am Ende des aktuellen Abrechnungszeitraums in Kraft. Bis dahin behältst du die Pro-Funktionen.
- **Wechsel des Zahlungsrhythmus** — monatlich → jährlich wird sofort wirksam (mit anteiliger Berechnung auf deiner nächsten Rechnung); jährlich → monatlich tritt am Ende des aktuellen Zeitraums in Kraft, wie bei einem Downgrade.

## Kündigung

- Die Kündigung wird zum **Ende des aktuellen Abrechnungszeitraums** wirksam. Bis dahin behältst du den kostenpflichtigen Zugang.
- Nach Ablauf des Zeitraums fällt deine Stufe auf Public zurück. Dein Konto wird nicht gelöscht; dein Fortschritt in der Ausbildung, deine Empfehlungsdaten und gespeicherten Einstellungen bleiben erhalten.
- Du kannst jederzeit erneut abonnieren.

## Zahlungsmethoden

Stripe unterstützt Karten, Apple Pay, Google Pay und (in den meisten Regionen) Banküberweisungen. Verwalte alle im Portal.

## Rechnungen und Belege

Jede Abbuchung erzeugt eine Stripe-Rechnung. Das Portal listet alle bisherigen Rechnungen mit PDF-Download-Links auf. Belege werden zudem automatisch per E-Mail versendet.

## Fehlgeschlagene Zahlungen

Wenn eine Abbuchung fehlschlägt, versucht Stripe es automatisch über mehrere Tage hinweg erneut. Während dieses Wiederholungszeitraums befindet sich dein Abonnement im Status "past due" — kostenpflichtige Funktionen bleiben vorübergehend verfügbar. Schlagen alle Versuche fehl, wird das Abonnement gekündigt und die Stufe fällt zurück.

Die häufigsten Fehlerursachen: abgelaufene Karte, Nichtübereinstimmung bei der Adressprüfung, regionale Einschränkungen. Aktualisiere die Zahlungsmethode im Portal, um das Problem zu beheben.

## Rückerstattungen

Unsere [Pricing](/pricing)-Seite dokumentiert die Rückerstattungs- und Kündigungsrichtlinie. Kurz gesagt: Abonnements werden im Voraus abgerechnet und bei einer Kündigung nicht anteilig erstattet, aber die Testphase ist bedingungslos — kündige, bevor sie endet, und dir wird nie etwas berechnet.

Für Ausnahmen schreibe eine E-Mail an [support@zerogex.io](mailto:support@zerogex.io).

## Wechsel von monatlich zu jährlich

Die meisten Nutzer entscheiden sich um den dritten Monat herum dafür — die Rechnung geht zu deinen Gunsten auf. Das Portal übernimmt den Wechsel: Er wird sofort wirksam, und die anteilige Berechnung (eine Gutschrift für den ungenutzten Teil des aktuellen Monats plus die jährliche Gebühr) erscheint auf deiner nächsten Rechnung. Befindest du dich noch in der kostenlosen Testphase, bleibt die Testphase beim Wechsel erhalten — dir wird erst nach deren Ende etwas berechnet, und dann zum jährlichen Satz.

## Promo- und Gutscheincodes

Promo-Gutscheine werden an der Kasse angewendet. Ist eine Aktion aktiv, zeigt die Pricing-Seite den Satz nach Gutschein an; andernfalls den regulären Preis.

Der **Founding-Member-Satz** ist ein separater, nur auf Einladung zugänglicher Weg — siehe die [/founding](/founding)-Seite, falls du über den Zugangscode verfügst.

## Siehe auch

- [Account Settings](/help/platform/account)
- [Tiers, Access & What Unlocks Where](/help/platform/tiers-and-access)
- [Pricing](/pricing)
