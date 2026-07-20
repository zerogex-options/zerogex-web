# Fehlerbehebung

*Die Kurzfassung — Anmeldeprobleme, fehlende Daten, veraltete Charts, Zahlungsprobleme, Browser-Caches und wann Sie den Support kontaktieren sollten.*

---

## Anmeldung nicht möglich

**Sie haben Ihr Passwort vergessen.** Nutzen Sie [Passwort vergessen](/forgot-password). Ein Link zum Zurücksetzen wird per E-Mail versendet; klicken Sie darauf und legen Sie ein neues Passwort fest. Falls die E-Mail nicht ankommt, prüfen Sie den Spam-Ordner.

**Sie haben sich mit Google oder Apple angemeldet und haben kein Passwort.** Melden Sie sich mit dem Anbieter an, den Sie verwendet haben. Auf der Kontoseite können Sie danach ein Passwort als zukünftige Alternative festlegen.

**Der Anbieter meldet „Kein Konto gefunden".** Möglicherweise haben Sie sich mit einer anderen E-Mail-Adresse registriert. Versuchen Sie den anderen Anbieter oder schreiben Sie an [support@zerogex.io](mailto:support@zerogex.io) — wir können das Konto nachschlagen.

**Die Zwei-Faktor- oder Geräteabfrage verschwindet nicht.** Melden Sie sich neu über ein Inkognito-Fenster an. Falls das Problem weiterhin besteht, kann der Support veraltete Sitzungen auf Ihrem Konto löschen.

## Fehlende oder veraltete Daten

**Das Session-Badge zeigt „Geschlossen".** Das ist die Erklärung — die Märkte sind geschlossen. Es werden die zuletzt berechneten Werte angezeigt.

**Ein Chart zeigt „Keine Daten".** Meist liegt das an einem Session-Fenster-Problem (EOD Pressure außerhalb ihres Zeitfensters, 0DTE an einem Tag ohne Verfall). Fahren Sie mit der Maus über den Leerzustand — der Tooltip erklärt den Grund.

**Kachelwerte wirken eingefroren.** Prüfen Sie den Zeitstempel auf der Preis-Kachel. Wenn er während der regulären Handelszeiten älter als 30 Sekunden ist, laden Sie die Seite mit einem harten Reload neu (Cmd+Shift+R / Ctrl+Shift+R).

**Der Signal-Score zeigt 0.** Das bedeutet meist „keine Ablesung", nicht „neutral". Siehe [Die [-1, +1]-Score-Line lesen](/help/platform/score-line).

## Zahlungen

**Die Karte wurde abgelehnt.** Aktualisieren Sie die Zahlungsmethode im Stripe-Abrechnungsportal (verlinkt von Ihrer [Konto](/account)-Seite). Die häufigsten Ablehnungsgründe sind abgelaufene Karten, nicht übereinstimmende Adressen oder regionale Beschränkungen.

**Das Abonnement zeigt „überfällig".** Stripe versucht, die Belastung erneut durchzuführen. Aktualisieren Sie die Zahlungsmethode, um das zu beheben. Kostenpflichtige Funktionen bleiben während des Wiederholungszeitraums aktiv.

**Die Rechnung ist höher als erwartet.** Öffnen Sie die Rechnung im Portal — die Posten sind detailliert aufgeführt. Häufige Überraschungen: Ein Wechsel des Plans oder des Abrechnungszyklus wird anteilig berechnet — Sie erhalten eine Gutschrift für den ungenutzten Teil der aktuellen Periode zuzüglich der Gebühr für den neuen Plan, angewendet auf Ihre **nächste Rechnung** statt sofort belastet zu werden.

**Die Kündigung wurde nicht wirksam.** Die Kündigung wird zum Ende des Abrechnungszeitraums wirksam. Bis dahin behalten Sie den kostenpflichtigen Zugang. Das Portal zeigt das geplante Enddatum an.

## Stufe und Zugang

**Eine Seite leitet zu /pricing um, statt sich zu öffnen.** Diese Seite erfordert eine Stufe, die Sie derzeit nicht haben. [Pricing](/pricing) zeigt, was sie freischaltet.

**Sie haben ein Upgrade durchgeführt, aber eine Seite ist noch gesperrt.** Führen Sie einen harten Reload durch, um die Sitzung zu aktualisieren. Ist sie danach noch gesperrt, melden Sie sich ab und wieder an. Bleibt sie weiterhin gesperrt, schreiben Sie an den Support.

## Browser

**Die Seite ist leer.** Wahrscheinlich blockiert eine Browser-Erweiterung Skripte. Probieren Sie ein Inkognito-Fenster mit deaktivierten Erweiterungen. Funktioniert es dort, identifizieren Sie die Erweiterung, indem Sie sie einzeln deaktivieren.

**Charts werden mit seltsamen Farben dargestellt.** Ein Theme-Cache-Konflikt. Wechseln Sie das Theme einmal (Sonne/Mond-Symbol). Beim nächsten Neuladen wird korrekt gerendert.

**Anmelde-Cookies bleiben nicht erhalten.** Sie befinden sich möglicherweise in einem strikten Datenschutzmodus des Browsers (Brave Shields auf „Aggressiv", Safari mit „Website-übergreifendes Tracking verhindern", bestimmte Firefox-Container). Setzen Sie `zerogex.io` auf die Cookie-Zulassungsliste, oder melden Sie sich bei jeder Sitzung neu an.

## Charts

**Ein Chart ist leer, während andere Daten anzeigen.** Die häufigste Ursache ist eine Stufensperre — der Chart gehört zu einer Stufe, die Sie nicht haben. Manchmal ist das zugrunde liegende Signal auch absichtlich inaktiv (sein Zeitfenster ist nicht geöffnet). Fahren Sie mit der Maus über den Leerzustand für die Erklärung.

**Hover-Tooltips werden nicht angezeigt.** Ein Touch-Gerät. Nutzen Sie langes Drücken oder wechseln Sie zu einem Desktop.

## Mobil

**Das Layout wirkt beengt.** ZeroGEX ist für den Desktop konzipiert. Das mobile Layout eignet sich für die Beobachtung; komplexe Seiten mit mehreren Charts setzen mehr horizontalen Platz voraus.

**Das Scrollen blockiert während des Ziehens eines Charts.** Tippen Sie zunächst außerhalb des Chart-Bereichs, dann scrollen Sie. Charts erfassen absichtlich horizontales Ziehen für Zoom/Pan.

## Wann Sie den Support per E-Mail kontaktieren sollten

Nachdem Sie die relevanten oben genannten Punkte ausprobiert haben. Fügen Sie Folgendes bei:

- Die URL der Seite, auf der Sie sich befanden.
- Einen Screenshot, falls relevant.
- Browser, Betriebssystem und ungefähr, wann es passiert ist (mit Zeitzone).
- Ihre Konto-E-Mail-Adresse.

Schreiben Sie an [support@zerogex.io](mailto:support@zerogex.io). Wir antworten schnell — meist noch am selben Handelstag.

## Siehe auch

- [Streaming & Leistung](/help/platform/streaming-and-performance)
- [Kontoeinstellungen](/help/platform/account)
- [Abrechnung & Stripe-Portal](/help/platform/billing)
- [FAQs](/help/faqs)
