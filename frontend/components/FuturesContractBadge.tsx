"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  FUTURES_CONTRACT_EXPLAINER,
  FUTURES_CONTRACT_HELP_HREF,
  FUTURES_CONTRACT_HELP_LABEL,
  futuresContractDescription,
  resolveFuturesContract,
} from "@/core/futuresContract";
import { estimateTooltipHeight, resolveTooltipGeometry, type TooltipGeometry } from "@/core/tooltipPlacement";

/**
 * A futures price's chip, which names the CME contract behind the number.
 *
 * The problem it solves is a labelling gap, not a data problem. "NQ" does not
 * say WHICH NQ, and two charts both labelled "NQ" can be a quarter of
 * cost-of-carry apart — about 300 points — the moment one provider has rolled
 * to the next contract and the other has not. Readers reasonably concluded our
 * feed was broken. This names the contract on screen and links to the article
 * explaining the mechanism.
 *
 * Three things it has to get right:
 *
 *  1. It degrades to today's markup. `data_contract` is optional and absent for
 *     everything that is not a future, and also absent from an older backend or
 *     a cached response. With no contract this renders the plain chip the call
 *     site passed (or nothing at all, when the surface had no chip before), so
 *     there is no empty tooltip, no "undefined", and no layout shift.
 *  2. It is not hover-only. This is the explanation for a number the reader
 *     believes is wrong, so it opens on focus and on tap as well, the article
 *     link sits in the natural tab order right after the trigger, and the whole
 *     explanation is the button's accessible description whether or not the
 *     panel is ever opened.
 *  3. It is display only. The contract code is rendered and never used to key a
 *     cache, a request, or persisted state — see core/futuresContract.ts.
 *
 * The panel is portaled to <body> and positioned from the same
 * core/tooltipPlacement geometry every other tooltip uses. It has to be: the
 * gamma terminal's card carries `overflow: hidden` AND a retained
 * `transform: translateY(0)` from its entrance animation, and a transform makes
 * an element a containing block for `position: fixed` descendants — so an
 * in-flow panel was laid out against the card and then clipped away by it. A
 * portal is the only placement that survives an arbitrary ancestor.
 *
 * The cost of the portal is the browser's sequential focus order, which the
 * panel leaves when it leaves the DOM subtree, so Tab is bridged explicitly
 * between the trigger and the article link (see onKeyDown below). React's
 * synthetic focus events still bubble through the React tree from a portal, so
 * the open/close tracking on the wrapper is unaffected.
 */
interface Props {
  /** `data_contract` from the quote or bar. Absent for anything not a future. */
  contract?: string | null;
  /** `data_contract_expiry` — ISO date, that contract's expiry. */
  expiry?: string | null;
  /**
   * One extra line inside the panel, above the standing explanation. Used by
   * the chart chip to say the visible range crosses a roll.
   */
  note?: string | null;
  /**
   * The chip's visible content. Defaults to the contract code, which is the
   * point on a surface that had no chip before. Pass the existing chip's
   * content on a surface that already had one, so it reads the same.
   */
  children?: React.ReactNode;
  /** `title` for the non-interactive fallback chip, i.e. today's tooltip text. */
  fallbackTitle?: string;
  className?: string;
  style?: React.CSSProperties;
}

const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

