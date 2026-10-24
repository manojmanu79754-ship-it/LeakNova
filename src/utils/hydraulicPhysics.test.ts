import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateHazenWilliamsHeadLoss,
  calculatePipeVelocity,
  calculateOrificeLeakSizing,
  processTelemetryDemandFiltering,
  calculateAwwaWaterBalance,
  parseTelemetryCsv,
  exportTelemetryToCsv,
  BENCHMARK_SCADA_LOGS
} from './hydraulicPhysics';

test('Hazen-Williams head loss calculates realistic hydraulic resistance', () => {
  // 100 L/s flow through 500m of 300mm ductile iron pipe (C=130)
  const headLoss = calculateHazenWilliamsHeadLoss(100, 500, 300, 130);
  assert.ok(headLoss > 0.5 && headLoss < 5.0, `Expected headLoss ~1.4m, got ${headLoss}`);
});

test('calculatePipeVelocity accurately calculates cross-sectional fluid velocity', () => {
  // 100 L/s in 300mm pipe -> area = pi * 0.15^2 = ~0.0707 m2 -> v = 0.1 / 0.0707 = ~1.41 m/s
  const v = calculatePipeVelocity(100, 300);
  assert.equal(v, 1.41);
});

test('Torricelli orifice leak sizing calculates physical fracture dimensions', () => {
  // 85 L/s leak under 63 psi (~44.3m head)
  const sizing = calculateOrificeLeakSizing(85, 63);
  assert.equal(sizing.leakFlowLps, 85);
  assert.ok(sizing.equivalentDiameterMm > 50 && sizing.equivalentDiameterMm < 120);
  assert.ok(sizing.dailyLossM3 > 5000);
  assert.ok(sizing.costPerHourUsd > 100);
});

test('processTelemetryDemandFiltering identifies statistically significant bursts', () => {
  const sample = [
    { timestamp: '10:00', actualFlowLps: 76, expectedFlowLps: 75, pressurePsi: 64 },
    { timestamp: '12:00', actualFlowLps: 72, expectedFlowLps: 71, pressurePsi: 64 },
    { timestamp: '14:00', actualFlowLps: 154, expectedFlowLps: 69, pressurePsi: 46 }, // +85 L/s burst
  ];

  const processed = processTelemetryDemandFiltering(sample, 1.5);
  assert.equal(processed.length, 3);
  assert.equal(processed[0].isAnomaly, false);
  assert.equal(processed[1].isAnomaly, false);
  assert.equal(processed[2].isAnomaly, true);
  assert.ok(processed[2].residualAnomalyLps >= 80);
});

test('calculateAwwaWaterBalance correctly balances NRW and ILI', () => {
  const balance = calculateAwwaWaterBalance(10000, 2500);
  assert.equal(balance.systemInputVolumeM3, 10000);
  assert.equal(balance.realLossesM3, 3280);
  assert.ok(balance.nrwPercentage > 25);
  assert.ok(balance.infrastructureLeakIndexIli > 5);
});

test('parseTelemetryCsv parses multi-line CSV data correctly', () => {
  const csv = `Time,Actual_Flow,Expected_Demand,Pressure\n00:00,24.5,23.0,66.5\n02:00,19.2,18.8,68.0`;
  const parsed = parseTelemetryCsv(csv);
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].actualFlowLps, 24.5);
  assert.equal(parsed[1].pressurePsi, 68.0);
});

test('exportTelemetryToCsv formats dataset into valid CSV format', () => {
  const records = [
    {
      id: 'tel-1',
      timestamp: '00:00',
      actualFlowLps: 25.0,
      expectedFlowLps: 24.0,
      pressurePsi: 65.0,
      residualAnomalyLps: 0,
      zScore: 0.2,
      isAnomaly: false
    }
  ];
  const exported = exportTelemetryToCsv(records);
  assert.ok(exported.includes('Timestamp,ActualFlow_Lps'));
  assert.ok(exported.includes('00:00,25.0,24.0,65.0'));
});
