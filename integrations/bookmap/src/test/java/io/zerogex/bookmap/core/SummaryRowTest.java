package io.zerogex.bookmap.core;

import io.zerogex.bookmap.testkit.Check;
import io.zerogex.bookmap.testkit.Test;
import java.util.List;

public class SummaryRowTest {

    @Test
    public void historyRowsReadDecimalStringsAndKeepNulls() {
        long t = Fixtures.et(2026, 11, 10, 9, 45);
        String body = "[" + Fixtures.historyRow(t, 7727.0, 7526.25, null, 7626.75) + "]";
        List<SummaryRow> rows = SummaryRow.parseArray(body);
        Check.eq(1, rows.size(), "one row");
        SummaryRow r = rows.get(0);
        Check.eq(t, r.timestamp, "timestamp");
        Check.near(7727.0, r.level(LevelKind.CALL_WALL), 0, "string price parsed");
        Check.nan(r.level(LevelKind.GAMMA_FLIP), "null flip stays NaN");
        Check.nan(r.level(LevelKind.PIN_STRIKE), "no pin in history");
    }

    @Test
    public void summaryObjectCarriesThePostCloseMarkers() {
        long t = Fixtures.et(2026, 11, 9, 15, 59);
        SummaryRow r = SummaryRow.parseObject(Fixtures.summary(t, 7730, 7525, 7690, 7625, 7600, true));
        Check.isTrue(r.isPostClose(), "post-close");
        Check.near(7600, r.level(LevelKind.PIN_STRIKE), 0, "pin present in the summary");
    }

    @Test
    public void wrongShapesAreRejected() {
        Check.throwsA(IllegalArgumentException.class, () -> SummaryRow.parseArray("{}"), "object for array");
        Check.throwsA(IllegalArgumentException.class, () -> SummaryRow.parseObject("[]"), "array for object");
        Check.throwsA(IllegalArgumentException.class,
                () -> SummaryRow.parseObject("{\"timestamp\":\"not a time\"}"), "bad timestamp");
    }
}
