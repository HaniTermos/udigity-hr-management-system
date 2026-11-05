import { describe, expect, it } from 'vitest';
import { verificationModeLabel } from './verificationMode';

describe('verificationModeLabel', () => {
  it('humanises known and unknown modes', () => {
    expect(verificationModeLabel('ip')).toBe('Checked by office network');
    expect(verificationModeLabel('weird_mode')).toBe('Checked by weird mode');
    expect(verificationModeLabel(null)).toBe('Mode not recorded');
  });
});
