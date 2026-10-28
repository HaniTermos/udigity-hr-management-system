'use client';

import React, { useCallback, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import { ApiErrorView } from '@/components/states/ApiErrorView';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Icon } from '@/components/ui/Icon';
import { Input, Textarea } from '@/components/ui/Input';
import { PolicyPendingChip } from '@/components/ui/NoticePolicy';
import { Skeleton } from '@/components/ui/State';
import { useToast } from '@/components/ui/Toast';
import { ApiError } from '@/lib/api/client';
import {
  createRole,
  deleteRole,
  rolesPaths,
  type PermissionCatalogItem,
  type RoleDetail,
  type RoleSummary,
} from '@/lib/api/roles';
import { useApi } from '@/lib/hooks/useApi';
import { RoleEditor } from './RoleEditor';
import { SCOPE_OPTIONS } from './roleMeta';

export default function RolesStudioPage() {
  const toast = useToast();
  const roles = useApi<{ roles: RoleSummary[] }>(rolesPaths.roles, { refreshInterval: 0 });
  const catalog = useApi<{ permissions: PermissionCatalogItem[] }>(rolesPaths.permissions, { refreshInterval: 0, revalidateOnFocus: false });

  const roleList = roles.data?.roles ?? [];
  const permissions = catalog.data?.permissions ?? [];

  const [pickedId, setPickedId] = useState<string | null>(null);
  const selectedId = pickedId ?? roleList.find((r) => r.id === 'owner')?.id ?? roleList[0]?.id ?? null;
  const detail = useApi<{ role: RoleDetail }>(selectedId ? rolesPaths.role(selectedId) : null, { refreshInterval: 0 });
  const activeRole = detail.data?.role;
  // Bumped to remount the editor from the latest server copy (after a save or "Load latest").
  const [epoch, setEpoch] = useState(0);

  const [dirty, setDirty] = useState(false);
  const onDirtyChange = useCallback((d: boolean) => setDirty(d), []);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [inspectedAction, setInspectedAction] = useState<string | null>(null);
  const inspected = permissions.find((p) => p.action === inspectedAction) ?? permissions[0] ?? null;

  const [createOpen, setCreateOpen] = useState(false);
  const [newId, setNewId] = useState('');
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const select = (id: string) => {
    if (id === selectedId) return;
    if (dirty) setPendingId(id);
    else setPickedId(id);
  };

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const cleanId = newId.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    if (!cleanId || !newName.trim()) {
      setCreateError('Enter an identifier and a display name.');
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const created = await createRole({ id: cleanId, name: newName.trim(), description: newDesc.trim() || null, permissions: [] });
      await roles.mutate();
      setPickedId(created.id);
      setCreateOpen(false);
      setNewId('');
      setNewName('');
      setNewDesc('');
      toast.show({ tone: 'success', title: 'Role created', body: `"${created.name}" has no permissions yet. Choose them and save.` });
    } catch (err) {
      setCreateError(err instanceof ApiError ? err.message : 'Could not create the role. Try again.');
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete() {
    if (!activeRole) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteRole(activeRole.id);
      await roles.mutate();
      setPickedId(null);
      setDeleteOpen(false);
      toast.show({ tone: 'success', title: 'Role deleted', body: `"${activeRole.name}" was removed.` });
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : 'Could not delete the role. Try again.');
    } finally {
      setDeleting(false);
    }
  }

  const systemRoles = roleList.filter((r) => r.isSystem);
  const customRoles = roleList.filter((r) => !r.isSystem);
  const loadError = roles.error ?? catalog.error;
  const loadRoute = roles.route ?? catalog.route;
  const loading = !roles.data || !catalog.data;

  const roleButton = (r: RoleSummary, tone: 'neutral' | 'brand' | 'danger') => {
    const selected = r.id === selectedId;
    return (
      <button
        key={r.id}
        type="button"
        aria-current={selected ? 'true' : undefined}
        onClick={() => select(r.id)}
        className={`w-full text-left px-3 py-2.5 min-h-[44px] rounded-lg flex items-center justify-between transition-colors cursor-pointer border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${
          selected ? 'bg-brand-primary/10 border-brand-primary text-brand-primary font-medium' : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary border-transparent'
        }`}
      >
        <div className="min-w-0 pr-2">
          <div className="text-xs font-semibold truncate">{r.name}</div>
          <div className="text-[11px] text-text-muted truncate font-mono mt-0.5">{r.id}</div>
        </div>
        <Badge tone={tone} size="sm">
          {r.employeeCount} {r.employeeCount === 1 ? 'user' : 'users'}
        </Badge>
      </button>
    );
  };

  return (
    <AppShell>
      <div className="max-w-[1440px] mx-auto space-y-6 pb-12">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border-subtle">
          <div>
            <div className="flex items-center gap-2 text-xs text-text-muted mb-1">
              <Link href="/settings" className="hover:text-text-primary transition-colors">
                Settings
              </Link>
              <span aria-hidden>/</span>
              <span className="text-text-secondary font-medium">Roles & access control</span>
            </div>
            <h1 className="text-2xl font-semibold leading-8 tracking-tight text-text-primary flex flex-wrap items-center gap-2">
              Roles & Permissions Studio
              <PolicyPendingChip dec="No DEC ID" label="custom roles" />
            </h1>
            <p className="text-xs text-text-secondary mt-1 max-w-2xl">
              Create roles, grant capabilities by module and set how far each role can see company data. The four built-in roles keep the approved visibility rules.
            </p>
          </div>
          <Button type="button" onClick={() => setCreateOpen(true)} disabled={loading} leadingIcon={<Icon name="plus" size={16} />}>
            Create custom role
          </Button>
        </div>

        {loadError && !loading ? (
          <ApiErrorView
            error={loadError}
            route={loadRoute}
            area="Roles & Permissions"
            what="the roles"
            onRetry={() => {
              void roles.retry();
              void catalog.retry();
            }}
          />
        ) : loading ? (
          <div role="status" aria-label="Loading roles" className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <Skeleton className="lg:col-span-3 h-64 rounded-xl" />
            <Skeleton className="lg:col-span-6 h-96 rounded-xl" />
            <Skeleton className="lg:col-span-3 h-64 rounded-xl" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-3 space-y-4">
              <nav aria-label="Roles" className="space-y-4">
                <div className="bg-surface-default border border-border-default rounded-xl p-3.5 space-y-2.5 shadow-xs">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">System roles</span>
                    <Icon name="shield" size={13} className="text-text-muted" />
                  </div>
                  <div className="space-y-1">{systemRoles.map((r) => roleButton(r, r.id === 'owner' ? 'danger' : 'neutral'))}</div>
                </div>

                <div className="bg-surface-default border border-border-default rounded-xl p-3.5 space-y-2.5 shadow-xs">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Custom roles ({customRoles.length})</span>
                    <button type="button" onClick={() => setCreateOpen(true)} className="text-xs text-text-link hover:underline font-semibold cursor-pointer min-h-[32px]">
                      + Add
                    </button>
                  </div>
                  {customRoles.length === 0 ? (
                    <p className="text-xs text-text-muted py-2 px-1">No custom roles yet. Create one for a team with its own responsibilities.</p>
                  ) : (
                    <div className="space-y-1">{customRoles.map((r) => roleButton(r, 'brand'))}</div>
                  )}
                </div>
              </nav>

              {activeRole && (
                <div className="bg-surface-subtle border border-border-subtle rounded-xl p-3.5 space-y-2 text-xs">
                  <div className="font-semibold text-text-primary flex items-center gap-1.5">
                    <Icon name="info" size={14} className="text-brand-primary" />
                    About this role
                  </div>
                  <p className="text-text-secondary leading-relaxed">{activeRole.description || 'No description entered for this role.'}</p>
                  {!activeRole.isSystem && (
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      disabled={activeRole.employeeCount > 0}
                      title={activeRole.employeeCount > 0 ? 'Reassign its employees before deleting' : 'Delete this custom role'}
                      onClick={() => {
                        setDeleteError(null);
                        setDeleteOpen(true);
                      }}
                      leadingIcon={<Icon name="trash" size={14} />}
                    >
                      Delete role
                    </Button>
                  )}
                </div>
              )}
            </div>

            <div className="lg:col-span-6 space-y-4">
              {detail.error && !activeRole ? (
                <ApiErrorView error={detail.error} route={detail.route} onRetry={() => void detail.retry()} size="inline" what="this role" area="Roles & Permissions" />
              ) : !activeRole ? (
                <Skeleton className="h-96 rounded-xl" role="status" aria-label="Loading role" />
              ) : (
                <RoleEditor
                  key={`${activeRole.id}:${epoch}`}
                  role={activeRole}
                  permissions={permissions}
                  inspectedAction={inspected?.action ?? null}
                  onInspect={(p) => setInspectedAction(p.action)}
                  onDirtyChange={onDirtyChange}
                  onSaved={async () => {
                    await Promise.all([roles.mutate(), detail.mutate()]);
                    setEpoch((n) => n + 1);
                    toast.show({ tone: 'success', title: 'Role saved', body: 'The change is in effect and recorded in the audit log.' });
                  }}
                  onReload={async () => {
                    await detail.mutate();
                    setEpoch((n) => n + 1);
                  }}
                />
              )}
            </div>

            <div className="lg:col-span-3 space-y-4">
              <div className="bg-surface-default border border-border-default rounded-xl p-4 space-y-3 shadow-xs">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-text-primary pb-2 border-b border-border-subtle">
                  <Icon name="info" size={14} className="text-brand-primary" />
                  Capability guide
                </div>
                {inspected ? (
                  <div className="space-y-2.5 text-xs" aria-live="polite">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-text-muted tracking-wider">Selected capability</span>
                      <h2 className="font-semibold text-text-primary text-sm mt-0.5">{inspected.displayName}</h2>
                      <code className="text-[11px] font-mono text-brand-primary bg-brand-primary/10 px-1 py-0.5 rounded mt-0.5 inline-block">{inspected.action}</code>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-text-muted tracking-wider">What this allows</span>
                      <p className="text-text-secondary mt-0.5 leading-relaxed">{inspected.description}</p>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-text-muted tracking-wider">Risk level</span>
                      <div className="mt-1">
                        {inspected.requiresAdmin ? (
                          <div className="p-2 bg-status-danger-bg border border-status-danger-border rounded-md text-[11px] text-status-danger-fg">
                            <strong>Administrative:</strong> needs a completed two-factor sign-in to use.
                          </div>
                        ) : (
                          <div className="p-2 bg-surface-subtle border border-border-subtle rounded-md text-[11px] text-text-secondary">
                            <strong>Standard:</strong> everyday work, limited by the data scope.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-text-muted">Choose Details on a capability to read what it allows.</p>
                )}
              </div>

              <div className="bg-surface-default border border-border-default rounded-xl p-4 space-y-3 shadow-xs">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-text-primary pb-2 border-b border-border-subtle">
                  <Icon name="globe" size={14} className="text-status-info-fg" />
                  Data scope guide
                </div>
                <div className="space-y-2 text-xs">
                  {SCOPE_OPTIONS.map((sc) => (
                    <div key={sc.value} className="p-2 rounded-lg bg-surface-subtle border border-border-subtle">
                      <div className="font-semibold text-text-primary flex items-center justify-between">
                        <span>{sc.label}</span>
                        <code className="text-[10px] font-mono text-text-muted">{sc.value}</code>
                      </div>
                      <p className="text-[11px] text-text-secondary mt-1 leading-normal">{sc.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-surface-default border border-border-default rounded-xl p-4 space-y-2.5 text-xs shadow-xs">
                <div className="font-semibold text-text-primary flex items-center gap-1.5 pb-2 border-b border-border-subtle">
                  <Icon name="lock" size={14} className="text-status-warning-fg" />
                  Rules
                </div>
                <ul className="space-y-1.5 text-[11px] text-text-secondary list-disc pl-4 leading-normal">
                  <li>Permission changes apply to everyone holding the role right away.</li>
                  <li>
                    The <strong>Owner</strong> role cannot be changed or deleted, so the company is never locked out.
                  </li>
                  <li>A role cannot be deleted while employees still hold it.</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        <Dialog
          isOpen={createOpen}
          onClose={() => (creating ? undefined : setCreateOpen(false))}
          title="Create custom role"
          description="Name the role now. Choose its permissions after it is created."
        >
          <form onSubmit={handleCreate} className="space-y-4">
            {createError && <Alert tone="danger" title="Could not create the role" body={createError} role="alert" />}
            <Input
              label="Role identifier"
              required
              value={newId}
              onChange={(e) => setNewId(e.target.value)}
              placeholder="e.g. human_resources"
              helperText="Lowercase letters, numbers, hyphens and underscores."
            />
            <Input label="Display name" required value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Human Resources" />
            <Textarea label="Description" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} rows={3} placeholder="What do people in this role do?" />
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border-subtle">
              <Button type="button" variant="secondary" onClick={() => setCreateOpen(false)} disabled={creating}>
                Cancel
              </Button>
              <Button type="submit" isLoading={creating} disabled={creating}>
                Create role
              </Button>
            </div>
          </form>
        </Dialog>

        <Dialog
          isOpen={deleteOpen}
          onClose={() => (deleting ? undefined : setDeleteOpen(false))}
          title="Delete custom role"
          description={activeRole ? `Delete "${activeRole.name}"? This cannot be undone.` : undefined}
          maxWidth="sm"
          footer={
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setDeleteOpen(false)} disabled={deleting}>
                Cancel
              </Button>
              <Button type="button" variant="destructive" isLoading={deleting} disabled={deleting} onClick={() => void handleDelete()}>
                Delete role
              </Button>
            </div>
          }
        >
          {deleteError ? <Alert tone="danger" title="Could not delete" body={deleteError} role="alert" /> : <p className="text-xs text-text-secondary">The role is removed from the registry.</p>}
        </Dialog>

        <Dialog
          isOpen={pendingId !== null}
          onClose={() => setPendingId(null)}
          title="Discard unsaved changes?"
          description="You have edits on this role that are not saved. Switching roles discards them."
          maxWidth="sm"
          footer={
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setPendingId(null)}>
                Keep editing
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={() => {
                  setPickedId(pendingId);
                  setPendingId(null);
                }}
              >
                Discard and switch
              </Button>
            </div>
          }
        >
          <p className="text-xs text-text-secondary">Unsaved edits are not recoverable.</p>
        </Dialog>
      </div>
    </AppShell>
  );
}
