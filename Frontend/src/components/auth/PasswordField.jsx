import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useTranslation } from '../../context/LanguageContext';
import { getPasswordStrength } from '../../utils/authValidation';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

export function PasswordField({ label, value, onChange, onBlur, error, id, autoComplete, showStrength = false }) {
  const [visible, setVisible] = useState(false);
  const { t } = useTranslation();
  const strength = getPasswordStrength(value);
  const Icon = visible ? EyeOff : Eye;

  return (
    <div className="relative">
      <Input
        id={id}
        label={label}
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        error={error}
        autoComplete={autoComplete}
        className="pr-12"
      />
      <Button
        variant="ghost"
        size="icon"
        aria-label={visible ? t('auth.hidePassword') : t('auth.showPassword')}
        className="absolute right-1 top-7"
        onClick={() => setVisible((current) => !current)}
      >
        <Icon aria-hidden="true" className="h-5 w-5" />
      </Button>
      {showStrength && (
        <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-2 text-xs">
          <span className="text-muted dark:text-muted-dark">{t('auth.passwordHint')}</span>
          <span className={strength.endsWith('weak') ? 'text-warning' : strength.endsWith('strong') ? 'text-success' : 'text-primary'}>
            {t('auth.passwordStrength.label')}: {t(strength)}
          </span>
        </div>
      )}
    </div>
  );
}
