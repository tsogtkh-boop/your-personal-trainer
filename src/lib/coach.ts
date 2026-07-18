// The AI coach. Two brains behind one interface:
//  1. Built-in offline coach — rule-based, context-aware, always available.
//  2. Optional Claude API coach — if the user adds an API key in Profile,
//     replies come from Claude with full training context.

import { MealPlan, RecoveryEntry, TrainingPlan, UserProfile, WorkoutLog } from '../types';
import { DEFAULT_EXERCISES } from './exercises';
import { analyzeRecovery } from './recovery';
import { dailyReadiness } from './fatigue';
import { Units, displayWeight, weightUnit } from './units';

export interface CoachContext {
  name: string;
  profile: UserProfile;
  plan: TrainingPlan | null;
  mealPlan: MealPlan | null;
  logs: WorkoutLog[];
  recovery: RecoveryEntry[];
  units: Units;
}

const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

function progressSummary(ctx: CoachContext): string {
  if (!ctx.logs.length) return `You haven't logged a workout yet, ${ctx.name}. Today is a great day to start.`;
  const last = ctx.logs[ctx.logs.length - 1];
  const week = ctx.logs.filter((l) => Date.now() - new Date(l.date).getTime() < 7 * 864e5);
  const avgForm = Math.round(week.reduce((a, b) => a + (b.avgFormScore || 0), 0) / Math.max(1, week.length));
  const mins = week.reduce((a, b) => a + b.durationMin, 0);
  return (
    `This week: ${week.length} session${week.length === 1 ? '' : 's'}, ${mins} min of coached training, average form score ${avgForm}/100. ` +
    `Last session you trained ${last.exercises.length} exercise${last.exercises.length === 1 ? '' : 's'} at form ${Math.round(last.avgFormScore)}/100. ` +
    (week.length >= 3 ? 'Consistency is elite right now — keep the streak alive. 🔥' : 'One more session this week and the momentum compounds.')
  );
}

function todayAdvice(ctx: CoachContext): string {
  const readiness = dailyReadiness(ctx.recovery.slice(-7));
  const dayIdx = ctx.logs.length % (ctx.plan?.days.length || 1);
  const day = ctx.plan?.days[dayIdx];
  const dayLine = day
    ? `Up next in your plan: ${day.name} (${day.focus}) — ${day.exercises.map((e) => e.name).join(', ')}.`
    : 'You have no training plan yet — generate one in the Plan tab and I will tailor every session.';
  return `Readiness ${readiness.score}/100. ${readiness.advice} ${dayLine}`;
}

function formAnswer(text: string): string | null {
  const t = text.toLowerCase();
  for (const ex of DEFAULT_EXERCISES) {
    if (t.includes(ex.name.toLowerCase()) || t.includes(ex.id.replace('_', ' '))) {
      return `${ex.name} — my top cues: ${ex.cues.join('. ')}. It mainly works your ${ex.muscles.join(', ')}. Start the camera in Workout and I'll watch your technique and coach you live.`;
    }
  }
  return null;
}

