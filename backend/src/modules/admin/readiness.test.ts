/**
 * UDI-7 regression: /readyz resolves company.timezone like every other module (getSetting →
 * envDefault), so POLICY_COMPANY_TIMEZONE alone is enough and the alias is only a fallback.
 */
import { describe, expect, it } from 'vitest';
import { loadPolicyFlags } from '../../shared/flags.js';
import { companyTimezoneProblem, envDefaultFrom } from './service.js';

const noAliases = { companyTimezone: '', officeIps: [] as string[], verificationMode: '' };

describe('company.timezone env precedence (DEV-R4)', () => {
  it('POLICY_COMPANY_TIMEZONE alone is used (the deploy that stayed 503 before)', () => {
    const values = loadPolicyFlags({ POLICY_COMPANY_TIMEZONE: 'Asia/Beirut' });
    expect(envDefaultFrom('company.timezone', values, noAliases)).toBe('Asia/Beirut');
  });

  it('the COMPANY_TIMEZONE alias is used only when the POLICY_* name is empty', () => {
    const empty = loadPolicyFlags({});
    expect(envDefaultFrom('company.timezone', empty, { ...noAliases, companyTimezone: 'Europe/Paris' })).toBe('Europe/Paris');
    const both = loadPolicyFlags({ POLICY_COMPANY_TIMEZONE: 'Asia/Beirut' });
    expect(envDefaultFrom('company.timezone', both, { ...noAliases, companyTimezone: 'Europe/Paris' })).toBe('Asia/Beirut');
  });

  it('nothing set resolves to empty', () => {
    expect(envDefaultFrom('company.timezone', loadPolicyFlags({}), noAliases)).toBe('');
  });
});

describe('companyTimezoneProblem (production /readyz)', () => {
  it('accepts a valid IANA zone, trimming whitespace', () => {
    expect(companyTimezoneProblem('Asia/Beirut')).toBeNull();
    expect(companyTimezoneProblem('  UTC ')).toBeNull();
  });

  it('reports a missing value', () => {
    for (const v of ['', '   ', undefined, null, 42]) {
      expect(companyTimezoneProblem(v)).toMatch(/not configured/);
    }
  });

  it('reports an invalid zone', () => {
    expect(companyTimezoneProblem('Mars/Olympus_Mons')).toMatch(/not a valid IANA/);
  });
});
