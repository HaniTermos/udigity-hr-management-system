'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { SessionsList } from '@/components/auth/SessionsList';
import { AppShell } from '@/components/layout/AppShell';
import { Alert } from '@/components/ui/Alert';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { CardSection, CardInset } from '@/components/ui/Card';
import { Dialog } from '@/components/ui/Dialog';
import { Icon } from '@/components/ui/Icon';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { api, ApiError } from '@/lib/api';
import type { EmployeeRow } from '@/lib/api/employees';
import { identityAvailability, ownProfilePath, selfServicePaths } from '@/lib/api/identity';
import { useAuth } from '@/lib/auth';
import { PASSWORD_MIN_LENGTH, passwordRuleMessage } from '@/lib/passwordPolicy';
import { useApi } from '@/lib/hooks/useApi';
import { useTheme, type ThemePreference } from '@/lib/theme';

const ROLE_LABEL: Record<string, string> = {
  owner: 'Owner',
  data_entry: 'Data Entry',
  call_center: 'Call Center',
  developer: 'Developer',
};

const NOT_AVAILABLE = 'Not available yet';

function PasswordField({
  label,
  value,
  onChange,
  autoComplete,
  disabled,
  error,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
  disabled: boolean;
  error?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <Input
      label={label}
      type={show ? 'text' : 'password'}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      autoComplete={autoComplete}
      disabled={disabled}
      error={error}
      trailingElement={
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          disabled={disabled}
          aria-label={`${show ? 'Hide' : 'Show'} ${label.toLowerCase()}`}
          aria-pressed={show}
          className="flex items-center gap-1.5 px-1 h-8 text-[13px] font-medium text-text-link disabled:text-text-disabled"
        >
          <Icon name={show ? 'eye-off' : 'eye'} size={16} />
          {show ? 'Hide' : 'Show'}
        </button>
      }
    />
  );
}

