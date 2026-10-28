'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Icon } from '@/components/ui/Icon';
import { Input, Textarea } from '@/components/ui/Input';
import { ApiError } from '@/lib/api/client';
import {
  getRole,
  updateRole,
  type DataScope,
  type PermissionCatalogItem,
  type RoleDetail,
  type RolePermissionDto,
} from '@/lib/api/roles';
import { MODULE_META, SCOPE_OPTIONS } from './roleMeta';

export interface RoleEditorProps {
  /** Latest copy from the server. The editor starts from the copy it was mounted with and never overwrites local edits. */
  role: RoleDetail;
  permissions: PermissionCatalogItem[];
  inspectedAction: string | null;
  onInspect: (perm: PermissionCatalogItem) => void;
  onDirtyChange: (dirty: boolean) => void;
  /** Called after a successful save; the parent refreshes its lists and remounts the editor. */
  onSaved: (role: RoleDetail) => void;
  /** Discard local edits and start from the latest server copy. */
  onReload: () => void;
}

function toMap(role: RoleDetail): Map<string, DataScope> {
  return new Map(role.permissions.map((p) => [p.action, p.dataScope]));
}

function sameMap(a: Map<string, DataScope>, b: Map<string, DataScope>): boolean {
  if (a.size !== b.size) return false;
  for (const [k, v] of a) if (b.get(k) !== v) return false;
  return true;
}

