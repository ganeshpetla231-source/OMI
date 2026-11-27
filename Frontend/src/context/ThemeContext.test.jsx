import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { LanguageProvider } from './LanguageContext';
import { ThemeProvider, useTheme } from './ThemeContext';
import { ThemeToggle } from '../components/layout/ThemeToggle';
import { Theme } from '../config/constants';

function ThemeValue() {
  const { theme } = useTheme();
  return <output>{theme}</output>;
}

describe('ThemeContext', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
  });

  it('toggles between light and dark and persists the selection', async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <LanguageProvider>
          <ThemeValue />
          <ThemeToggle />
        </LanguageProvider>
      </ThemeProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Toggle color theme' }));
    expect(screen.getByText(Theme.DARK)).toBeInTheDocument();
    expect(document.documentElement).toHaveClass('dark');
    expect(localStorage.getItem('talkready_theme')).toBe(Theme.DARK);

    await user.click(screen.getByRole('button', { name: 'Toggle color theme' }));
    expect(screen.getByText(Theme.LIGHT)).toBeInTheDocument();
    expect(document.documentElement).not.toHaveClass('dark');
  });
});
