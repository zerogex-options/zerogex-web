# API-Zugang & Schlüssel (Pro)

*So liest du die API-Dokumentation, was dein Pro-Tarif freischaltet und das grundlegende Modell für Authentifizierung und Rate-Limits.*

---

## Was dir die ZeroGEX-API bietet

Alles, was dir die Web-Plattform anzeigt, wird von demselben Backend berechnet, das auch die API antreibt. Pro-Abonnenten erhalten programmatischen Zugriff auf:

- GEX-Zusammenfassungen und Aufschlüsselungen pro Strike (einschließlich des konsolidierten Endpunkts für Dealer-Levels und Gamma-Profil)
- Flow-Daten (Premium, Volumen, Smart-Money-Buckets)
- Max Pain und Intraday-Technicals (VWAP, Opening Range, Volumen, Momentum)
- Trading-Signale (Scores und Trigger-Status)
- GEX-Historie und Signal-Historie

## Die Dokumentation

Die vollständige Referenz findest du unter **[api.zerogex.io/docs](https://api.zerogex.io/docs)**. Die Dokumentation ist OpenAPI-3.1-konform und in zwei Ansichten verfügbar:

- **Swagger UI** - interaktiv; klicke auf **Authorize**, füge deinen Schlüssel ein und teste Anfragen direkt im Browser
- **ReDoc** - schreibgeschützt; schneller zum Durchsuchen der gesamten API-Oberfläche

Für Anfragen - aus der Dokumentation oder von anderswo - brauchst du einen Pro-Schlüssel. In der App führt der Link **API Specs** Public- und Basic-Konten stattdessen zur Pricing-Seite.

## Authentifizierung

Die Authentifizierung erfolgt über **Bearer-Token**. Du generierst deinen Schlüssel selbst über deinen Account - es gibt nichts abzuwarten:

1. Melde dich an und öffne **Konto → API Access** (`/account#api-access`).
2. Klicke auf **Generate API Key** und kopiere den Schlüssel aus der einmaligen Anzeige - er wird nur ein einziges Mal für wenige Minuten angezeigt und kann danach nicht mehr abgerufen werden. Speichere ihn in einem Passwort-Manager oder Secret-Store.
3. Füge ihn als `Authorization: Bearer <key>` bei jeder Anfrage ein.

Persönliche API-Schlüssel sind ein Pro-Feature; Basic- und Public-Konten werden zur Pricing-Seite weitergeleitet. Ein neu generierter Schlüssel widerruft sofort den vorherigen (du hast höchstens einen aktiven Schlüssel), Rotation heißt also einfach neu generieren. Brauchst du Hilfe oder soll ein Schlüssel widerrufen werden? Schreib an [support@zerogex.io](mailto:support@zerogex.io).

## Rate-Limits

Die API begrenzt Anfragen pro Schlüssel in einem Minutenfenster, das deutlich über dem liegt, was Produktions-Dashboards und Bots mit normaler Anfrage-Hygiene brauchen. Anfragen über dem Limit liefern `429 Too Many Requests` mit einem `Retry-After`-Header.

## Antwortformat

Alle Endpunkte liefern JSON, in zwei Versionen:

- **v1** (`/api/...` und `/api/v1/levels/...`) - die Nutzdaten selbst sind der Antwort-Body.
- **v2** (`/api/v2/...`) - dieselben Nutzdaten unter `data`, dazu ein `freshness`-Block: wann die zugrunde liegenden Daten beobachtet wurden, die Marktsitzung, ab wann die Antwort als veraltet gilt, und ein zusammengefasster `freshness_status` (`fresh`, `aging`, `stale`, `session_closed`, ...). Empfohlen für neue Integrationen - ersetze das führende `/api` (oder `/api/v1`) durch `/api/v2` und lies die Nutzdaten aus `data`.

Fehler liefern den passenden HTTP-Status mit einem `{"detail": ...}`-Body, in beiden Versionen.

Numerische Felder sind präzise typisiert - Gamma-Werte sind vorzeichenbehaftete Dollarbeträge, Scores einzelner Signale (`clamped_score`) sind Floats im Bereich [-1, +1], Zeitstempel liegen im Format ISO 8601 UTC vor.

## Gängige Muster

### Polling vs. Streaming

Für die meisten Anwendungsfälle reicht Polling in einem vernünftigen Rhythmus aus (alle paar Sekunden für Live-Metriken, jede Minute für historische Daten). Streaming ist in der öffentlichen API derzeit nicht verfügbar; die Web-Plattform nutzt einen internen Kanal.

### Caching

Antworten werden serverseitig etwa fünf Sekunden zwischengespeichert, und die Analysen hinter den meisten Endpunkten werden etwa einmal pro Minute neu berechnet - engeres Polling liefert also meist denselben Body. Die Signal-Endpunkte sind mit dem Zeitstempel des jüngsten Scores versehen, sodass du identische Antworten überspringen kannst.

### Backfill

Die abgeleiteten Historien-Endpunkte - GEX (`/api/gex/historical`), Max Pain und Signal-Historie - unterstützen mehrtägige Zeitfenster. Optionsdaten sind die Ausnahme: Kurse einzelner Kontrakte gibt es als jüngste Notierung oder als eine einzelne Intraday-Sitzung (`/api/option/contract`), **nicht** als mehrtägige historische Reihe - und Kontraktkurse gehören ohnehin nicht zum Standard-Tarif (siehe *Was eingeschränkt ist*). Wenn du eine längere Historie von Optionskursen brauchst, wende dich mit den Details an den Support.

## Was eingeschränkt ist

- API-Zugang erfordert ein **Pro**-Konto. Basic- und Public-Konten können keine Schlüssel generieren.
- Rohe Marktdaten aus der Quelle - Kurse einzelner Optionskontrakte (sowohl die jüngste Notierung als auch die Intraday-Historie eines Kontrakts) - gehören nicht zum Standard-API-Tarif. Die API liefert die abgeleiteten Analysen (GEX, Flow, Max Pain, Technicals, Signale) und deren Historie. Brauchst du rohe Optionsdaten für einen bestimmten Anwendungsfall? Schreib dem Support, dann besprechen wir die Möglichkeiten.

## Best Practices

- Du hast einen aktiven Schlüssel, also teilen sich alle Umgebungen (dev, prod) denselben. Rotiere ihn nach einem festen Rhythmus, indem du ihn neu generierst - der alte Schlüssel funktioniert sofort nicht mehr, also aktualisiere ihn überall, wo er verwendet wird.
- Platziere keinen Schlüssel in clientseitigem Code. Die Plattform ist für serverseitige Nutzung konzipiert.
- Setze einen sinnvollen `User-Agent` - das hilft uns, dir zu helfen, wenn eine Anfrage schiefgeht.

## Chart-Integrationen

Wenn du unsere Levels nur auf deinem eigenen Chart sehen willst, musst du womöglich gar nichts programmieren. Alle vier findest du auf der Seite [Integrationen](/integrations):

- **NinjaTrader 8** - ein in Pro enthaltener NinjaScript-Indikator, der `GET /api/v1/levels/{symbol}` mit deinem Pro-Schlüssel abfragt und Gamma Flip, Call Wall, Put Wall, Max Pain sowie Pin Strike zeichnet. Lade ihn als Pro-Mitglied von einer der kostenlosen Gamma-Levels-Seiten herunter (z. B. [/spx-gamma-levels](/spx-gamma-levels)), importiere ihn in NinjaTrader (**File → Utilities → Import NinjaScript…**) und trage deinen Schlüssel ein. Setze auf einem ES- oder NQ-Chart das Symbol auf `ES` bzw. `NQ` - die Levels kommen dann bereits auf der Futures-Preisachse an, ein Basis-Offset ist nicht nötig.
- **Sierra Chart** - eine in Pro enthaltene ACSIL-Studie, die denselben Endpunkt mit deinem Schlüssel abfragt und dieselben fünf Levels zeichnet. Lade sie als Pro-Mitglied unter [/sierra-chart-indicator](/sierra-chart-indicator) herunter und baue sie mit dem eigenen Compiler von Sierra Chart (**Analysis → Build Custom Studies DLL**).
- **TradingView** - ein kostenloses Pine-Skript. Nur manuelle Eingabe: Pine Script kann keine HTTP-Aufrufe machen, du trägst die heutigen Zahlen also selbst ein.
- **thinkorswim** - eine kostenlose thinkScript-Studie. Nur manuelle Eingabe: thinkScript ist genauso abgeschottet wie Pine Script, du kopierst die Studie also jeden Tag neu - sie enthält die Zahlen des Tages bereits.

Wenn deine Plattform nicht aufs Netzwerk zugreifen kann - oder du die Levels lieber erfragst als abliest -, verbinde einen KI-Assistenten mit unserem kostenlosen [MCP-Server](/help/platform/mcp-server) (verzögerte Levels, kein Schlüssel), oder lies [Einen MCP-Server auf der ZeroGEX-API bauen](/help/platform/mcp-integration), wo beschrieben ist, wie du die API an einen solchen Assistenten anbindest.

## Siehe auch

- [Tarife, Zugang und was wo freigeschaltet wird](/help/platform/tiers-and-access)
- [Datenabdeckung & Aktualisierung](/help/platform/data-coverage)
- [Der ZeroGEX-MCP-Server (kostenlos, ohne Schlüssel)](/help/platform/mcp-server)
- [Einen MCP-Server auf der ZeroGEX-API bauen](/help/platform/mcp-integration)
- [API-Dokumentation (extern)](https://api.zerogex.io/docs)
