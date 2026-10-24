-- ==============================================================================
-- LeakNova Smart City Water Monitoring - PostgreSQL Schema for Supabase
-- Project ID: atgbqxmergxaaazrhbpr
-- Region: ap-northeast-1 (manumanu87181@gmail.com's Project)
-- ==============================================================================

-- 1. Leak Incidents Table
-- Stores pipe rupture events, EPANET localized junctions, flow loss, and isolation plans
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
-- Tracks municipal repair crew dispatch tickets, affected meters, and repair status
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
-- Archives outbound SCADA alarms and inbound field crew acknowledgment replies
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
-- Logs acoustic/pressure transducer readings and statistical anomaly Z-scores
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

-- ==============================================================================
-- Security: Enable Row Level Security (RLS) & Grant Access
-- ==============================================================================

ALTER TABLE public.leak_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_dispatches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sensor_telemetry ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  -- Permissive read/write policies for the frontend web application
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
