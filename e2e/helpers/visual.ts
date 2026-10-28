import fs from 'node:fs';
import path from 'node:path';
import type { Page, TestInfo } from '@playwright/test';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

/**
 * Advisory design comparison against the Figma previews (test-strategy §6, AC-UI-007).
 * It never fails a test: it attaches actual / expected / diff and the mismatch ratio for human review.
 * Gating regression uses expect(page).toHaveScreenshot() once a screen is accepted.
 */
export const PREVIEWS_ROOT = path.resolve(__dirname, '..', '..', 'docs', 'phase6', 'previews');
export const REVIEW_THRESHOLD = 0.15;

/** Finds a preview by folder and exact Figma frame name, e.g. ('40', 'SCR-AUTH-001 — Login — Desktop — Light'). */
export function previewPath(folder: string, frameName: string): string | null {
  const p = path.join(PREVIEWS_ROOT, folder, `${frameName}.png`);
  return fs.existsSync(p) ? p : null;
}

export interface DesignDiffResult {
  preview: string | null;
  mismatchRatio: number | null;
  needsReview: boolean;
}

export async function compareWithPreview(
  page: Page,
  testInfo: TestInfo,
  folder: string,
  frameName: string,
): Promise<DesignDiffResult> {
  const preview = previewPath(folder, frameName);
  if (!preview) {
    testInfo.annotations.push({ type: 'design-diff', description: `preview not found: ${folder}/${frameName}` });
    return { preview: null, mismatchRatio: null, needsReview: true };
  }
  const expected = PNG.sync.read(fs.readFileSync(preview));
  await page.setViewportSize({ width: expected.width, height: expected.height });
  const actualBuf = await page.screenshot({ fullPage: false, animations: 'disabled', caret: 'hide' });
  const actual = PNG.sync.read(actualBuf);

  const width = Math.min(actual.width, expected.width);
  const height = Math.min(actual.height, expected.height);
  const crop = (img: PNG) => {
    if (img.width === width && img.height === height) return img;
    const out = new PNG({ width, height });
    PNG.bitblt(img, out, 0, 0, width, height, 0, 0);
    return out;
  };
  const a = crop(actual);
  const e = crop(expected);
  const diff = new PNG({ width, height });
  const mismatched = pixelmatch(a.data, e.data, diff.data, width, height, { threshold: 0.1 });
  const ratio = mismatched / (width * height);

  await testInfo.attach(`${frameName} · actual.png`, { body: actualBuf, contentType: 'image/png' });
  await testInfo.attach(`${frameName} · expected.png`, { path: preview, contentType: 'image/png' });
  await testInfo.attach(`${frameName} · diff.png`, { body: PNG.sync.write(diff), contentType: 'image/png' });
  const needsReview = ratio > REVIEW_THRESHOLD;
  testInfo.annotations.push({
    type: 'design-diff',
    description: `${frameName}: ${(ratio * 100).toFixed(1)}% pixels differ${needsReview ? ' — REVIEW' : ''}`,
  });
  return { preview, mismatchRatio: ratio, needsReview };
}
