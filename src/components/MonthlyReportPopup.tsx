import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'motion/react';
import { X, Download, Loader2, AlertTriangle, CheckCircle, Lightbulb, HelpCircle, Check } from 'lucide-react';
import { 
  MonthlyReportData, 
  generateMonthlyReport, 
  dismissMonthlyReport, 
  markReportDownloaded,
  getPreviousMonthName 
} from '../services/monthlyReportService';
import { formatCurrency } from '../utils/formatUtils';
import { useTheme } from '../contexts/ThemeContext';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { Skeleton } from './Skeleton';

interface MonthlyReportPopupProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MonthlyReportPopup({ isOpen, onClose }: MonthlyReportPopupProps) {
  const { t, i18n } = useTranslation();
  const { theme } = useTheme();
  const dialogRef = useFocusTrap(isOpen);
  const [reportData, setReportData] = useState<MonthlyReportData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDownloaded, setIsDownloaded] = useState(false);
  const [showHealthInfo, setShowHealthInfo] = useState(false);
  const [showUndoToast, setShowUndoToast] = useState(false);
  const dismissTimerRef = useRef<NodeJS.Timeout | null>(null);

  const loadReportData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const locale = i18n.language || 'id';
      const data = await generateMonthlyReport(locale);
      setReportData(data);
    } catch {
      setError(t('Error loading report'));
    } finally {
      setIsLoading(false);
    }
  }, [i18n.language, t]);

  useEffect(() => {
    if (isOpen) {
      loadReportData();
    }
  }, [isOpen, loadReportData]);

  const handleDownload = useCallback(async () => {
    if (!reportData) return;
    
    setIsGeneratingPDF(true);
    try {
      const { generateSimplePDF } = await import('../utils/pdfGenerator');
      const locale = i18n.language || 'id';
      await generateSimplePDF(reportData, locale, theme);
      markReportDownloaded();
      setIsDownloaded(true);
      setTimeout(() => onClose(), 1200);
    } catch {
      setError(t('Error generating PDF'));
    } finally {
      setIsGeneratingPDF(false);
    }
  }, [reportData, i18n.language, theme, t, onClose]);

  const handleDismiss = useCallback(() => {
    dismissMonthlyReport();
    setShowUndoToast(true);
    dismissTimerRef.current = setTimeout(() => {
      setShowUndoToast(false);
      onClose();
    }, 4000);
  }, [onClose]);

  const handleUndoDismiss = useCallback(() => {
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
    setShowUndoToast(false);
  }, []);



  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Enter' && !isGeneratingPDF && !isDownloaded && reportData && !(e.target instanceof HTMLButtonElement)) {
        handleDownload();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, isGeneratingPDF, isDownloaded, reportData, handleDownload]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            ref={dialogRef}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2, ease: [0.25, 1, 0.5, 1] }}
            className="relative w-full max-w-lg max-h-[90vh] overflow-hidden bg-[var(--card)] rounded-xl shadow-lg border border-[var(--border)]"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={t('Monthly Report')}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
              <div>
                <h2 className="text-lg font-bold">{t('Monthly Report')}</h2>
                <p className="text-sm text-[var(--text-secondary)]">
                  {getPreviousMonthName(i18n.language)} {new Date().getFullYear() - (new Date().getMonth() === 0 ? 1 : 0)}
                </p>
              </div>
              <button
                onClick={() => { dismissMonthlyReport(); onClose(); }}
                className="p-3 rounded-lg hover:bg-[var(--hover)] transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                aria-label={t('Dismiss')}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="overflow-y-auto max-h-[calc(90vh-140px)] p-5" aria-live="polite">
              {isLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-24 w-full rounded-xl" />
                  <Skeleton className="h-32 w-full rounded-xl" />
                  <Skeleton className="h-48 w-full rounded-xl" />
                </div>
              ) : error ? (
                <div className="text-center py-8">
                  <p className="text-[var(--color-error, #EF4444)] mb-4">{error}</p>
                  <button
                    onClick={loadReportData}
                    className="px-4 py-2 bg-[var(--accent)] text-white rounded-lg hover:opacity-90 transition-opacity focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                  >
                    {t('Try Again')}
                  </button>
                </div>
              ) : !reportData ? (
                <div className="text-center py-8">
                  <p className="font-medium text-[var(--text-primary)]">{t('No expenses recorded')}</p>
                  <p className="text-sm text-[var(--text-secondary)] mt-1">{t('Start tracking to see your monthly report')}</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Health Score */}
                  <div className="flex items-center gap-4 p-4 bg-[var(--surface)] rounded-lg border border-[var(--border)]">
                    <div 
                      className="relative w-16 h-16 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: reportData.healthColor + '15' }}
                    >
                      <svg className="absolute inset-0 w-full h-full -rotate-90">
                        <circle
                          cx="32"
                          cy="32"
                          r="28"
                          fill="none"
                          stroke={reportData.healthColor + '20'}
                          strokeWidth="5"
                        />
                        <motion.circle
                          cx="32"
                          cy="32"
                          r="28"
                          fill="none"
                          stroke={reportData.healthColor}
                          strokeWidth="5"
                          strokeLinecap="round"
                          strokeDasharray="176"
                          initial={{ strokeDashoffset: 176 }}
                          animate={{ strokeDashoffset: 176 - (reportData.healthScore / 100) * 176 }}
                          transition={{ duration: 0.8, ease: [0.25, 1, 0.5, 1], delay: 0.2 }}
                        />
                      </svg>
                      <span className="text-xl font-bold tabular-nums" style={{ color: reportData.healthColor }}>
                        {reportData.healthScore}
                      </span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs text-[var(--text-secondary)]">{t('Health')}</p>
                        <button
                          onClick={() => setShowHealthInfo(!showHealthInfo)}
                          className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                          aria-label={t('Health score info')}
                        >
                          <HelpCircle className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <p className="font-medium text-sm" style={{ color: reportData.healthColor }}>
                        {reportData.healthLabel}
                      </p>
                      {showHealthInfo && (
                        <p className="text-xs text-[var(--text-secondary)] mt-1 leading-relaxed">
                          {t('Health score based on category diversification and spending consistency')}. {t('Score improves with more categories, balanced spending, and consistent tracking.')}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Total */}
                  <div className="text-center py-2">
                    <p className="text-xs text-[var(--text-secondary)] mb-0.5">{t('Total Expenses')}</p>
                    <p className="text-xl font-semibold tabular-nums text-[var(--text-primary)]">
                      {formatCurrency(reportData.totalExpense)}
                    </p>
                  </div>

                  {/* Categories */}
                  <div>
                    <h3 className="font-medium text-xs text-[var(--text-secondary)] uppercase tracking-wide mb-2">
                      {t('Top Categories')}
                    </h3>
                    <div className="space-y-2.5">
                      {reportData.categoryBreakdown.slice(0, 5).map((cat, index) => (
                        <div key={cat.categoryId} className="flex items-center gap-3">
                          <div 
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold"
                            style={{ backgroundColor: cat.categoryColor }}
                          >
                            {index + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm truncate">{cat.categoryName}</span>
                              <span className="text-sm font-semibold tabular-nums">{formatCurrency(cat.total)}</span>
                            </div>
                            <div className="w-full bg-[var(--border)] rounded-full h-1.5">
                              <div 
                                className="h-1.5 rounded-full"
                                style={{ 
                                  width: `${cat.percentage}%`,
                                  backgroundColor: cat.categoryColor 
                                }}
                              />
                            </div>
                          </div>
                          <span className="text-xs text-[var(--text-secondary)] w-12 text-right tabular-nums">
                            {cat.percentage.toFixed(1)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Insights */}
                  {reportData.insights.length > 0 && (
                    <div>
                      <h3 className="font-medium text-xs text-[var(--text-secondary)] uppercase tracking-wide mb-2">
                        {t('Insights')}
                      </h3>
                      <div className="space-y-2">
                        {reportData.insights.map((insight, index) => (
                          <div 
                            key={index}
                            className="flex items-start gap-2 py-2"
                          >
                            <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center mt-0.5">
                              {insight.type === 'warning' ? <AlertTriangle className="w-4 h-4 text-[var(--color-warning, #F59E0B)]" /> :
                               insight.type === 'success' ? <CheckCircle className="w-4 h-4 text-[var(--color-success, #10B981)]" /> :
                               <Lightbulb className="w-4 h-4 text-[var(--color-info, #3B82F6)]" />}
                            </span>
                            <div className="min-w-0">
                              <p className="text-sm">{insight.title}</p>
                              <p className="text-xs text-[var(--text-secondary)] break-words">{insight.description}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Stats */}
                  <div className="pt-3 mt-1 border-t border-[var(--border)] space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-[var(--text-secondary)]">{t('Daily Average')}</span>
                      <span className="tabular-nums">{formatCurrency(reportData.avgDailyExpense)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-[var(--text-secondary)]">{t('Transactions')}</span>
                      <span className="tabular-nums">{reportData.transactionCount}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            {!isLoading && reportData && (
              <div className="p-4 border-t border-[var(--border)]">
                <button
                  onClick={handleDownload}
                  disabled={isGeneratingPDF || isDownloaded}
                  className="w-full py-3 bg-[var(--accent)] text-white font-medium rounded-lg flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                >
                  {isDownloaded ? (
                    <>
                      <Check className="w-5 h-5" />
                      {t('Downloaded')}
                    </>
                  ) : isGeneratingPDF ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      {t('Generating PDF...')}
                    </>
                  ) : (
                    <>
                      <Download className="w-5 h-5" />
                      {t('Download PDF Report')}
                    </>
                  )}
                </button>
              </div>
            )}
          </motion.div>

          {/* Undo Toast — outside dialog to prevent overlap */}
          {showUndoToast && (
            <div className="absolute bottom-4 left-4 right-4 max-w-lg mx-auto flex items-center justify-between p-3 bg-[var(--text-primary)] text-[var(--card)] rounded-lg shadow-lg z-50">
              <span className="text-sm">{t('Report dismissed')}</span>
              <button
                onClick={handleUndoDismiss}
                className="text-sm font-semibold underline hover:opacity-80 transition-opacity"
              >
                {t('Undo')}
              </button>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
