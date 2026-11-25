import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { Modal } from '../components/ui/Modal';
import { Skeleton } from '../components/ui/Skeleton';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/LanguageContext';
import { ROUTES } from '../config/routes';
import { questionsApi } from '../services/api/questionsApi';
import { resumesApi } from '../services/api/resumesApi';
import { validateResumeFile } from '../utils/resumeValidation';

function extractionValues(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    if (typeof item === 'string') return item;
    return [item.title, item.degree, item.name, item.institution, item.organization, item.description]
      .filter(Boolean)
      .join(' — ');
  }).filter(Boolean);
}

function ExtractionSection({ title, values, emptyLabel }) {
  return (
    <section>
      <h3 className="font-semibold">{title}</h3>
      {values.length ? (
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{values.map((value, index) => <li key={`${value}-${index}`}>{value}</li>)}</ul>
      ) : <p className="mt-1 text-sm text-muted dark:text-muted-dark">{emptyLabel}</p>}
    </section>
  );
}

export default function ResumePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isAuthenticated, isGuest } = useAuth();
  const fileInput = useRef(null);
  const [online, setOnline] = useState(() => navigator.onLine);
  const [resumes, setResumes] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [detailError, setDetailError] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadError, setUploadError] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [generated, setGenerated] = useState({ resume: null, items: [], loading: false, error: null });
  const canManage = Boolean(isAuthenticated && !isGuest && online);

  const loadResumes = async () => {
    if (!canManage) return;
    setLoading(true);
    setLoadError(null);
    try {
      const items = await resumesApi.list();
      setResumes(items);
      setSelected((current) => current ? items.find((item) => item.id === current.id) || null : null);
    } catch (error) {
      setLoadError(error);
    } finally {
      setLoading(false);
    }
  };

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
    if (canManage) void loadResumes();
    else {
      setResumes([]);
      setSelected(null);
    }
  }, [canManage]);

  const upload = async (file) => {
    if (!file) return;
    const validation = validateResumeFile(file);
    if (!validation.valid) {
      setUploadError(t(`resume.validation.${validation.reason}`));
      return;
    }
    if (!canManage) {
      setUploadError(!online ? t('resume.internetRequired') : t('resume.accountRequired'));
      return;
    }
    setUploading(true);
    setUploadError(null);
    setProgress(0);
    try {
      const resume = await resumesApi.upload(file, setProgress);
      setResumes((current) => [resume, ...current.filter((item) => item.id !== resume.id)]);
      setSelected(resume);
    } catch (error) {
      setUploadError(error.message || t('resume.uploadError'));
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const openResume = async (resume) => {
    setDetailError(null);
    setSelected(resume);
    try {
      setSelected(await resumesApi.get(resume.id));
    } catch (error) {
      setDetailError(error);
    }
  };

  const removeResume = async () => {
    if (!deleting) return;
    try {
      await resumesApi.remove(deleting.id);
      setResumes((current) => current.filter((resume) => resume.id !== deleting.id));
      if (selected?.id === deleting.id) setSelected(null);
      setDeleting(null);
    } catch (error) {
      setDeleting({ ...deleting, error });
    }
  };

  const generateQuestions = async (resume) => {
    setGenerated({ resume, items: [], loading: true, error: null });
    try {
      const response = await questionsApi.generate({ resumeId: resume.id, count: 5 });
      setGenerated({ resume, items: response.items || [], loading: false, error: null });
    } catch (error) {
      setGenerated({ resume, items: [], loading: false, error });
    }
  };

  const practiceQuestions = () => {
    navigate(ROUTES.INTERVIEW_SETUP, { state: { source: 'resume', resumeId: generated.resume.id } });
  };

  const statusKey = `resume.status.${selected?.extractionStatus || 'pending'}`;
  const extracted = selected?.extracted || {};

  return (
    <main className="mx-auto max-w-7xl">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-slate-950 dark:text-white">{t('resume.title')}</h1>
        <p className="mt-2 max-w-2xl text-muted dark:text-muted-dark">{t('resume.description')}</p>
      </header>

      {!isAuthenticated || isGuest ? (
        <Card className="mt-6">
          <h2 className="text-lg font-semibold">{t('resume.accountRequiredTitle')}</h2>
          <p className="mt-2 text-sm text-muted dark:text-muted-dark">{t('resume.accountRequired')}</p>
          <Link className="mt-4 inline-flex min-h-touch items-center rounded-lg bg-primary px-4 font-medium text-white hover:bg-primary-hover" to={ROUTES.LOGIN}>{t('resume.signIn')}</Link>
        </Card>
      ) : !online ? (
        <Card className="mt-6" role="status">
          <h2 className="text-lg font-semibold">{t('resume.internetRequiredTitle')}</h2>
          <p className="mt-2 text-sm text-muted dark:text-muted-dark">{t('resume.internetRequired')}</p>
        </Card>
      ) : (
        <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(18rem,0.8fr)_minmax(0,1.2fr)]">
          <section aria-label={t('resume.uploadSection')}>
            <Card
              className={`border-dashed ${dragging ? 'border-primary bg-primary-light dark:bg-indigo-950' : ''}`}
              onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
              onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setDragging(false); }}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                void upload(event.dataTransfer.files?.[0]);
              }}
            >
              <h2 className="text-lg font-semibold">{t('resume.uploadTitle')}</h2>
              <p className="mt-2 text-sm text-muted dark:text-muted-dark">{t('resume.uploadHint')}</p>
              <input ref={fileInput} className="sr-only" type="file" accept=".pdf,.doc,.docx" aria-label={t('resume.chooseFile')} onChange={(event) => { void upload(event.target.files?.[0]); }} />
              <Button className="mt-4" disabled={uploading} onClick={() => fileInput.current?.click()}>{t('resume.chooseFile')}</Button>
              {uploading && (
                <div className="mt-4" role="status">
                  <p className="text-sm">{t('resume.uploading', { progress })}</p>
                  <progress className="mt-2 w-full" max="100" value={progress} aria-label={t('resume.uploadProgress', { progress })} />
                </div>
              )}
              {uploadError && <p role="alert" className="mt-3 text-sm text-danger">{uploadError}</p>}
              <p className="mt-4 text-xs text-muted dark:text-muted-dark">{t('resume.serverValidation')}</p>
            </Card>

            <section className="mt-6" aria-label={t('resume.listTitle')}>
              <h2 className="mb-3 text-lg font-semibold">{t('resume.listTitle')}</h2>
              {loading ? (
                <div aria-label={t('resume.loading')} className="space-y-3">{Array.from({ length: 3 }, (_, index) => <Card key={index}><Skeleton className="h-5 w-3/4" /><Skeleton className="mt-3 h-4 w-1/2" /></Card>)}</div>
              ) : loadError ? (
                <ErrorState title={t('resume.loadError')} message={loadError.message} retryLabel={t('common.retry')} onRetry={() => { void loadResumes(); }} />
              ) : resumes.length ? (
                <ul className="space-y-3">
                  {resumes.map((resume) => (
                    <li key={resume.id}>
                      <Card className={selected?.id === resume.id ? 'border-primary' : ''}>
                        <div className="flex items-start justify-between gap-3">
                          <button type="button" className="text-left" onClick={() => { void openResume(resume); }}>
                            <span className="font-medium">{resume.originalName}</span>
                            <span className="mt-1 block text-xs text-muted dark:text-muted-dark">{t('resume.fileSize', { size: (resume.sizeBytes / (1024 * 1024)).toFixed(2) })}</span>
                          </button>
                          <Button variant="ghost" size="sm" onClick={() => setDeleting(resume)}>{t('common.delete')}</Button>
                        </div>
                      </Card>
                    </li>
                  ))}
                </ul>
              ) : <EmptyState title={t('resume.emptyTitle')} description={t('resume.emptyDescription')} />}
            </section>
          </section>

          <section aria-label={t('resume.detailsTitle')}>
            {detailError ? (
              <ErrorState title={t('resume.loadError')} message={detailError.message} retryLabel={t('common.retry')} onRetry={() => { if (selected) void openResume(selected); }} />
            ) : selected ? (
              <Card>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold">{selected.originalName}</h2>
                    <p className="mt-1 text-sm text-muted dark:text-muted-dark">{t(statusKey)}</p>
                    {selected.isMock && <Badge className="mt-2" tone="warning">{t('resume.mockExtraction')}</Badge>}
                  </div>
                  <Badge tone={selected.extractionStatus === 'completed' ? 'success' : selected.extractionStatus === 'failed' ? 'danger' : 'warning'}>{t(`resume.statusName.${selected.extractionStatus || 'pending'}`)}</Badge>
                </div>
                <div className="mt-6 space-y-5">
                  <ExtractionSection title={t('resume.education')} values={extractionValues(extracted.education)} emptyLabel={t('resume.noExtractedItems')} />
                  <div>
                    <h3 className="font-semibold">{t('resume.skills')}</h3>
                    {extractionValues(extracted.skills).length ? (
                      <ul className="mt-2 flex flex-wrap gap-2">{extractionValues(extracted.skills).map((skill) => <li key={skill}><Badge tone="primary">{skill}</Badge></li>)}</ul>
                    ) : <p className="mt-1 text-sm text-muted dark:text-muted-dark">{t('resume.noExtractedItems')}</p>}
                  </div>
                  <ExtractionSection title={t('resume.projects')} values={extractionValues(extracted.projects)} emptyLabel={t('resume.noExtractedItems')} />
                  <ExtractionSection title={t('resume.experience')} values={extractionValues(extracted.experience)} emptyLabel={t('resume.noExtractedItems')} />
                </div>
                <Button className="mt-6" disabled={!['completed', 'partial'].includes(selected.extractionStatus) || !extractionValues(extracted.skills).length} onClick={() => { void generateQuestions(selected); }}>
                  {t('resume.generateQuestions')}
                </Button>
              </Card>
            ) : <EmptyState title={t('resume.detailsTitle')} description={t('resume.selectResume')} />}
          </section>
        </div>
      )}

      <Modal open={Boolean(deleting)} onClose={() => setDeleting(null)} title={t('resume.deleteTitle')} description={t('resume.deleteConfirm', { name: deleting?.originalName || '' })} closeLabel={t('common.close')}>
        {deleting?.error && <p role="alert" className="mb-3 text-sm text-danger">{deleting.error.message}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setDeleting(null)}>{t('common.cancel')}</Button>
          <Button variant="danger" onClick={() => { void removeResume(); }}>{t('common.delete')}</Button>
        </div>
      </Modal>

      <Modal open={Boolean(generated.resume)} onClose={() => setGenerated({ resume: null, items: [], loading: false, error: null })} title={t('resume.generatedTitle')} closeLabel={t('common.close')}>
        {generated.loading ? <div aria-label={t('resume.generating')}><Skeleton className="h-5 w-full" /><Skeleton className="mt-3 h-16 w-full" /></div> : generated.error ? (
          <ErrorState title={t('resume.generateError')} message={generated.error.message} retryLabel={t('common.retry')} onRetry={() => { void generateQuestions(generated.resume); }} />
        ) : (
          <>
            <ol className="list-decimal space-y-3 pl-5 text-sm">{generated.items.map((question) => <li key={question.id}>{question.text}</li>)}</ol>
            {!generated.items.length && <p className="text-sm text-muted">{t('resume.noGeneratedQuestions')}</p>}
            <Button className="mt-5" disabled={!generated.items.length} onClick={practiceQuestions}>{t('resume.practiceGenerated')}</Button>
          </>
        )}
      </Modal>
    </main>
  );
}
