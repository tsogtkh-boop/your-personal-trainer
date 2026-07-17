import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Body, Button, Card, Chip, Input, Row, Title } from '../components/UI';
import { colors, spacing } from '../theme';
import { useStore } from '../store/useStore';
import { CoachContext, claudeCoachReply, localCoachReply } from '../lib/coach';
import { speak } from '../lib/voice';

const uid = () => Math.random().toString(36).slice(2, 12);

const SUGGESTIONS = [
  'What should I train today?',
  'How am I doing?',
  "How's my squat form?",
  'How much protein should I eat?',
  "I'm feeling tired today",
  'Motivate me',
];

export const CoachScreen: React.FC = () => {
  const store = useStore();
  const user = store.currentUser();
  const data = store.data();
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const usingClaude = !!store.settings.claudeApiKey;

  useEffect(() => {
    if (data.chat.length === 0 && user) {
      store.addChat({
        id: uid(),
        role: 'coach',
        text: `Hey ${user.name}! I'm your coach. I can see your plan, meals, workouts and recovery — ask me anything, or tap a suggestion below. During workouts I'll watch your form through the camera and talk you through every set.`,
        ts: Date.now(),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
  }, [data.chat.length]);

  const send = async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || !user) return;
    setInput('');
    store.addChat({ id: uid(), role: 'user', text: msg, ts: Date.now() });
    setBusy(true);

    const ctx: CoachContext = {
      name: user.name,
      profile: user.profile,
      plan: data.plan,
      mealPlan: data.mealPlan,
      logs: data.logs,
      recovery: data.recovery,
    };

    let reply: string;
    if (usingClaude) {
      try {
        const history = [...data.chat, { id: '', role: 'user' as const, text: msg, ts: 0 }]
          .slice(-12)
          .map((m) => ({ role: m.role === 'coach' ? ('assistant' as const) : ('user' as const), content: m.text }));
        reply = await claudeCoachReply(store.settings.claudeApiKey, ctx, history);
      } catch (err: any) {
        reply = `(Claude API error: ${err?.message ?? 'unknown'} — falling back to built-in coach)\n\n${localCoachReply(ctx, msg)}`;
      }
    } else {
      await new Promise((r) => setTimeout(r, 350)); // feel like thinking
      reply = localCoachReply(ctx, msg);
    }

    store.addChat({ id: uid(), role: 'coach', text: reply, ts: Date.now() });
    if (store.settings.voiceEnabled) speak(reply.slice(0, 220));
    setBusy(false);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ padding: spacing(2), paddingBottom: 0, maxWidth: 860, width: '100%', alignSelf: 'center' }}>
        <Title>Coach</Title>
        <Body dim style={{ marginBottom: spacing(1) }}>
          {usingClaude ? '⚡ Live AI coach (Claude) with your full training context' : '🤖 Built-in coach · add a Claude API key in Profile for the full LLM experience'}
        </Body>
      </View>

      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: spacing(2), maxWidth: 860, width: '100%', alignSelf: 'center' }}
      >
        {data.chat.map((m) => (
          <View
            key={m.id}
            style={{
              alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
              backgroundColor: m.role === 'user' ? colors.primaryDark : colors.surface,
              borderRadius: 14,
              borderBottomRightRadius: m.role === 'user' ? 4 : 14,
              borderBottomLeftRadius: m.role === 'coach' ? 4 : 14,
              padding: spacing(1.5),
              marginBottom: spacing(1),
              maxWidth: '85%',
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text style={{ color: colors.text, fontSize: 15, lineHeight: 21 }}>{m.text}</Text>
          </View>
        ))}
        {busy && (
          <Body dim style={{ marginBottom: spacing(1) }}>Coach is typing…</Body>
        )}
      </ScrollView>

      <View style={{ padding: spacing(2), paddingTop: spacing(1), maxWidth: 860, width: '100%', alignSelf: 'center' }}>
        <Row style={{ flexWrap: 'wrap', marginBottom: spacing(1) }}>
          {SUGGESTIONS.map((s) => (
            <Chip key={s} label={s} onPress={() => send(s)} />
          ))}
        </Row>
        <Row>
          <Input
            value={input}
            onChangeText={setInput}
            placeholder="Ask your coach anything…"
            style={{ flex: 1, marginBottom: 0 }}
          />
          <Button title="Send" onPress={() => send()} disabled={busy || !input.trim()} />
        </Row>
      </View>
    </View>
  );
};