export default function FuturesContractBadge({
  contract,
  expiry,
  note,
  children,
  fallbackTitle,
  className,
  style,
}: Props) {
  // Hover, keyboard focus and tap are three independent ways in, and each has
  // to be able to close without cancelling the others: a tap that pins the
  // panel open must survive the pointer leaving, and tabbing to the article
  // link must not close the panel out from under the focus that just moved
  // into it.
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [layout, setLayout] = useState<TooltipGeometry | null>(null);

  const wrapperRef = useRef<HTMLSpanElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLSpanElement>(null);
  const linkRef = useRef<HTMLAnchorElement>(null);
  const hoverCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panelId = useId();
  const descriptionId = useId();

  // The panel is portaled, so it is NOT a DOM descendant of the wrapper: both
  // halves have to be asked whether a node is still inside this control, or a
  // click or a focus landing in the panel reads as one landing outside it.
  const insideControl = useCallback(
    (node: Node | null) =>
      !!node && (!!wrapperRef.current?.contains(node) || !!panelRef.current?.contains(node)),
    [],
  );

  // The panel sits a gap away from the chip, so the pointer is briefly over
  // neither on its way to the article link. Closing on the first `pointerleave`
  // would shut the panel before the mouse arrived, which makes the link
  // mouse-unreachable — a short grace period is what lets it be clicked.
  const cancelHoverClose = useCallback(() => {
    if (hoverCloseTimer.current) clearTimeout(hoverCloseTimer.current);
    hoverCloseTimer.current = null;
  }, []);
  const openOnHover = useCallback(() => {
    cancelHoverClose();
    setHovered(true);
  }, [cancelHoverClose]);
  const scheduleHoverClose = useCallback(() => {
    cancelHoverClose();
    hoverCloseTimer.current = setTimeout(() => setHovered(false), 140);
  }, [cancelHoverClose]);

  useEffect(() => cancelHoverClose, [cancelHoverClose]);

  const resolved = resolveFuturesContract(contract, expiry);
  const open = !!resolved && (hovered || focused || pinned);
  const description = resolved
    ? note
      ? `${futuresContractDescription(resolved)} ${note}`
      : futuresContractDescription(resolved)
    : "";

  const updateLayout = useCallback(() => {
    if (!triggerRef.current || typeof window === "undefined") return;
    const rect = triggerRef.current.getBoundingClientRect();
    setLayout(
      resolveTooltipGeometry({
        anchor: { top: rect.top, bottom: rect.bottom, left: rect.left, width: rect.width },
        viewport: { width: window.innerWidth, height: window.innerHeight },
        // The measured box once it exists; the estimate only covers the first
        // frame, before the panel has been laid out.
        height: panelRef.current?.offsetHeight || estimateTooltipHeight(description),
      }),
    );
  }, [description]);

  // Correct the first frame's estimate against the real box before paint, so a
  // long panel never appears half off screen and then snaps back.
  useIsomorphicLayoutEffect(() => {
    if (!open) return;
    updateLayout();
  }, [open, updateLayout]);

  useEffect(() => {
    if (!open) return;

    const reposition = () => updateLayout();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      // Escape dismisses every way the panel could be open and hands focus
      // back to the trigger, rather than leaving a pinned panel that only a
      // mouse could close.
      cancelHoverClose();
      setPinned(false);
      setHovered(false);
      setFocused(false);
      triggerRef.current?.focus();
    };
    const handlePointerDown = (event: PointerEvent) => {
      if (insideControl(event.target as Node)) return;
      setPinned(false);
    };

    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [open, updateLayout, cancelHoverClose, insideControl]);

  // No contract: render exactly what this surface rendered before. A surface
  // that had no chip (the natively-served ES / NQ header price) passes no
  // children and gets nothing, so an older backend or a cached response leaves
  // the layout untouched rather than leaving a hole where a chip would be.
  if (!resolved) {
    if (!children) return null;
    return (
      <span className={className} style={style} title={fallbackTitle}>
        {children}
      </span>
    );
  }

  const panel = (
    <span
      ref={panelRef}
      id={panelId}
      className="zg-contract-panel"
      style={{
        top: layout?.top ?? 0,
        left: layout?.left ?? 0,
        width: layout ? `${layout.width}px` : undefined,
        // Hidden until the geometry lands, so the panel never flashes at the
        // top-left corner on its first frame.
        visibility: layout ? "visible" : "hidden",
      }}
      onPointerEnter={(event) => {
        if (event.pointerType !== "mouse") return;
        openOnHover();
      }}
      onPointerLeave={(event) => {
        if (event.pointerType !== "mouse") return;
        scheduleHoverClose();
      }}
    >
      {/* The prose duplicates the accessible description above, so it is hidden
          from assistive tech to avoid reading the same paragraph twice. The
          link is deliberately outside it and stays reachable. */}
      <span aria-hidden="true" style={{ display: "block" }}>
        <span className="zg-contract-panel-code">{resolved.code}</span>
        {resolved.descriptor && <span> — {resolved.descriptor}</span>}
        {resolved.expiryLine && (
          <span style={{ display: "block", opacity: 0.8 }}>{resolved.expiryLine}</span>
        )}
        {note && <span style={{ display: "block", marginTop: 6, opacity: 0.9 }}>{note}</span>}
        <span style={{ display: "block", marginTop: 6, opacity: 0.9 }}>
          {FUTURES_CONTRACT_EXPLAINER}
        </span>
      </span>
      <Link
        ref={linkRef}
        href={FUTURES_CONTRACT_HELP_HREF}
        className="zg-contract-panel-link"
        onKeyDown={(event) => {
          if (event.key !== "Tab") return;
          if (event.shiftKey) {
            // Back to the chip itself, not to whatever precedes it — the
            // portal would otherwise drop the user at the end of the document.
            event.preventDefault();
            triggerRef.current?.focus();
            return;
          }
          // Forward: move the focus back to the chip WITHOUT preventing the
          // default, so the browser resumes its own tab order from there and
          // lands on whatever follows the chip on the page. The trigger's blur
          // then closes the panel.
          triggerRef.current?.focus();
        }}
        onClick={() => {
          cancelHoverClose();
          setPinned(false);
          setHovered(false);
        }}
      >
        {FUTURES_CONTRACT_HELP_LABEL} →
      </Link>
    </span>
  );

  return (
    <span
      ref={wrapperRef}
      style={{ display: "inline-flex" }}
      // Focus is tracked on the wrapper, not the trigger, because React's
      // onFocus / onBlur are focusin / focusout and therefore bubble — through
      // the portal too, since React events follow the React tree rather than
      // the DOM one. Keyboard focus moving from the chip INTO the panel has to
      // keep it open, and focus leaving the link for the next control on the
      // page has to close it. Watching the button alone gets the first case
      // right and then never hears about the second, leaving the panel open
      // over the page for the rest of the session.
      onFocus={() => {
        updateLayout();
        setFocused(true);
      }}
      onBlur={(event) => {
        if (insideControl(event.relatedTarget as Node | null)) return;
        setFocused(false);
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        className={className ? `zg-contract-trigger ${className}` : "zg-contract-trigger"}
        style={style}
        // The description is a separate always-present node rather than the
        // panel itself: a screen reader reaches the whole explanation on
        // landing on the trigger, without having to discover that something
        // opens.
        aria-describedby={descriptionId}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        // Pointer type is checked rather than assumed: a tap also fires the
        // mouse-compatibility events, and a phantom "hover" that never ends
        // would leave the panel stuck open with no way to dismiss it.
        onPointerEnter={(event) => {
          if (event.pointerType !== "mouse") return;
          updateLayout();
          openOnHover();
        }}
        onPointerLeave={(event) => {
          if (event.pointerType !== "mouse") return;
          scheduleHoverClose();
        }}
        onKeyDown={(event) => {
          // The panel is portaled, so the browser's next tab stop after this
          // chip is whatever follows it on the page, not the article link.
          // Hand focus across explicitly, or the link is mouse-only.
          if (!open || event.key !== "Tab" || event.shiftKey || !linkRef.current) return;
          event.preventDefault();
          linkRef.current.focus();
        }}
        onClick={(event) => {
          // Touch has no hover, so the tap has to latch the panel open. Stop
          // the click here: several of these chips sit inside cards that toggle
          // on click.
          event.stopPropagation();
          cancelHoverClose();
          updateLayout();
          setPinned((previous) => !previous);
        }}
      >
        {children ?? resolved.code}
      </button>

      <span id={descriptionId} className="sr-only">
        {description}
      </span>

      {open && typeof document !== "undefined" && createPortal(panel, document.body)}
    </span>
  );
}
