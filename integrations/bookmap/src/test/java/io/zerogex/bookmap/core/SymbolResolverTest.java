package io.zerogex.bookmap.core;

import io.zerogex.bookmap.testkit.Check;
import io.zerogex.bookmap.testkit.Test;
import java.time.LocalDate;

public class SymbolResolverTest {

    private static final LocalDate TODAY = LocalDate.of(2026, 11, 10);

    private static SymbolResolver.Resolution auto(String alias, String symbol) {
        return SymbolResolver.resolve("AUTO", alias, symbol, null, TODAY);
    }

    @Test
    public void readsEveryConnectionsNameForTheSameContract() {
        String[][] cases = {
            {"ESZ6.CME@RITHMIC", null},          // Rithmic alias
            {"ESZ6.CME@RITHMIC", "ESZ6"},        // with the bare symbol
            {"F.US.EPZ26", null},                // CQG: EP is the E-mini S&P
            {"/ESZ26:XCME", null},               // dxFeed
            {"ESZ2026", null},
            {"ES 12-26", null},                  // NinjaTrader style
            {"ES-202612", null},                 // year-month
            {"ESZ6-CME@SOMEFEED", null},         // exchange after a dash
            {"ES Z6", null},
        };
        for (String[] c : cases) {
            SymbolResolver.Resolution r = auto(c[0], c[1]);
            Check.eq("ES", r.apiSymbol, "symbol for " + c[0]);
            Check.eq("ESZ26", r.chartContract, "contract for " + c[0]);
            Check.isFalse(r.micro, "not micro: " + c[0]);
        }
    }

    @Test
    public void microsDrawTheFullSizeLevels() {
        SymbolResolver.Resolution mes = auto("MESZ6.CME@RITHMIC", "MESZ6");
        Check.eq("ES", mes.apiSymbol, "MES -> ES");
        Check.eq("ESZ26", mes.chartContract, "contract normalized to the ES root");
        Check.isTrue(mes.micro, "flagged micro");
        SymbolResolver.Resolution mnq = auto("F.US.MNQH27", null);
        Check.eq("NQ", mnq.apiSymbol, "MNQ -> NQ");
        Check.eq("NQH27", mnq.chartContract, "March contract");
        Check.eq("NQ", auto("F.US.ENQZ26", null).apiSymbol, "CQG ENQ -> NQ");
    }

    @Test
    public void stocksEtfsAndIndicesPassThrough() {
        Check.eq("SPY", auto("SPY@DXFEED", "SPY").apiSymbol, "SPY");
        Check.eq("QQQ", auto("QQQ.NASDAQ", null).apiSymbol, "QQQ with exchange");
        Check.eq("SPX", auto("$SPX", null).apiSymbol, "index with $");
        Check.eq("NDX", auto("^NDX", null).apiSymbol, "index with ^");
        Check.eq("NVDA", auto("NVDA", "NVDA").apiSymbol, "stock");
        Check.eq(null, auto("SPY", "SPY").chartContract, "no contract for a stock");
    }

    @Test
    public void continuousFuturesResolveWithoutAContract() {
        for (String alias : new String[] {"ES", "@ES", "ES#", "ES1!", "MNQ"}) {
            SymbolResolver.Resolution r = auto(alias, null);
            Check.isTrue(r.isResolved(), alias);
            Check.eq(null, r.chartContract, "no contract for " + alias);
        }
    }

    @Test
    public void otherContractsAreNotGuessed() {
        for (String alias : new String[] {"CLZ6.NYMEX@RITHMIC", "GCZ25", "6EZ6", "BTCUSDT", "", "  "}) {
            Check.isFalse(auto(alias, null).isResolved(), "should not map " + alias);
        }
    }

    @Test
    public void anOverrideWinsButKeepsTheRollWarning() {
        SymbolResolver.Resolution forced = SymbolResolver.resolve("es", "ESH7.CME@RITHMIC", "ESH7", null, TODAY);
        Check.eq("ES", forced.apiSymbol, "override");
        Check.eq("ESH27", forced.chartContract, "contract kept because it agrees with the override");

        SymbolResolver.Resolution other = SymbolResolver.resolve("SPX", "ESH7.CME@RITHMIC", "ESH7", null, TODAY);
        Check.eq("SPX", other.apiSymbol, "override to another symbol");
        Check.eq(null, other.chartContract, "no contract claimed for a different symbol");

        Check.eq("ES", SymbolResolver.resolve("MES", "SPY", "SPY", null, TODAY).apiSymbol, "MES override -> ES");
    }

    @Test
    public void oneDigitYearsLandInTheNearestDecade() {
        Check.eq(2026, SymbolResolver.expandYear("6", LocalDate.of(2026, 11, 10)), "same year");
        Check.eq(2027, SymbolResolver.expandYear("7", LocalDate.of(2026, 11, 10)), "next year");
        Check.eq(2030, SymbolResolver.expandYear("0", LocalDate.of(2029, 12, 1)), "across the decade");
        Check.eq(2029, SymbolResolver.expandYear("9", LocalDate.of(2030, 1, 5)), "a just-expired contract");
        Check.eq(2026, SymbolResolver.expandYear("26", TODAY), "two digits");
        Check.eq(2026, SymbolResolver.expandYear("2026", TODAY), "four digits");
    }

    @Test
    public void contractMismatchIsReportedOnlyWhenBothAreKnownAndDiffer() {
        Check.eq(null, SymbolResolver.contractMismatch("ESZ26", "ESZ26"), "same");
        Check.eq(null, SymbolResolver.contractMismatch(null, "ESZ26"), "chart unknown");
        Check.eq(null, SymbolResolver.contractMismatch("ESZ26", null), "levels unknown");
        String[] m = SymbolResolver.contractMismatch("ESH27", "esz26");
        Check.eq("ESH27", m[0], "chart");
        Check.eq("ESZ26", m[1], "levels, normalized");
    }
}
