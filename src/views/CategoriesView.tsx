import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Category } from '../db/db';
import { Tag, Plus, Edit2, Trash2, Check, X, Save, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { cn } from '../utils/cn';
import { getMonthStartStr, getNextMonthStartStr, normaliseDate } from '../utils/dateUtils';
import { confirm } from '../components/ConfirmDialog';
import { toast } from '../components/Toaster';
import { CURATED_PALETTE } from '../utils/constants';
import { formatAmountLocal } from '../utils/formatUtils';
import { motion, AnimatePresence } from 'motion/react';

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
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState<string>(CURATED_PALETTE[0] as string);
  const [newBudget, setNewBudget] = useState('');

  const categoriesWithSpending: CategoryWithSpending[] = useMemo(() => {
    if (!categories || !transactions) return [];

    // Use local timezone string helpers to avoid UTC day-shifting bugs
    const monthStart = getMonthStartStr();
    const nextMonthStart = getNextMonthStartStr();

    return categories.map(cat => {
      const catTxs = transactions.filter(
        t => t.categoryId === cat.id && t.type === 'expense'
      );
      const thisMonthTxs = catTxs.filter(t => {
        const txDate = normaliseDate(t.date);
        return txDate >= monthStart && txDate < nextMonthStart;
      });
      const spendingThisMonth = thisMonthTxs.reduce((sum, t) => sum + t.amount, 0);

      return {
        id: cat.id!,
        name: cat.name,
        icon: cat.icon,
        color: cat.color,
        budget: cat.budget,
        spendingThisMonth,
        txCount: catTxs.length,
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

        // Find or create "Other" category to reassign transactions
        let otherCategory = categories?.find(c => c.name.toLowerCase() === 'other');
        let otherCategoryName = 'Other';
        let otherCategoryColor = '#64748B';
        let otherCategoryId: number;
        
        if (otherCategory && otherCategory.id != null) {
          otherCategoryId = otherCategory.id;
          otherCategoryName = otherCategory.name;
          otherCategoryColor = otherCategory.color;
        } else {
          // Create "Other" category if it doesn't exist
          const newId = await db.categories.add({
            name: 'Other',
            icon: '🏷️',
            color: otherCategoryColor,
          });
          otherCategoryId = newId as number;
        }

        // Store backup for undo
        const originalCategoryId = id;
        const originalCategory = catToDelete ? { ...catToDelete } : null;
        const originalTransactions = await db.transactions.where('categoryId').equals(id).toArray();

        // Reassign all transactions to "Other" atomically
        await db.transaction('rw', db.categories, db.transactions, async () => {
          await db.transactions.where('categoryId').equals(id).modify({ categoryId: otherCategoryId });
          await db.categories.delete(id);
        });

        // Show undo toast
        toast.add(
          t('Category deleted. Transactions moved to {{name}}.', { name: otherCategoryName }),
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
    <div className="p-4 space-y-6 pb-24">
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
        <button
          onClick={() => setShowAddForm(true)}
          className="p-2 bg-[var(--accent)] text-white rounded-full shadow"
          aria-label={t('Add Category')}
        >
          <Plus size={20} />
        </button>
      </div>

      {/* Add Category Form */}
      <AnimatePresence>
        {showAddForm && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-[var(--card)] rounded-xl border border-[var(--border)] overflow-hidden"
          >
            <div className="p-4 space-y-4">
              <h3 className="font-bold text-sm">{t('New Category')}</h3>
              <input
                type="text"
                placeholder={t('Category Name')}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)]"
                autoFocus
              />
              <div>
                <label className="text-xs font-medium text-[var(--text-secondary)] mb-2 block">{t('Color')}</label>
                <div className="flex flex-wrap gap-2">
                  {CURATED_PALETTE.map((color) => (
                    <button
                      key={color}
                      onClick={() => setNewColor(color)}
                      className={cn(
                        'w-7 h-7 rounded-full transition-all',
                        newColor === color ? 'ring-2 ring-offset-2 ring-offset-[var(--card)] ring-[var(--accent)] scale-110' : 'hover:scale-110'
                      )}
                      style={{ backgroundColor: color }}
                      aria-label={color}
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
                    className="w-full pl-10 pr-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-sm font-mono focus:outline-none focus:border-[var(--accent)]"
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
          </motion.div>
        )}
      </AnimatePresence>

      {/* Category List */}
      <div className="space-y-3">
        {categoriesWithSpending.length === 0 ? (
          <div className="text-center py-16 flex flex-col items-center">
            <div className="bg-[var(--card)] w-24 h-24 rounded-full flex items-center justify-center mb-4 border border-[var(--border)] text-[var(--accent)] shadow-inner">
              <Tag size={48} className="opacity-20" />
            </div>
            <h3 className="font-bold text-[var(--text-primary)]">{t('No Categories')}</h3>
            <p className="text-sm text-[var(--text-secondary)] mt-1 max-w-[200px]">
              {t('Categories will appear here as you add transactions.')}
            </p>
          </div>
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
                className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-4 space-y-3"
              >
                {isEditing ? (
                  /* Edit Mode */
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm font-bold focus:outline-none focus:border-[var(--accent)]"
                      autoFocus
                    />
                    <div className="flex flex-wrap gap-2">
                      {CURATED_PALETTE.map((color) => (
                        <button
                          key={color}
                          onClick={() => setEditColor(color)}
                          className={cn(
                            'w-6 h-6 rounded-full transition-all',
                            editColor === color ? 'ring-2 ring-offset-2 ring-offset-[var(--card)] ring-[var(--accent)] scale-110' : 'hover:scale-110'
                          )}
                          style={{ backgroundColor: color }}
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
                        className="w-full pl-10 pr-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-sm font-mono focus:outline-none focus:border-[var(--accent)]"
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <button onClick={handleCancelEdit} className="p-2 text-[var(--text-secondary)] hover:text-red-500">
                        <X size={18} />
                      </button>
                      <button onClick={() => handleSaveEdit(cat.id)} className="p-2 text-[var(--accent)]">
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
                          <div className="w-full h-2 bg-[var(--bg)] rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${progress}%` }}
                              transition={{ duration: 0.8, ease: 'easeOut' }}
                              className={cn(
                                'h-full rounded-full',
                                isOverBudget ? 'bg-red-500' : isNearLimit ? 'bg-yellow-500' : 'bg-[var(--accent)]'
                              )}
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <span className={cn(
                              'text-[10px] font-medium',
                              isOverBudget ? 'text-red-500' : isNearLimit ? 'text-yellow-500' : 'text-[var(--text-secondary)]'
                            )}>
                              {progress.toFixed(0)}%
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
