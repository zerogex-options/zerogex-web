// Localized wall-alert copy for the in-app surfaces (the header bell, toasts,
// /account/alerts). Email and SMS stay English, like every ZeroGEX email, and
// use EN_WALL_ALERT_COPY from core/wallAlerts.ts directly.
//
// Prices and strikes stay in en-US number format in every locale, matching the
// charts and level tables they sit beside.
//
// Pure and alias-free so tests/wallAlerts.test.ts can check every locale fills
// every template.

import { EN_WALL_ALERT_COPY, type WallAlertCopy } from './wallAlerts.ts';

const IT: WallAlertCopy = {
  side: { call: 'call', put: 'put' },
  kind: { hit: 'Muro raggiunto', break: 'Muro rotto', hold: 'Muro tenuto' },
  kindChip: { hit: 'RAGGIUNTO', break: 'ROTTO', hold: 'TENUTO' },
  tier: {
    light: 'Debole',
    moderate: 'Moderato',
    above_typical: 'Sopra la media',
    strong: 'Forte',
    very_strong: 'Molto forte',
  },
  headline: {
    hit: '{symbol}: raggiunto il muro {side} a {wall}',
    break: '{symbol}: rotto il muro {side} a {wall}',
    hold: '{symbol}: il muro {side} a {wall} ha tenuto',
  },
  hitShort: '{extreme_label} {price} · {distance} {relation}',
  extremeLabel: { call: 'Massimo', put: 'Minimo' },
  relationShort: { call: 'sotto il muro', put: 'sopra il muro' },
  relationPast: 'oltre il muro',
  atWall: 'sul muro',
  approachN: '{nth} test di oggi',
  breakDetail: {
    call: '{n} chiusure consecutive a 1 min sopra {level} · ultimo {last}',
    put: '{n} chiusure consecutive a 1 min sotto {level} · ultimo {last}',
  },
  holdDetail: {
    call: 'Respinto a {price} ({off} dal muro) dopo un massimo di {peak}',
    put: 'Rimbalzo a {price} ({off} dal muro) dopo un minimo di {peak}',
  },
  nextWall: { call: 'Prossimo muro call: {wall}', put: 'Prossimo muro put: {wall}' },
  strengthLine: 'Muro {tier_lc} · {pctile} rispetto agli ultimi 30 giorni a quest’ora',
  strengthUnknown: 'Forza del muro non ancora valutata',
  regime: {
    positive:
      'I dealer sono long gamma: le loro coperture vanno contro il movimento, quindi i muri tendono a tenere.',
    negative:
      'I dealer sono short gamma: le loro coperture assecondano il movimento, quindi i muri cedono più facilmente.',
  },
  odds: 'Storico: i muri {side} di {symbol} si sono rotti entro {horizon} min da un test nel {pct} dei casi.',
  ordinal: (n) => `${n}°`,
  percentile: (n) => `${n}° percentile`,
};

const DE: WallAlertCopy = {
  side: { call: 'Call', put: 'Put' },
  kind: { hit: 'Wand erreicht', break: 'Wand gebrochen', hold: 'Wand gehalten' },
  kindChip: { hit: 'ERREICHT', break: 'GEBROCHEN', hold: 'GEHALTEN' },
  tier: {
    light: 'Schwach',
    moderate: 'Mäßig',
    above_typical: 'Überdurchschnittlich',
    strong: 'Stark',
    very_strong: 'Sehr stark',
  },
  headline: {
    hit: '{symbol}: {side}-Wand bei {wall} erreicht',
    break: '{symbol}: {side}-Wand bei {wall} gebrochen',
    hold: '{symbol}: {side}-Wand bei {wall} gehalten',
  },
  hitShort: '{extreme_label} {price} · {distance} {relation}',
  extremeLabel: { call: 'Hoch', put: 'Tief' },
  relationShort: { call: 'unter der Wand', put: 'über der Wand' },
  relationPast: 'durch die Wand',
  atWall: 'an der Wand',
  approachN: '{nth} Test heute',
  breakDetail: {
    call: '{n} 1-Min-Schlusskurse in Folge über {level} · zuletzt {last}',
    put: '{n} 1-Min-Schlusskurse in Folge unter {level} · zuletzt {last}',
  },
  holdDetail: {
    call: 'Abgewiesen auf {price} ({off} von der Wand) nach einem Hoch von {peak}',
    put: 'Abgeprallt auf {price} ({off} von der Wand) nach einem Tief von {peak}',
  },
  nextWall: { call: 'Nächste Call-Wand: {wall}', put: 'Nächste Put-Wand: {wall}' },
  strengthLine: '{tier}e Wand · {pctile} der letzten 30 Tage zu dieser Uhrzeit',
  strengthUnknown: 'Wandstärke noch nicht bewertet',
  regime: {
    positive:
      'Dealer sind long Gamma: Ihr Hedging wirkt Bewegungen entgegen, daher halten Wände eher.',
    negative:
      'Dealer sind short Gamma: Ihr Hedging verstärkt Bewegungen, daher geben Wände leichter nach.',
  },
  odds: 'Historie: {symbol}-{side}-Wände brachen in {pct} der Tests innerhalb von {horizon} Min.',
  ordinal: (n) => `${n}.`,
  percentile: (n) => `${n}. Perzentil`,
};

