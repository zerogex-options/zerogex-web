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

  // Left navigation / sidebar. Section headers and generic entries translate;
  // trading feature names (Max Pain, Smart Money, GEX, Vanna/Charm, …) and
  // tickers stay in English on purpose, so no labelKey is assigned to them.
  'nav.group.main': 'Main',
  'nav.group.signals': 'Signals',
  'nav.group.metrics': 'Metrics',
  'nav.group.strategyTools': 'Strategy Tools',
  'nav.group.education': 'Education',
  'nav.group.admin': 'Admin',
  'nav.group.more': 'More',
  'nav.dashboard': 'Dashboard',
  'nav.myDashboard': 'My Dashboard',
  'nav.liveBulletin': 'Live Bulletin',
  'nav.compositeScore': 'Composite Score',
  'nav.basicSignalDashboard': 'Basic Signal Dashboard',
  'nav.advancedSignalDashboard': 'Advanced Signal Dashboard',
  'nav.botTrading': 'Bot Trading',
  'nav.backtesting': 'Backtesting',
  'nav.patternInsights': 'Pattern Insights',
  'nav.strategyBuilder': 'Strategy Builder',
  'nav.liveOptionsQuotes': 'Live Options Quotes',
  'nav.dailyReplay': 'Daily Replay',
  'nav.dailyForecast': 'Daily Forecast',
  'nav.hub': 'Hub',
  'nav.guides': 'Guides',
  'nav.articles': 'Articles',
  'nav.help': 'Help',
  'nav.quickStarts': 'Quick Starts',
  'nav.platformGuide': 'Platform Guide',
  'nav.monitoring': 'Monitoring',
  'nav.pageAnalytics': 'Page Analytics',
  'nav.ambassadors': 'Ambassadors',
  'nav.about': 'About',
  'nav.account': 'Account',
  'nav.collapse': 'Collapse {name}',
  'nav.expand': 'Expand {name}',
  'nav.hideSidebar': 'Hide left navigation',
  'nav.showSidebar': 'Show left navigation',
  'nav.menu': 'menu',

  // Footer
  'footer.navigation': 'Navigation',
  'footer.platform': 'Platform',
  'footer.freeGammaLevels': 'Free Gamma Levels',
  'footer.updates': 'Updates',
  'footer.givingBack': 'Giving Back',
  'footer.apiDocs': 'API Docs',
  'footer.privacy': 'Privacy',
  'footer.terms': 'Terms',
  'footer.veteransBadge': '3% supports veterans',
  'footer.rights': '© 2026 ZeroGEX, All rights reserved.',
  'footer.disclaimer':
    'ZeroGEX provides options-market analytics and educational content for informational purposes only. It is not investment advice, and ZeroGEX is not a broker-dealer or a registered investment adviser. Options trading involves significant risk and is not suitable for all investors. Past performance is not indicative of future results.',

  // Login page
  'login.title': 'Sign in to ZeroGEX',
  'login.subtitle':
    'Use your account credentials to authenticate. Session tokens are secure, HttpOnly cookies.',
  'login.valueProp': 'ZeroGEX helps traders understand where the market may react before price gets there.',
  'login.submit': 'Sign in',
  'login.submitting': 'Signing in...',
  'login.forgotPassword': 'Forgot password?',
  'login.continueGoogle': 'Continue with Google',
  'login.continueApple': 'Continue with Apple (coming soon)',
  'login.createAccount': 'Create account',
  'login.backToLanding': 'Back to landing',
  'login.csrfError': 'Unable to initialize secure login. Please refresh and try again.',
  'login.genericError': 'Login failed',
} as const;

export type TranslationKey = keyof typeof en;

// Every non-English dictionary is typed as Dictionary, so a missing or extra
// key is a compile-time error rather than a silent runtime fallback.
export type Dictionary = Record<TranslationKey, string>;
