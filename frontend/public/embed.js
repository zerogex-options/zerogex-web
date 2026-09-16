/*!
 * ZeroGEX embed resizer — https://zerogex.io/embed.js
 *
 * Optional companion to the gamma-levels widget. Each frame posts its rendered
 * height to the parent; this sizes the matching <iframe> so the card never sits
 * in a box with a scrollbar or a band of empty space under it. A host page that
 * omits this script still renders the widget correctly at the snippet's fixed
 * fallback height — that is why the snippet carries one.
 *
 * Deliberately dependency-free, un-minified and tiny: it runs on other people's
 * sites, where a publisher may reasonably want to read every line before
 * pasting it in. It reads nothing from the host page, sets no cookies, sends no
 * network requests, and touches only the iframes the snippet marked.
 */
(function () {
  'use strict';

  /* The origin this script was served from, which is also the only origin its
     frames can be served from — the snippet builds both URLs from the same
     base. Derived rather than hardcoded so the widget also works on a staging
     deploy; a fixed 'https://zerogex.io' would leave the resizer silently
     dead anywhere else, which is the kind of thing found in production. It is
     no weaker: the value comes from this script's own src, which the host page
     cannot change after load without re-fetching from that same origin. */
  var ORIGIN = 'https://zerogex.io';
  var src = document.currentScript && document.currentScript.src;
  /* .src reflects the RESOLVED url, so it is absolute for any script the
     browser actually fetched. A miss (no currentScript, or a non-http scheme)
     falls through to the production default rather than to a wildcard. String
     matching rather than new URL() keeps this ES5 and unable to throw, which
     matters for a file that runs on other people's sites. */
  var matched = src ? /^(https?:\/\/[^/]+)/.exec(src) : null;
  if (matched) ORIGIN = matched[1];
  /* A frame that reports more than this is malfunctioning, not tall. Caps the
     blast radius of a bad height on someone else's layout. */
  var MAX_HEIGHT = 2000;

  function onMessage(event) {
    /* Only our own frames may resize anything. Checking the origin is what
       stops an unrelated third-party frame on the host's page from moving our
       box around (or, with a wildcard, any box at all). */
    if (event.origin !== ORIGIN) return;

    var data = event.data;
    if (!data || data.zerogexEmbed !== 1) return;

    var height = Number(data.height);
    if (!isFinite(height) || height <= 0 || height > MAX_HEIGHT) return;

    /* Identify the frame by its window, never by an id in the message. The
       source window is set by the browser and cannot be forged by the sender,
       so a frame can only ever resize itself. */
    var frames = document.querySelectorAll('iframe[data-zerogex-embed]');
    for (var i = 0; i < frames.length; i++) {
      if (frames[i].contentWindow === event.source) {
        frames[i].style.height = height + 'px';
        return;
      }
    }
  }

  if (window.addEventListener) window.addEventListener('message', onMessage, false);
})();
