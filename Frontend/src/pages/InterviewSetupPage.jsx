import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Briefcase, Code2, MessageSquare, Users } from 'lucide-react';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Checkbox } from '../components/ui/Checkbox';
import { ErrorState } from '../components/ui/ErrorState';
import { Select } from '../components/ui/Select';
import { Skeleton } from '../components/ui/Skeleton';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/LanguageContext';
import { settingsApi } from '../services/api/settingsApi';
import { ROUTES } from '../config/routes';
import { useQuestionOptions } from '../hooks/useQuestionOptions';
import { interviewsApi } from '../services/api/interviewsApi';
import { notesApi } from '../services/api/notesApi';
import { questionsApi } from '../services/api/questionsApi';
import { resumesApi } from '../services/api/resumesApi';
import { normalizeOptions } from '../utils/questionData';
import { getSpeechCapabilities } from '../utils/speechCapabilities';

const LANGUAGES = ['en', 'te', 'hi'];
const DIFFICULTIES = ['beginner', 'intermediate', 'advanced'];
const DURATIONS = [5, 10, 15, 30];
const QUESTION_COUNTS = [5, 10, 15];
const STYLES = ['friendly', 'standard', 'strict', 'rapid-fire'];
const SETUP_DEFAULTS = {
  category: 'general',
  jobRole: '',
  skills: [],
  difficulty: 'beginner',
  duration: '15',
  questionCount: '5',
  style: 'standard',
  language: 'en',
  mode: 'text',
  practiceType: 'practice',
  source: 'bank',
  noteId: '',
  resumeId: '',
};

const categoryIcons = {
  hr: Users,
  technical: Code2,
  general: Briefcase,
  communication: MessageSquare,
  coding: Code2,
};

function normalizePrefill(values = {}) {
  const result = {};
  ['category', 'difficulty', 'language', 'mode', 'style', 'practiceType'].forEach((key) => {
    if (values[key] !== undefined) result[key] = values[key];
  });
  if (['bank', 'notes', 'resume'].includes(values.source)) result.source = values.source;
  if (values.noteId) result.noteId = values.noteId;
  if (values.resumeId) result.resumeId = values.resumeId;
  if (values.jobRole || values.role) result.jobRole = values.jobRole || values.role;
  if (Array.isArray(values.skills)) result.skills = values.skills;
  else if (values.skill) result.skills = [values.skill];
  if (values.duration !== undefined) result.duration = String(values.duration);
  if (values.questionCount !== undefined) result.questionCount = String(values.questionCount);
  if (values.style || values.interviewStyle) result.style = values.style || values.interviewStyle;
  if (values.practiceType || values.sessionType) result.practiceType = values.practiceType || values.sessionType;
  return result;
}

function readInitialDraft(storageKey, locationState, preferences, uiLanguage) {
  let draft = {};
  let error = null;
  try {
    const stored = sessionStorage.getItem(storageKey);
    if (stored) {
      const parsed = JSON.parse(stored);
      draft = { ...parsed.form };
    }
  } catch (storageError) {
    error = storageError;
  }
  const routeValues = locationState?.setup || locationState?.filters || locationState || {};
  return {
    form: {
      ...SETUP_DEFAULTS,
      language: uiLanguage,
      ...normalizePrefill(preferences),
      ...normalizePrefill(draft),
      ...normalizePrefill(routeValues),
    },
    step: Number.isInteger(draft.step) && draft.step >= 1 && draft.step <= 3 ? draft.step : 1,
    error,
  };
}

function QuestionOptionsError({ resource, onRetry, t }) {
  if (!resource.error) return null;
  return (
    <div role="alert" className="mt-3 rounded-lg border border-danger/30 bg-danger-light p-3 text-sm text-danger">
      <p>{resource.error.message || t('interviewSetup.optionsError')}</p>
      <Button className="mt-2" size="sm" variant="secondary" onClick={onRetry}>{t('common.retry')}</Button>
    </div>
  );
}

