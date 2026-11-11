# Wie oft brechen Gamma Walls tatsächlich? Wir haben es gemessen

*Alle behandeln die Call Wall als Widerstand und die Put Wall als Unterstützung. Fast niemand veröffentlicht eine Zahl. Wir haben 737 Wall-Tests bei SPY, SPX, QQQ und NDX gemessen - und wie sich herausstellte, hing die Antwort von etwas ab, das die meisten Trader nie prüfen.*

---

## Die Frage, die niemand mit einer Zahl beantwortet

Ein ZeroGEX-Nutzer hat es uns ganz direkt gefragt: Es gab eine große Call Wall, der Preis ist durch sie hindurchgebrochen, und er wollte wissen, wie man die Wahrscheinlichkeit dafür einschätzt. Sein Instinkt war, dass Walls in der Regel halten. Unserer auch. Keiner von uns hatte eine Zahl.

Das ist eine seltsame Lücke für ein Level, das jeden Tag gehandelt wird. Also haben wir die Messung gebaut.

Dieser Artikel ist das Ergebnis, einschließlich der Teile, die nicht funktioniert haben - das waren, wie sich herausstellte, die meisten, und sie sind nützlicher als die Teile, die funktioniert haben.

---

## Wie wir gemessen haben

Die Definitionen sind wichtiger als die Zahlen, denn eine schlampige Definition erzeugt eine selbstbewusste Zahl, die nichts bedeutet.

**Ein Test** liegt vor, wenn der Preis bis auf 5 Basispunkte an die Wall herankommt, die in dieser Minute gilt. Nicht an die Wall von heute Morgen - Walls wandern, und das Level, das du tradest, ist das, das zu diesem Zeitpunkt veröffentlicht war.

**Ein Bruch** liegt vor, wenn der Preis **zehn Minuten in Folge** mit einem Puffer jenseits der Wall schließt. Diese Schwelle ist die entscheidende. Gescheiterte Breakouts stoßen routinemäßig durch ein Level und halten sich zehn oder fünfzehn Minuten, bevor sie sich auflösen. Eine Definition, die beim ersten Tick jenseits des Levels auslöst, zählt jeden davon als Bruch, und die resultierende Wahrscheinlichkeit ist bedeutungslos.

**Ein Halten** liegt vor, wenn die Stunde ohne diese Bestätigung verstreicht.

Zwei weitere Entscheidungen sollten wir offenlegen. Tests, die in die Schlussglocke liefen, bevor sie sich auflösen konnten, werden für die Zeit gezählt, in der wir sie beobachten *konnten*, statt verworfen zu werden - sie wegzulassen würde die Stichprobe vom Tape der späten Session weg verzerren, und genau dort ist das 0DTE-Gamma am schwersten. Und ein vierzigminütiges Ringen an einer Wall zählt als eine Beobachtung, nicht als vierzig, weil das eine einzige Entscheidung ist, vor der ein Trader steht.

Die Stichprobe: **737 Wall-Tests, vier Indexprodukte, zehn Wochen (Ende Juni bis Anfang September 2026).**

---

## Die Antwort ist eine Kurve, keine Zahl

Als Erstes weigerten sich die Daten, uns eine einzelne Zahl zu liefern.

„Bricht die Wall?“ ist ohne Uhr keine sauber gestellte Frage. Längere Beobachtung, mehr Gelegenheiten zum Bruch. Bei SPX ergaben dieselben Tests eine Bruchquote von 17,5 % bei einem Horizont von dreißig Minuten und von 30,7 % bei sechzig. Jede nackte Prozentzahl ist in Wahrheit eine Aussage über ein Zeitfenster, das jemand gewählt hat.

Die ehrliche Form ist also P(Bruch innerhalb von *t* Minuten nach dem Test):

| innerhalb von | SPX | QQQ |
|---|---|---|
| 15 Min. | 7,6 % | 12,3 % |
| 30 Min. | 17,5 % | 30,0 % |
| 45 Min. | 26,8 % | 40,6 % |
| 60 Min. | **30,7 %** | **50,1 %** |

Lies die Zeile, die zu deiner Haltedauer passt. „Bricht sie?“ und „Bricht sie, bevor ich raus sein muss?“ sind verschiedene Fragen, und nur die zweite ist handelbar.

---

## Es liegt am Index, nicht am Instrument

Hier ist das Ergebnis, das wir nicht erwartet hatten.

| Produkt | Strikes | Index | P(Bruch innerhalb von 60 Min.) |
|---|---|---|---|
| SPY | 1 $ | S&P 500 | 31,1 % |
| SPX | 5 $ | S&P 500 | 30,7 % |
| QQQ | 1 $ | Nasdaq 100 | 50,1 % |
| NDX | 25 $ | Nasdaq 100 | 46,8 % |

