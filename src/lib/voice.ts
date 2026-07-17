// Voice commands (Web Speech API) + spoken coach feedback (speech synthesis).

export type VoiceCommand =
  | 'pause'
  | 'resume'
  | 'next'
  | 'skip_rest'
  | 'harder'
  | 'easier'
  | 'end'
  | 'status'
  | 'start';

const COMMAND_PATTERNS: [RegExp, VoiceCommand][] = [
  [/\b(pause|hold on|stop for a sec|freeze)\b/, 'pause'],
  [/\b(resume|continue|unpause|keep going|go on)\b/, 'resume'],
  [/\b(next exercise|next one|move on|switch exercise)\b/, 'next'],
  [/\b(skip rest|skip the rest|i'?m ready|end rest)\b/, 'skip_rest'],
  [/\b(harder|more weight|heavier|increase|make this harder|too easy)\b/, 'harder'],
  [/\b(easier|less weight|lighter|decrease|make this easier|too hard|too heavy)\b/, 'easier'],
  [/\b(end workout|stop workout|finish workout|i'?m done|end session)\b/, 'end'],
  [/\b(how am i doing|status|progress report)\b/, 'status'],
  [/\b(start workout|let'?s go|begin|start set)\b/, 'start'],
];

export function parseCommand(transcript: string): VoiceCommand | null {
  const t = transcript.toLowerCase();
  for (const [re, cmd] of COMMAND_PATTERNS) if (re.test(t)) return cmd;
  return null;
}

export function voiceSupported(): boolean {
  const w = globalThis as any;
  return typeof w !== 'undefined' && !!(w.SpeechRecognition || w.webkitSpeechRecognition);
}

export class VoiceControl {
  private rec: any = null;
  private active = false;
  onTranscript: ((t: string) => void) | null = null;

  start(onCommand: (cmd: VoiceCommand, transcript: string) => void): boolean {
    const w = globalThis as any;
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) return false;
    this.rec = new SR();
    this.rec.continuous = true;
    this.rec.interimResults = false;
    this.rec.lang = 'en-US';
    this.rec.onresult = (e: any) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          const transcript = e.results[i][0].transcript as string;
          this.onTranscript?.(transcript);
          const cmd = parseCommand(transcript);
          if (cmd) onCommand(cmd, transcript);
        }
      }
    };
    this.rec.onend = () => {
      // Chrome stops recognition periodically; restart while active.
      if (this.active) {
        try {
          this.rec.start();
        } catch {
          /* already started */
        }
      }
    };
    this.rec.onerror = () => {
      /* ignore; onend will restart */
    };
    try {
      this.rec.start();
      this.active = true;
      return true;
    } catch {
      return false;
    }
  }

  stop(): void {
    this.active = false;
    try {
      this.rec?.stop();
    } catch {
      /* noop */
    }
    this.rec = null;
  }
}

let voiceEnabled = true;
export function setSpeechEnabled(on: boolean): void {
  voiceEnabled = on;
  if (!on) (globalThis as any).speechSynthesis?.cancel();
}

export function speak(text: string, opts: { rate?: number; interrupt?: boolean } = {}): void {
  const synth = (globalThis as any).speechSynthesis;
  if (!voiceEnabled || !synth) return;
  if (opts.interrupt) synth.cancel();
  const u = new (globalThis as any).SpeechSynthesisUtterance(text);
  u.rate = opts.rate ?? 1.04;
  u.pitch = 1.0;
  const voices = synth.getVoices?.() ?? [];
  const preferred = voices.find((v: any) => /en[-_]/i.test(v.lang) && /google|samantha|daniel/i.test(v.name));
  if (preferred) u.voice = preferred;
  synth.speak(u);
}
