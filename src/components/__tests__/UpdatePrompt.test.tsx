import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { UpdatePrompt } from '../UpdatePrompt';
import { setUseRegisterSWMockState, updateServiceWorkerMock } from '../../test/pwaRegisterReactMock';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe('UpdatePrompt', () => {
  beforeEach(() => {
    setUseRegisterSWMockState();
  });

  it('does not render when no service worker update is waiting', () => {
    render(<UpdatePrompt />);

    expect(screen.queryByText('New version available!')).not.toBeInTheDocument();
  });

  it('renders when a service worker update is waiting', () => {
    setUseRegisterSWMockState({ needRefresh: true });

    render(<UpdatePrompt />);

    expect(screen.getByText('New version available!')).toBeInTheDocument();
    expect(screen.getByText('Update reload warning')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Update' })).toBeInTheDocument();
  });

  it('activates the waiting service worker from the update button', async () => {
    setUseRegisterSWMockState({ needRefresh: true });

    render(<UpdatePrompt />);
    fireEvent.click(screen.getByRole('button', { name: 'Update' }));

    await waitFor(() => {
      expect(updateServiceWorkerMock).toHaveBeenCalledWith(true);
    });
    expect(screen.queryByText('New version available!')).not.toBeInTheDocument();
  });

  it('hides the prompt when dismissed', () => {
    setUseRegisterSWMockState({ needRefresh: true });

    render(<UpdatePrompt />);
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));

    expect(screen.queryByText('New version available!')).not.toBeInTheDocument();
  });
});
