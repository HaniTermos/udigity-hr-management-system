'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import Link from 'next/link';
import { DEV_PERSONAS_ENABLED, DEV_SEED_PASSWORD } from '@/lib/devFlags';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { Avatar } from '@/components/ui/Avatar';
import { Icon } from '@/components/ui/Icon';
import { useToday } from '@/components/attendance/hooks';
import { useCompanyTime } from '@/lib/hooks/useCompanyTime';
import useSWR from 'swr';
import { getUnreadCount, notificationsPaths } from '@/lib/api/notifications';

const SEARCH_PLACEHOLDER: Record<string, string> = {
  owner: 'Search businesses, phones, handles',
  data_entry: 'Search businesses, phones, handles',
  call_center: 'Search assigned businesses',
  developer: 'Search deals and projects',
};

export function Header() {
  const router = useRouter();
  const { user, login, logout } = useAuth();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);
  const { data: today } = useToday();
  const time = useCompanyTime();
  const openSession = today?.session?.state === 'open' ? today.session : null;

  const { data: notifData } = useSWR(
    user ? notificationsPaths.unreadCount : null,
    getUnreadCount,
    { refreshInterval: 20000 }
  );
  const unreadCount = notifData?.unreadCount ?? 0;
  const unreadCountLabel = unreadCount > 99 ? '99+' : String(unreadCount);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const switchPersona = async (email: string) => {
    setIsUserMenuOpen(false);
    if (!DEV_PERSONAS_ENABLED) return;
    await login(email, DEV_SEED_PASSWORD);
    router.refresh();
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const roleName = user?.fullName ?? '';

  return (
    <header className="h-14 shrink-0 bg-surface-default border-b border-border-default px-6 flex items-center justify-between gap-4 select-none z-20">
      {/* Left: Search input matching Figma: Search my assigned businesses... [q] */}
      <form onSubmit={handleSearchSubmit} className="relative w-full max-w-sm">
        <div className="relative flex items-center">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={SEARCH_PLACEHOLDER[user?.role ?? ""] ?? "Search"}
            aria-label="Search"
            className="w-full h-8 pl-3 pr-8 rounded-lg border border-border-default bg-surface-default text-xs text-text-primary placeholder:text-text-placeholder focus:outline-none focus-ring-inside transition-colors"
          />
        </div>
      </form>

      {/* Right controls matching Figma: Checked in status · Notifications · User */}
      <div className="flex items-center gap-4 text-xs">
        {/* Attendance status badge */}
        <Link
          href="/my-day"
          className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-border-default bg-surface-default text-text-secondary font-medium hover:bg-surface-hover transition-colors"
        >
          {openSession ? `Checked in · ${time.formatTime(openSession.effectiveCheckInAt)}` : 'Not checked in'}
        </Link>

        {/* Light / navy-dark theme toggle (persists; default follows system) */}
        <ThemeToggle />

        {/* Interactive Notifications Bell */}
        <Link
          href="/notifications"
          className="relative inline-flex items-center justify-center h-9 w-9 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors"
          aria-label={unreadCount > 0 ? `Notifications, ${unreadCountLabel} unread` : 'Notifications'}
        >
          <Icon name="bell" size={18} />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-status-danger-solid text-[10px] font-bold text-text-on-danger leading-none">
              {unreadCountLabel}
            </span>
          )}
        </Link>

        {/* User Identity and Persona Dropdown matching Figma: AB Agent ˅ */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            aria-haspopup="menu"
            aria-expanded={isUserMenuOpen}
            className="flex items-center gap-2 p-1 rounded-lg hover:bg-surface-hover transition-colors cursor-pointer text-left"
          >
            {/* The name is the accessible name; the initials and the chevron are decoration. */}
            <Avatar name={user?.fullName || "?"} size="md" aria-hidden />
            <span className="text-xs font-medium text-text-primary flex items-center gap-1">
              {roleName} <Icon name="chevron-down" size={12} className="text-icon-muted" aria-hidden />
            </span>
          </button>

          {/* Persona Switcher / Profile Menu */}
          {isUserMenuOpen && (
            <div className="absolute right-0 top-10 w-64 rounded-xl border border-border-default bg-surface-default shadow-elevation-2 p-1.5 z-50 text-xs">
              <div className="px-3 py-2 border-b border-border-subtle mb-1">
                <p className="font-semibold text-text-primary text-sm">
                  {user?.fullName ?? ''}
                </p>
                <p className="text-[11px] text-text-muted">
                  {user?.email ?? ''}
                </p>
                <p className="text-[11px] font-semibold text-text-primary mt-0.5 uppercase tracking-wide">
                  {user?.role ? user.role.replace('_', ' ') : ''}
                </p>
              </div>

              {/* Dev-only persona switcher (NEXT_PUBLIC_ENABLE_DEV_PERSONAS, off by default) */}
              {DEV_PERSONAS_ENABLED && (
              <>
              <div className="px-3 py-1 text-[10px] font-semibold text-text-muted uppercase tracking-wider">
                Switch Role / Persona
              </div>

              <button
                type="button"
                onClick={() => switchPersona('maya.khoury@udigity.demo')}
                className={`w-full text-left px-3 py-1.5 rounded-lg hover:bg-surface-hover flex items-center justify-between cursor-pointer ${
                  user?.role === 'call_center' ? 'bg-surface-selected font-semibold' : ''
                }`}
              >
                <div>
                  <div className="text-text-primary">Maya Khoury (AB)</div>
                  <div className="text-[10px] text-text-muted">Call Center Agent</div>
                </div>
                {user?.role === 'call_center' && <span className="text-text-primary font-bold">✓</span>}
              </button>

              <button
                type="button"
                onClick={() => switchPersona('rana.haddad@udigity.demo')}
                className={`w-full text-left px-3 py-1.5 rounded-lg hover:bg-surface-hover flex items-center justify-between cursor-pointer ${
                  user?.role === 'owner' ? 'bg-surface-selected font-semibold' : ''
                }`}
              >
                <div>
                  <div className="text-text-primary">Rana Haddad</div>
                  <div className="text-[10px] text-text-muted">Owner / Admin</div>
                </div>
                {user?.role === 'owner' && <span className="text-text-primary font-bold">✓</span>}
              </button>

              </>
              )}

              <div className="border-t border-border-subtle mt-1 pt-1">
                <Link
                  href="/profile"
                  onClick={() => setIsUserMenuOpen(false)}
                  className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-surface-hover flex items-center gap-2 text-text-primary cursor-pointer"
                >
                  <span>My Profile</span>
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    logout();
                  }}
                  className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-status-danger-bg text-status-danger-fg flex items-center gap-2 cursor-pointer font-medium"
                >
                  <span>Sign out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
