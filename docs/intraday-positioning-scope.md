# Today's dealer positioning, not just last night's open interest (scope)

**Status:** scoped from this repo, not started. The work is in zerogex-oa, which
was not available to the session that wrote this; Phase 0 below is the first
thing to do there, and it can change the plan.

## The gap

On Nov 20, 2026 a member who left after six days said they keep SpotGamma Alpha
for its "more detailed dealer positioning". Our comparison page
(`frontend/content/articles/zerogex-vs-spotgamma.md`) already names the
difference: SpotGamma says its model (SGOI) estimates market-maker and customer
positions strike by strike, while we model positions from open interest under
the standard convention (dealers long calls, short puts).

The part that matters most for an intraday trader is timing. Open interest is
published once a day, so every dealer-positioning surface (the flip, the walls,
the GEX profile, the GEX heatmap) describes the book as of last night. A position
opened today never shows up, and much of SPX 0DTE trading is exactly that: an
expiration's last-day positions are largely opened and closed inside the session.
The Yordan note (`docs/outreach/2026-11-17-yordan-spx-0dte-oi-heatmap.md`)
already had to explain this to a member.

## What we already have

Facts from this repo; zerogex-oa has to confirm each one (Phase 0).

- **The open-interest book.** γ × open interest per strike and expiration, signed
  by the convention. Everything positioning-related is built on it.
- **Unsigned activity.** `/api/gex/volume-gamma-by-strike` weights the same
  per-contract gamma by today's traded contracts. The Gamma Terminal shows it as
  the "Volume" basis, and `frontend/core/ladderBasis.ts` is careful to call it an
  activity map, not positioning: it can't tell who was on each side.
- **Signed flow.** `flow_bar_contract` (`docs/flow-series-endpoint.md`) stores,
  per 5-minute bar and per contract (type, strike, expiration), `net_volume`:
  contracts bought at the ask minus contracts sold at the bid. Hedging Flow is
  built on it, with `basis: aggressor_inferred` and a disclosure
  (`docs/hedging-flow-history.md`).

The signed flow is the missing piece. Volume can't tell an opening trade from a
closing one, but for the dealer's position that does not matter: a dealer on the
other side of a trade gains or sheds exactly that many contracts whether the
customer was opening or closing. What matters is who was on which side, and
that is what `net_volume` estimates.

## The model

For each contract, at each bar t of the session:

```
dealer position(t) = baseline from open interest        (calls +OI, puts −OI: today's convention)
                   − Σ net_volume from the open to t    (a customer buying is a dealer selling)
dealer gamma(t)    = Σ over contracts  position(t) × γ(spot_t) × 100 × spot_t² × 1%
```

The flip, the walls and the GEX profile are then computed exactly as today, on
this book instead of last night's. The GEX heatmap gets a book per bar, so a band
can appear during the session when positions are opened at a strike, rather than
only brightening as price approaches last night's book.

**What it still is not.** It is an estimate on top of a model, and the label must
say so. The open-interest baseline keeps the standard convention. Aggressor
inference misreads some prints (mid-price fills, multi-leg orders, auctions).
And it assumes a dealer sits on one side of each trade. It is still better than
assuming nothing happened since last night, and Phase 2 measures by how much.

## Plan

**Phase 0: confirm the inputs (zerogex-oa, read-only, about half a day).**
- Does `flow_bar_contract` cover SPX and SPXW 0DTE (index options), not only the
  ETFs, and how quickly do bars land after they close?
- What share of contracts is left unsigned (mid-price or unclassified)? Above
  roughly a third on SPX, the estimate is too noisy to show as positioning.
- How many past sessions are stored? Phase 2 needs a few weeks to replay.

**Phase 1: compute it (zerogex-oa, about 2 to 4 days).** A `basis` parameter,
`oi` (the default, unchanged) or `oi_flow`, on the endpoints the positioning
surfaces read: `/api/gex/by-strike`, `/api/gex/profile` (the flip),
`/api/gex/summary` (flip and walls) and `/api/gex/heatmap` (a book per bar).
Nothing a member sees changes in this phase.

**Phase 2: prove it (about 2 days, before anything ships).** Replay the stored
sessions on both bases and compare what members act on:
- how often walls held when tested, with the method of the wall study
  (`/education/how-often-do-gamma-walls-break`);
- how often price respected the flip, and the pin.
Ship only if `oi_flow` is at least as good. If it is not, the replay says where
the estimate breaks, which is worth knowing anyway.

**Phase 3: show it (zerogex-web, about a day).** A "Positioning basis" switch on
Dealer Positioning and the GEX heatmap: "Open interest" or "Open interest +
today's trades (estimated)", following the Gamma Terminal's Volume switch, with
the disclosure on the page. Today's Read and the morning email stay on open
interest until the switch has earned its keep in use.

## Decisions for you

1. **Access to zerogex-oa** for the session that does Phases 0 and 1. Attaching
   it to the session that wrote this was refused by the permission check.
2. **Phase 2 is the gate.** Recommended: nothing reaches members unless the
   replay shows the new basis is at least as good as the current one.
