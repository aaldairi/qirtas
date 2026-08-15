"use client";

import { useEffect, useRef } from "react";

/**
 * Modal behaviour a screen reader and keyboard user actually need:
 *
 *  - focus moves into the dialog on open, rather than being left behind it
 *  - Tab cycles within the dialog, so it can't wander into the inert page
 *  - Escape closes
 *  - focus returns to whatever opened the dialog on close
 *
 * aria-modal="true" alone promises containment to assistive tech without
 * delivering it; this makes the promise true.
 */

/**
 * Reference count rather than a per-instance snapshot of body overflow.
 * These dialogs are URL-driven, so a route change can mount a second
 * instance before the first unmounts. Snapshotting per instance meant the
 * second captured "hidden" as the value to restore, and the page was left
 * permanently unscrollable after closing.
 */
let openDialogs = 0;

function lockScroll() {
  if (openDialogs === 0) document.body.style.overflow = "hidden";
  openDialogs += 1;
}

function unlockScroll() {
  openDialogs = Math.max(0, openDialogs - 1);
  if (openDialogs === 0) document.body.style.overflow = "";
}

export function useDialog(onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const panel = ref.current;
    const opener = document.activeElement as HTMLElement | null;

    const focusable = () =>
      Array.from(
        panel?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((el) => el.offsetParent !== null);

    // Prefer the first field; fall back to the panel itself so focus is never
    // stranded on the page behind.
    (focusable()[0] ?? panel)?.focus?.();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      const items = focusable();
      if (items.length === 0) return;

      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && (active === first || !panel?.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    lockScroll();

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      unlockScroll();

      // A route-driven close re-renders the page, so the element that opened
      // the dialog may be a detached node by now — focusing it would silently
      // do nothing and strand focus on <body>. Fall back to the main landmark,
      // which keeps keyboard users somewhere sensible.
      if (opener && document.contains(opener)) {
        opener.focus?.();
        return;
      }
      const main = document.getElementById("main");
      if (main) {
        main.setAttribute("tabindex", "-1");
        main.focus();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return ref;
}
