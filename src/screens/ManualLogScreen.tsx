// Standalone quick-log — record a workout you already did without the camera.
// Pick exercises, punch in sets × reps × weight, and it's saved to your history
// exactly like a coached session (just with no form grade).

import React, { useState } from 'react';
import { View } from 'react-native';
import { Body, Button, Card, Chip, H1, Input, Row, Screen, Stat, Title } from '../components/UI';
import { colors, spacing } from '../theme';
import { useStore } from '../store/useStore';
import { Exercise } from '../lib/exercises';
import { ExerciseLog, SetLog, WorkoutLog } from '../types';
import { displayWeight, parseWeightToKg, weightUnit } from '../lib/units';

const uid = () => Math.random().toString(36).slice(2, 12);

interface DraftSet {
  reps: string;
  weight: string; // shown in the user's chosen unit
}

interface DraftExercise {
  ex: Exercise;
  sets: DraftSet[];
}

export const ManualLogScreen: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const store = useStore();
  const units = store.settings.units;
  const library = store.exercises();
  const u = weightUnit(units);

  const [drafts, setDrafts] = useState<DraftExercise[]>([]);
  const [saved, setSaved] = useState(false);

  const addExercise = (ex: Exercise) => {
    if (drafts.some((d) => d.ex.id === ex.id)) return;
    const w = ex.weighted ? displayWeight(ex.defaultWeightKg || 0, units) : '';
    setDrafts((d) => [...d, { ex, sets: [{ reps: '', weight: w }, { reps: '', weight: w }, { reps: '', weight: w }] }]);
  };

  const removeExercise = (id: string) => setDrafts((d) => d.filter((x) => x.ex.id !== id));

  const patchSet = (exId: string, setIdx: number, patch: Partial<DraftSet>) =>
    setDrafts((d) =>
      d.map((x) =>
        x.ex.id === exId ? { ...x, sets: x.sets.map((s, i) => (i === setIdx ? { ...s, ...patch } : s)) } : x,
      ),
    );

  const addSet = (exId: string) =>
    setDrafts((d) =>
      d.map((x) => {
        if (x.ex.id !== exId) return x;
        const last = x.sets[x.sets.length - 1];
        return { ...x, sets: [...x.sets, { reps: '', weight: last?.weight ?? '' }] };
      }),
    );

  const removeSet = (exId: string, setIdx: number) =>
    setDrafts((d) =>
      d.map((x) => (x.ex.id === exId ? { ...x, sets: x.sets.filter((_, i) => i !== setIdx) } : x)),
    );

  // a set only counts once you enter the reps you did — weight is prefilled with
  // your default, so it can't be the signal for "I actually did this set"
  const buildExercises = (): ExerciseLog[] =>
    drafts
      .map((x) => {
        const sets: SetLog[] = x.sets
          .filter((s) => s.reps.trim() !== '')
          .map((s) => ({
            reps: s.reps.trim() ? parseInt(s.reps, 10) || null : null,
            weightKg: x.ex.weighted ? parseWeightToKg(s.weight, units) || 0 : 0,
            durationSec: 0,
            formScore: null,
            grade: null,
            faults: [],
            rpe: null,
            avgHr: null,
          }));
        return { exerciseId: x.ex.id, name: x.ex.name, sets };
      })
      .filter((e) => e.sets.length > 0);

  const totalSets = buildExercises().reduce((a, e) => a + e.sets.length, 0);
  const canSave = totalSets > 0;

  const save = () => {
    const exercises = buildExercises();
    if (!exercises.length) return;
    const log: WorkoutLog = {
      id: uid(),
      date: new Date().toISOString(),
      planDayName: null,
      exercises,
      avgFormScore: 0, // no camera coaching → no form score
      durationMin: 0,
      avgHr: null,
      fatigueScore: null,
      synced: false,
    };
    store.addWorkoutLog(log);
    setSaved(true);
  };

  if (saved) {
    return (
      <Screen>
        <View style={{ alignItems: 'center', marginTop: spacing(4) }}>
          <Title>Logged ✓</Title>
          <Body dim style={{ textAlign: 'center', marginTop: spacing(1) }}>
            {`${totalSets} set${totalSets === 1 ? '' : 's'} across ${buildExercises().length} exercise${
              buildExercises().length === 1 ? '' : 's'
            } saved to your history.`}
          </Body>
          <Button title="Done" onPress={onDone} style={{ marginTop: spacing(2) }} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <Title>Log a workout</Title>
        <Button title="Cancel" kind="ghost" small onPress={onDone} />
      </Row>
      <Body dim style={{ marginBottom: spacing(1.5) }}>
        Enter the weights, reps and sets you actually did. No camera or form grade — just your numbers.
      </Body>

      <Card>
        <H1>Add an exercise</H1>
        <Row style={{ flexWrap: 'wrap' }}>
          {library
            .filter((e) => !drafts.some((d) => d.ex.id === e.id))
            .map((e) => (
              <Chip key={e.id} label={`${e.emoji} ${e.name}`} onPress={() => addExercise(e)} />
            ))}
        </Row>
        {library.every((e) => drafts.some((d) => d.ex.id === e.id)) && (
          <Body dim>All your exercises are added below.</Body>
        )}
      </Card>

      {drafts.map((x) => (
        <Card key={x.ex.id}>
          <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <H1>{`${x.ex.emoji} ${x.ex.name}`}</H1>
            <Button title="Remove" kind="ghost" small onPress={() => removeExercise(x.ex.id)} />
          </Row>
          <Row style={{ marginTop: 4, marginBottom: 4 }}>
            <Body dim style={{ flex: 1 }}>Set</Body>
            <Body dim style={{ flex: 2 }}>Reps</Body>
            {x.ex.weighted && <Body dim style={{ flex: 2 }}>{`Weight (${u})`}</Body>}
            <View style={{ width: 34 }} />
          </Row>
          {x.sets.map((s, i) => (
            <Row key={i} style={{ alignItems: 'center', marginBottom: 6 }}>
              <Body style={{ flex: 1 }}>{i + 1}</Body>
              <Input
                value={s.reps}
                onChangeText={(t) => patchSet(x.ex.id, i, { reps: t })}
                placeholder="0"
                keyboardType="numeric"
                style={{ flex: 2, marginRight: spacing(1) }}
              />
              {x.ex.weighted && (
                <Input
                  value={s.weight}
                  onChangeText={(t) => patchSet(x.ex.id, i, { weight: t })}
                  placeholder="0"
                  keyboardType="numeric"
                  style={{ flex: 2, marginRight: spacing(1) }}
                />
              )}
              <Button title="✕" kind="ghost" small onPress={() => removeSet(x.ex.id, i)} />
            </Row>
          ))}
          <Button
            title="＋ Add set"
            kind="ghost"
            small
            onPress={() => addSet(x.ex.id)}
            style={{ alignSelf: 'flex-start', marginTop: 4 }}
          />
        </Card>
      ))}

      {drafts.length > 0 && (
        <>
          <Row style={{ gap: spacing(1), marginVertical: spacing(1) }}>
            <Stat label="exercises" value={`${buildExercises().length}`} />
            <Stat label="sets" value={`${totalSets}`} />
          </Row>
          <Button
            title="Save to history"
            onPress={save}
            disabled={!canSave}
            style={{ marginBottom: spacing(1) }}
          />
          {!canSave && (
            <Body style={{ color: colors.textDim, textAlign: 'center' }}>
              Enter the reps you did on at least one set.
            </Body>
          )}
        </>
      )}
    </Screen>
  );
};
