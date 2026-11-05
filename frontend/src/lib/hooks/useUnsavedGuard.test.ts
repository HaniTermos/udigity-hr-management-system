import { describe, expect, it } from 'vitest';
import { isInAppLeave } from './useUnsavedGuard';

const loc = { origin: 'https://hr.example', pathname: '/settings', search: '' };
const click = { button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, defaultPrevented: false };

describe('isInAppLeave', () => {
  it('flags a link to another app page', () => {
    expect(isInAppLeave({ href: 'https://hr.example/employees' }, click, loc)).toBe(true);
    expect(isInAppLeave({ href: '/employees?x=1' }, click, loc)).toBe(true);
  });
  it('ignores same page, other origins, new tabs, modifiers and downloads', () => {
    expect(isInAppLeave({ href: '/settings' }, click, loc)).toBe(false);
    expect(isInAppLeave({ href: 'https://other.example/x' }, click, loc)).toBe(false);
    expect(isInAppLeave({ href: '/employees', target: '_blank' }, click, loc)).toBe(false);
    expect(isInAppLeave({ href: '/employees' }, { ...click, ctrlKey: true }, loc)).toBe(false);
    expect(isInAppLeave({ href: '/employees', download: true }, click, loc)).toBe(false);
    expect(isInAppLeave(null, click, loc)).toBe(false);
  });
});
