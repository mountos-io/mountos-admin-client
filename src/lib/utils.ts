import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), wait);
  };
}

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

// A browser page (unlike mountos-gui, which has an authoritative platform
// string from Rust) has no reliable signal beyond sniffing navigator itself.
// userAgentData.platform is the modern (Chromium-only) source; navigator
// .platform/.userAgent are the fallback for everything else.
export function isMacPlatform(): boolean {
  if (typeof navigator === 'undefined') return false
  const platform = (navigator as unknown as { userAgentData?: { platform?: string } }).userAgentData?.platform ?? navigator.platform ?? navigator.userAgent
  return /mac/i.test(platform)
}

// event.metaKey is the Cmd key on macOS but the Windows/Super key elsewhere,
// which OS-level shortcuts already claim; Windows/Linux users need ctrlKey
// for an app shortcut to actually reach them.
export function modKeyPressed(event: KeyboardEvent): boolean {
  return isMacPlatform() ? event.metaKey : event.ctrlKey
}

export type WithoutChild<T> = T extends { child?: any } ? Omit<T, "child"> : T;

export type WithoutChildren<T> = T extends { children?: any } ? Omit<T, "children"> : T;
export type WithoutChildrenOrChild<T> = WithoutChildren<WithoutChild<T>>;
export type WithElementRef<T, U extends HTMLElement = HTMLElement> = T & { ref?: U | null };
