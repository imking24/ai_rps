import type { Move } from '../engine';

export type Detection = { handCount: number; category: string; score: number };
export type GestureSample = { move: Move; confidence: number; stable: boolean; progress: number; observedAt: number };
export const MIN_CONFIDENCE = 0.75;
export const STABLE_DURATION_MS = 600;
export const MAX_FRAME_GAP_MS = 450;
export const MAX_SAMPLE_AGE_MS = 700;
const gestures: Record<string, Move> = { Closed_Fist: 'rock', Victory: 'scissors', Open_Palm: 'paper' };

export function detectedMove(detection: Detection): Move | null {
  if (detection.handCount !== 1 || !Number.isFinite(detection.score) || detection.score < MIN_CONFIDENCE) return null;
  return Object.hasOwn(gestures, detection.category) ? gestures[detection.category] : null;
}

// Consecutive observations are required; losing the hand clears the result immediately.
export class GestureStabilizer {
  private move: Move | null = null;
  private since = 0;
  private last = 0;
  private count = 0;

  reset() {
    this.move = null;
    this.since = this.last = this.count = 0;
  }

  update(detection: Detection, now: number): GestureSample | null {
    const move = detectedMove(detection);
    if (!move || !Number.isFinite(now)) { this.reset(); return null; }
    if (move !== this.move || now - this.last > MAX_FRAME_GAP_MS || now <= this.last) {
      this.move = move;
      this.since = now;
      this.count = 0;
    }
    this.last = now;
    this.count++;
    const progress = Math.min(1, (now - this.since) / STABLE_DURATION_MS);
    return { move, confidence: detection.score, stable: progress === 1 && this.count >= 4, progress, observedAt: now };
  }
}

export function canUseSample(sample: GestureSample | null, now: number): sample is GestureSample {
  return !!sample?.stable && Number.isFinite(now) && now >= sample.observedAt && now - sample.observedAt <= MAX_SAMPLE_AGE_MS;
}
