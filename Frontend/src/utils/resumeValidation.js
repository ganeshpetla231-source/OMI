export const MAX_RESUME_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(['.pdf', '.doc', '.docx']);

export function validateResumeFile(file) {
  if (!file) return { valid: false, reason: 'missing' };
  const extension = `.${String(file.name || '').split('.').pop()}`.toLocaleLowerCase();
  if (!ALLOWED_EXTENSIONS.has(extension)) return { valid: false, reason: 'type' };
  if (file.size > MAX_RESUME_SIZE_BYTES) return { valid: false, reason: 'size' };
  return { valid: true, reason: null };
}
