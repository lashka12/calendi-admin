"use client";

import { useEffect } from "react";

/**
 * Locks body scroll when active - iOS Safari compatible.
 * Uses overflow:hidden + touchmove prevention instead of position:fixed
 * to avoid viewport recalculation issues on iOS PWA.
 */
export function useScrollLock(isLocked: boolean) {
  useEffect(() => {
    if (!isLocked) return;

    const body = document.body;
    const html = document.documentElement;

    // Save current overflow values
    const originalBodyOverflow = body.style.overflow;
    const originalHtmlOverflow = html.style.overflow;

    body.style.overflow = 'hidden';
    html.style.overflow = 'hidden';

    // On iOS, overflow:hidden alone doesn't prevent scrolling.
    // We need to block touchmove events on the document level,
    // but allow scrolling inside modal content (elements with touch-auto).
    const handleTouchMove = (e: TouchEvent) => {
      // Walk up from the touch target to find if it's inside a scrollable modal area
      let target = e.target as HTMLElement | null;
      while (target && target !== document.body) {
        const style = window.getComputedStyle(target);
        const isScrollable = 
          (style.overflowY === 'auto' || style.overflowY === 'scroll') &&
          target.scrollHeight > target.clientHeight;
        
        if (isScrollable) {
          // Allow scrolling inside this element, but prevent overscroll
          const atTop = target.scrollTop <= 0;
          const atBottom = target.scrollTop + target.clientHeight >= target.scrollHeight;
          const isScrollingUp = e.touches[0]?.clientY > (handleTouchMove as any)._lastY;
          const isScrollingDown = e.touches[0]?.clientY < (handleTouchMove as any)._lastY;

          if ((atTop && isScrollingUp) || (atBottom && isScrollingDown)) {
            e.preventDefault(); // Prevent overscroll bounce
          }
          return; // Allow normal scroll inside the scrollable element
        }
        target = target.parentElement;
      }
      // Not inside a scrollable area - prevent all scrolling
      e.preventDefault();
    };

    const handleTouchStart = (e: TouchEvent) => {
      (handleTouchMove as any)._lastY = e.touches[0]?.clientY;
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });

    return () => {
      body.style.overflow = originalBodyOverflow;
      html.style.overflow = originalHtmlOverflow;
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
    };
  }, [isLocked]);
}
