import type { Dispatch, SetStateAction } from 'react';
import { vi } from 'vitest';
import type { RegisterSWOptions } from 'vite-plugin-pwa/types';

let needRefresh = false;
let offlineReady = false;

export const updateServiceWorkerMock = vi.fn(async (_reloadPage?: boolean) => undefined);

const setNeedRefresh: Dispatch<SetStateAction<boolean>> = (value) => {
  needRefresh = typeof value === 'function' ? value(needRefresh) : value;
};

const setOfflineReady: Dispatch<SetStateAction<boolean>> = (value) => {
  offlineReady = typeof value === 'function' ? value(offlineReady) : value;
};

export function setUseRegisterSWMockState(state: { needRefresh?: boolean; offlineReady?: boolean } = {}) {
  needRefresh = state.needRefresh ?? false;
  offlineReady = state.offlineReady ?? false;
  updateServiceWorkerMock.mockClear();
}

export function useRegisterSW(_options?: RegisterSWOptions) {
  return {
    needRefresh: [needRefresh, setNeedRefresh] as [boolean, Dispatch<SetStateAction<boolean>>],
    offlineReady: [offlineReady, setOfflineReady] as [boolean, Dispatch<SetStateAction<boolean>>],
    updateServiceWorker: updateServiceWorkerMock,
  };
}
