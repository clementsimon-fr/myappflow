import type { ReactNode } from 'react';
import { statusLabel, statusTone } from '../lib/labels';
import type { DocKind } from '../lib/types';

export function StatusBadge({ kind, status }: { kind: DocKind; status: string }) {
  const tone = statusTone(status);
  return <span className={`badge${tone === 'muted' ? '' : ` badge-${tone}`}`}>{statusLabel(kind, status)}</span>;
}

export function ErrorBox({ error }: { error: string | null | undefined }) {
  if (!error) return null;
  return <div className="alert alert-error" role="alert">{error}</div>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}

export function Field({ label, children, full }: { label: string; children: ReactNode; full?: boolean }) {
  return <label className={`field${full ? ' full' : ''}`}>{label}{children}</label>;
}
