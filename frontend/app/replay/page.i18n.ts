import type { PageDictionary } from '@/core/LanguageContext';

export const dict: PageDictionary = {
  en: {
    heading: 'Scrub through any past session',
    intro:
      'Every per-minute dealer gamma snapshot from the last {count} trading days is replayable. Drag the playhead to watch walls shift, gamma flip drift, and per-strike GEX migrate. Drop two pins and see the strike-by-strike delta between any two moments. Share the exact minute that mattered.',
    noSessions: 'No replayable sessions for {symbol} yet. Check back after the next trading day.',
    fullSession: 'Full session',
    partial: 'Partial',
    thin: 'Thin',
    aboutHeading: 'About GEX Replay',
    aboutPre: 'The data layer is the same',
    aboutMid: 'and',
    aboutPost:
      'rows that power the live dashboard — the replay just lets you scrub the timestamp. Per-minute resolution; cash-session only (09:30–16:00 ET). MP4 export of arbitrary windows is a v2 feature; today you can share branded snapshot cards of any specific moment via the snapshot button on the player.',
  },
  it: {
    heading: 'Scorri qualsiasi sessione passata',
    intro:
      'Ogni snapshot al minuto della posizione gamma dei dealer degli ultimi {count} giorni di negoziazione è riproducibile. Trascina la testina per vedere i wall spostarsi, il gamma flip muoversi e il GEX per strike migrare. Piazza due pin per vedere il delta strike per strike tra due momenti qualsiasi. Condividi il minuto esatto che ha fatto la differenza.',
    noSessions: 'Ancora nessuna sessione riproducibile per {symbol}. Controlla di nuovo dopo la prossima giornata di negoziazione.',
    fullSession: 'Sessione completa',
    partial: 'Parziale',
    thin: 'Ridotta',
    aboutHeading: 'Informazioni su GEX Replay',
    aboutPre: 'Il livello dati è lo stesso delle righe',
    aboutMid: 'e',
    aboutPost:
      'che alimentano la dashboard live — il replay ti permette solo di scorrere il timestamp. Risoluzione al minuto; solo sessione di cassa (09:30–16:00 ET). L\'esportazione MP4 di finestre arbitrarie è una funzione v2; oggi puoi condividere card snapshot brandizzate di qualsiasi momento specifico tramite il pulsante snapshot nel player.',
  },
  de: {
    heading: 'Jede vergangene Sitzung durchscrollen',
    intro:
      'Jeder minütliche Dealer-Gamma-Snapshot der letzten {count} Handelstage ist abspielbar. Ziehe den Abspielkopf, um zu sehen, wie sich Walls verschieben, der Gamma Flip driftet und das GEX pro Strike wandert. Setze zwei Pins und sieh den Strike-für-Strike-Delta zwischen zwei beliebigen Momenten. Teile genau die Minute, die entscheidend war.',
    noSessions: 'Noch keine abspielbaren Sitzungen für {symbol}. Schau nach dem nächsten Handelstag wieder vorbei.',
    fullSession: 'Vollständige Sitzung',
    partial: 'Teilweise',
    thin: 'Dünn',
    aboutHeading: 'Über GEX Replay',
    aboutPre: 'Die Datenebene besteht aus denselben',
    aboutMid: 'und',
    aboutPost:
      'Zeilen, die das Live-Dashboard antreiben — der Replay lässt dich nur den Zeitstempel durchscrollen. Minütliche Auflösung; nur Kassasitzung (09:30–16:00 ET). MP4-Export beliebiger Zeitfenster ist eine v2-Funktion; heute kannst du gebrandete Snapshot-Karten eines bestimmten Moments über den Snapshot-Button im Player teilen.',
  },
  es: {
    heading: 'Recorre cualquier sesión pasada',
    intro:
      'Cada instantánea por minuto de la posición gamma de los dealers de los últimos {count} días de negociación es reproducible. Arrastra el cabezal para ver cómo se desplazan los walls, deriva el gamma flip y migra el GEX por strike. Coloca dos pines y ve el delta strike por strike entre dos momentos cualesquiera. Comparte el minuto exacto que marcó la diferencia.',
    noSessions: 'Todavía no hay sesiones reproducibles para {symbol}. Vuelve a comprobarlo tras la próxima jornada de negociación.',
    fullSession: 'Sesión completa',
    partial: 'Parcial',
    thin: 'Reducida',
    aboutHeading: 'Acerca de GEX Replay',
    aboutPre: 'La capa de datos es la misma que las filas',
    aboutMid: 'y',
    aboutPost:
      'que alimentan el panel en vivo — el replay solo te permite recorrer la marca de tiempo. Resolución por minuto; solo sesión de efectivo (09:30–16:00 ET). La exportación en MP4 de ventanas arbitrarias es una función v2; hoy puedes compartir tarjetas de instantánea de marca de cualquier momento específico mediante el botón de instantánea en el reproductor.',
  },
  fr: {
    heading: 'Parcourez n\'importe quelle séance passée',
    intro:
      'Chaque instantané minute par minute de la position gamma des dealers des {count} derniers jours de bourse est rejouable. Faites glisser la tête de lecture pour voir les walls se déplacer, le gamma flip dériver et le GEX par strike migrer. Placez deux repères et observez le delta strike par strike entre deux instants quelconques. Partagez la minute exacte qui a compté.',
    noSessions: 'Aucune séance rejouable pour {symbol} pour le moment. Revenez après la prochaine journée de bourse.',
    fullSession: 'Séance complète',
    partial: 'Partielle',
    thin: 'Réduite',
    aboutHeading: 'À propos de GEX Replay',
    aboutPre: 'La couche de données est la même que les lignes',
    aboutMid: 'et',
    aboutPost:
      'qui alimentent le tableau de bord en direct — le replay vous permet seulement de parcourir l\'horodatage. Résolution à la minute ; séance de trading uniquement (09:30–16:00 ET). L\'export MP4 de fenêtres arbitraires est une fonctionnalité v2 ; aujourd\'hui, vous pouvez partager des cartes d\'instantané personnalisées de tout moment précis via le bouton d\'instantané du lecteur.',
  },
};
