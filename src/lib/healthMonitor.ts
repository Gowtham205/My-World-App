import type {
  BiologicalSex,
  DietPreference,
  HealthActivityLevel,
  HealthProfile,
} from '../types/sanctuary';

export type BmiCategoryId = 'underweight' | 'normal' | 'overweight' | 'obese';

export interface BmiAssessment {
  bmi: number;
  category: BmiCategoryId;
  label: string;
  shortLabel: string;
  colorHex: string;
  badgeBgClass: string;
  badgeTextClass: string;
  borderClass: string;
  pointerPercent: number; // 0..100 position along 14..38 BMI gauge
  healthyWeightRangeKg: { min: number; max: number };
  southAsianNote?: string;
  summary: string;
}

export interface AgeResult {
  years: number;
  months: number;
  bracket: 'young' | 'prime' | 'mature' | 'senior';
  label: string;
}

export interface FoodComparisonItem {
  id: string;
  name: string;
  serving: string;
  calories: number;
  diet: 'veg' | 'non-veg';
}

export interface ExerciseRecommendation {
  title: string;
  category: 'Cardio' | 'Running' | 'Stretching' | 'Strength';
  duration: string;
  frequency: string;
  approxKcal: number;
  guidance: string;
}

export interface NutritionSuggestionGroup {
  pillar: 'Fruits & Fiber' | 'Protein Sources' | 'Essential Nutrients & Hydration';
  items: string[];
  reason: string;
}

export const SUN_SIGNS = [
  'Aries (Mesha)',
  'Taurus (Vrishabha)',
  'Gemini (Mithuna)',
  'Cancer (Karka)',
  'Leo (Simha)',
  'Virgo (Kanya)',
  'Libra (Tula)',
  'Scorpio (Vrishchika)',
  'Sagittarius (Dhanu)',
  'Capricorn (Makara)',
  'Aquarius (Kumbha)',
  'Pisces (Meena)',
];

export const BIRTH_STARS_NAKSHATRA = [
  'Ashwini',
  'Bharani',
  'Krittika',
  'Rohini',
  'Mrigashira',
  'Ardra',
  'Punarvasu',
  'Pushya',
  'Ashlesha',
  'Magha',
  'Purva Phalguni',
  'Uttara Phalguni',
  'Hasta',
  'Chitra',
  'Swati',
  'Vishakha',
  'Anuradha',
  'Jyeshtha',
  'Mula',
  'Purva Ashadha',
  'Uttara Ashadha',
  'Shravana',
  'Dhanishta',
  'Shatabhisha',
  'Purva Bhadrapada',
  'Uttara Bhadrapada',
  'Revati',
];

export const FOOD_CALORIE_CATALOG: FoodComparisonItem[] = [
  { id: 'chai', name: 'Cup of Milk Chai', serving: '1 cup (150ml)', calories: 95, diet: 'veg' },
  { id: 'banana', name: 'Medium Banana', serving: '1 fruit (118g)', calories: 105, diet: 'veg' },
  { id: 'idli', name: 'Steamed Idli (2 pcs)', serving: '2 pieces + chutney', calories: 155, diet: 'veg' },
  { id: 'egg', name: '2 Boiled Eggs', serving: '2 whole eggs', calories: 156, diet: 'non-veg' },
  { id: 'dosa', name: 'Masala Dosa', serving: '1 crisp dosa', calories: 210, diet: 'veg' },
  { id: 'paneer', name: 'Grilled Paneer Tikka', serving: '150g serving', calories: 260, diet: 'veg' },
  { id: 'samosa', name: '1 Punjabi Samosa', serving: '1 piece', calories: 265, diet: 'veg' },
  { id: 'chicken', name: 'Grilled Chicken Bowl', serving: '180g + greens', calories: 320, diet: 'non-veg' },
  { id: 'dal-rice', name: 'Home Dal & Rice Bowl', serving: '1 standard bowl', calories: 340, diet: 'veg' },
  { id: 'biryani', name: 'Chicken Biryani (Half)', serving: '1 medium plate', calories: 450, diet: 'non-veg' },
];

