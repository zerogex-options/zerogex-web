// English is the source-of-truth dictionary: its keys define the shape every
// other locale must satisfy (see Dictionary below). Keep keys namespaced by
// surface (language.*, menu.*, register.*) so the file stays navigable as the
// translated surface area grows.

export const en = {
  // Language picker
  'language.label': 'Language',
  'language.select': 'Select language',

  // Header account / profile menu
  'menu.openProfile': 'Open profile menu',
  'menu.toggleTheme': 'Toggle theme',
  'menu.account': 'Account',
  'menu.upgrade': 'Upgrade',
  'menu.login': 'Login',
  'menu.logout': 'Logout',
  'menu.logoutMobile': 'Log out',

  // Register / signup page
  'register.title': 'Create your ZeroGEX account',
  'register.referralBanner': '🎉 A friend referred you — your discount is applied at checkout.',
  'register.campaignBanner': '🎯 Your discount is applied automatically at checkout.',
  'register.trialInfo':
    'Start your 7-day free trial after account creation. No charge until day 7. Cancel anytime.',
  'register.valueProp':
    'ZeroGEX helps SPY, SPX, and QQQ traders track live gamma levels, dealer positioning, flow pressure, and market state signals before price gets there.',
  'register.languageLabel': 'Language',
  'register.emailLabel': 'Email',
  'register.passwordLabel': 'Password',
  'register.passwordHint': 'Use a strong password — 12 or more characters.',
  'register.submit': 'Create Account & Continue to Trial',
  'register.submitting': 'Creating account…',
  'register.nextStep': 'Next step: choose your plan. No charge until day 7.',
  'register.haveAccount': 'Already have an account? Sign in',
  'register.csrfError':
    'Couldn’t initialize secure signup. Please refresh and try again. If you’ve blocked cookies for this site, allow them first.',
  'register.genericError': 'Registration failed',
} as const;

export type TranslationKey = keyof typeof en;

// Every non-English dictionary is typed as Dictionary, so a missing or extra
// key is a compile-time error rather than a silent runtime fallback.
export type Dictionary = Record<TranslationKey, string>;
