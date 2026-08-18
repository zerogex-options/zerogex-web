'use client';

/**
 * An optional per-subtree override for the expiration filter.
 *
 * Normally every expiration-filtering chart in a tab shares ONE selection (see
 * hooks/useSharedExpirations) — pick a Friday on the GEX Profile and the Gamma
 * Terminal rail follows. That is the right default for a page showing one view
 * of one chain.
 *
 * A split "My Dashboard" board breaks that assumption on purpose: the whole
 * point of cloning one half to the other is to read this Friday against next
 * Friday, side by side, in the same tab. So a pane may install a scope here,
 * and useSharedExpirations() hands every chart *inside that pane* the pane's own
 * selection and setter instead of the tab-wide store. Charts outside any scope —
 * every other page on the site — are untouched.
 *
 * Kept in its own module (rather than inside the hook) so the hook file stays a
 * plain .ts with no JSX, and so a consumer can provide the context without
 * pulling in the hook.
 */

import { createContext } from 'react';

export type ExpirationScopeValue = {
  /** The active selection for this subtree; an empty array means "All". */
  selection: string[];
  /** Replace this subtree's selection. */
  setSelection: (next: readonly string[]) => void;
};

/**
 * `null` (the default) means "no override" — consumers fall through to the
 * tab-wide shared store, which is the behaviour everywhere outside a scoped
 * pane.
 */
export const ExpirationScopeContext = createContext<ExpirationScopeValue | null>(null);
