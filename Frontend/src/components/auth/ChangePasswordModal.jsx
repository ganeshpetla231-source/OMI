import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from '../../context/LanguageContext';
import { useToast } from '../ui/Toast';
import { validatePasswordChange } from '../../utils/authValidation';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { PasswordField } from './PasswordField';

const initialValues = { currentPassword: '', newPassword: '', confirmPassword: '' };

export function ChangePasswordModal({ open, onClose }) {
  const { changePassword } = useAuth();
  const { t } = useTranslation();
  const toast = useToast();
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const updateField = (field, value) => {
    const nextValues = { ...values, [field]: value };
    setValues(nextValues);
    if (touched[field]) setErrors((current) => ({ ...current, [field]: validatePasswordChange(nextValues)[field] || '' }));
    if (field === 'newPassword' && touched.confirmPassword) {
      setErrors((current) => ({ ...current, confirmPassword: validatePasswordChange(nextValues).confirmPassword || '' }));
    }
  };

  const blurField = (field) => {
    const message = validatePasswordChange(values)[field] || '';
    setTouched((current) => current[field] ? current : { ...current, [field]: true });
    setErrors((current) => current[field] === message ? current : { ...current, [field]: message });
  };

  const submit = async (event) => {
    event.preventDefault();
    const validation = validatePasswordChange(values);
    setTouched({ currentPassword: true, newPassword: true, confirmPassword: true });
    setErrors(validation);
    setFormError('');
    if (Object.values(validation).some(Boolean)) return;

    setSubmitting(true);
    try {
      await changePassword({ currentPassword: values.currentPassword, newPassword: values.newPassword });
      toast.success(t('auth.passwordChanged'));
      setValues(initialValues);
      onClose();
    } catch (error) {
      setFormError(error.message || t('auth.passwordChangeFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  const close = () => {
    if (submitting) return;
    setFormError('');
    setValues(initialValues);
    setErrors({});
    setTouched({});
    onClose();
  };

  return (
    <Modal open={open} onClose={close} title={t('auth.changePasswordTitle')}>
      <form noValidate onSubmit={submit} className="space-y-4">
        {formError && <p role="alert" className="rounded-lg bg-danger-light p-3 text-sm text-danger dark:bg-red-950 dark:text-red-200">{formError}</p>}
        <PasswordField
          label={t('auth.currentPassword')}
          value={values.currentPassword}
          autoComplete="current-password"
          error={errors.currentPassword ? t(errors.currentPassword) : ''}
          onChange={(event) => updateField('currentPassword', event.target.value)}
          onBlur={() => blurField('currentPassword')}
        />
        <PasswordField
          label={t('auth.newPassword')}
          value={values.newPassword}
          autoComplete="new-password"
          showStrength
          error={errors.newPassword ? t(errors.newPassword) : ''}
          onChange={(event) => updateField('newPassword', event.target.value)}
          onBlur={() => blurField('newPassword')}
        />
        <PasswordField
          label={t('auth.confirmPassword')}
          value={values.confirmPassword}
          autoComplete="new-password"
          error={errors.confirmPassword ? t(errors.confirmPassword) : ''}
          onChange={(event) => updateField('confirmPassword', event.target.value)}
          onBlur={() => blurField('confirmPassword')}
        />
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={close} disabled={submitting}>{t('common.cancel')}</Button>
          <Button type="submit" loading={submitting}>{t('auth.changePasswordSubmit')}</Button>
        </div>
      </form>
    </Modal>
  );
}
