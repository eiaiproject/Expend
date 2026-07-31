/**
 * Transaction templates service (master.md section 5.4).
 *
 * Templates are stored as a JSON array in the lightweight `settings` store
 * (no relational querying needed — see master.md section 15).
 *
 * A template may carry: name, optional amount, category, wallet, payee
 * (description), and notes. References to archived/removed wallets or
 * categories must degrade gracefully when applied.
 */
import { db } from '../db/db';
import { normalizePayeeName } from './payeeService';

export interface TransactionTemplate {
  id: string;
  name: string;
  /** Optional amount; undefined keeps the amount empty when applied */
  amount?: number;
  /** Optional category reference; must be ignored when archived/removed */
  categoryId?: number;
  /** Optional wallet reference; must be ignored when archived/removed */
  walletId?: number;
  /** Optional payee/description to prefill */
  description?: string;
  /** Optional notes to prefill */
  notes?: string;
  createdAt: string;
}

const TEMPLATES_SETTINGS_KEY = 'transactionTemplates';

const MAX_TEMPLATES = 20;

function parseTemplates(value: unknown): TransactionTemplate[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is TransactionTemplate =>
      typeof item === 'object' &&
      item !== null &&
      typeof (item as TransactionTemplate).id === 'string' &&
      typeof (item as TransactionTemplate).name === 'string',
  );
}

/**
 * List all saved templates, newest first.
 */
export async function getTemplates(): Promise<TransactionTemplate[]> {
  const entry = await db.settings.get(TEMPLATES_SETTINGS_KEY);
  return parseTemplates(entry?.value).sort(
    (a, b) => b.createdAt.localeCompare(a.createdAt),
  );
}

/**
 * Create or update a template. Enforces a reasonable cap.
 */
export async function saveTemplate(
  template: Omit<TransactionTemplate, 'id' | 'createdAt'> &
    Partial<Pick<TransactionTemplate, 'id' | 'createdAt'>>,
): Promise<TransactionTemplate> {
  const name = template.name.trim();
  if (!name) throw new Error('Template name must not be empty.');

  const existing = await getTemplates();
  const now = new Date().toISOString();
  const next: TransactionTemplate = {
    id: template.id?.trim() ? template.id.trim() : `template-${crypto.randomUUID()}`,
    name,
    amount: template.amount,
    categoryId: template.categoryId,
    walletId: template.walletId,
    description: normalizePayeeName(template.description ?? ''),
    notes: template.notes ?? '',
    createdAt: template.createdAt ?? now,
  };

  const filtered = existing.filter((t) => t.id !== next.id);
  const merged = [next, ...filtered].slice(0, MAX_TEMPLATES);

  await db.settings.put({ key: TEMPLATES_SETTINGS_KEY, value: merged });
  return next;
}

/**
 * Delete a template by id.
 */
export async function deleteTemplate(id: string): Promise<void> {
  const existing = await getTemplates();
  const next = existing.filter((t) => t.id !== id);
  if (next.length === existing.length) return;
  await db.settings.put({ key: TEMPLATES_SETTINGS_KEY, value: next });
}

/**
 * Resolve a template to concrete prefill values, degrading gracefully when
 * referenced wallets or categories are archived or no longer exist.
 *
 * @returns null when the template is empty or its name is missing.
 */
export async function resolveTemplate(
  template: TransactionTemplate,
  options?: { wallets?: ReadonlyArray<{ id?: number; archivedAt?: string | null }>; categories?: ReadonlyArray<{ id?: number; archivedAt?: string | null }> },
): Promise<{
  amount: number | undefined;
  categoryId: number | null;
  walletId: number | null;
  description: string;
  notes: string;
} | null> {
  if (!template.name.trim()) return null;

  const wallets = options?.wallets ?? (await db.wallets.toArray());
  const categories = options?.categories ?? (await db.categories.toArray());

  const wallet =
    template.walletId != null
      ? wallets.find((w) => w.id === template.walletId && !w.archivedAt)
      : undefined;
  const category =
    template.categoryId != null
      ? categories.find((c) => c.id === template.categoryId && !c.archivedAt)
      : undefined;

  return {
    amount: typeof template.amount === 'number' ? template.amount : undefined,
    categoryId: category?.id ?? null,
    walletId: wallet?.id ?? null,
    description: template.description ?? '',
    notes: template.notes ?? '',
  };
}
