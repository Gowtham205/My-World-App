import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Apple,
  BellRing,
  Check,
  Dumbbell,
  Droplets,
  Flame,
  Footprints,
  HeartPulse,
  Plus,
  RotateCcw,
  Scale,
  Sparkles,
  Trophy,
  Utensils,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type {
  BiologicalSex,
  DietPreference,
  HealthActivityLevel,
  HealthProfile,
} from '../types/sanctuary';
import { getTodayStr, formatShortDate } from '../lib/dateUtils';
import {
  BIRTH_STARS_NAKSHATRA,
  SUN_SIGNS,
  assessBmi,
  calculateAgeFromDob,
  calculateDailyEnergyMetrics,
  calculateStepsBurn,
  formatHeightImperial,
  getExerciseRecommendations,
  getFoodComparisonResults,
  getNextStepMilestone,
  getNutritionSuggestions,
  getReachedStepMilestones,
  inferSunSignFromDob,
  isWeightRecheckDue,
} from '../lib/healthMonitor';
import { ModernDatePicker } from '../components/ModernDatePicker';
import { ModernSelect } from '../components/ModernSelect';

interface HealthMonitorViewProps {
  profile: HealthProfile | null;
  dailyStepsByDate: Record<string, number>;
  nativeStepSensorAvailable: boolean;
  nativeStepPermissionGranted: boolean;
  isNativePlatform: boolean;
  onSaveProfile: (profile: HealthProfile) => Promise<void>;
  onUpdateTodaySteps: (steps: number) => Promise<void>;
  onRequestNativeSteps: () => Promise<void>;
}

const REMINDER_CADENCE_OPTIONS = [
  { value: '7', label: 'Every 7 days' },
  { value: '14', label: 'Every 14 days' },
  { value: '30', label: 'Every 30 days (Default)' },
  { value: '60', label: 'Every 60 days' },
  { value: '0', label: 'Reminders Off' },
];

