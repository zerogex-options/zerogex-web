import type { PageDictionary } from '@/core/LanguageContext';

export const dict: PageDictionary = {
  en: {
    allSessions: 'All sessions',
    replayLabel: 'GEX Replay',
    perMinuteFrames: 'per-minute frames',
    liveToday: 'live (today)',
    historical: 'historical',
    noFramesTitle: 'No replayable frames for {sym} on {date}.',
    noFramesBody: "Either the session predates GEX ingestion or the analytics engine didn't write that day.",
    howToUse: 'How to use',
    howToUseBody1:
      'Drag the scrubber to any minute · use play/pause to auto-advance · the combined chart puts the session tape on the left and the dealer-net-GEX strike profile on the right, sharing the same price axis so a wick and a strike bar at the same level line up horizontally · the call wall (resistance), put wall (support), and gamma flip draw as horizontal levels that migrate minute-by-minute as you scrub · candles past the cursor ghost out and light back to full opacity as the playhead sweeps through them — or hit',
    futureLabel: 'Future',
    howToUseBody2:
      'to hide everything ahead of the playhead for an as-it-happened tape · drop pin A then pin B to see the strike-by-strike delta between two moments · click',
    snapshotLabel: 'Snapshot this minute',
    howToUseBody3:
      'to generate a branded permalink with an OG image you can share. MP4 export of arbitrary windows is on the roadmap; today you share branded stills of the moments that mattered.',
  },
  it: {
    allSessions: 'Tutte le sessioni',
    replayLabel: 'GEX Replay',
    perMinuteFrames: 'fotogrammi al minuto',
    liveToday: 'in diretta (oggi)',
    historical: 'storico',
    noFramesTitle: 'Nessun fotogramma riproducibile per {sym} il {date}.',
    noFramesBody: "La sessione è precedente all'ingestione dei dati GEX oppure il motore di analisi non ha scritto quel giorno.",
    howToUse: 'Come si usa',
    howToUseBody1:
      "Trascina il cursore su qualsiasi minuto · usa play/pausa per l'avanzamento automatico · il grafico combinato mostra il tape della sessione a sinistra e il profilo per strike del GEX netto del dealer a destra, condividendo lo stesso asse dei prezzi in modo che uno stoppino e una barra di strike allo stesso livello si allineino orizzontalmente · il call wall (resistenza), il put wall (supporto) e il gamma flip vengono disegnati come livelli orizzontali che si spostano minuto per minuto mentre scorri · le candele oltre il cursore si affievoliscono e tornano a piena opacità man mano che il playhead le attraversa — oppure premi",
    futureLabel: 'Futuro',
    howToUseBody2:
      "per nascondere tutto ciò che precede il playhead, per un tape come-è-accaduto · posiziona il pin A e poi il pin B per vedere la differenza strike per strike tra due momenti · clicca",
    snapshotLabel: 'Scatta questo minuto',
    howToUseBody3:
      "per generare un permalink personalizzato con un'immagine OG da condividere. L'esportazione MP4 di finestre arbitrarie è nella roadmap; per ora puoi condividere istantanee dei momenti che contano.",
  },
  de: {
    allSessions: 'Alle Sitzungen',
    replayLabel: 'GEX Replay',
    perMinuteFrames: 'Frames pro Minute',
    liveToday: 'live (heute)',
    historical: 'historisch',
    noFramesTitle: 'Keine abspielbaren Frames für {sym} am {date}.',
    noFramesBody: 'Entweder liegt die Sitzung vor der GEX-Erfassung, oder die Analyse-Engine hat an diesem Tag nichts geschrieben.',
    howToUse: 'So funktioniert es',
    howToUseBody1:
      'Ziehe den Regler auf eine beliebige Minute · nutze Play/Pause für automatisches Vorspulen · das kombinierte Chart zeigt links das Session-Tape und rechts das Dealer-Net-GEX-Strike-Profil, mit derselben Preisachse, sodass ein Docht und ein Strike-Balken auf gleicher Höhe horizontal ausgerichtet sind · der Call Wall (Widerstand), der Put Wall (Unterstützung) und der Gamma Flip werden als horizontale Linien gezeichnet, die sich minütlich verschieben, während du scrubst · Kerzen hinter dem Cursor werden ausgeblendet und kehren zur vollen Deckkraft zurück, sobald der Playhead sie erreicht — oder klicke auf',
    futureLabel: 'Zukunft',
    howToUseBody2:
      'um alles vor dem Playhead auszublenden, für ein Tape wie live erlebt · setze Pin A und dann Pin B, um die Strike-für-Strike-Differenz zwischen zwei Momenten zu sehen · klicke auf',
    snapshotLabel: 'Diese Minute festhalten',
    howToUseBody3:
      'um einen gebrandeten Permalink mit einem teilbaren OG-Bild zu erzeugen. Der MP4-Export beliebiger Zeitfenster ist für die Roadmap geplant; heute teilst du gebrandete Standbilder der wichtigen Momente.',
  },
  es: {
    allSessions: 'Todas las sesiones',
    replayLabel: 'GEX Replay',
    perMinuteFrames: 'fotogramas por minuto',
    liveToday: 'en vivo (hoy)',
    historical: 'histórico',
    noFramesTitle: 'No hay fotogramas reproducibles para {sym} el {date}.',
    noFramesBody: 'O bien la sesión es anterior a la ingesta de datos GEX, o el motor de análisis no escribió nada ese día.',
    howToUse: 'Cómo usarlo',
    howToUseBody1:
      'Arrastra el control deslizante a cualquier minuto · usa reproducir/pausar para avanzar automáticamente · el gráfico combinado muestra el tape de la sesión a la izquierda y el perfil de GEX neto del dealer por strike a la derecha, compartiendo el mismo eje de precios para que una mecha y una barra de strike al mismo nivel queden alineadas horizontalmente · el call wall (resistencia), el put wall (soporte) y el gamma flip se dibujan como niveles horizontales que se desplazan minuto a minuto mientras avanzas · las velas por delante del cursor se atenúan y recuperan opacidad total a medida que el playhead las alcanza — o pulsa',
    futureLabel: 'Futuro',
    howToUseBody2:
      'para ocultar todo lo que está por delante del playhead y obtener un tape tal-como-ocurrió · coloca el pin A y luego el pin B para ver la diferencia strike por strike entre dos momentos · haz clic en',
    snapshotLabel: 'Capturar este minuto',
    howToUseBody3:
      'para generar un enlace permanente de marca con una imagen OG que puedas compartir. La exportación a MP4 de ventanas arbitrarias está en la hoja de ruta; hoy puedes compartir capturas de marca de los momentos que importaron.',
  },
  fr: {
    allSessions: 'Toutes les sessions',
    replayLabel: 'GEX Replay',
    perMinuteFrames: 'images par minute',
    liveToday: 'en direct (aujourd’hui)',
    historical: 'historique',
    noFramesTitle: "Aucune image rejouable pour {sym} le {date}.",
    noFramesBody: "Soit la session est antérieure à l'ingestion GEX, soit le moteur d'analyse n'a rien enregistré ce jour-là.",
    howToUse: 'Mode d’emploi',
    howToUseBody1:
      "Faites glisser le curseur sur n'importe quelle minute · utilisez lecture/pause pour l'avance automatique · le graphique combiné place le tape de la session à gauche et le profil de GEX net du dealer par strike à droite, en partageant le même axe des prix afin qu'une mèche et une barre de strike au même niveau s'alignent horizontalement · le call wall (résistance), le put wall (support) et le gamma flip sont tracés comme des niveaux horizontaux qui se déplacent minute par minute pendant que vous naviguez · les bougies situées après le curseur s'estompent puis retrouvent leur pleine opacité à mesure que le playhead les atteint — ou cliquez sur",
    futureLabel: 'Futur',
    howToUseBody2:
      "pour masquer tout ce qui précède le playhead, pour un tape tel-que-vécu · placez l'épingle A puis l'épingle B pour voir l'écart strike par strike entre deux instants · cliquez sur",
    snapshotLabel: 'Capturer cette minute',
    howToUseBody3:
      "pour générer un permalien de marque avec une image OG partageable. L'export MP4 de fenêtres arbitraires est sur la feuille de route ; pour l'instant, vous partagez des instantanés de marque des moments qui comptaient.",
  },
};
