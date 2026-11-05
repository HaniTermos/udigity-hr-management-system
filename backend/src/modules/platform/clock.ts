/**
 * Platform clock (BE5). Jobs, the relay and dispatchers read time ONLY through `clock.now()`, so
 * tests can pin or advance it (QA-2 request). The override works only when NODE_ENV=test; in any
 * other environment setting it throws and `now()` is always the system time.
 */
import { config } from '../../config/index.js';

let fixed: Date | null = null;

function assertTest(): void {
  if (config.env !== 'test') throw new Error('Test clock is available only when NODE_ENV=test');
}

export const clock = {
  now(): Date {
    return fixed ? new Date(fixed.getTime()) : new Date();
  },
  /** Test only: pin the clock (null = back to system time). */
  set(at: Date | null): void {
    assertTest();
    fixed = at ? new Date(at.getTime()) : null;
  },
  /** Test only: move the pinned clock forward (pins it at "now" first if needed). */
  advance(ms: number): Date {
    assertTest();
    fixed = new Date((fixed ?? new Date()).getTime() + ms);
    return new Date(fixed.getTime());
  },
  isOverridden(): boolean {
    return fixed !== null;
  },
};
