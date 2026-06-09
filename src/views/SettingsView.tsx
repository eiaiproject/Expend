import { useState, useRef } from 'react';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { useTranslation } from 'react-i18next';
import { db } from '../db/db';
import { useSecurity } from '../contexts/SecurityContext';
import { Moon, Sun, Download, Upload, Shield, Lock, Trash2, Check, Coffee, Tag } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { Link } from 'react-router-dom';
import { toast } from '../components/Toaster';
import { confirm } from '../components/ConfirmDialog';
import { AnimatePresence, motion } from 'motion/react';
import { generateExport, importData, validateImportData, MAX_IMPORT_FILE_SIZE, downloadBlob, sanitizeCsvRows } from '../services/importExportService';
import { STORAGE_KEYS } from '../utils/constants';

// Settings sub-components
import { SettingsAccordion } from '../components/settings/SettingsAccordion';
import { VerifyCurrentPinModal } from '../components/settings/VerifyCurrentPinModal';
import { PinSetupModal } from '../components/settings/PinSetupModal';

export default function SettingsView() {
  const { t, i18n } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showPinSetup, setShowPinSetup] = useState(false);
  const [showChangePin, setShowChangePin] = useState(false);
  const [showDisableConfirm, setShowDisableConfirm] = useState(false);
  
  const {
    securityEnabled,
    securityMethod,
    isSecurityLoaded,
    setupPin,
    disableSecurity,
    checkSecurityAvailable
  } = useSecurity();

  const { pin: pinAvailable } = checkSecurityAvailable();
  const { theme, setTheme } = useTheme();

  const handleLangChange = async (lang: string) => {
    await i18n.changeLanguage(lang);
    await db.settings.put({ key: 'language', value: lang });
  };

  const handleExportCSV = async () => {
    const Papa = (await import('papaparse')).default;
    const txs = await db.transactions.toArray();
    const csv = Papa.unparse(sanitizeCsvRows(txs));
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    downloadBlob(blob, `expend_export_${new Date().toISOString().split('T')[0]}.csv`);
  };

  const handleExportJSON = async () => {
    const data = await generateExport();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    downloadBlob(blob, `expend_backup_${new Date().toISOString().split('T')[0]}.json`);
  };

  const handleImportJSON = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_IMPORT_FILE_SIZE) {
      toast.add(t('Import Invalid'));
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);

        const errors = validateImportData(json);
        if (errors.length > 0) {
          toast.add(t('Import Invalid'));
          return;
        }

        const confirmed = await confirm({ title: t('Import'), message: t('Import Confirm'), variant: 'danger' });
        if (confirmed) {
          await importData(json);
          toast.add(t('Import Success'));
        }
      } catch {
        toast.add(t('Import Error'));
      }
    };
    reader.readAsText(file);
  };

  const handleResetLocalData = async () => {
    const confirmed = await confirm({
      title: t('Reset Local Data'),
      message: t('Reset Local Data Confirm'),
      variant: 'danger',
    });

    if (!confirmed) return;

    await db.transaction('rw', [db.transactions, db.categories, db.wallets, db.settings], async () => {
      await db.transactions.clear();
      await db.categories.clear();
      await db.wallets.clear();
      await db.settings.clear();
    });

    Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));
    toast.add(t('Local Data Reset'));
    window.location.reload();
  };

  const handleSetupPin = async (pin: string) => {
    await setupPin(pin);
  };

  const handleDisableSecurity = async () => {
    await disableSecurity();
    setShowDisableConfirm(false);
  };

  const disableConfirmRef = useFocusTrap(showDisableConfirm);

  // First verify current PIN before allowing change or disable
  const [pendingAction, setPendingAction] = useState<'changePin' | 'disableSecurity' | null>(null);

  const handleChangePinRequest = () => {
    if (securityEnabled) {
      // Require current PIN verification first
      setPendingAction('changePin');
    } else {
      setShowChangePin(true);
    }
  };

  const handleDisableRequest = () => {
    // Require current PIN verification first
    setPendingAction('disableSecurity');
  };

  const handleVerified = () => {
    if (pendingAction === 'changePin') {
      setShowChangePin(true);
    } else if (pendingAction === 'disableSecurity') {
      setShowDisableConfirm(true);
    }
    setPendingAction(null);
  };

  return (
    <div className="p-4 space-y-6">
      <h1 className="text-2xl font-bold">{t('Settings')}</h1>

      <div className="space-y-4">
        {/* Appearance */}
        <SettingsAccordion title={t('Appearance')}>
          <div className="flex flex-col">
            <button onClick={() => setTheme('dark')} className="w-full flex items-center justify-between p-4 border-b border-[var(--border)]">
              <div className="flex items-center gap-3">
                <Moon size={20} />
                <span>{t('Dark Mode')}</span>
              </div>
              {theme === 'dark' && <div className="w-2 h-2 rounded-full bg-[var(--accent)]" />}
            </button>
            <button onClick={() => setTheme('light')} className="w-full flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <Sun size={20} />
                <span>{t('Light Mode')}</span>
              </div>
              {theme === 'light' && <div className="w-2 h-2 rounded-full bg-[var(--accent)]" />}
            </button>
          </div>
        </SettingsAccordion>

        {/* Language */}
        <SettingsAccordion title={t('Language')}>
          <div className="flex flex-col">
            <button onClick={() => handleLangChange('id')} className="w-full flex items-center justify-between p-4 border-b border-[var(--border)]">
              <span>Indonesia (ID)</span>
              {i18n.language?.startsWith('id') && <div className="w-2 h-2 rounded-full bg-[var(--accent)]" />}
            </button>
            <button onClick={() => handleLangChange('en')} className="w-full flex items-center justify-between p-4">
              <span>English (EN)</span>
              {i18n.language?.startsWith('en') && <div className="w-2 h-2 rounded-full bg-[var(--accent)]" />}
            </button>
          </div>
        </SettingsAccordion>

        {/* Data */}
        <SettingsAccordion title={t('Data')}>
          <div className="flex flex-col">
             <button onClick={handleExportCSV} className="w-full flex items-center gap-3 p-4 border-b border-[var(--border)] text-left hover:bg-[var(--card)] transition-colors">
              <Download size={20} /> {t('Export CSV')}
            </button>
            <button onClick={handleExportJSON} className="w-full flex items-center gap-3 p-4 border-b border-[var(--border)] text-left hover:bg-[var(--card)] transition-colors">
              <Download size={20} /> {t('Export JSON')}
            </button>
            <button onClick={() => fileInputRef.current?.click()} className="w-full flex items-center gap-3 p-4 text-orange-500 text-left hover:bg-[var(--card)] transition-colors">
              <Upload size={20} /> {t('Import JSON')}
            </button>
            <input 
              type="file" 
              accept=".json" 
              className="hidden" 
              ref={fileInputRef}
              onChange={handleImportJSON}
            />
            <button onClick={handleResetLocalData} className="w-full flex items-center gap-3 p-4 text-red-500 text-left hover:bg-[var(--card)] transition-colors border-t border-[var(--border)]">
              <Trash2 size={20} /> {t('Reset Local Data')}
            </button>
          </div>
        </SettingsAccordion>

        {/* Categories */}
        <SettingsAccordion title={t('Categories')}>
          <Link to="/categories" className="w-full flex items-center gap-3 p-4 hover:bg-[var(--card)] transition-colors">
            <Tag size={20} />
            <div>
              <span className="font-medium">{t('Categories & Budgets')}</span>
              <p className="text-xs text-[var(--text-secondary)]">{t('Manage categories & budgets')}</p>
            </div>
          </Link>
        </SettingsAccordion>

        {/* Security */}
        <SettingsAccordion title={t('Security')}>
          <div className="flex flex-col divide-y divide-[var(--border)]">
            {!isSecurityLoaded && (
              <div className="p-4 space-y-3">
                <div className="h-4 bg-[var(--border)] rounded animate-pulse w-3/4" />
                <div className="h-3 bg-[var(--border)] rounded animate-pulse w-1/2" />
              </div>
            )}

            {isSecurityLoaded && pinAvailable && !securityEnabled && (
              <button 
                onClick={() => setShowPinSetup(true)}
                className="w-full flex items-center gap-3 p-4 text-left hover:bg-[var(--card)] transition-colors"
              >
                <Lock size={20} />
                <span>{t('Set up PIN')}</span>
              </button>
            )}

            {isSecurityLoaded && securityEnabled && (
              <>
                <div className="flex items-center gap-3 p-4">
                  <Lock size={20} />
                  <div className="flex-1">
                    <span className="font-medium">
                      {t('PIN Lock')}
                    </span>
                    <p className="text-sm text-[var(--text-secondary)] flex items-center gap-1">
                      <Check size={14} className="text-green-500" /> {t('Enabled')}
                    </p>
                  </div>
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                </div>

                <button 
                  onClick={handleChangePinRequest}
                  className="w-full flex items-center gap-3 p-4 text-left hover:bg-[var(--card)] transition-colors"
                >
                  <Lock size={20} />
                  <span>{t('Change PIN')}</span>
                </button>

                <button 
                  onClick={handleDisableRequest}
                  className="w-full flex items-center gap-3 p-4 text-red-500 text-left hover:bg-[var(--card)] transition-colors"
                >
                  <Trash2 size={20} />
                  <span>{t('Disable Security')}</span>
                </button>
              </>
            )}

            {isSecurityLoaded && !securityEnabled && !pinAvailable && (
              <div className="p-4 text-center text-[var(--text-secondary)]">
                {t('Security not available on this device')}
              </div>
            )}
          </div>
        </SettingsAccordion>
      </div>

      {/* Support Section */}
      <div className="mt-8 p-6 bg-orange-500/10 rounded-2xl border border-orange-500/20 flex flex-col items-center text-center gap-3">
        <div className="p-3 bg-orange-500 rounded-full text-white shadow-lg">
          <Coffee size={24} />
        </div>
        <div>
          <h3 className="font-bold text-[var(--text-primary)]">
            {t('Support Title')}
          </h3>
          <p className="text-xs text-[var(--text-secondary)]">
            {t('Support Text')}
          </p>
        </div>
        <a 
          href="https://trakteer.id/eiaiproject" 
          target="_blank" 
          rel="noopener noreferrer"
          className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold transition-all active:scale-95 shadow-md shadow-orange-500/20"
        >
          {t('Buy Me A Coffee')}
        </a>
      </div>

      {/* PIN Setup Modal */}
      <PinSetupModal 
        isOpen={showPinSetup} 
        onClose={() => setShowPinSetup(false)} 
        onSuccess={handleSetupPin}
      />

      {/* Verify Current PIN Modal (before Change PIN or Disable) */}
      <VerifyCurrentPinModal 
        isOpen={pendingAction !== null} 
        onClose={() => setPendingAction(null)} 
        onVerified={handleVerified}
      />

      {/* Change PIN Modal */}
      <PinSetupModal 
        isOpen={showChangePin} 
        onClose={() => setShowChangePin(false)} 
        onSuccess={handleSetupPin}
      />

      {/* Disable Confirm Modal */}
      <AnimatePresence>
        {showDisableConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-6"
            onClick={() => setShowDisableConfirm(false)}
          >
            <motion.div
              ref={disableConfirmRef}
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="bg-[var(--card)] rounded-2xl w-full max-w-sm p-6 space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-12 h-12 mx-auto rounded-full bg-red-500/10 flex items-center justify-center">
                <Shield size={24} className="text-red-500" />
              </div>
              <div className="text-center space-y-2">
                <h2 className="text-lg font-bold">{t('Disable Security')}</h2>
                <p className="text-sm text-[var(--text-secondary)]">
                  {t('Are you sure you want to disable screen lock?')}
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDisableConfirm(false)}
                  className="flex-1 h-11 rounded-xl border border-[var(--border)] font-medium hover:bg-[var(--bg)] transition-colors"
                >
                  {t('Cancel')}
                </button>
                <button
                  onClick={handleDisableSecurity}
                  className="flex-1 h-11 rounded-xl bg-red-500 text-white font-medium hover:bg-red-600 transition-colors"
                >
                  {t('Disable')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
