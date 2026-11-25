import { ArrowRight, BarChart3, MessageSquareText, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/ui/Toast';
import { ROUTES } from '../config/routes';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';

export default function HomePage() {
  const { t } = useTranslation();
  const { isAuthenticated, isGuest, user, continueAsGuest } = useAuth();
  const toast = useToast();
  const features = [
    { icon: MessageSquareText, title: t('home.featurePractice'), description: t('home.featurePracticeDescription') },
    { icon: Sparkles, title: t('home.featureFeedback'), description: t('home.featureFeedbackDescription') },
    { icon: BarChart3, title: t('home.featureProgress'), description: t('home.featureProgressDescription') },
  ];

  const enterGuestMode = () => {
    try {
      continueAsGuest();
      toast.success(t('guest.ready'));
    } catch (error) {
      toast.error(error.message);
    }
  };

  return (
    <div>
      <section className="container grid min-h-[min(70vh,680px)] items-center gap-10 py-16 md:grid-cols-[1.2fr_0.8fr] md:py-20">
        <div>
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.12em] text-primary">{t('home.eyebrow')}</p>
          <h1 className="max-w-2xl text-4xl font-bold leading-tight tracking-tight text-slate-950 dark:text-white sm:text-5xl lg:text-6xl">
            {t('home.title')}
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-8 text-muted dark:text-muted-dark">{t('home.description')}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            {isAuthenticated ? (
              <p className="text-sm font-medium text-primary">{t('home.welcome')}, {user.name}.</p>
            ) : (
              <>
                <Link to={ROUTES.REGISTER} className="inline-flex min-h-touch items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-white hover:bg-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950">
                  {t('home.primaryAction')} <ArrowRight aria-hidden="true" className="h-4 w-4" />
                </Link>
                <Link to={ROUTES.LOGIN} className="inline-flex min-h-touch items-center rounded-lg border border-slate-300 px-4 text-sm font-medium text-slate-800 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-900">
                  {t('home.secondaryAction')}
                </Link>
                {!isGuest && <Button variant="ghost" onClick={enterGuestMode}>{t('home.guestAction')}</Button>}
              </>
            )}
          </div>
        </div>
        <div aria-hidden="true" className="mx-auto flex aspect-square w-full max-w-sm items-center justify-center rounded-full bg-primary-light dark:bg-indigo-950">
          <div className="flex h-[72%] w-[72%] items-center justify-center rounded-full border border-indigo-200 bg-white shadow-xl dark:border-indigo-800 dark:bg-slate-900">
            <MessageSquareText className="h-20 w-20 text-primary sm:h-24 sm:w-24" strokeWidth={1.5} />
          </div>
        </div>
      </section>
      <section id="features" className="scroll-mt-8 border-t border-slate-200 bg-white py-16 dark:border-slate-800 dark:bg-slate-900 sm:py-20">
        <div className="container">
          <h2 className="max-w-xl text-2xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-3xl">{t('home.featuresTitle')}</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {features.map(({ icon: Icon, title, description }) => (
              <Card key={title} className="p-6">
                <span className="mb-4 inline-flex rounded-xl bg-primary-light p-3 text-primary dark:bg-indigo-950 dark:text-indigo-200">
                  <Icon aria-hidden="true" className="h-6 w-6" />
                </span>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted dark:text-muted-dark">{description}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
