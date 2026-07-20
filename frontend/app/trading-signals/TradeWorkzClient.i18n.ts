import type { PageDictionary } from '@/core/LanguageContext';

export const dict: PageDictionary = {
  en: {
    betaBadge: 'Beta',
    headerDescription:
      "A competing fleet of autonomous trading bots. Each bot owns a capital sleeve, an entry / exit rule set, and a per-bot online-ML calibrator. Leaderboard ranks by realized P&L over the selected window.",
    seedTooltip:
      'Wipe existing history and seed 60 sessions of deterministic synthetic trades per bot. Admin only.',
    seedButton: 'Seed demo data',
    testEventTooltip:
      'Inject a fake entry + exit notification against the focused / followed bot. Notifications fan out to every follower on all their enabled channels — in-app appears in the bell immediately, email lands on the next timer fire (≤60s). Admin only.',
    testEventButton: 'Test event',
    resetTooltip:
      "Wipe EVERY bot's trades (sim + live), positions, notifications, equity, metrics, and ML state, then reset each sleeve to starting capital. Cannot be undone. Admin only.",
    resetButton: 'Reset fleet',
    resetConfirm:
      'Reset the entire fleet? This wipes every trade, position, notification, equity row, and ML state — for BOTH simulated and real live-engine data — and resets every bot to its starting capital. This cannot be undone.',
    seededMessage: 'Seeded {count} synthetic trades across {bots} bots ({days} sessions).',
    simulateFailed: 'Simulate failed: {message}',
    noBotAvailable: 'No bot available to inject a test event against.',
    injectedMessage:
      'Injected test entry + exit against {bot}. Notifications queued: {total} (entry={entry}, exit={exit}). Email rows deliver on the next minute-cadence timer fire.',
    injectFailed: 'Inject failed: {message}',
    fleetResetMessage:
      'Fleet reset: {rows} rows deleted across {tables} tables, {sleeves} sleeves reset to starting capital.',
    resetFailed: 'Reset failed: {message}',
    summaryUnavailable: 'Summary unavailable',
    failedToLoadSummary: 'Failed to load fleet summary',
    fleetNav: 'Fleet NAV',
    startSubline: 'Start {value}',
    realizedPnlToday: 'Realized P&L Today',
    tradesWinsSubline: '{trades} trades · {wins} wins',
    livePositions: 'Live Positions',
    unrealizedSubline: 'Unrealized {value}',
    botsInFleet: 'Bots in Fleet',
    sliceSubline: 'Slice: fleet capital / bots',
    best24h: 'Best 24h',
    worst24h: 'Worst 24h',
    fleetPerformance: 'Fleet Performance',
    fleetPerformanceDesc:
      "90-day cumulative return, indexed to 100 at the start of each bot's window.",
    equityCurvesEmpty:
      'Fleet equity curves appear here once bots have at least two closed sessions.',
    leaderboard: 'Leaderboard',
    leaderboardDesc: 'Ranked by realized P&L over the selected window. Row click opens the drilldown.',
    theFleet: 'The Fleet',
    theFleetDesc: "Every bot: identity color, 30-day equity curve, and rolling P&L windows.",
    rosterUnavailable: 'Roster unavailable',
    noBotsProvisionedTitle: 'No bots provisioned',
    noBotsProvisionedDesc:
      "On first API boot the default roster is auto-seeded. If you're seeing this and the API is up, hit POST /api/tradeworkz/admin/provision to re-run seeding.",
  },
  it: {
    betaBadge: 'Beta',
    headerDescription:
      "Una flotta competitiva di bot di trading autonomi. Ogni bot gestisce una porzione di capitale, un set di regole di entrata / uscita e un calibratore online-ML dedicato. La classifica ordina per P&L realizzato nella finestra selezionata.",
    seedTooltip:
      "Elimina la cronologia esistente e genera 60 sessioni di trade sintetici deterministici per ogni bot. Solo admin.",
    seedButton: 'Genera dati demo',
    testEventTooltip:
      "Inietta una notifica fittizia di entrata + uscita per il bot in focus / seguito. Le notifiche vengono inviate a tutti i follower su tutti i canali attivati — in-app appare subito nella campanella, l'email arriva al prossimo ciclo del timer (≤60s). Solo admin.",
    testEventButton: 'Evento di test',
    resetTooltip:
      "Elimina TUTTI i trade di ogni bot (simulati e live), posizioni, notifiche, equity, metriche e stato ML, poi ripristina ogni porzione al capitale iniziale. Non reversibile. Solo admin.",
    resetButton: 'Reimposta flotta',
    resetConfirm:
      "Reimpostare l'intera flotta? Questa operazione elimina ogni trade, posizione, notifica, riga di equity e stato ML — sia per i dati simulati che per quelli reali del motore live — e riporta ogni bot al capitale iniziale. Non è reversibile.",
    seededMessage: 'Generati {count} trade sintetici su {bots} bot ({days} sessioni).',
    simulateFailed: 'Simulazione non riuscita: {message}',
    noBotAvailable: 'Nessun bot disponibile per iniettare un evento di test.',
    injectedMessage:
      'Iniettata entrata + uscita di test per {bot}. Notifiche in coda: {total} (entrata={entry}, uscita={exit}). Le email vengono inviate al prossimo ciclo del timer.',
    injectFailed: 'Iniezione non riuscita: {message}',
    fleetResetMessage:
      'Flotta reimpostata: {rows} righe eliminate in {tables} tabelle, {sleeves} porzioni ripristinate al capitale iniziale.',
    resetFailed: 'Reset non riuscito: {message}',
    summaryUnavailable: 'Riepilogo non disponibile',
    failedToLoadSummary: 'Impossibile caricare il riepilogo della flotta',
    fleetNav: 'NAV Flotta',
    startSubline: 'Iniziale {value}',
    realizedPnlToday: 'P&L Realizzato Oggi',
    tradesWinsSubline: '{trades} trade · {wins} vincenti',
    livePositions: 'Posizioni Live',
    unrealizedSubline: 'Non realizzato {value}',
    botsInFleet: 'Bot nella Flotta',
    sliceSubline: 'Quota: capitale flotta / bot',
    best24h: 'Migliore 24h',
    worst24h: 'Peggiore 24h',
    fleetPerformance: 'Performance della Flotta',
    fleetPerformanceDesc:
      "Rendimento cumulativo a 90 giorni, indicizzato a 100 all'inizio della finestra di ogni bot.",
    equityCurvesEmpty:
      'Le curve di equity della flotta appaiono qui una volta che i bot hanno almeno due sessioni chiuse.',
    leaderboard: 'Classifica',
    leaderboardDesc: 'Ordinata per P&L realizzato nella finestra selezionata. Il click sulla riga apre il dettaglio.',
    theFleet: 'La Flotta',
    theFleetDesc: 'Ogni bot: colore identificativo, curva di equity a 30 giorni e finestre di P&L mobili.',
    rosterUnavailable: 'Roster non disponibile',
    noBotsProvisionedTitle: 'Nessun bot provisionato',
    noBotsProvisionedDesc:
      "Al primo avvio dell'API il roster predefinito viene generato automaticamente. Se lo vedi e l'API è attiva, esegui POST /api/tradeworkz/admin/provision per rieseguire il seeding.",
  },
  de: {
    betaBadge: 'Beta',
    headerDescription:
      "Eine konkurrierende Flotte autonomer Trading-Bots. Jeder Bot verwaltet ein Kapitalsegment, ein Ein-/Ausstiegsregelwerk und einen eigenen Online-ML-Kalibrator. Die Bestenliste ordnet nach realisiertem P&L im gewählten Zeitraum.",
    seedTooltip:
      'Löscht die vorhandene Historie und erzeugt 60 Sitzungen deterministischer synthetischer Trades pro Bot. Nur für Admins.',
    seedButton: 'Demo-Daten erzeugen',
    testEventTooltip:
      'Fügt eine fingierte Einstiegs- + Ausstiegsbenachrichtigung für den fokussierten / abonnierten Bot ein. Benachrichtigungen gehen an alle Follower auf allen aktivierten Kanälen — in der App erscheint sie sofort, die E-Mail beim nächsten Timer-Zyklus (≤60s). Nur für Admins.',
    testEventButton: 'Testereignis',
    resetTooltip:
      "Löscht ALLE Trades jedes Bots (Sim + Live), Positionen, Benachrichtigungen, Equity, Kennzahlen und ML-Status und setzt jedes Segment auf das Startkapital zurück. Nicht widerrufbar. Nur für Admins.",
    resetButton: 'Flotte zurücksetzen',
    resetConfirm:
      'Die gesamte Flotte zurücksetzen? Dies löscht jeden Trade, jede Position, Benachrichtigung, Equity-Zeile und den ML-Status — sowohl für simulierte als auch für echte Live-Engine-Daten — und setzt jeden Bot auf sein Startkapital zurück. Dies kann nicht rückgängig gemacht werden.',
    seededMessage: '{count} synthetische Trades über {bots} Bots erzeugt ({days} Sitzungen).',
    simulateFailed: 'Simulation fehlgeschlagen: {message}',
    noBotAvailable: 'Kein Bot verfügbar, um ein Testereignis einzufügen.',
    injectedMessage:
      'Test-Einstieg + -Ausstieg für {bot} eingefügt. Benachrichtigungen in Warteschlange: {total} (Einstieg={entry}, Ausstieg={exit}). E-Mails werden beim nächsten Minuten-Timer zugestellt.',
    injectFailed: 'Einfügen fehlgeschlagen: {message}',
    fleetResetMessage:
      'Flotte zurückgesetzt: {rows} Zeilen über {tables} Tabellen gelöscht, {sleeves} Segmente auf Startkapital zurückgesetzt.',
    resetFailed: 'Zurücksetzen fehlgeschlagen: {message}',
    summaryUnavailable: 'Übersicht nicht verfügbar',
    failedToLoadSummary: 'Flotten-Übersicht konnte nicht geladen werden',
    fleetNav: 'Flotten-NAV',
    startSubline: 'Start {value}',
    realizedPnlToday: 'Realisiertes P&L Heute',
    tradesWinsSubline: '{trades} Trades · {wins} Gewinne',
    livePositions: 'Live-Positionen',
    unrealizedSubline: 'Unrealisiert {value}',
    botsInFleet: 'Bots in der Flotte',
    sliceSubline: 'Anteil: Flottenkapital / Bots',
    best24h: 'Beste 24h',
    worst24h: 'Schlechteste 24h',
    fleetPerformance: 'Flotten-Performance',
    fleetPerformanceDesc:
      'Kumulierte 90-Tage-Rendite, indexiert auf 100 zu Beginn des Zeitraums jedes Bots.',
    equityCurvesEmpty:
      'Die Equity-Kurven der Flotte erscheinen hier, sobald Bots mindestens zwei abgeschlossene Sitzungen haben.',
    leaderboard: 'Bestenliste',
    leaderboardDesc: 'Sortiert nach realisiertem P&L im gewählten Zeitraum. Klick auf eine Zeile öffnet die Detailansicht.',
    theFleet: 'Die Flotte',
    theFleetDesc: 'Jeder Bot: Identitätsfarbe, 30-Tage-Equity-Kurve und rollierende P&L-Zeiträume.',
    rosterUnavailable: 'Bot-Liste nicht verfügbar',
    noBotsProvisionedTitle: 'Keine Bots bereitgestellt',
    noBotsProvisionedDesc:
      'Beim ersten API-Start wird die Standard-Bot-Liste automatisch erzeugt. Falls dies hier erscheint und die API läuft, rufe POST /api/tradeworkz/admin/provision auf, um das Seeding erneut auszuführen.',
  },
  es: {
    betaBadge: 'Beta',
    headerDescription:
      "Una flota competitiva de bots de trading autónomos. Cada bot gestiona un tramo de capital, un conjunto de reglas de entrada / salida y un calibrador online-ML propio. La clasificación ordena por P&L realizado en la ventana seleccionada.",
    seedTooltip:
      'Borra el historial existente y genera 60 sesiones de operaciones sintéticas deterministas por bot. Solo administradores.',
    seedButton: 'Generar datos demo',
    testEventTooltip:
      'Inyecta una notificación ficticia de entrada + salida para el bot enfocado / seguido. Las notificaciones se envían a todos los seguidores en todos sus canales activados — en la app aparece de inmediato en la campana, el correo llega en el siguiente ciclo del temporizador (≤60s). Solo administradores.',
    testEventButton: 'Evento de prueba',
    resetTooltip:
      "Borra TODAS las operaciones de cada bot (simuladas y en vivo), posiciones, notificaciones, equity, métricas y estado ML, y restablece cada tramo al capital inicial. No se puede deshacer. Solo administradores.",
    resetButton: 'Restablecer flota',
    resetConfirm:
      '¿Restablecer toda la flota? Esto borra cada operación, posición, notificación, fila de equity y estado ML — tanto para datos simulados como reales del motor en vivo — y restablece cada bot a su capital inicial. Esto no se puede deshacer.',
    seededMessage: 'Se generaron {count} operaciones sintéticas en {bots} bots ({days} sesiones).',
    simulateFailed: 'Simulación fallida: {message}',
    noBotAvailable: 'No hay ningún bot disponible para inyectar un evento de prueba.',
    injectedMessage:
      'Se inyectó una entrada + salida de prueba para {bot}. Notificaciones en cola: {total} (entrada={entry}, salida={exit}). Los correos se entregan en el siguiente ciclo del temporizador.',
    injectFailed: 'Fallo al inyectar: {message}',
    fleetResetMessage:
      'Flota restablecida: {rows} filas eliminadas en {tables} tablas, {sleeves} tramos restablecidos al capital inicial.',
    resetFailed: 'Fallo al restablecer: {message}',
    summaryUnavailable: 'Resumen no disponible',
    failedToLoadSummary: 'No se pudo cargar el resumen de la flota',
    fleetNav: 'NAV de la Flota',
    startSubline: 'Inicial {value}',
    realizedPnlToday: 'P&L Realizado Hoy',
    tradesWinsSubline: '{trades} operaciones · {wins} ganadoras',
    livePositions: 'Posiciones en Vivo',
    unrealizedSubline: 'No realizado {value}',
    botsInFleet: 'Bots en la Flota',
    sliceSubline: 'Porción: capital de la flota / bots',
    best24h: 'Mejor 24h',
    worst24h: 'Peor 24h',
    fleetPerformance: 'Rendimiento de la Flota',
    fleetPerformanceDesc:
      'Rendimiento acumulado de 90 días, indexado a 100 al inicio de la ventana de cada bot.',
    equityCurvesEmpty:
      'Las curvas de equity de la flota aparecen aquí una vez que los bots tienen al menos dos sesiones cerradas.',
    leaderboard: 'Clasificación',
    leaderboardDesc: 'Ordenada por P&L realizado en la ventana seleccionada. Al hacer clic en una fila se abre el detalle.',
    theFleet: 'La Flota',
    theFleetDesc: 'Cada bot: color identificativo, curva de equity de 30 días y ventanas de P&L móviles.',
    rosterUnavailable: 'Listado no disponible',
    noBotsProvisionedTitle: 'No hay bots provisionados',
    noBotsProvisionedDesc:
      'En el primer arranque de la API, el listado predeterminado se genera automáticamente. Si ves esto y la API está activa, ejecuta POST /api/tradeworkz/admin/provision para volver a ejecutar el seeding.',
  },
  fr: {
    betaBadge: 'Beta',
    headerDescription:
      "Une flotte concurrente de bots de trading autonomes. Chaque bot gère une tranche de capital, un ensemble de règles d'entrée / sortie et un calibrateur online-ML propre. Le classement trie par P&L réalisé sur la période sélectionnée.",
    seedTooltip:
      "Efface l'historique existant et génère 60 sessions de trades synthétiques déterministes par bot. Admin uniquement.",
    seedButton: 'Générer des données démo',
    testEventTooltip:
      "Injecte une notification fictive d'entrée + sortie pour le bot ciblé / suivi. Les notifications sont envoyées à tous les abonnés sur tous leurs canaux activés — en app, elle apparaît immédiatement dans la cloche, l'email arrive au prochain cycle du minuteur (≤60s). Admin uniquement.",
    testEventButton: 'Événement de test',
    resetTooltip:
      "Efface TOUS les trades de chaque bot (simulés et en direct), positions, notifications, equity, métriques et état ML, puis réinitialise chaque tranche au capital de départ. Irréversible. Admin uniquement.",
    resetButton: 'Réinitialiser la flotte',
    resetConfirm:
      "Réinitialiser toute la flotte ? Cette action efface chaque trade, position, notification, ligne d'equity et état ML — pour les données simulées ET les données réelles du moteur en direct — et réinitialise chaque bot à son capital de départ. Cette action est irréversible.",
    seededMessage: '{count} trades synthétiques générés sur {bots} bots ({days} sessions).',
    simulateFailed: 'Simulation échouée : {message}',
    noBotAvailable: "Aucun bot disponible pour injecter un événement de test.",
    injectedMessage:
      'Entrée + sortie de test injectée pour {bot}. Notifications en file : {total} (entrée={entry}, sortie={exit}). Les emails sont livrés au prochain cycle du minuteur.',
    injectFailed: "Échec de l'injection : {message}",
    fleetResetMessage:
      'Flotte réinitialisée : {rows} lignes supprimées sur {tables} tables, {sleeves} tranches réinitialisées au capital de départ.',
    resetFailed: 'Échec de la réinitialisation : {message}',
    summaryUnavailable: 'Résumé indisponible',
    failedToLoadSummary: 'Impossible de charger le résumé de la flotte',
    fleetNav: 'NAV de la Flotte',
    startSubline: 'Départ {value}',
    realizedPnlToday: 'P&L Réalisé Aujourd’hui',
    tradesWinsSubline: '{trades} trades · {wins} gains',
    livePositions: 'Positions en Direct',
    unrealizedSubline: 'Non réalisé {value}',
    botsInFleet: 'Bots dans la Flotte',
    sliceSubline: 'Part : capital de la flotte / bots',
    best24h: 'Meilleur 24h',
    worst24h: 'Pire 24h',
    fleetPerformance: 'Performance de la Flotte',
    fleetPerformanceDesc:
      "Rendement cumulé sur 90 jours, indexé à 100 au début de la période de chaque bot.",
    equityCurvesEmpty:
      "Les courbes d'equity de la flotte apparaissent ici dès que les bots ont au moins deux sessions clôturées.",
    leaderboard: 'Classement',
    leaderboardDesc: 'Trié par P&L réalisé sur la période sélectionnée. Le clic sur une ligne ouvre le détail.',
    theFleet: 'La Flotte',
    theFleetDesc: "Chaque bot : couleur d'identité, courbe d'equity sur 30 jours et fenêtres de P&L glissantes.",
    rosterUnavailable: 'Liste indisponible',
    noBotsProvisionedTitle: 'Aucun bot provisionné',
    noBotsProvisionedDesc:
      "Au premier démarrage de l'API, la liste par défaut est générée automatiquement. Si vous voyez ceci et que l'API est active, appelez POST /api/tradeworkz/admin/provision pour relancer le seeding.",
  },
};
