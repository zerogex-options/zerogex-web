# Fehlerbehebung

*Die Kurzfassung - Anmeldeprobleme, fehlende Daten, veraltete Charts, Zahlungsprobleme, Browser-Caches und wann Sie den Support kontaktieren sollten.*

---

## Anmeldung nicht möglich

**Sie haben Ihr Passwort vergessen.** Nutzen Sie [Passwort vergessen](/forgot-password). Ein Link zum Zurücksetzen wird per E-Mail versendet; klicken Sie darauf und legen Sie ein neues Passwort fest. Der Link funktioniert einmal und läuft nach 30 Minuten ab. Falls die E-Mail nicht ankommt, prüfen Sie den Spam-Ordner.

**Sie haben sich mit Google oder Apple angemeldet und haben kein Passwort.** Melden Sie sich mit dem Anbieter an, den Sie verwendet haben. Auf der Kontoseite können Sie danach ein Passwort als zukünftige Alternative festlegen.

**Sie sind angemeldet, aber Ihr Plan fehlt.** Wahrscheinlich haben Sie sich mit einer anderen E-Mail-Adresse angemeldet als der Ihres Abonnements - zum Beispiel mit einem anderen Google-Konto -, wodurch ein separates Konto entsteht. Melden Sie sich ab und mit der ursprünglichen E-Mail-Adresse wieder an, oder schreiben Sie an [support@zerogex.io](mailto:support@zerogex.io) - wir können das Konto nachschlagen.

**Eine Bestätigungsabfrage von Google oder Apple verschwindet nicht.** Diese Abfrage stammt vom Anbieter - ZeroGEX hat keinen eigenen Zwei-Faktor-Schritt. Melden Sie sich neu über ein Inkognito-Fenster an. Falls das Problem weiterhin besteht, schreiben Sie an den Support.

## Fehlende oder veraltete Daten

**Das Session-Badge zeigt „Geschlossen".** Das ist die Erklärung - die Märkte sind geschlossen. Es werden die zuletzt berechneten Werte angezeigt.

**Ein Panel ist leer oder zeigt null.** Meist liegt das am Session-Fenster: EOD Pressure ist nur von 14:30 Uhr ET bis zum Handelsschluss aktiv, 0DTE Position Imbalance nur während der regulären Sitzung. Beide Seiten weisen auf dem Bildschirm darauf hin, solange sie inaktiv sind.

**Werte wirken eingefroren.** Fahren Sie mit der Maus über den Kurs in der Kopfzeile, um zu sehen, wann der letzte Kurs eintraf, oder prüfen Sie die Angabe „Zuletzt aktualisiert" unten auf dem Haupt-Dashboard. Ist sie während der regulären Handelszeiten älter als ein paar Minuten, laden Sie die Seite mit einem harten Reload neu (Cmd+Shift+R / Ctrl+Shift+R). Die Kennzahlen zur Dealer-Positionierung werden etwa einmal pro Minute neu berechnet - kurze Pausen zwischen Änderungen sind also normal.

**Der Signal-Score zeigt 0.** Das bedeutet meist „keine Ablesung", nicht „neutral". Siehe [Die Score-Linie von -100 bis +100 lesen](/help/platform/score-line).

## Zahlungen

**Die Karte wurde abgelehnt.** Aktualisieren Sie die Zahlungsmethode im Stripe-Abrechnungsportal (verlinkt von Ihrer [Konto](/account)-Seite). Die häufigsten Ablehnungsgründe sind abgelaufene Karten, nicht übereinstimmende Adressen oder regionale Beschränkungen.

**Das Abonnement zeigt „überfällig".** Stripe versucht, die Belastung erneut durchzuführen. Aktualisieren Sie die Zahlungsmethode oder bezahlen Sie die offene Rechnung über **Abrechnungsportal öffnen** auf Ihrer Kontoseite, um das zu beheben. Kostenpflichtige Funktionen bleiben für eine kurze Kulanzfrist aktiv, während Stripe es erneut versucht.

**Die Rechnung ist höher als erwartet.** Öffnen Sie die Rechnung im Portal - die Posten sind detailliert aufgeführt. Häufige Überraschungen: Ein Upgrade während des Abrechnungszeitraums wird anteilig berechnet - Sie erhalten eine Gutschrift für den ungenutzten Teil der aktuellen Periode zuzüglich der Gebühr für den neuen Plan, angewendet auf Ihre **nächste Rechnung** statt sofort belastet zu werden. Wer die kostenlose Testphase von Basic für Pro oder einen längeren Abrechnungszeitraum verlässt, zahlt den neuen Plan noch am selben Tag.

