import 'server-only';
import fs from 'node:fs';
import { DEFAULT_LOCALE } from '@/core/i18n/locales';
import { getRequestLocale } from '@/core/localizedMetadata';
import type { PageDictionary } from '@/core/LanguageContext';

// Server-component counterpart to usePageT (which is a client hook and can't run
// in a server component). Resolves the locale from the URL (the `x-zgx-locale`
// header the proxy sets from the path prefix, falling back to the `lang`
// cookie) and returns a translator bound to that locale, so server-rendered
// pages localize their prose from a co-located dictionary to match the URL.
// Type-only import of PageDictionary — erased at compile time, so no
// client/server boundary is crossed.
export async function getServerT(dict: PageDictionary) {
  const locale = await getRequestLocale();
  const table = dict[locale] ?? dict.en;
  return (key: string, vars?: Record<string, string | number>): string => {
    let value: string = table[key] ?? dict.en[key] ?? key;
    if (vars) {
      for (const [name, replacement] of Object.entries(vars)) {
        value = value.replace(new RegExp(`\\{${name}\\}`, 'g'), String(replacement));
      }
    }
    return value;
  };
}

// Server-side loader for the long-form markdown articles/guides/help. Given the
// English source path (…/foo.md) it returns the URL-language variant
// (…/foo.<locale>.md) when one exists, otherwise the English original.
//
// The locale comes from the URL (the proxy's `x-zgx-locale` header, cookie
// fallback), so `/it/education/foo` serves the Italian markdown while the
// unprefixed `/education/foo` serves English — each on its own indexable URL.
export async function loadLocalizedMarkdown(absoluteMdPath: string): Promise<string> {
  const locale = await getRequestLocale();

  if (locale !== DEFAULT_LOCALE) {
    const localizedPath = absoluteMdPath.replace(/\.md$/, `.${locale}.md`);
    try {
      return fs.readFileSync(localizedPath, 'utf8');
    } catch {
      // No translation for this locale yet — fall through to the English source.
    }
  }

  return fs.readFileSync(absoluteMdPath, 'utf8');
}
