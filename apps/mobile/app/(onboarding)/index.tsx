import { useCallback, useEffect, useRef, useState, type ComponentProps } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { readJson, writeJson, removeKey } from '../../src/storage/local';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';
import { ACTIVITY_LEVELS, ENVIRONMENTS, EXPERIENCES, GOALS, SPORTS, disciplineForSports, goalsForSports, type Goal, type Sport } from '@sahhti/domain';
import { ApiClientError, apiRequest } from '../../src/api/client';
import { messageFor } from '../../src/api/errors';
import { useSession } from '../../src/auth/SessionProvider';
import { profileIsComplete } from '../../src/auth/gate';
import { formatCount } from '../../src/format';
import { label } from '../../src/i18n/labels';
import { useLocale } from '../../src/i18n/LocaleProvider';
import { text } from '../../src/i18n/copy';
import { parseOnboardingDraft, type OnboardingDraft } from '../../src/onboarding/draft';
import { measurementIssue, measurementPayload, onboardingFailure } from '../../src/onboarding/measurements';
import { Body, Button, Field, Screen, StatusLine } from '../../src/ui/Screen';
import { EditorialFrame, EditorialHint, editorialPhotos } from '../../src/ui/editorial';
import { LoadingSkeleton } from '../../src/ui/kit';
import { ChoiceList } from '../../src/ui/choices';
import { useTheme } from '../../src/theme/ThemeProvider';
import { useMotion } from '../../src/theme/motion';
import { fontFamily, radius, spacing, typeScale } from '../../src/theme/tokens';

type Me = { onboardingCompleted?: boolean; profile: Record<string, unknown> | null; goals?: string[] };
type SavedProfile = { persisted?: boolean; onboardingCompleted?: boolean };

const stepCopy = {
  welcome: 'welcome',
  sports: 'sports',
  goal: 'goal',
  experience: 'level',
  measurements: 'measurements',
  availability: 'availability',
  nutrition: 'diet',
  review: 'review',
} as const;

const steps = ['welcome', 'sports', 'goal', 'experience', 'measurements', 'availability', 'nutrition', 'review'] as const;
const diets = ['no_preference', 'higher_protein', 'vegetarian', 'no_dairy'] as const;
const times = ['morning', 'evening'] as const;
const weekdays = ['2', '3', '4', '5', '6'] as const;
const fuelGoals = ['cutting', 'fat_loss', 'bulking', 'muscle_gain', 'body_recomposition'] as const;
const DRAFT_KEY = 'sahhti.onboarding.draft';
type SymbolName = ComponentProps<typeof SymbolView>['name'];

const sportSymbols: Record<Sport, SymbolName> = {
  bodybuilding: { ios: 'dumbbell.fill', android: 'fitness_center', web: 'fitness_center' },
  calisthenics: { ios: 'figure.strengthtraining.traditional', android: 'accessibility_new', web: 'accessibility_new' },
  crossfit: { ios: 'figure.cross.training', android: 'timer', web: 'timer' },
  powerlifting: { ios: 'scalemass.fill', android: 'fitness_center', web: 'fitness_center' },
  running: { ios: 'figure.run', android: 'directions_run', web: 'directions_run' },
  boxing: { ios: 'figure.boxing', android: 'sports_mma', web: 'sports_mma' },
  general_fitness: { ios: 'heart.circle.fill', android: 'monitor_heart', web: 'monitor_heart' },
};

function sportDescription(sport: Sport, locale: 'ar' | 'en'): string {
  const descriptions: Record<Sport, { ar: string; en: string }> = {
    bodybuilding: { ar: 'كتلة عضلية وتناسق', en: 'Muscle and physique' },
    calisthenics: { ar: 'مهارات وتحكم بالجسم', en: 'Skills and body control' },
    crossfit: { ar: 'جولات وأداء وظيفي', en: 'Rounds and functional work' },
    powerlifting: { ar: 'قوة وأرقام رئيسية', en: 'Strength and main lifts' },
    running: { ar: 'مسافة وسرعة وتحمل', en: 'Distance, pace and endurance' },
    boxing: { ar: 'جولات ولياقة ومهارة', en: 'Rounds, fitness and skill' },
    general_fitness: { ar: 'حركة وصحة يومية', en: 'Movement and daily health' },
  };
  return descriptions[sport][locale];
}

