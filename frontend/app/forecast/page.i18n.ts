import type { PageDictionary } from '@/core/LanguageContext';

export const dict: PageDictionary = {
  en: {
    kicker: 'ZeroGEX · Gamma Forecast',
    heading: 'Yesterday’s promise, today’s receipt',
    intro:
      'Every morning at 7 AM ET we commit {symbol} to a projected range, an expected-volatility call, and the key gamma levels with touch odds — hashed and immutable. We never forecast direction. Every afternoon at 4:05 PM we grade ourselves against the actual low, high, and close. Pick a date to see the promise, the receipt, and the verdict pills.',
    emptyState:
      'No forecasts committed for {symbol} yet. The 07:00 ET writer runs Mon-Fri; check back after the next trading day.',
    pendingLabel: 'Pending 4 PM',
    ungradedLabel: 'Ungraded',
    cleanLabel: '{wins}/{graded} · clean',
    missedLabel: '{wins}/{graded} · missed',
    mixedLabel: '{wins}/{graded} · mixed',
    unknownRegime: 'Unknown',
    volSuffix: 'vol',
    aboutHeading: 'About the receipts',
    aboutPart1: 'The commitment is written to',
    aboutPart2:
      'at 07:00 ET with a SHA-256 content hash and a database-level immutability trigger — nothing about the morning row can change once it lands. The 16:05 ET receipt writer joins realized L/H/C from',
    aboutPart3:
      'and flips the verdict pills. If a forecast was later proven wrong, the receipt page shows it — the whole point is to grade ourselves in public, not hide misses.',
  },
  it: {
    kicker: 'ZeroGEX · Previsione Gamma',
    heading: 'La promessa di ieri, la ricevuta di oggi',
    intro:
      'Ogni mattina alle 7 AM ET impegniamo {symbol} su un range previsto, una previsione di volatilità attesa e i livelli gamma chiave con le probabilità di tocco — hashati e immutabili. Non prevediamo mai la direzione. Ogni pomeriggio alle 4:05 PM ci valutiamo confrontando il minimo, il massimo e la chiusura effettivi. Scegli una data per vedere la promessa, la ricevuta e i verdetti.',
    emptyState:
      'Nessuna previsione registrata per {symbol} finora. Lo scrittore delle 07:00 ET opera dal lunedì al venerdì; torna a controllare dopo la prossima giornata di trading.',
    pendingLabel: 'In attesa delle 16:00',
    ungradedLabel: 'Non valutato',
    cleanLabel: '{wins}/{graded} · pulito',
    missedLabel: '{wins}/{graded} · mancato',
    mixedLabel: '{wins}/{graded} · misto',
    unknownRegime: 'Sconosciuto',
    volSuffix: 'vol',
    aboutHeading: 'Informazioni sulle ricevute',
    aboutPart1: 'L’impegno viene scritto su',
    aboutPart2:
      'alle 07:00 ET con un hash SHA-256 del contenuto e un trigger di immutabilità a livello di database — nulla nella riga del mattino può cambiare una volta registrata. Lo scrittore delle ricevute delle 16:05 ET unisce i valori L/M/C reali da',
    aboutPart3:
      'e aggiorna i verdetti. Se una previsione si è poi rivelata errata, la pagina della ricevuta lo mostra — l’intero scopo è valutarci pubblicamente, non nascondere gli errori.',
  },
  de: {
    kicker: 'ZeroGEX · Gamma-Prognose',
    heading: 'Das Versprechen von gestern, die Quittung von heute',
    intro:
      'Jeden Morgen um 7 Uhr ET legen wir uns für {symbol} auf eine erwartete Handelsspanne, eine Einschätzung der erwarteten Volatilität und die wichtigsten Gamma-Level mit Berührungswahrscheinlichkeiten fest — gehasht und unveränderlich. Wir sagen niemals die Richtung voraus. Jeden Nachmittag um 16:05 Uhr bewerten wir uns anhand des tatsächlichen Tiefs, Hochs und Schlusskurses. Wähle ein Datum, um das Versprechen, die Quittung und die Bewertungen zu sehen.',
    emptyState:
      'Für {symbol} liegen noch keine Prognosen vor. Der Schreibdienst um 07:00 Uhr ET läuft Montag bis Freitag; schau nach dem nächsten Handelstag wieder vorbei.',
    pendingLabel: 'Ausstehend bis 16 Uhr',
    ungradedLabel: 'Unbewertet',
    cleanLabel: '{wins}/{graded} · sauber',
    missedLabel: '{wins}/{graded} · verfehlt',
    mixedLabel: '{wins}/{graded} · gemischt',
    unknownRegime: 'Unbekannt',
    volSuffix: 'Vol',
    aboutHeading: 'Über die Quittungen',
    aboutPart1: 'Die Festlegung wird um 07:00 Uhr ET in',
    aboutPart2:
      'geschrieben, mit einem SHA-256-Inhaltshash und einem Unveränderlichkeits-Trigger auf Datenbankebene — sobald die morgendliche Zeile steht, kann sich daran nichts mehr ändern. Der Quittungsdienst um 16:05 Uhr ET verknüpft die realisierten T/H/S-Werte aus',
    aboutPart3:
      'und aktualisiert die Bewertungen. Falls sich eine Prognose später als falsch erweist, zeigt die Quittungsseite das auch — der ganze Zweck ist, uns öffentlich zu bewerten, nicht Fehler zu verstecken.',
  },
  es: {
    kicker: 'ZeroGEX · Pronóstico Gamma',
    heading: 'La promesa de ayer, el recibo de hoy',
    intro:
      'Cada mañana a las 7 AM ET comprometemos {symbol} a un rango proyectado, una previsión de volatilidad esperada y los niveles gamma clave con probabilidades de toque — hasheados e inmutables. Nunca pronosticamos la dirección. Cada tarde a las 4:05 PM nos evaluamos frente al mínimo, máximo y cierre reales. Elige una fecha para ver la promesa, el recibo y los veredictos.',
    emptyState:
      'Todavía no hay pronósticos registrados para {symbol}. El proceso de las 07:00 ET se ejecuta de lunes a viernes; vuelve a consultar después de la próxima jornada de trading.',
    pendingLabel: 'Pendiente hasta las 16:00',
    ungradedLabel: 'Sin evaluar',
    cleanLabel: '{wins}/{graded} · limpio',
    missedLabel: '{wins}/{graded} · fallido',
    mixedLabel: '{wins}/{graded} · mixto',
    unknownRegime: 'Desconocido',
    volSuffix: 'vol',
    aboutHeading: 'Sobre los recibos',
    aboutPart1: 'El compromiso se escribe en',
    aboutPart2:
      'a las 07:00 ET con un hash de contenido SHA-256 y un disparador de inmutabilidad a nivel de base de datos — nada de la fila de la mañana puede cambiar una vez registrada. El proceso de recibos de las 16:05 ET une los valores reales de mínimo/máximo/cierre desde',
    aboutPart3:
      'y actualiza los veredictos. Si un pronóstico resultó ser incorrecto más adelante, la página del recibo lo muestra — el objetivo es evaluarnos en público, no ocultar los errores.',
  },
  fr: {
    kicker: 'ZeroGEX · Prévision Gamma',
    heading: 'La promesse d’hier, le reçu d’aujourd’hui',
    intro:
      'Chaque matin à 7 h ET, nous engageons {symbol} sur une fourchette projetée, une anticipation de volatilité attendue et les niveaux gamma clés avec les probabilités de contact — hachés et immuables. Nous ne prévoyons jamais la direction. Chaque après-midi à 16 h 05, nous nous évaluons par rapport au plus bas, au plus haut et à la clôture réels. Choisissez une date pour voir la promesse, le reçu et les verdicts.',
    emptyState:
      'Aucune prévision enregistrée pour {symbol} pour le moment. Le processus de 07 h 00 ET fonctionne du lundi au vendredi ; revenez après la prochaine journée de trading.',
    pendingLabel: 'En attente jusqu’à 16 h',
    ungradedLabel: 'Non évalué',
    cleanLabel: '{wins}/{graded} · net',
    missedLabel: '{wins}/{graded} · raté',
    mixedLabel: '{wins}/{graded} · mitigé',
    unknownRegime: 'Inconnu',
    volSuffix: 'vol',
    aboutHeading: 'À propos des reçus',
    aboutPart1: 'L’engagement est inscrit dans',
    aboutPart2:
      'à 07 h 00 ET avec un hash de contenu SHA-256 et un déclencheur d’immuabilité au niveau de la base de données — rien dans la ligne du matin ne peut changer une fois enregistrée. Le processus de reçus de 16 h 05 ET associe les valeurs réelles B/H/C réalisées depuis',
    aboutPart3:
      'et met à jour les verdicts. Si une prévision s’est révélée fausse par la suite, la page du reçu le montre — tout l’objectif est de nous évaluer publiquement, pas de cacher les erreurs.',
  },
};