export function RoleEditor({ role, permissions, inspectedAction, onInspect, onDirtyChange, onSaved, onReload }: RoleEditorProps) {
  // Local state starts from the role this editor was mounted with (parent remounts it with a new key to reset).
  const [base] = useState(role);
  const [name, setName] = useState(role.name);
  const [description, setDescription] = useState(role.description ?? '');
  const [perms, setPerms] = useState<Map<string, DataScope>>(() => toMap(role));
  const [search, setSearch] = useState('');
  const [moduleFilter, setModuleFilter] = useState('all');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOwner = role.id === 'owner';
  const locked = isOwner;
  const nameChanged = !role.isSystem && (name.trim() !== base.name || description.trim() !== (base.description ?? ''));
  const dirty = !locked && (!sameMap(perms, toMap(base)) || nameChanged);
  const staleOnServer = role.updatedAt !== base.updatedAt;
  const nameValid = role.isSystem || name.trim().length > 0;

  useEffect(() => {
    onDirtyChange(dirty);
    return () => onDirtyChange(false);
  }, [dirty, onDirtyChange]);

  const byModule = useMemo(() => {
    const groups = new Map<string, PermissionCatalogItem[]>();
    for (const p of permissions) {
      const mod = p.module || 'General';
      groups.set(mod, [...(groups.get(mod) ?? []), p]);
    }
    return groups;
  }, [permissions]);
  const modules = useMemo(() => Array.from(byModule.keys()).sort(), [byModule]);

  const visible = useMemo(() => {
    const q = search.toLowerCase().trim();
    const out = new Map<string, PermissionCatalogItem[]>();
    for (const [mod, list] of byModule) {
      if (moduleFilter !== 'all' && mod !== moduleFilter) continue;
      const matched = list.filter(
        (p) => !q || p.displayName.toLowerCase().includes(q) || p.action.toLowerCase().includes(q) || p.description.toLowerCase().includes(q) || p.module.toLowerCase().includes(q)
      );
      if (matched.length > 0) out.set(mod, matched);
    }
    return out;
  }, [byModule, moduleFilter, search]);

  const toggle = (action: string) => {
    if (locked) return;
    setPerms((prev) => {
      const next = new Map(prev);
      if (next.has(action)) next.delete(action);
      else next.set(action, 'global');
      return next;
    });
  };
  const setScope = (action: string, scope: DataScope) => {
    if (locked) return;
    setPerms((prev) => new Map(prev).set(action, scope));
  };
  const setModuleAll = (mod: string, enable: boolean) => {
    if (locked) return;
    setPerms((prev) => {
      const next = new Map(prev);
      for (const p of byModule.get(mod) ?? []) {
        if (enable) {
          if (!next.has(p.action)) next.set(p.action, 'global');
        } else next.delete(p.action);
      }
      return next;
    });
  };
  const setAllCollapsed = (value: boolean) => setCollapsed(Object.fromEntries(modules.map((m) => [m, value])));

  async function save() {
    setSaving(true);
    setError(null);
    try {
      // The roles API has no version column: compare the stored `updatedAt` first so two Owners cannot silently overwrite each other.
      const latest = await getRole(role.id);
      if (latest.updatedAt !== base.updatedAt) {
        setError('This role was changed by someone else while you were editing. Load the latest version, then apply your change again.');
        setConfirmOpen(false);
        return;
      }
      const payload: RolePermissionDto[] = Array.from(perms.entries()).map(([action, dataScope]) => ({ action, dataScope }));
      const saved = await updateRole(role.id, {
        ...(role.isSystem ? {} : { name: name.trim(), description: description.trim() || null }),
        permissions: payload,
      });
      setConfirmOpen(false);
      onSaved(saved);
    } catch (err) {
      setConfirmOpen(false);
      setError(err instanceof ApiError ? err.message : 'Could not save the role. Try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-surface-default border border-border-default rounded-xl p-5 space-y-5 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-4 border-b border-border-subtle">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-semibold text-text-primary">{role.name}</h2>
            <Badge tone={role.isSystem ? 'neutral' : 'brand'} size="sm">
              {isOwner ? 'System · locked' : role.isSystem ? 'System role' : 'Custom role'}
            </Badge>
          </div>
          <p className="text-xs text-text-secondary mt-0.5 font-mono">
            Role ID: {role.id} · Assigned users: {role.employeeCount}
          </p>
        </div>
      </div>

      {staleOnServer && (
        <Alert tone="warning" title="Changed on the server" body="Someone saved a newer version of this role. Your edits are kept until you decide.">
          <div className="mt-2">
            <Button type="button" size="sm" variant="secondary" onClick={onReload}>
              {dirty ? 'Discard my edits and load latest' : 'Load latest'}
            </Button>
          </div>
        </Alert>
      )}
      {error && <Alert tone="danger" title="Not saved" body={error} role="alert" />}

      {isOwner && (
        <div className="p-3 bg-brand-primary/10 border border-brand-primary/20 rounded-lg flex items-start gap-2.5 text-xs text-text-secondary leading-relaxed">
          <Icon name="shield" size={16} className="text-brand-primary shrink-0 mt-0.5" />
          <div>
            <strong className="text-text-primary font-semibold block mb-0.5">Owner access is fixed</strong>
            The Owner holds every capability across the company. These privileges cannot be restricted, so the Owner is never locked out.
          </div>
        </div>
      )}

      {!role.isSystem && (
        <div className="grid grid-cols-1 gap-3">
          <Input label="Role name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} required error={name.trim() ? undefined : 'A name is required'} />
          <Textarea label="Description" value={description} rows={2} maxLength={500} onChange={(e) => setDescription(e.target.value)} />
        </div>
      )}

      <div className="space-y-2.5">
        <div className="relative">
          <input
            type="text"
            value={search}
            aria-label="Filter capabilities"
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter capabilities by name or keyword..."
            className="w-full h-9 pl-9 pr-9 rounded-lg border border-border-input bg-surface-default text-xs text-text-primary placeholder:text-text-muted focus:outline-hidden focus:border-brand-primary"
          />
          <div className="absolute left-3 top-2.5 text-text-muted pointer-events-none">
            <Icon name="search" size={14} />
          </div>
          {search && (
            <button
              type="button"
              aria-label="Clear filter"
              onClick={() => setSearch('')}
              className="absolute right-1 top-0 h-9 w-9 flex items-center justify-center text-text-muted hover:text-text-primary cursor-pointer"
            >
              <Icon name="x" size={14} />
            </button>
          )}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 border-t border-border-subtle">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs flex-1" role="group" aria-label="Module filter">
            <button
              type="button"
              aria-pressed={moduleFilter === 'all'}
              onClick={() => setModuleFilter('all')}
              className={`px-2.5 py-1 rounded-full whitespace-nowrap transition-colors cursor-pointer ${
                moduleFilter === 'all' ? 'bg-text-primary text-surface-default font-medium' : 'bg-surface-sunken text-text-secondary hover:text-text-primary'
              }`}
            >
              All modules ({permissions.length})
            </button>
            {modules.map((mod) => (
              <button
                key={mod}
                type="button"
                aria-pressed={moduleFilter === mod}
                onClick={() => setModuleFilter(mod)}
                className={`px-2.5 py-1 rounded-full whitespace-nowrap transition-colors flex items-center gap-1 cursor-pointer ${
                  moduleFilter === mod ? 'bg-brand-primary text-text-on-primary font-medium' : 'bg-surface-sunken text-text-secondary hover:text-text-primary'
                }`}
              >
                <span>{MODULE_META[mod]?.label || mod}</span>
                <span className="text-[10px] opacity-75">({byModule.get(mod)?.length ?? 0})</span>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center text-xs">
            <button type="button" onClick={() => setAllCollapsed(false)} className="px-2 py-1 text-[11px] text-text-secondary hover:text-brand-primary font-medium rounded cursor-pointer">
              Expand all
            </button>
            <span className="text-text-muted" aria-hidden>
              ·
            </span>
            <button type="button" onClick={() => setAllCollapsed(true)} className="px-2 py-1 text-[11px] text-text-secondary hover:text-text-primary font-medium rounded cursor-pointer">
              Collapse all
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {visible.size === 0 ? (
          <div className="p-8 text-center border border-dashed border-border-default rounded-xl">
            <p className="text-xs text-text-muted">No permissions match your search.</p>
          </div>
        ) : (
          Array.from(visible.entries()).map(([mod, list]) => {
            const meta = MODULE_META[mod];
            const granted = list.filter((p) => perms.has(p.action)).length;
            const isCollapsed = Boolean(collapsed[mod]) && !search.trim();
            const label = meta?.label || mod;
            return (
              <div key={mod} className="border border-border-default rounded-xl overflow-hidden bg-surface-default shadow-xs">
                <div className="px-4 py-3 bg-surface-subtle border-b border-border-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <button
                    type="button"
                    aria-expanded={!isCollapsed}
                    aria-label={`${isCollapsed ? 'Show' : 'Hide'} ${label} options`}
                    onClick={() => setCollapsed((prev) => ({ ...prev, [mod]: !prev[mod] }))}
                    className="flex items-start sm:items-center gap-2.5 min-w-0 text-left cursor-pointer rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                  >
                    <Icon name={isCollapsed ? 'chevron-down' : 'chevron-up'} size={15} className="text-text-muted shrink-0" />
                    <div className="p-1.5 rounded-lg bg-brand-primary/10 text-brand-primary shrink-0">
                      <Icon name={meta?.icon || 'check-circle'} size={16} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-xs text-text-primary">{label}</span>
                        <Badge tone={granted > 0 ? 'brand' : 'neutral'} size="sm">
                          {granted} of {list.length} active
                        </Badge>
                      </div>
                      {meta?.desc && <p className="text-[11px] text-text-muted mt-0.5 line-clamp-1">{meta.desc}</p>}
                    </div>
                  </button>
                  {!locked && (
                    <div className="flex items-center gap-2 text-[11px] shrink-0 self-end sm:self-center">
                      <button type="button" onClick={() => setModuleAll(mod, true)} className="text-brand-primary hover:underline font-medium cursor-pointer">
                        All
                      </button>
                      <span className="text-text-muted" aria-hidden>
                        ·
                      </span>
                      <button type="button" onClick={() => setModuleAll(mod, false)} className="text-text-muted hover:text-status-danger-fg font-medium cursor-pointer">
                        None
                      </button>
                    </div>
                  )}
                </div>

                {!isCollapsed && (
                  <ul className="divide-y divide-border-subtle">
                    {list.map((perm) => {
                      const checked = perms.has(perm.action);
                      const scope = perms.get(perm.action) ?? 'global';
                      const inspected = inspectedAction === perm.action;
                      const allowedScopes = perm.allowedScopes?.length ? SCOPE_OPTIONS.filter((o) => perm.allowedScopes.includes(o.value)) : SCOPE_OPTIONS;
                      return (
                        <li
                          key={perm.action}
                          className={`p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${inspected ? 'bg-brand-primary/5' : checked ? 'bg-surface-hover/30' : ''}`}
                        >
                          <div className="flex items-start gap-2.5 min-w-0 flex-1">
                            <input
                              type="checkbox"
                              id={`chk-${perm.action}`}
                              checked={checked}
                              disabled={locked}
                              onChange={() => toggle(perm.action)}
                              className="mt-0.5 h-4 w-4 rounded border-border-input text-brand-primary accent-brand-primary cursor-pointer disabled:cursor-not-allowed"
                            />
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <label htmlFor={`chk-${perm.action}`} className="text-xs font-semibold text-text-primary cursor-pointer">
                                  {perm.displayName}
                                </label>
                                {perm.requiresAdmin && (
                                  <Badge tone="danger" size="sm">
                                    2FA required
                                  </Badge>
                                )}
                                <button
                                  type="button"
                                  aria-pressed={inspected}
                                  aria-label={`Show details for ${perm.displayName}`}
                                  onClick={() => onInspect(perm)}
                                  className="text-[11px] text-text-link hover:underline cursor-pointer"
                                >
                                  Details
                                </button>
                              </div>
                              <p className="text-[11px] text-text-secondary mt-0.5 line-clamp-1">{perm.description}</p>
                              <code className="text-[10px] text-text-muted font-mono block mt-0.5">{perm.action}</code>
                            </div>
                          </div>
                          {checked && (
                            <div className="sm:w-44 shrink-0 pl-6 sm:pl-0">
                              <select
                                value={scope}
                                disabled={locked}
                                aria-label={`Data scope for ${perm.displayName}`}
                                onChange={(e) => setScope(perm.action, e.target.value as DataScope)}
                                className="w-full text-[11px] bg-surface-default border border-border-input rounded-md px-2 py-1.5 text-text-primary focus:outline-hidden focus:border-brand-primary cursor-pointer"
                              >
                                {allowedScopes.map((opt) => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })
        )}
      </div>

      {!locked && (
        <div className="pt-4 border-t border-border-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-[11px] text-text-muted" role="status">
            {dirty ? <span className="text-status-warning-fg font-medium">You have unsaved changes.</span> : `${perms.size} capabilities enabled. Everything is saved.`}
          </div>
          <Button
            type="button"
            disabled={!dirty || saving || !nameValid}
            isLoading={saving}
            onClick={() => (role.employeeCount > 0 ? setConfirmOpen(true) : void save())}
            leadingIcon={<Icon name="check" size={15} />}
          >
            Save role
          </Button>
        </div>
      )}

      <Dialog
        isOpen={confirmOpen}
        onClose={() => (saving ? undefined : setConfirmOpen(false))}
        title="Apply these changes?"
        description={`${role.employeeCount} ${role.employeeCount === 1 ? 'person holds' : 'people hold'} this role. New permissions apply to them right away.`}
        maxWidth="sm"
        footer={
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setConfirmOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void save()} isLoading={saving} disabled={saving}>
              Save role
            </Button>
          </div>
        }
      >
        <p className="text-xs text-text-secondary">The change is recorded in the audit log.</p>
      </Dialog>
    </div>
  );
}
