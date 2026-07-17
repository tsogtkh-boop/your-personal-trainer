// Personalized meal plan generation: Mifflin-St Jeor TDEE, goal-adjusted
// calories, protein-first macros, and a food library per dietary preference.

import { Meal, MealPlan, UserProfile } from '../types';

const uid = () => Math.random().toString(36).slice(2, 10);

export function bmr(p: UserProfile): number {
  const s = p.sex === 'male' ? 5 : -161;
  return Math.round(10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age + s);
}

const ACTIVITY_MULT: Record<UserProfile['activityLevel'], number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  athlete: 1.9,
};

export function tdee(p: UserProfile): number {
  return Math.round(bmr(p) * ACTIVITY_MULT[p.activityLevel]);
}

interface FoodItem {
  name: string;
  kcal: number;
  p: number;
  c: number;
  f: number;
  tags: ('omnivore' | 'vegetarian' | 'vegan' | 'pescatarian')[];
  slot: 'breakfast' | 'lunch' | 'dinner' | 'snack';
}

const ALL: FoodItem['tags'] = ['omnivore', 'vegetarian', 'vegan', 'pescatarian'];
const VEGGIE: FoodItem['tags'] = ['omnivore', 'vegetarian', 'pescatarian'];

const FOODS: FoodItem[] = [
  { name: 'Oatmeal with berries & almond butter', kcal: 420, p: 14, c: 58, f: 15, tags: ALL, slot: 'breakfast' },
  { name: 'Greek yogurt, honey & granola', kcal: 380, p: 28, c: 45, f: 9, tags: VEGGIE, slot: 'breakfast' },
  { name: '3-egg omelette with spinach & toast', kcal: 450, p: 30, c: 32, f: 21, tags: VEGGIE, slot: 'breakfast' },
  { name: 'Tofu scramble with avocado toast', kcal: 440, p: 24, c: 42, f: 20, tags: ALL, slot: 'breakfast' },
  { name: 'Protein smoothie (banana, oats, whey/pea)', kcal: 400, p: 35, c: 48, f: 8, tags: ALL, slot: 'breakfast' },

  { name: 'Grilled chicken, rice & broccoli', kcal: 560, p: 45, c: 62, f: 12, tags: ['omnivore'], slot: 'lunch' },
  { name: 'Salmon poke bowl', kcal: 540, p: 38, c: 58, f: 16, tags: ['omnivore', 'pescatarian'], slot: 'lunch' },
  { name: 'Lentil & quinoa power bowl', kcal: 520, p: 26, c: 74, f: 13, tags: ALL, slot: 'lunch' },
  { name: 'Turkey wrap with hummus & veg', kcal: 480, p: 36, c: 48, f: 15, tags: ['omnivore'], slot: 'lunch' },
  { name: 'Halloumi & chickpea salad', kcal: 510, p: 25, c: 40, f: 26, tags: VEGGIE, slot: 'lunch' },
  { name: 'Tempeh stir-fry with brown rice', kcal: 530, p: 30, c: 62, f: 16, tags: ALL, slot: 'lunch' },

  { name: 'Lean beef chili with sweet potato', kcal: 590, p: 42, c: 55, f: 19, tags: ['omnivore'], slot: 'dinner' },
  { name: 'Baked cod, potatoes & green beans', kcal: 500, p: 40, c: 52, f: 11, tags: ['omnivore', 'pescatarian'], slot: 'dinner' },
  { name: 'Chicken fajita bowl', kcal: 570, p: 44, c: 58, f: 16, tags: ['omnivore'], slot: 'dinner' },
  { name: 'Black bean & veggie burrito bowl', kcal: 540, p: 24, c: 78, f: 14, tags: ALL, slot: 'dinner' },
  { name: 'Paneer tikka with rice & dal', kcal: 580, p: 32, c: 60, f: 22, tags: VEGGIE, slot: 'dinner' },
  { name: 'Tofu curry with jasmine rice', kcal: 550, p: 26, c: 68, f: 18, tags: ALL, slot: 'dinner' },

  { name: 'Cottage cheese with pineapple', kcal: 200, p: 22, c: 18, f: 4, tags: VEGGIE, slot: 'snack' },
  { name: 'Protein shake', kcal: 180, p: 30, c: 8, f: 3, tags: ALL, slot: 'snack' },
  { name: 'Apple with peanut butter', kcal: 250, p: 7, c: 30, f: 12, tags: ALL, slot: 'snack' },
  { name: 'Handful of almonds & a banana', kcal: 260, p: 8, c: 30, f: 13, tags: ALL, slot: 'snack' },
  { name: 'Edamame with sea salt', kcal: 190, p: 17, c: 14, f: 8, tags: ALL, slot: 'snack' },
];

