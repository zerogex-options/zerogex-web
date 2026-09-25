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
- **The fix is on `claude/level-label-colors` (`fd3ad30`).** The names go back
  to their level's color. A color that is already readable is used exactly
  as-is. One that is too faint is deepened (light mode) or brightened (dark
  mode), same hue, just enough to clear 4.5:1. On the default dark theme that
  is the pre-change look. Every label now clears 4.5:1 in every theme.
- **Left alone on purpose:** the small dollar figures at the ends of the gamma
  bars went white in the same commit. Each sits against its own colored bar, so
  color never identified them, and nobody has asked.

## Verify first

- **Send after the deploy.** The draft says "it's live now". Open
  https://zerogex.io/chart in dark mode, hard-refresh, and check the level names
  are in color before sending.
- If you would rather reply before deploying, swap "It's live now, so a refresh
  should bring them back." for "It goes out with the next update."

## Draft

**Subject:** Re: ZeroGEX Site Features

Hi Bohdai,

You're right, and thanks for telling me. No other user asked for it. It came from a readability change I made this week.

In the light theme, a few of those label colors were genuinely hard to read: the yellow Max Pain and the teal Pin were faint against the pale background. My change went too far, though. It turned every label the same plain color in every theme, including dark mode, where the colors were fine. And you've put your finger on why that matters: at that size, the color is how you tell the labels apart at a glance.

So the colors are back. In dark mode the labels look the way they did before. In light mode they keep their colors too, just a shade deeper so they stay readable. The font stays small, like you said.

It's live now, so a refresh should bring them back. If anything else on the chart changed in a way that slows you down, just reply and tell me.

Best,
Michael
Founder, ZeroGEX

## If they reply

- **"Looks good."** Nothing to do.
- **They are on a non-default palette and a label looks a touch brighter than
  it used to.** Expected. In a few dark palettes, a color that was below the
  readability bar (Call Wall on Mars or Monochrome Madison, for example) is now
  brightened slightly. Same hue.
- **They want the bar figures in color too.** Small change, same helper.
  `RailBarLabel` in `frontend/components/GammaTerminalChart.tsx` would take its
  color back as a prop, passed through `levelInk`.