**S&P-Walls hielten innerhalb der Stunde in etwa zwei von drei Fällen. Nasdaq-Walls lagen nahe an einem Münzwurf.**

Sieh dir jetzt die Paare an. SPY und SPX sind statistisch nicht zu unterscheiden. QQQ und NDX sind nicht zu unterscheiden. Jeder Vergleich S&P gegen Nasdaq zeigt einen Unterschied, und zwar keinen marginalen.

Das schließt die Erklärung aus, die wir für die wahrscheinlichste hielten. Feinere Strike-Raster verteilen das Open Interest auf mehr Strikes, sodass jede einzelne „Wall“ einen kleineren Anteil am Buch ausmacht - ein rein mechanischer Grund, warum QQQ-Walls schwächer sein könnten. Wäre das der Treiber, würde sich SPY (mit 1-$-Strikes) wie QQQ verhalten. Tut es nicht. Es verhält sich wie SPX.

**Die Bruchquoten von Walls sind eine Eigenschaft des zugrunde liegenden Index, und sie hängen nicht davon ab, über welchen Optionsmarkt du sie beobachtest.** Eine ETF-Kette mit 1-$-Strikes und eine Indexkette mit 25-$-Strikes liefern für denselben Basiswert dieselbe Antwort.

Die praktische Fassung: Eine QQQ-Call-Wall ist eine deutlich schwächere Struktur als eine SPX-Call-Wall, und der Unterschied beträgt rund siebzehn Prozentpunkte. Wenn du eine einzige gedankliche Haltequote für alle Produkte verwendest, liegst du bei mindestens einem davon falsch.

Call Walls und Put Walls brachen übrigens bei jedem Horizont und in jedem Produkt gleich häufig. Welche Asymmetrie es zwischen ihnen auch geben mag, sie liegt nicht darin, wie oft sie nachgeben.

---

## Was einen Bruch *nicht* vorhergesagt hat

Das ist der Teil, der deine Aufmerksamkeit verdient, denn hier lagen wir falsch.

Wir haben neunzehn Kandidaten getestet - die, zu denen jeder Trader greifen würde, der mit Dealer-Positionierung arbeitet:

- die Dollargröße der Wall, ihr Anteil am Buch und ihr Perzentil im Vergleich zu ihrer eigenen Historie
- ob das Gamma der Wall **stärker wurde oder aufgezehrt wurde**, während der Preis gegen sie drückte
- ob die Wall dem Preis voraus **wanderte**
- Net GEX, seine Entwicklung, der Abstand zum Gamma Flip, auf welcher Seite des Flips der Preis lag
- **vorzeichenbehafteter Order Flow am Wall-Strike selbst** und ob sich dieser Flow beschleunigte
- wie lange die Wall schon bestand, wie oft sie bereits getestet worden war, Tageszeit, realisierte Volatilität

Ein echter Prädiktor sollte in jedem Produkt in dieselbe Richtung zeigen. Über alle vier hinweg **taten das zwei Merkmale - und reiner Zufall ergibt 2,6.**

Auf oder unter Zufallsniveau. Nach drei verschiedenen statistischen Ansätzen blieb nichts übrig.

Wir haben auch einen Nullbefund in die andere Richtung falsch gedeutet. Anfangs, nur auf Basis von SPX, sagten wir, die Größe einer Wall enthalte keine Information. Über vier Produkte hinweg zeigt sie konsistent in die intuitive Richtung - größere Wall, weniger Brüche -, nur zu schwach, um sie vom Rauschen zu trennen. SPX war zufällig die eine Stichprobe, in der der Effekt verschwand, und wir haben eine Behauptung darauf gebaut. Die ehrliche Aussage lautet *ein kleiner Effekt in der erwarteten Richtung, den diese Daten nicht vom Rauschen unterscheiden können* - kein Nullbefund und auch kein Befund.

---

## Wie solltest du eine Wall also nutzen?

**Als Ausgangsannahme, nicht als Auslöser.**

Die strukturelle Information in einer Gamma Wall ist real. Sie liegt nur nicht dort, wo die meisten sie suchen. Sie steckt in der Grundrate des Index, zu dem die Wall gehört - S&P 500 oder Nasdaq-100, egal über welches Produkt du sie beobachtest -, und nicht darin, auf welcher Seite des Flips der Preis steht, oder in irgendeiner ablesbaren Eigenschaft der einzelnen Wall vor dir.

