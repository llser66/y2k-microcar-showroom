export interface QualityProfile {
  low: boolean;
  pixelRatioCap: number;
  shadowMapSize: number;
  reflectorResolution: number;
  usePostProcessing: boolean;
}

export interface DeviceCapabilities {
  viewportWidth: number;
  coarsePointer: boolean;
  hardwareConcurrency?: number;
  deviceMemory?: number;
}

/** Keeps mobile GPU work bounded without penalising a desktop with a touch screen. */
export function getQualityProfile(capabilities: DeviceCapabilities): QualityProfile {
  const low = capabilities.viewportWidth <= 760
    || (capabilities.coarsePointer && capabilities.viewportWidth <= 900)
    || (capabilities.hardwareConcurrency !== undefined && capabilities.hardwareConcurrency <= 4)
    || (capabilities.deviceMemory !== undefined && capabilities.deviceMemory <= 4);

  return {
    low,
    pixelRatioCap: low ? 1.25 : 1.8,
    shadowMapSize: low ? 512 : 1024,
    reflectorResolution: low ? 384 : 768,
    usePostProcessing: !low,
  };
}

export interface EntranceFrame {
  y: number;
  scale: number;
  opacity: number;
  complete: boolean;
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/** The requested 0.8 → 1.05 → 0.98 → 1.0 landing curve. */
export function getEntranceFrame(elapsedSeconds: number, durationSeconds = 1.35): EntranceFrame {
  const progress = clamp01(elapsedSeconds / durationSeconds);
  const keys: ReadonlyArray<readonly [number, number]> = [[0, 0.8], [0.7, 1.05], [0.86, 0.98], [1, 1]];
  const index = keys.findIndex(([time]) => time >= progress);
  const [endTime, endValue] = keys[index < 0 ? keys.length - 1 : index];
  const [startTime, startValue] = keys[Math.max(0, index - 1)];
  const local = startTime === endTime ? 1 : clamp01((progress - startTime) / (endTime - startTime));
  const scale = startValue + (endValue - startValue) * local;
  const easeOut = 1 - Math.pow(1 - progress, 3);

  return {
    y: progress === 1 ? 0 : -0.8 * (1 - easeOut),
    scale,
    opacity: easeOut,
    complete: progress === 1,
  };
}
