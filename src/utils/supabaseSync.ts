/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { supabase, SUPABASE_CONFIG } from '../lib/supabase';
import { WorkOrder } from './dashboardData';
import { SmsMessage } from './notificationService';
import { LeakAlertDetails } from './waterSimulation';

export interface SupabaseSyncResult {
  success: boolean;
  table: string;
  count: number;
  message: string;
  timestamp: string;
  details?: any;
}

/**
 * SQL Schema migration for Supabase SQL Editor
 */
export const SUPABASE_SQL_SCHEMA = `-- LeakNova Smart City Water Monitoring - PostgreSQL Schema for Supabase
-- Project ID: ${SUPABASE_CONFIG.projectId}
-- Region: ${SUPABASE_CONFIG.region} (${SUPABASE_CONFIG.projectName})

-- 1. Leak Incidents Table
CREATE TABLE IF NOT EXISTS public.leak_incidents (
  id TEXT PRIMARY KEY,
  node_id TEXT NOT NULL,
  location TEXT NOT NULL,
  pipe_id TEXT NOT NULL,
  estimated_flow_lps NUMERIC NOT NULL,
  hourly_loss_m3 NUMERIC NOT NULL,
  orifice_area_mm2 NUMERIC NOT NULL,
  equivalent_diameter_mm NUMERIC NOT NULL,
  priority_score INTEGER NOT NULL,
  priority_level TEXT NOT NULL,
  dispatch_urgency TEXT NOT NULL,
  hourly_cost_usd NUMERIC NOT NULL,
  isolation_valves TEXT[] NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Work Orders Table
CREATE TABLE IF NOT EXISTS public.work_orders (
  id TEXT PRIMARY KEY,
  node_id TEXT NOT NULL,
  sector TEXT NOT NULL,
  address TEXT NOT NULL,
  priority TEXT NOT NULL,
  assigned_crew TEXT NOT NULL,
  pipe_spec TEXT NOT NULL,
  isolation_valves TEXT[] NOT NULL,
  affected_customers INTEGER DEFAULT 0,
  estimated_repair_hrs NUMERIC DEFAULT 0,
  status TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Emergency SMS Dispatches Table
CREATE TABLE IF NOT EXISTS public.sms_dispatches (
  id TEXT PRIMARY KEY,
  timestamp TEXT NOT NULL,
  recipient_phone TEXT NOT NULL,
  recipient_name TEXT NOT NULL,
  direction TEXT NOT NULL,
  message_text TEXT NOT NULL,
  severity TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Sensor Telemetry Time-Series Table
CREATE TABLE IF NOT EXISTS public.sensor_telemetry (
  id BIGSERIAL PRIMARY KEY,
  timestamp TEXT NOT NULL,
  actual_flow_lps NUMERIC NOT NULL,
  expected_flow_lps NUMERIC NOT NULL,
  pressure_psi NUMERIC NOT NULL,
  anomaly_lps NUMERIC DEFAULT 0,
  z_score NUMERIC DEFAULT 0,
  is_leak BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (RLS) with open read/insert for authenticated & anon clients
ALTER TABLE public.leak_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_dispatches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sensor_telemetry ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  -- Create permissive policies if not already present
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'leak_incidents' AND policyname = 'Allow public read/write') THEN
    CREATE POLICY "Allow public read/write" ON public.leak_incidents FOR ALL USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'work_orders' AND policyname = 'Allow public read/write') THEN
    CREATE POLICY "Allow public read/write" ON public.work_orders FOR ALL USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sms_dispatches' AND policyname = 'Allow public read/write') THEN
    CREATE POLICY "Allow public read/write" ON public.sms_dispatches FOR ALL USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sensor_telemetry' AND policyname = 'Allow public read/write') THEN
    CREATE POLICY "Allow public read/write" ON public.sensor_telemetry FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
`;

/**
 * Sync active leak alert details to Supabase
 */
export async function syncLeakIncidentToSupabase(alert: LeakAlertDetails): Promise<SupabaseSyncResult> {
  const time = new Date().toLocaleTimeString();
  try {
    const payload = {
      id: `INCIDENT-${alert.nodeId}-${Date.now()}`,
      node_id: alert.nodeId,
      location: alert.locationName,
      pipe_id: alert.pipeId,
      estimated_flow_lps: alert.estimatedLeakSizeLps,
      hourly_loss_m3: Math.round(alert.estimatedLeakSizeLps * 3.6),
      orifice_area_mm2: alert.orificeAreaMm2,
      equivalent_diameter_mm: alert.equivalentDiameterMm,
      priority_score: alert.priorityScore,
      priority_level: alert.priorityLevel,
      dispatch_urgency: alert.dispatchUrgency,
      hourly_cost_usd: alert.hourlyCostUsd,
      isolation_valves: ['V-108A', 'V-108B']
    };

    const { error } = await supabase.from('leak_incidents').upsert(payload);

    if (error) {
      return {
        success: false,
        table: 'leak_incidents',
        count: 0,
        message: error.message.includes('relation') || error.message.includes('does not exist')
          ? 'Table "leak_incidents" does not exist in your Supabase project yet. Use the SQL Schema tab to create it.'
          : error.message,
        timestamp: time,
        details: error
      };
    }

    return {
      success: true,
      table: 'leak_incidents',
      count: 1,
      message: `Successfully synced Leak Incident for Node ${alert.nodeId} (${alert.estimatedLeakSizeLps} L/s) to Supabase.`,
      timestamp: time
    };
  } catch (err: any) {
    return {
      success: false,
      table: 'leak_incidents',
      count: 0,
      message: err?.message || 'Sync failed due to network error',
      timestamp: time
    };
  }
}

