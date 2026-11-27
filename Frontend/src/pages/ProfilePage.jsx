import { useCallback, useEffect, useMemo, useState } from 'react';
import { useBlocker } from 'react-router-dom';
import { Plus, X } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { ErrorState } from '../components/ui/ErrorState';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { Select } from '../components/ui/Select';
import { Skeleton } from '../components/ui/Skeleton';
import { useTranslation } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/ui/Toast';
import { profileApi } from '../services/api/profileApi';
import { questionsApi } from '../services/api/questionsApi';
import { normalizeOptions } from '../utils/questionData';

const EMPTY_PROFILE = {
  name: '',
  email: '',
  education: '',
  experience: '',
  jobRole: '',
  careerGoal: '',
  skills: [],
};

function profileValues(profile) {
  return {
    ...EMPTY_PROFILE,
    ...profile,
    skills: Array.isArray(profile?.skills) ? [...profile.skills] : [],
  };
}

export default function ProfilePage() {
  const { t } = useTranslation();
  const { updateCurrentUser } = useAuth();
  const toast = useToast();
  const [profile, setProfile] = useState(EMPTY_PROFILE);
  const [baseline, setBaseline] = useState(EMPTY_PROFILE);
  const [roles, setRoles] = useState([]);
  const [skillSuggestions, setSkillSuggestions] = useState([]);
  const [skillInput, setSkillInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [optionError, setOptionError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);

  const dirty = useMemo(() => JSON.stringify(profile) !== JSON.stringify(baseline), [baseline, profile]);
  const blocker = useBlocker(dirty);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const saved = profileValues(await profileApi.get());
      setProfile(saved);
      setBaseline(saved);
    } catch (error) {
      setLoadError(error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    let active = true;
    Promise.all([questionsApi.getRoles({}), questionsApi.getSkills({})])
      .then(([roleResult, skillResult]) => {
        if (!active) return;
        setRoles(normalizeOptions(roleResult.items));
        setSkillSuggestions(normalizeOptions(skillResult.items));
        setOptionError(null);
      })
      .catch((error) => { if (active) setOptionError(error); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (blocker.state === 'blocked') setShowLeaveDialog(true);
  }, [blocker.state]);

  const changeField = (field, value) => {
    setProfile((current) => ({ ...current, [field]: value }));
    setFormError('');
  };

  const addSkill = (rawSkill) => {
    const skill = String(rawSkill || '').trim();
    if (!skill) return;
    if (profile.skills.some((item) => item.toLocaleLowerCase() === skill.toLocaleLowerCase())) {
      setSkillInput('');
      return;
    }
    if (profile.skills.length >= 30) {
      setFormError(t('profile.skillsLimit'));
      return;
    }
    changeField('skills', [...profile.skills, skill]);
    setSkillInput('');
  };

  const save = async (event) => {
    event.preventDefault();
    const name = profile.name.trim();
    if (name.length < 2 || name.length > 60) {
      setFormError(t('profile.nameValidation'));
      return;
    }
    if (profile.skills.length > 30) {
      setFormError(t('profile.skillsLimit'));
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      const updated = await profileApi.update({
        name,
        education: profile.education.trim(),
        experience: profile.experience.trim(),
        jobRole: profile.jobRole,
        careerGoal: profile.careerGoal.trim(),
      });
      const withSkills = await profileApi.updateSkills(profile.skills);
      const next = profileValues({ ...updated, ...withSkills, skills: withSkills.skills || profile.skills });
      setProfile(next);
      setBaseline(next);
      updateCurrentUser(next);
      toast.success(t('profile.saveSuccess'));
    } catch (error) {
      setFormError(error.message || t('profile.saveError'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <main className="mx-auto max-w-4xl space-y-4" aria-label={t('profile.loading')}><Skeleton className="h-10 w-2/3" /><Skeleton className="h-64 w-full" /></main>;
  }
  if (loadError) {
    return <main className="mx-auto max-w-4xl"><ErrorState title={t('profile.loadError')} message={loadError.message} retryLabel={t('common.retry')} onRetry={() => { void load(); }} /></main>;
  }

  const initial = profile.name.trim().charAt(0).toLocaleUpperCase() || '?';
  const suggestions = skillSuggestions.filter((item) => !profile.skills.some((skill) => skill.toLocaleLowerCase() === item.value.toLocaleLowerCase()));

  return (
    <main className="mx-auto max-w-4xl">
      <header className="mb-6">
        <p className="text-sm font-semibold text-primary">{t('profile.eyebrow')}</p>
        <h1 className="mt-1 text-3xl font-bold">{t('profile.title')}</h1>
        <p className="mt-2 text-muted dark:text-muted-dark">{t('profile.description')}</p>
      </header>
      <form onSubmit={save} className="space-y-5">
        <Card>
          <div className="mb-5 flex items-center gap-4">
            <div aria-label={t('profile.avatar', { initial })} className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-xl font-bold text-white">{initial}</div>
            <div>
              <h2 className="text-lg font-semibold">{profile.name || t('profile.yourProfile')}</h2>
              <p className="text-sm text-muted dark:text-muted-dark">{profile.email || t('profile.guestEmail')}</p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label={t('profile.name')} value={profile.name} maxLength={60} onChange={(event) => changeField('name', event.target.value)} />
            <Input label={t('profile.email')} value={profile.email} readOnly hint={t('profile.emailReadOnly')} />
            <Input label={t('profile.education')} value={profile.education} maxLength={160} onChange={(event) => changeField('education', event.target.value)} />
            <Input label={t('profile.experience')} value={profile.experience} maxLength={160} onChange={(event) => changeField('experience', event.target.value)} />
            <Select
              label={t('profile.jobRole')}
              value={profile.jobRole}
              onChange={(event) => changeField('jobRole', event.target.value)}
              options={[{ value: '', label: t('profile.selectRole') }, ...roles]}
            />
            <Input label={t('profile.careerGoal')} value={profile.careerGoal} maxLength={240} onChange={(event) => changeField('careerGoal', event.target.value)} />
          </div>
          {optionError && <p role="status" className="mt-3 text-sm text-warning">{t('profile.suggestionsUnavailable')} {optionError.message}</p>}
        </Card>

        <Card>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">{t('profile.skills')}</h2>
              <p className="mt-1 text-sm text-muted dark:text-muted-dark">{t('profile.skillsDescription', { count: profile.skills.length, max: 30 })}</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-sm dark:bg-slate-800">{profile.skills.length}/30</span>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {profile.skills.map((skill) => (
              <span key={skill} className="inline-flex items-center gap-1 rounded-full bg-primary-light px-3 py-1 text-sm text-primary-dark dark:bg-indigo-950 dark:text-indigo-200">
                {skill}
                <button type="button" className="rounded-full p-1" aria-label={t('profile.removeSkill', { skill })} onClick={() => changeField('skills', profile.skills.filter((item) => item !== skill))}>
                  <X aria-hidden="true" className="h-3.5 w-3.5" />
                </button>
              </span>
            ))}
            {!profile.skills.length && <p className="text-sm text-muted">{t('profile.noSkills')}</p>}
          </div>
          <div className="mt-4 flex gap-2">
            <Input
              label={t('profile.addSkill')}
              value={skillInput}
              maxLength={60}
              onChange={(event) => setSkillInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  addSkill(skillInput);
                }
              }}
            />
            <Button className="mt-7 shrink-0" type="button" variant="secondary" disabled={!skillInput.trim() || profile.skills.length >= 30} onClick={() => addSkill(skillInput)}>
              <Plus aria-hidden="true" className="h-4 w-4" />{t('profile.add')}
            </Button>
          </div>
          {suggestions.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-sm font-medium">{t('profile.suggestions')}</p>
              <div className="flex flex-wrap gap-2">
                {suggestions.slice(0, 12).map((skill) => (
                  <Button key={skill.value} type="button" size="sm" variant="ghost" disabled={profile.skills.length >= 30} onClick={() => addSkill(skill.label)}>
                    <Plus aria-hidden="true" className="h-3.5 w-3.5" />{skill.label}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </Card>
        {formError && <p role="alert" className="rounded-lg bg-danger-light p-3 text-sm text-danger">{formError}</p>}
        <div className="flex justify-end">
          <Button type="submit" loading={saving} disabled={!dirty}>{t('profile.save')}</Button>
        </div>
      </form>

      <Modal
        open={showLeaveDialog}
        onClose={() => { blocker.reset?.(); setShowLeaveDialog(false); }}
        title={t('profile.unsavedTitle')}
        description={t('profile.unsavedDescription')}
        closeLabel={t('common.close')}
      >
        <div className="mt-5 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => { blocker.reset?.(); setShowLeaveDialog(false); }}>{t('profile.keepEditing')}</Button>
          <Button variant="danger" onClick={() => { setShowLeaveDialog(false); blocker.proceed?.(); }}>{t('profile.leaveWithoutSaving')}</Button>
        </div>
      </Modal>
    </main>
  );
}