function SportGrid({ sports, locale, onToggle }: { sports: readonly Sport[]; locale: 'ar' | 'en'; onToggle: (id: string) => void }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] }}>
      {SPORTS.map((sport) => {
        const selected = sports.includes(sport);
        return (
          <Pressable
            key={sport}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onToggle(sport)}
            style={({ pressed }) => ({
              width: '48.5%',
              minHeight: 126,
              borderRadius: radius.lg,
              padding: spacing[3],
              borderWidth: 1,
              borderColor: selected ? theme.heroAccent : 'rgba(255,255,255,0.18)',
              backgroundColor: selected ? `${theme.heroAccent}2E` : theme.overlay,
              opacity: pressed ? 0.82 : 1,
            })}
          >
            <View style={{ width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: selected ? theme.heroAccent : 'rgba(255,255,255,0.12)', marginBottom: spacing[2] }}>
              <SymbolView name={sportSymbols[sport]} size={20} tintColor={selected ? theme.goldInk : theme.heroText} />
            </View>
            <Text style={{ color: theme.heroText, fontFamily: fontFamily.bold, fontSize: typeScale.body, textAlign: locale === 'ar' ? 'right' : 'left', writingDirection: locale === 'ar' ? 'rtl' : 'ltr' }}>
              {label(locale, 'sport', sport)}
            </Text>
            <Text style={{ color: theme.heroText, opacity: 0.72, fontFamily: fontFamily.regular, fontSize: typeScale.micro, lineHeight: 17, marginTop: 2, textAlign: locale === 'ar' ? 'right' : 'left', writingDirection: locale === 'ar' ? 'rtl' : 'ltr' }}>
              {sportDescription(sport, locale)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function pick<T extends string>(value: string, allowed: readonly T[], fallback: T): T {
  return (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

export default function OnboardingScreen() {
  const { locale, setLocale } = useLocale();
  const { duration } = useMotion();
  const { tokens } = useSession();
  const queryClient = useQueryClient();
  const savingRef = useRef(false);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState(0);
  const [displayName, setDisplayName] = useState('');
  const [ageYears, setAgeYears] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [experience, setExperience] = useState<(typeof EXPERIENCES)[number]>('beginner');
  const [goal, setGoal] = useState<(typeof GOALS)[number]>('general_health');
  const [sports, setSports] = useState<Sport[]>(['general_fitness']);
  const [sessionsPerWeek, setSessionsPerWeek] = useState<(typeof weekdays)[number]>('3');
  const [environment, setEnvironment] = useState<(typeof ENVIRONMENTS)[number]>('gym');
  const [activity, setActivity] = useState<(typeof ACTIVITY_LEVELS)[number]>('moderate');
  const [when, setWhen] = useState<(typeof times)[number]>('evening');
  const [diet, setDiet] = useState<(typeof diets)[number]>('no_preference');
  const [error, setError] = useState('');
  const [storyIndex, setStoryIndex] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  const meKey = ['me', tokens?.accessToken] as const;
  const me = useQuery({
    queryKey: meKey,
    enabled: tokens !== null,
    queryFn: () => apiRequest<Me>('/v1/me'),
  });

  useEffect(() => {
    void readJson<OnboardingDraft | null>(DRAFT_KEY, null)
      .then((raw) => {
        const draft = parseOnboardingDraft(raw === null ? null : JSON.stringify(raw));
        if (draft === null) {
          return;
        }
        setStep(draft.step);
        setStoryIndex(draft.storyIndex);
        setDisplayName(draft.displayName);
        setAgeYears(draft.ageYears);
        setHeightCm(draft.heightCm);
        setWeightKg(draft.weightKg);
        setExperience(pick(draft.experience, EXPERIENCES, 'beginner'));
        setGoal(pick(draft.goal, GOALS, 'general_health'));
        setSports(draft.sports.filter((item): item is Sport => (SPORTS as readonly string[]).includes(item)));
        setSessionsPerWeek(pick(draft.sessionsPerWeek, weekdays, '3'));
        setEnvironment(pick(draft.environment, ENVIRONMENTS, 'gym'));
        setActivity(pick(draft.activity, ACTIVITY_LEVELS, 'moderate'));
        setWhen(pick(draft.when, times, 'evening'));
        setDiet(pick(draft.diet, diets, 'no_preference'));
      })
      .finally(() => setHydrated(true));
  }, []);

  const serverComplete = profileIsComplete(me.data);
  useFocusEffect(
    useCallback(() => {
      if (!serverComplete) {
        return;
      }
      router.replace('/(tabs)/home');
    }, [serverComplete]),
  );

  useEffect(() => {
    if (!hydrated) {
      return;
    }
    if (serverComplete) {
      void removeKey(DRAFT_KEY);
      return;
    }
    const draft: OnboardingDraft = {
      step,
      storyIndex,
      displayName,
      ageYears,
      heightCm,
      weightKg,
      experience,
      goal,
      discipline: disciplineForSports(sports),
      sports,
      sessionsPerWeek,
      environment,
      activity,
      when,
      diet,
    };
    void writeJson(DRAFT_KEY, draft).catch(() => undefined);
  }, [hydrated, serverComplete, step, storyIndex, displayName, ageYears, heightCm, weightKg, experience, goal, sports, sessionsPerWeek, environment, activity, when, diet]);

  if (!hydrated || (tokens !== null && me.isPending)) {
    return (
      <Screen>
        <LoadingSkeleton />
      </Screen>
    );
  }
  if (serverComplete) {
    return (
      <Screen>
        <StatusLine state="loading" />
        <Body>{text(locale, 'profileReady')}</Body>
        <Button label={text(locale, 'home')} onPress={() => router.replace('/(tabs)/home')} />
      </Screen>
    );
  }

  async function submit() {
    if (savingRef.current) {
      return;
    }
    if (serverComplete) {
      return;
    }
    const measurements = measurementPayload({ age: ageYears, height: heightCm, weight: weightKg });
    const issue = measurementIssue({ name: displayName.trim().length > 0 ? displayName : 'member', age: ageYears, height: heightCm, weight: weightKg });
    if (measurements === null || (issue !== null && issue !== 'name')) {
      const field = issue === 'age' || issue === 'height' || issue === 'weight' ? issue : 'height';
      setStep(steps.indexOf('measurements'));
      setError(text(locale, field === 'age' ? 'ageInvalid' : field === 'height' ? 'heightInvalid' : 'weightInvalid'));
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setError('');
    try {
      const saved = await apiRequest<SavedProfile>('/v1/onboarding', {
        method: 'POST',
        body: {
          ageYears: measurements.ageYears,
          heightCm: measurements.heightCm,
          weightKg: measurements.weightKg,
          trainingExperience: experience,
          goals: [goal],
          discipline: disciplineForSports(sports),
          sports,
          sessionsPerWeek: Number(sessionsPerWeek),
          environment,
          equipment: environment === 'home' ? ['bodyweight'] : ['barbell'],
          activityLevel: activity,
          dietaryPreferences: diet === 'no_preference' ? [] : [diet],
          allergies: [],
          supplements: [],
          injuries: [],
          preferredWorkoutTimes: [when],
          hasGymMembership: environment === 'gym',
          locale,
          measurementUnits: 'metric',
        },
      });
      if (saved.persisted !== true) {
        throw new ApiClientError(500, 'INTERNAL', text(locale, 'error'));
      }
      if (displayName.trim().length > 0) {
        await apiRequest('/v1/profile', { method: 'PATCH', body: { displayName: displayName.trim() } });
      }
      const fresh = await apiRequest<Me>('/v1/me');
      if (!profileIsComplete(fresh)) {
        throw new ApiClientError(500, 'INTERNAL', text(locale, 'error'));
      }
      queryClient.setQueryData<Me>(meKey, fresh);
      await removeKey(DRAFT_KEY);
    } catch (caught) {
      const field = caught instanceof ApiClientError && caught.code === 'ONBOARDING_INVALID' ? onboardingFailure(caught.message) : 'other';
      if (field === 'age' || field === 'height' || field === 'weight') {
        setStep(steps.indexOf('measurements'));
        setError(text(locale, field === 'age' ? 'ageInvalid' : field === 'height' ? 'heightInvalid' : 'weightInvalid'));
      } else {
        setError(caught instanceof ApiClientError ? messageFor(caught.code, locale, caught.message) : text(locale, 'offline'));
      }
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  const current = steps[step] ?? 'welcome';
  const last = current === 'review';
  const offeredGoals = goalsForSports(sports);
  const asksFuel = (fuelGoals as readonly string[]).includes(goal);
  const actionLabel = last ? (saving ? text(locale, 'saving') : text(locale, 'save')) : text(locale, 'continue');

  function toggleSport(id: string) {
    const sport = id as Sport;
    setSports((currentSports) => {
      if (currentSports.includes(sport)) {
        return currentSports.length === 1 ? currentSports : currentSports.filter((item) => item !== sport);
      }
      return [...currentSports, sport];
    });
  }

  function advance() {
    if (current === 'sports') {
      const allowed = goalsForSports(sports);
      if (!allowed.includes(goal)) {
        setGoal(allowed[0] ?? 'general_health');
      }
    }
    if (current === 'measurements') {
      const issue = measurementIssue({ name: displayName, age: ageYears, height: heightCm, weight: weightKg });
      if (issue !== null) {
        const key = issue === 'name' ? 'nameInvalid' : issue === 'age' ? 'ageInvalid' : issue === 'height' ? 'heightInvalid' : 'weightInvalid';
        setError(text(locale, key));
        return;
      }
    }
    if (sports.length === 0 && current === 'sports') {
      return;
    }
    setError('');
    if (last) {
      void submit();
      return;
    }
    if (current === 'availability' && !asksFuel) {
      setStep(steps.indexOf('review'));
      return;
    }
    setStep((value) => Math.min(steps.length - 1, value + 1));
  }

  function retreat() {
    setError('');
    if (current === 'review' && !asksFuel) {
      setStep(steps.indexOf('availability'));
      return;
    }
    setStep((value) => Math.max(0, value - 1));
  }

  const choice = (
    <View>
      {current === 'welcome' ? (
        <ChoiceList
          value={locale}
          onChange={(id) => setLocale(id === 'en' ? 'en' : 'ar')}
          options={[
            { id: 'ar', label: text(locale, 'arabic') },
            { id: 'en', label: text(locale, 'english') },
          ]}
        />
      ) : null}
      {current === 'sports' ? (
        <View>
          <EditorialHint>{text(locale, 'sportsHint')}</EditorialHint>
          <SportGrid sports={sports} locale={locale} onToggle={toggleSport} />
        </View>
      ) : null}
      {current === 'goal' ? (
        <ChoiceList value={goal} onChange={(id) => setGoal(id as Goal)} options={offeredGoals.map((item) => ({ id: item, label: label(locale, 'goal', item) }))} />
      ) : null}
      {current === 'experience' ? (
        <ChoiceList value={experience} onChange={(id) => setExperience(id as (typeof EXPERIENCES)[number])} options={EXPERIENCES.map((item) => ({ id: item, label: label(locale, 'experience', item) }))} />
      ) : null}
      {current === 'measurements' ? (
        <View>
          <Field inverse label={text(locale, 'displayName')} value={displayName} onChangeText={setDisplayName} textContentType="name" autoComplete="name" autoCapitalize="words" />
          <Field inverse label={text(locale, 'age')} value={ageYears} onChangeText={setAgeYears} keyboardType="number-pad" />
          <Field inverse label={`${text(locale, 'height')} (${text(locale, 'centimeters')})`} value={heightCm} onChangeText={setHeightCm} keyboardType="decimal-pad" />
          <Field inverse label={`${text(locale, 'weight')} (${text(locale, 'kilograms')})`} value={weightKg} onChangeText={setWeightKg} keyboardType="decimal-pad" />
        </View>
      ) : null}
      {current === 'availability' ? (
        <View>
          <EditorialHint>{text(locale, 'sessionsPerWeek')}</EditorialHint>
          <ChoiceList value={sessionsPerWeek} onChange={(id) => setSessionsPerWeek(id as (typeof weekdays)[number])} options={weekdays.map((item) => ({ id: item, label: formatCount(Number(item), locale) }))} />
          <ChoiceList value={environment} onChange={(id) => setEnvironment(id as (typeof ENVIRONMENTS)[number])} options={ENVIRONMENTS.map((item) => ({ id: item, label: label(locale, 'environment', item) }))} />
          <ChoiceList value={when} onChange={(id) => setWhen(id as (typeof times)[number])} options={times.map((item) => ({ id: item, label: label(locale, 'time', item) }))} />
        </View>
      ) : null}
      {current === 'nutrition' ? (
        <ChoiceList value={diet} onChange={(id) => setDiet(id as (typeof diets)[number])} options={diets.map((item) => ({ id: item, label: label(locale, 'diet', item) }))} />
      ) : null}
      {current === 'review' ? (
        <View style={{ gap: 4 }}>
          <EditorialHint>{labelListSafe(locale, sports)}</EditorialHint>
          <EditorialHint>{`${label(locale, 'goal', goal)} · ${label(locale, 'experience', experience)}`}</EditorialHint>
          <EditorialHint>{`${displayName} · ${ageYears} · ${heightCm} ${text(locale, 'centimeters')} · ${weightKg} ${text(locale, 'kilograms')}`}</EditorialHint>
          <EditorialHint>{text(locale, 'planNote')}</EditorialHint>
        </View>
      ) : null}
      {error.length > 0 && (current === 'measurements' || current === 'review') ? (
        <EditorialHint tone="danger" style={{ marginTop: 4 }}>{error}</EditorialHint>
      ) : null}
    </View>
  );

  // Every step — not just the welcome screen — is a full photo moment with a progress pager,
  // instead of onboarding opening strong and then dropping into a plain form list for the
  // remaining seven steps.
  const stepPhoto: Record<(typeof steps)[number], keyof typeof editorialPhotos> = {
    welcome: 'strength',
    sports: 'run',
    goal: 'strength',
    experience: 'strength',
    measurements: 'recovery',
    availability: 'run',
    nutrition: 'meal',
    review: 'coach',
  };
  const kicker = current === 'welcome'
    ? text(locale, 'brand')
    : `${text(locale, 'step')} ${formatCount(step + 1, locale)} ${text(locale, 'of')} ${formatCount(steps.length, locale)}`;

  return (
    <EditorialFrame
      source={editorialPhotos[stepPhoto[current]]}
      kicker={kicker}
      title={text(locale, stepCopy[current])}
      body={current === 'welcome' ? text(locale, 'welcomeBody') : undefined}
      index={step}
      count={steps.length}
      action={actionLabel}
      onAction={advance}
      disabled={saving}
      secondary={current === 'welcome' ? undefined : text(locale, 'back')}
      onSecondary={current === 'welcome' ? undefined : retreat}
    >
      <Animated.View key={current} entering={FadeInDown.duration(duration(320))} exiting={FadeOut.duration(duration(150))}>
        {choice}
      </Animated.View>
    </EditorialFrame>
  );
}

function labelListSafe(locale: 'ar' | 'en', sports: readonly Sport[]): string {
  return sports.map((sport) => label(locale, 'sport', sport)).join(locale === 'ar' ? '، ' : ', ');
}
