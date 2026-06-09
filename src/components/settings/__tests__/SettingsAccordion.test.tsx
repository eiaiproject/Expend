import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SettingsAccordion } from '../SettingsAccordion';

// Mock i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en' },
  }),
}));

describe('SettingsAccordion', () => {
  it('renders title correctly', () => {
    render(
      <SettingsAccordion title="Appearance">
        <div>Content</div>
      </SettingsAccordion>
    );
    expect(screen.getByText('Appearance')).toBeInTheDocument();
  });

  it('hides content by default', () => {
    render(
      <SettingsAccordion title="Appearance">
        <div>Content</div>
      </SettingsAccordion>
    );
    expect(screen.queryByText('Content')).not.toBeInTheDocument();
  });

  it('shows content when defaultOpen is true', () => {
    render(
      <SettingsAccordion title="Appearance" defaultOpen={true}>
        <div>Content</div>
      </SettingsAccordion>
    );
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('toggles content on click', async () => {
    render(
      <SettingsAccordion title="Appearance">
        <div>Content</div>
      </SettingsAccordion>
    );
    
    // Click to open
    fireEvent.click(screen.getByText('Appearance'));
    expect(screen.getByText('Content')).toBeInTheDocument();
    
    // Click to close
    fireEvent.click(screen.getByText('Appearance'));
    // Wait for animation to complete
    await new Promise(resolve => setTimeout(resolve, 300));
    expect(screen.queryByText('Content')).not.toBeInTheDocument();
  });

  it('renders children correctly when open', () => {
    render(
      <SettingsAccordion title="Data">
        <button>Export</button>
        <button>Import</button>
      </SettingsAccordion>
    );
    
    fireEvent.click(screen.getByText('Data'));
    expect(screen.getByText('Export')).toBeInTheDocument();
    expect(screen.getByText('Import')).toBeInTheDocument();
  });
});
