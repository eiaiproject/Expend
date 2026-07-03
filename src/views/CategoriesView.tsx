import { useState, useMemo, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Category } from '../db/db';
import { Tag, Plus, Edit2, Trash2, Check, X, Save, ArrowLeft, HelpCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { cn } from '../utils/cn';
import { getMonthStartStr, getNextMonthStartStr, normaliseDate } from '../utils/dateUtils';
import { confirm } from '../components/ConfirmDialog';
import { toast } from '../components/Toaster';
import { CURATED_PALETTE } from '../utils/constants';
import { formatAmountLocal } from '../utils/formatUtils';
import { EmptyState } from '../components/EmptyState';

interface CategoryWithSpending {
  id: number;
  name: string;
  icon: string;
  color: string;
  budget?: number;
  spendingThisMonth: number;
  txCount: number;
}

export default function CategoriesView() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const categories = useLiveQuery(() => db.categories.toArray(), [], []);
  const transactions = useLiveQuery(() => db.transactions.toArray(), [], []);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');
  const [editBudget, setEditBudget] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState<string>(CURATED_PALETTE[0] as string);
  const [newBudget, setNewBudget] = useState('');

  const newCategoryInputRef = useRef<HTMLInputElement>(null);
  const editCategoryInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showAddForm && newCategoryInputRef.current) {
      newCategoryInputRef.current.focus();
    }
  }, [showAddForm]);

  useEffect(() => {
    if (editingId && editCategoryInputRef.current) {
      editCategoryInputRef.current.focus();
    }
  }, [editingId]);

  const categoriesWithSpending: CategoryWithSpending[] = useMemo(() => {
    if (!categories || !transactions) return [];

    const monthStart = getMonthStartStr();
    const nextMonthStart = getNextMonthStartStr();

    // Single-pass aggregation: O(n+m) instead of O(n*m)
    const spendingMap = new Map<number, { totalSpending: number; txCount: number; monthSpending: number }>();

    for (const tx of transactions) {
      if (tx.type !== 'expense' || tx.categoryId == null) continue;
      const entry = spendingMap.get(tx.categoryId) ?? { totalSpending: 0, txCount: 0, monthSpending: 0 };
      entry.totalSpending += tx.amount;
      entry.txCount += 1;
      const txDate = normaliseDate(tx.date);
      if (txDate >= monthStart && txDate < nextMonthStart) {
        entry.monthSpending += tx.amount;
      }
      spendingMap.set(tx.categoryId, entry);
    }

    return categories.map(cat => {
      const stats = spendingMap.get(cat.id!);
      return {
        id: cat.id!,
        name: cat.name,
        icon: cat.icon,
        color: cat.color,
        budget: cat.budget,
        spendingThisMonth: stats?.monthSpending ?? 0,
        txCount: stats?.txCount ?? 0,
      };
    }).sort((a, b) => b.spendingThisMonth - a.spendingThisMonth);
  }, [categories, transactions]);

  const handleStartEdit = (cat: CategoryWithSpending) => {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditColor(cat.color || '');
    setEditBudget(cat.budget ? cat.budget.toString() : '');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditName('');
    setEditColor('');
    setEditBudget('');
  };

  const handleSaveEdit = async (id: number) => {
    if (!editName.trim()) return;
    try {
      // Prevent duplicate name
      const duplicate = categories?.find(c => c.id !== id && c.name.toLowerCase() === editName.trim().toLowerCase());
      if (duplicate) {
        toast.add(t('A category with this name already exists'));
        return;
      }
      const updates: Partial<Pick<Category, 'name' | 'color' | 'budget'>> = { name: editName.trim(), color: editColor };
      if (editBudget) {
        updates.budget = parseInt(editBudget.replace(/[^0-9]/g, ''), 10);
      } else {
        updates.budget = undefined;
      }
      await db.categories.update(id, updates);
      handleCancelEdit();
    } catch (err) {
      toast.add(t('Error saving category'));
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const count = await db.transactions.where('categoryId').equals(id).count();
      const catToDelete = categories?.find(c => c.id === id);
      
      if (count > 0) {
        const confirmed = await confirm({ 
          title: t('Delete Category'), 
          message: t('Delete category with transactions reassign confirmation', { count }), 
          variant: 'danger' 
        });
        if (!confirmed) return;

        // Use canonical fallback name "__OTHER__" to avoid i18n-dependent identity
        const FALLBACK_NAME = '__OTHER__';
        const FALLBACK_COLOR = '#64748B';
        
        // Find existing fallback category (by canonical name)
        let otherCategory = categories?.find(c => c.name === FALLBACK_NAME);
        let otherCategoryId: number;
        
        // Store backup for undo
        const originalCategoryId = id;
        const originalCategory = catToDelete ? { ...catToDelete } : null;
        const originalTransactions = await db.transactions.where('categoryId').equals(id).toArray();

        // All operations in one atomic transaction
        await db.transaction('rw', db.categories, db.transactions, async () => {
          if (otherCategory && otherCategory.id != null) {
            otherCategoryId = otherCategory.id;
          } else {
            // Create fallback category inside the same transaction
            const newId = await db.categories.add({
              name: FALLBACK_NAME,
              icon: '🏷️',
              color: FALLBACK_COLOR,
            });
            otherCategoryId = newId as number;
          }

          // Reassign all transactions to fallback category
          await db.transactions.where('categoryId').equals(id).modify({ categoryId: otherCategoryId });
          // Delete the category
          await db.categories.delete(id);
        });

        // Show undo toast
        toast.add(
          t('Category deleted. Transactions moved to {{name}}.', { name: otherCategory?.name ?? FALLBACK_NAME }),
          async () => {
            // Undo: restore category and reassign transactions back
            if (originalCategory && originalCategory.id != null) {
              await db.categories.put(originalCategory);
              await db.transaction('rw', db.transactions, async () => {
                await db.transactions
                  .where('categoryId')
                  .equals(otherCategoryId)
                  .and(tx => originalTransactions.some(otx => otx.id === tx.id))
                  .modify({ categoryId: originalCategoryId });
              });
            }
          }
        );
      } else {
        // No transactions — just delete the category
        await db.categories.delete(id);
      }
    } catch (err) {
      console.error('Error deleting category:', err);
      toast.add(t('Error deleting category'));
    }
  };

  const handleAddCategory = async () => {
    if (!newName.trim()) return;
    try {
      // Prevent duplicate name
      const existing = categories?.find(c => c.name.toLowerCase() === newName.trim().toLowerCase());
      if (existing) {
        toast.add(t('A category with this name already exists'));
        return;
      }
      const budgetVal = newBudget ? parseInt(newBudget.replace(/[^0-9]/g, ''), 10) : undefined;
      await db.categories.add({
        name: newName.trim(),
        icon: '🏷️',
        color: newColor,
        budget: budgetVal,
      });
      setNewName('');
      setNewColor(CURATED_PALETTE[0] as string);
      setNewBudget('');
      setShowAddForm(false);
    } catch (err) {
      toast.add(t('Error adding category'));
    }
  };

  const budgetProgress = (spent: number, budget: number) => {
    return Math.min((spent / budget) * 100, 100);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-full bg-[var(--card)] border border-[var(--border)] hover:bg-[var(--border)] transition-colors md:hidden"
            aria-label={t('Back')}
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-2xl font-bold">{t('Categories & Budgets')}</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowHelp(!showHelp)}
            className="p-2 border border-[var(--border)] bg-[var(--card)] rounded-full"
            aria-label={t('Help')}
          >
            <HelpCircle size={20} />
          </button>
          <button
            onClick={() => setShowAddForm(true)}
            className="p-2 bg-[var(--accent)] text-white rounded-full shadow"
            aria-label={t('Add Category')}
          >
            <Plus size={20} />
          </button>
        </div>
      </div>

      {showHelp && (
        <div className="rounded-[16px] border border-[var(--accent)]/20 bg-[var(--accent)]/5 p-4">
          <h3 className="font-bold text-[var(--accent)] mb-2">{t('How Categories Work')}</h3>
          <ul className="text-sm text-[var(--text-secondary)] space-y-1">
            <li>• {t('Categories organize your expenses')}</li>
            <li>• {t('Set budgets to track spending limits')}</li>
            <li>• {t('Budget progress shows in the bar below')}</li>
            <li>• {t('Deleting a category moves transactions to Other')}</li>
          </ul>
        </div>
      )}

      {/* Add Category Form */}
      <>
        {showAddForm && (
          <div
            className="bg-[var(--card)] rounded-xl border border-[var(--border)] overflow-hidden"
          >
            <div className="p-4 space-y-4">
              <h3 className="font-bold text-sm">{t('New Category')}</h3>
              <input
                ref={newCategoryInputRef}
                id="new-category-name"
                type="text"
                name="categoryName"
                autoComplete="off"
                placeholder={t('Category Name')}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]/20 transition-[border-color,box-shadow]"
              />
              <div>
                <label className="text-xs font-medium text-[var(--text-secondary)] mb-2 block">{t('Color')}</label>
                <div className="flex flex-wrap gap-2">
                  {CURATED_PALETTE.map((color) => (
                    <button
                      key={color}
                      onClick={() => setNewColor(color)}                        className={cn(
                          'w-8 h-8 rounded-full transition-colors border border-[var(--border)]',
                          newColor === color ? 'ring-2 ring-offset-2 ring-offset-[var(--card)] ring-[var(--accent)] scale-110' : 'hover:scale-110'
                      )}
                      style={{ backgroundColor: color }}
                      aria-label={t('Select color {{color}}', { color })}
                      aria-pressed={newColor === color}
                    />
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--text-secondary)] mb-1 block">{t('Monthly Budget')}</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[var(--text-secondary)]">Rp</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={newBudget}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9]/g, '');
                      setNewBudget(val ? parseInt(val, 10).toLocaleString('id-ID') : '');
                    }}
                    placeholder="0"
                    className="w-full pl-10 pr-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-sm font-mono focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]/20 transition-[border-color,box-shadow]"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowAddForm(false)} className="px-4 py-2 text-sm text-[var(--text-secondary)]">
                  {t('Cancel')}
                </button>
                <button onClick={handleAddCategory} className="px-4 py-2 text-sm bg-[var(--accent)] text-white rounded-lg">
                  <Save size={16} className="inline mr-1" />{t('Save')}
                </button>
              </div>
            </div>
          </div>
        )}
      </>

      {/* Category List */}
      <div className="space-y-3">
        {categoriesWithSpending.length === 0 ? (
          <EmptyState
            icon={<Tag size={48} className="opacity-20" />}
            title={t('No Categories')}
            description={t('Add categories to make your transactions easier to analyze.')}
            action={{
              label: t('Add Category'),
              onClick: () => setShowAddForm(true),
            }}
          />
        ) : (
          categoriesWithSpending.map((cat) => {
            const isEditing = editingId === cat.id;
            const hasBudget = !!cat.budget && cat.budget > 0;
            const progress = hasBudget ? budgetProgress(cat.spendingThisMonth, cat.budget!) : 0;
            const isOverBudget = progress >= 100;
            const isNearLimit = progress >= 80 && !isOverBudget;

            return (
              <div
                key={cat.id}
                className="bg-[var(--card)] rounded-[16px] border border-[var(--border)] p-4 space-y-3"
              >
                {isEditing ? (
                  /* Edit Mode */
                  <div className="space-y-3">
                    <input
                      ref={editCategoryInputRef}
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm font-bold focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]/20 transition-[border-color,box-shadow]"
                    />
                    <div className="flex flex-wrap gap-2">
                      {CURATED_PALETTE.map((color) => (
                        <button
                          key={color}
                          onClick={() => setEditColor(color)}
                        className={cn(
                          'w-8 h-8 rounded-full transition-colors border border-[var(--border)]',
                          editColor === color ? 'ring-2 ring-offset-2 ring-offset-[var(--card)] ring-[var(--accent)] scale-110' : 'hover:scale-110'
                          )}
                          style={{ backgroundColor: color }}
                          aria-label={t('Select color {{color}}', { color })}
                          aria-pressed={editColor === color}
                        />
                      ))}
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[var(--text-secondary)]">Rp</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={editBudget}
                        onChange={(e) => {
                          const val = e.target.value.replace(/[^0-9]/g, '');
                          setEditBudget(val ? parseInt(val, 10).toLocaleString('id-ID') : '');
                        }}
                        placeholder={t('Budget placeholder')}
                        className="w-full pl-10 pr-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-sm font-mono focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]/20 transition-[border-color,box-shadow]"
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <button onClick={handleCancelEdit} className="p-2 text-[var(--text-secondary)] hover:text-red-500" aria-label={t('Cancel')}>
                        <X size={18} />
                      </button>
                      <button onClick={() => handleSaveEdit(cat.id)} className="p-2 text-[var(--accent)]" aria-label={t('Save')}>
                        <Check size={18} />
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Display Mode */
                  <>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="w-4 h-4 rounded-full shrink-0"
                          style={{ backgroundColor: cat.color }}
                        />
                        <div className="min-w-0">
                          <h3 className="font-bold text-sm truncate">{cat.name}</h3>
                          <p className="text-[11px] text-[var(--text-secondary)]">
                            {cat.txCount} {t('transactions')}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => handleStartEdit(cat)}
                          className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors rounded-lg hover:bg-[var(--bg)]"
                          aria-label={t('Edit')}
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(cat.id)}
                          className="p-1.5 text-[var(--text-secondary)] hover:text-red-500 transition-colors rounded-lg hover:bg-[var(--bg)]"
                          aria-label={t('Delete')}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Spending & Budget Info */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-[var(--text-secondary)] text-xs">{t('This Month')}</span>
                        <span className={cn(
                          'font-mono font-semibold text-sm',
                          isOverBudget ? 'text-red-500' : isNearLimit ? 'text-yellow-500' : 'text-[var(--text-primary)]'
                        )}>
                          Rp {formatAmountLocal(cat.spendingThisMonth)}
                        </span>
                      </div>

                      {hasBudget && (
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-[var(--text-secondary)]">{t('Budget')}</span>
                            <span className="font-mono text-[var(--text-secondary)]">Rp {formatAmountLocal(cat.budget!)}</span>
                          </div>
                          <div 
                            className="w-full h-2 bg-[var(--bg)] rounded-full overflow-hidden"
                            role="progressbar"
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-valuenow={Math.round(progress)}
                            aria-label={t('Budget progress for {{name}}: {{percent}}%', { name: cat.name, percent: Math.round(progress) })}
                          >
                            <div
                              className={cn(
                                'h-full rounded-full',
                                isOverBudget ? 'bg-red-500' : isNearLimit ? 'bg-yellow-500' : 'bg-[var(--accent)]'
                              )}
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <span className={cn(
                              'text-[10px] font-medium',
                              isOverBudget ? 'text-red-500' : isNearLimit ? 'text-yellow-500' : 'text-[var(--text-secondary)]'
                            )}>
                              {isOverBudget ? t('Over Budget') : isNearLimit ? t('Near Limit') : t('On Track')} · {progress.toFixed(0)}%
                            </span>
                            <span className="text-[10px] font-mono text-[var(--text-secondary)]">
                              Rp {formatAmountLocal(Math.max(cat.budget! - cat.spendingThisMonth, 0))} {t('remaining')}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
