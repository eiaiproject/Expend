import { CloudCross, Information, Lock, Trash2 } from 'reicon-react';
import { SectionCard } from '../../components/SectionCard';
import { SettingsRow, SettingsSection } from '../../components/SettingsPrimitives';
import { useTranslation } from '../../i18n';
import type { TranslationKey } from '../../i18n/id';
import type { StorageStatus } from '../../utils/storage';

const STORAGE_STATUS_KEY: Record<StorageStatus, TranslationKey> = {
  persisted: 'settings.storagePersisted',
  'best-effort': 'settings.storageBestEffort',
  unsupported: 'settings.storageUnsupported',
};

interface SettingsInfoSectionsProps {
  readonly storageStatus: StorageStatus;
  readonly txCount: number;
  readonly version: string;
  readonly deleteAllDescription: () => string;
  readonly onRequestDelete: () => void;
}

export function SettingsInfoSections({ storageStatus, txCount, version, deleteAllDescription, onRequestDelete }: SettingsInfoSectionsProps) {
  const { t } = useTranslation();
  return (
    <>
      <SettingsSection title={t('settings.privacy')}>
        <SectionCard padding="sm">
          <div className="divide-y divide-[var(--border)]">
            <SettingsRow
              icon={<Lock size={18} />}
              title={t('settings.localStorage')}
              description={t('settings.localStorageDesc')}
            />
            <div className="px-4 py-3">
              <p className="text-sm font-semibold">{t('settings.storageStatus')}</p>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">{t(STORAGE_STATUS_KEY[storageStatus])}</p>
            </div>
            <SettingsRow
              icon={<CloudCross size={18} />}
              iconBg="bg-[var(--bg)] border border-[var(--border)]"
              iconColor="text-[var(--text-muted)]"
              title={t('settings.noExternalConnection')}
              description={t('settings.offlineDesc')}
            />
            <SettingsRow
              icon={<Information size={18} />}
              iconBg="bg-[var(--bg)] border border-[var(--border)]"
              iconColor="text-[var(--text-muted)]"
              title={t('settings.receiptData')}
              description={t('settings.receiptDataDesc')}
            />
            <SettingsRow
              icon={<Lock size={18} />}
              iconBg="bg-[var(--danger-soft)]"
              iconColor="text-[var(--danger)]"
              title={t('settings.notEncrypted')}
              description={t('settings.notEncryptedDesc')}
            />
          </div>
        </SectionCard>
      </SettingsSection>

      <SettingsSection title={t('settings.about')}>
        <SectionCard padding="sm">
          <div className="divide-y divide-[var(--border)]">
            <div className="flex items-center gap-3 px-4 py-3">
              <div className="w-9 h-9 rounded-[var(--radius-md)] bg-[var(--accent-soft)] grid place-items-center shrink-0">
                <Information size={18} className="text-[var(--accent)]" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">Expend</p>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">{t('settings.aboutDesc')}</p>
              </div>
              <span className="inline-flex items-center rounded-full bg-[var(--bg)] border border-[var(--border)] text-[var(--text-secondary)] px-2.5 py-1 text-xs font-mono font-bold">{t('settings.version', { version })}</span>
            </div>
          </div>
        </SectionCard>
      </SettingsSection>

      <SettingsSection title={t('settings.dangerZone')}>
        <div className="rounded-[var(--radius-lg)] border border-[var(--danger-border)] bg-[var(--danger-bg)]/30">
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="w-9 h-9 rounded-[var(--radius-md)] bg-[var(--danger-soft)] grid place-items-center shrink-0">
              <Trash2 size={18} className="text-[var(--danger)]" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-[var(--danger-deep)]">{t('settings.deleteAll')}</p>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">{deleteAllDescription()}</p>
            </div>
            <button
              type="button"
              aria-label={t('settings.deleteAll')}
              disabled={txCount === 0}
              onClick={onRequestDelete}
              className="shrink-0 min-h-12 px-4 rounded-[var(--radius-md)] bg-[var(--danger-fill)] text-[var(--danger-fill-ink)] text-sm font-bold hover:opacity-90 active:scale-[0.98] transition-all focus-visible:ring-2 focus-visible:ring-[var(--danger)]/50 disabled:opacity-40 disabled:active:scale-100"
            >
              {t('common.delete')}
            </button>
          </div>
        </div>
      </SettingsSection>
    </>
  );
}
