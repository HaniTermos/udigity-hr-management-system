import { expect, type Page } from '@playwright/test';

/**
 * Navy dark-mode check (AC-UI-002, user directive 2026-10-23: dark mode is NAVY, not black).
 * The app stores the theme in localStorage `udigity-theme` and toggles `class="dark"` on <html>
 * (frontend/src/lib/theme.tsx).
 */
export async function forceTheme(page: Page, theme: 'light' | 'dark') {
  await page.addInitScript((t) => {
    try {
      localStorage.setItem('udigity-theme', t);
    } catch {
      /* storage blocked: the class toggle below still applies */
    }
    document.documentElement.classList.toggle('dark', t === 'dark');
  }, theme);
}

export async function applyThemeNow(page: Page, theme: 'light' | 'dark') {
  await page.evaluate((t) => {
    try {
      localStorage.setItem('udigity-theme', t);
    } catch {
      /* ignore */
    }
    document.documentElement.classList.toggle('dark', t === 'dark');
  }, theme);
}

/** Navy window: hue 205–235°, saturation ≥ 25 %, lightness ≤ 30 % (test-strategy §7). */
export const NAVY = { hueMin: 205, hueMax: 235, satMin: 0.25, lightMax: 0.3 };

export interface SurfaceSample {
  selector: string;
  rgb: [number, number, number];
  hsl: [number, number, number];
  isNavy: boolean;
}

/** Samples the effective (first opaque) background of each selector that exists on the page. */
export async function sampleSurfaces(page: Page, selectors: string[]): Promise<SurfaceSample[]> {
  return page.evaluate(
    ({ selectors, NAVY }) => {
      const parse = (c: string): [number, number, number, number] | null => {
        const m = c.match(/rgba?\(([^)]+)\)/);
        if (!m) return null;
        const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
        return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
      };
      const effectiveBg = (el: Element | null): [number, number, number] => {
        while (el) {
          const c = parse(getComputedStyle(el).backgroundColor);
          if (c && c[3] > 0.95) return [c[0], c[1], c[2]];
          el = el.parentElement;
        }
        return [255, 255, 255];
      };
      const toHsl = ([r, g, b]: [number, number, number]): [number, number, number] => {
        r /= 255; g /= 255; b /= 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        const l = (max + min) / 2;
        let h = 0, s = 0;
        if (max !== min) {
          const d = max - min;
          s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
          if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
          else if (max === g) h = (b - r) / d + 2;
          else h = (r - g) / d + 4;
          h *= 60;
        }
        return [h, s, l];
      };
      const out: SurfaceSample[] = [];
      for (const selector of selectors) {
        const el = document.querySelector(selector);
        if (!el) continue;
        const rgb = effectiveBg(el);
        const hsl = toHsl(rgb);
        const isNavy = hsl[0] >= NAVY.hueMin && hsl[0] <= NAVY.hueMax && hsl[1] >= NAVY.satMin && hsl[2] <= NAVY.lightMax;
        out.push({ selector, rgb, hsl, isNavy });
      }
      return out;
    },
    { selectors, NAVY },
  );
}

export async function expectNavySurfaces(page: Page, selectors = ['body', 'main', 'aside', '[data-surface="card"]']) {
  const samples = await sampleSurfaces(page, selectors);
  expect(samples.length, 'no surface selector matched').toBeGreaterThan(0);
  const failing = samples
    .filter((s) => !s.isNavy)
    .map((s) => `${s.selector}: rgb(${s.rgb.join(',')}) hue ${s.hsl[0].toFixed(0)}° sat ${(s.hsl[1] * 100).toFixed(0)}% light ${(s.hsl[2] * 100).toFixed(0)}%`);
  expect(failing, 'dark surfaces must be navy, not black/grey').toEqual([]);
}

export interface ContrastFailure {
  text: string;
  fg: string;
  bg: string;
  ratio: number;
  need: number;
}

/** WCAG contrast of every visible text node against its effective background. */
export async function findContrastFailures(page: Page, root = 'body'): Promise<ContrastFailure[]> {
  return page.evaluate((root) => {
    const parse = (c: string): number[] | null => {
      const m = c.match(/rgba?\(([^)]+)\)/);
      if (!m) return null;
      const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
      return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
    };
    const lum = (c: number[]) => {
      const f = (v: number) => {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      };
      return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
    };
    const bgOf = (el: Element | null): number[] => {
      while (el) {
        const c = parse(getComputedStyle(el).backgroundColor);
        if (c && c[3] > 0.95) return c;
        el = el.parentElement;
      }
      return [255, 255, 255, 1];
    };
    const failures: ContrastFailure[] = [];
    const walker = document.createTreeWalker(document.querySelector(root) ?? document.body, NodeFilter.SHOW_TEXT);
    const seen = new Set<Element>();
    while (walker.nextNode()) {
      const node = walker.currentNode as Text;
      const el = node.parentElement;
      if (!el || seen.has(el) || !node.textContent?.trim()) continue;
      seen.add(el);
      const cs = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      if (cs.visibility === 'hidden' || cs.display === 'none' || rect.width === 0 || rect.height === 0) continue;
      if (el.closest('[aria-hidden="true"], [disabled], [aria-disabled="true"]')) continue; // disabled text is exempt (WCAG 1.4.3)
      const fg = parse(cs.color);
      if (!fg) continue;
      const bg = bgOf(el);
      const a = fg[3];
      const blended = [0, 1, 2].map((i) => fg[i] * a + bg[i] * (1 - a));
      const l1 = lum(blended), l2 = lum(bg);
      const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
      const size = parseFloat(cs.fontSize);
      const bold = parseInt(cs.fontWeight, 10) >= 700;
      const large = size >= 24 || (bold && size >= 18.66);
      const need = large ? 3 : 4.5;
      if (ratio + 0.01 < need) {
        failures.push({ text: node.textContent.trim().slice(0, 60), fg: cs.color, bg: `rgb(${bg.slice(0, 3).join(',')})`, ratio: Math.round(ratio * 100) / 100, need });
      }
    }
    return failures;
  }, root);
}

export async function expectReadableContrast(page: Page, root = 'body') {
  const failures = await findContrastFailures(page, root);
  expect(failures, 'text contrast below WCAG AA').toEqual([]);
}