function ChoiceCard({ selected, disabled, icon: Icon, title, description, onClick }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-pressed={selected}
      className={`flex min-h-32 flex-col items-start rounded-xl border p-4 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${selected ? 'border-primary bg-primary-light dark:bg-indigo-950' : 'border-slate-200 bg-white hover:border-slate-400 dark:border-slate-700 dark:bg-slate-900'}`}
    >
      {Icon && <Icon aria-hidden="true" className="mb-3 h-5 w-5 text-primary" />}
      <span className="font-semibold">{title}</span>
      {description && <span className="mt-1 text-sm text-muted dark:text-muted-dark">{description}</span>}
    </button>
  );
}

export default function InterviewSetupPage() {
  const { t, language } = useTranslation();
  const { user, guestProfile, isAuthenticated, isGuest } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const storageKey = `talkready_interview_setup_${user?.id || guestProfile?.guestId || 'guest'}`;
  const [initial] = useState(() => readInitialDraft(
    storageKey,
    location.state,
    user?.preferences?.interviewPreferences || user?.preferences || {},
    language,
  ));
  const [form, setForm] = useState(initial.form);
  const [step, setStep] = useState(initial.step);
  const [draftError, setDraftError] = useState(initial.error);
  const [stepError, setStepError] = useState(null);
  const [submitError, setSubmitError] = useState(null);
  const [checking, setChecking] = useState(false);
  const [creating, setCreating] = useState(false);
  const [availability, setAvailability] = useState({ loading: true, error: null, counts: {} });
  const [noteOptions, setNoteOptions] = useState({ items: [], loading: false, error: null });
  const [resumeOptions, setResumeOptions] = useState({ items: [], loading: false, error: null });
  const [sourceRetry, setSourceRetry] = useState(0);
  const [online, setOnline] = useState(() => navigator.onLine);
  const [languageRetry, setLanguageRetry] = useState(0);
  const languageRequestId = useRef(0);
  const formEdited = useRef(false);
  const options = useQuestionOptions(form.category, form.jobRole);
  const categoryOptions = useMemo(() => normalizeOptions(options.categories.items), [options.categories.items]);
  const roleOptions = useMemo(() => normalizeOptions(options.roles.items), [options.roles.items]);
  const skillOptions = useMemo(() => normalizeOptions(options.skills.items), [options.skills.items]);
  const speechCapabilities = getSpeechCapabilities();
  const hasVoiceApis = speechCapabilities.recognition && speechCapabilities.synthesis && speechCapabilities.microphone;
  const canUseVoice = hasVoiceApis && online;
  const canUseResume = Boolean(isAuthenticated && !isGuest && online);
  const voiceUnavailableMessage = !online
    ? t('interviewSetup.voiceNeedsInternet')
    : !speechCapabilities.recognition
      ? t('interviewSetup.recognitionUnsupported')
      : !speechCapabilities.synthesis
        ? t('interviewSetup.synthesisUnsupported')
        : !speechCapabilities.microphone
          ? t('interviewSetup.microphoneUnsupported')
          : t('interviewSetup.voiceUnsupported');

  useEffect(() => {
    let active = true;
    let hasSavedDraft = false;
    try {
      hasSavedDraft = Boolean(sessionStorage.getItem(storageKey));
    } catch (error) {
      setDraftError(error);
    }
    const routePrefill = normalizePrefill(location.state?.setup || location.state?.filters || location.state || {});
    const userPrefill = normalizePrefill(user?.preferences?.interviewPreferences || user?.preferences || {});
    if (hasSavedDraft || Object.keys(routePrefill).length || Object.keys(userPrefill).length) return undefined;
    settingsApi.get().then((saved) => {
      if (!active || formEdited.current) return;
      const savedPreferences = normalizePrefill(saved.interviewPreferences || {});
      setForm((current) => ({ ...current, ...savedPreferences, language: savedPreferences.language || current.language || language }));
    }).catch((error) => {
      if (active) setSubmitError(error);
    });
    return () => { active = false; };
  }, [language, location.state, storageKey, user?.preferences]);

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (!canUseVoice && form.mode === 'voice') updateForm({ mode: 'text' }, false);
  }, [canUseVoice, form.mode]);

  const updateForm = (updates, markEdited = true) => {
    if (markEdited) formEdited.current = true;
    setForm((current) => ({ ...current, ...updates }));
    setStepError(null);
    setSubmitError(null);
  };

  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify({ form, step }));
      setDraftError(null);
    } catch (error) {
      setDraftError(error);
    }
  }, [form, step, storageKey]);

  useEffect(() => {
    if (options.roles.loading || options.roles.error || options.roles.query?.[0] !== form.category) return;
    if (!roleOptions.some((role) => role.value === form.jobRole) && roleOptions.length) {
      updateForm({ jobRole: roleOptions[0].value, skills: [] }, false);
    }
  }, [form.category, form.jobRole, options.roles.error, options.roles.loading, options.roles.query, roleOptions]);

  useEffect(() => {
    const requestId = ++languageRequestId.current;
    let active = true;
    setAvailability({ loading: true, error: null, counts: {} });
    Promise.all(LANGUAGES.map(async (language) => {
      const result = await questionsApi.list({
        category: form.category,
        jobRole: form.jobRole,
        difficulty: form.difficulty,
        language,
        page: 1,
        limit: 1,
      });
      return [language, Number(result.pagination?.total ?? result.items.length)];
    })).then((entries) => {
      if (active && languageRequestId.current === requestId) {
        setAvailability({ loading: false, error: null, counts: Object.fromEntries(entries) });
      }
    }).catch((error) => {
      if (active && languageRequestId.current === requestId) {
        setAvailability({ loading: false, error, counts: {} });
      }
    });
    return () => { active = false; };
  }, [form.category, form.jobRole, form.difficulty, languageRetry]);

  useEffect(() => {
    if (step !== 3) return;
    let active = true;
    setNoteOptions((current) => ({ ...current, loading: true, error: null }));
    notesApi.list({ page: 1, limit: 100 })
      .then((response) => {
        if (active) setNoteOptions({ items: response.items || [], loading: false, error: null });
      })
      .catch((error) => {
        if (active) setNoteOptions({ items: [], loading: false, error });
      });

    if (!canUseResume) {
      setResumeOptions({ items: [], loading: false, error: null });
      return () => { active = false; };
    }
    setResumeOptions((current) => ({ ...current, loading: true, error: null }));
    resumesApi.list()
      .then((items) => {
        if (active) setResumeOptions({ items, loading: false, error: null });
      })
      .catch((error) => {
        if (active) setResumeOptions({ items: [], loading: false, error });
      });
    return () => { active = false; };
  }, [step, canUseResume, sourceRetry]);

  const retryLanguageAvailability = () => setLanguageRetry((count) => count + 1);
  const selectedSkills = form.skills || [];
  const questionCountAvailable = Number(availability.counts[form.language] || 0);

  const validateFirstStep = async () => {
    if (!form.category || !form.jobRole) {
      setStepError(t('interviewSetup.categoryRoleRequired'));
      return false;
    }
    setChecking(true);
    try {
      const result = await questionsApi.list({
        category: form.category,
        jobRole: form.jobRole,
        page: 1,
        limit: 1,
      });
      const total = Number(result.pagination?.total ?? result.items.length);
      if (total === 0) {
        setStepError(t('interviewSetup.noQuestionsForSelection'));
        return false;
      }
      return true;
    } catch (error) {
      setStepError(error.message || t('interviewSetup.optionsError'));
      return false;
    } finally {
      setChecking(false);
    }
  };

  const validateSecondStep = () => {
    if (availability.loading) {
      setStepError(t('interviewSetup.checkingLanguages'));
      return false;
    }
    if (availability.error) {
      setStepError(t('interviewSetup.languageCheckFailed'));
      return false;
    }
    if (questionCountAvailable === 0) {
      setStepError(t('interviewSetup.noQuestionsForLanguage'));
      return false;
    }
    if (Number(form.questionCount) > questionCountAvailable) {
      setStepError(t('interviewSetup.notEnoughQuestions', { count: questionCountAvailable }));
      return false;
    }
    if (!DIFFICULTIES.includes(form.difficulty) || !DURATIONS.includes(Number(form.duration)) || !QUESTION_COUNTS.includes(Number(form.questionCount))) {
      setStepError(t('interviewSetup.invalidStep'));
      return false;
    }
    return true;
  };

  const nextStep = async () => {
    const valid = step === 1 ? await validateFirstStep() : validateSecondStep();
    if (valid) {
      formEdited.current = true;
      setStep((current) => Math.min(3, current + 1));
      setStepError(null);
    }
  };

  const submitSetup = async () => {
    if (
      !STYLES.includes(form.style)
      || !['practice', 'timed'].includes(form.practiceType)
      || !['text', 'voice'].includes(form.mode)
      || !['bank', 'notes', 'resume'].includes(form.source)
      || ![5, 10, 15, 30].includes(Number(form.duration))
      || ![5, 10, 15].includes(Number(form.questionCount))
    ) {
      setSubmitError(t('interviewSetup.invalidStep'));
      return;
    }
    if (!canUseVoice && form.mode === 'voice') {
      setSubmitError(voiceUnavailableMessage);
      return;
    }
    if (form.source === 'notes' && (!form.noteId || !noteOptions.items.some((note) => note.id === form.noteId))) {
      setSubmitError(t('interviewSetup.selectNote'));
      return;
    }
    if (form.source === 'resume' && (!canUseResume || !form.resumeId || !resumeOptions.items.some((resume) => resume.id === form.resumeId))) {
      setSubmitError(t(!canUseResume ? 'interviewSetup.resumeUnavailable' : 'interviewSetup.selectResume'));
      return;
    }
    if (form.source === 'bank' && (availability.error || availability.loading || questionCountAvailable < Number(form.questionCount))) {
      setSubmitError(t('interviewSetup.noQuestionsForSelection'));
      return;
    }
    setCreating(true);
    setSubmitError(null);
    try {
      if (form.source === 'notes' || form.source === 'resume') {
        const generated = await questionsApi.generate({
          ...(form.source === 'notes' ? { noteId: form.noteId } : { resumeId: form.resumeId }),
          category: form.category,
          jobRole: form.jobRole,
          difficulty: form.difficulty,
          language: form.language,
          count: Number(form.questionCount),
        });
        if (!generated.items?.length) throw new Error(t('interviewSetup.noQuestionsForSelection'));
      }
      const interview = await interviewsApi.create({
        ...form,
        ...(form.source === 'bank' ? { noteId: undefined, resumeId: undefined } : {}),
        ...(form.source === 'notes' ? { resumeId: undefined } : {}),
        ...(form.source === 'resume' ? { noteId: undefined } : {}),
        duration: Number(form.duration),
        questionCount: Number(form.questionCount),
      });
      sessionStorage.removeItem(storageKey);
      navigate(`/interview/${encodeURIComponent(interview.id)}/check`, { state: { interview } });
    } catch (error) {
      setSubmitError(error.message || t('interviewSetup.createError'));
    } finally {
      setCreating(false);
    }
  };

  const selectedCategory = categoryOptions.find((option) => option.value === form.category);
  const selectedRole = roleOptions.find((option) => option.value === form.jobRole);
  const selectedSkillLabels = skillOptions.filter((option) => selectedSkills.includes(option.value)).map((option) => option.label);
  const selectedNote = noteOptions.items.find((note) => note.id === form.noteId);
  const selectedResume = resumeOptions.items.find((resume) => resume.id === form.resumeId);
  const sourceLabel = form.source === 'notes'
    ? t('interviewSetup.notesSource')
    : form.source === 'resume'
      ? t('interviewSetup.resumeSource')
      : t('interviewSetup.questionBankSource');
  const stepTitles = [
    t('interviewSetup.stepCategory'),
    t('interviewSetup.stepPreferences'),
    t('interviewSetup.stepReview'),
  ];

  return (
    <main className="mx-auto max-w-4xl">
      <header className="mb-6">
        <p className="text-sm font-semibold text-primary">{t('interviewSetup.eyebrow')}</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950 dark:text-white">{t('interviewSetup.title')}</h1>
        <p className="mt-2 text-muted dark:text-muted-dark">{t('interviewSetup.description')}</p>
      </header>

      <ol aria-label={t('interviewSetup.progress')} className="mb-6 grid grid-cols-3 gap-3">
        {stepTitles.map((title, index) => (
          <li key={title} aria-current={step === index + 1 ? 'step' : undefined}>
            <div className={`h-1 rounded-full ${step >= index + 1 ? 'bg-primary' : 'bg-slate-200 dark:bg-slate-700'}`} />
            <p className="mt-2 text-xs font-medium text-muted dark:text-muted-dark">{t('interviewSetup.stepNumber', { number: index + 1 })}: {title}</p>
          </li>
        ))}
      </ol>

      {draftError && (
        <div role="alert" className="mb-4 rounded-lg border border-warning/40 bg-warning-light p-3 text-sm">
          {t('interviewSetup.draftError')} {draftError.message}
        </div>
      )}

      <Card>
        {step === 1 && (
          <section aria-labelledby="setup-step-category">
            <h2 id="setup-step-category" className="text-xl font-semibold">{t('interviewSetup.chooseCategory')}</h2>
            {options.categories.loading ? (
              <div aria-label={t('interviewSetup.loadingCategories')} className="mt-4 grid gap-3 sm:grid-cols-2">
                {Array.from({ length: 5 }, (_, index) => <Skeleton className="h-28" key={index} />)}
              </div>
            ) : options.categories.error ? (
              <ErrorState title={t('interviewSetup.optionsError')} message={options.categories.error.message} retryLabel={t('common.retry')} onRetry={() => { void options.retry('categories'); }} />
            ) : (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {categoryOptions.map((category) => {
                  const Icon = categoryIcons[category.value] || Briefcase;
                  return (
                    <ChoiceCard
                      key={category.value}
                      selected={form.category === category.value}
                      icon={Icon}
                      title={category.label === category.value ? t(`questionBank.categories.${category.value}`) : category.label}
                      description={category.description || t(`interviewSetup.categoryDescriptions.${category.value}`)}
                      onClick={() => updateForm({ category: category.value, jobRole: '', skills: [] })}
                    />
                  );
                })}
              </div>
            )}
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div>
                <Select
                  label={t('interviewSetup.jobRole')}
                  value={form.jobRole}
                  disabled={options.roles.loading || options.roles.error || !roleOptions.length}
                  options={[
                    { value: '', label: options.roles.loading ? t('interviewSetup.loadingRoles') : t('interviewSetup.selectRole') },
                    ...roleOptions,
                  ]}
                  onChange={(event) => updateForm({ jobRole: event.target.value, skills: [] })}
                />
                <QuestionOptionsError resource={options.roles} onRetry={() => { void options.retry('roles'); }} t={t} />
              </div>
              <fieldset>
                <legend className="mb-1.5 text-sm font-medium">{t('interviewSetup.skills')}</legend>
                {options.skills.loading ? <Skeleton className="h-10 w-full" /> : options.skills.error ? (
                  <QuestionOptionsError resource={options.skills} onRetry={() => { void options.retry('skills'); }} t={t} />
                ) : skillOptions.length ? (
                  <div className="max-h-44 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2 dark:border-slate-700">
                    {skillOptions.map((skill) => (
                      <Checkbox
                        key={skill.value}
                        label={skill.label}
                        checked={selectedSkills.includes(skill.value)}
                        onChange={(event) => updateForm({
                          skills: event.target.checked
                            ? [...selectedSkills, skill.value]
                            : selectedSkills.filter((value) => value !== skill.value),
                        })}
                      />
                    ))}
                  </div>
                ) : <p className="text-sm text-muted dark:text-muted-dark">{t('interviewSetup.noSkills')}</p>}
              </fieldset>
            </div>
            {stepError && <p role="alert" className="mt-4 text-sm text-danger">{stepError}</p>}
          </section>
        )}

        {step === 2 && (
          <section aria-labelledby="setup-step-preferences">
            <h2 id="setup-step-preferences" className="text-xl font-semibold">{t('interviewSetup.preferencesTitle')}</h2>
            <fieldset className="mt-5">
              <legend className="mb-2 text-sm font-medium">{t('interviewSetup.difficulty')}</legend>
              <div className="grid gap-3 sm:grid-cols-3">
                {DIFFICULTIES.map((difficulty) => (
                  <ChoiceCard
                    key={difficulty}
                    selected={form.difficulty === difficulty}
                    title={t(`questionBank.difficulties.${difficulty}`)}
                    description={t(`interviewSetup.difficultyDescriptions.${difficulty}`)}
                    onClick={() => updateForm({ difficulty })}
                  />
                ))}
              </div>
            </fieldset>
            <fieldset className="mt-5">
              <legend className="mb-2 text-sm font-medium">{t('interviewSetup.duration')}</legend>
              <div className="flex flex-wrap gap-2">
                {DURATIONS.map((duration) => (
                  <Button key={duration} variant={Number(form.duration) === duration ? 'primary' : 'secondary'} onClick={() => updateForm({ duration: String(duration) })}>
                    {t('interviewSetup.minutes', { count: duration })}
                  </Button>
                ))}
              </div>
            </fieldset>
            <fieldset className="mt-5">
              <legend className="mb-2 text-sm font-medium">{t('interviewSetup.questionCount')}</legend>
              <div className="flex flex-wrap gap-2">
                {QUESTION_COUNTS.map((count) => {
                  const disabled = availability.loading || availability.error || count > questionCountAvailable;
                  const unavailableTitle = disabled ? t('interviewSetup.countUnavailable', { count: questionCountAvailable }) : undefined;
                  return (
                    <Button
                      key={count}
                      variant={Number(form.questionCount) === count ? 'primary' : 'secondary'}
                      disabled={disabled}
                      title={unavailableTitle}
                      onClick={() => updateForm({ questionCount: String(count) })}
                    >
                      {t('interviewSetup.questionsCount', { count })}
                    </Button>
                  );
                })}
              </div>
              {availability.loading && <p role="status" className="mt-2 text-sm text-muted dark:text-muted-dark">{t('interviewSetup.checkingAvailability')}</p>}
              {availability.error && (
                <ErrorState title={t('interviewSetup.languageCheckFailed')} message={availability.error.message} retryLabel={t('common.retry')} onRetry={retryLanguageAvailability} />
              )}
            </fieldset>
            <fieldset className="mt-5">
              <legend className="mb-2 text-sm font-medium">{t('interviewSetup.style')}</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                {STYLES.map((style) => (
                  <ChoiceCard
                    key={style}
                    selected={form.style === style}
                    title={t(`interviewSetup.styles.${style}`)}
                    description={t(`interviewSetup.styleDescriptions.${style}`)}
                    onClick={() => updateForm({ style })}
                  />
                ))}
              </div>
            </fieldset>
            <fieldset className="mt-5">
              <legend className="mb-2 text-sm font-medium">{t('interviewSetup.language')}</legend>
              <p className="mb-3 text-sm text-muted dark:text-muted-dark">{t('interviewSetup.uiVsInterviewLanguage', { uiLanguage: t(`settings.language${language === 'te' ? 'Telugu' : language === 'hi' ? 'Hindi' : 'English'}`) })}</p>
              <div className="flex flex-wrap gap-3">
                {LANGUAGES.map((language) => {
                  const hasQuestions = Number(availability.counts[language] || 0) > 0;
                  const disabled = availability.loading || availability.error || !hasQuestions;
                  const title = !hasQuestions && !availability.loading
                    ? t('interviewSetup.languageUnavailable', { language: t(`questionBank.languages.${language}`) })
                    : undefined;
                  return (
                    <label key={language} title={title} className={`flex min-h-touch items-center gap-2 rounded-lg border px-3 ${disabled ? 'cursor-not-allowed opacity-55' : 'cursor-pointer'} ${form.language === language ? 'border-primary' : 'border-slate-300 dark:border-slate-600'}`}>
                      <input
                        type="radio"
                        name="language"
                        value={language}
                        checked={form.language === language}
                        disabled={disabled}
                        onChange={() => updateForm({ language })}
                      />
                      {t(`questionBank.languages.${language}`)}
                    </label>
                  );
                })}
              </div>
            </fieldset>
            {stepError && <p role="alert" className="mt-4 text-sm text-danger">{stepError}</p>}
          </section>
        )}

        {step === 3 && (
          <section aria-labelledby="setup-step-review">
            <h2 id="setup-step-review" className="text-xl font-semibold">{t('interviewSetup.reviewTitle')}</h2>
            <fieldset className="mt-5">
              <legend className="mb-2 text-sm font-medium">{t('interviewSetup.interviewMode')}</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                <ChoiceCard selected={form.mode === 'text'} title={t('interviewSetup.textMode')} onClick={() => updateForm({ mode: 'text' })} />
                <div title={!canUseVoice ? voiceUnavailableMessage : undefined}>
                  <ChoiceCard
                    selected={form.mode === 'voice'}
                    disabled={!canUseVoice}
                    title={t('interviewSetup.voiceMode')}
                    description={!canUseVoice ? voiceUnavailableMessage : t('interviewSetup.voiceDescription')}
                    onClick={() => updateForm({ mode: 'voice' })}
                  />
                </div>
              </div>
            </fieldset>
            <fieldset className="mt-5">
              <legend className="mb-2 text-sm font-medium">{t('interviewSetup.sessionType')}</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                {['practice', 'timed'].map((type) => (
                  <ChoiceCard
                    key={type}
                    selected={form.practiceType === type}
                    title={t(`interviewSetup.${type}`)}
                    description={t(`interviewSetup.${type}Description`)}
                    onClick={() => updateForm({ practiceType: type })}
                  />
                ))}
              </div>
            </fieldset>
            <fieldset className="mt-5">
              <legend className="mb-2 text-sm font-medium">{t('interviewSetup.questionSource')}</legend>
              <div className="grid gap-3 sm:grid-cols-3">
                <ChoiceCard
                  selected={form.source === 'bank'}
                  title={t('interviewSetup.questionBankSource')}
                  description={t('interviewSetup.bankSourceDescription')}
                  onClick={() => updateForm({ source: 'bank', noteId: '', resumeId: '' })}
                />
                <ChoiceCard
                  selected={form.source === 'notes'}
                  disabled={noteOptions.loading || noteOptions.items.length === 0}
                  title={t('interviewSetup.notesSource')}
                  description={t('interviewSetup.notesSourceDescription')}
                  onClick={() => updateForm({ source: 'notes', resumeId: '' })}
                />
                <div title={!canUseResume ? t('interviewSetup.resumeUnavailable') : undefined}>
                  <ChoiceCard
                    selected={form.source === 'resume'}
                    disabled={!canUseResume || resumeOptions.loading || resumeOptions.items.length === 0}
                    title={t('interviewSetup.resumeSource')}
                    description={!canUseResume ? t('interviewSetup.resumeUnavailable') : t('interviewSetup.resumeSourceDescription')}
                    onClick={() => updateForm({ source: 'resume', noteId: '' })}
                  />
                </div>
              </div>
              {noteOptions.loading && <p role="status" className="mt-3 text-sm text-muted dark:text-muted-dark">{t('interviewSetup.loadingNotes')}</p>}
              {noteOptions.error && <div role="alert" className="mt-3 text-sm text-danger">{noteOptions.error.message} <Button size="sm" variant="secondary" onClick={() => setSourceRetry((value) => value + 1)}>{t('common.retry')}</Button></div>}
              {!noteOptions.loading && !noteOptions.error && !noteOptions.items.length && <p className="mt-3 text-sm text-muted dark:text-muted-dark">{t('interviewSetup.noNotes')}</p>}
              {form.source === 'notes' && (
                <Select
                  className="mt-4"
                  label={t('interviewSetup.selectNote')}
                  value={form.noteId}
                  disabled={noteOptions.loading || !noteOptions.items.length}
                  options={[
                    { value: '', label: t('interviewSetup.chooseNote') },
                    ...noteOptions.items.map((note) => ({ value: note.id, label: note.title })),
                  ]}
                  onChange={(event) => updateForm({ noteId: event.target.value })}
                />
              )}
              {form.source === 'resume' && (
                <>
                  {!canUseResume && <p className="mt-3 text-sm text-warning">{t('interviewSetup.resumeUnavailable')}</p>}
                  {resumeOptions.error && <div role="alert" className="mt-3 text-sm text-danger">{resumeOptions.error.message} <Button size="sm" variant="secondary" onClick={() => setSourceRetry((value) => value + 1)}>{t('common.retry')}</Button></div>}
                  {canUseResume && resumeOptions.loading && <p role="status" className="mt-3 text-sm text-muted dark:text-muted-dark">{t('interviewSetup.loadingResumes')}</p>}
                  {canUseResume && !resumeOptions.loading && !resumeOptions.error && !resumeOptions.items.length && <p className="mt-3 text-sm text-muted dark:text-muted-dark">{t('interviewSetup.noResumes')}</p>}
                  <Select
                    className="mt-4"
                    label={t('interviewSetup.selectResume')}
                    value={form.resumeId}
                    disabled={!canUseResume || resumeOptions.loading || !resumeOptions.items.length}
                    options={[
                      { value: '', label: t('interviewSetup.chooseResume') },
                      ...resumeOptions.items.map((resume) => ({ value: resume.id, label: resume.originalName })),
                    ]}
                    onChange={(event) => updateForm({ resumeId: event.target.value })}
                  />
                </>
              )}
            </fieldset>
            <section aria-label={t('interviewSetup.summary')} className="mt-6 rounded-xl bg-slate-50 p-4 dark:bg-slate-800">
              <h3 className="font-semibold">{t('interviewSetup.reviewChoices')}</h3>
              <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                <SummaryItem label={t('interviewSetup.summaryCategory')} value={selectedCategory?.label || t(`questionBank.categories.${form.category}`)} />
                <SummaryItem label={t('interviewSetup.summaryRole')} value={selectedRole?.label || form.jobRole} />
                <SummaryItem label={t('interviewSetup.summarySkills')} value={selectedSkillLabels.join(', ') || t('interviewSetup.anySkill')} />
                <SummaryItem label={t('interviewSetup.summaryDifficulty')} value={t(`questionBank.difficulties.${form.difficulty}`)} />
                <SummaryItem label={t('interviewSetup.summaryDuration')} value={t('interviewSetup.minutes', { count: Number(form.duration) })} />
                <SummaryItem label={t('interviewSetup.summaryCount')} value={t('interviewSetup.questionsCount', { count: Number(form.questionCount) })} />
                <SummaryItem label={t('interviewSetup.summaryStyle')} value={t(`interviewSetup.styles.${form.style}`)} />
                <SummaryItem label={t('interviewSetup.summaryLanguage')} value={t(`questionBank.languages.${form.language}`)} />
                <SummaryItem label={t('interviewSetup.summaryMode')} value={t(`interviewSetup.${form.mode}Mode`)} />
                <SummaryItem label={t('interviewSetup.summarySession')} value={t(`interviewSetup.${form.practiceType}`)} />
                <SummaryItem label={t('interviewSetup.summarySource')} value={`${sourceLabel}${selectedNote ? ` — ${selectedNote.title}` : ''}${selectedResume ? ` — ${selectedResume.originalName}` : ''}`} />
              </dl>
            </section>
            {submitError && <p role="alert" className="mt-4 text-sm text-danger">{submitError}</p>}
          </section>
        )}

        <div className="mt-7 flex flex-wrap justify-between gap-3 border-t border-slate-200 pt-5 dark:border-slate-700">
          <Button variant="secondary" disabled={step === 1 || creating} onClick={() => { formEdited.current = true; setStep((current) => current - 1); setStepError(null); }}>
            {t('common.back')}
          </Button>
          {step < 3 ? (
            <Button loading={checking} onClick={() => { void nextStep(); }}>{t('common.next')}</Button>
          ) : (
            <Button loading={creating} onClick={() => { void submitSetup(); }}>{t('interviewSetup.createInterview')}</Button>
          )}
        </div>
      </Card>
    </main>
  );
}

function SummaryItem({ label, value }) {
  return <div><dt className="text-muted dark:text-muted-dark">{label}</dt><dd className="mt-0.5 font-medium">{value}</dd></div>;
}
