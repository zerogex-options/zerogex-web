import type { PageDictionary } from '@/core/LanguageContext';

// {board} is the symbol the widget follows while it is not set on its own:
// its half's on a split board, else the one picked at the top of the page.
export const dict: PageDictionary = {
  en: {
    ariaLabel: 'Underlying for this widget',
    titleFollowing: 'Following the board ({board}). Pick another symbol to change this widget alone.',
    titlePinned: 'Set for this widget alone. Pick {board} to follow the board again.',
    followBoard: 'Follow the board ({board})',
  },
  it: {
    ariaLabel: 'Sottostante per questo widget',
    titleFollowing: 'Segue la bacheca ({board}). Scegli un altro simbolo per cambiare solo questo widget.',
    titlePinned: 'Impostato solo per questo widget. Scegli {board} per seguire di nuovo la bacheca.',
    followBoard: 'Segui la bacheca ({board})',
  },
  de: {
    ariaLabel: 'Basiswert für dieses Widget',
    titleFollowing: 'Folgt dem Board ({board}). Wählen Sie ein anderes Symbol, um nur dieses Widget zu ändern.',
    titlePinned: 'Nur für dieses Widget festgelegt. Wählen Sie {board}, um wieder dem Board zu folgen.',
    followBoard: 'Dem Board folgen ({board})',
  },
  es: {
    ariaLabel: 'Subyacente de este widget',
    titleFollowing: 'Sigue el panel ({board}). Elige otro símbolo para cambiar solo este widget.',
    titlePinned: 'Fijado solo para este widget. Elige {board} para volver a seguir el panel.',
    followBoard: 'Seguir el panel ({board})',
  },
  fr: {
    ariaLabel: 'Sous-jacent de ce widget',
    titleFollowing: 'Suit le tableau ({board}). Choisissez un autre symbole pour ne changer que ce widget.',
    titlePinned: 'Défini pour ce seul widget. Choisissez {board} pour suivre à nouveau le tableau.',
    followBoard: 'Suivre le tableau ({board})',
  },
};
