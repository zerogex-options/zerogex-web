# Reply to FirmTape (Yevhen), September 2026

Context: FirmTape's founder emailed cold, asking to be considered for the next
update of [Best GEX Tools](/education/best-gex-tools) and offering a screenshot
or a one-line description. We added them to Bucket 3 in that update, and added
tape reconstruction as a third calculation methodology. This is the reply.

**Send from:** whichever address the original landed on, so it threads.
**Subject:** Re: SPX dealer positioning

Two things worth knowing before sending:

- The article is already live with their entry. Saying so is the whole reason
  this reply gets answered — it costs nothing and it is true.
- The four questions are the claims we could not verify from outside. Their
  answers either firm up the entry or tell us to trim it. Asking is cheaper
  than guessing, and we currently publish neither the price nor the session
  count because neither could be confirmed.

Optional addition, if a relationship with them seems worth having: offer a
research trade. Our flip resolver reports NULL on degraded chains instead of
carrying the last good value forward, and the failure cases behind that would
probably be recognisable to someone who publishes their own misses. Left out of
the draft below to keep a first reply short.

---

## Draft

Yevhen,

Thanks for writing, and for leading with the misses. That is rarer than it
should be in this category.

You are in the comparison as of this week. I wrote the entry rather than using
your copy, which I hope you would expect. The short version: the dealer book is
reconstructed from the tape print by print rather than from open interest and a
sign convention, the zero-gamma flip carries a stated uncertainty, and there is
a free replay archive behind it. I also added tape reconstruction as a third
calculation methodology alongside spot-shift and per-strike aggregation,
because it belonged there regardless of who was doing it.

It is not a free win. The same update says the approach trades a modeling
assumption for a measurement problem, that per-print signing is genuinely hard,
and that any vendor taking that route should publish how often its signing is
correct against an independent source. You appear to be the only one who does,
and that is the strongest thing in your email — it is why the entry reads as
well as it does.

Yes to the screenshot, thank you. Four things alongside it and I will tighten
the entry:

1. The exact session count and start date for the free archive.
2. Whether the free levels are 15 minutes delayed, and whether the archive
   genuinely needs no account.
3. The current live price, so I can state it rather than saying "verify on
   their site".
4. A direct link to the signing-accuracy study, and its headline number.

One thing in return, since you clearly track the category: we shipped a free
hosted MCP server of our own this week, at zerogex.io/mcp, on our free delayed
levels. So the comparison now has two in it. Your email is what made me look at
that gap, and I would rather tell you than have you find it.

Good luck with the launch.

[Your name]
ZeroGEX
