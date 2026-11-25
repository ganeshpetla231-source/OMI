import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AuthLayout } from '../layouts/AuthLayout';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/LanguageContext';
import { useToast } from '../components/ui/Toast';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { PasswordField } from '../components/auth/PasswordField';
import { validateRegistration } from '../utils/authValidation';
import { ROUTES } from '../config/routes';

const initialValues = { name: '', email: '', password: '', confirmPassword: '' };

export default function RegisterPage() {
  const { register, continueAsGuest } = useAuth();
  const { t } = useTranslation();
  const toast = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const updateField = (field, value) => {
    const nextValues = { ...values, [field]: value };
    setValues(nextValues);
    if (touched[field]) setErrors((current) => ({ ...current, [field]: validateRegistration(nextValues)[field] || '' }));
    if (field === 'password' && touched.confirmPassword) {
      setErrors((current) => ({ ...current, confirmPassword: validateRegistration(nextValues).confirmPassword || '' }));
    }
  };

  const blurField = (field) => {
    setTouched((current) => ({ ...current, [field]: true }));
    setErrors((current) => ({ ...current, [field]: validateRegistration(values)[field] || '' }));
  };

  const submit = async (event) => {
    event.preventDefault();
    const validation = validateRegistration(values);
    setTouched({ name: true, email: true, password: true, confirmPassword: true });
    setErrors(validation);
    setFormError('');
    if (Object.values(validation).some(Boolean)) return;

    setSubmitting(true);
    try {
      await register({ name: values.name.trim(), email: values.email.trim(), password: values.password });
      toast.success(t('auth.registerSuccess'));
      navigate(location.state?.from || ROUTES.HOME, { replace: true });
    } catch (error) {
      setFormError(error.message || t('auth.registerFailed'));
      const fieldErrors = {};
      for (const issue of error.errors || []) {
        if (issue.field && ['name', 'email', 'password'].includes(issue.field)) fieldErrors[issue.field] = issue.message;
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
    <AuthLayout title={t('auth.registerTitle')}>
      <form noValidate onSubmit={submit} className="space-y-4">
        {formError && <p role="alert" className="rounded-lg bg-danger-light p-3 text-sm text-danger dark:bg-red-950 dark:text-red-200">{formError}</p>}
        <Input
          label={t('auth.name')}
          autoComplete="name"
          maxLength={60}
          value={values.name}
          error={errors.name ? t(errors.name) : ''}
          onChange={(event) => updateField('name', event.target.value)}
          onBlur={() => blurField('name')}
        />
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
          autoComplete="new-password"
          showStrength
          error={errors.password ? t(errors.password) : ''}
          onChange={(event) => updateField('password', event.target.value)}
          onBlur={() => blurField('password')}
        />
        <PasswordField
          label={t('auth.confirmPassword')}
          value={values.confirmPassword}
          autoComplete="new-password"
          error={errors.confirmPassword ? t(errors.confirmPassword) : ''}
          onChange={(event) => updateField('confirmPassword', event.target.value)}
          onBlur={() => blurField('confirmPassword')}
        />
        <Button type="submit" className="w-full" loading={submitting}>{t('auth.createAccount')}</Button>
      </form>
      <p className="mt-5 text-center text-sm text-muted dark:text-muted-dark">
        {t('auth.hasAccount')} <Link to={ROUTES.LOGIN} state={location.state} className="font-semibold text-primary hover:underline">{t('auth.signIn')}</Link>
      </p>
      <div className="my-4 flex items-center gap-3 text-xs text-muted dark:text-muted-dark"><span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />or<span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" /></div>
      <Button type="button" variant="secondary" className="w-full" onClick={enterGuestMode}>{t('auth.continueAsGuest')}</Button>
    </AuthLayout>
  );
}
