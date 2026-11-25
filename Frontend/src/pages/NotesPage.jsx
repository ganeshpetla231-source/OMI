import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { useTranslation } from '../context/LanguageContext';
import { notesApi } from '../services/api/notesApi';
import { questionsApi } from '../services/api/questionsApi';
import { getNoteDraft, removeNoteDraft, saveNoteDraft } from '../services/offline/localNotes';
import { ROUTES } from '../config/routes';

const PAGE_SIZE = 8;
const MAX_NOTE_CHARACTERS = 20000;

function NoteEditor({ note, onClose, onSave, t }) {
  const [form, setForm] = useState({
    title: note?.title || '',
    topic: note?.topic || '',
    tags: (note?.tags || []).join(', '),
    content: note?.content || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    getNoteDraft(note?.id || 'new').then((draft) => {
      if (active && draft) {
        setForm((current) => ({
          title: draft.title ?? current.title,
          topic: draft.topic ?? current.topic,
          tags: Array.isArray(draft.tags) ? draft.tags.join(', ') : draft.tags ?? current.tags,
          content: draft.content ?? current.content,
        }));
      }
    }).catch((draftError) => {
      if (active) setError(draftError);
    });
    return () => { active = false; };
  }, [note?.id]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void saveNoteDraft(note?.id || 'new', {
        ...form,
        tags: form.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
      }).catch(setError);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [form, note?.id]);

  const update = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
    setError(null);
  };

  const save = async (event) => {
    event.preventDefault();
    if (!form.title.trim()) {
      setError(new Error(t('notes.titleRequired')));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        ...form,
        title: form.title.trim(),
        topic: form.topic.trim(),
        tags: form.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
      };
      await onSave(note?.id, payload);
      await removeNoteDraft(note?.id || 'new');
    } catch (saveError) {
      setError(saveError);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={(event) => { void save(event); }} className="space-y-4">
      <Input label={t('notes.noteTitle')} value={form.title} maxLength={160} onChange={(event) => update('title', event.target.value)} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label={t('notes.topic')} value={form.topic} maxLength={80} onChange={(event) => update('topic', event.target.value)} />
        <Input label={t('notes.tags')} hint={t('notes.tagsHint')} value={form.tags} onChange={(event) => update('tags', event.target.value)} />
      </div>
      <Textarea
        label={t('notes.content')}
        value={form.content}
        maxLength={MAX_NOTE_CHARACTERS}
        onChange={(event) => update('content', event.target.value)}
        hint={t('notes.characterCount', { count: form.content.length, max: MAX_NOTE_CHARACTERS })}
      />
      {error && <p role="alert" className="text-sm text-danger">{error.message}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
        <Button type="submit" loading={saving}>{t('notes.save')}</Button>
      </div>
    </form>
  );
}

