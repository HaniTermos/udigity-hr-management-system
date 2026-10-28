'use client';

import React, { createContext, useCallback, useContext, useMemo } from 'react';
import useSWR from 'swr';
import { useRouter } from 'next/navigation';
import { apiFetch, forgetCsrfToken, rememberCsrfToken } from '@/lib/api';
import type { SessionState } from '@/lib/authRoutes';
import { resetSessionEnded } from '@/lib/sessionEndedSignal';
import {
  identityPaths,
  type EnrollConfirmDto,
  type EnrollStartDto,
  type EnrollStartInput,
  type RecoverDto,
} from '@/lib/api/identity';

export type { SessionState } from '@/lib/authRoutes';

export interface Employee {
  id: string;
  email: string;
  fullName: string;
  role: 'owner' | 'data_entry' | 'call_center' | 'developer' | (string & {});
  department?: string;
  jobTitle?: string;
  isPending2FA?: boolean;
  sessionState?: SessionState;
  /** Action names the backend lets this principal use (`GET /me`, plan.md §4.1). */
  capabilities?: string[];
}

interface MeResponse {
  user: Employee;
  csrfToken?: string;
  /** Same list as `user.capabilities`; the backend may send it at the top level. */
  capabilities?: string[];
}

export type TwoFactorStep = 'verify' | 'enroll' | null;

export interface LoginResult {
  requires2FA: boolean;
  twoFactorStep: TwoFactorStep;
  error?: string;
  code?: string;
}

export interface FactorResult {
  success: boolean;
  error?: string;
  /** Backend code, e.g. INVALID_2FA_TOKEN, TOO_MANY_ATTEMPTS, SESSION_ENDED, 2FA_NOT_PENDING. */
  code?: string;
}

export interface EnrollmentStart {
  success: boolean;
  method?: string;
  secret?: string;
  otpauthUrl?: string;
  error?: string;
  /** ENROLLMENT_TOKEN_INVALID, REAUTH_FAILED, TOO_MANY_ATTEMPTS, SESSION_ENDED, ... */
  code?: string;
}

export interface EnrollmentConfirm extends FactorResult {
  /** 10 single-use codes, present only on the confirm that creates them. Show once; never store. */
  recoveryCodes?: string[];
}

export interface RecoveryResult extends FactorResult {
  recoveryCodesRemaining?: number;
}

