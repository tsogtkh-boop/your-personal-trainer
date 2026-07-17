// Heart rate via Web Bluetooth (standard Heart Rate GATT service 0x180D).
// Falls back to a realistic simulator when Bluetooth is unavailable or denied.

export type HRCallback = (bpm: number) => void;

export function bluetoothSupported(): boolean {
  return typeof navigator !== 'undefined' && !!(navigator as any).bluetooth;
}

export class HeartRateMonitor {
  private device: any = null;
  private char: any = null;
  private simTimer: ReturnType<typeof setInterval> | null = null;
  private simBpm = 72;
  private simLoad = 0; // 0 resting .. 1 max effort
  mode: 'ble' | 'sim' | 'off' = 'off';

  /** Connect to a real BLE heart-rate strap/watch. Must be called from a user gesture. */
  async connectBluetooth(onHR: HRCallback): Promise<void> {
    const bt = (navigator as any).bluetooth;
    if (!bt) throw new Error('Web Bluetooth not supported in this browser');
    this.device = await bt.requestDevice({ filters: [{ services: ['heart_rate'] }] });
    const server = await this.device.gatt.connect();
    const service = await server.getPrimaryService('heart_rate');
    this.char = await service.getCharacteristic('heart_rate_measurement');
    await this.char.startNotifications();
    this.char.addEventListener('characteristicvaluechanged', (e: any) => {
      const dv: DataView = e.target.value;
      const flags = dv.getUint8(0);
      const bpm = flags & 0x01 ? dv.getUint16(1, true) : dv.getUint8(1);
      onHR(bpm);
    });
    this.mode = 'ble';
  }

  /** Simulated HR that responds to exercise intensity (for demo / no device). */
  startSimulated(onHR: HRCallback): void {
    this.mode = 'sim';
    this.simTimer = setInterval(() => {
      const target = 68 + this.simLoad * 92; // 68 resting → ~160 under load
      this.simBpm += (target - this.simBpm) * 0.08 + (Math.random() - 0.5) * 2.2;
      onHR(Math.round(this.simBpm));
    }, 1000);
  }

  /** Tell the simulator how hard the user is working (0..1). */
  setSimulatedLoad(load: number): void {
    this.simLoad = Math.min(1, Math.max(0, load));
  }

  disconnect(): void {
    if (this.simTimer) clearInterval(this.simTimer);
    this.simTimer = null;
    try {
      this.char?.stopNotifications?.();
      this.device?.gatt?.disconnect?.();
    } catch {
      /* noop */
    }
    this.device = null;
    this.char = null;
    this.mode = 'off';
  }
}

export function maxHR(age: number): number {
  return Math.round(208 - 0.7 * age);
}

export function hrZone(bpm: number, age: number): { zone: number; label: string } {
  const pct = bpm / maxHR(age);
  if (pct < 0.5) return { zone: 1, label: 'Recovery' };
  if (pct < 0.6) return { zone: 2, label: 'Easy' };
  if (pct < 0.7) return { zone: 3, label: 'Moderate' };
  if (pct < 0.8) return { zone: 4, label: 'Hard' };
  return { zone: 5, label: 'Max effort' };
}

/**
 * Heart-rate guided rest: recommend ending rest when HR drops near a
 * recovered threshold, otherwise fall back to the planned rest time.
 */
export function restRecommendation(
  currentBpm: number | null,
  age: number,
  elapsedSec: number,
  plannedSec: number,
): { ready: boolean; reason: string } {
  if (currentBpm !== null) {
    const threshold = 0.55 * maxHR(age) + 30; // ~ comfortably recovered
    if (currentBpm <= threshold && elapsedSec >= Math.min(30, plannedSec * 0.4)) {
      return { ready: true, reason: `Heart rate recovered (${currentBpm} bpm) — ready for the next set.` };
    }
    if (elapsedSec >= plannedSec) {
      return currentBpm > threshold + 15
        ? { ready: false, reason: `HR still elevated (${currentBpm} bpm) — take a little longer.` }
        : { ready: true, reason: 'Rest complete.' };
    }
    return { ready: false, reason: '' };
  }
  return elapsedSec >= plannedSec ? { ready: true, reason: 'Rest complete.' } : { ready: false, reason: '' };
}
