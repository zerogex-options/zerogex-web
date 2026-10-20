'use client';

/**
 * The <option>s of a native symbol dropdown, grouped under one heading per
 * asset class (ETFs, Indexes, Futures, Stocks) in picker order. Shared by every
 * symbol <select> so they all group the same way and a new symbol appears in
 * each of them under its class.
 *
 * `options` narrows the list (a comparison column that leaves out the primary
 * symbol, say). A group left with no symbols is not drawn.
 */

import { SYMBOL_GROUPS, type PickerSymbol } from '@/core/symbols';
import { usePageT } from '@/core/LanguageContext';
import { dict } from './SymbolOptions.i18n';

export default function SymbolOptions({ options }: { options?: readonly PickerSymbol[] }) {
  const t = usePageT(dict);
  return (
    <>
      {SYMBOL_GROUPS.map((group) => {
        const symbols = options ? group.symbols.filter((s) => options.includes(s)) : group.symbols;
        if (symbols.length === 0) return null;
        return (
          <optgroup key={group.assetClass} label={t(group.assetClass)}>
            {symbols.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </optgroup>
        );
      })}
    </>
  );
}
