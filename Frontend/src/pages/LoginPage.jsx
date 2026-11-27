import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AuthLayout } from '../layouts/AuthLayout';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/LanguageContext';
import { useToast } from '../components/ui/Toast';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { PasswordField } from '../components/auth/PasswordField';
import { validateLogin } from '../utils/authValidation';
import { ROUTES } from '../config/routes';

export default function LoginPage() {
  const { login, continueAsGuest } = useAuth();
  const { t } = useTranslation();
  const toast = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const [values, setValues] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const updateField = (field, value) => {
    const nextValues = { ...values, [field]: value };
    setValues(nextValues);
    if (touched[field]) setErrors((current) => ({ ...current, [field]: validateLogin(nextValues)[field] || '' }));
  };

  const blurField = (field) => {
    setTouched((current) => ({ ...current, [field]: true }));
    setErrors((current) => ({ ...current, [field]: validateLogin(values)[field] || '' }));
  };

  const submit = async (event) => {
    event.preventDefault();
    const validation = validateLogin(values);
    setTouched({ email: true, password: true });
    setErrors(validation);
    setFormError('');
    if (Object.values(validation).some(Boolean)) return;

    setSubmitting(true);
    try {
      await login({ email: values.email.trim(), password: values.password });
      toast.success(t('auth.loginSuccess'));
      navigate(location.state?.from || ROUTES.HOME, { replace: true });
    } catch (error) {
      setFormError(error.message || t('auth.loginFailed'));
      const fieldErrors = {};
      for (const issue of error.errors || []) {
        if (issue.field && ['email', 'password'].includes(issue.field)) fieldErrors[issue.field] = issue.message;
      }
      setErrors((current) => ({ ...current, ...fieldErrors }));
    } finally {
      setSubmitting(false);
    }
  };

  const enterGuestMode = () => {
    try {
      continueAsGuest();
      toast.success(t('guest.ready'));
      navigate(ROUTES.HOME, { replace: true });
    } catch (error) {
      toast.error(error.message);
    }
  };

  return (
    <AuthLayout title={t('auth.loginTitle')}>
      <form noValidate onSubmit={submit} className="space-y-4">
        {formError && <p role="alert" className="rounded-lg bg-danger-light p-3 text-sm text-danger dark:bg-red-950 dark:text-red-200">{formError}</p>}
        <Input
          label={t('auth.email')}
          type="email"
          autoComplete="email"
          value={values.email}
          error={errors.email ? t(errors.email) : ''}
          onChange={(event) => updateField('email', event.target.value)}
          onBlur={() => blurField('email')}
        />
        <PasswordField
          label={t('auth.password')}
          value={values.password}
          autoComplete="current-password"
          error={errors.password ? t(errors.password) : ''}
          onChange={(event) => updateField('password', event.target.value)}
          onBlur={() => blurField('password')}
        />
        <Button type="submit" className="w-full" loading={submitting}>{t('auth.signIn')}</Button>
      </form>
      <p className="mt-5 text-center text-sm text-muted dark:text-muted-dark">
        {t('auth.noAccount')} <Link to={ROUTES.REGISTER} state={location.state} className="font-semibold text-primary hover:underline">{t('auth.createAccount')}</Link>
      </p>
      <div className="my-4 flex items-center gap-3 text-xs text-muted dark:text-muted-dark"><span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />or<span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" /></div>
      <Button type="button" variant="secondary" className="w-full" onClick={enterGuestMode}>{t('auth.continueAsGuest')}</Button>
    </AuthLayout>
  );
}