export interface AuthContextType {
  user: Employee | null;
  /** Backend session state; null when signed out. */
  sessionState: SessionState | null;
  /**
   * Backend capability list from `/me`, or null when the backend has not sent one (older backend) or
   * nobody is signed in. UI shows or hides controls with `can()`; the server still decides every call.
   */
  capabilities: readonly string[] | null;
  /** True when `action` is in `capabilities`; false while signed out or pending 2FA. */
  can: (action: string) => boolean;
  isLoading: boolean;
  isOwner2faPending: boolean;
  login: (email: string, password: string) => Promise<LoginResult>;
  verify2FA: (code: string) => Promise<FactorResult>;
  startEnrollment: (input: EnrollStartInput) => Promise<EnrollmentStart>;
  confirmEnrollment: (code: string) => Promise<EnrollmentConfirm>;
  /** Sign in with one recovery code while the session is pending verification (POST /2fa/recover). */
  recoverWithCode: (code: string) => Promise<RecoveryResult>;
  logout: () => Promise<void>;
  mutateAuth: () => Promise<MeResponse | null | undefined>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const meFetcher = async (url: string): Promise<MeResponse | null> => {
  const res = await apiFetch<MeResponse>(url);
  if (res.ok && res.data) {
    rememberCsrfToken(res.data.csrfToken);
    return res.data;
  }
  if (res.status === 401 || res.status === 403) return null;
  throw new Error('Failed to fetch session');
};

function deriveState(user: Employee | null): SessionState | null {
  if (!user) return null;
  if (user.sessionState) return user.sessionState;
  // Older backend shape: only isPending2FA.
  return user.isPending2FA ? 'pending_2fa_verification' : 'active';
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  const { data, isLoading, mutate } = useSWR('/api/auth/me', meFetcher, {
    revalidateOnFocus: true,
    shouldRetryOnError: false,
  });

  const user: Employee | null = data?.user || null;
  const sessionState = deriveState(user);
  const isOwner2faPending = sessionState !== null && sessionState !== 'active';
  const capabilities = useMemo<readonly string[] | null>(() => {
    const list = data?.capabilities ?? data?.user?.capabilities;
    return Array.isArray(list) ? list : null;
  }, [data]);
  const can = useCallback(
    (action: string) => sessionState === 'active' && capabilities !== null && capabilities.includes(action),
    [sessionState, capabilities]
  );

  const login = async (email: string, password: string): Promise<LoginResult> => {
    const res = await apiFetch<{ requires2FA?: boolean; twoFactorStep?: TwoFactorStep }>('/api/auth/login', {
      method: 'POST',
      body: { email, password },
    });

    if (!res.ok) {
      return {
        requires2FA: false,
        twoFactorStep: null,
        code: res.error?.code,
        error:
          res.status === 0
            ? 'Network error occurred. Please try again.'
            : res.error?.error || 'Email or password is incorrect.',
      };
    }

    resetSessionEnded();
    await mutate();
    const requires2FA = Boolean(res.data?.requires2FA);
    const twoFactorStep: TwoFactorStep = requires2FA ? res.data?.twoFactorStep || 'verify' : null;
    return { requires2FA, twoFactorStep };
  };

  const factorCall = async (path: string, code: string): Promise<FactorResult> => {
    const res = await apiFetch(path, { method: 'POST', body: { token: code.trim() } });
    if (!res.ok) {
      if (res.status === 401) await mutate(null, false);
      return {
        success: false,
        code: res.error?.code,
        error: res.status === 0 ? 'Verification failed. Please try again.' : res.error?.error || 'Invalid verification code.',
      };
    }
    await mutate();
    return { success: true };
  };

  const verify2FA = (code: string) => factorCall('/api/auth/2fa/verify', code);
  const confirmEnrollment = async (code: string): Promise<EnrollmentConfirm> => {
    const res = await apiFetch<EnrollConfirmDto>(identityPaths.enrollConfirm, {
      method: 'POST',
      body: { token: code.trim() },
    });
    if (!res.ok) {
      if (res.status === 401) await mutate(null, false);
      return {
        success: false,
        code: res.error?.code,
        error: res.status === 0 ? 'Verification failed. Please try again.' : res.error?.error || 'Invalid verification code.',
      };
    }
    // The session turns active on the server here. The session is not refreshed yet, so the login page stays
    // up until the recovery codes are saved; the caller refreshes after the acknowledgement (mutateAuth).
    return { success: true, recoveryCodes: Array.isArray(res.data?.recoveryCodes) ? res.data.recoveryCodes : [] };
  };

  const recoverWithCode = async (code: string): Promise<RecoveryResult> => {
    const res = await apiFetch<RecoverDto>(identityPaths.recover, { method: 'POST', body: { code: code.trim() } });
    if (!res.ok) {
      if (res.status === 401) await mutate(null, false);
      return {
        success: false,
        code: res.error?.code,
        error: res.status === 0 ? 'Recovery failed. Please try again.' : res.error?.error || 'Recovery code was not accepted.',
      };
    }
    return { success: true, recoveryCodesRemaining: res.data?.recoveryCodesRemaining };
  };

  const startEnrollment = async (input: EnrollStartInput): Promise<EnrollmentStart> => {
    const res = await apiFetch<EnrollStartDto>(identityPaths.enrollStart, {
      method: 'POST',
      body: { enrollmentToken: input.enrollmentToken.trim(), currentPassword: input.currentPassword },
    });
    if (!res.ok || !res.data) {
      return { success: false, code: res.error?.code, error: res.error?.error || 'Could not start setup.' };
    }
    return { success: true, ...res.data };
  };

  const logout = async () => {
    await apiFetch('/api/auth/logout', { method: 'POST' });
    forgetCsrfToken();
    await mutate(null, false);
    router.push('/login');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        sessionState,
        capabilities,
        can,
        isLoading,
        isOwner2faPending,
        login,
        verify2FA,
        startEnrollment,
        confirmEnrollment,
        recoverWithCode,
        logout,
        mutateAuth: () => mutate(),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
