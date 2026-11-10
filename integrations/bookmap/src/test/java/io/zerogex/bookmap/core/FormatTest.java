package io.zerogex.bookmap.core;

import io.zerogex.bookmap.testkit.Check;
import io.zerogex.bookmap.testkit.Test;

public class FormatTest {

    @Test
    public void decimalsFollowTheTick() {
        Check.eq(2, Format.decimalsFor(0.25, 0), "ES");
        Check.eq(2, Format.decimalsFor(0.01, 0), "SPY");
        Check.eq(1, Format.decimalsFor(0.5, 0), "half point");
        Check.eq(0, Format.decimalsFor(1.0, 0), "whole");
        Check.eq(2, Format.decimalsFor(1.0, 2), "minimum");
        Check.eq(3, Format.decimalsFor(0.005, 0), "fine tick");
        Check.eq(2, Format.decimalsFor(Double.NaN, 0), "unknown tick");
    }

    @Test
    public void pricesUseUsGrouping() {
        Check.eq("7,727.25", Format.price(7727.25, 2), "grouped");
        Check.eq("29,824.00", Format.price(29824, 2), "NQ");
        Check.eq("-", Format.price(Double.NaN, 2), "missing");
    }

    @Test
    public void deltasCarryASign() {
        Check.eq("+38.50", Format.delta(38.5, 2), "above");
        Check.eq("-12.25", Format.delta(-12.25, 2), "below");
        Check.eq("0.00", Format.delta(0.001, 2), "rounds to zero without a sign");
        Check.eq("", Format.delta(Double.NaN, 2), "no price");
    }

    @Test
    public void agesReadNaturally() {
        Check.eq("12s", Format.age(12), "seconds");
        Check.eq("4m", Format.age(4 * 60 + 10), "minutes");
        Check.eq("2h 05m", Format.age(2 * 3600 + 5 * 60), "hours");
        Check.eq("3d", Format.age(3 * 86400 + 100), "days");
        Check.eq("?", Format.age(-1), "unknown");
        Check.eq("$3.07B", Format.dollars(3.07e9), "billions");
        Check.eq("-$1.5M", Format.dollars(-1.5e6), "millions");
    }
}
