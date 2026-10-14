import { describe, expect, it } from 'vitest';
import { getEntranceFrame, getQualityProfile } from '../src/app/round5';

describe('Round 5 quality profiles', () => {
  it('disables post-processing and caps render costs on a mobile profile', () => {
    expect(getQualityProfile({ viewportWidth: 390, coarsePointer: true, hardwareConcurrency: 4, deviceMemory: 4 }))
      .toMatchObject({ low: true, usePostProcessing: false, pixelRatioCap: 1.25, shadowMapSize: 512, reflectorResolution: 384 });
  });

  it('keeps desktop fidelity when a touch-capable desktop has adequate resources', () => {
    expect(getQualityProfile({ viewportWidth: 1440, coarsePointer: true, hardwareConcurrency: 8, deviceMemory: 8 }))
      .toMatchObject({ low: false, usePostProcessing: true, pixelRatioCap: 1.8, shadowMapSize: 1024, reflectorResolution: 768 });
  });
});

describe('Round 5 entrance animation', () => {
  it('starts below the stage and transparent, then ends at its final scale and opacity', () => {
    expect(getEntranceFrame(0)).toMatchObject({ y: -0.8, scale: 0.8, opacity: 0, complete: false });
    expect(getEntranceFrame(1.35)).toMatchObject({ y: 0, scale: 1, opacity: 1, complete: true });
  });

  it('has a visible scale overshoot before it settles', () => {
    expect(getEntranceFrame(0.945).scale).toBeCloseTo(1.05, 4);
  });
});
