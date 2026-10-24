import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateFlowSeries,
  calculatePriorityScore,
  getAlertDetails,
  calculateNrwMetric,
} from './waterSimulation';

test('flow series in normal state matches baseline demand without leak anomaly', () => {
  const series = generateFlowSeries(false);
  assert.equal(series.length, 12);
  const hour14 = series.find((p) => p.time === '14:00');
  assert.ok(hour14);
  assert.equal(hour14.leakAnomaly, 0);
  assert.ok(Math.abs(hour14.actualFlow - hour14.expectedDemand) < 3);
});

test('flow series under simulation triggers massive flow spike starting at 14:00', () => {
  const series = generateFlowSeries(true, 85);
  const hour14 = series.find((p) => p.time === '14:00');
  assert.ok(hour14);
  assert.equal(hour14.leakAnomaly, 85);
  assert.ok(hour14.actualFlow >= hour14.expectedDemand + 80);
});

test('calculatePriorityScore calculates severity tier correctly', () => {
  const score = calculatePriorityScore(85, 18.4, true);
  // (85/100)*50 + (18.4/25)*30 + 20 = 42.5 + 22.08 + 20 = ~84.58 -> 85
  assert.ok(score >= 80 && score <= 100);
});

test('getAlertDetails returns localized Node J-108 and dispatch command when simulating', () => {
  const normalAlert = getAlertDetails(false);
  assert.equal(normalAlert, null);

  const leakAlert = getAlertDetails(true);
  assert.ok(leakAlert);
  assert.equal(leakAlert.nodeId, 'J-108');
  assert.equal(leakAlert.estimatedLeakSizeLps, 85);
  assert.equal(leakAlert.dispatchUrgency, 'DISPATCH REPAIR CREWS IMMEDIATELY');
});

test('calculateNrwMetric reflects spike in non-revenue water loss', () => {
  const normal = calculateNrwMetric(false);
  assert.equal(normal.nrwPercentage, 11.8);

  const burst = calculateNrwMetric(true);
  assert.ok(burst.nrwPercentage > 35 && burst.nrwPercentage < 55);
});
