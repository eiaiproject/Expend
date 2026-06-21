import jsPDF from 'jspdf';
import { MonthlyReportData } from '../services/monthlyReportService';

// Theme colors from the app
const THEME = {
  dark: {
    bg: '#0F172A',
    card: '#1E293B',
    textPrimary: '#F1F5F9',
    textSecondary: '#94A3B8',
    accent: '#26B8A8',
    expense: '#F87171',
    income: '#4ADE80',
    border: '#334155',
  },
  light: {
    bg: '#F1F5F9',
    card: '#FFFFFF',
    textPrimary: '#0F172A',
    textSecondary: '#475569',
    accent: '#0F766E',
    expense: '#DC2626',
    income: '#15803D',
    border: '#CBD5E1',
  },
};

/**
 * Generate professional PDF with direct drawing (recommended path).
 * Uses app theme colors for consistency.
 */
export async function generateSimplePDF(
  data: MonthlyReportData,
  locale: string = 'id',
  theme: 'light' | 'dark' = 'light'
): Promise<void> {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - 2 * margin;
  let y = margin;
  
  // Use theme colors
  const colors = THEME[theme];
  
  // Convert hex to RGB
  const hexToRgb = (hex: string): [number, number, number] => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (result && result[1] && result[2] && result[3]) {
      return [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)];
    }
    return [0, 0, 0];
  };
  
  const accentRgb = hexToRgb(colors.accent);
  const textPrimaryRgb = hexToRgb(colors.textPrimary);
  const textSecondaryRgb = hexToRgb(colors.textSecondary);
  const expenseRgb = hexToRgb(colors.expense);
  const incomeRgb = hexToRgb(colors.income);
  const cardRgb = hexToRgb(colors.card);
  const borderRgb = hexToRgb(colors.border);
  
  // ═══════════════════════════════════════════════════════════════
  // HEADER
  // ═══════════════════════════════════════════════════════════════
  const headerHeight = 40;
  pdf.setFillColor(...accentRgb);
  pdf.rect(0, 0, pageWidth, headerHeight, 'F');
  
  // Accent line at bottom of header
  pdf.setFillColor(255, 255, 255);
  pdf.rect(0, headerHeight - 2, pageWidth, 2, 'F');
  
  // Title
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(18);
  pdf.setFont('helvetica', 'bold');
  pdf.text('LAPORAN KEUANGAN BULANAN', margin, 16);
  
  // Month/Year
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'normal');
  const monthYear = `${data.monthName} ${data.year}`;
  pdf.text(monthYear, margin, 24);
  
  // Generated date
  pdf.setFontSize(8);
  pdf.setTextColor(255, 255, 255, 0.8);
  const generatedDate = new Date().toLocaleDateString('id-ID', { 
    day: 'numeric', 
    month: 'long', 
    year: 'numeric' 
  });
  pdf.text(`Dibuat: ${generatedDate}`, margin, 32);
  
  y = headerHeight + 15;
  
  // ═══════════════════════════════════════════════════════════════
  // HEALTH SCORE SECTION
  // ═══════════════════════════════════════════════════════════════
  const healthBoxHeight = 35;
  pdf.setFillColor(...cardRgb);
  pdf.roundedRect(margin, y, contentWidth, healthBoxHeight, 3, 3, 'F');
  
  // Health score circle
  const circleX = margin + 18;
  const circleY = y + healthBoxHeight / 2;
  const circleRadius = 12;
  
  const healthColorRgb = hexToRgb(data.healthColor);
  pdf.setFillColor(...healthColorRgb);
  pdf.circle(circleX, circleY, circleRadius, 'F');
  
  // Score number
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'bold');
  pdf.text(String(data.healthScore), circleX, circleY + 1, { align: 'center' });
  
  // Health label
  pdf.setTextColor(...textPrimaryRgb);
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  pdf.text('SKOR KESEHATAN KEUANGAN', circleX + 20, circleY - 4);
  
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(...healthColorRgb);
  pdf.text(data.healthLabel, circleX + 20, circleY + 4);
  
  y += healthBoxHeight + 15;
  
  // ═══════════════════════════════════════════════════════════════
  // SUMMARY SECTION
  // ═══════════════════════════════════════════════════════════════
  const summaryBoxHeight = 35;
  pdf.setFillColor(...cardRgb);
  pdf.roundedRect(margin, y, contentWidth, summaryBoxHeight, 3, 3, 'F');
  
  // Section title
  pdf.setTextColor(...textSecondaryRgb);
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'bold');
  pdf.text('RINGKASAN', margin + 8, y + 8);
  
  // Summary item
  const summaryY = y + 14;
  
  // Total Expense
  pdf.setFontSize(7);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(...textSecondaryRgb);
  pdf.text('TOTAL PENGELUARAN BULAN INI', margin + 8, summaryY);
  
  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(...expenseRgb);
  const expenseStr = `Rp ${data.totalExpense.toLocaleString('id-ID')}`;
  pdf.text(expenseStr, margin + 8, summaryY + 10);
  
  y += summaryBoxHeight + 15;
  
  // ═══════════════════════════════════════════════════════════════
  // TOP CATEGORIES SECTION
  // ═══════════════════════════════════════════════════════════════
  // Section title
  pdf.setTextColor(...textPrimaryRgb);
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'bold');
  pdf.text('TOP 5 KATEGORI PENGELUARAN', margin, y);
  y += 8;
  
  const topCategories = data.categoryBreakdown.slice(0, 5);
  const maxAmount = topCategories[0]?.total || 1;
  
  topCategories.forEach((cat, index) => {
    // Category rank number
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(...textSecondaryRgb);
    pdf.text(`${index + 1}.`, margin, y + 3);
    
    // Category name
    pdf.setTextColor(...textPrimaryRgb);
    pdf.text(cat.categoryName, margin + 8, y + 3);
    
    // Category amount
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(...textSecondaryRgb);
    const catAmount = `Rp ${cat.total.toLocaleString('id-ID')}`;
    pdf.text(catAmount, pageWidth - margin, y + 3, { align: 'right' });
    
    // Progress bar background
    y += 6;
    const barWidth = contentWidth - 8;
    const barHeight = 4;
    pdf.setFillColor(...borderRgb);
    pdf.roundedRect(margin + 4, y, barWidth, barHeight, 1, 1, 'F');
    
    // Progress bar fill
    const catColorRgb = hexToRgb(cat.categoryColor);
    const fillWidth = Math.max((cat.total / maxAmount) * barWidth, 2);
    pdf.setFillColor(...catColorRgb);
    pdf.roundedRect(margin + 4, y, fillWidth, barHeight, 1, 1, 'F');
    
    // Percentage
    pdf.setFontSize(7);
    pdf.setTextColor(...textSecondaryRgb);
    pdf.text(`${cat.percentage.toFixed(1)}%`, margin + barWidth + 8, y + 3);
    
    y += 10;
  });
  
  y += 10;
  
  // ═══════════════════════════════════════════════════════════════
  // DAILY STATISTICS SECTION
  // ═══════════════════════════════════════════════════════════════
  // Section title
  pdf.setTextColor(...textPrimaryRgb);
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'bold');
  pdf.text('STATISTIK HARIAN', margin, y);
  y += 8;
  
  // Stats grid
  const statBoxWidth = (contentWidth - 8) / 2;
  const statBoxHeight = 22;
  
  // Average Daily
  pdf.setFillColor(...cardRgb);
  pdf.roundedRect(margin, y, statBoxWidth, statBoxHeight, 2, 2, 'F');
  
  pdf.setFontSize(7);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(...textSecondaryRgb);
  pdf.text('RATA-RATA PER HARI', margin + 6, y + 7);
  
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(...textPrimaryRgb);
  pdf.text(`Rp ${data.avgDailyExpense.toLocaleString('id-ID')}`, margin + 6, y + 15);
  
  // Highest Day
  pdf.setFillColor(...cardRgb);
  pdf.roundedRect(margin + statBoxWidth + 8, y, statBoxWidth, statBoxHeight, 2, 2, 'F');
  
  pdf.setFontSize(7);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(...textSecondaryRgb);
  pdf.text('HARI TERTINGGI', margin + statBoxWidth + 14, y + 7);
  
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(...expenseRgb);
  pdf.text(`Rp ${data.highestDayExpense.toLocaleString('id-ID')}`, margin + statBoxWidth + 14, y + 15);
  
  y += statBoxHeight + 6;
  
  // Lowest Day
  pdf.setFillColor(...cardRgb);
  pdf.roundedRect(margin, y, statBoxWidth, statBoxHeight, 2, 2, 'F');
  
  pdf.setFontSize(7);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(...textSecondaryRgb);
  pdf.text('HARI TERENDAH', margin + 6, y + 7);
  
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(...incomeRgb);
  pdf.text(`Rp ${data.lowestDayExpense.toLocaleString('id-ID')}`, margin + 6, y + 15);
  
  // Transaction Count
  pdf.setFillColor(...cardRgb);
  pdf.roundedRect(margin + statBoxWidth + 8, y, statBoxWidth, statBoxHeight, 2, 2, 'F');
  
  pdf.setFontSize(7);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(...textSecondaryRgb);
  pdf.text('TOTAL TRANSAKSI', margin + statBoxWidth + 14, y + 7);
  
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(...textPrimaryRgb);
  pdf.text(`${data.transactionCount} transaksi`, margin + statBoxWidth + 14, y + 15);
  
  y += statBoxHeight + 15;
  
  // ═══════════════════════════════════════════════════════════════
  // INSIGHTS SECTION
  // ═══════════════════════════════════════════════════════════════
  if (data.insights.length > 0) {
    // Check if we need a new page
    if (y > pageHeight - 80) {
      pdf.addPage();
      y = margin;
    }
    
    // Section title
    pdf.setTextColor(...textPrimaryRgb);
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'bold');
    pdf.text('INSIGHT & REKOMENDASI', margin, y);
    y += 8;
    
    data.insights.forEach((insight) => {
      // Check if we need a new page for this insight
      if (y > pageHeight - 40) {
        pdf.addPage();
        y = margin;
      }
      
      // Insight box
      const insightBoxHeight = 18;
      let bgColor: [number, number, number];
      let borderColor: [number, number, number];
      
      if (insight.type === 'warning') {
        bgColor = [254, 243, 199]; // Yellow background
        borderColor = [252, 211, 77]; // Yellow border
      } else if (insight.type === 'success') {
        bgColor = [209, 250, 229]; // Green background
        borderColor = [110, 231, 183]; // Green border
      } else {
        bgColor = [219, 234, 254]; // Blue background
        borderColor = [147, 197, 253]; // Blue border
      }
      
      // Draw box
      pdf.setFillColor(...bgColor);
      pdf.roundedRect(margin, y, contentWidth, insightBoxHeight, 2, 2, 'F');
      
      // Left border accent
      pdf.setFillColor(...borderColor);
      pdf.roundedRect(margin, y, 3, insightBoxHeight, 1, 1, 'F');
      
      // Title
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(...textPrimaryRgb);
      pdf.text(insight.title, margin + 8, y + 7);
      
      // Description
      pdf.setFontSize(7);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(...textSecondaryRgb);
      const descLines = pdf.splitTextToSize(insight.description, contentWidth - 10);
      pdf.text(descLines[0] || '', margin + 8, y + 13);
      
      y += insightBoxHeight + 4;
    });
  }
  
  // ═══════════════════════════════════════════════════════════════
  // FOOTER
  // ═══════════════════════════════════════════════════════════════
  const footerY = pageHeight - 12;
  
  // Footer line
  pdf.setFillColor(...borderRgb);
  pdf.rect(margin, footerY - 5, contentWidth, 0.5, 'F');
  
  // Footer text
  pdf.setFontSize(7);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(...textSecondaryRgb);
  pdf.text('Expend - Aplikasi Pelacakan Keuangan', pageWidth / 2, footerY, { align: 'center' });
  pdf.text(`Halaman 1`, pageWidth - margin, footerY, { align: 'right' });
  
  // Generate filename
  const filename = `Laporan_Keuangan_${data.monthName}_${data.year}.pdf`;
  pdf.save(filename);
}

/**
 * Convert hex color to RGB array.
 */
function hexToRGB(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (result && result[1] && result[2] && result[3]) {
    return [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)];
  }
  return [107, 114, 128];
}

/**
 * Get health color as RGB array.
 */
function getHealthColorRGB(score: number): [number, number, number] {
  if (score >= 80) return [16, 185, 129];
  if (score >= 60) return [59, 130, 246];
  if (score >= 40) return [245, 158, 11];
  if (score >= 20) return [249, 115, 22];
  return [239, 68, 68];
}