const ES: WallAlertCopy = {
  side: { call: 'call', put: 'put' },
  kind: { hit: 'Muro alcanzado', break: 'Muro roto', hold: 'Muro sostenido' },
  kindChip: { hit: 'ALCANZADO', break: 'ROTO', hold: 'SOSTENIDO' },
  tier: {
    light: 'Débil',
    moderate: 'Moderado',
    above_typical: 'Por encima de lo típico',
    strong: 'Fuerte',
    very_strong: 'Muy fuerte',
  },
  headline: {
    hit: '{symbol}: alcanzó el muro {side} en {wall}',
    break: '{symbol}: rompió el muro {side} en {wall}',
    hold: '{symbol}: el muro {side} en {wall} aguantó',
  },
  hitShort: '{extreme_label} {price} · {distance} {relation}',
  extremeLabel: { call: 'Máximo', put: 'Mínimo' },
  relationShort: { call: 'por debajo del muro', put: 'por encima del muro' },
  relationPast: 'a través del muro',
  atWall: 'en el muro',
  approachN: '{nth} prueba de hoy',
  breakDetail: {
    call: '{n} cierres de 1 min seguidos por encima de {level} · último {last}',
    put: '{n} cierres de 1 min seguidos por debajo de {level} · último {last}',
  },
  holdDetail: {
    call: 'Rechazado a {price} ({off} del muro) tras un máximo de {peak}',
    put: 'Rebote a {price} ({off} del muro) tras un mínimo de {peak}',
  },
  nextWall: { call: 'Siguiente muro call: {wall}', put: 'Siguiente muro put: {wall}' },
  strengthLine: 'Muro {tier_lc} · {pctile} frente a los últimos 30 días a esta hora',
  strengthUnknown: 'Fuerza del muro aún sin calificar',
  regime: {
    positive:
      'Los dealers están largos en gamma: su cobertura va contra el movimiento, así que los muros suelen aguantar.',
    negative:
      'Los dealers están cortos en gamma: su cobertura acompaña el movimiento, así que los muros ceden con más facilidad.',
  },
  odds: 'Historial: los muros {side} de {symbol} se rompieron dentro de {horizon} min de una prueba el {pct} de las veces.',
  ordinal: (n) => `${n}.ª`,
  percentile: (n) => `percentil ${n}`,
};

const FR: WallAlertCopy = {
  side: { call: 'call', put: 'put' },
  kind: { hit: 'Mur atteint', break: 'Mur cassé', hold: 'Mur tenu' },
  kindChip: { hit: 'ATTEINT', break: 'CASSÉ', hold: 'TENU' },
  tier: {
    light: 'Faible',
    moderate: 'Modéré',
    above_typical: 'Au-dessus de la normale',
    strong: 'Fort',
    very_strong: 'Très fort',
  },
  headline: {
    hit: '{symbol} : mur {side} à {wall} atteint',
    break: '{symbol} : mur {side} à {wall} cassé',
    hold: '{symbol} : le mur {side} à {wall} a tenu',
  },
  hitShort: '{extreme_label} {price} · {distance} {relation}',
  extremeLabel: { call: 'Plus haut', put: 'Plus bas' },
  relationShort: { call: 'sous le mur', put: 'au-dessus du mur' },
  relationPast: 'au-delà du mur',
  atWall: 'sur le mur',
  approachN: '{nth} test aujourd’hui',
  breakDetail: {
    call: '{n} clôtures 1 min consécutives au-dessus de {level} · dernier {last}',
    put: '{n} clôtures 1 min consécutives sous {level} · dernier {last}',
  },
  holdDetail: {
    call: 'Repoussé à {price} ({off} du mur) après un plus haut à {peak}',
    put: 'Rebond à {price} ({off} du mur) après un plus bas à {peak}',
  },
  nextWall: { call: 'Prochain mur call : {wall}', put: 'Prochain mur put : {wall}' },
  strengthLine: 'Mur {tier_lc} · {pctile} sur les 30 derniers jours à cette heure',
  strengthUnknown: 'Force du mur pas encore évaluée',
  regime: {
    positive:
      'Les dealers sont longs gamma : leurs couvertures freinent les mouvements, les murs tiennent plus souvent.',
    negative:
      'Les dealers sont courts gamma : leurs couvertures amplifient les mouvements, les murs cèdent plus facilement.',
  },
  odds: 'Historique : les murs {side} de {symbol} ont cédé dans les {horizon} min suivant un test dans {pct} des cas.',
  ordinal: (n) => (n === 1 ? '1er' : `${n}e`),
  percentile: (n) => `${n}e centile`,
};

const COPIES: Record<string, WallAlertCopy> = { en: EN_WALL_ALERT_COPY, it: IT, de: DE, es: ES, fr: FR };

export function wallAlertCopyFor(locale: string | null | undefined): WallAlertCopy {
  return (locale && COPIES[locale]) || EN_WALL_ALERT_COPY;
}

export const WALL_ALERT_COPY_LOCALES = Object.keys(COPIES);
