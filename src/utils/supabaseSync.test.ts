/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { test } from 'node:test';
import assert from 'node:assert';
import { sanitizeSupabaseUrl, SUPABASE_CONFIG } from '../lib/supabase.ts';
import { SUPABASE_SQL_SCHEMA } from './supabaseSync.ts';

test('sanitizeSupabaseUrl cleans REST suffix and trailing slashes correctly', () => {
  assert.strictEqual(
    sanitizeSupabaseUrl('https://atgbqxmergxaaazrhbpr.supabase.co/rest/v1/'),
    'https://atgbqxmergxaaazrhbpr.supabase.co'
  );
  assert.strictEqual(
    sanitizeSupabaseUrl('https://atgbqxmergxaaazrhbpr.supabase.co/rest/v1'),
    'https://atgbqxmergxaaazrhbpr.supabase.co'
  );
  assert.strictEqual(
    sanitizeSupabaseUrl('https://atgbqxmergxaaazrhbpr.supabase.co///'),
    'https://atgbqxmergxaaazrhbpr.supabase.co'
  );
  assert.strictEqual(
    sanitizeSupabaseUrl(' https://atgbqxmergxaaazrhbpr.supabase.co '),
    'https://atgbqxmergxaaazrhbpr.supabase.co'
  );
});

test('SUPABASE_CONFIG uses user provided credentials', () => {
  assert.strictEqual(SUPABASE_CONFIG.projectId, 'atgbqxmergxaaazrhbpr');
  assert.strictEqual(SUPABASE_CONFIG.region, 'ap-northeast-1');
  assert.strictEqual(SUPABASE_CONFIG.url, 'https://atgbqxmergxaaazrhbpr.supabase.co');
  assert.ok(SUPABASE_CONFIG.publishableKey.startsWith('sb_publishable_'));
});

test('SUPABASE_SQL_SCHEMA includes all necessary tables and RLS security policies', () => {
  assert.ok(SUPABASE_SQL_SCHEMA.includes('CREATE TABLE IF NOT EXISTS public.leak_incidents'));
  assert.ok(SUPABASE_SQL_SCHEMA.includes('CREATE TABLE IF NOT EXISTS public.work_orders'));
  assert.ok(SUPABASE_SQL_SCHEMA.includes('CREATE TABLE IF NOT EXISTS public.sms_dispatches'));
  assert.ok(SUPABASE_SQL_SCHEMA.includes('CREATE TABLE IF NOT EXISTS public.sensor_telemetry'));
  assert.ok(SUPABASE_SQL_SCHEMA.includes('ROW LEVEL SECURITY'));
});