export function calculateAgeFromDob(dobStr: string): AgeResult | null {
  if (!dobStr || !/^\d{4}-\d{2}-\d{2}$/.test(dobStr)) return null;
  const [y, m, d] = dobStr.split('-').map(Number);
  const birth = new Date(y, m - 1, d);
  const today = new Date();
  if (Number.isNaN(birth.getTime()) || birth > today) return null;

  let years = today.getFullYear() - birth.getFullYear();
  let months = today.getMonth() - birth.getMonth();
  if (today.getDate() < birth.getDate()) {
    months -= 1;
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  if (years < 0) return null;

  const bracket: AgeResult['bracket'] =
    years < 30 ? 'young' : years < 50 ? 'prime' : years < 65 ? 'mature' : 'senior';

  return {
    years,
    months,
    bracket,
    label: `${years} yrs${months > 0 ? `, ${months} mo` : ''}`,
  };
}

export function inferSunSignFromDob(dobStr: string): string | null {
  if (!dobStr || !/^\d{4}-\d{2}-\d{2}$/.test(dobStr)) return null;
  const month = Number(dobStr.slice(5, 7));
  const day = Number(dobStr.slice(8, 10));
  if ((month === 3 && day >= 21) || (month === 4 && day <= 19)) return SUN_SIGNS[0];
  if ((month === 4 && day >= 20) || (month === 5 && day <= 20)) return SUN_SIGNS[1];
  if ((month === 5 && day >= 21) || (month === 6 && day <= 20)) return SUN_SIGNS[2];
  if ((month === 6 && day >= 21) || (month === 7 && day <= 22)) return SUN_SIGNS[3];
  if ((month === 7 && day >= 23) || (month === 8 && day <= 22)) return SUN_SIGNS[4];
  if ((month === 8 && day >= 23) || (month === 9 && day <= 22)) return SUN_SIGNS[5];
  if ((month === 9 && day >= 23) || (month === 10 && day <= 22)) return SUN_SIGNS[6];
  if ((month === 10 && day >= 23) || (month === 11 && day <= 21)) return SUN_SIGNS[7];
  if ((month === 11 && day >= 22) || (month === 12 && day <= 21)) return SUN_SIGNS[8];
  if ((month === 12 && day >= 22) || (month === 1 && day <= 19)) return SUN_SIGNS[9];
  if ((month === 1 && day >= 20) || (month === 2 && day <= 18)) return SUN_SIGNS[10];
  return SUN_SIGNS[11];
}

export function assessBmi(weightKg: number, heightCm: number): BmiAssessment {
  const safeHeightM = Math.max(0.8, heightCm / 100);
  const rawBmi = weightKg / (safeHeightM * safeHeightM);
  const bmi = Math.round(rawBmi * 10) / 10;

  const minHealthy = Math.round(18.5 * safeHeightM * safeHeightM * 10) / 10;
  const maxHealthy = Math.round(24.9 * safeHeightM * safeHeightM * 10) / 10;

  // Map BMI 14..38 to 0..100% across the colored spectrum bar
  const clamped = Math.max(14, Math.min(38, bmi));
  const pointerPercent = Math.round(((clamped - 14) / (38 - 14)) * 100);

  if (bmi < 18.5) {
    return {
      bmi,
      category: 'underweight',
      label: 'Underweight',
      shortLabel: 'Underweight (<18.5)',
      colorHex: '#9BC4E2',
      badgeBgClass: 'bg-[#E7F3FB] dark:bg-[#172634]',
      badgeTextClass: 'text-[#1E567F] dark:text-[#9BC4E2]',
      borderClass: 'border-[#9BC4E2]/55',
      pointerPercent,
      healthyWeightRangeKg: { min: minHealthy, max: maxHealthy },
      summary:
        'Your BMI is below the standard healthy band. Nourishing protein-rich meals and light resistance training can help build steady strength.',
    };
  }

  if (bmi < 25) {
    return {
      bmi,
      category: 'normal',
      label: 'Normal Weight',
      shortLabel: 'Normal (18.5–24.9)',
      colorHex: '#9EC5AB',
      badgeBgClass: 'bg-[#EAF5EE] dark:bg-[#172821]',
      badgeTextClass: 'text-[#1F5636] dark:text-[#9EC5AB]',
      borderClass: 'border-[#9EC5AB]/55',
      pointerPercent,
      healthyWeightRangeKg: { min: minHealthy, max: maxHealthy },
      southAsianNote:
        bmi >= 23
          ? 'South Asian wellness guidelines consider 18.5–22.9 ideal for lower metabolic risk—staying active keeps you right on track.'
          : undefined,
      summary:
        'You are within the balanced healthy BMI range. Maintain steady daily movement, good sleep, and nutrient-diverse meals.',
    };
  }

  if (bmi < 30) {
    return {
      bmi,
      category: 'overweight',
      label: 'Overweight',
      shortLabel: 'Overweight (25.0–29.9)',
      colorHex: '#EDD59E',
      badgeBgClass: 'bg-[#FCF5E6] dark:bg-[#292316]',
      badgeTextClass: 'text-[#7A5714] dark:text-[#EDD59E]',
      borderClass: 'border-[#EDD59E]/65',
      pointerPercent,
      healthyWeightRangeKg: { min: minHealthy, max: maxHealthy },
      summary:
        'Slightly above the healthy BMI range. Consistent brisk walks, protein-first meals, and modest calorie balance support gradual improvement.',
    };
  }

  return {
    bmi,
    category: 'obese',
    label: 'Obese',
    shortLabel: 'Obese (30.0+)',
    colorHex: '#F2B8A2',
    badgeBgClass: 'bg-[#FDF1EB] dark:bg-[#2A1B18]',
    badgeTextClass: 'text-[#9A3E24] dark:text-[#F2B8A2]',
    borderClass: 'border-[#F2B8A2]/60',
    pointerPercent,
    healthyWeightRangeKg: { min: minHealthy, max: maxHealthy },
    summary:
      'In the elevated BMI zone. Prioritize low-impact daily movement (walking, swimming, stretching) and high-fiber whole foods without crash dieting.',
  };
}

export function calculateDailyEnergyMetrics(params: {
  weightKg: number;
  heightCm: number;
  ageYears: number;
  sex?: BiologicalSex;
  activityLevel: HealthActivityLevel;
}): { bmr: number; tdee: number; hydrationLiters: number } {
  const { weightKg, heightCm, ageYears, sex = 'other', activityLevel } = params;
  const sexOffset = sex === 'male' ? 5 : sex === 'female' ? -161 : -78;
  const bmr = Math.round(10 * weightKg + 6.25 * heightCm - 5 * ageYears + sexOffset);
  const multiplier =
    activityLevel === 'sedentary'
      ? 1.2
      : activityLevel === 'light'
        ? 1.375
        : activityLevel === 'moderate'
          ? 1.55
          : 1.725;
  const tdee = Math.round(bmr * multiplier);
  const hydrationLiters = Math.round(Math.max(1.8, Math.min(4.2, weightKg * 0.033)) * 10) / 10;
  return { bmr: Math.max(900, bmr), tdee: Math.max(1200, tdee), hydrationLiters };
}

export function calculateStepsBurn(steps: number, weightKg = 68, heightCm = 168): {
  caloriesBurned: number;
  distanceKm: number;
  activeMinutes: number;
} {
  const safeSteps = Math.max(0, Math.round(steps));
  const safeWeight = Math.max(30, weightKg || 68);
  const strideMeters = Math.max(0.55, Math.min(0.95, (heightCm || 168) * 0.00415));
  const distanceKm = Math.round(((safeSteps * strideMeters) / 1000) * 100) / 100;
  // Walking burns roughly ~0.85-0.95 kcal per kg per km, or ~0.04 * (weightKg/70) per step
  const caloriesBurned = Math.round(distanceKm * safeWeight * 0.9);
  const activeMinutes = Math.round(safeSteps / 100);
  return { caloriesBurned, distanceKm, activeMinutes };
}

export function getFoodComparisonResults(
  caloriesBurned: number,
  dietPreference: DietPreference,
  weightKg = 68,
  heightCm = 168
): Array<
  FoodComparisonItem & {
    servingsBurned: number;
    stepsPerServing: number;
    progressPct: number;
  }
> {
  const pool = FOOD_CALORIE_CATALOG.filter((item) => {
    if (dietPreference === 'veg') return item.diet === 'veg';
    return true;
  });

  const burnPerStep = Math.max(0.02, calculateStepsBurn(1000, weightKg, heightCm).caloriesBurned / 1000);

  return pool.slice(0, 6).map((item) => {
    const servingsBurned = Math.round((caloriesBurned / item.calories) * 10) / 10;
    const stepsPerServing = Math.round(item.calories / burnPerStep);
    const progressPct = Math.min(100, Math.round((caloriesBurned / item.calories) * 100));
    return {
      ...item,
      servingsBurned,
      stepsPerServing,
      progressPct,
    };
  });
}

export function getExerciseRecommendations(
  bmiAssessment: BmiAssessment,
  age: AgeResult | null
): ExerciseRecommendation[] {
  const isMatureOrSenior = age ? age.bracket === 'mature' || age.bracket === 'senior' : false;

  if (bmiAssessment.category === 'underweight') {
    return [
      {
        title: 'Controlled Bodyweight Strength',
        category: 'Strength',
        duration: '25–30 min',
        frequency: '3–4 days/week',
        approxKcal: 150,
        guidance: 'Squats, wall/incline push-ups, and resistance bands help convert calories into healthy lean muscle.',
      },
      {
        title: 'Moderate Brisk Walking',
        category: 'Cardio',
        duration: '20 min',
        frequency: 'Daily',
        approxKcal: 90,
        guidance: 'Light aerobic walk improves appetite and heart health without excessive calorie deficit.',
      },
      {
        title: 'Surya Namaskar & Mobility Flow',
        category: 'Stretching',
        duration: '15 min',
        frequency: 'Morning',
        approxKcal: 65,
        guidance: 'Gentle full-body spinal stretching improves posture and digestive readiness.',
      },
    ];
  }

  if (bmiAssessment.category === 'overweight' || bmiAssessment.category === 'obese') {
    const cardioTitle =
      bmiAssessment.category === 'obese' || isMatureOrSenior
        ? 'Low-Impact Brisk Walking / Cycling'
        : 'Interval Walk–Jog Cardio';
    const runningTitle =
      bmiAssessment.category === 'obese' || isMatureOrSenior
        ? 'Incline Walk or Pool Movement'
        : 'Easy Pace Jogging Intervals';

    return [
      {
        title: cardioTitle,
        category: 'Cardio',
        duration: '30–40 min',
        frequency: '5 days/week',
        approxKcal: 240,
        guidance:
          'Steady Zone-2 movement protects knees and joints while tapping fat oxidation effectively.',
      },
      {
        title: runningTitle,
        category: 'Running',
        duration: '20 min',
        frequency: '3 days/week',
        approxKcal: 185,
        guidance:
          bmiAssessment.category === 'obese' || isMatureOrSenior
            ? 'Use gentle incline or elliptical strides rather than hard pavement impact to stay injury-free.'
            : 'Alternate 2 minutes of easy jogging with 2 minutes of brisk walking to build stamina safely.',
      },
      {
        title: 'Hip, Calf & Shoulder Unwind Stretch',
        category: 'Stretching',
        duration: '12–15 min',
        frequency: 'Daily evening',
        approxKcal: 45,
        guidance:
          'Reduces lower-back stiffness after work and speeds up recovery after longer walks.',
      },
    ];
  }

  // Normal BMI
  return [
    {
      title: isMatureOrSenior ? 'Brisk Tempo Walk & Core Stability' : 'Endurance Running / Zone-2 Run',
      category: 'Running',
      duration: '25–35 min',
      frequency: '3–4 days/week',
      approxKcal: 260,
      guidance: isMatureOrSenior
        ? 'Keep pace conversational while maintaining upright posture and steady arm swing.'
        : 'Builds VO2 max, stamina, and mood-lifting endorphins at a comfortable conversational pace.',
    },
    {
      title: 'Mixed Cardio & Functional Circuits',
      category: 'Cardio',
      duration: '25 min',
      frequency: '3 days/week',
      approxKcal: 210,
      guidance: 'Combine cycling, jumping jacks, or stair climbs with lunges and planks for total fitness.',
    },
    {
      title: 'Full-Body Morning Mobility & Stretch',
      category: 'Stretching',
      duration: '15 min',
      frequency: 'Daily',
      approxKcal: 50,
      guidance: 'Cat-cow, hamstring stretches, and thoracic twists keep joints supple across every decade.',
    },
  ];
}

export function getNutritionSuggestions(
  bmiAssessment: BmiAssessment,
  age: AgeResult | null,
  diet: DietPreference
): NutritionSuggestionGroup[] {
  const isMatureOrSenior = age ? age.years >= 45 : false;

  const fruitsByCategory =
    bmiAssessment.category === 'underweight'
      ? [
          'Banana, mango, dates & figs for wholesome natural energy',
          'Avocado or peanut-banana smoothie post-workout',
          'Apple with almond butter as a nutrient-dense snack',
        ]
      : bmiAssessment.category === 'overweight' || bmiAssessment.category === 'obese'
        ? [
            'High-fiber whole fruits: guava, papaya, apple, pear, and berries',
            'Citrus fruits (orange, sweet lime) to boost Vitamin C & fullness',
            'Swap fruit juices for whole fruit + chia seeds to slow sugar spikes',
          ]
        : [
            'Seasonal rainbow mix: pomegranate, berries, guava, apple, and kiwi',
            'Pre-walk banana or orange for clean natural energy',
            'Cucumber, carrot & mint salad before main meals for digestion',
          ];

  const proteinItems: string[] = [];
  if (diet === 'veg') {
    proteinItems.push(
      'Paneer / Tofu (100–150g), Greek yogurt / thick curd, and roasted chana',
      'Moong dal chilla, sprouted legumes, rajma, and soy chunks for complete amino acids',
      'Handful of soaked almonds, walnuts & pumpkin seeds'
    );
  } else if (diet === 'non-veg') {
    proteinItems.push(
      'Boiled/poached eggs (2 whole or 3 egg whites) for bioavailable morning protein',
      'Grilled chicken breast or lean fish (rohu, salmon, mackerel) rich in Omega-3',
      'Light bone/chicken broth or spiced tandoori lean cuts without heavy cream'
    );
  } else {
    proteinItems.push(
      'Alternate plant days (paneer, dal sprouts, curd, soy) with eggs or grilled fish/chicken',
      'Morning 2 eggs or moong sprouts + dinner grilled fish or paneer stir-fry',
      'Mixed nuts & seeds (flax, chia, almonds) for Omega-3 & satiety'
    );
  }

  const nutrientItems = [
    isMatureOrSenior
      ? 'Calcium & Vitamin D focus: morning sunlight (15m), sesame seeds, ragi, and curd/milk'
      : 'Iron + Vitamin C pairing: spinach/methi greens with a squeeze of lemon',
    diet === 'veg'
      ? 'Keep Vitamin B12, Vitamin D3 & Omega-3 (walnuts/flaxseed) checked in annual blood work'
      : 'Balance plate rule: 1/2 colorful vegetables, 1/4 clean protein, 1/4 whole grains (millets/brown rice/roti)',
    'Minimize ultra-processed snacks and finish dinner 2 hours before sleep for deeper rest',
  ];

  const goalTag =
    bmiAssessment.category === 'underweight'
      ? 'Calorie-rich wholesome nourishment'
      : bmiAssessment.category === 'overweight' || bmiAssessment.category === 'obese'
        ? 'High-satiety fiber & clean protein balance'
        : 'Balanced maintenance & micronutrient variety';

  return [
    {
      pillar: 'Fruits & Fiber',
      items: fruitsByCategory,
      reason: goalTag,
    },
    {
      pillar: 'Protein Sources',
      items: proteinItems,
      reason: `Tailored for ${diet === 'veg' ? 'Vegetarian' : diet === 'non-veg' ? 'Non-Vegetarian' : 'Veg & Non-Veg'} meals`,
    },
    {
      pillar: 'Essential Nutrients & Hydration',
      items: nutrientItems,
      reason: age ? `Calibrated for age ${age.years}` : 'Daily foundational nutrients',
    },
  ];
}

/**
 * Computes static step milestone notifications:
 * First milestone at 1,000 steps, then every 5,000-step gap (5,000, 10,000, 15,000, 20,000...).
 */
export function getReachedStepMilestones(steps: number): number[] {
  const safe = Math.floor(steps);
  if (safe < 1000) return [];
  const milestones = [1000];
  for (let m = 5000; m <= safe && m <= 100000; m += 5000) {
    milestones.push(m);
  }
  return milestones;
}

export function getNextStepMilestone(steps: number): number {
  if (steps < 1000) return 1000;
  if (steps < 5000) return 5000;
  return Math.floor(steps / 5000 + 1) * 5000;
}

export function formatHeightImperial(heightCm: number): string {
  const totalInches = Math.round(heightCm / 2.54);
  const feet = Math.floor(totalInches / 12);
  const inches = totalInches % 12;
  return `${feet}'${inches}"`;
}

export function isWeightRecheckDue(profile: HealthProfile | null, todayStr: string): {
  due: boolean;
  daysElapsed: number;
  nextDueDate: string | null;
} {
  if (!profile || !profile.weightReminderDays || profile.weightReminderDays <= 0) {
    return { due: false, daysElapsed: 0, nextDueDate: null };
  }
  const lastStr = profile.lastWeightLoggedAt || profile.updatedAt.slice(0, 10);
  const [ly, lm, ld] = lastStr.split('-').map(Number);
  const [ty, tm, td] = todayStr.split('-').map(Number);
  if ([ly, lm, ld, ty, tm, td].some((n) => Number.isNaN(n))) {
    return { due: false, daysElapsed: 0, nextDueDate: null };
  }
  const lastDt = new Date(ly, lm - 1, ld, 9, 0, 0, 0);
  const todayDt = new Date(ty, tm - 1, td, 9, 0, 0, 0);
  const daysElapsed = Math.max(0, Math.round((todayDt.getTime() - lastDt.getTime()) / 86_400_000));
  const nextDt = new Date(lastDt.getTime() + profile.weightReminderDays * 86_400_000);
  const nextDueDate = `${nextDt.getFullYear()}-${String(nextDt.getMonth() + 1).padStart(
    2,
    '0'
  )}-${String(nextDt.getDate()).padStart(2, '0')}`;
  return {
    due: daysElapsed >= profile.weightReminderDays,
    daysElapsed,
    nextDueDate,
  };
}