**Die Kündigung wurde nicht wirksam.** Die Kündigung wird zum Ende des Abrechnungszeitraums wirksam. Bis dahin behalten Sie den kostenpflichtigen Zugang. Das Portal und Ihre Kontoseite zeigen das geplante Enddatum an.

## Stufe und Zugang

**Eine Seite führt Sie zu Pricing oder zu einem Freischalt-Bildschirm, statt sich zu öffnen.** Diese Seite erfordert eine Stufe, die Sie derzeit nicht haben. Der Freischalt-Bildschirm nennt den Plan, der sie enthält, und [Pricing](/pricing) zeigt die vollständige Übersicht.

**Sie haben ein Upgrade durchgeführt, aber eine Seite ist noch gesperrt.** Führen Sie einen harten Reload durch, um die Sitzung zu aktualisieren. Ist sie danach noch gesperrt, melden Sie sich ab und wieder an. Bleibt sie weiterhin gesperrt, schreiben Sie an den Support.

## Browser

**Die Seite ist leer.** Wahrscheinlich blockiert eine Browser-Erweiterung Skripte. Probieren Sie ein Inkognito-Fenster mit deaktivierten Erweiterungen. Funktioniert es dort, identifizieren Sie die Erweiterung, indem Sie sie einzeln deaktivieren.

**Charts werden mit unerwarteten Farben dargestellt.** Prüfen Sie das Paletten-Menü neben dem Sonne/Mond-Symbol in der Kopfzeile - eine andere Palette ändert die Farben aller Charts. Stimmt die Palette, wechseln Sie das Theme einmal (Sonne/Mond-Symbol); beim nächsten Neuladen wird korrekt gerendert.

**Anmelde-Cookies bleiben nicht erhalten.** Sie befinden sich möglicherweise in einem strikten Datenschutzmodus des Browsers (Brave Shields auf „Aggressiv", Safari mit „Website-übergreifendes Tracking verhindern", bestimmte Firefox-Container). Setzen Sie `zerogex.io` auf die Cookie-Zulassungsliste, oder melden Sie sich bei jeder Sitzung neu an.

## Charts

**Ein Chart ist leer, während andere Daten anzeigen.** Die häufigste Ursache ist eine Stufensperre - der Chart gehört zu einer Stufe, die Sie nicht haben, und Pro-Panels zeigen an seiner Stelle einen Upgrade-Hinweis. Manchmal ist das zugrunde liegende Signal auch absichtlich inaktiv (sein Zeitfenster ist nicht geöffnet).

**Hover-Tooltips werden nicht angezeigt.** Ein Touch-Gerät. Tippen Sie auf den Chart oder drücken Sie lange darauf, oder wechseln Sie zu einem Desktop.

## Mobil

**Das Layout wirkt beengt.** ZeroGEX ist für den Desktop konzipiert. Das mobile Layout eignet sich für die Beobachtung; komplexe Seiten mit mehreren Charts setzen mehr horizontalen Platz voraus.

**Die Seite scrollt nicht, solange Ihr Finger auf einem Chart liegt.** Wischen Sie nach oben oder unten - Charts erfassen nur seitliches Ziehen (zum Verschieben entlang der Zeitachse), ein vertikales Wischen scrollt also die Seite.

## Wann Sie den Support per E-Mail kontaktieren sollten

Nachdem Sie die relevanten oben genannten Punkte ausprobiert haben. Fügen Sie Folgendes bei:

- Die URL der Seite, auf der Sie sich befanden.
- Einen Screenshot, falls relevant.
- Browser, Betriebssystem und ungefähr, wann es passiert ist (mit Zeitzone).
- Ihre Konto-E-Mail-Adresse.

Schreiben Sie an [support@zerogex.io](mailto:support@zerogex.io). Wir antworten schnell - meist noch am selben Handelstag.

## Siehe auch

- [Streaming & Leistung](/help/platform/streaming-and-performance)
- [Kontoeinstellungen](/help/platform/account)
- [Abrechnung & Stripe-Portal](/help/platform/billing)
- [FAQs](/help/faqs)
