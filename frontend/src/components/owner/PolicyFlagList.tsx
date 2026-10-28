import React from 'react';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Input, Select } from '@/components/ui/Input';
import { PolicyPendingChip } from '@/components/ui/NoticePolicy';
import type { PolicyFlagRow } from '@/lib/api/admin';

/** Text shown in an input for a value; `null` draft = untouched. */
export function toInputText(value: unknown): string {
  if (Array.isArray(value)) return value.join(',');
  if (value === null || value === undefined) return '';
  return String(value);
}

/** Convert edited text back to the type of the flag's default. */
export function fromInputText(text: string, sample: unknown): unknown {
  if (typeof sample === 'boolean') return text === 'true';
  if (typeof sample === 'number') return text.trim() === '' ? null : Number(text);
  if (Array.isArray(sample)) {
    const parts = text.split(',').map((p) => p.trim()).filter(Boolean);
    return sample.every((x) => typeof x === 'number') && sample.length > 0 ? parts.map(Number) : parts;
  }
  return text;
}

function sampleOf(flag: PolicyFlagRow): unknown {
  return flag.default !== '' && flag.default !== undefined ? flag.default : flag.value;
}

const KIND_HELP: Record<PolicyFlagRow['kind'], string> = {
  FLAG: 'Feature flag — set by server configuration',
  CFG: 'Server configuration',
  SET: 'Owner setting',
};

export interface PolicyFlagListProps {
  flags: PolicyFlagRow[];
  /** Pending edits by flag key (raw input text). */
  drafts: Record<string, string>;
  onDraft: (key: string, text: string) => void;
}

/** Groups flags by their key prefix (`attendance.*`, `reservation.*` …). */
export function PolicyFlagList({ flags, drafts, onDraft }: PolicyFlagListProps) {
  const groups = new Map<string, PolicyFlagRow[]>();
  for (const f of flags) {
    const g = f.key.split('.')[0];
    groups.set(g, [...(groups.get(g) ?? []), f]);
  }
  return (
    <div className="space-y-6">
      {[...groups.entries()].map(([group, rows]) => (
        <Card key={group} className="p-0 overflow-hidden">
          <h3 className="px-5 py-3 border-b border-border-subtle bg-surface-subtle ds-overline text-text-secondary">{group}</h3>
          <ul className="divide-y divide-border-subtle">
            {rows.map((f) => (
              <PolicyFlagItem key={f.key} flag={f} draft={drafts[f.key]} onDraft={(t) => onDraft(f.key, t)} />
            ))}
          </ul>
        </Card>
      ))}
    </div>
  );
}

function PolicyFlagItem({ flag, draft, onDraft }: { flag: PolicyFlagRow; draft: string | undefined; onDraft: (text: string) => void }) {
  const editable = flag.editable;
  const sample = sampleOf(flag);
  const text = draft ?? toInputText(flag.value);
  const id = `flag-${flag.key}`;
  return (
    <li className="px-5 py-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,260px)] items-start">
      <div className="min-w-0 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <code className="text-[13px] font-semibold text-text-primary">{flag.key}</code>
          <PolicyPendingChip dec={flag.policy} demo />
          {!flag.configured && <Badge tone="warning">Not configured</Badge>}
        </div>
        <p className="text-xs text-text-muted">
          {KIND_HELP[flag.kind]}
          {flag.kind === 'SET' && !flag.editable ? ' · edited with the attendance settings (not here)' : ''}
          {' '}· {flag.source === 'stored' ? 'saved value' : 'using default'} · default{' '}
          <span className="font-mono">{toInputText(flag.default) === '' ? 'none (policy pending)' : toInputText(flag.default)}</span>
        </p>
      </div>
      <div>
        {editable ? (
          typeof sample === 'boolean' ? (
            <Select
              aria-label={flag.key}
              id={id}
              value={text}
              onChange={(e) => onDraft(e.target.value)}
              options={[
                { value: 'true', label: 'On' },
                { value: 'false', label: 'Off' },
              ]}
            />
          ) : (
            <Input
              aria-label={flag.key}
              id={id}
              value={text}
              type={typeof sample === 'number' ? 'number' : 'text'}
              placeholder={flag.configured ? undefined : 'Not set'}
              onChange={(e) => onDraft(e.target.value)}
            />
          )
        ) : (
          <div className="h-10 flex items-center px-3 rounded-md bg-surface-sunken text-[13px] font-mono text-text-primary overflow-x-auto" aria-label={`${flag.key} current value`}>
            {text === '' ? 'Not set' : text}
          </div>
        )}
      </div>
    </li>
  );
}
