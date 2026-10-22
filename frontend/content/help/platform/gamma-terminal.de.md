# Das Gamma Terminal nutzen

*Ein Leitfaden zu jedem Panel, jedem Bedienelement und jedem Chart-Overlay im Gamma Terminal: was es zeigt, wie du es liest und was es dir nicht sagen kann.*

---

## Wozu das Gamma Terminal dient

Das [Gamma Terminal](/chart) bringt Kurs und modelliertes Dealer-Gamma auf einen Bildschirm. Die Kerzen zeigen, was der Kurs macht. Die Linien, Schattierungen und Panels darum herum zeigen, wo das Hedging der Options-Dealer laut Modell am stärksten ist und ob dieses Hedging Bewegungen gerade dämpft oder verstärkt.

Jede Gamma-Zahl auf der Seite ist eine Schätzung. Öffentliche Optionsdaten zeigen, wie viele Kontrakte an jedem Strike offen sind, aber nicht, wer sie hält. ZeroGEX wendet deshalb die übliche Konvention an, dass Dealer bei den Calls netto long und bei den Puts netto short sind. Lies die Levels als Kontext für deine eigenen Entscheidungen, nicht als gemessenes Orderbuch oder Kursziel. Die Seite [Methodik & Validierung](/methodology) erklärt das Modell.

Von oben nach unten enthält die Seite:

1. **Key Levels** - die sechs wichtigsten Zahlen, jeweils mit ihrem Abstand zum Kurs.
2. **About this terminal** - eine kurze Beschreibung, für Mitglieder eingeklappt.
3. **Beside the tape** - ein Umschalter für das Panel neben dem Chart: **Gamma Ladders** oder **Strike Panel**.
4. **Der Gamma Chart** - Kerzen mit eingezeichneten Gamma-Levels und Overlays, rechts daneben das von dir gewählte Panel (auf schmaleren Bildschirmen darunter).
5. **What you're looking at** - sechs Karten, die die wichtigsten Funktionen zusammenfassen.
6. **Playbook** - was das aktuelle Regime bedeutet, wenn sich der Kurs einer Wall nähert.

