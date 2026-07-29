import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Tailwind-aware className combiner used across every shadcn-style primitive. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Clamp a number into [min, max]. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Deterministic pseudo-random in [0,1) - mirrors the console mockup's rnd(). */
export function rnd(seedValue: number, i: number): number {
  const x = Math.sin(seedValue * 12.9898 + i * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/** Sum the char codes of a string, used to seed the deterministic series. */
export function seedFrom(id: string): number {
  return id.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
}

/** Safe JSON.parse that returns a fallback instead of throwing. */
export function safeParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
