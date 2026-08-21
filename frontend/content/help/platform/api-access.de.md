# API-Zugang & Schlüssel (Pro)

*So liest du die API-Dokumentation, was dein Pro-Tarif freischaltet und das grundlegende Modell für Authentifizierung und Rate-Limits.*

---

## Was dir die ZeroGEX-API bietet

Alles, was dir die Web-Plattform anzeigt, wird von demselben Backend berechnet, das auch die API antreibt. Pro-Abonnenten erhalten programmatischen Zugriff auf:

- GEX-Zusammenfassungen und Aufschlüsselungen pro Strike
- Echtzeit-Kurse
- Flow-Daten (Premium, Volumen, Smart-Money-Buckets)
- Trading-Signale (Scores und Trigger-Status)
- Historische Bars und Signal-Historie

## Die Dokumentation

Die vollständige Referenz findest du unter **[api.zerogex.io/docs](https://api.zerogex.io/docs)**. Die Dokumentation ist OpenAPI-3.0-konform und in zwei Ansichten verfügbar:

- **Swagger UI** — interaktiv; teste Anfragen direkt im Browser
- **ReDoc** — schreibgeschützt; schneller zum Durchsuchen der gesamten API-Oberfläche

Die Dokumentation erfordert ein Pro-Konto. Public-Nutzer werden beim Klick zur Pricing-Seite weitergeleitet.

## Authentifizierung

Die Authentifizierung erfolgt über **Bearer-Token**. Du generierst deinen Schlüssel selbst über deinen Account — es gibt nichts abzuwarten:

1. Melde dich an und öffne **Account → API-Zugang** (`/account#api-access`).
2. Klicke auf **API-Schlüssel generieren** und kopiere den Schlüssel aus der einmaligen Anzeige — er wird nur ein einziges Mal für wenige Minuten angezeigt und kann danach nicht mehr abgerufen werden. Speichere ihn in einem Passwort-Manager oder Secret-Store.
3. Füge ihn als `Authorization: Bearer <key>` bei jeder Anfrage ein.

Persönliche API-Schlüssel sind ein Pro-Feature; Basic- und Public-Konten werden zur Pricing-Seite weitergeleitet. Ein neu generierter Schlüssel widerruft sofort den vorherigen (du hast höchstens einen aktiven Schlüssel), Rotation heißt also einfach neu generieren. Brauchst du Hilfe oder soll ein Schlüssel widerrufen werden? Schreib an [support@zerogex.io](mailto:support@zerogex.io).

## Rate-Limits

Die API erzwingt Rate-Limits pro Schlüssel. Die Limits skalieren mit dem Tarif:

- **Pro** — großzügige Minuten- und Tageslimits, ausreichend für Produktions-Dashboards und Bots, die eine normale Anfrage-Hygiene einhalten.

Anfragen über dem Limit liefern `429 Too Many Requests` mit einem `Retry-After`-Header.

## Antwortformat

Alle Endpunkte liefern JSON. Standardfelder:

- `data` — die Nutzdaten
- `meta` — Paginierung, Zeitstempel, Request-ID
- `error` — bei Fehlerantworten vorhanden; bei Erfolg weggelassen

Numerische Felder sind präzise typisiert — Gamma-Werte sind vorzeichenbehaftete Dollarbeträge, Scores sind Floats im Bereich [-1, +1], Zeitstempel liegen im Format ISO 8601 UTC vor.

## Gängige Muster

### Polling vs. Streaming

Für die meisten Anwendungsfälle reicht Polling in einem vernünftigen Rhythmus aus (alle paar Sekunden für Live-Metriken, jede Minute für historische Daten). Streaming ist in der öffentlichen API derzeit nicht verfügbar; die Web-Plattform nutzt einen internen Kanal.

### Caching

Die meisten Endpunkte setzen sinnvolle HTTP-Cache-Header — beachte sie. Die Signal-Endpunkte sind mit dem Zeitstempel des jüngsten Scores versehen, sodass du identische Antworten überspringen kannst.

### Backfill

Historische Endpunkte unterstützen mehrtägige Zeitfenster. Für tiefgehende Backfills paginierst du über das Feld `meta.cursor`.

## Was eingeschränkt ist

- API-Zugang erfordert ein **Pro**-Konto. Basic- und Public-Konten können keine Schlüssel generieren.
- Manche Endpunkte haben zusätzliche Pro-exklusive Flags (z. B. Rohdaten-Dumps der Chain) — die Dokumentation kennzeichnet sie entsprechend.

## Best Practices

- Ein Schlüssel pro Umgebung (dev, prod). Rotiere sie nach einem festen Rhythmus.
- Platziere keinen Schlüssel in clientseitigem Code. Die Plattform ist für serverseitige Nutzung konzipiert.
- Setze einen sinnvollen `User-Agent` — das hilft uns, dir zu helfen, wenn eine Anfrage schiefgeht.

## Chart-Integrationen

Wenn du unsere Levels nur auf deinem eigenen Chart sehen willst, musst du womöglich gar nichts programmieren:

- **NinjaTrader 8** — ein kostenloser NinjaScript-Indikator, der `GET /api/v1/levels/{symbol}` mit deinem Pro-Schlüssel abfragt und Gamma Flip, Call Wall, Put Wall, Max Pain sowie Pin Strike zeichnet. Lade ihn von einer der kostenlosen Gamma-Levels-Seiten herunter (z. B. [/spx-gamma-levels](/spx-gamma-levels)), kompiliere ihn im NinjaScript-Editor und trage deinen Schlüssel ein.
- **TradingView** — ein kostenloses Pine-Skript. Nur manuelle Eingabe: Pine Script kann keine HTTP-Aufrufe machen, du trägst die heutigen Zahlen also selbst ein.

## Siehe auch

- [Tarife, Zugang und was wo freigeschaltet wird](/help/platform/tiers-and-access)
- [Datenabdeckung & Aktualisierung](/help/platform/data-coverage)
- [API-Dokumentation (extern)](https://api.zerogex.io/docs)
