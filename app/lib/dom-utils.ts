// DOM utility functions for client-side operations
// These functions safely handle DOM operations in Next.js

export const safeGetElementById = (id: string): HTMLElement | null => {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return null;
  }
  return document.getElementById(id);
};

export const safeAddEventListener = (
  event: string,
  handler: EventListener,
  options?: boolean | AddEventListenerOptions
): (() => void) | undefined => {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return undefined;
  }
  
  document.addEventListener(event, handler, options);
  return () => document.removeEventListener(event, handler, options);
};

export const safeScrollIntoView = (element: HTMLElement, options?: ScrollIntoViewOptions): void => {
  if (typeof window === 'undefined') {
    return;
  }
  element.scrollIntoView(options);
};
