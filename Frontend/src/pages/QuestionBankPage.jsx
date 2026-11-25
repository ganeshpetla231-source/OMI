import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Dices, Search } from 'lucide-react';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { Pagination } from '../components/ui/Pagination';
import { Select } from '../components/ui/Select';
import { Skeleton } from '../components/ui/Skeleton';
import { Textarea } from '../components/ui/Textarea';
import { useQuestionOptions } from '../hooks/useQuestionOptions';
import { useTranslation } from '../context/LanguageContext';
import { questionsApi } from '../services/api/questionsApi';
import { normalizeOptions } from '../utils/questionData';
import { ROUTES } from '../config/routes';

const PAGE_SIZE = 8;
const difficulties = ['beginner', 'intermediate', 'advanced'];
const languages = ['en', 'te', 'hi'];

function categoryLabel(t, category) {
  return t(`questionBank.categories.${category}`);
}

function QuestionCard({ question, onView, t }) {
  return (
    <Card className="flex h-full flex-col">
      <p className="font-medium leading-6 text-slate-950 dark:text-white">{question.text}</p>
      <ul className="mt-4 flex flex-wrap gap-2">
        <li><Badge tone="primary">{categoryLabel(t, question.category)}</Badge></li>
        {question.jobRole && <li><Badge>{question.jobRole}</Badge></li>}
        {question.difficulty && <li><Badge tone="neutral">{t(`questionBank.difficulties.${question.difficulty}`)}</Badge></li>}
        {question.skill && <li><Badge tone="success">{question.skill}</Badge></li>}
      </ul>
      <Button className="mt-auto self-start pt-4" variant="ghost" onClick={() => onView(question)}>
        {t('questionBank.view')}
      </Button>
    </Card>
  );
}

