'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AuthShell } from '@/components/auth/AuthShell';
import { EnrollmentFlow } from '@/components/auth/EnrollmentFlow';
import { RecoverAccess, RecoveryAccepted } from '@/components/auth/RecoverAccess';
import { SignInForm, type SignInValues } from '@/components/auth/SignInForm';
import { TwoFactorChallenge } from '@/components/auth/TwoFactorChallenge';
import { useAuth } from '@/lib/auth';
import {
  safeRedirectTarget,
  TWO_FACTOR_ENROLL_PATH,
  TWO_FACTOR_RECOVER_PATH,
  TWO_FACTOR_VERIFY_PATH,
} from '@/lib/authRoutes';
import { DEV_PERSONAS_ENABLED, DEV_SEED_PASSWORD } from '@/lib/devFlags';

type Mode = 'signin' | '2fa' | 'recover' | 'enrollment';

const DEV_PERSONAS = [
  { email: 'rana.haddad@udigity.demo', name: 'Rana Haddad', role: 'Owner (with 2FA)' },
  { email: 'karim.saleh@udigity.demo', name: 'Karim Saleh', role: 'Data Entry' },
  { email: 'maya.khoury@udigity.demo', name: 'Maya Khoury', role: 'Call Center' },
  { email: 'lina.aoun@udigity.demo', name: 'Lina Aoun', role: 'Developer' },
];

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, login, verify2FA, startEnrollment, confirmEnrollment, recoverWithCode, mutateAuth, logout, sessionState } = useAuth();

  const [recovered, setRecovered] = useState<{ remaining?: number } | null>(null);

  // The URL step is corrected by the backend session state: an Owner without a factor sees enrollment
  // (SCR-AUTH-003), one with a factor the challenge (SCR-AUTH-002) or the recovery-code path.
  const step = searchParams.get('step');
  const requestedMode: Mode =
    step === 'enroll' ? 'enrollment' : step === 'recover' ? 'recover' : step === '2fa' ? '2fa' : 'signin';
  const mode: Mode =
    requestedMode === 'signin'
      ? 'signin'
      : requestedMode === 'recover' && recovered
        ? 'recover'
      : sessionState === 'pending_2fa_enrollment'
        ? 'enrollment'
        : sessionState === 'pending_2fa_verification' && requestedMode === 'enrollment'
          ? '2fa'
          : requestedMode;
  const redirectParam = searchParams.get('redirect');
  const afterTwoFactorTarget = safeRedirectTarget(redirectParam, '/');
  const keep = redirectParam ? `&redirect=${encodeURIComponent(redirectParam)}` : '';

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);
  const [challengeError, setChallengeError] = useState<string | null>(null);
  const [lockedOut, setLockedOut] = useState(false);
  const [verified, setVerified] = useState(false);
  const [recoverError, setRecoverError] = useState<string | null>(null);
  const [recoverFailed, setRecoverFailed] = useState(false);

  useEffect(() => {
    if (!verified) return;
    const t = setTimeout(() => router.replace(afterTwoFactorTarget), 1200);
    return () => clearTimeout(t);
  }, [verified, router, afterTwoFactorTarget]);

  const handleSignIn = async ({ email, password }: SignInValues) => {
    setSignInError(null);
    setIsSubmitting(true);
    try {
      const result = await login(email, password);
      if (result.error) {
        setSignInError(
          result.code === 'TOO_MANY_ATTEMPTS' ? 'Too many attempts. Please wait and try again.' : 'Email or password is incorrect.'
        );
        return;
      }
      if (result.requires2FA) {
        router.replace(`${result.twoFactorStep === 'enroll' ? TWO_FACTOR_ENROLL_PATH : TWO_FACTOR_VERIFY_PATH}${keep}`);
        return;
      }
      router.replace(safeRedirectTarget(redirectParam, '/my-day'));
    } catch {
      setSignInError('Email or password is incorrect.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerify = async (code: string) => {
    setChallengeError(null);
    setIsSubmitting(true);
    const result = await verify2FA(code);
    setIsSubmitting(false);
    if (!result.success) {
      if (result.code === 'TOO_MANY_ATTEMPTS' || result.code === 'SESSION_ENDED' || result.code === 'UNAUTHENTICATED') {
        setLockedOut(true);
        return;
      }
      setChallengeError('Code is incorrect or expired. Try again.');
      return;
    }
    setVerified(true);
  };

  const handleRecover = async (code: string) => {
    setRecoverError(null);
    setIsSubmitting(true);
    const result = await recoverWithCode(code);
    setIsSubmitting(false);
    if (!result.success) {
      if (result.code === 'TOO_MANY_ATTEMPTS' || result.code === 'SESSION_ENDED' || result.code === 'UNAUTHENTICATED') {
        setRecoverFailed(true);
        return;
      }
      setRecoverError("This recovery code wasn't accepted. Check it and try again.");
      return;
    }
    setRecovered({ remaining: result.recoveryCodesRemaining });
    await mutateAuth();
  };

  const signOutToLogin = async () => {
    setLockedOut(false);
    setRecoverFailed(false);
    setRecovered(null);
    await logout();
  };

  const finishEnrollment = async () => {
    await mutateAuth();
    router.replace(afterTwoFactorTarget);
  };

  return (
    <AuthShell wide={mode === 'enrollment'}>
      {mode === 'signin' && (
        <SignInForm
          initialEmail={DEV_PERSONAS_ENABLED ? DEV_PERSONAS[0].email : ''}
          initialPassword={DEV_PERSONAS_ENABLED ? DEV_SEED_PASSWORD : ''}
          sessionEnded={searchParams.get('reason') === 'session_expired'}
          isSubmitting={isSubmitting}
          error={signInError}
          onSubmit={handleSignIn}
        >
          {DEV_PERSONAS_ENABLED && (
            <div className="pt-3 border-t border-border-subtle">
              <div className="text-xs font-semibold text-text-muted mb-2">Dev demo accounts (development only)</div>
              <div className="grid grid-cols-2 gap-1.5 text-xs">
                {DEV_PERSONAS.map((p) => (
                  <button
                    key={p.email}
                    type="button"
                    onClick={() => handleSignIn({ email: p.email, password: DEV_SEED_PASSWORD })}
                    className="p-1.5 rounded border border-border-default bg-surface-subtle hover:bg-surface-hover text-left"
                  >
                    <div className="font-semibold text-text-primary">{p.name}</div>
                    <div className="text-text-muted">{p.role}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </SignInForm>
      )}

      {mode === '2fa' && (
        <TwoFactorChallenge
          email={user?.email}
          isSubmitting={isSubmitting}
          error={challengeError}
          lockedOut={lockedOut}
          verified={verified}
          onVerify={handleVerify}
          onRecover={() => router.replace(`${TWO_FACTOR_RECOVER_PATH}${keep}`)}
          onSignOut={signOutToLogin}
        />
      )}

      {mode === 'recover' &&
        (recovered ? (
          <RecoveryAccepted
            remaining={recovered.remaining}
            needsReEnrollment={sessionState === 'pending_2fa_enrollment'}
            onContinue={() =>
              sessionState === 'pending_2fa_enrollment'
                ? router.replace(`${TWO_FACTOR_ENROLL_PATH}${keep}`)
                : router.replace(afterTwoFactorTarget)
            }
          />
        ) : (
          <RecoverAccess
            isSubmitting={isSubmitting}
            error={recoverError}
            failed={recoverFailed}
            onSubmit={handleRecover}
            onBack={() => router.replace(`${TWO_FACTOR_VERIFY_PATH}${keep}`)}
            onSignOut={signOutToLogin}
          />
        ))}

      {mode === 'enrollment' && (
        <EnrollmentFlow
          startEnrollment={startEnrollment}
          confirmEnrollment={confirmEnrollment}
          onFinish={finishEnrollment}
          onSignOut={signOutToLogin}
        />
      )}
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-surface-page">
          <div className="text-xs text-text-muted font-medium">Loading...</div>
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