Basic- und Pro-Mitglieder sehen das Terminal live. Alle anderen sehen eine kostenlose Vorschau von SPY, die etwa 15 Minuten hinterherläuft; siehe [Kostenlose Vorschau vs. live](/help/platform/gamma-terminal#kostenlose-vorschau-vs-live).

## Deine ersten fünf Minuten

1. **Wähle einen Basiswert.** Nutze die Symbol-Buttons am Chart, das Dropdown der ersten Leiter oder die Pfeile in der Leiste Key Levels. Jede dieser Möglichkeiten stellt die ganze Seite um.
2. **Lies das Regime ab.** Die Box **Dealer Gamma @ Spot** oben rechts am Chart zeigt **LONG Γ** oder **SHORT Γ**. Bei Long Gamma stemmt sich das Hedging der Dealer laut Modell gegen Bewegungen (Pinning). Bei Short Gamma verstärkt es sie laut Modell (Trend). Der eingefärbte Chart-Hintergrund sagt dasselbe.
3. **Finde die wichtigsten Linien.** An der azurblauen Linie `FLIP` wechselt das Regime. Die rote `CALL WALL` über dem Kurs und die grüne `PUT WALL` darunter sind die Strikes mit dem meisten Call- bzw. Put-Gamma. Die Key-Levels-Karten nennen jeweils den genauen Abstand.
4. **Schau neben den Chart.** Die Leitern listen das Netto-Dealer-Gamma an jedem Strike nahe am Kurs auf, ausgerichtet am Chart. Die größten Werte sind die Strikes, an denen das meiste Hedging hängt.
5. **Ergänze, was du brauchst.** Schalte **Expected Range** für die Bewegung ein, die die implizite Volatilität einpreist, **Centroids**, um zu sehen, wo der Schwerpunkt des heutigen Optionshandels liegt, oder **PD/PM Levels** für Hoch, Tief und Schluss des Vortags.
6. Mit **Rewind** spielst du nach, wie sich Kurs und Gamma-Buch im Lauf der Sitzung bewegt haben.

## Die Leiste Key Levels

Die Leiste ganz oben zeigt die sechs Levels, die der Chart einzeichnet, für das Symbol und den Verfallsfilter des Charts.

- **Spot** - der aktuelle Kurs und seine Veränderung gegenüber dem vorherigen Schlusskurs.
- **Gamma Flip** - der Kurs, an dem das modellierte Netto-Dealer-Gamma das Vorzeichen wechselt.
- **Pin Strike** - der nahe gelegene Strike mit Verfall am selben Tag (0DTE), an den das Dealer-Gamma den Kurs laut Modell in den Schluss hinein am stärksten heranzieht, mit einem Label für die Stärke.
- **Call Wall** - der Strike auf oder über dem Kurs mit dem größten Call-Gamma.
- **Put Wall** - der Strike auf oder unter dem Kurs mit dem größten Put-Gamma.
- **Max Pain** - der Strike, an dem Optionsinhaber bei Verfall am wenigsten ausgezahlt bekämen.

Jede Karte zeigt das Level und seinen Abstand zum Kurs in Dollar und Prozent, mit einem grünen Pfeil, wenn das Level über dem Kurs liegt, und einem roten, wenn es darunter liegt. Fahre mit der Maus über eine Karte, um ihre vollständige Definition zu sehen. Die Kopfzeile nennt die Verfälle, aus denen die Levels stammen, und trägt einen Chip **LONG Γ** oder **SHORT Γ**.

Zeigt eine Karte einen Strich statt einer Zahl, sagt der Hinweis darunter, warum:

- **Unresolved this snapshot** - das Modell hat diesmal kein Level geliefert, meist weil die Optionskette dünn war. Fahre mit der Maus über das bernsteinfarbene **?**, um Details zu sehen. In der Regel ist es bei einer späteren Aktualisierung wieder da.
- **No flip in selected expiries** - die von dir gewählten Verfälle wechseln nie das Vorzeichen. Siehe [Der Expiry-Filter](/help/platform/gamma-terminal#der-expiry-filter).
- **No active pin** - kein nahe gelegener Strike mit Verfall am selben Tag kommt gerade als Pin infrage.

Mitglieder bekommen hier drei weitere Funktionen. Am Computer fährst du mit der Maus über die Leiste, um Pfeile einzublenden, mit denen du durch die Symbole blätterst; auf dem Smartphone wischst du darüber. Die ganze Seite zieht mit. Mit der Glocke auf den Karten Call Wall und Put Wall richtest du einen [Alarm](/help/platform/alerts) ein, der meldet, wenn der Kurs diese Wall erreicht. Und die Karte Pin Strike vermerkt, wie lange der aktuelle Pin schon hält, etwa "Held since 09:41".

## Gamma Ladders und Strike Panel

Das Panel neben dem Chart zeigt das Dealer-Gamma-Buch pro Strike auf eine von zwei Arten. Wähle eine mit dem Umschalter **Gamma Ladders** / **Strike Panel** über dem Chart. Der Chart selbst bleibt in beiden Fällen gleich, und deine Wahl wird gespeichert.

### Gamma Ladders

Zwei Leitern nebeneinander. Jede Zeile ist ein Strike, der höchste oben, und ihre Zahl ist das **Netto-Dealer-Gamma** an diesem Strike. Standardmäßig ist sie in Dollar pro 1 % Bewegung angegeben: grob, für wie viel Dollar die Dealer an diesem Strike Aktien handeln müssten, um abgesichert zu bleiben, wenn sich der Kurs um 1 % bewegt.

- **Orange Zeilen** sind Long Gamma (positiv), **marineblaue Zeilen** Short Gamma (negativ). Je satter die Farbe, desto größer die Zahl.
- Die Zeile, deren Strike in einer hervorgehobenen Pille steht, ist der Strike, der dem Kurs am nächsten liegt. Auf breiten Bildschirmen liegt sie auf gleicher Höhe wie der Kurs im Chart.
- Die Kürzel `GF`, `CW`, `PW` und `MP` markieren Gamma Flip, Call Wall, Put Wall und Max Pain an der jeweils nächstgelegenen Zeile. Die Kopfzeile nennt ihre Werte oder `NA`, wenn ein Level nicht verfügbar ist.
- Die **Krone** markiert den Strike mit dem meisten Gamma, der in dieser Leiter sichtbar ist. Das ist nicht der GEX King des Charts; der ist der Strike mit dem meisten Gamma in der gesamten Chain.
- Der Chip **LONG Γ** / **SHORT Γ** in jeder Kopfzeile vergleicht den Kurs mit dem Flip dieses Symbols.

Die erste Leiter zeigt das Symbol des Charts. Die zweite vergleicht ein beliebiges anderes Symbol und startet mit dem passenden Buch: SPY mit SPX, QQQ mit NDX, ES mit SPX, NQ mit NDX und NVDA mit QQQ. [SPY- vs. SPX-Gamma-Levels](/education/spy-vs-spx-gamma-levels) erklärt, warum sich zwei Bücher auf denselben Index unterschiedlich lesen.

Die Bedienelemente oben im Panel:

- **Strikes: Active / All** - **Active** (Standard) blendet Strikes ohne Open Interest aus. **All** zeigt jeden gelisteten Strike nahe am Kurs.
- **Session Δ: On / Off** - markiert jeden Strike, an dem sich seit der Eröffnung um 9:30 Uhr ET Dealer-Gamma aufgebaut hat, mit einem grünen ▲ und jeden, an dem es geschrumpft ist, mit einem roten ▼. Kleine Veränderungen bleiben unmarkiert. Nur live.
- **Unit: 1% / 1pt** - zeigt das Gamma pro 1 % Bewegung (Standard) oder pro 1 Punkt Bewegung. Dasselbe Exposure, andere Einheit. Diese Einstellung gilt auf der ganzen Website.

Ein bernsteinfarbener Hinweis "Positioning as of 15:55 ET" bedeutet, dass die letzten Aktualisierungen keine Positionierung enthielten (zum Beispiel nach Handelsschluss der Optionen); die Leiter zeigt dann die jüngste Aktualisierung mit Positionierung. Die Levels in ihrer Kopfzeile bleiben live.

### Strike Panel

Dasselbe Buch als Bild: das Netto-Dealer-Gamma bei jedem Kurs. Auf breiten Bildschirmen wird es auf der Preisskala des Charts selbst gezeichnet, sodass jeder Strike auf derselben Höhe liegt wie dieser Kurs bei den Kerzen.

Es gibt vier Ansichten, die du oben im Panel auswählst:

- **Silhouette** (Standard) - eine geglättete Kurve. Die grüne Ausbuchtung nach rechts ist Long Gamma, die rote Ausbuchtung nach links Short Gamma, und Punkte markieren die größte Spitze auf jeder Seite.
- **Net** - ein Balken pro Strike: grün nach rechts für Long Gamma, rot nach links für Short Gamma.
- **Split** - Calls und Puts getrennt: ein grüner Call-Balken nach rechts und ein roter Put-Balken nach links.
- **Combined** - die Split-Balken plus ein violetter Netto-Balken.

Eine schmale Achse am linken Rand des Panels beschriftet die Strikes. Liegen sie zu dicht, um jeden einzeln zu beschriften, beschriftet sie stattdessen jeden zweiten, fünften oder zehnten Strike, und der Strike unter deinem Zeiger ist immer beschriftet.

In Split und Combined ist jeder Balken nach Verfall abgestuft: am kräftigsten an der Mittellinie für den nächsten Verfall und am blassesten an der Spitze für den fernsten. **Labels** schreibt Dollarbeträge auf die Balken. Sie werden ausgeblendet, wenn die Strikes zu dicht liegen; zoome die Preisachse hinein, um sie zurückzuholen. Eine gestrichelte azurblaue Linie markiert den Flip.

Fahre mit der Maus über einen Strike oder tippe ihn auf dem Smartphone an, um seine Karte zu sehen: Call-, Put- und Netto-Gamma, Open Interest und das Put/Call-Verhältnis, sein Gewicht im Vergleich zum stärksten Strike im Bild, sein Abstand zum Kurs und jedes Level, das auf ihm liegt. "Long Γ · magnet / brake" und "Short Γ · accelerant" beschreiben, was das Hedging der Dealer an diesem Strike laut Modell tut: sich gegen Bewegungen stemmen oder sie verstärken.

Die kostenlose Vorschau zeigt nur die Ansicht Silhouette.

## Die Kopfzeile des Charts

- **Sitzungs-Badge** - **● LIVE** in der regulären Sitzung, **○ PRE-MARKET** und **○ AFTER HOURS** im vor- und nachbörslichen Handel, **CLOSED** bei geschlossenem Markt, **◀ REWIND** während der Wiedergabe und **◷ DELAYED ~15 MIN** in der kostenlosen Vorschau. **◆ FUTURES** erscheint bei einem Cash-Index außerhalb der regulären Handelszeit, wenn der Kurs in der Kopfzeile der des Futures-Kontrakts ist; die Kerzen bleiben beim Index.
- **Kurs und Veränderung** - die Veränderung bezieht sich auf den Schlusskurs der vorherigen regulären Sitzung. Außerhalb der regulären Handelszeit bleibt der Hauptkurs auf dem Schlusskurs von 16:00 Uhr stehen, und SPY, QQQ und NVDA zeigen in einer zweiten Zeile den vor- bzw. nachbörslichen Kurs.
- **Updated** - wann der letzte Kurstick eingegangen ist.
- **Dealer Gamma @ Spot** - **LONG Γ** oder **SHORT Γ** und das Netto-Dealer-Gamma beim aktuellen Kurs in Dollar, etwa +$1.23B. Diese Box liefert die Regime-Lesart für die ganze Seite. Ist ein Expiry-Filter gesetzt, zeigt sie den eigenen Wert der gewählten Verfälle und nennt diese.
- **Bei ES und NQ** - ein Chip **IMPLIED FROM SPX** (bzw. **NDX**) und der Code des Futures-Kontrakts. Siehe [ES und NQ](/help/platform/gamma-terminal#es-und-nq).

## Die Werkzeugleiste

- **Symbol** - SPY, QQQ, SPX, NDX, ES, NQ und NVDA. Ein Symbolwechsel setzt den Zoom zurück, beendet Rewind und stellt den Expiry-Filter zurück auf All, sofern er nicht auf 0DTE steht.
- **Timeframe** - Balken in **1M**, **5M**, **15M**, **1H** oder **1D**. Der Chart öffnet bei jedem Besuch auf 5M.
- **Stil** - **Candle**, **Line** oder **Area**. Eine Kerze ist grün, wenn sie auf oder über dem Schluss der vorherigen Kerze geschlossen hat, und rot, wenn sie darunter geschlossen hat. Hohl ist sie, wenn sie auf oder über ihrer eigenen Eröffnung geschlossen hat.
- **VOL** - das Auge blendet den Volumenbereich ein oder aus. Siehe [Volumenbereich](/help/platform/gamma-terminal#volumenbereich).
- **Overlay-Pillen** - eine pro Overlay. Siehe [Die Overlays](/help/platform/gamma-terminal#die-overlays). Auf dem Smartphone liegen die Bedienelemente für Overlays, Stil, Volumen und Expiry unter **Layers**, das anzeigt, wie viele Overlays eingeschaltet sind.
- **Expiry** - welche Verfälle in die Gamma-Levels einfließen. Siehe [Der Expiry-Filter](/help/platform/gamma-terminal#der-expiry-filter).
- **Reset** - erscheint, sobald du gezoomt oder verschoben hast, und führt zurück zur Live-Ansicht.
- **Save** - lädt den Chart als PNG-Bild herunter: Kerzen, Linien, Tags und Achsen, ohne die Werkzeugleiste, die Legende oder das Panel neben dem Chart.

## Die Overlays

Jedes Overlay hat eine Pille in der Werkzeugleiste. Klicke darauf, um das Overlay ein- oder auszuschalten; der Chart merkt sich deine Auswahl. Die Legende unter dem Chart ist ein Farbschlüssel, kein Schalter.

| Overlay | Was es zeichnet | Standardmäßig an | Wo verfügbar |
|---|---|---|---|
| Gamma Levels | Die Linien für Gamma Flip, Call Wall und Put Wall | Ja | Überall |
| Regime | Hintergrundschattierung für Long und Short Gamma | Ja | Überall |
| Ribbons | Das Gamma jedes Strikes über die Zeit, hinter den Kerzen | Ja | Live |
| VWAP | Der volumengewichtete Durchschnittskurs der Sitzung | Ja | Überall |
| Max Pain | Der Max-Pain-Strike | Ja | Überall |
| Pin Strike | Der heutige Pin Strike und seine Stärke | Ja | Live |
| GEX King | Der Strike mit dem meisten Gamma in der gesamten Chain | Nein | Live |
| PD/PM Levels | Hoch, Tief und Schluss des Vortags; vorbörsliches Hoch und Tief | Nein | Live: SPY, QQQ, NVDA |
| Expected Range | Die ±1σ-Bewegung, die die implizite Volatilität einpreist | Nein | Live, außer NVDA |
| Centroids | Wo der Schwerpunkt des heutigen Call- und Put-Handels liegt | Nein | Live, Balken von 1M bis 1H |
| Bar Timer | Restzeit der aktuellen Kerze | Nein | Live |

Für jede Level-Linie gilt:

- Jedes Level ist eine gestrichelte Linie quer über den Chart, mit seinem Namen in einem Chip am linken Rand und seinem Kurs in einem Preis-Tag an der rechten Achse.
- Ein Level außerhalb des sichtbaren Preisbereichs erscheint als Preis-Tag, das oben oder unten an der Achse festsitzt, markiert mit ▲ oder ▼. Zoome die Preisachse heraus, um die Linie selbst zu sehen.
- Flip, Walls und VWAP erweitern die Preisachse, um im Bild zu bleiben, wenn sie einigermaßen nah am Kurs liegen; dasselbe tun die PD/PM- und Centroid-Linien, solange sie eingeschaltet sind. Max Pain, Pin Strike, GEX King und die Expected-Range-Linien tun das nie und erscheinen deshalb oft nur als Pfeil-Tags.
- Liegt der Kurs innerhalb von etwa 0,12 % eines Levels, wird dessen Linie kräftiger gezeichnet.

### Gamma Levels

Drei Linien:

- **Gamma Flip** (`FLIP`, azurblau, lange Striche) - der Kurs, an dem das modellierte Netto-Dealer-Gamma das Vorzeichen wechselt.
- **Call Wall** (`CALL WALL`, rot, kurze Striche) - der Strike auf oder über dem Kurs mit dem größten Call-Gamma-Exposure.
- **Put Wall** (`PUT WALL`, grün, kurze Striche) - der Strike auf oder unter dem Kurs mit dem größten Put-Gamma-Exposure.

Die Walls sind danach eingefärbt, was sie tun, nicht nach Calls und Puts. An der roten Wall darüber stemmen sich laut Modell die Verkäufe der Dealer gegen eine Rally; an der grünen Wall darunter stemmen sich laut Modell ihre Käufe gegen einen Abverkauf.

**So liest du sie.** Über dem Flip sind die Dealer laut Modell long Gamma: Ihr Hedging verkauft in Rallys hinein und kauft Rücksetzer, was Bewegungen dämpft. Darunter sind sie laut Modell short Gamma: Ihr Hedging läuft der Bewegung hinterher, was sie verstärkt. Je näher der Kurs am Flip liegt, desto näher ist der Markt an einem Regimewechsel.

An den Walls sitzt das meiste Hedging. Sie wirken oft als Widerstand und Unterstützung: In unserer Studie mit 737 Wall-Tests hielten S&P-Walls in etwa zwei von drei Fällen innerhalb einer Stunde und Nasdaq-Walls in etwa der Hälfte der Fälle, unabhängig davon, auf welcher Seite des Gamma Flips der Preis stand. Betrachte eine Wall als Marke, die du im Auge behältst, nicht als Marke, an der der Kurs stoppen muss. Siehe [Wie oft brechen Gamma Walls tatsächlich?](/education/how-often-do-gamma-walls-break) und [Gamma Walls erklärt](/education/gamma-walls-explained).

**So werden die Walls bestimmt.** Sie springen nicht mit jedem Tick. Eine Wall wird neu bestimmt, sobald der Kurs sie durchbricht, und sonst alle 15 Minuten. Bei jeder Neubestimmung behält die aktuelle Wall ihren Platz, solange sie noch mindestens drei Viertel des Gammas des stärksten Strikes auf ihrer Seite trägt.

**Fehlt die Flip-Linie**, sagt ein Chip nahe dem unteren Rand des Charts, warum:

- `FLIP ↑ 7,750.00` oder `FLIP ↓ 22,600.00` - der Flip liegt über oder unter den sichtbaren Kursen. Zoome die Preisachse heraus: mit **Price −**, Umschalt + Scrollen oder durch Ziehen an der rechten Preisskala.
- `FLIP UNAVAILABLE` - das Modell hat keinen Nulldurchgang gefunden, dem es traut: einen, der nah genug am Kurs liegt, um relevant zu sein, und durch echtes Open Interest gedeckt ist. Das passiert, wenn der Kurs tief in einem Regime steht oder die Chain dünn ist, etwa im vor- und nachbörslichen Handel oder bei einem Volatilitätssprung. Meist löst es sich bei einer späteren Aktualisierung auf. Fahre mit der Maus über das bernsteinfarbene **?**, um die Details zu sehen.
- `NO FLIP IN SELECTED EXPIRIES` - siehe [Der Expiry-Filter](/help/platform/gamma-terminal#der-expiry-filter).

Ohne Flip kann der Chart auch die Regime-Schattierung nicht zeichnen.

### Regime

**Was du siehst.** Der Chart-Hintergrund ist auf der Long-Gamma-Seite des Flips grün und auf der Short-Gamma-Seite rot eingefärbt. Auf breiteren Bildschirmen sind die Tönungen mit `LONG Γ · PINNING` und `SHORT Γ · TRENDING` beschriftet.

**So liest du es.** Bei Long Gamma stemmt sich das Hedging der Dealer laut Modell gegen Bewegungen, was die Volatilität tendenziell dämpft und den Kurs festhält. Bei Short Gamma trägt es zu Bewegungen bei, was sie tendenziell verstärkt. [Was bedeutet negatives Gamma?](/education/what-is-negative-gamma) und [So tradet man rund um Gamma-Flip-Level](/education/how-to-trade-around-gamma-flip) gehen tiefer darauf ein.

**Gut zu wissen.**

- Das Band, in dem der Kurs liegt, stimmt immer mit der Box **Dealer Gamma @ Spot** überein. Meist heißt das Long Gamma über dem Flip und Short Gamma darunter, bei einem ungleichmäßigen Buch kann die Schattierung aber auch umgekehrt sein. Richte dich nach der Box.
- Verschiebst oder zoomst du so, dass der Flip außerhalb des Bildes liegt, nimmt die ganze Ansicht eine einzige Tönung an. Sie beschreibt die sichtbaren Kurse, und dort liegt der aktuelle Kurs womöglich nicht.
- Kein Flip, keine Schattierung.

### Ribbons

**Was du siehst.** Jeder Strike ist eine Bahn, die hinter den Kerzen verläuft, und jeder Balken setzt eine Kugel darauf. Größe und Deckkraft der Kugel zeigen das Netto-Dealer-Gamma dieses Strikes im 5-Minuten-Fenster des Balkens, im Vergleich zum stärksten Strike im Bild. **Goldene** Kugeln stehen für Long Gamma, **violette** für Short Gamma.

**So liest du sie.**

- Eine dicke Bahn, die sich die ganze Sitzung über hält, ist eine Wall.
- Gold ist Magnet und Bremse: Die Dealer verkaufen dort laut Modell in Stärke hinein und kaufen Schwäche. Violett ist ein Beschleuniger: Dort laufen die Dealer Bewegungen hinterher.
- Eine Bahn schwillt an, wenn sich der Kurs ihrem Strike nähert, und dünnt aus, wenn er sich entfernt. Das ist Gamma, das am Geld seinen Höhepunkt erreicht, keine neuen Positionen: Das Open Interest aktualisiert sich nur einmal am Tag, nach Handelsschluss. Eine dicke Bahn direkt am Kurs zeigt, wo das Hedging gerade am aktivsten ist.
- Eine Bahn, die die Farbe wechselt, gehört zu einem Strike, dessen Long- und Short-Gamma-Kontrakte sich nahezu die Waage halten.

**Bedienung.** Der Schieberegler **Opacity** neben der Pille blendet alle Kugeln gemeinsam ab oder verstärkt sie. Fahre mit der Maus über eine Bahn, um den genauen Wert des Strikes zu sehen. Kugeln unter 5 % des stärksten Strikes werden nicht gezeichnet, und die Legende unter dem Chart enthält einen Schlüssel.

**Gut zu wissen.** Ribbons gibt es nur live, und im Gamma Terminal sind sie standardmäßig eingeschaltet. Sie folgen dem Expiry-Filter. Die Historie umfasst die Strikes, die zum jeweiligen Zeitpunkt verfolgt wurden; frühere Balken an weit entfernten Strikes können deshalb leer sein.

### VWAP

**Was du siehst.** Der volumengewichtete Durchschnittskurs der Sitzung (`VWAP`, gestrichelt): der Durchschnittskurs des heutigen Handels, wobei jeder Kurs danach gewichtet ist, wie viel Volumen dort gehandelt wurde. Er beginnt an jedem Handelstag neu.

**So liest du ihn.** Viele Trader behandeln den VWAP als fairen Wert des Tages. Liegt der Kurs darüber, waren die Käufer im Schnitt bereit, mehr zu zahlen; liegt er darunter, haben die Verkäufer Druck gemacht. Wenn der VWAP mit einem Gamma-Level zusammenfällt, siehe [Gamma-VWAP-Konfluenz](/education/gamma-vwap-confluence-explained).

**Gut zu wissen.** SPX und NDX werden nicht direkt gehandelt; ihr VWAP wendet deshalb das Volumenmuster von SPY bzw. QQQ auf die Indexkurse an. Der Expiry-Filter wirkt sich nicht darauf aus.

### Max Pain

**Was du siehst.** Der Strike, an dem Optionsinhaber am wenigsten ausgezahlt bekämen, wenn der Basiswert dort abrechnen würde (`MAX PAIN`, gold, gepunktet). Ohne Expiry-Filter ist es der Max Pain des nächsten Verfalls, also des heutigen, sofern es einen gibt.

**So liest du ihn.** Am relevantesten ist er in den letzten ein, zwei Tagen vor einem bedeutenden Verfall. Den Rest der Zeit liegt er oft abseits des Kurses, und die Walls und der Flip zählen mehr. Siehe [Max Pain erklärt](/education/max-pain-explained).

**Gut zu wissen.** Max Pain erweitert nie die Preisachse und erscheint deshalb oft nur als Pfeil-Tag. Mit Expiry-Filter berechnen der Chart und die Karte in Key Levels ihn aus den von dir gewählten Verfällen neu; die Leitern zeigen stattdessen `NA`.

### Pin Strike

**Was du siehst.** Der nahe gelegene Strike mit Verfall am selben Tag (0DTE), an dem positives Dealer-Gamma und die Wahrscheinlichkeit, dass der Kurs ihn vor Handelsschluss erreicht, am stärksten zusammenkommen (petrol, beschriftet mit `PIN · STRONG`, `PIN · MODERATE` oder `PIN · WEAK`).

**So liest du ihn.** Die Stärkeangabe misst, wie deutlich sich der siegreiche Strike von seinen Nachbarn abhebt, nicht wie groß sein Gamma ist. **Weak** heißt, dass sich der Sog auf mehrere nahe Strikes verteilt, nicht dass das Level unwichtig ist. Das ist ein modelliertes Pinning-Level, kein Kursziel. [Pin Strike](/help/platform/pin-strike) erklärt, wie er gebildet wird.

**Gut zu wissen.** Gibt es keinen aktiven Pin, wird keine Linie gezeichnet. Der Pin ist bewusst auf den Verfall am selben Tag ausgelegt und ignoriert deshalb den Expiry-Filter. In der kostenlosen Vorschau ist er nicht enthalten.

### GEX King

**Was du siehst.** Der Strike mit dem größten Netto-Dealer-Gamma, ob long oder short, über die gesamte Optionskette (`GEX KING`, violett). Standardmäßig aus.

**So liest du ihn.** Der King ist das träge, strukturelle Gegenstück zum Pin des laufenden Tages: der Strike, an dem das meiste Hedging hängt, egal mit welchem Verfall. Er kann ein Short-Gamma-Strike sein.

**Gut zu wissen.** Er ignoriert den Expiry-Filter, denn eingegrenzt wäre er ein anderes Maß. Die Krone auf den Leitern markiert den Strike mit dem meisten Gamma im Ausschnitt dieser Leiter, und das ist nicht immer der King. In der kostenlosen Vorschau ist er nicht enthalten.

### PD/PM Levels

**Was du siehst.** Wo der Kurs schon war: Hoch, Tief und Schluss der vorherigen regulären Sitzung (`PDH`, `PDL`, `PDC`, grau, lange Striche) sowie das heutige vorbörsliche Hoch und Tief (`PMH`, `PML`, grau, gepunktet). Standardmäßig aus.

**So liest du sie.** Das sind keine Dealer-Levels. Es sind Referenzkurse, die viele Trader beobachten, grau gezeichnet, damit sie nie als Gamma-Level gelesen werden.

**Gut zu wissen.** Es gibt sie nur bei SPY, QQQ und NVDA. SPX und NDX haben keinen vorbörslichen Handel, und ES und NQ handeln fast rund um die Uhr, deshalb sind die Levels dort nicht anwendbar. Die Zahlen stehen immer in einer Zeile über dem Chart. Die Pille oder das Auge am Ende dieser Zeile zeichnet sie als Linien ein.

### Expected Range

**Was du siehst.** Ein schattiertes Band zwischen `ER HIGH` und `ER LOW`: die Bewegung, die die implizite Volatilität einpreist, eine Standardabweichung zu beiden Seiten des aktuellen Kurses. Standardmäßig aus. Sobald das Overlay an ist, wählst du **Daily**, **Weekly** oder **Monthly**.

**So wird sie berechnet.** Sie nutzt den VIX für SPX, SPY und ES und den VXN für QQQ, NDX und NQ. Die Bewegung ist Kurs × (VIX ÷ 100) × √(Tage ÷ 252), mit 1, 5 oder 21 Handelstagen. Bei SPY auf $600 und einem VIX von 16 beträgt die tägliche Bewegung etwa $6,05; das Band reicht also von etwa $593,95 bis $606,05.

**So liest du sie.** Unter den üblichen Annahmen endet der Kurs in etwa 68 % der Fälle innerhalb eines Bands von einer Standardabweichung. Das Band sagt dir, wie weit, nicht in welche Richtung. Es zentriert sich mit dem Kurs neu und beschreibt deshalb die Spanne von hier aus, nicht ab der Eröffnung.

**Gut zu wissen.** Expected Range gibt es nur live, und während Rewind ist sie ausgeblendet, weil die Volatilität ein Live-Wert ist. Bei NVDA wird sie nicht gezeichnet, denn dessen eigene Volatilität liegt deutlich über der beider Indizes.

### Centroids

**Was du siehst.** Wo der Schwerpunkt des heutigen Optionshandels liegt. Der **Call-Centroid** (grün) ist der durchschnittliche Strike der heute gehandelten Calls, gewichtet danach, wie viele Kontrakte an jedem Strike gehandelt wurden. Der **Put-Centroid** (rot) ist dasselbe für Puts. Standardmäßig aus.

- Die **scharfen Linien** decken die letzten 15 Minuten des Handels ab.
- Die **breiten, weichen Linien** decken die gesamte bisherige Sitzung ab.

**So liest du sie.** Calls werden überwiegend über dem Kurs gehandelt und Puts überwiegend darunter, deshalb liegen die beiden Linien meist zu beiden Seiten des Kurses. Die Sitzungslinien bewegen sich langsam, weil sie den ganzen Tag mitteln; die 15-Minuten-Linien folgen dem Kurs und sind unruhiger. Fahre mit der Maus über einen Balken, um beide abzulesen.

**So nutzt du sie beim Traden.**

- **Der Abstand zeigt, wie weit die Trader ausgreifen.** Driftet der Call-Centroid nach unten oder der Put-Centroid nach oben, konzentriert sich der Handel näher am Kurs; das passt zu einem Range- oder Pin-Tag. Wird der Abstand größer, greifen die Trader zu weiter entfernten Strikes und rechnen mit mehr Bewegung. Lies ihn zusammen mit dem Regime: Ein schrumpfender Abstand bei Long Gamma stützt den Plan, Bewegungen an den Walls zu faden, und ein wachsender Abstand bei Short Gamma stützt den Plan, mit dem Trend zu handeln.
- **Die Seite, die weiter vom Kurs entfernt liegt, zeigt, wo weit draußen gehandelt wird.** Liegt der Put-Centroid deutlich unter dem Kurs, während der Call-Centroid nah bleibt, findet der Handel weit draußen auf der Unterseite statt, etwa Absicherungen oder Wetten auf einen Abverkauf. Umgekehrt greifen die Trader nach der Oberseite.
- **Die 15-Minuten-Linie im Vergleich zur Sitzungslinie zeigt, was sich gerade ändert.** Zieht die scharfe Call-Linie über die weiche, ist der jüngste Call-Handel zu höheren Strikes gewandert. Steigt der Kurs ebenfalls, folgen die Trader der Bewegung. Steht der Kurs still und die scharfe Linie bewegt sich zuerst, greifen die Trader dem Kurs voraus: im Auge behalten, aber für sich allein kein Trade. Dasselbe gilt, wenn die Put-Linien nach unten wandern.
- **Kurs jenseits einer Sitzungslinie heißt: ein starker Tag.** Normalerweise bleibt der Kurs zwischen den beiden weichen Linien. Über dem Call-Centroid der Sitzung liegt der durchschnittliche Strike der heutigen Calls im Geld, ein Zeichen für einen Trendtag nach oben. Unter dem Put-Centroid der Sitzung ist es dasselbe Zeichen für einen Trendtag nach unten.
- **Ein Centroid auf einer Wall macht die Wall beachtenswerter.** Liegt der Call-Centroid an der Call Wall oder der Put-Centroid an der Put Wall, zeigen der Handel des Tages und das Dealer-Gamma auf denselben Strike.

**Gut zu wissen.** Centroids beschreiben, wo gehandelt wurde; sie sagen nicht voraus, wohin der Kurs geht. Sie zählen jeden gehandelten Kontrakt, ob gekauft oder verkauft: Ein Call-Centroid an einem Strike kann heißen, dass Trader diese Calls kaufen oder sie gegen Aktien verkaufen, die sie halten. In welche Richtung das Geld tendiert, zeigt [Netto-Volumen vs. direktionaler Flow](/education/net-volume-vs-directional-flow). Früh in der Sitzung beruhen die weichen Linien auf nur wenigen Minuten Handel und bewegen sich deshalb stärker als später. Centroids zählen jeden Verfall, den ZeroGEX verfolgt, der Expiry-Filter greift hier also nicht. Außerdem zählen sie nur die Strikes in dem Band, das ZeroGEX rund um den Kurs aufzeichnet (siehe [Datenabdeckung & Aktualisierung](/help/platform/data-coverage)), und liegen deshalb näher am Kurs als bei einem Tool, das jeden gelisteten Strike zählt. Kommt ein Strike im Lauf des Tages in dieses Band, wird sein früheres Volumen auf einmal gezählt, wodurch die 15-Minuten-Linie springen kann. Centroids gibt es nur live, auf Balken von 1M bis 1H.

### Bar Timer

**Was du siehst.** Wie lange es noch dauert, bis die aktuelle Kerze schließt: ein Countdown unter dem Preis-Tag des letzten Kurses, mit einem dünnen Balken, der sich füllt, während die Kerze altert. Fahre mit der Maus über die Live-Kerze, um die verstrichene und die verbleibende Zeit zu sehen. Standardmäßig aus.

**Gut zu wissen.** Er erscheint nur, solange der Markt geöffnet ist und du den neuesten Balken siehst.

### Volumenbereich

Der Bereich unter den Kerzen, ein- oder ausgeblendet mit dem Auge neben **VOL**:

- **Up/Down** (Standard) - Uptick-Volumen (grün) über Downtick-Volumen (rot) gestapelt, eine Säule pro Balken.
- **Cumulative** - eine laufende Summe aus Uptick- minus Downtick-Volumen für die aktuelle Sitzung, beginnend bei null zur Eröffnung. Über null hatten heute die Käufer im Tape die Oberhand, unter null die Verkäufer.

Bei SPX und NDX ist der Bereich mit **PROXY (EST.)** markiert. Ein Cash-Index wird nicht gehandelt, das angezeigte Volumen ist also eine abgeleitete Schätzung, kein gehandeltes Volumen. [Netto-Volumen vs. direktionaler Flow](/education/net-volume-vs-directional-flow) behandelt das Netto-Volumen ausführlicher.

## Der Expiry-Filter

Das Menü **Expiry** in der Werkzeugleiste legt fest, welche Optionsverfälle in die Gamma-Levels einfließen. **All expirations** nutzt die gesamte Chain, die ZeroGEX verfolgt; [Datenabdeckung & Aktualisierung](/help/platform/data-coverage) listet sie auf. **0DTE · today's expiry** folgt dem Verfall am selben Tag und rollt jeden Tag auf den nächsten weiter. Du kannst auch ein oder mehrere bestimmte Daten ankreuzen.

| Was | Folgt dem Expiry-Filter? |
|---|---|
| Gamma Flip, Call Wall, Put Wall | Ja |
| Max Pain | Ja im Chart und in Key Levels; `NA` auf den Leitern |
| Regime-Schattierung und Dealer Gamma @ Spot | Ja |
| Ribbons, das Strike Panel und die Leitern | Ja |
| Die Leiste Key Levels und das Playbook | Ja |
| Pin Strike | Nein: immer der Verfall am selben Tag |
| GEX King | Nein: immer die gesamte Chain |
| Centroids | Nein: alle Verfälle |
| VWAP, PD/PM Levels, Expected Range | Nein: nicht aus der Optionskette gebildet |

Ein paar Hinweise:

- Eine Teilmenge von Verfällen hat ihren eigenen Flip: den Kurs, an dem das Gamma dieser Teilmenge das Vorzeichen wechselt. Ein Buch mit Verfall am selben Tag hat oft nur ein Vorzeichen, alle Strikes liegen auf derselben Seite; dann gibt es keinen Durchgang zu zeichnen, und der Chart zeigt `NO FLIP IN SELECTED EXPIRIES`. Das löst sich später nicht auf, denn es fehlt nichts. Stelle Expiry zurück auf **All**, um den Flip der gesamten Chain zu sehen.
- `NO 0DTE TODAY · SHOWING ALL EXPIRIES` bedeutet, dass es heute keinen Verfall am selben Tag gibt, etwa am Wochenende oder an einem Feiertag; die Levels nutzen dann alle Verfälle.
- Der Filter bleibt für deinen Browser-Tab erhalten und gilt auch für andere Charts, die nach Verfall filtern. Ein Symbolwechsel stellt ihn zurück auf All, sofern er nicht auf 0DTE steht.

## Das Fadenkreuz lesen

Fahre mit der Maus über den Chart oder tippe auf dem Smartphone bzw. halte gedrückt; dann erscheinen ein Fadenkreuz und eine Karte mit:

- Zeit, Eröffnung, Hoch, Tief, Schluss und Volumen des Balkens, im Volumenmodus Cumulative zusätzlich **Net**.
- **Strike Γ near** für den Kurs am Fadenkreuz: das Netto-Dealer-Gamma an den Strikes in der Nähe. Es zeigt dir, wie viel Hedging dort sitzt. Es ist **nicht** das Regime bei diesem Kurs, denn ein Long-Gamma-Strike kann in einem Short-Gamma-Buch liegen. Das Regime liest du an der Schattierung und an der Box Dealer Gamma @ Spot ab.
- Das nächstgelegene im Chart gezeichnete Level und wie weit es entfernt ist. Levels, die du ausgeschaltet hast, werden nicht genannt.
- Mit eingeschalteten Centroids: Call- und Put-Centroid, zuerst der 15-Minuten-Wert, dann der Sitzungswert.
- Mit eingeschalteten Ribbons: die Bahn, die dem Fadenkreuz am nächsten liegt, ihr Netto-Gamma und ihr Anteil gemessen am stärksten Strike im Bild.

## Zoomen, Verschieben und Zurücksetzen

Mit Maus oder Trackpad:

- **Ziehe** den Chart seitwärts, um dich durch die Zeit zu bewegen.
- **Strg + Scrollen** (**Cmd + Scrollen** auf dem Mac) oder eine Pinch-Geste auf dem Trackpad zoomt die Zeitachse. Ein einfaches Scrollrad scrollt die Seite, nicht den Chart.
- **Umschalt + Scrollen** oder Scrollen über der rechten Preisskala zoomt die Preisachse. Du kannst die Preisskala auch nach oben oder unten ziehen.
- Die Buttons − und + bei **Time** und **Price** unten rechts tun dasselbe in Schritten.
- **»** springt zurück zum neuesten Balken.

Auf dem Smartphone ziehst du zum Verschieben seitwärts, zoomst die Zeit per Pinch-Geste und zoomst die Preisachse mit den Buttons **Price** unter dem Chart. Tippe, oder halte gedrückt und gleite, um das Fadenkreuz zu sehen; tippe erneut, um es zu entfernen.

Sobald du zoomst oder verschiebst, bleibt die Preisskala dort, wo du sie hingestellt hast. **Reset**, ein Doppelklick oder ein neues Symbol bzw. ein neuer Timeframe übergibt sie wieder an die automatische Anpassung. Im Gamma Terminal hält die automatische Anpassung den Kurs in der vertikalen Mitte, und genau das erlaubt es den Leitern, sich daran auszurichten.

## Rewind

**Rewind** unter dem Chart spielt die Sitzung nach: Kurs und Gamma-Buch so, wie sie in jedem Moment standen.

- **Play** und **Pause**, eine Geschwindigkeit von **1×**, **4×**, **8×** oder **16×** sowie **Loop**, das standardmäßig eingeschaltet ist.
- Ziehe den **Zeitregler**, um zu einer beliebigen Kerze zu springen.
- Die Levels, das Strike Panel, die Ribbons und beide Leitern zeigen, was in diesem Moment bekannt war. VWAP und Max Pain werden für diesen Moment neu berechnet.
- Expected Range, Bar Timer und der Dollarwert in Dealer Gamma @ Spot sind ausgeblendet, während du zurückspulst, weil es Live-Werte sind.
- Rewind reicht so weit zurück wie die Gamma-Historie, die der Chart vorhält, etwa sechseinhalb Stunden, bei 1H- und 1D-Balken weniger. Für eine ganze Sitzung ab der Eröffnung folge dem Link **full session** zu [Daily Replay](/replay).
- **● LIVE** oder **»** kehrt zur Live-Ansicht zurück, ebenso ein Wechsel von Symbol oder Timeframe.

## Das Playbook

Unter den Karten legt **Where do we expect the underlying to go?** dar, was das aktuelle Regime bedeutet, wenn sich der Kurs einer Wall nähert:

| | Nach oben Richtung Call Wall | Nach unten Richtung Put Wall |
|---|---|---|
| Positives γ (Dealer long Gamma) | Damped rally | Cushioned dip |
| Negatives γ (Dealer short Gamma) | Squeeze risk | Flush risk |

Es folgt dem Chart live. Klicke auf eine Zelle, um ein anderes Szenario zu lesen, und auf **Follow the chart**, um zurückzukehren. Jedes Szenario nennt, worauf du achten solltest, was es ungültig macht und wie oft Walls brechen.

## ES und NQ

ZeroGEX liest Indexoptionen, keine Optionen auf Futures. Die Levels für ES und NQ stammen deshalb aus den SPX- und NDX-Ketten und werden zum fairen Wert auf den Futures-Kurs übertragen (also mit dem Cost of Carry bis zum Verfall des Kontrakts). Der Chip **IMPLIED FROM SPX** (bzw. **NDX**) weist darauf hin. Der Kurs selbst ist der des Futures-Kontrakts, und dessen Code, etwa ESZ26, steht in der Kopfzeile. Handeln die Futures über oder unter ihrem fairen Wert, können die Levels leicht danebenliegen. [Futures-Kontraktmonate](/help/platform/futures-contract-months) erklärt, warum Kurse von denen anderer Plattformen abweichen können.

## Kostenlose Vorschau vs. live

| | Kostenlose Vorschau | Basic und Pro |
|---|---|---|
| Daten | Etwa 15 Minuten verzögert; neu laden für einen neueren Snapshot | Live |
| Symbole und Timeframes | SPY auf 5-Minuten-Balken | Alle sieben Symbole, 1M bis 1D |
| Panel | Leitern für SPY und SPX; Strike Panel nur als Silhouette | Beliebige Paare; alle vier Ansichten des Strike Panel; Session Δ |
| Overlays | Gamma Levels, Regime, VWAP, Max Pain | Alle |
| Werkzeuge | Zoom, Fadenkreuz, Save | Zusätzlich Expiry-Filter, Rewind und Wall-Alarme |

[Tiers, Zugang & was wo freigeschaltet wird](/help/platform/tiers-and-access) behandelt den Rest der Website.

## Was sich das Terminal merkt

In diesem Browser speichert das Terminal deine Overlays, den Chart-Stil, den Volumenmodus, den Horizont der Expected Range, die Deckkraft der Ribbons, die Panel-Auswahl und die Ansicht des Strike Panel, dazu dein Symbol und die Einstellungen Strikes, Session Δ und Unit der Leitern. Der Expiry-Filter bleibt pro Browser-Tab erhalten.

Nicht gespeichert werden der Timeframe (er öffnet auf 5M), das Symbol der zweiten Leiter, Zoom und Verschiebung sowie Rewind.

## Was dir das Gamma Terminal nicht sagen kann

- **Wer die Optionen tatsächlich hält.** Das Dealer-Gamma wird nach einer üblichen Konvention aus dem Open Interest modelliert. Echte Dealer-Bücher weichen davon ab, und Desks hedgen auf eine Art, die öffentliche Daten nicht zeigen.
- **Neue Positionen im Tagesverlauf.** Das Open Interest aktualisiert sich einmal am Tag, nach Handelsschluss. Während der Sitzung bewegen sich die Levels, weil Kurs, Zeit und Volatilität das Gamma bereits offener Positionen verändern.
- **Wohin der Kurs geht.** Walls, Pin, Max Pain, Expected Range und Centroids sind Kontext, keine Kursziele oder Versprechen. Gamma-Levels sind eine Entscheidungshilfe, keine Anlageberatung.

## Siehe auch

- [Das Dashboard lesen](/help/platform/dashboard)
- [So liest du ZeroGEX-Charts](/help/platform/reading-charts)
- [Pin Strike](/help/platform/pin-strike)
- [Gamma Exposure erklärt](/education/gamma-exposure-explained)
- [Gamma Walls erklärt](/education/gamma-walls-explained)
- [So tradet man rund um Gamma-Flip-Level](/education/how-to-trade-around-gamma-flip)
- [Datenabdeckung & Aktualisierung](/help/platform/data-coverage)
