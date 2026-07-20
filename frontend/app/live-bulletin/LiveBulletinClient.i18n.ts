import type { PageDictionary } from '@/core/LanguageContext';

export const dict: PageDictionary = {
  en: {
    pageTitle: 'Live Bulletin',
    pageDesc:
      'Pick an underlying — the dealer-gamma snapshot is pulled live from the backend. Tweak the copy if you like, then download or copy a share-ready PNG for social.',
    underlyingLabel: 'Underlying',
    horizonLabel: 'Expected-range horizon',
    horizonImpliedMove:
      '1σ implied move {phrase} from {volIndex} {vix} (~68% band). Horizon is a {days}-trading-day span, not a calendar date.',
    horizonUnavailable:
      '{volIndex} implied-vol data unavailable — the expected-range band is hidden.',
    headlineLabel: 'Headline',
    resetToAuto: 'Reset to auto',
    summaryLabel: 'Summary',
    rendering: 'Rendering…',
    downloadPng: 'Download PNG',
    copying: 'Copying…',
    copiedToClipboard: 'Copied to clipboard',
    copyToClipboard: 'Copy to clipboard',
    clipboardUnsupported:
      'Clipboard image copy isn’t supported here — use Download PNG instead.',
    renderError: 'Could not render the image. Please try again.',
    livePreview: 'Live preview',
  },
  it: {
    pageTitle: 'Bollettino Live',
    pageDesc:
      'Scegli un sottostante — lo snapshot del gamma dei dealer viene aggiornato in tempo reale dal backend. Modifica il testo se vuoi, poi scarica o copia un PNG pronto per i social.',
    underlyingLabel: 'Sottostante',
    horizonLabel: 'Orizzonte del range previsto',
    horizonImpliedMove:
      'Movimento implicito di 1σ {phrase} da {volIndex} {vix} (banda ~68%). L’orizzonte corrisponde a {days} giorni di negoziazione, non a una data di calendario.',
    horizonUnavailable:
      'Dati di volatilità implicita {volIndex} non disponibili — la banda del range previsto è nascosta.',
    headlineLabel: 'Titolo',
    resetToAuto: 'Ripristina automatico',
    summaryLabel: 'Riepilogo',
    rendering: 'Rendering in corso…',
    downloadPng: 'Scarica PNG',
    copying: 'Copia in corso…',
    copiedToClipboard: 'Copiato negli appunti',
    copyToClipboard: 'Copia negli appunti',
    clipboardUnsupported:
      'La copia dell’immagine negli appunti non è supportata qui — usa invece Scarica PNG.',
    renderError: 'Non è stato possibile generare l’immagine. Riprova.',
    livePreview: 'Anteprima live',
  },
  de: {
    pageTitle: 'Live-Bulletin',
    pageDesc:
      'Wähle einen Basiswert — der Dealer-Gamma-Snapshot wird live vom Backend geladen. Passe den Text bei Bedarf an und lade dann ein teilbares PNG herunter oder kopiere es.',
    underlyingLabel: 'Basiswert',
    horizonLabel: 'Horizont der erwarteten Spanne',
    horizonImpliedMove:
      'Implizite 1σ-Bewegung {phrase} auf Basis von {volIndex} {vix} (~68%-Band). Der Horizont entspricht {days} Handelstagen, nicht einem Kalenderdatum.',
    horizonUnavailable:
      '{volIndex}-Daten zur impliziten Volatilität nicht verfügbar — das Band der erwarteten Spanne wird ausgeblendet.',
    headlineLabel: 'Schlagzeile',
    resetToAuto: 'Auf Automatik zurücksetzen',
    summaryLabel: 'Zusammenfassung',
    rendering: 'Wird gerendert…',
    downloadPng: 'PNG herunterladen',
    copying: 'Wird kopiert…',
    copiedToClipboard: 'In die Zwischenablage kopiert',
    copyToClipboard: 'In Zwischenablage kopieren',
    clipboardUnsupported:
      'Bild-Kopieren in die Zwischenablage wird hier nicht unterstützt — nutze stattdessen PNG herunterladen.',
    renderError: 'Das Bild konnte nicht erstellt werden. Bitte versuche es erneut.',
    livePreview: 'Live-Vorschau',
  },
  es: {
    pageTitle: 'Boletín en vivo',
    pageDesc:
      'Elige un subyacente — la instantánea del gamma de los dealers se obtiene en vivo del backend. Ajusta el texto si quieres y luego descarga o copia un PNG listo para redes sociales.',
    underlyingLabel: 'Subyacente',
    horizonLabel: 'Horizonte del rango esperado',
    horizonImpliedMove:
      'Movimiento implícito de 1σ {phrase} según {volIndex} {vix} (banda ~68%). El horizonte equivale a {days} días de negociación, no a una fecha de calendario.',
    horizonUnavailable:
      'Datos de volatilidad implícita de {volIndex} no disponibles — la banda del rango esperado está oculta.',
    headlineLabel: 'Titular',
    resetToAuto: 'Restablecer automático',
    summaryLabel: 'Resumen',
    rendering: 'Generando…',
    downloadPng: 'Descargar PNG',
    copying: 'Copiando…',
    copiedToClipboard: 'Copiado al portapapeles',
    copyToClipboard: 'Copiar al portapapeles',
    clipboardUnsupported:
      'Copiar la imagen al portapapeles no es compatible aquí — usa Descargar PNG en su lugar.',
    renderError: 'No se pudo generar la imagen. Inténtalo de nuevo.',
    livePreview: 'Vista previa en vivo',
  },
  fr: {
    pageTitle: 'Bulletin en direct',
    pageDesc:
      'Choisissez un sous-jacent — l’aperçu du gamma des dealers est récupéré en direct depuis le backend. Modifiez le texte si vous le souhaitez, puis téléchargez ou copiez un PNG prêt à partager.',
    underlyingLabel: 'Sous-jacent',
    horizonLabel: 'Horizon de la fourchette attendue',
    horizonImpliedMove:
      'Mouvement implicite de 1σ {phrase} d’après {volIndex} {vix} (bande ~68 %). L’horizon correspond à {days} jours de bourse, pas à une date calendaire.',
    horizonUnavailable:
      'Données de volatilité implicite {volIndex} indisponibles — la bande de la fourchette attendue est masquée.',
    headlineLabel: 'Titre',
    resetToAuto: 'Réinitialiser en automatique',
    summaryLabel: 'Résumé',
    rendering: 'Génération…',
    downloadPng: 'Télécharger le PNG',
    copying: 'Copie…',
    copiedToClipboard: 'Copié dans le presse-papiers',
    copyToClipboard: 'Copier dans le presse-papiers',
    clipboardUnsupported:
      'La copie d’image dans le presse-papiers n’est pas prise en charge ici — utilisez plutôt Télécharger le PNG.',
    renderError: 'Impossible de générer l’image. Veuillez réessayer.',
    livePreview: 'Aperçu en direct',
  },
};
