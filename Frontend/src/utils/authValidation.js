export function validateName(value) {
  const name = value.trim();
  if (name.length < 2 || name.length > 60) return 'validation.name';
  return '';
}

export function validateEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) ? '' : 'validation.email';
}

export function validatePassword(value) {
  if (value.length < 8) return 'validation.passwordLength';
  if (!/[A-Za-z]/.test(value)) return 'validation.passwordLetter';
  if (!/\d/.test(value)) return 'validation.passwordNumber';
  return '';
}

export function validateConfirmPassword(value, password) {
  return value === password ? '' : 'validation.confirmPassword';
}

export function validateLogin(values) {
  const errors = {};
  const emailError = validateEmail(values.email);
  if (emailError) errors.email = emailError;
  if (!values.password) errors.password = 'validation.passwordRequired';
  return errors;
}

export function validateRegistration(values) {
  const errors = {};
  const nameError = validateName(values.name);
  const emailError = validateEmail(values.email);
  const passwordError = validatePassword(values.password);
  const confirmError = validateConfirmPassword(values.confirmPassword, values.password);
  if (nameError) errors.name = nameError;
  if (emailError) errors.email = emailError;
  if (passwordError) errors.password = passwordError;
  if (confirmError) errors.confirmPassword = confirmError;
  return errors;
}

export function validatePasswordChange(values) {
  const errors = {};
  if (!values.currentPassword) errors.currentPassword = 'validation.currentPassword';
  const passwordError = validatePassword(values.newPassword);
  const confirmError = validateConfirmPassword(values.confirmPassword, values.newPassword);
  if (passwordError) errors.newPassword = passwordError;
  if (confirmError) errors.confirmPassword = confirmError;
  if (values.currentPassword && values.currentPassword === values.newPassword) {
    errors.newPassword = 'validation.passwordDifferent';
  }
  return errors;
}

export function getPasswordStrength(value) {
  const points = [
    value.length >= 8,
    value.length >= 12,
    /[a-z]/.test(value) && /[A-Z]/.test(value),
    /\d/.test(value),
    /[^A-Za-z0-9]/.test(value),
  ].filter(Boolean).length;
  if (points >= 4) return 'auth.passwordStrength.strong';
  if (points >= 2) return 'auth.passwordStrength.medium';
  return 'auth.passwordStrength.weak';
}