export const HealthMonitorView: React.FC<HealthMonitorViewProps> = ({
  profile,
  dailyStepsByDate,
  nativeStepSensorAvailable,
  nativeStepPermissionGranted,
  isNativePlatform,
  onSaveProfile,
  onUpdateTodaySteps,
  onRequestNativeSteps,
}) => {
  const todayStr = getTodayStr();
  const [showEditor, setShowEditor] = useState(!profile);
  const [heightUnit, setHeightUnit] = useState<'cm' | 'ftin'>('cm');

  const [weightKg, setWeightKg] = useState<string>(() =>
    profile ? String(profile.weightKg) : '68'
  );
  const [heightCmInput, setHeightCmInput] = useState<string>(() =>
    profile ? String(profile.heightCm) : '170'
  );
  const [heightFtInput, setHeightFtInput] = useState<string>(() => {
    const cm = profile?.heightCm || 170;
    return String(Math.floor(Math.round(cm / 2.54) / 12));
  });
  const [heightInInput, setHeightInInput] = useState<string>(() => {
    const cm = profile?.heightCm || 170;
    return String(Math.round(cm / 2.54) % 12);
  });

  const [dob, setDob] = useState<string>(() => profile?.dob || '1996-05-15');
  const [biologicalSex, setBiologicalSex] = useState<BiologicalSex>(
    () => profile?.biologicalSex || 'other'
  );
  const [dietPreference, setDietPreference] = useState<DietPreference>(
    () => profile?.dietPreference || 'both'
  );
  const [activityLevel, setActivityLevel] = useState<HealthActivityLevel>(
    () => profile?.activityLevel || 'moderate'
  );
  const [dailyStepGoal, setDailyStepGoal] = useState<string>(() =>
    profile ? String(profile.dailyStepGoal) : '8000'
  );
  const [targetWeightKg, setTargetWeightKg] = useState<string>(() =>
    profile?.targetWeightKg ? String(profile.targetWeightKg) : ''
  );
  const [weightReminderDays, setWeightReminderDays] = useState<number>(() =>
    profile?.weightReminderDays ?? 30
  );
  const [sunSign, setSunSign] = useState<string>(() => profile?.sunSign || '');
  const [birthStar, setBirthStar] = useState<string>(() => profile?.birthStar || '');

  const [formError, setFormError] = useState<string | null>(null);
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);
  const [manualStepInput, setManualStepInput] = useState<string>('');

  useEffect(() => {
    if (!profile) return;
    setWeightKg(String(profile.weightKg));
    setHeightCmInput(String(profile.heightCm));
    const totalIn = Math.round(profile.heightCm / 2.54);
    setHeightFtInput(String(Math.floor(totalIn / 12)));
    setHeightInInput(String(totalIn % 12));
    setDob(profile.dob);
    setBiologicalSex(profile.biologicalSex || 'other');
    setDietPreference(profile.dietPreference);
    setActivityLevel(profile.activityLevel);
    setDailyStepGoal(String(profile.dailyStepGoal));
    setTargetWeightKg(profile.targetWeightKg ? String(profile.targetWeightKg) : '');
    setWeightReminderDays(profile.weightReminderDays ?? 30);
    setSunSign(profile.sunSign || '');
    setBirthStar(profile.birthStar || '');
  }, [profile]);

  const effectiveHeightCm = useMemo(() => {
    if (heightUnit === 'cm') {
      return Number(heightCmInput) || 170;
    }
    const ft = Math.max(2, Math.min(8, Number(heightFtInput) || 5));
    const inch = Math.max(0, Math.min(11, Number(heightInInput) || 0));
    return Math.round((ft * 12 + inch) * 2.54);
  }, [heightUnit, heightCmInput, heightFtInput, heightInInput]);

  const activeWeight = profile?.weightKg ?? (Number(weightKg) || 68);
  const activeHeight = profile?.heightCm ?? effectiveHeightCm;
  const activeDob = profile?.dob ?? dob;
  const activeDiet = profile?.dietPreference ?? dietPreference;
  const activeSex = profile?.biologicalSex ?? biologicalSex;
  const activeActivity = profile?.activityLevel ?? activityLevel;
  const activeStepGoal = profile?.dailyStepGoal ?? (Number(dailyStepGoal) || 8000);

  const bmiAssessment = useMemo(
    () => assessBmi(activeWeight, activeHeight),
    [activeWeight, activeHeight]
  );
  const ageResult = useMemo(() => calculateAgeFromDob(activeDob), [activeDob]);
  const energyMetrics = useMemo(
    () =>
      calculateDailyEnergyMetrics({
        weightKg: activeWeight,
        heightCm: activeHeight,
        ageYears: ageResult?.years ?? 28,
        sex: activeSex,
        activityLevel: activeActivity,
      }),
    [activeWeight, activeHeight, ageResult?.years, activeSex, activeActivity]
  );

  const todaySteps = dailyStepsByDate[todayStr] || 0;
  const todayStepBurn = useMemo(
    () => calculateStepsBurn(todaySteps, activeWeight, activeHeight),
    [todaySteps, activeWeight, activeHeight]
  );
  const reachedMilestones = useMemo(() => getReachedStepMilestones(todaySteps), [todaySteps]);
  const nextMilestone = useMemo(() => getNextStepMilestone(todaySteps), [todaySteps]);
  const foodComparisons = useMemo(
    () => getFoodComparisonResults(todayStepBurn.caloriesBurned, activeDiet, activeWeight, activeHeight),
    [todayStepBurn.caloriesBurned, activeDiet, activeWeight, activeHeight]
  );
  const exercises = useMemo(
    () => getExerciseRecommendations(bmiAssessment, ageResult),
    [bmiAssessment, ageResult]
  );
  const nutritionGroups = useMemo(
    () => getNutritionSuggestions(bmiAssessment, ageResult, activeDiet),
    [bmiAssessment, ageResult, activeDiet]
  );
  const weightRecheck = useMemo(
    () => isWeightRecheckDue(profile, todayStr),
    [profile, todayStr]
  );

  const sevenDayStepsSeries = useMemo(() => {
    const out: { label: string; steps: number; kcal: number }[] = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const dt = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(
        dt.getDate()
      ).padStart(2, '0')}`;
      const steps = dailyStepsByDate[key] || 0;
      const burn = calculateStepsBurn(steps, activeWeight, activeHeight);
      out.push({
        label: dt.toLocaleDateString('en-US', { weekday: 'short' }),
        steps,
        kcal: burn.caloriesBurned,
      });
    }
    return out;
  }, [dailyStepsByDate, activeWeight, activeHeight]);

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedWeight = Number(weightKg);
    if (!Number.isFinite(parsedWeight) || parsedWeight < 20 || parsedWeight > 400) {
      setFormError('Please enter a valid weight between 20 kg and 400 kg.');
      return;
    }
    if (!Number.isFinite(effectiveHeightCm) || effectiveHeightCm < 50 || effectiveHeightCm > 260) {
      setFormError('Please enter a valid height (50 cm – 260 cm).');
      return;
    }
    if (!dob || !calculateAgeFromDob(dob)) {
      setFormError('Please choose a valid Date of Birth in the past.');
      return;
    }
    const parsedStepGoal = Math.max(500, Math.min(100000, Math.round(Number(dailyStepGoal) || 8000)));
    const parsedTarget =
      targetWeightKg.trim() !== '' && Number.isFinite(Number(targetWeightKg))
        ? Math.max(20, Math.min(400, Number(targetWeightKg)))
        : undefined;

    setFormError(null);

    const existingHistory = profile?.weightHistory ? [...profile.weightHistory] : [];
    const filteredHistory = existingHistory.filter((item) => item.date !== todayStr);
    filteredHistory.push({
      date: todayStr,
      weightKg: Math.round(parsedWeight * 10) / 10,
    });

    const nextProfile: HealthProfile = {
      id: 'health_profile',
      weightKg: Math.round(parsedWeight * 10) / 10,
      heightCm: Math.round(effectiveHeightCm),
      dob,
      biologicalSex,
      dietPreference,
      activityLevel,
      dailyStepGoal: parsedStepGoal,
      ...(parsedTarget ? { targetWeightKg: Math.round(parsedTarget * 10) / 10 } : {}),
      ...(sunSign.trim() ? { sunSign: sunSign.trim() } : {}),
      ...(birthStar.trim() ? { birthStar: birthStar.trim() } : {}),
      weightReminderDays,
      lastWeightLoggedAt: todayStr,
      weightHistory: filteredHistory.slice(-60),
      createdAt: profile?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await onSaveProfile(nextProfile);
    setShowEditor(false);
    setSaveFeedback('Health profile updated. Assessment & personalized recommendations refreshed.');
    window.setTimeout(() => setSaveFeedback(null), 4000);
  };

  const handleQuickAddSteps = async (delta: number) => {
    const next = Math.max(0, Math.min(150000, todaySteps + delta));
    await onUpdateTodaySteps(next);
  };

  const handleSetExactSteps = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = Math.round(Number(manualStepInput));
    if (!Number.isFinite(val) || val < 0) return;
    await onUpdateTodaySteps(Math.min(150000, val));
    setManualStepInput('');
  };

  const stepGoalPct = Math.min(100, Math.round((todaySteps / Math.max(500, activeStepGoal)) * 100));

  return (
    <div className="space-y-6">
      <header className="rounded-3xl bg-gradient-to-br from-[#EAF7EF] via-[#F5FBF8] to-[#EEF5FC] dark:from-[#162721] dark:via-[#161F24] dark:to-[#161F2D] border border-[#9EC5AB]/45 dark:border-[#9EC5AB]/25 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4 shadow-xs">
        <div>
          <p className="text-xs font-medium text-[#2E6B48] dark:text-[#9EC5AB]">
            Personal Health Monitor · BMI, Steps &amp; Nutrition
          </p>
          <h1 className="font-display text-2xl sm:text-3xl font-medium text-[#111827] dark:text-[#F1F3F6] mt-1">
            Body Index, Movement &amp; Wellness
          </h1>
          <p className="text-xs text-[#5B6472] dark:text-[#98A2B3] mt-1">
            BMI spectrum gauge, personalized cardio &amp; diet tips, live daily steps calorie burn,
            and monthly weight check reminders.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowEditor((v) => !v)}
          className="min-h-[44px] px-5 py-2.5 rounded-2xl bg-[#9EC5AB] hover:bg-[#8DB99C] text-[#0F1115] text-sm font-semibold inline-flex items-center justify-center gap-2 whitespace-nowrap shadow-xs shrink-0"
        >
          <Scale className="w-4 h-4" />
          {profile ? (showEditor ? 'Hide Profile Form' : 'Update Vitals & Weight') : 'Set Up Profile'}
        </button>
      </header>

      {saveFeedback && (
        <div
          role="status"
          className="rounded-2xl bg-[#EAF5EE] dark:bg-[#172821] border border-[#9EC5AB]/45 px-4 py-3 text-xs font-medium text-[#1F5636] dark:text-[#9EC5AB]"
        >
          {saveFeedback}
        </div>
      )}

      {/* 30-day Weight Recheck Banner */}
      {profile && weightRecheck.due && (
        <div
          role="status"
          className="rounded-3xl bg-[#FCF5E6] dark:bg-[#292316] border border-[#EDD59E]/55 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        >
          <div className="flex items-start gap-3">
            <BellRing className="w-5 h-5 text-[#92400E] dark:text-[#EDD59E] mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-[#111827] dark:text-[#F1F3F6]">
                Time for Your {profile.weightReminderDays}-Day Weight Check-In
              </p>
              <p className="text-xs text-[#5B6472] dark:text-[#98A2B3] mt-0.5">
                Last logged {weightRecheck.daysElapsed} days ago (
                {formatShortDate(profile.lastWeightLoggedAt)}). Weighing once a month keeps BMI and
                calorie targets accurate.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowEditor(true)}
            className="min-h-[40px] px-4 rounded-xl bg-[#EDD59E] text-[#0F1115] text-xs font-semibold whitespace-nowrap shrink-0 self-start sm:self-center"
          >
            Log New Weight
          </button>
        </div>
      )}

      {/* Health Profile Input Form */}
      {showEditor && (
        <form
          onSubmit={(e) => void handleSaveForm(e)}
          className="rounded-3xl bg-white/95 dark:bg-[#181C26]/95 border border-[#9EC5AB]/40 dark:border-white/[0.08] p-5 sm:p-7 space-y-5 shadow-xs"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-[#111827] dark:text-[#F1F3F6]">
                Personal Health Vitals
              </h2>
              <p className="text-xs text-[#5B6472] dark:text-[#98A2B3] mt-0.5">
                Used locally on your device (and backed up safely to your private account) to compute
                BMI, exact age, and calorie burn.
              </p>
            </div>
            <span className="text-xs font-mono-tabular font-medium text-[#2E6B48] dark:text-[#9EC5AB]">
              Age preview: {calculateAgeFromDob(dob)?.label || 'Select DOB'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Weight */}
            <div>
              <label className="block text-xs text-[#5B6472] dark:text-[#98A2B3] mb-1">
                Weight (kg)
              </label>
              <input
                type="number"
                step="0.1"
                min="20"
                max="400"
                required
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value)}
                placeholder="e.g. 68.5"
                className="w-full min-h-[44px] px-4 rounded-2xl bg-[#ECEFF3] dark:bg-[#1D212A] border border-slate-900/[0.10] dark:border-white/[0.08] text-sm font-mono-tabular text-[#111827] dark:text-[#F1F3F6]"
              />
            </div>

            {/* Height with cm vs ft/in switcher */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-[#5B6472] dark:text-[#98A2B3]">Height</label>
                <div className="inline-flex rounded-lg bg-[#ECEFF3] dark:bg-[#1D212A] p-0.5 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setHeightUnit('cm')}
                    className={`px-2 py-0.5 rounded-md font-medium transition-colors ${
                      heightUnit === 'cm'
                        ? 'bg-[#9EC5AB] text-[#0F1115]'
                        : 'text-[#5B6472] dark:text-[#98A2B3]'
                    }`}
                  >
                    cm
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const totalIn = Math.round((Number(heightCmInput) || 170) / 2.54);
                      setHeightFtInput(String(Math.floor(totalIn / 12)));
                      setHeightInInput(String(totalIn % 12));
                      setHeightUnit('ftin');
                    }}
                    className={`px-2 py-0.5 rounded-md font-medium transition-colors ${
                      heightUnit === 'ftin'
                        ? 'bg-[#9EC5AB] text-[#0F1115]'
                        : 'text-[#5B6472] dark:text-[#98A2B3]'
                    }`}
                  >
                    ft / in
                  </button>
                </div>
              </div>

              {heightUnit === 'cm' ? (
                <input
                  type="number"
                  min="50"
                  max="260"
                  required
                  value={heightCmInput}
                  onChange={(e) => setHeightCmInput(e.target.value)}
                  placeholder="e.g. 172"
                  className="w-full min-h-[44px] px-4 rounded-2xl bg-[#ECEFF3] dark:bg-[#1D212A] border border-slate-900/[0.10] dark:border-white/[0.08] text-sm font-mono-tabular text-[#111827] dark:text-[#F1F3F6]"
                />
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    min="2"
                    max="8"
                    value={heightFtInput}
                    onChange={(e) => setHeightFtInput(e.target.value)}
                    placeholder="ft"
                    className="w-full min-h-[44px] px-3 rounded-2xl bg-[#ECEFF3] dark:bg-[#1D212A] border border-slate-900/[0.10] dark:border-white/[0.08] text-sm font-mono-tabular text-[#111827] dark:text-[#F1F3F6]"
                  />
                  <input
                    type="number"
                    min="0"
                    max="11"
                    value={heightInInput}
                    onChange={(e) => setHeightInInput(e.target.value)}
                    placeholder="in"
                    className="w-full min-h-[44px] px-3 rounded-2xl bg-[#ECEFF3] dark:bg-[#1D212A] border border-slate-900/[0.10] dark:border-white/[0.08] text-sm font-mono-tabular text-[#111827] dark:text-[#F1F3F6]"
                  />
                </div>
              )}
            </div>

            {/* Date of Birth */}
            <div>
              <label className="block text-xs text-[#5B6472] dark:text-[#98A2B3] mb-1">
                Date of Birth (for Age)
              </label>
              <ModernDatePicker
                ariaLabel="Date of Birth"
                title="Date of Birth"
                accent="sage"
                enableYearPicker
                maxDate={todayStr}
                value={dob}
                onChange={(nextDob) => {
                  setDob(nextDob);
                  if (!sunSign) {
                    const inferred = inferSunSignFromDob(nextDob);
                    if (inferred) setSunSign(inferred);
                  }
                }}
              />
            </div>

            {/* Diet Preference */}
            <div>
              <label className="block text-xs text-[#5B6472] dark:text-[#98A2B3] mb-1">
                Dietary Preference
              </label>
              <div className="grid grid-cols-3 gap-1.5 p-1 rounded-2xl bg-[#ECEFF3] dark:bg-[#1D212A] border border-slate-900/[0.08] dark:border-white/[0.06]">
                {(
                  [
                    { id: 'veg', label: 'Veg' },
                    { id: 'non-veg', label: 'Non-Veg' },
                    { id: 'both', label: 'Both' },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setDietPreference(opt.id)}
                    className={`min-h-[36px] rounded-xl text-xs font-medium transition-colors ${
                      dietPreference === opt.id
                        ? 'bg-[#9EC5AB] text-[#0F1115] font-semibold'
                        : 'text-[#5B6472] dark:text-[#98A2B3]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Biological Sex */}
            <div>
              <label className="block text-xs text-[#5B6472] dark:text-[#98A2B3] mb-1">
                Biological Sex (Energy Formula)
              </label>
              <ModernSelect
                ariaLabel="Biological Sex"
                title="Biological Sex"
                accent="sage"
                value={biologicalSex}
                onChange={(val) => setBiologicalSex(val as BiologicalSex)}
                options={[
                  { value: 'male', label: 'Male' },
                  { value: 'female', label: 'Female' },
                  { value: 'other', label: 'Neutral / Prefer not to say' },
                ]}
              />
            </div>

            {/* Activity Level */}
            <div>
              <label className="block text-xs text-[#5B6472] dark:text-[#98A2B3] mb-1">
                Activity Level
              </label>
              <ModernSelect
                ariaLabel="Activity Level"
                title="Activity Level"
                accent="sage"
                value={activityLevel}
                onChange={(val) => setActivityLevel(val as HealthActivityLevel)}
                options={[
                  { value: 'sedentary', label: 'Sedentary (Desk / Minimal)' },
                  { value: 'light', label: 'Light (Walks 1–3x / week)' },
                  { value: 'moderate', label: 'Moderate (Active 3–5x / week)' },
                  { value: 'active', label: 'Active (Daily Training)' },
                ]}
              />
            </div>

            {/* Daily Step Goal */}
            <div>
              <label className="block text-xs text-[#5B6472] dark:text-[#98A2B3] mb-1">
                Daily Step Goal
              </label>
              <input
                type="number"
                min="500"
                max="100000"
                step="500"
                value={dailyStepGoal}
                onChange={(e) => setDailyStepGoal(e.target.value)}
                className="w-full min-h-[44px] px-4 rounded-2xl bg-[#ECEFF3] dark:bg-[#1D212A] border border-slate-900/[0.10] dark:border-white/[0.08] text-sm font-mono-tabular text-[#111827] dark:text-[#F1F3F6]"
              />
            </div>

            {/* Target Weight */}
            <div>
              <label className="block text-xs text-[#5B6472] dark:text-[#98A2B3] mb-1">
                Target Weight (kg, optional)
              </label>
              <input
                type="number"
                step="0.1"
                min="20"
                max="400"
                value={targetWeightKg}
                onChange={(e) => setTargetWeightKg(e.target.value)}
                placeholder="Optional goal weight"
                className="w-full min-h-[44px] px-4 rounded-2xl bg-[#ECEFF3] dark:bg-[#1D212A] border border-slate-900/[0.10] dark:border-white/[0.08] text-sm font-mono-tabular text-[#111827] dark:text-[#F1F3F6]"
              />
            </div>

            {/* Weight Recheck Cadence */}
            <div>
              <label className="block text-xs text-[#5B6472] dark:text-[#98A2B3] mb-1">
                Weight Check-In Reminder
              </label>
              <ModernSelect
                ariaLabel="Weight Check-In Reminder Cadence"
                title="Weight Check-In Reminder"
                accent="sage"
                value={String(weightReminderDays)}
                onChange={(val) => setWeightReminderDays(Number(val))}
                options={REMINDER_CADENCE_OPTIONS}
              />
            </div>
          </div>

          {/* Optional Personal Information (clearly separated from health metrics) */}
          <div className="rounded-2xl bg-[#F4F1FA] dark:bg-[#1D1B29] border border-[#BEB4DC]/35 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#5B4D8A] dark:text-[#BEB4DC]" />
                <span className="text-xs font-semibold text-[#111827] dark:text-[#F1F3F6]">
                  Optional Personal Information
                </span>
              </div>
              <span className="text-[11px] text-[#5B6472] dark:text-[#98A2B3]">
                Purely personal · Separate from clinical BMI &amp; health calculations
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-[#5B6472] dark:text-[#98A2B3]">
                    Sun Sign (Optional)
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const inferred = inferSunSignFromDob(dob);
                      if (inferred) setSunSign(inferred);
                    }}
                    className="text-[11px] font-medium text-[#5B4D8A] dark:text-[#BEB4DC] hover:underline"
                  >
                    Auto from DOB
                  </button>
                </div>
                <ModernSelect
                  ariaLabel="Sun Sign"
                  title="Sun Sign (Optional)"
                  accent="lavender"
                  value={sunSign}
                  onChange={setSunSign}
                  options={[
                    { value: '', label: 'Not specified' },
                    ...SUN_SIGNS.map((s) => ({ value: s, label: s })),
                  ]}
                />
              </div>

              <div>
                <label className="block text-xs text-[#5B6472] dark:text-[#98A2B3] mb-1">
                  Birth Star / Nakshatra (Optional)
                </label>
                <ModernSelect
                  ariaLabel="Birth Star / Nakshatra"
                  title="Birth Star (Optional)"
                  accent="lavender"
                  value={birthStar}
                  onChange={setBirthStar}
                  options={[
                    { value: '', label: 'Not specified' },
                    ...BIRTH_STARS_NAKSHATRA.map((b) => ({ value: b, label: b })),
                  ]}
                />
              </div>
            </div>
          </div>

          {formError && (
            <div
              role="alert"
              className="rounded-2xl bg-[#FDF1EB] dark:bg-[#2B1C19] border border-[#F2B8A2]/50 px-4 py-3 text-xs font-medium text-[#A6482D] dark:text-[#F2B8A2]"
            >
              {formError}
            </div>
          )}

          <div className="flex justify-end gap-2.5 pt-1">
            {profile && (
              <button
                type="button"
                onClick={() => setShowEditor(false)}
                className="min-h-[44px] px-4 rounded-2xl bg-slate-900/[0.05] dark:bg-white/[0.05] text-sm text-[#334155] dark:text-[#D0D5DD]"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              className="min-h-[44px] px-6 rounded-2xl bg-[#9EC5AB] hover:bg-[#8DB99C] text-[#0F1115] text-sm font-semibold inline-flex items-center gap-2"
            >
              <Check className="w-4 h-4" />
              Save &amp; Calculate Assessment
            </button>
          </div>
        </form>
      )}

      {/* Primary BMI & Body Index Spectrum Indicator */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        <div
          className={`lg:col-span-7 rounded-3xl bg-white dark:bg-[#171A21] border ${bmiAssessment.borderClass} p-5 sm:p-6 flex flex-col justify-between space-y-5 shadow-xs`}
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs text-[#5B6472] dark:text-[#98A2B3] flex items-center gap-1.5">
                <HeartPulse className="w-4 h-4 text-[#2E6B48] dark:text-[#9EC5AB]" />
                <span>Body Mass Index (BMI) Assessment</span>
              </p>
              <div className="flex items-baseline gap-3 mt-1.5">
                <span className="font-mono-tabular text-4xl sm:text-5xl font-semibold text-[#111827] dark:text-[#F1F3F6]">
                  {bmiAssessment.bmi.toFixed(1)}
                </span>
                <span
                  className={`px-3 py-1 rounded-xl text-xs font-semibold ${bmiAssessment.badgeBgClass} ${bmiAssessment.badgeTextClass}`}
                >
                  {bmiAssessment.label}
                </span>
              </div>
            </div>

            <div className="text-left sm:text-right">
              <p className="text-xs text-[#5B6472] dark:text-[#98A2B3]">Age from DOB</p>
              <p className="text-lg font-semibold font-mono-tabular text-[#111827] dark:text-[#F1F3F6]">
                {ageResult ? ageResult.label : '—'}
              </p>
              <p className="text-[11px] text-[#5B6472] dark:text-[#98A2B3] font-mono-tabular mt-0.5">
                {activeWeight} kg · {activeHeight} cm ({formatHeightImperial(activeHeight)})
              </p>
            </div>
          </div>

          {/* 4-Band Color Spectrum Indicator with Marker */}
          <div className="space-y-2">
            <div className="relative pt-5 pb-1">
              <div
                className="absolute top-0 -translate-x-1/2 flex flex-col items-center transition-all duration-500"
                style={{ left: `${bmiAssessment.pointerPercent}%` }}
              >
                <span className="text-[11px] font-mono-tabular font-bold text-[#111827] dark:text-[#F1F3F6] px-1.5 py-0.5 rounded-md bg-white dark:bg-[#13161C] border border-slate-900/15 dark:border-white/15 shadow-xs">
                  {bmiAssessment.bmi.toFixed(1)}
                </span>
              </div>

              <div className="h-4 w-full rounded-full overflow-hidden flex border border-slate-900/[0.08] dark:border-white/[0.08]">
                <div
                  style={{ width: '18.75%', backgroundColor: '#9BC4E2' }}
                  title="Underweight < 18.5"
                />
                <div
                  style={{ width: '27.08%', backgroundColor: '#9EC5AB' }}
                  title="Normal 18.5 – 24.9"
                />
                <div
                  style={{ width: '20.83%', backgroundColor: '#EDD59E' }}
                  title="Overweight 25.0 – 29.9"
                />
                <div
                  style={{ width: '33.34%', backgroundColor: '#F2B8A2' }}
                  title="Obese 30.0+"
                />
              </div>

              <div className="flex justify-between text-[10px] font-mono-tabular text-[#5B6472] dark:text-[#98A2B3] mt-1.5">
                <span>14</span>
                <span>18.5</span>
                <span>25.0</span>
                <span>30.0</span>
                <span>38+</span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
              <span className="inline-flex items-center gap-1.5 text-[#5B6472] dark:text-[#98A2B3]">
                <span className="w-2.5 h-2.5 rounded-full bg-[#9BC4E2]" />
                Underweight
              </span>
              <span className="inline-flex items-center gap-1.5 text-[#5B6472] dark:text-[#98A2B3]">
                <span className="w-2.5 h-2.5 rounded-full bg-[#9EC5AB]" />
                Normal
              </span>
              <span className="inline-flex items-center gap-1.5 text-[#5B6472] dark:text-[#98A2B3]">
                <span className="w-2.5 h-2.5 rounded-full bg-[#EDD59E]" />
                Overweight
              </span>
              <span className="inline-flex items-center gap-1.5 text-[#5B6472] dark:text-[#98A2B3]">
                <span className="w-2.5 h-2.5 rounded-full bg-[#F2B8A2]" />
                Obese
              </span>
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-xs text-[#334155] dark:text-[#D0D5DD] leading-relaxed">
              {bmiAssessment.summary}
            </p>
            {bmiAssessment.southAsianNote && (
              <p className="text-[11px] text-[#255F8A] dark:text-[#9BC4E2] leading-relaxed">
                Note: {bmiAssessment.southAsianNote}
              </p>
            )}
          </div>
        </div>

        {/* Right KPI Column: Healthy Range, Daily Energy, Hydration & Optional Personal Badges */}
        <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
          <div className="rounded-3xl bg-white dark:bg-[#171A21] border border-slate-900/[0.08] dark:border-white/[0.07] p-4 sm:p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-[#5B6472] dark:text-[#98A2B3]">
              <span>Ideal Weight</span>
              <Scale className="w-4 h-4 text-[#2E6B48] dark:text-[#9EC5AB]" />
            </div>
            <p className="font-mono-tabular text-lg sm:text-xl font-semibold text-[#111827] dark:text-[#F1F3F6] mt-2">
              {bmiAssessment.healthyWeightRangeKg.min}–{bmiAssessment.healthyWeightRangeKg.max} kg
            </p>
            <p className="text-[11px] text-[#5B6472] dark:text-[#98A2B3] mt-1">
              {profile?.targetWeightKg
                ? `Your target: ${profile.targetWeightKg} kg`
                : 'For normal 18.5–24.9 BMI'}
            </p>
          </div>

          <div className="rounded-3xl bg-white dark:bg-[#171A21] border border-slate-900/[0.08] dark:border-white/[0.07] p-4 sm:p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-[#5B6472] dark:text-[#98A2B3]">
              <span>Daily Maintenance</span>
              <Flame className="w-4 h-4 text-[#A6482D] dark:text-[#F2B8A2]" />
            </div>
            <p className="font-mono-tabular text-lg sm:text-xl font-semibold text-[#111827] dark:text-[#F1F3F6] mt-2">
              {energyMetrics.tdee} kcal
            </p>
            <p className="text-[11px] text-[#5B6472] dark:text-[#98A2B3] mt-1">
              BMR: {energyMetrics.bmr} kcal/day
            </p>
          </div>

          <div className="rounded-3xl bg-white dark:bg-[#171A21] border border-slate-900/[0.08] dark:border-white/[0.07] p-4 sm:p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-[#5B6472] dark:text-[#98A2B3]">
              <span>Hydration Goal</span>
              <Droplets className="w-4 h-4 text-[#255F8A] dark:text-[#9BC4E2]" />
            </div>
            <p className="font-mono-tabular text-lg sm:text-xl font-semibold text-[#111827] dark:text-[#F1F3F6] mt-2">
              {energyMetrics.hydrationLiters} L / day
            </p>
            <p className="text-[11px] text-[#5B6472] dark:text-[#98A2B3] mt-1">
              ~{Math.round(energyMetrics.hydrationLiters * 4)} glasses of water
            </p>
          </div>

          <div className="rounded-3xl bg-white dark:bg-[#171A21] border border-slate-900/[0.08] dark:border-white/[0.07] p-4 sm:p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-[#5B6472] dark:text-[#98A2B3]">
              <span>Recheck &amp; Profile</span>
              <Sparkles className="w-4 h-4 text-[#5B4D8A] dark:text-[#BEB4DC]" />
            </div>
            <p className="text-sm font-semibold text-[#111827] dark:text-[#F1F3F6] mt-2">
              {weightReminderDays > 0 ? `Every ${weightReminderDays} days` : 'Reminder Off'}
            </p>
            <p className="text-[11px] text-[#5B6472] dark:text-[#98A2B3] mt-1 truncate">
              {sunSign || birthStar
                ? [sunSign?.split(' ')[0], birthStar].filter(Boolean).join(' · ')
                : activeDiet === 'veg'
                  ? 'Vegetarian Plan'
                  : activeDiet === 'non-veg'
                    ? 'Non-Veg Plan'
                    : 'Veg & Non-Veg'}
            </p>
          </div>
        </div>
      </section>

      {/* Daily Steps Counter, Calories Burned & Food Calorie Comparison */}
      <section className="rounded-3xl bg-white dark:bg-[#171A21] border border-slate-900/[0.08] dark:border-white/[0.07] p-5 sm:p-7 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-[#255F8A] dark:text-[#9BC4E2] flex items-center gap-1.5">
              <Footprints className="w-4 h-4" />
              <span>
                Daily Steps Counter{' '}
                {isNativePlatform && nativeStepSensorAvailable
                  ? nativeStepPermissionGranted
                    ? '· Live Phone Step Sensor Active'
                    : '· Tap Enable for Automatic Step Sensor'
                  : '· Daily Step Logger'}
              </span>
            </p>
            <div className="flex flex-wrap items-baseline gap-3 mt-1.5">
              <span className="font-mono-tabular text-3xl sm:text-4xl font-semibold text-[#111827] dark:text-[#F1F3F6]">
                {todaySteps.toLocaleString()}
              </span>
              <span className="text-xs text-[#5B6472] dark:text-[#98A2B3] font-mono-tabular">
                / {activeStepGoal.toLocaleString()} goal ({stepGoalPct}%)
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isNativePlatform && nativeStepSensorAvailable && !nativeStepPermissionGranted && (
              <button
                type="button"
                onClick={() => void onRequestNativeSteps()}
                className="min-h-[42px] px-4 rounded-xl bg-[#9BC4E2] text-[#0F1115] text-xs font-semibold inline-flex items-center gap-1.5"
              >
                <Activity className="w-4 h-4" />
                Enable Phone Step Sensor
              </button>
            )}
            {[500, 1000, 2500].map((inc) => (
              <button
                key={inc}
                type="button"
                onClick={() => void handleQuickAddSteps(inc)}
                className="min-h-[40px] px-3 rounded-xl bg-[#ECEFF3] dark:bg-[#1D212A] hover:bg-slate-900/[0.08] dark:hover:bg-white/[0.08] border border-slate-900/[0.08] dark:border-white/[0.08] text-xs font-medium text-[#111827] dark:text-[#F1F3F6] inline-flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5 text-[#2E6B48] dark:text-[#9EC5AB]" />
                {inc.toLocaleString()}
              </button>
            ))}
          </div>
        </div>

        {/* Step Goal & Milestone Progress Bar */}
        <div className="space-y-2">
          <div className="h-3 w-full rounded-full bg-[#ECEFF3] dark:bg-[#1D212A] overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#9EC5AB] via-[#9BC4E2] to-[#BEB4DC] transition-all duration-500"
              style={{ width: `${stepGoalPct}%` }}
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#5B6472] dark:text-[#98A2B3]">
            <span className="inline-flex items-center gap-1.5">
              <Trophy className="w-3.5 h-3.5 text-[#B45309] dark:text-[#EDD59E]" />
              {reachedMilestones.length > 0
                ? `Milestones unlocked today: ${reachedMilestones
                    .map((m) => m.toLocaleString())
                    .join(', ')}`
                : 'First step celebration triggers at 1,000 steps, then every 5,000 steps.'}
            </span>
            <span className="font-mono-tabular">
              Next celebration: {nextMilestone.toLocaleString()} steps
            </span>
          </div>
        </div>

        {/* Burn Metrics + Manual Step Override */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-stretch">
          <div className="rounded-2xl bg-[#FDF1EC] dark:bg-[#261B18] border border-[#F2B8A2]/40 p-4">
            <p className="text-xs text-[#9A3F26] dark:text-[#F2B8A2]">Calories Burned Today</p>
            <p className="font-mono-tabular text-2xl font-semibold text-[#111827] dark:text-[#F1F3F6] mt-1">
              {todayStepBurn.caloriesBurned} kcal
            </p>
          </div>
          <div className="rounded-2xl bg-[#EDF5FC] dark:bg-[#16222E] border border-[#9BC4E2]/40 p-4">
            <p className="text-xs text-[#255F8A] dark:text-[#9BC4E2]">Distance Walked</p>
            <p className="font-mono-tabular text-2xl font-semibold text-[#111827] dark:text-[#F1F3F6] mt-1">
              {todayStepBurn.distanceKm} km
            </p>
          </div>
          <div className="rounded-2xl bg-[#EAF7EF] dark:bg-[#16251F] border border-[#9EC5AB]/40 p-4">
            <p className="text-xs text-[#2E6B48] dark:text-[#9EC5AB]">Est. Active Time</p>
            <p className="font-mono-tabular text-2xl font-semibold text-[#111827] dark:text-[#F1F3F6] mt-1">
              {todayStepBurn.activeMinutes} min
            </p>
          </div>
          <form
            onSubmit={(e) => void handleSetExactSteps(e)}
            className="rounded-2xl bg-[#ECEFF3] dark:bg-[#1D212A] border border-slate-900/[0.08] dark:border-white/[0.06] p-3 flex flex-col justify-between gap-2"
          >
            <span className="text-[11px] text-[#5B6472] dark:text-[#98A2B3]">
              Set / Sync Today’s Steps
            </span>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min="0"
                max="150000"
                value={manualStepInput}
                onChange={(e) => setManualStepInput(e.target.value)}
                placeholder={String(todaySteps)}
                className="w-full min-h-[36px] px-2.5 rounded-xl bg-white dark:bg-[#13161C] border border-slate-900/[0.1] dark:border-white/[0.1] text-xs font-mono-tabular text-[#111827] dark:text-[#F1F3F6]"
              />
              <button
                type="submit"
                className="min-h-[36px] px-3 rounded-xl bg-[#9BC4E2] text-[#0F1115] text-xs font-semibold shrink-0"
              >
                Set
              </button>
              {todaySteps > 0 && (
                <button
                  type="button"
                  onClick={() => void onUpdateTodaySteps(0)}
                  aria-label="Reset today's steps"
                  title="Reset today's steps"
                  className="min-w-[36px] min-h-[36px] rounded-xl bg-white dark:bg-[#13161C] text-[#5B6472] dark:text-[#98A2B3] flex items-center justify-center shrink-0"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </form>
        </div>

        {/* 7-Day Steps & Food Calorie Comparison */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-2">
          <div className="lg:col-span-6 space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-[#111827] dark:text-[#F1F3F6]">
                7-Day Steps &amp; Calories Burned
              </h3>
              <p className="text-xs text-[#5B6472] dark:text-[#98A2B3]">
                Daily step count alongside kcal burned based on your body profile
              </p>
            </div>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sevenDayStepsSeries} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(148,163,184,0.2)" vertical={false} />
                  <XAxis
                    dataKey="label"
                    stroke="#64748B"
                    tick={{ fill: '#64748B', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    stroke="#64748B"
                    tick={{ fill: '#64748B', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip />
                  <Bar dataKey="steps" name="Steps" fill="#9EC5AB" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="lg:col-span-6 space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-[#111827] dark:text-[#F1F3F6] flex items-center gap-1.5">
                <Utensils className="w-4 h-4 text-[#A6482D] dark:text-[#F2B8A2]" />
                <span>Food Calorie Burn Comparison</span>
              </h3>
              <p className="text-xs text-[#5B6472] dark:text-[#98A2B3]">
                How your {todayStepBurn.caloriesBurned} kcal burned today compares to everyday{' '}
                {activeDiet === 'veg' ? 'vegetarian' : activeDiet === 'non-veg' ? 'non-veg' : 'foods'}
              </p>
            </div>

            <div className="space-y-2.5">
              {foodComparisons.map((item) => (
                <div
                  key={item.id}
                  className="p-3 rounded-2xl bg-[#ECEFF3] dark:bg-[#1D212A] border border-slate-900/[0.06] dark:border-white/[0.06] space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-medium text-[#111827] dark:text-[#F1F3F6] truncate">
                      {item.name} ·{' '}
                      <span className="text-[#5B6472] dark:text-[#98A2B3] font-normal">
                        {item.calories} kcal ({item.serving})
                      </span>
                    </span>
                    <span className="font-mono-tabular font-semibold text-[#A6482D] dark:text-[#F2B8A2] shrink-0">
                      {item.servingsBurned}x burned
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-white dark:bg-[#13161C] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[#F2B8A2]"
                      style={{ width: `${item.progressPct}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-[#5B6472] dark:text-[#98A2B3] font-mono-tabular">
                    ~{item.stepsPerServing.toLocaleString()} steps per serving
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Personalized Exercise & Nutrition Recommendations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="rounded-3xl bg-white dark:bg-[#171A21] border border-slate-900/[0.08] dark:border-white/[0.07] p-5 sm:p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Dumbbell className="w-5 h-5 text-[#255F8A] dark:text-[#9BC4E2]" />
            <div>
              <h2 className="text-base font-semibold text-[#111827] dark:text-[#F1F3F6]">
                Suggested Movement &amp; Exercises
              </h2>
              <p className="text-xs text-[#5B6472] dark:text-[#98A2B3]">
                Calibrated for {bmiAssessment.label} BMI
                {ageResult ? ` · Age ${ageResult.years}` : ''}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {exercises.map((ex) => (
              <div
                key={ex.title}
                className="p-4 rounded-2xl bg-[#F4F8FC] dark:bg-[#16202A] border border-[#9BC4E2]/30 space-y-1.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-[#255F8A] dark:text-[#9BC4E2]">
                    {ex.category} · {ex.duration} · {ex.frequency}
                  </span>
                  <span className="text-xs font-mono-tabular text-[#5B6472] dark:text-[#98A2B3]">
                    ~{ex.approxKcal} kcal
                  </span>
                </div>
                <h3 className="text-sm font-semibold text-[#111827] dark:text-[#F1F3F6]">
                  {ex.title}
                </h3>
                <p className="text-xs text-[#334155] dark:text-[#D0D5DD] leading-relaxed">
                  {ex.guidance}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl bg-white dark:bg-[#171A21] border border-slate-900/[0.08] dark:border-white/[0.07] p-5 sm:p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Apple className="w-5 h-5 text-[#2E6B48] dark:text-[#9EC5AB]" />
            <div>
              <h2 className="text-base font-semibold text-[#111827] dark:text-[#F1F3F6]">
                Diet, Fruits &amp; Nutrient Guidance
              </h2>
              <p className="text-xs text-[#5B6472] dark:text-[#98A2B3]">
                Tailored to your{' '}
                {activeDiet === 'veg'
                  ? 'Vegetarian'
                  : activeDiet === 'non-veg'
                    ? 'Non-Vegetarian'
                    : 'Veg & Non-Veg'}{' '}
                preference
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {nutritionGroups.map((group) => (
              <div
                key={group.pillar}
                className="p-4 rounded-2xl bg-[#EEF7F1] dark:bg-[#16231D] border border-[#9EC5AB]/30 space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-[#1F5636] dark:text-[#9EC5AB]">
                    {group.pillar}
                  </h3>
                  <span className="text-[11px] text-[#5B6472] dark:text-[#98A2B3]">
                    {group.reason}
                  </span>
                </div>
                <ul className="space-y-1 text-xs text-[#334155] dark:text-[#D0D5DD] list-disc pl-4 leading-relaxed">
                  {group.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Recent Weight Log History */}
      {profile && profile.weightHistory.length > 0 && (
        <section className="rounded-3xl bg-white dark:bg-[#171A21] border border-slate-900/[0.08] dark:border-white/[0.07] p-5 sm:p-6 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-[#111827] dark:text-[#F1F3F6]">
                Weight Check-In History
              </h2>
              <p className="text-xs text-[#5B6472] dark:text-[#98A2B3]">
                {weightRecheck.nextDueDate && weightReminderDays > 0
                  ? `Next scheduled check-in: ${formatShortDate(weightRecheck.nextDueDate)}`
                  : 'Monthly weight logs stored privately'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2.5">
            {[...profile.weightHistory]
              .reverse()
              .slice(0, 8)
              .map((entry) => (
                <div
                  key={`${entry.date}-${entry.weightKg}`}
                  className="px-3.5 py-2 rounded-2xl bg-[#ECEFF3] dark:bg-[#1D212A] border border-slate-900/[0.06] dark:border-white/[0.06]"
                >
                  <p className="text-[11px] text-[#5B6472] dark:text-[#98A2B3]">
                    {formatShortDate(entry.date)}
                  </p>
                  <p className="text-sm font-mono-tabular font-semibold text-[#111827] dark:text-[#F1F3F6]">
                    {entry.weightKg} kg
                  </p>
                </div>
              ))}
          </div>
        </section>
      )}
    </div>
  );
};
