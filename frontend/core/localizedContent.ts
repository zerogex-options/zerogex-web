import 'server-only';
import fs from 'node:fs';
import { cookies } from 'next/headers';
import { DEFAULT_LOCALE, normalizeLocale } from '@/core/i18n/locales';

// Server-side loader for the long-form markdown articles/guides/help. Given the
// English source path (…/foo.md) it returns the reader's-language variant
// (…/foo.<locale>.md) when one exists, otherwise the English original.
//
// Reading the `lang` cookie opts the calling route into dynamic rendering, so
// the same URL serves each visitor their chosen language. (Localized URLs +
// hreflang for SEO would be a separate, larger routing change; this delivers
// the user-facing translation the content needs.)
export async function loadLocalizedMarkdown(absoluteMdPath: string): Promise<string> {
  let locale = DEFAULT_LOCALE;
  try {
    const store = await cookies();
    locale = normalizeLocale(store.get('lang')?.value);
  } catch {
    // Outside a request scope (e.g. static generation) — fall back to English.
  }

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
