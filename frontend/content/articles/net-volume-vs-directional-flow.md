# Net Volume vs Directional Flow: What Actually Matters in Options Tape?

*Most traders debate put/call volume versus directional flow. Professionals usually treat that as step one — then move quickly to premium-weighted conviction.*

---

## The Honest Answer: Neither Is a Gold Standard Alone

If you are looking for one perfect metric, you will be disappointed.

**Cumulative Net Volume** (`cumulative_net_volume`) and **Cumulative Net Directional Volume** (`cumulative_net_directional_volume`) are both useful, but they answer different questions. Serious flow desks typically monitor both — then place the most weight on premium metrics when sizing conviction.

---

## Metric 1: **Cumulative Net Volume** (`cumulative_net_volume`)

*(Call Volume − Put Volume)*

This is effectively the inverse framing of the classic put/call ratio.

It is widely used because it is simple, fast, and available everywhere. But it is also blunt.

The core weakness: **it cannot tell you who initiated the trade or why.**

A surge in call volume might mean:
- directional upside speculation,
- covered call overwriting,
- dealer inventory management,
- or hedge roll activity.

Volume alone cannot separate conviction from mechanics.

---

## Metric 2: **Cumulative Net Directional Volume** (`cumulative_net_directional_volume`)

*((Calls Bought − Calls Sold) − (Puts Bought − Puts Sold))*

This metric tries to answer the better question:

> **Who was the aggressor?**

When traders lift the ask, they are usually expressing urgency and directional intent. When they hit the bid, they are usually reducing risk, collecting premium, or fading.

In theory, this makes directional volume more informative than raw volume.

But it has a real weakness: **trade-side classification is imperfect.**

Most systems infer buyer/seller intent from bid/ask proximity. That breaks down when:
- blocks print near mid,
- negotiated crosses happen off-screen,
- or dark/complex executions do not map cleanly to lit quotes.

Ironically, those “messy” trades are often the most meaningful institutional prints.

---

## What Professional Flow Teams Actually Emphasize

### Premium, not contracts.

A 50,000-lot in cheap weekly lottery calls can look huge in volume, yet represent modest capital. A 500-lot in deep ITM contracts can carry dramatically more notional risk and information.

That is why desks tend to prioritize **capital-weighted flow**, not contract counts.

Your field:

**Cumulative Net Premium** (`cumulative_net_premium`)

`= (calls bought premium − calls sold premium) − (puts bought premium − puts sold premium)`

is generally a stronger single read on where informed money is leaning, because it reflects dollars actually committed.

---

## Practical Ranking for Conviction

If the goal is directional conviction quality:

1. **Net directional premium** (best single signal)
2. **Net directional volume** (better than raw volume)
3. **Net volume** (useful context, weakest standalone)

Or in one line:

> **net_directional_volume > net_volume for conviction, but net_directional_premium is what serious flow desks usually weight most.**

---

## How to Use This in a Live Workflow

A practical sequence traders can apply intraday:

- Start with **net volume** to read broad participation.
- Confirm with **net directional volume** to estimate aggressor intent.
- Validate with **net directional premium** before committing risk.
- If volume and premium disagree, trust the dollars before the contracts.

No single panel should drive your entire decision tree. But premium-weighted directional flow will usually keep you closer to the “informed money” signal and farther from noisy headline prints.
