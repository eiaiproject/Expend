/**
 * Unit tests for templateService CRUD and graceful reference resolution.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../src/db/db';
import {
  getTemplates,
  saveTemplate,
  deleteTemplate,
  resolveTemplate,
} from '../../src/services/templateService';

beforeEach(async () => {
  await db.wallets.clear();
  await db.categories.clear();
  await db.settings.clear();
});

describe('template CRUD', () => {
  it('returns an empty list initially', async () => {
    expect(await getTemplates()).toHaveLength(0);
  });

  it('saves and retrieves a template', async () => {
    const saved = await saveTemplate({
      name: 'Coffee',
      amount: 25000,
      categoryId: 3,
      walletId: 1,
      description: 'Kopi Kenangan',
      notes: 'morning',
    });

    const templates = await getTemplates();
    expect(templates).toHaveLength(1);
    expect(templates[0]).toMatchObject({
      id: saved.id,
      name: 'Coffee',
      amount: 25000,
      categoryId: 3,
      walletId: 1,
      description: 'Kopi Kenangan',
      notes: 'morning',
    });
  });

  it('trims the template name', async () => {
    const saved = await saveTemplate({ name: '  Coffee  ' });
    expect(saved.name).toBe('Coffee');
  });

  it('rejects an empty template name', async () => {
    await expect(saveTemplate({ name: '   ' })).rejects.toThrow('Template name must not be empty.');
  });

  it('updates an existing template in place', async () => {
    const first = await saveTemplate({ name: 'Coffee', amount: 25000 });
    await saveTemplate({ id: first.id, name: 'Coffee', amount: 30000 });

    const templates = await getTemplates();
    expect(templates).toHaveLength(1);
    expect(templates[0]?.amount).toBe(30000);
  });

  it('deletes a template', async () => {
    const first = await saveTemplate({ name: 'Coffee' });
    await saveTemplate({ name: 'Lunch' });

    await deleteTemplate(first.id);
    const templates = await getTemplates();
    expect(templates).toHaveLength(1);
    expect(templates[0]?.name).toBe('Lunch');
  });

  it('caps the number of templates at 20', async () => {
    for (let i = 0; i < 25; i++) {
      await saveTemplate({ name: `Template ${i}` });
    }
    const templates = await getTemplates();
    expect(templates).toHaveLength(20);
  });

  it('ignores corrupt stored values', async () => {
    await db.settings.put({ key: 'transactionTemplates', value: 'not-an-array' });
    expect(await getTemplates()).toHaveLength(0);

    await db.settings.put({
      key: 'transactionTemplates',
      value: [{ bad: true }, { id: 'x', name: 'Valid' }],
    });
    const templates = await getTemplates();
    expect(templates).toHaveLength(1);
    expect(templates[0]?.id).toBe('x');
  });
});

describe('resolveTemplate (graceful reference handling)', () => {
  const wallets = [
    { id: 1, archivedAt: null },
    { id: 2, archivedAt: '2026-01-01T00:00:00.000Z' },
  ];
  const categories = [
    { id: 10, archivedAt: null },
    { id: 11, archivedAt: '2026-01-01T00:00:00.000Z' },
  ];

  it('resolves valid wallet and category references', async () => {
    const result = await resolveTemplate(
      { id: 't1', name: 'Coffee', amount: 25000, categoryId: 10, walletId: 1, description: 'Coffee', notes: 'n' },
      { wallets, categories },
    );
    expect(result).toEqual({
      amount: 25000,
      categoryId: 10,
      walletId: 1,
      description: 'Coffee',
      notes: 'n',
    });
  });

  it('drops archived wallet references', async () => {
    const result = await resolveTemplate(
      { id: 't1', name: 'Coffee', categoryId: 10, walletId: 2, description: 'Coffee' },
      { wallets, categories },
    );
    expect(result?.walletId).toBeNull();
    expect(result?.categoryId).toBe(10);
  });

  it('drops archived category references', async () => {
    const result = await resolveTemplate(
      { id: 't1', name: 'Coffee', categoryId: 11, walletId: 1, description: 'Coffee' },
      { wallets, categories },
    );
    expect(result?.categoryId).toBeNull();
    expect(result?.walletId).toBe(1);
  });

  it('keeps amount undefined when the template has no amount', async () => {
    const result = await resolveTemplate(
      { id: 't1', name: 'Coffee', description: 'Coffee' },
      { wallets, categories },
    );
    expect(result?.amount).toBeUndefined();
  });

  it('returns null for a template with an empty name', async () => {
    const result = await resolveTemplate({ id: 't1', name: '   ' }, { wallets, categories });
    expect(result).toBeNull();
  });

  it('reads wallets and categories from the DB when not provided', async () => {
    const walletId = await db.wallets.add({
      name: 'Cash',
      currency: 'IDR',
      initialBalance: 0,
      currentBalance: 0,
      lastUpdated: '2026-01-01',
    });
    const catId = await db.categories.add({ name: 'Food', icon: '🍔', color: '#fff' });

    const result = await resolveTemplate({
      id: 't1',
      name: 'Coffee',
      categoryId: catId,
      walletId,
      description: 'Coffee',
    });
    expect(result?.categoryId).toBe(catId);
    expect(result?.walletId).toBe(walletId);
  });
});
