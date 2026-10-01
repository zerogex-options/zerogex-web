# Kontoeinstellungen

*E-Mail, Passwort, verknüpfte Anmeldeanbieter (Google/Apple), Tier und Planstatus - und wie du sie sicher verwaltest.*

---

## Was die Kontoseite macht

Die Seite [Konto](/account) ist die zentrale Anlaufstelle für alles auf Nutzerebene - deine E-Mail, dein Abonnement, deine Anmeldemethoden, Benachrichtigungen, das Referral-Panel und die Kontolöschung.

## Der Header

Zeigt deine E-Mail und dein Tier (Public, Basic, Pro oder Admin). Unterhalb von Pro führt dich ein Button **Upgrade** neben deinem Tier zu [Pricing](/pricing). Ist deine E-Mail noch nicht verifiziert, weist ein Banner oben auf der Seite darauf hin.

## E-Mail und Verifizierung

- Die E-Mail-Adresse, mit der du dich registriert hast, ist deine Konto-ID. Sie kann nur über den Support geändert werden.
- Neue Konten müssen die E-Mail verifizieren - ein Bestätigungslink wird bei der Registrierung versendet und läuft nach 24 Stunden ab. Bis zur Verifizierung kannst du keine Testphase starten und kein Abonnement abschließen.
- Falls du die ursprüngliche Nachricht nicht erhalten hast, klicke im Verifizierungs-Banner oben auf der Kontoseite auf **Resend**.

## Passwort

- Lege ein Passwort fest, wenn du dich mit Google oder Apple registriert hast und eine Rückfalloption möchtest. Unter Anmeldemethoden erscheint der Button **Passwort festlegen** bei Konten ohne Passwort.
- Um ein bestehendes Passwort zu ändern, klicke auf **Passwort zurücksetzen** - wir schicken dir per E-Mail einen Link, mit dem du ein neues festlegst.
- Die Mindestlänge beträgt 12 Zeichen.
- Nutze einen Passwort-Manager. Wir setzen keine Komplexitätsregeln durch - Länge und Einzigartigkeit sind wichtiger als die Zeichenvielfalt.

## Verknüpfte Anmeldeanbieter

Du kannst **Google** und **Apple** mit demselben Konto verknüpfen. Der Bereich Anmeldemethoden zeigt, welche Anbieter verbunden sind. Steht bei Apple „Demnächst", ist die Anmeldung mit Apple noch nicht freigeschaltet.

- **Neuen Anbieter verknüpfen** - klicke daneben auf **Verbinden** oder melde dich einmal mit dem Anbieter an; das System verknüpft automatisch mit deinem bestehenden Konto, wenn die E-Mail übereinstimmt.
- **Anbieter trennen** - klicke auf **Trennen**. Das ist nur möglich, wenn du mindestens eine weitere Anmeldemöglichkeit hast (ein anderer Anbieter ODER ein Passwort). Die Seite erzwingt dies, damit du dich nicht selbst aussperrst.

## Tier und Abonnement

- Dein aktuelles Tier wird oben auf der Seite angezeigt.
- **Abonnement verwalten** im Bereich Abonnement öffnet das von Stripe gehostete Billing-Portal. Plan-Wechsel, Zahlungsmethoden und Rechnungen laufen dort.
- Zum Kündigen nutze den Link **Abonnement kündigen** unter diesem Button. Bevor er kündigt, bietet er dir eventuell einen Rabatt, einen längeren Zahlungsrhythmus oder eine Pause von einem bis drei Monaten an, falls dir eine Unterbrechung reicht.
- Schlägt eine Zahlung fehl, weist der Bereich darauf hin, und der Button heißt **Abrechnungsportal öffnen** - dort kannst du die offene Rechnung mit einer beliebigen Karte bezahlen oder deine Zahlungsmethode aktualisieren.
- Innerhalb von 7 Tagen nach deiner ersten Zahlung für einen Plan mit 7-tägiger Geld-zurück-Garantie (Pro oder ein vierteljährlicher bzw. jährlicher Plan) klickst du auf der Kontoseite auf **Volle Erstattung anfordern**. Der Zugang endet, sobald die Erstattung ausgestellt ist; eine Erstattung pro Kunde.

Eine Schritt-für-Schritt-Anleitung findest du unter [Abrechnung & Stripe-Portal](/help/platform/billing).

## API-Zugang (Pro)

Mit Pro erstellst und widerrufst du im Bereich **API Access** persönliche API-Schlüssel. Fällt dein Plan unter Pro, werden die Schlüssel automatisch widerrufen. Siehe [API-Zugang & Schlüssel (Pro)](/help/platform/api-access).

## Benachrichtigungen

**Benachrichtigungen verwalten** öffnet eine Seite für die TradeWorkz™-Bots, denen du folgst - dort legst du fest, wie dich jeder einzelne erreicht: in der App, per E-Mail oder per Webhook.

## Social Media

Optional kannst du deinen **X-Handle (ehemals Twitter)** im Bereich Social Media hinterlegen, damit das ZeroGEX-Team dich dort erreichen kann. Das ist nie verpflichtend - du wirst bei der Registrierung nicht danach gefragt und kannst ihn jederzeit über dein Konto hinzufügen, ändern oder entfernen.

- Gib den Handle mit oder ohne führendes `@` ein - 1-15 Zeichen, nur Buchstaben, Zahlen und Unterstriche.
- Leere das Feld und speichere, um einen zuvor hinzugefügten Handle zu entfernen.

## Referral-Panel

Wenn das Referral-Programm läuft, zeigt der Bereich **Freund einladen**:

- Deinen Referral-Link mit einem Button **Link kopieren**
- **Registriert** - wie viele Personen sich über deinen Link registriert haben (fahre mit der Maus darüber, um ihre E-Mail-Adressen zu sehen)
- **Abonniert** - wie viele davon einen bezahlten Plan abgeschlossen haben (fahre mit der Maus darüber, um zu sehen, wer)
- **Erhaltene Gratismonate**
- **Angesparte Monate** - Gratismonate, die angewendet werden, sobald du das nächste Mal abonnierst (nur sichtbar, wenn du welche hast)
- Das Guthaben, das auf deine nächste Rechnung angerechnet wird, sofern vorhanden

Die Programmregeln findest du unter [Empfehlungen](/help/platform/referrals).

## Abmelden

Öffne das Profilmenü in der Kopfzeile und wähle **Abmelden** (auf dem Smartphone findest du **Abmelden** im Menü). Dadurch wird das Sitzungs-Cookie gelöscht. Melde dich unter [/login](/login) wieder an.

## Konto löschen

Scrolle auf der Kontoseite ganz nach unten zu **Delete account**, klicke auf **Delete my account**, tippe DELETE ein und klicke auf **Permanently delete account**. Die Löschung kündigt jedes aktive Abonnement sofort, meldet dich ab, widerruft alle API-Schlüssel und stoppt alle E-Mails von uns. Auf der Seite lässt sie sich nicht rückgängig machen - um danach wieder Zugang zu erhalten, schreibe an [support@zerogex.io](mailto:support@zerogex.io). Wie Kontodaten behandelt werden, erklärt unsere [Datenschutzrichtlinie](/privacy).

## Siehe auch

- [Abrechnung & Stripe-Portal](/help/platform/billing)
- [Empfehlungen](/help/platform/referrals)
- [E-Mail-Einstellungen](/help/platform/email-preferences)
