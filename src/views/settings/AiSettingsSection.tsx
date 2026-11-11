import { useState } from 'react';
import { SectionCard } from '../../components/SectionCard';
import { SettingsSection } from '../../components/SettingsPrimitives';
import { useTranslation } from '../../i18n';
import type { TranslationKey } from '../../i18n/id';
import { getAiConfig, normalizeBaseUrl, saveAiConfig, clearAiConfig, DEFAULT_AI_MODEL, type AiConfig } from '../../utils/aiConfig';
import { AiAuthError, AiHttpError, AiModelError, AiNetworkError, AiResponseError, testAiConnection } from '../../utils/ai';

type Status = 'idle' | 'saving' | 'testing' | 'ok' | 'error';

function errorKey(e: unknown): TranslationKey {
  if (e instanceof AiAuthError) return 'settings.aiAuthError';
  if (e instanceof AiNetworkError) return 'settings.aiNetworkError';
  if (e instanceof AiModelError) return 'settings.aiModelError';
  if (e instanceof AiHttpError) return 'settings.aiHttpError';
  if (e instanceof AiResponseError) return 'settings.aiResponseError';
  return 'settings.aiHttpError';
}

export function AiSettingsSection() {
  const { t } = useTranslation();
  const saved = getAiConfig();
  const [baseUrl, setBaseUrl] = useState(saved?.baseUrl ?? '');
  const [apiKey, setApiKey] = useState(saved?.apiKey ?? '');
  const [model, setModel] = useState(saved?.model ?? DEFAULT_AI_MODEL);
  const [showKey, setShowKey] = useState(false);
  const [hasKey, setHasKey] = useState(Boolean(saved));
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState<TranslationKey | null>(null);
  const [testedModel, setTestedModel] = useState<string | null>(null);

  const buildConfig = (): AiConfig | null => {
    const normalized = normalizeBaseUrl(baseUrl);
    if (!normalized || !apiKey.trim()) {
      setStatus('error');
      setMessage('settings.aiInvalidConfig');
      return null;
    }
    return { baseUrl: normalized, apiKey: apiKey.trim(), model: model.trim() || DEFAULT_AI_MODEL };
  };

  const handleSave = () => {
    const config = buildConfig();
    if (!config) return;
    if (!saveAiConfig(config)) {
      setStatus('error');
      setMessage('settings.aiSaveError');
      return;
    }
    setHasKey(true);
    setStatus('ok');
    setMessage('settings.aiSaved');
  };

  const handleTest = async () => {
    const config = buildConfig();
    if (!config) return;
    setStatus('testing');
    setMessage(null);
    try {
      const resolved = await testAiConnection(config);
      setTestedModel(resolved);
      setStatus('ok');
      setMessage('settings.aiTestOk');
    } catch (e) {
      setStatus('error');
      setMessage(errorKey(e));
    }
  };

  const handleDisconnect = () => {
    clearAiConfig();
    setApiKey('');
    setBaseUrl('');
    setModel(DEFAULT_AI_MODEL);
    setHasKey(false);
    setStatus('idle');
    setMessage('settings.aiRemoved');
  };

  return (
    <SettingsSection title={t('settings.ai')}>
      <SectionCard>
        <div className="space-y-4 p-4">
          <div>
            <p className="text-sm font-semibold">{t('settings.ai')}</p>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5 leading-relaxed">{t('settings.aiDesc')}</p>
          </div>

          <label htmlFor="ai-base-url" className="block">
            <span className="text-xs font-medium text-[var(--text-secondary)]">{t('settings.aiBaseUrl')}</span>
            <input
              id="ai-base-url"
              type="url"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder={t('settings.aiBaseUrlPlaceholder')}
              autoComplete="off"
              spellCheck={false}
              className="mt-1 w-full min-h-12 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:border-[var(--accent)]"
            />
          </label>

          <label htmlFor="ai-api-key" className="block">
            <span className="text-xs font-medium text-[var(--text-secondary)]">{t('settings.aiApiKey')}</span>
            <div className="mt-1 flex gap-2">
              <input
                id="ai-api-key"
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                autoComplete="off"
                spellCheck={false}
                className="min-w-0 flex-1 min-h-12 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] px-3 text-sm font-mono outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:border-[var(--accent)]"
              />
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                aria-label={t(showKey ? 'settings.aiHideKey' : 'settings.aiShowKey')}
                className="shrink-0 min-h-12 px-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] text-xs font-semibold hover:bg-[var(--bone)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50"
              >
                {t(showKey ? 'settings.aiHideKey' : 'settings.aiShowKey')}
              </button>
            </div>
          </label>

          <label htmlFor="ai-model" className="block">
            <span className="text-xs font-medium text-[var(--text-secondary)]">{t('settings.aiModel')}</span>
            <input
              id="ai-model"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder={t('settings.aiModelPlaceholder')}
              autoComplete="off"
              spellCheck={false}
              className="mt-1 w-full min-h-12 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] px-3 text-sm font-mono outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:border-[var(--accent)]"
            />
            <span className="mt-1 block text-xs text-[var(--text-muted)] leading-relaxed">{t('settings.aiModelDesc')}</span>
          </label>

          <p className="text-xs text-[var(--text-secondary)] leading-relaxed" role="note">{t('settings.aiPrivacy')}</p>
          <p className="text-xs text-[var(--text-muted)]" role="note">{t('settings.aiLocalNote')}</p>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={status === 'testing'}
              className="min-h-12 rounded-[var(--radius-md)] bg-[var(--accent-fill)] text-[var(--accent-ink)] text-sm font-bold hover:opacity-90 active:scale-[0.98] transition-all focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50 disabled:opacity-40"
            >
              {t('settings.aiSave')}
            </button>
            <button
              type="button"
              onClick={() => void handleTest()}
              disabled={status === 'testing'}
              className="min-h-12 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] text-sm font-semibold hover:bg-[var(--bone)] active:scale-[0.98] transition-all focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50 disabled:opacity-40"
            >
              {t(status === 'testing' ? 'settings.aiTesting' : 'settings.aiTest')}
            </button>
          </div>

          {hasKey && (
            <button
              type="button"
              onClick={handleDisconnect}
              className="w-full min-h-12 rounded-[var(--radius-md)] border border-[var(--danger-border)] text-[var(--danger-deep)] text-sm font-semibold hover:bg-[var(--danger-bg)]/30 focus-visible:ring-2 focus-visible:ring-[var(--danger)]/50"
            >
              {t('settings.aiDisconnect')}
            </button>
          )}

          {message && (
            <p
              role={status === 'error' ? 'alert' : 'status'}
              className={`text-xs leading-relaxed ${status === 'error' ? 'text-[var(--danger-deep)]' : 'text-[var(--text-secondary)]'}`}
            >
              {message === 'settings.aiTestOk' ? t(message, { model: testedModel ?? model }) : t(message)}
            </p>
          )}
        </div>
      </SectionCard>
    </SettingsSection>
  );
}
