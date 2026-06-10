import { useState, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'motion/react';
import { X, Download, TrendingUp, TrendingDown, Minus, ChevronRight, FileText, Loader2 } from 'lucide-react';
import { 
  MonthlyReportData, 
  generateMonthlyReport, 
  dismissMonthlyReport, 
  markReportDownloaded,
  getPreviousMonthName 
} from '../services/monthlyReportService';
import { generateSimplePDF } from '../utils/pdfGenerator';
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
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      loadReportData();
    }
  }, [isOpen]);

  const loadReportData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const locale = i18n.language || 'id';
      const data = await generateMonthlyReport(locale);
      setReportData(data);
    } catch (err) {
      console.error('Error loading report:', err);
      setError(t('Error loading report'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!reportData) return;
    
    setIsGeneratingPDF(true);
    try {
      const locale = i18n.language || 'id';
      await generateSimplePDF(reportData, locale, theme);
      markReportDownloaded();
      onClose();
    } catch (err) {
      console.error('Error generating PDF:', err);
      setError(t('Error generating PDF'));
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const handleDismiss = () => {
    dismissMonthlyReport();
    onClose();
  };

  const formatCurrency = (amount: number) => {
    return `Rp ${amount.toLocaleString('id-ID')}`;
  };

  const getTrendIcon = (change: number) => {
    if (change > 0) return <TrendingUp className="w-4 h-4 text-red-500" />;
    if (change < 0) return <TrendingDown className="w-4 h-4 text-green-500" />;
    return <Minus className="w-4 h-4 text-gray-500" />;
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={handleDismiss}
        >
          <motion.div
            ref={dialogRef}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative w-full max-w-lg max-h-[90vh] overflow-hidden bg-[var(--card)] rounded-2xl shadow-2xl border border-[var(--border)]"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={t('Monthly Report')}
          >
            {/* Header */}
            <div className="relative bg-gradient-to-r from-blue-500 to-purple-600 p-6 text-white">
              <button
                onClick={handleDismiss}
                className="absolute top-4 right-4 p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
                aria-label={t('Close')}
              >
                <X className="w-5 h-5" />
              </button>
              
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-white/20 rounded-xl">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">{t('Monthly Report')}</h2>
                  <p className="text-white/80 text-sm">
                    {getPreviousMonthName(i18n.language)} {new Date().getFullYear() - (new Date().getMonth() === 0 ? 1 : 0)}
                  </p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="overflow-y-auto max-h-[calc(90vh-200px)] p-6">
              {isLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-24 w-full rounded-xl" />
                  <Skeleton className="h-32 w-full rounded-xl" />
                  <Skeleton className="h-48 w-full rounded-xl" />
                </div>
              ) : error ? (
                <div className="text-center py-8">
                  <p className="text-red-500 mb-4">{error}</p>
                  <button
                    onClick={loadReportData}
                    className="px-4 py-2 bg-[var(--accent)] text-white rounded-lg hover:opacity-90 transition-opacity"
                  >
                    {t('Try Again')}
                  </button>
                </div>
              ) : !reportData ? (
                <div className="text-center py-8">
                  <div className="text-6xl mb-4">📊</div>
                  <p className="text-[var(--text-secondary)]">{t('No data for last month')}</p>
                </div>
              ) : (
                <div ref={reportRef} className="space-y-6">
                  {/* Health Score */}
                  <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-4">
                      <div 
                        className="relative w-20 h-20 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: reportData.healthColor + '20' }}
                      >
                        <svg className="absolute inset-0 w-full h-full -rotate-90">
                          <circle
                            cx="40"
                            cy="40"
                            r="36"
                            fill="none"
                            stroke={reportData.healthColor + '30'}
                            strokeWidth="8"
                          />
                          <circle
                            cx="40"
                            cy="40"
                            r="36"
                            fill="none"
                            stroke={reportData.healthColor}
                            strokeWidth="8"
                            strokeDasharray={`${(reportData.healthScore / 100) * 226} 226`}
                            strokeLinecap="round"
                          />
                        </svg>
                        <span className="text-2xl font-bold" style={{ color: reportData.healthColor }}>
                          {reportData.healthScore}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm text-[var(--text-secondary)]">{t('Financial Health')}</p>
                        <p className="text-lg font-bold" style={{ color: reportData.healthColor }}>
                          {reportData.healthLabel}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Summary Card */}
                  <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-5 border border-red-200 dark:border-red-800">
                    <p className="text-xs text-red-600 dark:text-red-400 mb-2 uppercase tracking-wide">{t('Total Expenses')}</p>
                    <p className="text-2xl font-bold text-red-700 dark:text-red-300">
                      {formatCurrency(reportData.totalExpense)}
                    </p>
                  </div>

                  {/* Top Categories */}
                  <div className="bg-[var(--card)] rounded-xl p-5 border border-[var(--border)]">
                    <h3 className="font-bold mb-4 flex items-center gap-2">
                      <span>📊</span> {t('Top Categories')}
                    </h3>
                    <div className="space-y-3">
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
                              <span className="text-sm font-medium truncate">{cat.categoryName}</span>
                              <span className="text-sm font-bold">{formatCurrency(cat.total)}</span>
                            </div>
                            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                              <div 
                                className="h-2 rounded-full transition-all duration-500"
                                style={{ 
                                  width: `${cat.percentage}%`,
                                  backgroundColor: cat.categoryColor 
                                }}
                              />
                            </div>
                          </div>
                          <span className="text-xs text-[var(--text-secondary)] w-12 text-right">
                            {cat.percentage.toFixed(1)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Insights */}
                  {reportData.insights.length > 0 && (
                    <div className="bg-[var(--card)] rounded-xl p-5 border border-[var(--border)]">
                      <h3 className="font-bold mb-4 flex items-center gap-2">
                        <span>💡</span> {t('Insights & Recommendations')}
                      </h3>
                      <div className="space-y-3">
                        {reportData.insights.map((insight, index) => (
                          <div 
                            key={index}
                            className={`p-3 rounded-lg border ${
                              insight.type === 'warning' 
                                ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
                                : insight.type === 'success'
                                ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                                : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                            }`}
                          >
                            <div className="flex items-start gap-2">
                              <span className="text-lg">{insight.icon}</span>
                              <div>
                                <p className="font-medium text-sm">{insight.title}</p>
                                <p className="text-xs text-[var(--text-secondary)] mt-1">{insight.description}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Quick Stats */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-[var(--card)] rounded-xl p-4 border border-[var(--border)]">
                      <p className="text-xs text-[var(--text-secondary)] mb-1">{t('Avg Daily')}</p>
                      <p className="font-bold">{formatCurrency(reportData.avgDailyExpense)}</p>
                    </div>
                    <div className="bg-[var(--card)] rounded-xl p-4 border border-[var(--border)]">
                      <p className="text-xs text-[var(--text-secondary)] mb-1">{t('Transactions')}</p>
                      <p className="font-bold">{reportData.transactionCount}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            {!isLoading && reportData && (
              <div className="p-4 border-t border-[var(--border)] bg-[var(--card)]">
                <button
                  onClick={handleDownload}
                  disabled={isGeneratingPDF}
                  className="w-full py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isGeneratingPDF ? (
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
        </motion.div>
      )}
    </AnimatePresence>
  );
}
