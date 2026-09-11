"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

/** Below this the thumb stops reading as a capsule and starts reading as a dot. */
const MIN_THUMB = 36;
/** How long the thumb stays lit after the last scroll event. */
const IDLE_MS = 800;
/** Breathing room under the header and above the bottom of the window. */
const GAP = 10;

/**
 * The scrollbar, drawn by us instead of by the browser.
 *
 * The native bar is glued to the edge of the window: it runs the full height,
 * so it crosses the sticky header and sits outside the page's own margins. The
 * rail here starts below the header and is inset from the edge, which keeps it
 * inside the layout rather than bolted onto it.
 *
 * The real bar is hidden by an attribute on <html> in the root layout, not
 * from here -- see the note there.
 *
 * Scroll position is written straight to the thumb's style inside a frame
 * callback -- rendering React on every scroll event would be a lot of work for
 * two numbers that nothing else reads.
 */
export function SideScroller() {
  const railRef = useRef<HTMLDivElement | null>(null);
  const thumbRef = useRef<HTMLDivElement | null>(null);
  const frame = useRef(0);
  const idle = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const drag = useRef<{ pointerY: number; scrollY: number } | null>(null);
  const headerRef = useRef<HTMLElement | null>(null);

  const [scrollable, setScrollable] = useState(false);
  const [lit, setLit] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [dragging, setDragging] = useState(false);

  const pathname = usePathname();

  // Where the header currently ends, not how tall it is. On an overscroll
  // bounce at the top of the page the sticky header travels down with the
  // content while a fixed element stays put, so a rail parked at a fixed
  // offset ends up above it. Read live, the rail rides down with it instead.
  // Re-queried whenever the node we cached is gone, since each page renders
  // its own header and a navigation swaps one for another.
  const headerBottom = useCallback(() => {
    let header = headerRef.current;
    if (!header?.isConnected) {
      header = document.querySelector("header");
      headerRef.current = header;
    }
    return header ? Math.max(0, header.getBoundingClientRect().bottom) : 0;
  }, []);

  const paint = useCallback(() => {
    const rail = railRef.current;
    const thumb = thumbRef.current;
    if (!rail || !thumb) return;

    // Written imperatively, and deliberately absent from the style prop below:
    // React only clears inline styles it sees leave that prop, so what is set
    // here survives every re-render.
    rail.style.top = `${headerBottom() + GAP}px`;

    const doc = document.documentElement;
    const max = doc.scrollHeight - window.innerHeight;
    // A page that fits gets no rail at all; an empty track is just clutter.
    if (max <= 1) {
      setScrollable(false);
      return;
    }
    setScrollable(true);

    const track = rail.clientHeight;
    const size = Math.max(MIN_THUMB, Math.round(track * (window.innerHeight / doc.scrollHeight)));
    const y = (Math.min(Math.max(window.scrollY, 0), max) / max) * (track - size);

    thumb.style.height = `${size}px`;
    thumb.style.transform = `translate3d(-50%, ${y}px, 0)`;
  }, [headerBottom]);

  const schedule = useCallback(() => {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(paint);
  }, [paint]);

  // A header that changes height -- a bigger font, a wrapped nav -- moves the
  // top of the rail without any scroll or resize event to notice it by.
  useEffect(() => {
    const header = document.querySelector("header");
    headerRef.current = header;
    schedule();
    if (!header) return;

    const observer = new ResizeObserver(schedule);
    observer.observe(header);
    return () => observer.disconnect();
  }, [schedule, pathname]);

  useEffect(() => {
    schedule();

    const onScroll = () => {
      schedule();
      setLit(true);
      clearTimeout(idle.current);
      idle.current = setTimeout(() => setLit(false), IDLE_MS);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", schedule);

    // The feed grows as items stream in and images settle, which moves the
    // bottom of the document without ever firing a scroll or resize event.
    const observer = new ResizeObserver(schedule);
    observer.observe(document.body);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", schedule);
      observer.disconnect();
      cancelAnimationFrame(frame.current);
      clearTimeout(idle.current);
    };
  }, [schedule]);

  // A navigation swaps the whole page under us; remeasure against the new one.
  useEffect(schedule, [schedule, pathname]);

  // Dragging the thumb otherwise selects every paragraph it passes over.
  useEffect(() => {
    if (!dragging) return;
    const previous = document.body.style.userSelect;
    document.body.style.userSelect = "none";
    return () => {
      document.body.style.userSelect = previous;
    };
  }, [dragging]);

  function startDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { pointerY: event.clientY, scrollY: window.scrollY };
    setDragging(true);
  }

  function moveDrag(event: React.PointerEvent<HTMLDivElement>) {
    const start = drag.current;
    const rail = railRef.current;
    const thumb = thumbRef.current;
    if (!start || !rail || !thumb) return;

    const max = document.documentElement.scrollHeight - window.innerHeight;
    const range = rail.clientHeight - thumb.offsetHeight;
    if (range <= 0 || max <= 0) return;

    // One pixel of thumb travel is worth however many pixels of page are left
    // over, which is what makes a short thumb move the page faster.
    window.scrollTo({ top: start.scrollY + ((event.clientY - start.pointerY) * max) / range });
  }

  function endDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    drag.current = null;
    setDragging(false);
  }

  // Clicking the empty track puts the thumb where you clicked, rather than
  // paging towards it -- the position is the whole point of aiming at a track.
  function jump(event: React.PointerEvent<HTMLDivElement>) {
    const rail = railRef.current;
    const thumb = thumbRef.current;
    if (!rail || !thumb || drag.current) return;

    const max = document.documentElement.scrollHeight - window.innerHeight;
    const rect = rail.getBoundingClientRect();
    const size = thumb.offsetHeight;
    const range = rect.height - size;
    if (range <= 0 || max <= 0) return;

    const fraction = Math.min(Math.max((event.clientY - rect.top - size / 2) / range, 0), 1);
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: fraction * max, behavior: smooth ? "smooth" : "auto" });
  }

  const active = lit || hovered || dragging;

  return (
    <div
      ref={railRef}
      aria-hidden
      data-active={active ? "true" : "false"}
      data-scrollable={scrollable ? "true" : "false"}
      onPointerDown={jump}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      className="group fixed right-1.5 z-20 w-3 touch-none select-none transition-opacity duration-200 data-[scrollable=false]:pointer-events-none data-[scrollable=false]:opacity-0 pointer-coarse:pointer-events-none"
      style={{ bottom: GAP }}
    >
      <div
        ref={thumbRef}
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className="absolute top-0 left-1/2 w-[3px] rounded-full bg-accent opacity-35 transition-[opacity,width] duration-200 group-data-[active=true]:w-[5px] group-data-[active=true]:opacity-100"
      />
    </div>
  );
}
