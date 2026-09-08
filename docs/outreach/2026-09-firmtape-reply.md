# Reply to FirmTape (Yevhen), September 2026

Context: FirmTape's founder emailed cold, asking to be considered for the next
update of [Best GEX Tools](/education/best-gex-tools) and offering a screenshot
or a one-line description. We added them to Bucket 3 in that update. This is the
reply.

**Send from:** whichever address the original landed on, so it threads.
**Subject:** Re: SPX dealer positioning

Two things worth knowing before sending:

- The article is already live with their entry. Saying so is the whole reason
  this reply gets answered — it costs nothing and it is true.
- The claims we could not verify from outside are listed explicitly. Their
  answers either firm up the entry or tell us to trim it. Either is useful, and
  asking is cheaper than guessing.

---

## Draft

Yevhen,

Thanks for writing, and for leading with the misses rather than burying them.
That is rarer than it should be in this category.

FirmTape is in the comparison as of this week. I wrote the entry rather than
using your copy, which I hope you would expect. The short version: the dealer
book is reconstructed from the options tape print by print rather than from open
interest and a sign convention, the zero-gamma flip carries a stated
uncertainty, and there is a free replay archive of past SPX sessions behind it.
I also added tape reconstruction as a third calculation methodology alongside
spot-shift and per-strike aggregation, because it belonged there regardless of
who was doing it.

I did not treat it as a free win for you. The same update says the approach
trades a modeling assumption for a measurement problem, that per-print signing
is genuinely hard, and that anyone taking that route should publish how often
their signing is correct against an independent source. You appear to be the
only vendor in the category who does, which is the strongest thing in your
email and the reason the entry reads as favourably as it does.

Yes to the screenshot, thank you. If you can confirm four things alongside it, I
will tighten the entry:

1. The exact session count and start date for the free archive.
2. Whether the free levels are 15 minutes delayed, and whether the archive
   genuinely needs no account.
3. The current live price, so I can either state it or keep saying "verify on
   their site".
4. A direct link to the signing-accuracy study, and the headline number.

One thing you should know in return, since you clearly track the category: we
have shipped a free hosted MCP server of our own, at
`https://zerogex.io/mcp`, on our free delayed levels. So the comparison now has
two of them in it. That is not a dig; your email is what made me look at that
gap, and I would rather tell you than have you find it.

I would take a research trade too, if you are open to it. Our flip resolver
reports NULL on degraded chains instead of carrying the last good value forward,
and the failure cases we hit getting there would probably be recognisable to
you.

Good luck with the launch.

[name]
ZeroGEX
