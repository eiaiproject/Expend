import { useState, useMemo, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate, Link } from 'react-router-dom';
import { db, type Category } from '../db/db';
import {
  Tag, Plus, ArrowLeft, HelpCircle, Search, X as XIcon, SortV,
  ChevronDown, ChevronUp
} from 'reicon-react';
import { usePrivacy } from '../contexts/PrivacyContext';
import { cn } from '../utils/cn';
import { FALLBACK_CATEGORY_NAME, BUDGET_NEAR_LIMIT_THRESHOLD } from '../utils/constants';
import { getMonthStartStr, getNextMonthStartStr, normaliseDate } from '../utils/dateUtils';
import { formatCurrencyValue } from '../utils/formatUtils';
import { confirm } from '../components/ConfirmDialog';
import { toast } from '../components/Toaster';
import { EmptyState } from '../components/EmptyState';
import { CategoryOverflowMenu } from '../components/categories/CategoryOverflowMenu';
import { HelpDialog } from '../components/categories/HelpDialog';
import { CategoryForm } from '../components/categories/CategoryForm';

// ponytail: inline former getCategoryDisplayName helper
const catDisplayName = (name: string | null | undefined, t: (k: string) => string): string => {
  if (!name) return '';
  return name === FALLBACK_CATEGORY_NAME ? t('Other') : name;
};

type SortMode = 'manual' | 'name' | 'spending' | 'budget';

interface CategoryWithStats {
  id: number;
  name: string;
  icon: string;
  color: string;
  budget?: number;
  spendingThisMonth: number;
  txCount: number;
  totalSpending: number;
  archivedAt?: string | null;
}

// ── Budget threshold helper ──────────────────────────────────
function budgetStatus(spent: number, budget: number) {
  if (spent >= budget) return 'over';
  if (spent / budget >= BUDGET_NEAR_LIMIT_THRESHOLD) return 'near';
  return 'normal';
}

