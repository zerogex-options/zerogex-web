// Page scroll lock for modals, sheets and the mobile menu.
//
// The document is the page's scroller (see the html/body rules in
// globals.css), so a lock has to hold the ROOT still: overflow:hidden on
// <html>, which is the value the viewport reads, and on <body> for engines
// that still consult it. Setting it on <body> alone -- what the modals used to
// do, back when <body> was the scroller -- leaves the page free to scroll
// underneath the overlay.
//
// Reference-counted, so two overlapping locks (the menu sheet open while the
// terms gate mounts, say) release in either order without the first release
// unlocking the page under the one still showing. Each release function is
// idempotent, which makes it safe to return straight from a useEffect.

let holders = 0;
let saved: { html: string; body: string } | null = null;

export function lockPageScroll(): () => void {
  if (typeof document === 'undefined') return () => {};
  const html = document.documentElement;
  const body = document.body;
  if (holders === 0) {
    saved = { html: html.style.overflow, body: body.style.overflow };
    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
  }
  holders += 1;

  let released = false;
  return () => {
    if (released) return;
    released = true;
    holders -= 1;
    if (holders === 0 && saved) {
      html.style.overflow = saved.html;
      body.style.overflow = saved.body;
      saved = null;
    }
  };
}
