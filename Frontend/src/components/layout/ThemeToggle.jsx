import { Moon, Sun } from 'lucide-react';
import { useTranslation } from '../../context/LanguageContext';
import { Theme } from '../../config/constants';
import { useTheme } from '../../context/ThemeContext';
import { Button } from '../ui/Button';

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const { t } = useTranslation();
  const isDark = theme === Theme.DARK || (theme === Theme.SYSTEM && document.documentElement.classList.contains('dark'));
  const Icon = isDark ? Sun : Moon;
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={t('nav.toggleTheme')}
      title={t('nav.toggleTheme')}
      onClick={toggleTheme}
    >
      <Icon aria-hidden="true" className="h-5 w-5" />
    </Button>
  );
}