export function localCoachReply(ctx: CoachContext, userText: string): string {
  const t = userText.toLowerCase().trim();

  if (/^(hi|hey|hello|yo|sup|good (morning|afternoon|evening))\b/.test(t)) {
    return pick([
      `Hey ${ctx.name}! Ready to put in some work? Ask me about today's session, food, or form — or just hit the Workout tab.`,
      `${ctx.name}! Good to see you. ${todayAdvice(ctx)}`,
    ]);
  }
  if (/(what|which).*(today|workout|session|train)/.test(t) || /today'?s (workout|plan)/.test(t) || /should i (train|do)/.test(t)) {
    return todayAdvice(ctx);
  }
  if (/(how am i doing|progress|am i improving|stats|summary)/.test(t)) {
    return progressSummary(ctx);
  }
  if (/(tired|exhausted|sore|fatigued|no energy|rough night|didn'?t sleep)/.test(t)) {
    const r = analyzeRecovery(ctx.recovery);
    return `Heard. ${r.headline}. ${r.details[r.details.length - 1] ?? ''} Listen to your body — a lighter session beats a skipped week. Want me to scale today down? Just say "make this easier" during the workout.`;
  }
  if (/(form|technique|how (do|to)|cues?)/.test(t)) {
    const ans = formAnswer(t);
    if (ans) return ans;
    return 'Tell me which exercise — squat, deadlift, bench, curls, pull-ups… — and I will give you my exact cues. Better yet, open the camera in Workout and I will correct you rep by rep.';
  }
  const exAns = formAnswer(t);
  if (exAns) return exAns;
  if (/(protein|eat|food|meal|diet|calorie|nutrition|hungry)/.test(t)) {
    if (ctx.mealPlan) {
      return `Your plan: ${ctx.mealPlan.targetKcal} kcal — ${ctx.mealPlan.proteinG}P / ${ctx.mealPlan.carbsG}C / ${ctx.mealPlan.fatG}F. ${pick(ctx.mealPlan.notes)} Full menu is in the Meals tab.`;
    }
    return 'Generate a meal plan in the Meals tab and I will set your calories and macros from your body stats and goal. Rule #1 either way: hit your protein.';
  }
  if (/(motivat|can'?t do|give up|lazy|don'?t feel like|skip)/.test(t)) {
    return pick([
      `You don't need motivation, ${ctx.name} — you need 10 minutes. Start the warm-up and momentum does the rest. I'll be counting with you.`,
      'Discipline beats motivation. The version of you 12 weeks from now is built on days exactly like this one. Let’s get one quality set.',
    ]);
  }
  if (/(sleep|recovery|hrv|rest day)/.test(t)) {
    const r = analyzeRecovery(ctx.recovery);
    return `${r.headline}. ${r.details.slice(0, 3).join(' ')}`;
  }
  if (/(goal|plan|program)/.test(t)) {
    return ctx.plan
      ? `You're on "${ctx.plan.name}" — ${ctx.plan.daysPerWeek} days/week for ${ctx.plan.weeks} weeks. Progression: ${ctx.plan.progression}`
      : 'No plan yet. Go to the Plan tab, pick your training days, and I will build a progressive program for your goal.';
  }
  if (/(thank|nice|great|awesome|love)/.test(t)) {
    return pick(['Anytime. Now go earn that shower. 💪', "That's what I'm here for. Same time tomorrow?"]);
  }
  return pick([
    `I'm your coach, not a search engine — but try me on training, form, food, recovery or your plan. For example: "what should I train today?" or "how's my squat form?"`,
    `Let's keep it practical: ask about today's session, an exercise, your macros, or say "how am I doing?" for a progress check.`,
  ]);
}

function buildSystemPrompt(ctx: CoachContext): string {
  const u = weightUnit(ctx.units);
  const recent = ctx.logs.slice(-3).map((l) => ({
    date: l.date.slice(0, 10),
    avgFormScore: Math.round(l.avgFormScore),
    exercises: l.exercises.map(
      (e) => `${e.name} ${e.sets.map((s) => `form ${s.grade}${s.weightKg ? ` @${displayWeight(s.weightKg, ctx.units)}${u}` : ''}`).join(', ')}`,
    ),
  }));
  const rec = analyzeRecovery(ctx.recovery);
  return [
    `You are "Coach", an elite personal trainer inside a fitness app. Voice: warm, direct, motivating, concise (2-5 sentences), practical. Use the client's data below. Never invent data you don't have. Always express weights in ${u === 'lb' ? 'pounds (lb)' : 'kilograms (kg)'}.`,
    `Client: ${ctx.name}, ${ctx.profile.age}yo ${ctx.profile.sex}, ${ctx.profile.heightCm}cm, ${displayWeight(ctx.profile.weightKg, ctx.units)}${u}, goal: ${ctx.profile.goal}, experience: ${ctx.profile.experience}.`,
    ctx.plan ? `Current plan: ${ctx.plan.name}. Progression: ${ctx.plan.progression}` : 'No training plan yet.',
    ctx.mealPlan
      ? `Nutrition targets: ${ctx.mealPlan.targetKcal} kcal, ${ctx.mealPlan.proteinG}g protein, ${ctx.mealPlan.carbsG}g carbs, ${ctx.mealPlan.fatG}g fat.`
      : 'No meal plan yet.',
    `Recovery: ${rec.headline}.`,
    recent.length ? `Recent workouts: ${JSON.stringify(recent)}` : 'No workouts logged yet.',
  ].join('\n');
}

// Direct REST call to the Anthropic Messages API. We use fetch rather than the
// official SDK so the app bundles for native (Expo Go): the SDK pulls in
// `node:fs`, which Metro can't resolve for iOS/Android. The
// `anthropic-dangerous-direct-browser-access` header enables the client-side
// call from the web build too.
export async function claudeCoachReply(
  apiKey: string,
  ctx: CoachContext,
  history: { role: 'user' | 'assistant'; content: string }[],
): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-opus-4-8',
      max_tokens: 1024,
      system: buildSystemPrompt(ctx),
      messages: history,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} ${detail.slice(0, 200)}`);
  }
  const data: { content?: { type: string; text?: string }[] } = await res.json();
  const text = (data.content ?? [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text ?? '')
    .join('\n');
  return text || 'Hmm, I lost my train of thought — ask me again?';
}
