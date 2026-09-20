import test from 'node:test';
import assert from 'node:assert/strict';
import { detectedMove, GestureStabilizer, canUseSample } from '../src/vision/gesture.ts';

const detection = (category = 'Closed_Fist', score = .95, handCount = 1) => ({ category, score, handCount });
test('only confident fist, victory and open palm with exactly one hand are accepted', () => {
  assert.equal(detectedMove(detection()), 'rock');
  assert.equal(detectedMove(detection('Victory')), 'scissors');
  assert.equal(detectedMove(detection('Open_Palm')), 'paper');
  for (const value of [detection('Thumb_Up'), detection('None'), detection('Closed_Fist', .74), detection('Open_Palm', .9, 2), detection('Victory', .9, 0), detection('constructor'), detection('Victory', NaN)]) assert.equal(detectedMove(value), null);
});
test('confirmation needs a consistent gesture over several frames and at least 600 ms', () => {
  const filter = new GestureStabilizer();
  for (const now of [100,200,300,400,500,600]) assert.equal(filter.update(detection(),now).stable,false);
  const stable = filter.update(detection(),700);
  assert.equal(stable.stable,true);
  assert.equal(canUseSample(stable,800),true);
  assert.equal(canUseSample(stable,1401),false);
  assert.equal(canUseSample(stable,650),false);
});
test('switching gesture, losing the hand, low confidence and gaps revoke old confirmation', () => {
  const filter = new GestureStabilizer();
  for(const now of [100,300,500,700]) filter.update(detection(),now);
  assert.equal(filter.update(detection('Victory'),800).stable,false);
  assert.equal(filter.update(detection('None'),900),null);
  assert.equal(filter.update(detection('Victory'),1000).stable,false);
  assert.equal(filter.update(detection('Victory',.4),1100),null);
  for(const now of [1200,1400,1600,1800]) filter.update(detection(),now);
  assert.equal(filter.update(detection(),2500).stable,false);
  filter.reset();
  assert.equal(filter.update(detection(),2600).stable,false);
});