function ProfileContent() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const { preference, setTheme } = useTheme();
  const { data, error, isLoading, retry } = useApi<{ employee: EmployeeRow }>(ownProfilePath);
  const employee = data?.employee;

  const canEditProfile = identityAvailability.profileUpdate;
  const canChangePassword = identityAvailability.passwordChange;
  const canRevokeAll = identityAvailability.revokeAllSessions;

  const [phoneDraft, setPhoneDraft] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | undefined>();
  const [changing, setChanging] = useState(false);

  const [revokeOpen, setRevokeOpen] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [revokeError, setRevokeError] = useState<string | null>(null);

  const fullName = employee?.fullName ?? user?.fullName ?? '';
  const email = employee?.email ?? user?.email ?? '';
  const roleLabel = ROLE_LABEL[employee?.role ?? user?.role ?? ''] ?? '';
  const phone = phoneDraft ?? employee?.phone ?? '';
  const dirty = phoneDraft !== null && phoneDraft !== (employee?.phone ?? '');

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEditProfile || !employee) return;
    const trimmed = phone.trim();
    if (!/^\+?[0-9\s\-()]{7,20}$/.test(trimmed)) {
      setPhoneError('Enter a valid phone number.');
      return;
    }
    setPhoneError(undefined);
    setSaving(true);
    try {
      await api.patch(selfServicePaths.profileUpdate, { version: employee.version, phone: trimmed });
      await retry();
      setPhoneDraft(null);
      setConflict(false);
      toast.show({ tone: 'success', title: 'Profile saved' });
    } catch (err) {
      if (err instanceof ApiError && err.code === 'VERSION_CONFLICT') setConflict(true);
      else toast.show({ tone: 'error', title: 'Profile not saved', body: 'Nothing was changed. Try again.' });
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canChangePassword) return;
    if (!currentPassword) return setPasswordError('Enter your current password.');
    if (newPassword.length < PASSWORD_MIN_LENGTH) return setPasswordError(`The new password must be at least ${PASSWORD_MIN_LENGTH} characters.`);
    if (newPassword !== confirmPassword) return setPasswordError('The new passwords do not match.');
    setPasswordError(undefined);
    setChanging(true);
    try {
      await api.post(selfServicePaths.passwordChange, { currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast.show({ tone: 'success', title: 'Password changed', body: 'Other sessions were signed out.' });
    } catch (err) {
      if (err instanceof ApiError && (err.code === 'REAUTH_FAILED' || err.code === 'INVALID_CREDENTIALS')) {
        setPasswordError('The current password is not correct.');
      } else if (err instanceof ApiError && passwordRuleMessage(err)) {
        setPasswordError(passwordRuleMessage(err) ?? undefined);
      } else {
        toast.show({ tone: 'error', title: 'Password not changed', body: 'Nothing was changed. Try again.' });
      }
    } finally {
      setChanging(false);
    }
  };

  const revokeAll = async () => {
    if (!canRevokeAll) return;
    setRevoking(true);
    setRevokeError(null);
    try {
      await api.post(selfServicePaths.revokeAllSessions, {});
      setRevokeOpen(false);
      // The server already ended this session and cleared the cookies, so /logout may answer 401: go to sign-in either way.
      try {
        await logout();
      } catch {
        router.push('/login');
      }
    } catch {
      setRevokeError('Your sessions were not ended. Nothing was changed. Try again.');
    } finally {
      setRevoking(false);
    }
  };

  const themeOptions: { value: ThemePreference; label: string }[] = [
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
    { value: 'system', label: 'System' },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-4 pb-12">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-text-primary">My Profile</h1>
        <p className="text-sm text-text-secondary mt-1">Your account, password and preferences</p>
      </div>

      {error && (
        <Alert
          tone="danger"
          title="Your profile could not be loaded"
          body="Showing what the session knows. Nothing was changed."
        >
          <Button size="sm" variant="secondary" onClick={() => void retry()}>
            Try again
          </Button>
        </Alert>
      )}
      {conflict && (
        <Alert
          tone="warning"
          title="Your profile changed elsewhere"
          body="The Owner updated this profile after you opened it. Nothing was overwritten."
        >
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setPhoneDraft(null);
              setConflict(false);
              void retry();
            }}
          >
            Reload latest
          </Button>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
        <form onSubmit={saveProfile} noValidate aria-label="Personal details">
          <CardSection title="Personal details" subtitle="Some fields are managed by the Owner/Admin">
            <div className="flex items-center gap-3">
              <Avatar name={fullName || '?'} size="lg" />
              <div className="min-w-0">
                <div className="text-base font-semibold text-text-primary truncate">{isLoading ? 'Loading' : fullName}</div>
                <div className="text-[13px] text-text-muted truncate">
                  {email}
                  {roleLabel ? ` · ${roleLabel}` : ''}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="Full name" value={fullName} readOnly disabled helperText="Managed by the Owner/Admin" />
              <Input label="Role" value={roleLabel} readOnly disabled helperText="Managed by the Owner/Admin" />
            </div>
            <Input label="Work email" value={email} readOnly disabled helperText="Managed by the Owner/Admin" />
            <Input
              label="Mobile phone"
              type="tel"
              autoComplete="tel"
              value={phone}
              onChange={(e) => {
                setPhoneDraft(e.target.value);
                setPhoneError(undefined);
              }}
              disabled={!canEditProfile}
              error={phoneError}
              helperText={canEditProfile ? 'Used by your team to reach you.' : `${NOT_AVAILABLE}. Your phone is shown as recorded.`}
              wrapperClassName="w-full"
            />
            <div className="flex items-center justify-end gap-3">
              <Button type="button" variant="ghost" disabled={!dirty || saving} onClick={() => setPhoneDraft(null)}>
                Discard
              </Button>
              <Button type="submit" disabled={!canEditProfile || !dirty} isLoading={saving} title={canEditProfile ? undefined : NOT_AVAILABLE}>
                Save changes
              </Button>
            </div>
            {!canEditProfile && <p className="text-[13px] text-text-muted text-right -mt-2">{NOT_AVAILABLE}</p>}
          </CardSection>
        </form>

        <div className="space-y-5">
          <form onSubmit={changePassword} noValidate aria-label="Change password">
            <CardSection title="Password">
              <PasswordField
                label="Current password"
                value={currentPassword}
                onChange={setCurrentPassword}
                autoComplete="current-password"
                disabled={!canChangePassword}
              />
              <PasswordField
                label="New password"
                value={newPassword}
                onChange={setNewPassword}
                autoComplete="new-password"
                disabled={!canChangePassword}
                error={passwordError}
              />
              <PasswordField
                label="Confirm new password"
                value={confirmPassword}
                onChange={setConfirmPassword}
                autoComplete="new-password"
                disabled={!canChangePassword}
              />
              <Button
                type="submit"
                variant="secondary"
                fullWidth
                disabled={!canChangePassword}
                isLoading={changing}
                leadingIcon={<Icon name="lock" size={16} />}
                title={canChangePassword ? undefined : NOT_AVAILABLE}
              >
                Change password
              </Button>
              {!canChangePassword && <p className="text-[13px] text-text-muted -mt-2">{NOT_AVAILABLE}. Use the reset link from the sign-in page meanwhile.</p>}
              <CardInset className="flex flex-wrap items-center gap-2">
                <span className="text-[13px] text-text-secondary">
                  Changing your password signs you out of your other sessions.
                </span>
              </CardInset>
            </CardSection>
          </form>

          <CardSection title="Appearance & sessions" subtitle="Theme is a personal preference">
            <fieldset>
              <legend className="sr-only">Theme</legend>
              <div className="flex flex-wrap items-center gap-5">
                {themeOptions.map((o) => (
                  <label key={o.value} className="inline-flex items-center gap-2 text-sm text-text-primary cursor-pointer min-h-[44px]">
                    <input
                      type="radio"
                      name="theme"
                      value={o.value}
                      checked={preference === o.value}
                      onChange={() => setTheme(o.value)}
                      className="h-4 w-4 accent-[var(--brand-primary)]"
                    />
                    {o.label}
                  </label>
                ))}
              </div>
            </fieldset>
            <SessionsList />
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="secondary" onClick={() => void logout()} leadingIcon={<Icon name="log-out" size={16} />}>
                Sign out
              </Button>
              <Button
                variant="ghost"
                disabled={!canRevokeAll}
                onClick={() => setRevokeOpen(true)}
                title={canRevokeAll ? undefined : NOT_AVAILABLE}
              >
                Sign out of all sessions
              </Button>
              {!canRevokeAll && <span className="text-[13px] text-text-muted">{NOT_AVAILABLE}</span>}
            </div>
          </CardSection>
        </div>
      </div>

      <Dialog
        isOpen={revokeOpen}
        onClose={() => (revoking ? undefined : setRevokeOpen(false))}
        title="Sign out of all sessions?"
        description="This ends your session on every device, including this one. You will need to sign in again."
        footer={
          <>
            <Button variant="ghost" onClick={() => setRevokeOpen(false)} disabled={revoking}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void revokeAll()} isLoading={revoking}>
              Sign out everywhere
            </Button>
          </>
        }
      >
        {revokeError && <Alert tone="danger" title="Not signed out" body={revokeError} />}
      </Dialog>
    </div>
  );
}

export default function MyProfilePage() {
  return (
    <AppShell>
      <ProfileContent />
    </AppShell>
  );
}