export default function NotesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [result, setResult] = useState({ items: [], pagination: { page: 1, pages: 0, total: 0 }, loading: true, error: null });
  const [topics, setTopics] = useState([]);
  const [search, setSearch] = useState('');
  const [topic, setTopic] = useState('');
  const [page, setPage] = useState(1);
  const [retry, setRetry] = useState(0);
  const [editor, setEditor] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [generated, setGenerated] = useState({ note: null, items: [], loading: false, error: null });

  const loadNotes = useCallback(() => {
    setResult((current) => ({ ...current, loading: true, error: null }));
    Promise.all([
      notesApi.list({ search, topic, page, limit: PAGE_SIZE }),
      notesApi.list({ page: 1, limit: 100 }),
    ]).then(([response, all]) => {
      setResult({ ...response, loading: false, error: null });
      setTopics([...new Set(all.items.map((note) => note.topic).filter(Boolean))].sort());
    }).catch((error) => setResult((current) => ({ ...current, loading: false, error })));
  }, [page, search, topic]);

  useEffect(() => {
    loadNotes();
  }, [loadNotes, retry]);

  const topicOptions = useMemo(() => [
    { value: '', label: t('notes.allTopics') },
    ...topics.map((value) => ({ value, label: value })),
  ], [topics, t]);

  const saveNote = async (id, payload) => {
    if (id) await notesApi.update(id, payload);
    else await notesApi.create(payload);
    setEditor(null);
    setPage(1);
    setRetry((value) => value + 1);
  };

  const deleteNote = async () => {
    if (!deleting) return;
    try {
      await notesApi.remove(deleting.id);
      setDeleting(null);
      if (viewing?.id === deleting.id) setViewing(null);
      setRetry((value) => value + 1);
    } catch (error) {
      setDeleting({ ...deleting, error });
    }
  };

  const generateQuestions = async (note) => {
    setGenerated({ note, items: [], loading: true, error: null });
    try {
      const response = await questionsApi.generate({ noteId: note.id, count: 5 });
      setGenerated({ note, items: response.items || [], loading: false, error: null });
    } catch (error) {
      setGenerated({ note, items: [], loading: false, error });
    }
  };

  const practiceQuestions = () => {
    navigate(ROUTES.INTERVIEW_SETUP, { state: { source: 'notes', noteId: generated.note.id } });
  };

  return (
    <main className="mx-auto max-w-7xl">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-950 dark:text-white">{t('notes.title')}</h1>
          <p className="mt-2 max-w-2xl text-muted dark:text-muted-dark">{t('notes.description')}</p>
        </div>
        <Button onClick={() => setEditor({ note: null })}>{t('notes.create')}</Button>
      </header>

      <section aria-label={t('notes.filters')} className="mt-6 grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 sm:grid-cols-2">
        <Input label={t('notes.search')} value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
        <Select label={t('notes.topicFilter')} value={topic} options={topicOptions} onChange={(event) => { setTopic(event.target.value); setPage(1); }} />
      </section>

      {result.loading ? (
        <section aria-label={t('notes.loading')} className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => <Card key={index}><Skeleton className="h-5 w-2/3" /><Skeleton className="mt-4 h-16 w-full" /></Card>)}
        </section>
      ) : result.error ? (
        <ErrorState title={t('notes.loadError')} message={result.error.message} retryLabel={t('common.retry')} onRetry={() => setRetry((value) => value + 1)} />
      ) : result.items.length ? (
        <>
          <section aria-label={t('notes.list')} className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {result.items.map((note) => (
              <Card key={note.id} className="flex flex-col">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="font-semibold">{note.title}</h2>
                  {note.syncStatus === 'pending' && <Badge tone="warning">{t('notes.waitingToSync')}</Badge>}
                  {note.syncStatus === 'failed' && <Badge tone="danger">{t('notes.syncFailed')}</Badge>}
                </div>
                <p className="mt-2 line-clamp-3 text-sm text-muted dark:text-muted-dark">{note.content}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {note.topic && <Badge tone="primary">{note.topic}</Badge>}
                  {(note.tags || []).map((tag) => <Badge key={tag}>{tag}</Badge>)}
                </div>
                <div className="mt-auto flex flex-wrap gap-2 pt-4">
                  <Button variant="secondary" size="sm" onClick={() => setViewing(note)}>{t('notes.view')}</Button>
                  <Button variant="ghost" size="sm" onClick={() => setEditor({ note })}>{t('notes.edit')}</Button>
                  <Button variant="ghost" size="sm" onClick={() => setDeleting(note)}>{t('common.delete')}</Button>
                </div>
              </Card>
            ))}
          </section>
          <div className="mt-6">
            <Pagination
              page={result.pagination.page || page}
              pages={result.pagination.pages}
              onPageChange={setPage}
              label={t('notes.pagination')}
              previousLabel={t('common.previous')}
              nextLabel={t('common.next')}
              pageLabel={t('common.pageOf', { page: '{page}', pages: '{pages}' })}
            />
          </div>
        </>
      ) : (
        <EmptyState title={t('notes.emptyTitle')} description={t('notes.emptyDescription')} action={<Button onClick={() => setEditor({ note: null })}>{t('notes.create')}</Button>} />
      )}

      <Modal open={Boolean(editor)} onClose={() => setEditor(null)} title={editor?.note ? t('notes.editTitle') : t('notes.createTitle')} closeLabel={t('common.close')}>
        {editor && <NoteEditor note={editor.note} onClose={() => setEditor(null)} onSave={saveNote} t={t} />}
      </Modal>

      <Modal open={Boolean(viewing)} onClose={() => setViewing(null)} title={viewing?.title || t('notes.view')} closeLabel={t('common.close')}>
        {viewing && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">{viewing.topic && <Badge tone="primary">{viewing.topic}</Badge>}{(viewing.tags || []).map((tag) => <Badge key={tag}>{tag}</Badge>)}</div>
            <p className="whitespace-pre-wrap text-sm">{viewing.content}</p>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="secondary" onClick={() => { setEditor({ note: viewing }); setViewing(null); }}>{t('notes.edit')}</Button>
              <Button onClick={() => { void generateQuestions(viewing); setViewing(null); }}>{t('notes.generateQuestions')}</Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={Boolean(deleting)} onClose={() => setDeleting(null)} title={t('notes.deleteTitle')} description={t('notes.deleteConfirm', { title: deleting?.title || '' })} closeLabel={t('common.close')}>
        {deleting?.error && <p role="alert" className="mb-3 text-sm text-danger">{deleting.error.message}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setDeleting(null)}>{t('common.cancel')}</Button>
          <Button variant="danger" onClick={() => { void deleteNote(); }}>{t('common.delete')}</Button>
        </div>
      </Modal>

      <Modal open={Boolean(generated.note)} onClose={() => setGenerated({ note: null, items: [], loading: false, error: null })} title={t('notes.generatedTitle')} closeLabel={t('common.close')}>
        {generated.loading ? <div aria-label={t('notes.generating')}><Skeleton className="h-5 w-full" /><Skeleton className="mt-3 h-16 w-full" /></div> : generated.error ? (
          <ErrorState title={t('notes.generateError')} message={generated.error.message} retryLabel={t('common.retry')} onRetry={() => { void generateQuestions(generated.note); }} />
        ) : (
          <>
            <ol className="list-decimal space-y-3 pl-5 text-sm">{generated.items.map((question) => <li key={question.id}>{question.text}</li>)}</ol>
            {!generated.items.length && <p className="text-sm text-muted">{t('notes.noGeneratedQuestions')}</p>}
            <Button className="mt-5" disabled={!generated.items.length} onClick={practiceQuestions}>{t('notes.practiceGenerated')}</Button>
          </>
        )}
      </Modal>
    </main>
  );
}
