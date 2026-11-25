import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Copy, Download, FileUp, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { Pagination } from '../components/ui/Pagination';
import { Select } from '../components/ui/Select';
import { Skeleton } from '../components/ui/Skeleton';
import AdminQuestionForm from '../components/admin/AdminQuestionForm';
import { useQuestionOptions } from '../hooks/useQuestionOptions';
import { useToast } from '../components/ui/Toast';
import { useTranslation } from '../context/LanguageContext';
import { adminApi } from '../services/api/adminApi';
import { questionsApi } from '../services/api/questionsApi';
import { Difficulty, Language } from '../config/constants';
import { normalizeOptions } from '../utils/questionData';
import { validateAdminQuestion } from '../utils/adminQuestionValidation';

const PAGE_SIZE = 10;

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

function questionListFrom(fileContent) {
  const parsed = JSON.parse(fileContent);
  const items = Array.isArray(parsed) ? parsed : parsed?.questions || parsed?.items;
  if (!Array.isArray(items)) throw new Error('The JSON file must contain an array of questions.');
  return items;
}

function readTextFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('The selected file could not be read.'));
    reader.readAsText(file);
  });
}

function downloadJson(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function questionStatus(question, t) {
  return question.isActive === false ? t('admin.inactive') : t('admin.active');
}

export default function AdminQuestionsPage() {
  const { t } = useTranslation();
  const toast = useToast();
  const [filters, setFilters] = useState({
    category: '',
    jobRole: '',
    skill: '',
    difficulty: '',
    language: '',
    active: 'active',
  });
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const [listState, setListState] = useState({
    items: [],
    pagination: { page: 1, pages: 0, total: 0 },
    loading: true,
    error: null,
  });
  const [modal, setModal] = useState({ open: false, mode: 'create', question: EMPTY_QUESTION, id: null });
  const [formBusy, setFormBusy] = useState(false);
  const [formError, setFormError] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteResult, setDeleteResult] = useState(null);
  const [importProgress, setImportProgress] = useState(null);
  const [importFailures, setImportFailures] = useState([]);
  const [importBusy, setImportBusy] = useState(false);
  const fileInput = useRef(null);
  const requestId = useRef(0);
  const options = useQuestionOptions(filters.category, filters.jobRole);

  const categories = useMemo(() => normalizeOptions(options.categories.items), [options.categories.items]);
  const roles = useMemo(() => normalizeOptions(options.roles.items), [options.roles.items]);
  const skills = useMemo(() => normalizeOptions(options.skills.items), [options.skills.items]);
  const listFilters = useMemo(() => ({
    category: filters.category,
    jobRole: filters.jobRole,
    skill: filters.skill,
    difficulty: filters.difficulty,
    language: filters.language,
    search: debouncedSearch,
    page,
    limit: PAGE_SIZE,
    includeInactive: true,
    ...(filters.active !== 'all' ? { isActive: filters.active === 'active' } : {}),
  }), [debouncedSearch, filters, page]);

  const loadQuestions = useCallback(async () => {
    const id = ++requestId.current;
    setListState((current) => ({ ...current, loading: true, error: null }));
    try {
      const response = await questionsApi.list(listFilters);
      if (requestId.current !== id) return;
      setListState({
        items: response.items || [],
        pagination: response.pagination || { page: 1, pages: 1, total: response.items?.length || 0 },
        loading: false,
        error: null,
      });
    } catch (error) {
      if (requestId.current !== id) return;
      setListState((current) => ({ ...current, loading: false, error }));
    }
  }, [listFilters]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    void loadQuestions();
    return () => { requestId.current += 1; };
  }, [loadQuestions, refresh]);

  const setFilter = (key, value) => {
    setFilters((current) => ({
      ...current,
      [key]: value,
      ...(key === 'category' ? { jobRole: '', skill: '' } : {}),
      ...(key === 'jobRole' ? { skill: '' } : {}),
    }));
    setPage(1);
  };

  const openForm = (mode, question = EMPTY_QUESTION) => {
    const initialQuestion = mode === 'duplicate'
      ? { ...question, id: undefined, text: `${question.text} (${t('admin.copySuffix')})` }
      : question;
    setFormError(null);
    setModal({ open: true, mode, question: initialQuestion, id: mode === 'edit' ? question.id : null });
  };

  const closeForm = () => {
    if (formBusy) return;
    setModal((current) => ({ ...current, open: false }));
    setFormError(null);
  };

  const saveQuestion = async (question) => {
    setFormBusy(true);
    setFormError(null);
    try {
      if (modal.mode === 'edit') await adminApi.updateQuestion(modal.id, question);
      else await adminApi.createQuestion(question);
      setModal((current) => ({ ...current, open: false }));
      setPage(1);
      setRefresh((value) => value + 1);
      toast.success(t(modal.mode === 'edit' ? 'admin.questionUpdated' : 'admin.questionCreated'));
    } catch (error) {
      setFormError(error);
    } finally {
      setFormBusy(false);
    }
  };

  const deleteQuestion = async () => {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    try {
      const result = await adminApi.deleteQuestion(deleteTarget.id);
      const softDeleted = result.softDeleted === true || result.hardDeleted === false
        || result.deleted === false || result.type === 'soft';
      const hardDeleted = result.hardDeleted === true || result.deleted === true || result.type === 'hard';
      setDeleteResult({
        title: t(softDeleted ? 'admin.softDeletedTitle' : hardDeleted ? 'admin.hardDeletedTitle' : 'admin.deleteResultTitle'),
        message: result.message || t(softDeleted ? 'admin.softDeletedMessage' : hardDeleted ? 'admin.hardDeletedMessage' : 'admin.deleteResultMessage'),
      });
      setDeleteTarget(null);
      setRefresh((value) => value + 1);
    } catch (error) {
      toast.error(error.message || t('admin.deleteError'));
    } finally {
      setDeleteBusy(false);
    }
  };

  const listAllQuestions = async () => {
    const allItems = [];
    let currentPage = 1;
    let totalPages = 1;
    while (currentPage <= totalPages && currentPage <= 1000) {
      const response = await questionsApi.list({ ...listFilters, page: currentPage, limit: 500, includeInactive: true });
      allItems.push(...(response.items || []));
      totalPages = Math.max(1, Number(response.pagination?.pages) || 1);
      currentPage += 1;
    }
    return allItems;
  };

  const exportQuestions = async () => {
    try {
      const questions = await listAllQuestions();
      downloadJson({ questions }, 'talkready-questions.json');
      toast.success(t('admin.exportSuccess', { count: questions.length }));
    } catch (error) {
      toast.error(`${t('admin.exportError')} ${error.message}`);
    }
  };

  const importQuestions = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setImportFailures([]);
    setImportProgress(null);
    setImportBusy(true);
    try {
      const raw = await readTextFile(file);
      const questions = questionListFrom(raw);
      const failures = [];
      let completed = 0;
      setImportProgress({ completed, total: questions.length });
      for (let index = 0; index < questions.length; index += 1) {
        const checked = validateAdminQuestion(questions[index]);
        if (!checked.valid) {
          failures.push({ index: index + 1, message: t('admin.importInvalidQuestion') });
        } else {
          try {
            await adminApi.createQuestion(checked.question);
          } catch (error) {
            failures.push({ index: index + 1, message: error.message || t('admin.importCreateFailed') });
          }
        }
        completed += 1;
        setImportProgress({ completed, total: questions.length });
      }
      setImportFailures(failures);
      setRefresh((value) => value + 1);
      toast.success(t('admin.importComplete', { count: questions.length - failures.length, failures: failures.length }));
    } catch (error) {
      toast.error(`${t('admin.importError')} ${error.message}`);
    } finally {
      setImportBusy(false);
    }
  };

  const filterOptions = {
    categories: [{ value: '', label: t('admin.allCategories') }, ...categories],
    roles: [{ value: '', label: t('admin.allRoles') }, ...roles],
    skills: [{ value: '', label: t('admin.allSkills') }, ...skills],
    difficulties: [{ value: '', label: t('admin.allDifficulties') }, ...Object.values(Difficulty).map((value) => ({ value, label: t(`questionBank.difficulties.${value}`) }))],
    languages: [{ value: '', label: t('admin.allLanguages') }, ...Object.values(Language).map((value) => ({ value, label: t(`questionBank.languages.${value}`) }))],
  };

  return (
    <main className="mx-auto max-w-7xl">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-primary">{t('admin.eyebrow')}</p>
          <h1 className="mt-1 text-3xl font-bold">{t('admin.questionsTitle')}</h1>
          <p className="mt-2 text-muted dark:text-muted-dark">{t('admin.questionsDescription')}</p>
        </div>
        <Button onClick={() => openForm('create')}><Plus aria-hidden="true" className="h-4 w-4" />{t('admin.createQuestion')}</Button>
      </header>

      <section aria-label={t('admin.questionFilters')} className="mt-6 grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 sm:grid-cols-2 lg:grid-cols-3">
        <div className="relative">
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted" />
          <Input aria-label={t('admin.search')} className="pl-9" placeholder={t('admin.searchPlaceholder')} value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
        </div>
        <Select label={t('admin.category')} value={filters.category} options={filterOptions.categories} onChange={(event) => setFilter('category', event.target.value)} />
        <Select label={t('admin.jobRole')} value={filters.jobRole} options={filterOptions.roles} onChange={(event) => setFilter('jobRole', event.target.value)} />
        <Select label={t('admin.skill')} value={filters.skill} options={filterOptions.skills} onChange={(event) => setFilter('skill', event.target.value)} />
        <Select label={t('admin.difficulty')} value={filters.difficulty} options={filterOptions.difficulties} onChange={(event) => setFilter('difficulty', event.target.value)} />
        <Select label={t('admin.language')} value={filters.language} options={filterOptions.languages} onChange={(event) => setFilter('language', event.target.value)} />
        <Select label={t('admin.activeStatus')} value={filters.active} options={[
          { value: 'all', label: t('admin.allStatus') },
          { value: 'active', label: t('admin.active') },
          { value: 'inactive', label: t('admin.inactive') },
        ]} onChange={(event) => setFilter('active', event.target.value)} />
      </section>

      <section className="mt-4 flex flex-wrap items-center gap-3">
        <Button type="button" variant="secondary" onClick={() => { void exportQuestions(); }}><Download aria-hidden="true" className="h-4 w-4" />{t('admin.exportJson')}</Button>
        <Button type="button" variant="secondary" disabled={importBusy} onClick={() => fileInput.current?.click()}><FileUp aria-hidden="true" className="h-4 w-4" />{t('admin.importJson')}</Button>
        <input ref={fileInput} type="file" accept="application/json,.json" className="sr-only" aria-label={t('admin.importJson')} onChange={importQuestions} />
        {importProgress && (
          <div className="min-w-52 flex-1" role="status" aria-live="polite">
            <p className="mb-1 text-sm">{t('admin.importProgress', importProgress)}</p>
            <progress className="h-2 w-full accent-primary" max={importProgress.total || 1} value={importProgress.completed} />
          </div>
        )}
      </section>
      {importFailures.length > 0 && (
        <Card className="mt-4 border-danger/30">
          <h2 className="font-semibold">{t('admin.importFailures', { count: importFailures.length })}</h2>
          <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-danger">
            {importFailures.map((failure) => <li key={`${failure.index}-${failure.message}`}>{t('admin.importFailureLine', failure)} </li>)}
          </ul>
        </Card>
      )}

      <div className="mt-4" aria-live="polite">
        {listState.loading ? (
          <Card aria-label={t('admin.loadingQuestions')}><Skeleton className="h-8 w-full" /><Skeleton className="mt-3 h-24 w-full" /></Card>
        ) : listState.error ? (
          <ErrorState title={t('admin.questionsError')} message={listState.error.message} retryLabel={t('common.retry')} onRetry={() => { void loadQuestions(); }} />
        ) : listState.items.length ? (
          <Card className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[68rem] text-left text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800">
                  <tr>{['questionText', 'category', 'jobRole', 'skill', 'difficulty', 'language', 'activeStatus', 'actions'].map((key) => (
                    <th key={key} scope="col" className="px-3 py-3 font-semibold">{t(`admin.${key}`)}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {listState.items.map((question) => (
                    <tr key={question.id} className="border-t border-slate-100 align-top dark:border-slate-800">
                      <td className="max-w-sm px-3 py-3"><p className="line-clamp-3">{question.text}</p></td>
                      <td className="px-3 py-3">{question.category}</td>
                      <td className="px-3 py-3">{question.jobRole}</td>
                      <td className="px-3 py-3">{question.skill}</td>
                      <td className="px-3 py-3">{t(`questionBank.difficulties.${question.difficulty}`)}</td>
                      <td className="px-3 py-3">{t(`questionBank.languages.${question.language}`)}</td>
                      <td className="px-3 py-3"><Badge tone={question.isActive === false ? 'warning' : 'success'}>{questionStatus(question, t)}</Badge></td>
                      <td className="px-3 py-3">
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" aria-label={t('admin.editQuestion', { question: question.text })} onClick={() => openForm('edit', question)}><Pencil aria-hidden="true" className="h-4 w-4" /></Button>
                          <Button size="sm" variant="ghost" aria-label={t('admin.duplicateQuestion', { question: question.text })} onClick={() => openForm('duplicate', question)}><Copy aria-hidden="true" className="h-4 w-4" /></Button>
                          <Button size="sm" variant="ghost" aria-label={t('admin.deleteQuestion', { question: question.text })} onClick={() => setDeleteTarget(question)}><Trash2 aria-hidden="true" className="h-4 w-4 text-danger" /></Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t border-slate-100 p-4 dark:border-slate-800">
              <Pagination page={listState.pagination.page || page} pages={listState.pagination.pages} onPageChange={setPage} label={t('admin.pagination')} previousLabel={t('common.previous')} nextLabel={t('common.next')} pageLabel={t('common.pageOf', { page: '{page}', pages: '{pages}' })} />
            </div>
          </Card>
        ) : (
          <EmptyState title={t('admin.noQuestions')} description={t('admin.noQuestionsDescription')} actionLabel={t('admin.createQuestion')} onAction={() => openForm('create')} />
        )}
      </div>

      <Modal open={modal.open} onClose={closeForm} title={t(modal.mode === 'edit' ? 'admin.editQuestionTitle' : modal.mode === 'duplicate' ? 'admin.duplicateQuestionTitle' : 'admin.createQuestionTitle')} description={t('admin.questionFormDescription')} closeLabel={t('common.close')} className="max-w-5xl">
        <AdminQuestionForm initialQuestion={modal.question} busy={formBusy} apiError={formError} onCancel={closeForm} onSave={saveQuestion} />
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => !deleteBusy && setDeleteTarget(null)}
        onConfirm={() => { void deleteQuestion(); }}
        title={t('admin.deleteQuestionTitle')}
        description={t('admin.deleteQuestionDescription', { question: deleteTarget?.text || '' })}
        confirmLabel={t('admin.deleteConfirm')}
        cancelLabel={t('common.cancel')}
        loading={deleteBusy}
      />

      <Modal open={Boolean(deleteResult)} onClose={() => setDeleteResult(null)} title={deleteResult?.title || ''} description={deleteResult?.message} closeLabel={t('common.close')}>
        <div className="flex justify-end"><Button onClick={() => setDeleteResult(null)}>{t('common.close')}</Button></div>
      </Modal>
    </main>
  );
}
