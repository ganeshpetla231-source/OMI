import { useEffect, useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Checkbox } from '../ui/Checkbox';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Textarea } from '../ui/Textarea';
import { useTranslation } from '../../context/LanguageContext';
import { Language, Difficulty } from '../../config/constants';
import { useQuestionOptions } from '../../hooks/useQuestionOptions';
import { normalizeOptions } from '../../utils/questionData';
import { normalizeQuestionPayload, validateAdminQuestion } from '../../utils/adminQuestionValidation';

const EMPTY_QUESTION = {
  text: '',
  category: '',
  jobRole: '',
  difficulty: Difficulty.BEGINNER,
  language: Language.ENGLISH,
  skill: '',
  tags: [],
  expectedAnswer: '',
  keywords: [],
  evaluationCriteria: [],
  timeLimitSeconds: 120,
  isActive: true,
};

function ListEditor({ label, values, onChange, placeholder, addLabel, removeLabel, required = false }) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState('');
  const add = () => {
    const value = draft.trim();
    if (!value || values.some((item) => item.toLocaleLowerCase() === value.toLocaleLowerCase())) return;
    onChange([...values, value]);
    setDraft('');
  };
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-medium">{label}{required && <span aria-hidden="true"> *</span>}</legend>
      <div className="flex gap-2">
        <Input
          aria-label={label}
          value={draft}
          placeholder={placeholder}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              add();
            }
          }}
        />
        <Button type="button" variant="secondary" disabled={!draft.trim()} onClick={add}>
          <Plus aria-hidden="true" className="h-4 w-4" />{addLabel}
        </Button>
      </div>
      {values.length ? (
        <ul className="mt-2 flex flex-wrap gap-2">
          {values.map((value, index) => (
            <li key={`${value}-${index}`} className="inline-flex items-center gap-1">
              <Badge>{value}</Badge>
              <button
                type="button"
                aria-label={removeLabel.replace('{value}', value)}
                className="rounded-full p-1 text-muted hover:bg-slate-100 dark:hover:bg-slate-800"
                onClick={() => onChange(values.filter((_, currentIndex) => currentIndex !== index))}
              >
                <X aria-hidden="true" className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : <p className="mt-2 text-xs text-muted dark:text-muted-dark">{required ? t('admin.requiredListHint') : t('admin.optionalListHint')}</p>}
    </fieldset>
  );
}

export default function AdminQuestionForm({
  initialQuestion,
  busy = false,
  apiError = null,
  onCancel,
  onSave,
}) {
  const { t } = useTranslation();
  const [form, setForm] = useState(() => ({ ...EMPTY_QUESTION, ...(initialQuestion || {}) }));
  const [newCategory, setNewCategory] = useState('');
  const [newJobRole, setNewJobRole] = useState('');
  const [newSkill, setNewSkill] = useState('');
  const [addingCategory, setAddingCategory] = useState(false);
  const [addingRole, setAddingRole] = useState(false);
  const [addingSkill, setAddingSkill] = useState(false);
  const [errors, setErrors] = useState({});
  const options = useQuestionOptions(form.category, form.jobRole);
  const categories = useMemo(() => normalizeOptions(options.categories.items), [options.categories.items]);
  const roles = useMemo(() => normalizeOptions(options.roles.items), [options.roles.items]);
  const skills = useMemo(() => normalizeOptions(options.skills.items), [options.skills.items]);
  const isEditingCategory = Boolean(form.category && !categories.some((item) => item.value === form.category));
  const isEditingRole = Boolean(form.jobRole && !roles.some((item) => item.value === form.jobRole));
  const isEditingSkill = Boolean(form.skill && !skills.some((item) => item.value === form.skill));

  useEffect(() => {
    setForm({ ...EMPTY_QUESTION, ...(initialQuestion || {}) });
    setNewCategory('');
    setNewJobRole('');
    setNewSkill('');
    setAddingCategory(false);
    setAddingRole(false);
    setAddingSkill(false);
    setErrors({});
  }, [initialQuestion]);

  const setField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const submit = (event) => {
    event.preventDefault();
    const candidate = normalizeQuestionPayload({
      ...form,
      category: newCategory || form.category,
      jobRole: newJobRole || form.jobRole,
      skill: newSkill || form.skill,
    });
    const result = validateAdminQuestion(candidate);
    setErrors(result.errors);
    if (result.valid) void onSave(result.question);
  };

  const fieldError = (key) => errors[key] ? t(`admin.validation.${errors[key]}`) : undefined;
  const activeCategory = newCategory || form.category;
  const activeRole = newJobRole || form.jobRole;
  const activeSkill = newSkill || form.skill;
  const optionErrors = [options.categories.error, options.roles.error, options.skills.error].filter(Boolean);

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      {apiError && <p role="alert" className="rounded-lg bg-danger-light p-3 text-sm text-danger">{apiError.message}</p>}
      {optionErrors.length > 0 && (
        <div role="alert" className="rounded-lg border border-warning/40 bg-warning-light p-3 text-sm">
          <p>{t('admin.questionOptionsError')}</p>
          <Button className="mt-2" size="sm" variant="secondary" type="button" onClick={() => {
            if (options.categories.error) void options.retry('categories');
            if (options.roles.error) void options.retry('roles');
            if (options.skills.error) void options.retry('skills');
          }}>{t('common.retry')}</Button>
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <Textarea
          label={t('admin.questionText')}
          value={form.text}
          onChange={(event) => setField('text', event.target.value)}
          error={fieldError('text')}
          required
          minLength={10}
          maxLength={500}
          className="min-h-24"
        />
        <Textarea
          label={t('admin.expectedAnswer')}
          value={form.expectedAnswer}
          onChange={(event) => setField('expectedAnswer', event.target.value)}
          error={fieldError('expectedAnswer')}
          required
          maxLength={5000}
          className="min-h-24"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {addingCategory || isEditingCategory ? (
          <Input
            label={t('admin.category')}
            value={newCategory || form.category}
            onChange={(event) => { setNewCategory(event.target.value); setField('category', event.target.value); }}
            error={fieldError('category')}
            required
            hint={t('admin.newTaxonomyHint')}
          />
        ) : (
          <Select
            label={t('admin.category')}
            value={form.category}
            options={[
              { value: '', label: t('admin.selectCategory') },
              ...categories,
              { value: '__new__', label: t('admin.addNewCategory') },
            ]}
            onChange={(event) => {
              if (event.target.value === '__new__') {
                setAddingCategory(true);
                setNewCategory('');
                setField('category', '');
              } else {
                setAddingCategory(false);
                setNewCategory('');
                setField('category', event.target.value);
                setField('jobRole', '');
                setField('skill', '');
              }
            }}
            error={fieldError('category')}
          />
        )}
        {addingRole || isEditingRole ? (
          <Input label={t('admin.jobRole')} value={newJobRole || form.jobRole} onChange={(event) => { setNewJobRole(event.target.value); setField('jobRole', event.target.value); }} error={fieldError('jobRole')} required hint={t('admin.newTaxonomyHint')} />
        ) : (
          <Select
            label={t('admin.jobRole')}
            value={form.jobRole}
            disabled={!activeCategory || options.roles.loading}
            options={[
              { value: '', label: options.roles.loading ? t('common.loading') : t('admin.selectRole') },
              ...roles,
              { value: '__new__', label: t('admin.addNewRole') },
            ]}
            onChange={(event) => {
              if (event.target.value === '__new__') {
                setAddingRole(true);
                setNewJobRole('');
                setField('jobRole', '');
              } else {
                setAddingRole(false);
                setField('jobRole', event.target.value);
                setField('skill', '');
              }
            }}
            error={fieldError('jobRole')}
          />
        )}
        {addingSkill || isEditingSkill ? (
          <Input label={t('admin.skill')} value={newSkill || form.skill} onChange={(event) => { setNewSkill(event.target.value); setField('skill', event.target.value); }} error={fieldError('skill')} required hint={t('admin.newTaxonomyHint')} />
        ) : (
          <Select
            label={t('admin.skill')}
            value={form.skill}
            disabled={!activeRole || options.skills.loading}
            options={[
              { value: '', label: options.skills.loading ? t('common.loading') : t('admin.selectSkill') },
              ...skills,
              { value: '__new__', label: t('admin.addNewSkill') },
            ]}
            onChange={(event) => {
              if (event.target.value === '__new__') {
                setAddingSkill(true);
                setNewSkill('');
                setField('skill', '');
              } else {
                setAddingSkill(false);
                setField('skill', event.target.value);
              }
            }}
            error={fieldError('skill')}
          />
        )}
        <Select
          label={t('admin.difficulty')}
          value={form.difficulty}
          options={Object.values(Difficulty).map((value) => ({ value, label: t(`questionBank.difficulties.${value}`) }))}
          onChange={(event) => setField('difficulty', event.target.value)}
          error={fieldError('difficulty')}
        />
        <Select
          label={t('admin.language')}
          value={form.language}
          options={Object.values(Language).map((value) => ({ value, label: t(`questionBank.languages.${value}`) }))}
          onChange={(event) => setField('language', event.target.value)}
          error={fieldError('language')}
        />
        <Input
          label={t('admin.timeLimit')}
          type="number"
          min="1"
          step="1"
          value={form.timeLimitSeconds}
          onChange={(event) => setField('timeLimitSeconds', event.target.value)}
          error={fieldError('timeLimitSeconds')}
          required
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <ListEditor label={t('admin.keywords')} values={form.keywords || []} onChange={(items) => setField('keywords', items)} placeholder={t('admin.keywordPlaceholder')} addLabel={t('admin.addItem')} removeLabel={t('admin.removeItem')} required />
        <ListEditor label={t('admin.tags')} values={form.tags || []} onChange={(items) => setField('tags', items)} placeholder={t('admin.tagPlaceholder')} addLabel={t('admin.addItem')} removeLabel={t('admin.removeItem')} />
      </div>
      <ListEditor
        label={t('admin.evaluationCriteria')}
        values={form.evaluationCriteria || []}
        onChange={(items) => setField('evaluationCriteria', items)}
        placeholder={t('admin.criteriaPlaceholder')}
        addLabel={t('admin.addItem')}
        removeLabel={t('admin.removeItem')}
        required
      />
      {fieldError('keywords') && <p role="alert" className="text-sm text-danger">{t('admin.keywords')}: {fieldError('keywords')}</p>}
      {fieldError('evaluationCriteria') && <p role="alert" className="text-sm text-danger">{t('admin.evaluationCriteria')}: {fieldError('evaluationCriteria')}</p>}

      <Checkbox label={t('admin.activeQuestion')} checked={Boolean(form.isActive)} onChange={(event) => setField('isActive', event.target.checked)} />

      <Card className="bg-slate-50 dark:bg-slate-800">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">{t('admin.livePreview')}</p>
        <h3 className="mt-2 font-semibold">{form.text.trim() || t('admin.previewQuestion')}</h3>
        <p className="mt-2 text-sm text-muted dark:text-muted-dark">{form.expectedAnswer.trim() || t('admin.previewAnswer')}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {activeCategory && <Badge tone="primary">{activeCategory}</Badge>}
          {activeRole && <Badge>{activeRole}</Badge>}
          {activeSkill && <Badge tone="success">{activeSkill}</Badge>}
          {form.difficulty && <Badge tone="neutral">{t(`questionBank.difficulties.${form.difficulty}`)}</Badge>}
        </div>
      </Card>

      <div className="flex justify-end gap-3 border-t border-slate-200 pt-4 dark:border-slate-700">
        <Button type="button" variant="secondary" disabled={busy} onClick={onCancel}>{t('common.cancel')}</Button>
        <Button type="submit" loading={busy}>{initialQuestion?.id ? t('admin.saveChanges') : t('admin.createQuestion')}</Button>
      </div>
    </form>
  );
}