export default function QuestionBankPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [filters, setFilters] = useState({ category: '', jobRole: '', skill: '', difficulty: '', language: '' });
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState({ items: [], pagination: { page: 1, pages: 0, total: 0 }, loading: true, error: null, offline: false });
  const [retryCount, setRetryCount] = useState(0);
  const [questionDetails, setQuestionDetails] = useState({ item: null, loading: false, error: null });
  const [randomQuestion, setRandomQuestion] = useState(null);
  const [practiceError, setPracticeError] = useState(null);
  const [practiceLoading, setPracticeLoading] = useState(false);
  const [practiceAnswer, setPracticeAnswer] = useState('');
  const requestId = useRef(0);
  const detailRequestId = useRef(0);
  const options = useQuestionOptions(filters.category, filters.jobRole);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const id = ++requestId.current;
    setResult((current) => ({ ...current, loading: true, error: null }));
    questionsApi.list({ ...filters, search: debouncedSearch, page, limit: PAGE_SIZE })
      .then((response) => {
        if (requestId.current !== id) return;
        setResult({ ...response, loading: false, error: null });
      })
      .catch((error) => {
        if (requestId.current !== id) return;
        setResult((current) => ({ ...current, loading: false, error }));
      });
    return () => { requestId.current += 1; };
  }, [filters, debouncedSearch, page, retryCount]);

  const categoryOptions = useMemo(() => normalizeOptions(options.categories.items), [options.categories.items]);
  const roleOptions = useMemo(() => normalizeOptions(options.roles.items), [options.roles.items]);
  const skillOptions = useMemo(() => normalizeOptions(options.skills.items), [options.skills.items]);
  const filterOptions = {
    category: [{ value: '', label: t('questionBank.allCategories') }, ...categoryOptions.map((option) => ({
      ...option,
      label: option.label === option.value ? categoryLabel(t, option.value) : option.label,
    }))],
    jobRole: [{ value: '', label: t('questionBank.allRoles') }, ...roleOptions],
    skill: [{ value: '', label: t('questionBank.allSkills') }, ...skillOptions],
    difficulty: [{ value: '', label: t('questionBank.allDifficulties') }, ...difficulties.map((value) => ({ value, label: t(`questionBank.difficulties.${value}`) }))],
    language: [{ value: '', label: t('questionBank.allLanguages') }, ...languages.map((value) => ({ value, label: t(`questionBank.languages.${value}`) }))],
  };
  const offline = result.offline || options.categories.offline || options.roles.offline || options.skills.offline;

  const updateFilter = (key, value) => {
    setFilters((current) => ({
      ...current,
      [key]: value,
      ...(key === 'category' ? { jobRole: '', skill: '' } : {}),
      ...(key === 'jobRole' ? { skill: '' } : {}),
    }));
    setPage(1);
  };

  const loadRandomQuestion = async () => {
    setPracticeLoading(true);
    setPracticeError(null);
    setRandomQuestion(null);
    try {
      const response = await questionsApi.random({ ...filters, search: debouncedSearch, count: 1 });
      if (!response.items[0]) {
        setRandomQuestion(null);
        setPracticeError(new Error(t('questionBank.noRandomQuestion')));
        return;
      }
      setRandomQuestion(response.items[0]);
      setPracticeAnswer('');
      if (response.offline) setResult((current) => ({ ...current, offline: true }));
    } catch (error) {
      setPracticeError(error);
    } finally {
      setPracticeLoading(false);
    }
  };

  const openQuestion = async (question) => {
    const id = ++detailRequestId.current;
    setQuestionDetails({ item: question, loading: true, error: null });
    try {
      const response = await questionsApi.getById(question.id);
      if (detailRequestId.current !== id) return;
      setQuestionDetails({ item: response.item, loading: false, error: null });
      if (response.offline) setResult((current) => ({ ...current, offline: true }));
    } catch (error) {
      if (detailRequestId.current !== id) return;
      setQuestionDetails({ item: question, loading: false, error });
    }
  };

  const retryQuestionDetails = () => {
    if (questionDetails.item) void openQuestion(questionDetails.item);
  };

  const closeQuestionDetails = () => {
    detailRequestId.current += 1;
    setQuestionDetails({ item: null, loading: false, error: null });
  };

  const practiceWithFilters = () => {
    navigate(ROUTES.INTERVIEW_SETUP, {
      state: {
        ...filters,
        jobRole: filters.jobRole,
        skills: filters.skill ? [filters.skill] : [],
      },
    });
  };

  const optionErrors = [options.categories.error, options.roles.error, options.skills.error].filter(Boolean);

  return (
    <main className="mx-auto max-w-7xl">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <BookOpen aria-hidden="true" className="h-6 w-6 text-primary" />
            <h1 className="text-3xl font-bold tracking-tight text-slate-950 dark:text-white">{t('questionBank.title')}</h1>
          </div>
          <p className="mt-2 max-w-2xl text-muted dark:text-muted-dark">{t('questionBank.description')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {offline && <Badge tone="warning" role="status">{t('questionBank.offlineBadge')}</Badge>}
          <Button variant="secondary" onClick={practiceWithFilters}>{t('questionBank.practiceFilters')}</Button>
          <Button onClick={loadRandomQuestion} loading={practiceLoading}>
            <Dices aria-hidden="true" className="h-4 w-4" />{t('questionBank.random')}
          </Button>
        </div>
      </header>

      <section aria-label={t('questionBank.filters')} className="mt-6 grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 sm:grid-cols-2 lg:grid-cols-3">
        <div className="relative">
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted" />
          <Input
            aria-label={t('questionBank.search')}
            className="pl-9"
            placeholder={t('questionBank.searchPlaceholder')}
            value={search}
            onChange={(event) => { setSearch(event.target.value); setPage(1); }}
          />
        </div>
        <Select label={t('questionBank.category')} options={filterOptions.category} value={filters.category} onChange={(event) => updateFilter('category', event.target.value)} />
        <Select label={t('questionBank.role')} options={filterOptions.jobRole} value={filters.jobRole} onChange={(event) => updateFilter('jobRole', event.target.value)} />
        <Select label={t('questionBank.skill')} options={filterOptions.skill} value={filters.skill} onChange={(event) => updateFilter('skill', event.target.value)} />
        <Select label={t('questionBank.difficulty')} options={filterOptions.difficulty} value={filters.difficulty} onChange={(event) => updateFilter('difficulty', event.target.value)} />
        <Select label={t('questionBank.language')} options={filterOptions.language} value={filters.language} onChange={(event) => updateFilter('language', event.target.value)} />
      </section>

      {optionErrors.length > 0 && (
        <div role="alert" className="mt-4 rounded-xl border border-danger/30 bg-danger-light p-4 text-sm text-danger">
          <p>{t('questionBank.optionsError')}</p>
          <Button className="mt-2" size="sm" variant="secondary" onClick={() => {
            if (options.categories.error) void options.retry('categories');
            if (options.roles.error) void options.retry('roles');
            if (options.skills.error) void options.retry('skills');
          }}>{t('common.retry')}</Button>
        </div>
      )}

      {practiceError && <ErrorState title={t('questionBank.randomErrorTitle')} message={practiceError.message} retryLabel={t('common.retry')} onRetry={loadRandomQuestion} />}
      {result.loading ? (
        <section aria-label={t('questionBank.loading')} className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => <Card key={index}><Skeleton className="h-5 w-full" /><Skeleton className="mt-3 h-5 w-3/4" /><Skeleton className="mt-6 h-8 w-24" /></Card>)}
        </section>
      ) : result.error ? (
        <ErrorState title={t('questionBank.loadErrorTitle')} message={result.error.message} retryLabel={t('common.retry')} onRetry={() => setRetryCount((count) => count + 1)} />
      ) : result.items.length ? (
        <>
          <section aria-label={t('questionBank.results')} className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {result.items.map((question) => (
              <QuestionCard key={question.id} question={question} onView={openQuestion} t={t} />
            ))}
          </section>
          <div className="mt-6">
            <Pagination
              page={result.pagination.page || page}
              pages={result.pagination.pages}
              onPageChange={setPage}
              label={t('questionBank.pagination')}
              previousLabel={t('common.previous')}
              nextLabel={t('common.next')}
              pageLabel={t('common.pageOf', { page: '{page}', pages: '{pages}' })}
            />
          </div>
        </>
      ) : (
        <EmptyState title={t('questionBank.emptyTitle')} description={t('questionBank.emptyDescription')} />
      )}

      {randomQuestion && (
        <Card className="mt-6 border-primary/30">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-primary">{t('questionBank.practicePrompt')}</p>
              <h2 className="mt-2 text-lg font-semibold">{randomQuestion.text}</h2>
            </div>
            <Button variant="secondary" onClick={loadRandomQuestion} loading={practiceLoading}>{t('questionBank.randomAnother')}</Button>
          </div>
          <Textarea
            className="mt-4"
            label={t('questionBank.practiceAnswer')}
            hint={t('questionBank.noScoring')}
            value={practiceAnswer}
            onChange={(event) => setPracticeAnswer(event.target.value)}
          />
        </Card>
      )}

      <Modal
        open={Boolean(questionDetails.item)}
        onClose={closeQuestionDetails}
        title={t('questionBank.detailsTitle')}
        description={questionDetails.item?.text}
        closeLabel={t('common.close')}
      >
        {questionDetails.loading ? (
          <div aria-label={t('questionBank.loadingDetails')}><Skeleton className="h-5 w-full" /><Skeleton className="mt-4 h-20 w-full" /></div>
        ) : questionDetails.error ? (
          <ErrorState title={t('questionBank.detailsErrorTitle')} message={questionDetails.error.message} retryLabel={t('common.retry')} onRetry={retryQuestionDetails} />
        ) : questionDetails.item && (
          <div className="space-y-4 text-sm">
            <p><strong>{t('questionBank.expectedAnswer')}:</strong> {questionDetails.item.expectedAnswer || t('questionBank.notProvided')}</p>
            <p><strong>{t('questionBank.timeLimit')}:</strong> {t('questionBank.seconds', { seconds: questionDetails.item.timeLimitSeconds || 0 })}</p>
            <div>
              <h3 className="font-semibold">{t('questionBank.keywords')}</h3>
              <ul className="mt-2 flex flex-wrap gap-2">
                {(questionDetails.item.keywords || []).map((keyword) => <li key={keyword}><Badge>{keyword}</Badge></li>)}
                {!questionDetails.item.keywords?.length && <li>{t('questionBank.notProvided')}</li>}
              </ul>
            </div>
            <div>
              <h3 className="font-semibold">{t('questionBank.tags')}</h3>
              <ul className="mt-2 flex flex-wrap gap-2">
                {(questionDetails.item.tags || []).map((tag) => <li key={tag}><Badge tone="primary">{tag}</Badge></li>)}
                {!questionDetails.item.tags?.length && <li>{t('questionBank.notProvided')}</li>}
              </ul>
            </div>
          </div>
        )}
      </Modal>
    </main>
  );
}