/**
 * Sync work orders batch to Supabase
 */
export async function syncWorkOrdersToSupabase(workOrders: WorkOrder[]): Promise<SupabaseSyncResult> {
  const time = new Date().toLocaleTimeString();
  try {
    const rows = workOrders.map(wo => ({
      id: wo.id,
      node_id: wo.nodeId,
      sector: wo.sector,
      address: wo.address,
      priority: wo.priority,
      assigned_crew: wo.assignedCrew,
      pipe_spec: `${wo.pipeDiameter} • ${wo.pipeMaterial}`,
      isolation_valves: wo.isolationValves,
      affected_customers: wo.affectedCustomers,
      estimated_repair_hrs: wo.estimatedRepairHrs,
      status: wo.status
    }));

    const { error } = await supabase.from('work_orders').upsert(rows);

    if (error) {
      return {
        success: false,
        table: 'work_orders',
        count: 0,
        message: error.message.includes('relation') || error.message.includes('does not exist')
          ? 'Table "work_orders" does not exist in your Supabase project yet. Copy the SQL schema from the tab above and run it in Supabase SQL editor.'
          : error.message,
        timestamp: time,
        details: error
      };
    }

    return {
      success: true,
      table: 'work_orders',
      count: rows.length,
      message: `Successfully synchronized ${rows.length} work orders to Supabase table "work_orders".`,
      timestamp: time
    };
  } catch (err: any) {
    return {
      success: false,
      table: 'work_orders',
      count: 0,
      message: err?.message || 'Network error syncing work orders',
      timestamp: time
    };
  }
}

/**
 * Sync SMS messages to Supabase
 */
export async function syncSmsMessagesToSupabase(messages: SmsMessage[]): Promise<SupabaseSyncResult> {
  const time = new Date().toLocaleTimeString();
  try {
    const rows = messages.map(m => ({
      id: m.id,
      timestamp: m.timestamp,
      recipient_phone: m.recipientPhone,
      recipient_name: m.recipientName,
      direction: m.direction,
      message_text: m.messageText,
      severity: m.severity,
      status: m.status
    }));

    const { error } = await supabase.from('sms_dispatches').upsert(rows);

    if (error) {
      return {
        success: false,
        table: 'sms_dispatches',
        count: 0,
        message: error.message.includes('relation') || error.message.includes('does not exist')
          ? 'Table "sms_dispatches" does not exist in your Supabase project yet.'
          : error.message,
        timestamp: time,
        details: error
      };
    }

    return {
      success: true,
      table: 'sms_dispatches',
      count: rows.length,
      message: `Synchronized ${rows.length} SMS dispatch logs to Supabase table "sms_dispatches".`,
      timestamp: time
    };
  } catch (err: any) {
    return {
      success: false,
      table: 'sms_dispatches',
      count: 0,
      message: err?.message || 'Network error',
      timestamp: time
    };
  }
}

/**
 * Fetch remote work orders from Supabase if table exists
 */
export async function fetchRemoteWorkOrders(): Promise<WorkOrder[] | null> {
  try {
    const { data, error } = await supabase.from('work_orders').select('*').limit(20);
    if (error || !data) return null;

    return data.map((row: any) => ({
      id: row.id,
      nodeId: row.node_id,
      sector: row.sector || 'District Sector',
      address: row.address || 'Municipal Junction',
      priority: row.priority || 'Tier 2 - High',
      assignedCrew: row.assigned_crew || 'Hydraulics Unit',
      pipeDiameter: (row.pipe_spec || '16" Arterial').split('•')[0]?.trim() || '16"',
      pipeMaterial: (row.pipe_spec || 'Ductile Iron').split('•')[1]?.trim() || 'Ductile Iron',
      isolationValves: Array.isArray(row.isolation_valves) ? row.isolation_valves : ['V-108A'],
      affectedCustomers: Number(row.affected_customers) || 120,
      hasSensitiveFacilities: false,
      estimatedRepairHrs: Number(row.estimated_repair_hrs) || 2,
      status: row.status || 'Pending Dispatch'
    }));
  } catch {
    return null;
  }
}
