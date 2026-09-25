# Gamma Chart level label colors: Bohdai (2026-09-25)

Bohdai (bohdai citta) wrote in at 9:13 AM, subject "ZeroGEX Site Features":

> I noticed on the main ZeroGEX Gamma Chart that the label text for
> Pin/Call Wall/Put Wall/etc changed this week to white. I liked it better when
> the text was the color of the rest of the particular level, did a different
> user ask for this?
>
> The text is pretty small, so when each text label color matches, the color is
> a clue to what you're looking at, so you can more quickly determine what it
> is. With all the labels white, you have to very specifically peer and study to
> read the tiny font.
>
> I don't think the font size is a problem, you want to keep is small for this
> chart, but having the text match its level is superior, IMO.

A 1:1 founder reply from your own inbox. American English, one line per
paragraph in the draft, so it pastes straight into a mail client.

## The read

- **Nobody asked for it.** The labels went white in `4f09a52` (2026-09-22),
  part of a readability sweep across the chart's small text. The raw level
  colors cleared the 4.5:1 contrast bar on their chips in only 105 of 192
  theme/level combinations.
- **Almost all of those failures were light mode.** Examples: amber Max Pain,
  teal Pin and sky-blue Flip on a cream card, around 2.5:1. On the default dark
  theme, 7 of 8 level colors were already fine. So the fix solved a light-mode
  problem by taking the color cue away from everyone, dark-mode members
  included. Bohdai says the labels went "white", so they are on dark mode.
- **The fix is on `claude/level-label-colors`.** The level names and the
  gamma bars' dollar figures go back to their own colors. A color that is
  already readable is used exactly as-is. One that is too faint is deepened
  (light mode) or brightened (dark mode), same hue, just enough to clear 4.5:1.
  On the default dark theme that is the pre-change look. Every label and figure
  now clears 4.5:1 in every theme.
- **Framing.** The reply gives the reason as the theme count: 12 palettes, each
  in light and dark, with a few label colors hard to read in some of them. Keep
  any follow-up to that.

## Verify first

- **This goes out before the deploy.** The draft says the fix "goes out with
  the next update", so there is nothing to check before sending.
- **After the deploy**, open https://zerogex.io/chart in dark mode, hard-refresh,
  and check that the level names and the gamma bars' dollar figures are in
  color.

## Draft

**Subject:** Re: ZeroGEX Site Features

Hi Bohdai,

You're right, and thanks for telling me. No other user asked for it.

The chart has 12 color themes, each with a light and a dark version, and in some of those combinations a few of the label colors were hard to read against the background. Switching every label to plain text made them readable everywhere, but you've put your finger on what that cost: at that size, the color is how you tell the labels apart at a glance.

So I'm putting the colors back, tuned for each theme so they stay readable in all of them. The dollar figures on the gamma bars get their colors back too, and the font stays small, like you said.

It goes out with the next update. If anything else on the chart changed in a way that slows you down, just reply and tell me.

Best,
Michael
Founder, ZeroGEX

## If they reply

- **"Looks good."** Nothing to do.
- **They are on a non-default palette and a label looks a touch brighter than
  it used to.** Expected. In a few dark palettes, a color that was below the
  readability bar (Call Wall on Mars or Monochrome Madison, for example) is now
  brightened slightly. Same hue.