Das rückt den Trade in ein anderes Licht. Wenn du eine Call Wall bei SPX fadest, setzt du auf ein Level, das in dieser Stichprobe in etwa zwei von drei Fällen innerhalb der Stunde gehalten hat. Das ist eine aussagekräftige Grundrate, und es bedeutet zugleich, in einem von drei Fällen überrollt zu werden. Bei QQQ ist dieselbe Wette nahe an einem Münzwurf. Das sind verschiedene Wetten, und sie verdienen unterschiedliche Positionsgrößen.

Was das **nicht** rechtfertigt, ist, eine Wall als Level zu behandeln, das halten wird. Nichts in zehn Wochen an Daten stützt es, eine bestimmte Wall zu lesen und daraus zu schließen, dass diese hier anders ist.

---

## Was das nicht aussagt

Vier ehrliche Grenzen.

**Zehn Wochen sind zehn Wochen.** Ein Volatilitätsregime, ein Sommer. Grundraten können sich verschieben, und wir werden weiter messen.

**Das ist die Wahrscheinlichkeit eines Bruchs, *sofern der Preis die Wall erreicht hat*.** Das ist bewusst eine andere Frage als die, ob der Preis überhaupt dorthin kommt. Die Bedingung auf den Test entfernt den Distanzterm - und die Distanz ist der dominierende Treiber dafür, ob ein Level überhaupt getestet wird. Es ist durchaus möglich, dass der größte Teil der prognostizierbaren Information in „Wird es erreicht?“ steckte und dass das, was nach dem Erreichen übrig bleibt, innerhalb eines Index nahezu zufällig ist. Das wäre selbst schon ein Befund.

**Die Dealer-Positionierung ist modelliert, nicht beobachtet.** Gamma Walls ergeben sich aus der üblichen Call-positiv/Put-negativ-Konvention für das Open Interest. An einem Tag, an dem Kunden netto *Käufer* der Optionen auf der Seite der Wall waren, war diese Wall von vornherein nie ein Widerstand, und keine noch so genaue Beobachtung hätte dir das gesagt. Das ist eine Grenze dessen, was öffentliche Daten offenlegen können, und es ist der wahrscheinlichste Grund, warum eine Wall „unerwartet“ bricht.

**„Kein Merkmal hat Brüche vorhergesagt“ heißt nicht „GEX funktioniert nicht“.** Es ist eine Aussage über eine bestimmte bedingte Frage, auf eine bestimmte Weise gemessen, über ein bestimmtes Zeitfenster.

---

## So liest du das auf ZeroGEX

Die Levels selbst findest du auf den kostenlosen Gamma-Levels-Seiten für [SPX](/spx-gamma-levels), [SPY](/spy-gamma-levels), [QQQ](/qqq-gamma-levels) und [NDX](/ndx-gamma-levels) - Call Wall, Put Wall, Gamma Flip und Net GEX nebeneinander. Für die Live-Lesart, während die Walls im Laufe der Session wandern, ist das [Echtzeit-0DTE-Dashboard](/real-time-gex-0dte) die richtige Anlaufstelle.

Kombiniere das Level mit der Grundrate für das Produkt, das du tradest, und mit dem Artikel [Wie man einen Gamma Flip liest](/education/how-to-read-a-gamma-flip) - das Regime hat hier nicht verändert, wie oft Walls brachen, aber es entscheidet, ob sich das modellierte Hedging gegen eine Bewegung stemmt oder sie verstärkt, sobald eine Wall nachgibt. Der [Grundlagenartikel zu Gamma Walls](/education/gamma-walls-explained) erklärt, was eine Wall ist und warum sie sich so verhält, wie sie es tut, und [Warum Breakouts scheitern](/education/why-do-breakouts-fail) beleuchtet den Mechanismus aus der anderen Richtung.

---

## Fazit

> Eine Gamma Wall ist eine Grundrate, keine Vorhersage. S&P-Walls hielten innerhalb einer Stunde nach dem Test in etwa zwei von drei Fällen; Nasdaq-Walls lagen näher an einem Münzwurf - und es machte keinen Unterschied, ob du den ETF oder den Index beobachtet hast. Von neunzehn Dingen, die wir an einzelnen Walls gemessen haben, sagte uns keines, welche brechen würden. Trade die Wall als Ausgangsannahme mit bekannter Trefferquote, mit einer Positionsgröße passend zum Produkt, in dem du bist, und begegne jeder Behauptung, dass *diese* Wall anders sei, mit Misstrauen.

Nur zu Bildungszwecken - nichts davon ist eine Handelsempfehlung, und keine Zahl hier ist als Handelssignal kalibriert.
