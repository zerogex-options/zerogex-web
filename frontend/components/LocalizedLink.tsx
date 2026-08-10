'use client';

import Link from 'next/link';
import { forwardRef, type ComponentPropsWithoutRef } from 'react';
import { useLanguage } from '@/core/LanguageContext';
import { localeHref } from '@/core/i18n/routing';

// Drop-in replacement for next/link that prefixes a root-relative internal href
// with the active locale, so navigating stays inside the current language
// (/it/... -> /it/...). External URLs, anchors, and mailto:/tel: pass through
// untouched (localeHref no-ops on them). Works when rendered from a server
// component too — it hydrates under the URL-seeded LanguageProvider, so the SSR
// href is already correctly prefixed for crawlers.
type LocalizedLinkProps = Omit<ComponentPropsWithoutRef<typeof Link>, 'href'> & {
  href: string;
};

const LocalizedLink = forwardRef<HTMLAnchorElement, LocalizedLinkProps>(
  function LocalizedLink({ href, ...rest }, ref) {
    const { locale } = useLanguage();
    return <Link ref={ref} href={localeHref(locale, href)} {...rest} />;
  },
);

export default LocalizedLink;
