import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getSimulatedDmaList,
  getSimulatedWorkOrders,
  DMA_BENCHMARK_LIST,
  SENSOR_INVENTORY
} from './dashboardData';

test('DMA list reports 5 baseline municipal sectors with nominal metrics', () => {
  const list = getSimulatedDmaList(false);
  assert.equal(list.length, 5);
  const dma4 = list.find(d => d.id === 'DMA-04');
  assert.ok(dma4);
  assert.equal(dma4.nrwPercentage, 11.8);
  assert.equal(dma4.status, 'Nominal');
});

test('DMA list updates DMA-04 status to Critical when simulation is active', () => {
  const list = getSimulatedDmaList(true);
  const dma4 = list.find(d => d.id === 'DMA-04');
  assert.ok(dma4);
  assert.equal(dma4.status, 'Critical');
  assert.equal(dma4.iliScore, 6.4);
  assert.ok(dma4.nrwPercentage > 40);
});

test('Work orders list includes emergency WO-8842 when leak simulation is active', () => {
  const nominal = getSimulatedWorkOrders(false, false);
  assert.equal(nominal.length, 2);

  const activeOrders = getSimulatedWorkOrders(true, false);
  assert.equal(activeOrders.length, 3);
  assert.equal(activeOrders[0].id, 'WO-8842');
  assert.equal(activeOrders[0].priority, 'Tier 1 - Critical');
  assert.equal(activeOrders[0].nodeId, 'J-108');
  assert.equal(activeOrders[0].status, 'Pending Dispatch');

  const dispatchedOrders = getSimulatedWorkOrders(true, true);
  assert.equal(dispatchedOrders[0].status, 'En Route');
});

test('Sensor inventory has 6 optimized loggers with >80% sensitivity scores', () => {
  assert.equal(SENSOR_INVENTORY.length, 6);
  SENSOR_INVENTORY.forEach(s => {
    assert.ok(s.hydraulicSensitivityScore >= 80);
    assert.equal(s.status, 'Online');
  });
});
