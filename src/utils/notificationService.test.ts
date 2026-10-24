import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatEmergencySms,
  isValidPhoneNumber,
  generateCrewAcknowledgmentSms,
  DEFAULT_SMS_CONFIG
} from './notificationService';

test('formatEmergencySms builds concise municipal alert string', () => {
  const sms = formatEmergencySms('J-108', 85, 'Oak St & 5th Ave', ['V-108A', 'V-108B'], 'WO-8842');
  assert.ok(sms.includes('LeakNova Alert'));
  assert.ok(sms.includes('Node J-108'));
  assert.ok(sms.includes('85 L/s'));
  assert.ok(sms.includes('V-108A & V-108B'));
  assert.ok(sms.includes('#WO-8842'));
  assert.ok(sms.includes('TIER-1'));
  assert.ok(sms.includes('aquasense-smart-city-monitor.ai.studio'));
});

test('isValidPhoneNumber accepts valid international and domestic phone formats', () => {
  assert.equal(isValidPhoneNumber('+1 (555) 349-2810'), true);
  assert.equal(isValidPhoneNumber('5553492810'), true);
  assert.equal(isValidPhoneNumber('+44 7911 123456'), true);
  assert.equal(isValidPhoneNumber('123'), false);
  assert.equal(isValidPhoneNumber('invalid-text'), false);
});

test('generateCrewAcknowledgmentSms creates valid inbound reply record', () => {
  const reply = generateCrewAcknowledgmentSms('Rapid Response Unit #4', 'WO-8842', 14);
  assert.equal(reply.direction, 'INBOUND_REPLY');
  assert.ok(reply.messageText.includes('ACK WO #WO-8842'));
  assert.ok(reply.messageText.includes('14 mins'));
  assert.equal(reply.status, 'Received');
});

test('DEFAULT_SMS_CONFIG has valid defaults', () => {
  assert.equal(DEFAULT_SMS_CONFIG.sendOnCriticalBurst, true);
  assert.equal(DEFAULT_SMS_CONFIG.sendValveIsolationProtocol, true);
  assert.equal(isValidPhoneNumber(DEFAULT_SMS_CONFIG.phoneNumber), true);
});