export default function CategoriesView() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { hideAmount } = usePrivacy();

  const categories = useLiveQuery(() => db.categories.toArray(), [], []);
  const transactions = useLiveQuery(() => db.transactions.toArray(), [], []);

  // UI state
  const [showAddForm, setShowAddForm] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('manual');
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  const searchRef = useRef<HTMLInputElement>(null);
  const addCategoryInputRef = useRef<HTMLInputElement>(null);

  // Focus add form input
  useEffect(() => {
    if (showAddForm) addCategoryInputRef.current?.focus();
  }, [showAddForm]);

  // ── Aggregate stats (single pass) ──────────────────────────
  const categoriesWithStats: CategoryWithStats[] = useMemo(() => {
    if (!categories || !transactions) return [];

    const monthStart = getMonthStartStr();
    const nextMonthStart = getNextMonthStartStr();

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
        totalSpending: stats?.totalSpending ?? 0,
        archivedAt: cat.archivedAt,
      };
    });
  }, [categories, transactions]);

  // ── Split active / archived ────────────────────────────────
  const activeCategories = useMemo(() => {
    const filtered = categoriesWithStats.filter(c => !c.archivedAt);

    let sorted = [...filtered];
    switch (sortMode) {
      case 'name':
        sorted.sort((a, b) => a.name.localeCompare(b.name, i18n.language));
        break;
      case 'spending':
        sorted.sort((a, b) => b.spendingThisMonth - a.spendingThisMonth);
        break;
      case 'budget':
        sorted.sort((a, b) => (b.budget ?? 0) - (a.budget ?? 0));
        break;
      default: // manual — keep default order
        break;
    }

    if (searchTerm.trim()) {
      const lower = searchTerm.toLowerCase();
      sorted = sorted.filter(c => c.name.toLowerCase().includes(lower));
    }

    return sorted;
  }, [categoriesWithStats, sortMode, searchTerm, i18n.language]);

  const archivedCategories = useMemo(
    () => categoriesWithStats.filter(c => c.archivedAt).sort((a, b) => a.name.localeCompare(b.name, i18n.language)),
    [categoriesWithStats, i18n.language]
  );

  // ── Summary counts ─────────────────────────────────────────
  const summaryStats = useMemo(() => {
    const active = categoriesWithStats.filter(c => !c.archivedAt);
    const withBudget = active.filter(c => c.budget && c.budget > 0);
    const nearLimit = withBudget.filter(c => budgetStatus(c.spendingThisMonth, c.budget!) === 'near' || budgetStatus(c.spendingThisMonth, c.budget!) === 'over');
    return {
      activeCount: active.length,
      withBudgetCount: withBudget.length,
      nearLimitCount: nearLimit.length,
    };
  }, [categoriesWithStats]);

  const hasAnyCategory = categoriesWithStats.length > 0;

  // ── Category actions ───────────────────────────────────────
  const hasTransactions = (catId: number) => {
    if (!transactions) return false;
    return transactions.some(tx => tx.categoryId === catId);
  };

  const handleAddCategory = async (data: { name: string; color: string; budget?: number }) => {
    try {
      await db.categories.add({
        name: data.name,
        icon: '🏷️',
        color: data.color,
        budget: data.budget,
      });
      toast.add(t('Category added.'));
      setShowAddForm(false);
    } catch {
      toast.add(t('Error adding category'));
    }
  };

  const handleEditCategory = async (data: { name: string; color: string; budget?: number }) => {
    if (!editingCategory) return;
    try {
      await db.categories.update(editingCategory.id!, {
        name: data.name,
        color: data.color,
        budget: data.budget,
      });
      toast.add(t('Category changes saved.'));
      setEditingCategory(null);
    } catch {
      toast.add(t('Error saving category'));
    }
  };

  const handleArchive = async (cat: CategoryWithStats) => {
    const confirmed = await confirm({
      title: t('categories.archiveTitle', { name: catDisplayName(cat.name, t) }),
      message: t('categories.archiveDesc'),
      confirmLabel: t('categories.archiveCategory'),
      cancelLabel: t('Cancel'),
    });
    if (!confirmed) return;

    try {
      await db.categories.update(cat.id, { archivedAt: new Date().toISOString() });
      toast.add(t('categories.archived'));
    } catch {
      toast.add(t('Error saving category'));
    }
  };

  const handleRestore = async (cat: CategoryWithStats) => {
    // Check for name conflict with active categories
    const conflict = categories?.some(c =>
      c.id !== cat.id && !c.archivedAt && c.name.toLowerCase() === cat.name.toLowerCase()
    );
    if (conflict) {
      toast.add(t('A category with this name already exists'));
      return;
    }

    try {
      await db.categories.update(cat.id, { archivedAt: null });
      toast.add(t('categories.restored'));
    } catch {
      toast.add(t('Error saving category'));
    }
  };

  const handleDelete = async (cat: CategoryWithStats) => {
    if (hasTransactions(cat.id)) {
      toast.add(t('categories.cannotDeleteHasHistory'));
      return;
    }

    const confirmed = await confirm({
      title: t('categories.deleteTitle', { name: catDisplayName(cat.name, t) }),
      message: t('categories.deleteDesc'),
      confirmLabel: t('categories.deletePermanently'),
      cancelLabel: t('Cancel'),
      variant: 'danger',
    });
    if (!confirmed) return;

    try {
      await db.categories.delete(cat.id);
      toast.add(t('categories.deleted'));
    } catch {
      toast.add(t('Error deleting category'));
    }
  };

  const handleRemoveBudget = async (cat: CategoryWithStats) => {
    try {
      await db.categories.update(cat.id, { budget: undefined });
      toast.add(t('Budget removed.'));
    } catch {
      toast.add(t('Error saving category'));
    }
  };

  const getCategoryMenuItems = (cat: CategoryWithStats) => {
    const isArchived = !!cat.archivedAt;
    const items: { label: string; onClick: () => void; danger?: boolean }[] = [];

    if (!isArchived) {
      // View transactions — navigate to home with category filter
      items.push({
        label: t('categories.viewTransactions'),
        onClick: () => navigate(`/?categoryId=${cat.id}`),
      });
    }

    items.push({
      label: t('categories.editCategory'),
      onClick: () => setEditingCategory(categories?.find(c => c.id === cat.id) ?? null),
    });

    if (!isArchived) {
      const findCategory = () => categories?.find(c => c.id === cat.id) ?? null;
      if (cat.budget && cat.budget > 0) {
        items.push(
          {
            label: t('categories.changeBudget'),
            onClick: () => setEditingCategory(findCategory()),
          },
          {
            label: t('categories.removeBudget'),
            onClick: () => handleRemoveBudget(cat),
          },
        );
      } else {
        items.push({
          label: t('categories.setBudget'),
          onClick: () => setEditingCategory(categories?.find(c => c.id === cat.id) ?? null),
        });
      }
    }

    if (isArchived) {
      items.push({
        label: t('categories.restoreCategory'),
        onClick: () => handleRestore(cat),
      });
    } else {
      items.push({
        label: t('categories.archiveCategory'),
        onClick: () => handleArchive(cat),
      });
    }

    // Hard delete only if no transactions
    if (!hasTransactions(cat.id)) {
      items.push({
        label: t('categories.deletePermanently'),
        onClick: () => handleDelete(cat),
        danger: true,
      });
    }

    return items;
  };

  // ── Budget progress display ────────────────────────────────
  const renderBudgetProgress = (cat: CategoryWithStats) => {
    if (!cat.budget || cat.budget <= 0) return null;

    const barColorByStatus: Record<string, string> = {
      over: 'bg-red-500',
      near: 'bg-yellow-500',
      ok: 'bg-[var(--accent)]',
    };
    const textColorByStatus: Record<string, string> = {
      over: 'text-red-500',
      near: 'text-yellow-500',
      ok: 'text-[var(--text-secondary)]',
    };

    const spent = cat.spendingThisMonth;
    const pct = Math.min((spent / cat.budget) * 100, 100);
    const status = budgetStatus(spent, cat.budget);
    const remaining = Math.max(cat.budget - spent, 0);
    const exceeded = Math.max(spent - cat.budget, 0);

    const budgetAriaText = (() => {
      if (hideAmount) return t('categories.amountHidden');
      if (status === 'over') return t('categories.overBudgetBy', { amount: formatCurrencyValue(exceeded) });
      return t('categories.remaining', { amount: formatCurrencyValue(remaining) });
    })();

    return (
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-[var(--text-secondary)]">{t('Budget')}</span>
          <span className="font-mono text-[var(--text-secondary)]">
            {hideAmount ? '•••••' : `Rp ${formatCurrencyValue(cat.budget)}`}
          </span>
        </div>
        <progress
          className={cn(
            'w-full h-2 bg-[var(--bg)] rounded-full overflow-hidden appearance-none',
            '[&::-webkit-progress-bar]:bg-[var(--bg)] [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:transition-all',
            '[&::-moz-progress-bar]:rounded-full',
          )}
          style={{ color: barColorByStatus[status] ?? 'var(--accent)' }}
          aria-valuemin={0}
          aria-valuemax={cat.budget}
          aria-valuenow={hideAmount ? undefined : spent}
          aria-label={t('categories.budgetProgress', { name: catDisplayName(cat.name, t) })}
          aria-valuetext={budgetAriaText}
          value={pct}
          max={100}
        />
        <div className="flex items-center justify-between">
          <span className={cn(
            'text-[10px] font-medium',
            textColorByStatus[status] ?? textColorByStatus.ok
          )}>
            {(() => {
              if (hideAmount) {
                if (status === 'over') return t('Over Budget');
                if (status === 'near') return t('categories.budgetNearlyUsed');
                return t('categories.onTrack');
              }
              if (status === 'over') return `${t('Over Budget')} · ${Math.round((spent / cat.budget) * 100)}%`;
              if (status === 'near') return `${t('categories.budgetNearlyUsed')} · ${Math.round(pct)}%`;
              return `${t('categories.onTrack')} · ${Math.round(pct)}%`;
            })()}
          </span>
          <span className="text-[10px] font-mono text-[var(--text-secondary)]">
            {(() => {
              if (hideAmount) return t('categories.amountHidden');
              if (status === 'over') return t('categories.overBudgetBy', { amount: formatCurrencyValue(exceeded) });
              return t('categories.remaining', { amount: formatCurrencyValue(remaining) });
            })()}
          </span>
        </div>
      </div>
    );
  };

  // ── Category card ──────────────────────────────────────────
  const renderCategoryCard = (cat: CategoryWithStats) => {
    const isArchived = !!cat.archivedAt;
    const hasBudget = !!cat.budget && cat.budget > 0;
    const menuItems = getCategoryMenuItems(cat);

    return (
      <article
        key={cat.id}
        className={cn(
          'bg-[var(--card)] rounded-2xl border border-[var(--border)] p-4 space-y-3',
          isArchived && 'opacity-70'
        )}
      >
        <div className="flex items-center justify-between">
          <Link
            to={isArchived ? '#' : `/?categoryId=${cat.id}`}
            className="flex items-center gap-3 min-w-0 flex-1 min-h-[44px] rounded-lg -ml-2 pl-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
            tabIndex={isArchived ? -1 : 0}
            aria-label={catDisplayName(cat.name, t)}
          >
            <div
              className="w-4 h-4 rounded-full shrink-0"
              style={{ backgroundColor: cat.color }}
              aria-hidden="true"
            />
            <div className="min-w-0">
              <h3 className="font-bold text-sm truncate">{catDisplayName(cat.name, t)}</h3>
              <p className="text-[11px] text-[var(--text-secondary)]">
                {cat.txCount === 1
                  ? t('1 transaction')
                  : t('{{count}} transactions', { count: cat.txCount })
                }
                {isArchived && (
                  <span className="ml-1 text-[var(--text-secondary)] italic">
                    · {t('Archived')}
                  </span>
                )}
              </p>
            </div>
          </Link>

          <CategoryOverflowMenu
            categoryName={catDisplayName(cat.name, t)}
            items={menuItems}
            disabled={isArchived}
          />
        </div>

        {/* Spending & Budget */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-[var(--text-secondary)] text-xs">{t('categories.spendingThisMonth')}</span>
            <span className="font-mono font-semibold text-sm text-[var(--text-primary)]">
              {hideAmount ? '•••••' : `Rp ${formatCurrencyValue(cat.spendingThisMonth)}`}
            </span>
          </div>
          {hasBudget && renderBudgetProgress(cat)}
        </div>
      </article>
    );
  };

  // ── Empty-state picker — split nested ternary into named branches ──
  const renderActiveEmptyState = () => {
    if (activeCategories.length > 0) return null;
    if (!hasAnyCategory && !showAddForm) {
      return (
        <EmptyState
          icon={<Tag size={48} className="opacity-20" />}
          title={t('categories.emptyTitle')}
          description={t('categories.emptyDesc')}
          action={{
            label: t('categories.addLabel'),
            onClick: () => setShowAddForm(true),
          }}
        />
      );
    }
    if (!searchTerm && archivedCategories.length > 0) {
      return (
        <div className="text-center py-12 space-y-4">
          <div className="bg-[var(--card)] w-20 h-20 rounded-full flex items-center justify-center mx-auto border border-[var(--border)]">
            <Tag size={32} className="text-[var(--text-secondary)] opacity-30" aria-hidden="true" />
          </div>
          <h3 className="font-bold text-[var(--text-primary)]">{t('categories.allArchivedTitle')}</h3>
          <p className="text-sm text-[var(--text-secondary)] max-w-[280px] mx-auto">{t('categories.allArchivedDesc')}</p>
          <div className="flex justify-center gap-2">
            <button
              type="button"
              onClick={() => setShowArchived(true)}
              className="flex h-11 items-center justify-center gap-2 px-4 text-sm border border-[var(--border)] rounded-xl hover:bg-[var(--bg)] transition-colors"
            >
              {t('categories.showArchived')}
            </button>
            <button
              type="button"
              onClick={() => setShowAddForm(true)}
              className="flex h-11 items-center justify-center gap-2 px-4 text-sm bg-[var(--accent)] text-white rounded-xl font-medium hover:opacity-90 transition-colors"
            >
              <Plus size={16} aria-hidden="true" />
              {t('categories.addLabel')}
            </button>
          </div>
        </div>
      );
    }
    if (searchTerm) {
      return (
        <div className="text-center py-12 space-y-3">
          <Tag size={32} className="mx-auto text-[var(--text-secondary)] opacity-30" aria-hidden="true" />
          <p className="text-sm text-[var(--text-secondary)]">{t('categories.searchEmptyTitle')}</p>
          <button
            type="button"
            onClick={() => { setSearchTerm(''); searchRef.current?.focus(); }}
            className="text-sm text-[var(--accent)] font-medium hover:underline"
          >
            {t('categories.searchEmptyAction')}
          </button>
        </div>
      );
    }
    return null;
  };

  // ── Period display ─────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link
            to="/settings"
            className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--card)] border border-[var(--border)] hover:bg-[var(--border)] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
            aria-label={t('categories.backToSettings')}
          >
            <ArrowLeft size={20} aria-hidden="true" />
          </Link>
          <h1 className="text-xl font-bold">{t('Categories & Budgets')}</h1>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setShowHelp(true)}
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--bg)] transition-colors"
            aria-label={t('categories.helpLabel')}
          >
            <HelpCircle size={20} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => setShowAddForm(true)}
            className="flex h-11 items-center justify-center gap-2 px-3 bg-[var(--accent)] text-white rounded-xl shadow font-medium hover:opacity-90 transition-colors"
            aria-label={t('categories.addLabel')}
          >
            <Plus size={18} aria-hidden="true" />
            <span className="hidden sm:inline text-sm">{t('categories.addLabel')}</span>
          </button>
        </div>
      </div>

      {/* Summary */}
      {summaryStats.activeCount > 0 && (
        <div className="flex flex-wrap gap-3 text-xs text-[var(--text-secondary)]">
          <span>{t('categories.activeCount', { count: summaryStats.activeCount })}</span>
          {summaryStats.withBudgetCount > 0 && (
            <span>· {t('categories.withBudgetCount', { count: summaryStats.withBudgetCount })}</span>
          )}
          {summaryStats.nearLimitCount > 0 && (
            <span className="text-amber-600 dark:text-amber-400">
              · {t('categories.nearLimitCount', { count: summaryStats.nearLimitCount })}
            </span>
          )}
        </div>
      )}

      {/* Add Form */}
      {showAddForm && (
        <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] p-4">
          <h3 className="font-bold text-sm mb-3">{t('New Category')}</h3>
          <CategoryForm
            mode="add"
            onSubmit={handleAddCategory}
            onCancel={() => setShowAddForm(false)}
            existingNames={categories?.map(c => c.name) ?? []}
          />
        </div>
      )}

      {/* Edit Form */}
      {editingCategory && (
        <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] p-4">
          <h3 className="font-bold text-sm mb-3">{t('categories.editTitle')}</h3>
          <CategoryForm
            mode="edit"
            initialCategory={editingCategory}
            onSubmit={handleEditCategory}
            onCancel={() => setEditingCategory(null)}
            existingNames={categories?.map(c => c.name) ?? []}
          />
        </div>
      )}

      {/* Search & Sort */}
      {hasAnyCategory && (
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" aria-hidden="true" />
            <input
              ref={searchRef}
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t('categories.searchPlaceholder')}
              className="w-full h-11 bg-[var(--card)] border border-[var(--border)] rounded-xl pl-9 pr-9 text-sm focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]/20 transition-[border-color,box-shadow]"
              aria-label={t('categories.searchPlaceholder')}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => { setSearchTerm(''); searchRef.current?.focus(); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-md hover:bg-[var(--bg)] transition-colors"
                aria-label={t('categories.searchEmptyAction')}
              >
                <XIcon size={14} aria-hidden="true" />
              </button>
            )}
          </div>
          <div className="relative">
            <select
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as SortMode)}
              className="h-11 bg-[var(--card)] border border-[var(--border)] rounded-xl pl-3 pr-8 text-sm appearance-none focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]/20 transition-[border-color,box-shadow]"
              aria-label={t('categories.sortLabel')}
            >
              <option value="manual">{t('Default')}</option>
              <option value="name">{t('categories.sortByName')}</option>
              <option value="spending">{t('categories.sortBySpending')}</option>
              <option value="budget">{t('categories.sortByBudget')}</option>
            </select>
            <SortV size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--text-secondary)]" aria-hidden="true" />
          </div>
        </div>
      )}

      {/* Active Categories */}
      {(() => {
        const emptyState = renderActiveEmptyState();
        if (emptyState) return emptyState;
        return (
          <div className="space-y-3">
            <h2 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider px-1">
              {t('Active Categories')}
            </h2>
            {activeCategories.map(renderCategoryCard)}
          </div>
        );
      })()}

      {/* Archived Categories */}
      {archivedCategories.length > 0 && hasAnyCategory && (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setShowArchived(!showArchived)}
            className="flex items-center gap-2 text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider px-1 hover:text-[var(--text-primary)] transition-colors min-h-[44px]"
            aria-expanded={showArchived}
          >
            {showArchived ? <ChevronUp size={14} aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" />}
            {t('Archived Categories')} ({archivedCategories.length})
          </button>
          {showArchived && archivedCategories.map(renderCategoryCard)}
        </div>
      )}

      {/* Help Dialog */}
      <HelpDialog isOpen={showHelp} onClose={() => setShowHelp(false)} />
    </div>
  );
}