export function generateMealPlan(p: UserProfile): MealPlan {
  const maintenance = tdee(p);
  const goalAdj: Record<UserProfile['goal'], number> = {
    weight_loss: -0.18,
    muscle_gain: +0.12,
    strength: +0.05,
    endurance: 0,
  };
  const targetKcal = Math.round(maintenance * (1 + goalAdj[p.goal]));

  // protein-first macros
  const proteinPerKg = p.goal === 'muscle_gain' || p.goal === 'strength' ? 2.0 : 1.8;
  const proteinG = Math.round(p.weightKg * proteinPerKg);
  const fatG = Math.round((targetKcal * 0.27) / 9);
  const carbsG = Math.round((targetKcal - proteinG * 4 - fatG * 9) / 4);

  const pick = (slot: FoodItem['slot'], exclude: string[]): FoodItem => {
    const pool = FOODS.filter((f) => f.slot === slot && f.tags.includes(p.dietaryPreference) && !exclude.includes(f.name));
    return pool[Math.floor(Math.random() * pool.length)] ?? FOODS.find((f) => f.slot === slot)!;
  };

  const used: string[] = [];
  const slots: { slot: FoodItem['slot']; label: string; time: string }[] = [
    { slot: 'breakfast', label: 'Breakfast', time: '07:30' },
    { slot: 'lunch', label: 'Lunch', time: '12:30' },
    { slot: 'snack', label: 'Pre/Post-Workout Snack', time: '16:00' },
    { slot: 'dinner', label: 'Dinner', time: '19:30' },
  ];
  // add a second snack for surplus goals
  if (targetKcal > 2600) slots.push({ slot: 'snack', label: 'Evening Snack', time: '21:30' });

  const meals: Meal[] = slots.map(({ slot, label, time }) => {
    const f = pick(slot, used);
    used.push(f.name);
    return { name: label, time, items: [f.name], kcal: f.kcal, proteinG: f.p, carbsG: f.c, fatG: f.f };
  });

  // scale portions so meal total matches target calories
  const sum = meals.reduce((a, m) => a + m.kcal, 0);
  const scale = targetKcal / sum;
  for (const m of meals) {
    m.kcal = Math.round(m.kcal * scale);
    m.proteinG = Math.round(m.proteinG * scale);
    m.carbsG = Math.round(m.carbsG * scale);
    m.fatG = Math.round(m.fatG * scale);
    if (scale > 1.15) m.items[0] += ' (larger portion)';
    if (scale < 0.85) m.items[0] += ' (smaller portion)';
  }

  const notes = [
    `Maintenance ≈ ${maintenance} kcal. Target set ${targetKcal >= maintenance ? '+' : ''}${targetKcal - maintenance} kcal for ${p.goal.replace('_', ' ')}.`,
    `Aim for ${proteinG} g protein daily (~${proteinPerKg} g/kg bodyweight).`,
    'Drink 2.5–3.5 L of water; more on training days.',
    p.goal === 'weight_loss'
      ? 'Keep the deficit modest — losing 0.5–0.75% bodyweight per week preserves muscle.'
      : 'Eat your carbs around training for better sessions.',
  ];

  return {
    id: uid(),
    createdAt: new Date().toISOString(),
    targetKcal,
    proteinG,
    carbsG,
    fatG,
    tdee: maintenance,
    meals,
    notes,
  };
}
