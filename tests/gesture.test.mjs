import test from 'node:test';
import assert from 'node:assert/strict';
import { detectedMove, GestureStabilizer, canUseSample } from '../src/vision/gesture.ts';

const detection = (category = 'Closed_Fist', score = .6, handCount = 1) => ({ category, score, handCount });
test('only confident fist, victory and open palm with exactly one hand are accepted', () => {
  assert.equal(detectedMove(detection()), 'rock');
  assert.equal(detectedMove(detection('Victory')), 'scissors');
  assert.equal(detectedMove(detection('Open_Palm')), 'paper');
  assert.equal(detectedMove(detection('Closed_Fist', .74)), 'rock');
  for (const value of [detection('Thumb_Up'), detection('None'), detection('Closed_Fist', .5999), detection('Victory', .5999), detection('Open_Palm', .5999), detection('Open_Palm', .9, 2), detection('Victory', .9, 0), detection('constructor'), detection('Victory', NaN)]) assert.equal(detectedMove(value), null);
});
test('a gesture becomes stable at exactly five continuous seconds, never before', () => {
  const filter = new GestureStabilizer();
  for (let now = 100; now < 5100; now += 100) assert.equal(filter.update(detection(),now).stable,false);
  assert.equal(filter.update(detection(),5099).stable,false);
  const stable = filter.update(detection(),5100);
  assert.equal(stable.stable,true);
  assert.equal(stable.progress,1);
  assert.equal(canUseSample(stable,5200),true);
  assert.equal(canUseSample(stable,5801),false);
  assert.equal(canUseSample(stable,5050),false);
});
for (const [name, interrupt] of [
  ['gesture change', filter => filter.update(detection('Victory'),5050)],
  ['lost hand', filter => filter.update(detection('Closed_Fist',.95,0),5050)],
  ['multiple hands', filter => filter.update(detection('Closed_Fist',.95,2),5050)],
  ['uncertain gesture', filter => filter.update(detection('None'),5050)],
  ['confidence below 60%', filter => filter.update(detection('Closed_Fist',.5999),5050)],
  ['next round or pause', filter => filter.reset()],
]) {
  test(`${name} at 4.9 seconds requires a new full five-second hold`, () => {
    const filter = new GestureStabilizer();
    for (let now = 100; now <= 5000; now += 100) filter.update(detection(),now);
    interrupt(filter);
    assert.equal(filter.update(detection(),5100).progress,0);
    for (let now = 5200; now < 10100; now += 100) assert.equal(filter.update(detection(),now).stable,false);
    assert.equal(filter.update(detection(),10100).stable,true);
  });
}
test('a long frame gap cannot count as a continuous hold', () => {
  const filter = new GestureStabilizer();
  for (let now = 100; now <= 5000; now += 100) filter.update(detection(),now);
  assert.equal(filter.update(detection(),5500).progress,0);
  for (let now = 5600; now < 10500; now += 100) assert.equal(filter.update(detection(),now).stable,false);
  assert.equal(filter.update(detection(),10500).stable,true);
});
