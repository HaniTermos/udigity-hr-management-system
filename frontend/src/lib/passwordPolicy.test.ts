import { describe, expect, it } from 'vitest';
import { PASSWORD_REFUSED_MESSAGE, passwordRuleMessage } from './passwordPolicy';

describe('passwordRuleMessage', () => {
  it('explains a breached or common password', () => {
    expect(passwordRuleMessage({ code: 'PASSWORD_BREACHED', status: 400 })).toBe(PASSWORD_REFUSED_MESSAGE);
  });
  it('prefers the server wording for the field', () => {
    expect(passwordRuleMessage({ code: 'VALIDATION_ERROR', status: 400, fieldErrors: { newPassword: ['Too common.'] } })).toBe('Too common.');
  });
  it('falls back to a generic rules message on 400 and ignores other failures', () => {
    expect(passwordRuleMessage({ status: 400 })).toMatch(/does not meet the rules/);
    expect(passwordRuleMessage({ status: 500 })).toBeNull();
    expect(passwordRuleMessage(null)).toBeNull();
  });
});
