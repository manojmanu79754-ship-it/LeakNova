/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  Battery,
  BatteryCharging,
  Bell,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Cloud,
  Compass,
  Copy,
  Database,
  DollarSign,
  Droplets,
  ExternalLink,
  Eye,
  FileSpreadsheet,
  FileText,
  FileUp,
  Filter,
  Flame,
  Gauge,
  HelpCircle,
  Info,
  Layers,
  LayoutDashboard,
  MapPin,
  Maximize2,
  MessageSquare,
  Phone,
  PhoneCall,
  PieChart as PieChartIcon,
  Play,
  Radio,
  RotateCcw,
  Search,
  Send,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Smartphone,
  Table,
  TrendingDown,
  TrendingUp,
  Truck,
  Upload,
  Users,
  Volume2,
  Waves,
  Wifi,
  Wrench,
  X,
  Zap
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import {
  FlowDataPoint,
  generateFlowSeries,
  getAlertDetails,
  calculateNrwMetric
} from './utils/waterSimulation';
import {
  exportTelemetryToCsv,
  parseTelemetryCsv,
  BENCHMARK_SCADA_LOGS,
  calculateOrificeLeakSizing,
  calculateHazenWilliamsHeadLoss,
  TelemetryRecord,
  processTelemetryDemandFiltering
} from './utils/hydraulicPhysics';
import {
  DMA_BENCHMARK_LIST,
  SENSOR_INVENTORY,
  getSimulatedDmaList,
  getSimulatedWorkOrders,
  DmaOverview,
  SensorDevice,
  WorkOrder
} from './utils/dashboardData';
import {
  DEFAULT_SMS_CONFIG,
  formatEmergencySms,
  isValidPhoneNumber,
  generateCrewAcknowledgmentSms,
  SmsRecipientConfig,
  SmsMessage
} from './utils/notificationService';
import {
  SUPABASE_CONFIG,
  testSupabaseConnection,
  SupabaseConnectionStatus
} from './lib/supabase.ts';
import {
  syncLeakIncidentToSupabase,
  syncWorkOrdersToSupabase,
  syncSmsMessagesToSupabase,
  SUPABASE_SQL_SCHEMA,
  SupabaseSyncResult,
  fetchRemoteWorkOrders
} from './utils/supabaseSync.ts';

// EPANET Network Topology definitions for SVG Map
interface NetworkNode {
  id: string;
  label: string;
  x: number;
  y: number;
  type: 'reservoir' | 'pump' | 'sensor' | 'junction' | 'target_leak';
  pressureNominal: number; // psi
  pressureSim: number;     // psi
  flowLps: number;
  description: string;
}

const NETWORK_NODES: NetworkNode[] = [
  {
    id: 'R-1',
    label: 'Main Reservoir R-1',
    x: 80,
    y: 90,
    type: 'reservoir',
    pressureNominal: 72,
    pressureSim: 71,
    flowLps: 180,
    description: 'Bulk municipal gravity supply feed (Capacity 4.2M Gal)'
  },
  {
    id: 'PS-1',
    label: 'Booster Pump PS-01',
    x: 210,
    y: 110,
    type: 'pump',
    pressureNominal: 68,
    pressureSim: 67,
    flowLps: 175,
    description: 'Variable frequency drive booster maintaining 68 psi head'
  },
  {
    id: 'S-01',
    label: 'Sensor S-01 (Inflow)',
    x: 320,
    y: 120,
    type: 'sensor',
    pressureNominal: 66,
    pressureSim: 64,
    flowLps: 168,
    description: 'Optimized placement: High-frequency ultrasonic flow meter'
  },
  {
    id: 'J-102',
    label: 'Junction J-102',
    x: 430,
    y: 120,
    type: 'junction',
    pressureNominal: 65,
    pressureSim: 61,
    flowLps: 140,
    description: 'North Arterial Split to Commercial District'
  },
  {
    id: 'S-02',
    label: 'Sensor S-02 (North)',
    x: 540,
    y: 80,
    type: 'sensor',
    pressureNominal: 64,
    pressureSim: 60,
    flowLps: 55,
    description: 'Optimized placement: Piezoelectric pressure transducer'
  },
  {
    id: 'J-104',
    label: 'Junction J-104',
    x: 640,
    y: 80,
    type: 'junction',
    pressureNominal: 63,
    pressureSim: 59,
    flowLps: 52,
    description: 'High-tech Innovation Park Sub-grid'
  },
  {
    id: 'S-03',
    label: 'Sensor S-03 (Mid-Span)',
    x: 430,
    y: 210,
    type: 'sensor',
    pressureNominal: 64,
    pressureSim: 55,
    flowLps: 92,
    description: 'Optimized placement: Dual acoustic hydrophone & pressure logger'
  },
  {
    id: 'J-108',
    label: 'Junction J-108 (Target)',
    x: 550,
    y: 220,
    type: 'target_leak',
    pressureNominal: 63,
    pressureSim: 44.6, // Heavy drop -18.4 psi
    flowLps: 85,
    description: 'Sector 4B - Oak St & 5th Ave 16" Ductile Iron Arterial'
  },
  {
    id: 'S-04',
    label: 'Sensor S-04 (Sector 4B)',
    x: 670,
    y: 220,
    type: 'sensor',
    pressureNominal: 62,
    pressureSim: 46,
    flowLps: 42,
    description: 'Optimized placement: Downstream transient pressure recorder'
  },
  {
    id: 'J-112',
    label: 'Junction J-112',
    x: 320,
    y: 300,
    type: 'junction',
    pressureNominal: 63,
    pressureSim: 62,
    flowLps: 45,
    description: 'South Residential District Feeder'
  },
  {
    id: 'S-05',
    label: 'Sensor S-05 (South Feeder)',
    x: 460,
    y: 310,
    type: 'sensor',
    pressureNominal: 62,
    pressureSim: 61,
    flowLps: 40,
    description: 'Optimized placement: Low-power IoT flow velocity sensor'
  },
  {
    id: 'S-06',
    label: 'Sensor S-06 (Boundary DMZ)',
    x: 620,
    y: 320,
    type: 'sensor',
    pressureNominal: 61,
    pressureSim: 59,
    flowLps: 36,
    description: 'Optimized placement: Boundary pressure check sensor'
  }
];

// Pipe segments connecting nodes
const PIPE_SEGMENTS = [
  { from: 'R-1', to: 'PS-1', diameter: '24" Main Feed', strokeWidth: 5 },
  { from: 'PS-1', to: 'S-01', diameter: '20" Transmission', strokeWidth: 4.5 },
  { from: 'S-01', to: 'J-102', diameter: '18" Arterial', strokeWidth: 4 },
  { from: 'J-102', to: 'S-02', diameter: '14" Commercial Branch', strokeWidth: 3 },
  { from: 'S-02', to: 'J-104', diameter: '12" Branch', strokeWidth: 2.5 },
  { from: 'J-102', to: 'S-03', diameter: '16" Central Arterial', strokeWidth: 3.5 },
  { from: 'S-03', to: 'J-108', diameter: '16" Main Arterial', strokeWidth: 3.5 },
  { from: 'J-108', to: 'S-04', diameter: '14" Downstream Loop', strokeWidth: 3 },
  { from: 'S-01', to: 'J-112', diameter: '14" South Trunk', strokeWidth: 3 },
  { from: 'J-112', to: 'S-05', diameter: '12" Residential', strokeWidth: 2.5 },
  { from: 'S-05', to: 'S-06', diameter: '10" Boundary', strokeWidth: 2 },
  { from: 'J-108', to: 'S-06', diameter: '10" Cross-link', strokeWidth: 2 }
];

type ActiveDashboardTab = 'live_monitoring' | 'nrw_audit' | 'sensor_placement' | 'work_orders';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveDashboardTab>('live_monitoring');
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [selectedNode, setSelectedNode] = useState<NetworkNode | null>(null);
  const [isDispatched, setIsDispatched] = useState<boolean>(false);
  const [showDispatchModal, setShowDispatchModal] = useState<boolean>(false);
  const [showDataDrawer, setShowDataDrawer] = useState<boolean>(false);
  const [selectedDma, setSelectedDma] = useState<string>('DMA-04 (Eastern Sector)');
  const [customDataset, setCustomDataset] = useState<{ time: string; actual: number; expected: number; pressure: number }[] | null>(null);
  const [csvUploadFeedback, setCsvUploadFeedback] = useState<string | null>(null);

  // Sensor placement interactive budget slider
  const [sensorBudgetK, setSensorBudgetK] = useState<number>(6);

  // Notification and SMS Receiving Options & Feed
  const [showSmsModal, setShowSmsModal] = useState<boolean>(false);
  const [smsModalTab, setSmsModalTab] = useState<'phone_preview' | 'recipient_settings'>('phone_preview');
  const [smsConfig, setSmsConfig] = useState<SmsRecipientConfig>(DEFAULT_SMS_CONFIG);
  const [smsPhoneInput, setSmsPhoneInput] = useState<string>(DEFAULT_SMS_CONFIG.phoneNumber);
  const [smsNameInput, setSmsNameInput] = useState<string>(DEFAULT_SMS_CONFIG.name);
  const [smsGatewayInput, setSmsGatewayInput] = useState<SmsRecipientConfig['smsGateway']>(DEFAULT_SMS_CONFIG.smsGateway);
  const [manualSmsText, setManualSmsText] = useState<string>('');
  const [smsToast, setSmsToast] = useState<{ id: string; text: string; time: string; phone: string } | null>(null);

  // Pre-seeded initial SMS history
  const [smsMessages, setSmsMessages] = useState<SmsMessage[]>([
    {
      id: 'sms-init-1',
      timestamp: '08:00',
      recipientPhone: DEFAULT_SMS_CONFIG.phoneNumber,
      recipientName: DEFAULT_SMS_CONFIG.name,
      direction: 'OUTBOUND_ALERT',
      messageText: 'EPANET SCADA Morning Sync: DMA-04 diurnal baseline active. 6/6 acoustic transducers reporting nominal hydraulic head (64.8 psi).',
      severity: 'INFO',
      status: 'Delivered'
    }
  ]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Live series and hydraulic calculations
  const flowData: FlowDataPoint[] = generateFlowSeries(isSimulating, customDataset || undefined);
  const activeAnomaly = flowData.reduce((max, d) => Math.max(max, d.leakAnomaly || 0), 0);
  const alertDetails = getAlertDetails(isSimulating, activeAnomaly);
  const nrwMetric = calculateNrwMetric(isSimulating, flowData);

  // Multi-dashboard simulated arrays
  const dmaList: DmaOverview[] = getSimulatedDmaList(isSimulating);
  const workOrdersList: WorkOrder[] = getSimulatedWorkOrders(isSimulating, isDispatched);

  // Auto-dismiss SMS toast after 6 seconds
  useEffect(() => {
    if (smsToast) {
      const timer = setTimeout(() => {
        setSmsToast(null);
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [smsToast]);

  // Supabase Cloud Integration & Live Sync State
  const [showSupabaseModal, setShowSupabaseModal] = useState<boolean>(false);
  const [supabaseTab, setSupabaseTab] = useState<'status' | 'sql_schema' | 'sync_data'>('status');
  const [supabaseStatus, setSupabaseStatus] = useState<SupabaseConnectionStatus | null>(null);
  const [isTestingSupabase, setIsTestingSupabase] = useState<boolean>(false);
  const [isSyncingSupabase, setIsSyncingSupabase] = useState<boolean>(false);
  const [copiedSql, setCopiedSql] = useState<boolean>(false);
  const [supabaseSyncLogs, setSupabaseSyncLogs] = useState<SupabaseSyncResult[]>([
    {
      success: true,
      table: 'connection_handshake',
      count: 1,
      message: `Configured Supabase client for project atgbqxmergxaaazrhbpr (${SUPABASE_CONFIG.region})`,
      timestamp: 'Ready'
    }
  ]);

  // Initial Supabase connection ping
  useEffect(() => {
    testSupabaseConnection().then(status => {
      setSupabaseStatus(status);
    });
  }, []);

  const handleTestSupabase = async () => {
    setIsTestingSupabase(true);
    try {
      const res = await testSupabaseConnection();
      setSupabaseStatus(res);
      setSupabaseSyncLogs(prev => [
        {
          success: res.connected,
          table: 'rest_api_ping',
          count: 1,
          message: res.connected
            ? `Connection verified in ${res.latencyMs}ms to ${res.projectInfo.url}`
            : `Connection check failed: ${res.error}`,
          timestamp: new Date().toLocaleTimeString()
        },
        ...prev
      ]);
    } finally {
      setIsTestingSupabase(false);
    }
  };

  const handleSyncLeakToSupabase = async () => {
    if (!alertDetails) return;
    setIsSyncingSupabase(true);
    try {
      const result = await syncLeakIncidentToSupabase(alertDetails);
      setSupabaseSyncLogs(prev => [result, ...prev]);
      setSmsToast({
        id: `toast-supa-${Date.now()}`,
        text: result.success
          ? `Supabase: Synced Leak Incident Node ${alertDetails.nodeId} (85 L/s)`
          : `Supabase Notice: ${result.message.slice(0, 65)}...`,
        time: result.timestamp,
        phone: 'Supabase DB'
      });
    } finally {
      setIsSyncingSupabase(false);
    }
  };

  const handleSyncWorkOrdersToSupabase = async () => {
    setIsSyncingSupabase(true);
    try {
      const result = await syncWorkOrdersToSupabase(workOrdersList);
      setSupabaseSyncLogs(prev => [result, ...prev]);
      setSmsToast({
        id: `toast-supa-wo-${Date.now()}`,
        text: result.success
          ? `Supabase: Synced ${result.count} Work Orders to Postgres`
          : `Supabase Notice: ${result.message.slice(0, 65)}...`,
        time: result.timestamp,
        phone: 'Supabase DB'
      });
    } finally {
      setIsSyncingSupabase(false);
    }
  };

  const handleSyncSmsToSupabase = async () => {
    setIsSyncingSupabase(true);
    try {
      const result = await syncSmsMessagesToSupabase(smsMessages);
      setSupabaseSyncLogs(prev => [result, ...prev]);
      setSmsToast({
        id: `toast-supa-sms-${Date.now()}`,
        text: result.success
          ? `Supabase: Synced ${result.count} SMS records to sms_dispatches`
          : `Supabase Notice: ${result.message.slice(0, 65)}...`,
        time: result.timestamp,
        phone: 'Supabase DB'
      });
    } finally {
      setIsSyncingSupabase(false);
    }
  };

  const handleCopySql = () => {
    navigator.clipboard.writeText(SUPABASE_SQL_SCHEMA);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
  };

  // Toggle simulation with automated SMS dispatch
  const handleToggleSimulation = () => {
    const nextState = !isSimulating;
    setIsSimulating(nextState);

    if (!nextState) {
      setIsDispatched(false);
      setShowDispatchModal(false);
      setSelectedNode(null);

      // Log recovery SMS
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const recoverySms: SmsMessage = {
        id: `sms-rec-${Date.now()}`,
        timestamp: timeStr,
        recipientPhone: smsConfig.phoneNumber,
        recipientName: smsConfig.name,
        direction: 'OUTBOUND_ALERT',
        messageText: `✅ [SCADA ALL-CLEAR] Network simulation reset. Node J-108 returned to nominal operating pressure (63.0 psi). NRW baseline normalized to 11.8%.`,
        severity: 'INFO',
        status: 'Delivered'
      };
      setSmsMessages(prev => [recoverySms, ...prev]);
      setSmsToast({
        id: `toast-${Date.now()}`,
        text: 'SCADA Alert: Network reset to nominal baseline. All-clear SMS sent.',
        time: timeStr,
        phone: smsConfig.phoneNumber
      });
    } else {
      const leakNode = NETWORK_NODES.find(n => n.id === 'J-108');
      if (leakNode) setSelectedNode(leakNode);

      // Automated Emergency SMS Dispatch
      if (smsConfig.sendOnCriticalBurst) {
        const emergencyText = formatEmergencySms(
          'J-108',
          85,
          'Sector 4B - Oak St & 5th Ave',
          ['V-108A', 'V-108B'],
          'WO-8842'
        );
        const now = new Date();
        const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        
        const burstSms: SmsMessage = {
          id: `sms-burst-${Date.now()}`,
          timestamp: timeStr,
          recipientPhone: smsConfig.phoneNumber,
          recipientName: smsConfig.name,
          direction: 'OUTBOUND_ALERT',
          messageText: emergencyText,
          severity: 'CRITICAL',
          status: 'Delivered'
        };

        setSmsMessages(prev => [burstSms, ...prev]);
        setSmsToast({
          id: `toast-${Date.now()}`,
          text: `🚨 EMERGENCY SMS DISPATCHED: Critical Rupture Node J-108 (85 L/s) to ${smsConfig.phoneNumber}`,
          time: timeStr,
          phone: smsConfig.phoneNumber
        });

        // 2.5s later simulate field crew acknowledgement SMS reply
        setTimeout(() => {
          const reply = generateCrewAcknowledgmentSms('Rapid Response Unit #4', 'WO-8842', 14);
          setSmsMessages(prev => [reply, ...prev]);
          setSmsToast({
            id: `toast-reply-${Date.now()}`,
            text: `💬 SMS Received from Unit #4 Foreman: "ACK WO #WO-8842. En route. ETA 14 mins."`,
            time: reply.timestamp,
            phone: reply.recipientPhone
          });
        }, 2500);
      }
    }
  };

  const handleDispatchAction = () => {
    setIsDispatched(true);
    setShowDispatchModal(true);

    // Send dispatch confirmation SMS
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const dispatchSms: SmsMessage = {
      id: `sms-disp-${Date.now()}`,
      timestamp: timeStr,
      recipientPhone: smsConfig.phoneNumber,
      recipientName: smsConfig.name,
      direction: 'OUTBOUND_ALERT',
      messageText: `[DISPATCH CONFIRMED] Work Order #WO-8842 assigned to Unit #4 (Hydraulics). Target: Node J-108 (Oak & 5th Ave). Valves V-108A & V-108B isolation queued. City Central Hospital bypass active.`,
      severity: 'WARNING',
      status: 'Delivered'
    };
    setSmsMessages(prev => [dispatchSms, ...prev]);
    setSmsToast({
      id: `toast-${Date.now()}`,
      text: `SMS Dispatched: Work Order #WO-8842 logged with Unit #4`,
      time: timeStr,
      phone: smsConfig.phoneNumber
    });
  };

  const handleSendTestSms = () => {
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const testSms: SmsMessage = {
      id: `sms-test-${Date.now()}`,
      timestamp: timeStr,
      recipientPhone: smsConfig.phoneNumber,
      recipientName: smsConfig.name,
      direction: 'OUTBOUND_ALERT',
      messageText: `🔔 [SCADA TEST ALERT] Emergency SMS Gateway verification from Smart City Water Monitor. Protocol verified for ${smsConfig.name} (${smsConfig.role}). Gateway: ${smsConfig.smsGateway}.`,
      severity: 'INFO',
      status: 'Delivered'
    };
    setSmsMessages(prev => [testSms, ...prev]);
    setSmsToast({
      id: `toast-${Date.now()}`,
      text: `Test SMS delivered to ${smsConfig.phoneNumber} via ${smsConfig.smsGateway}`,
      time: timeStr,
      phone: smsConfig.phoneNumber
    });
  };

  const handleSaveSmsSettings = (e: React.FormEvent) => {
    e.preventDefault();
    setSmsConfig(prev => ({
      ...prev,
      phoneNumber: smsPhoneInput,
      name: smsNameInput,
      smsGateway: smsGatewayInput
    }));
    setSmsToast({
      id: `toast-${Date.now()}`,
      text: `SMS Receiving settings saved for ${smsNameInput} (${smsPhoneInput})`,
      time: 'Just now',
      phone: smsPhoneInput
    });
  };

  const handleSendManualReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualSmsText.trim()) return;

    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const userSms: SmsMessage = {
      id: `sms-user-${Date.now()}`,
      timestamp: timeStr,
      recipientPhone: smsConfig.phoneNumber,
      recipientName: smsConfig.name,
      direction: 'INBOUND_REPLY',
      messageText: manualSmsText.trim(),
      severity: 'INFO',
      status: 'Received'
    };

    setSmsMessages(prev => [userSms, ...prev]);
    setManualSmsText('');
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const parsed = parseTelemetryCsv(text);
        if (parsed.length > 0) {
          const formatted = parsed.map(p => ({
            time: p.timestamp,
            actual: p.actualFlowLps,
            expected: p.expectedFlowLps,
            pressure: p.pressurePsi
          }));
          setCustomDataset(formatted);
          setCsvUploadFeedback(`Loaded ${parsed.length} real SCADA telemetry intervals from "${file.name}"`);
        } else {
          setCsvUploadFeedback('Could not parse valid records. Ensure CSV has Time, Flow, and Pressure columns.');
        }
      } catch (err) {
        setCsvUploadFeedback('Failed to read telemetry file.');
      }
    };
    reader.readAsText(file);
  };

  const handleExportCsv = () => {
    const records: TelemetryRecord[] = flowData.map((d, i) => ({
      id: `tel-${i}`,
      timestamp: d.time,
      actualFlowLps: d.actualFlow,
      expectedFlowLps: d.expectedDemand,
      pressurePsi: d.pressurePsi,
      residualAnomalyLps: d.leakAnomaly || 0,
      zScore: d.zScore || 0,
      isAnomaly: (d.leakAnomaly || 0) > 0
    }));

    const csvContent = exportTelemetryToCsv(records);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `EPANET_Telemetry_${selectedDma.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleResetToBenchmark = () => {
    setCustomDataset(null);
    setCsvUploadFeedback(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const waterBalancePieData = [
    { name: 'Billed Authorized', value: nrwMetric.waterBalance.authorizedConsumptionM3, color: '#0284c7' },
    { name: 'Apparent Losses', value: nrwMetric.waterBalance.apparentLossesM3, color: '#f59e0b' },
    { name: 'Real Physical Losses', value: nrwMetric.waterBalance.realLossesM3, color: isSimulating ? '#dc2626' : '#64748b' }
  ];

  return (
    <div className="min-h-screen bg-gray-50 text-slate-800 font-sans antialiased flex flex-col relative">
      {/* Floating Real-Time SMS Alert Toast */}
      {smsToast && (
        <div className="fixed top-20 right-6 z-50 max-w-sm w-full bg-slate-900 text-white rounded-lg shadow-2xl p-4 border border-slate-700 animate-in slide-in-from-top-4 duration-200">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-full shrink-0">
                <Smartphone className="w-4 h-4 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">SMS Alert Sent</span>
                  <span className="text-[10px] text-gray-400">{smsToast.time}</span>
                </div>
                <p className="text-xs text-slate-200 font-medium mt-1 leading-snug">
                  {smsToast.text}
                </p>
                <div className="mt-2 flex items-center gap-3 text-[11px]">
                  <span className="text-gray-400">To: {smsToast.phone}</span>
                  <button
                    onClick={() => {
                      setShowSmsModal(true);
                      setSmsModalTab('phone_preview');
                    }}
                    className="text-blue-400 hover:text-blue-300 font-semibold underline cursor-pointer"
                  >
                    View in Phone Inbox
                  </button>
                </div>
              </div>
            </div>
            <button
              onClick={() => setSmsToast(null)}
              className="text-gray-400 hover:text-white p-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-gray-200 px-6 py-3.5 shadow-xs">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 text-blue-700 rounded-lg border border-blue-100 flex items-center justify-center shadow-xs">
              <Droplets className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-xl font-extrabold text-blue-700 tracking-tight">LeakNova</span>
                  <span className="text-gray-300 font-light">|</span>
                  <span className="text-sm font-semibold text-gray-800">Smart City Water Monitor</span>
                </div>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-800 border border-blue-200">
                  EPANET 2.2 Core
                </span>
                <span className="hidden xl:inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono bg-gray-100 text-gray-600 border border-gray-200" title="Project ID: cqvdsywibtbdonsuuwpc">
                  PID: cqvdsywibtbdonsuuwpc
                </span>
                {customDataset ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
                    <Database className="w-3.5 h-3.5" />
                    USER SCADA INGESTED
                  </span>
                ) : isSimulating ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700 border border-red-200 animate-pulse">
                    <span className="w-2 h-2 rounded-full bg-red-600"></span>
                    SIMULATION ACTIVE
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    LIVE MONITORING
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 font-medium mt-0.5">
                <span>NRW Reduction & EPANET Simulation</span>
                <span className="text-gray-300">•</span>
                <span className="font-mono text-[11px] text-gray-400">UUID: bd0f6dee-0647-4d81-9582-0929186cd9e4</span>
              </div>
            </div>
          </div>

          {/* Action, SMS Alerts, Supabase Cloud, and DMA selector */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Supabase Cloud Database Connection Button */}
            <button
              onClick={() => setShowSupabaseModal(true)}
              aria-label="Open Supabase Cloud Database Integration"
              className="px-3 py-1.5 rounded-md font-semibold text-xs bg-slate-900 hover:bg-slate-800 text-white flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs border border-slate-700"
              title="Supabase: atgbqxmergxaaazrhbpr (ap-northeast-1)"
            >
              <div className={`w-2 h-2 rounded-full ${supabaseStatus?.connected ? 'bg-emerald-400' : 'bg-amber-400'} animate-pulse`}></div>
              <Database className="w-3.5 h-3.5 text-emerald-400" />
              <span>Supabase ({SUPABASE_CONFIG.projectId})</span>
            </button>

            {/* Notification / SMS Option Button */}
            <button
              onClick={() => setShowSmsModal(true)}
              aria-label="Open SMS Notifications & Receiving Settings"
              className="px-3 py-1.5 rounded-md font-semibold text-xs bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs relative"
            >
              <Smartphone className="w-3.5 h-3.5 text-emerald-700" />
              <span>SMS Alerts ({smsConfig.phoneNumber})</span>
              <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse"></span>
            </button>

            <button
              onClick={() => setShowDataDrawer(true)}
              aria-label="Open Telemetry Data & SCADA Ingestion"
              className="px-3 py-1.5 rounded-md font-medium text-xs bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
            >
              <Table className="w-3.5 h-3.5 text-blue-600" />
              <span>Telemetry Data ({flowData.length} pts)</span>
            </button>

            <div className="hidden sm:flex items-center gap-2 text-xs text-gray-600 bg-gray-50 px-3 py-1.5 rounded-md border border-gray-200">
              <Compass className="w-4 h-4 text-gray-400" />
              <span className="font-medium text-gray-700">Sector:</span>
              <select
                aria-label="District Metered Area selection"
                value={selectedDma}
                onChange={(e) => setSelectedDma(e.target.value)}
                className="bg-transparent text-gray-800 font-semibold focus:outline-hidden cursor-pointer"
              >
                <option value="DMA-04 (Eastern Sector)">DMA-04 (Eastern Sector)</option>
                <option value="DMA-01 (Downtown Core)">DMA-01 (Downtown Core)</option>
                <option value="DMA-07 (West Industrial)">DMA-07 (West Industrial)</option>
              </select>
            </div>

            <button
              onClick={handleToggleSimulation}
              aria-label={isSimulating ? 'Stop Leak Simulation' : 'Run Leak Simulation'}
              className={`px-4 py-2 rounded-md font-semibold text-sm transition-all duration-150 flex items-center gap-2 shadow-xs cursor-pointer ${
                isSimulating
                  ? 'bg-amber-600 hover:bg-amber-700 text-white border border-amber-700'
                  : 'bg-blue-600 hover:bg-blue-700 text-white border border-blue-700'
              }`}
            >
              {isSimulating ? (
                <>
                  <RotateCcw className="w-4 h-4" />
                  <span>Reset Simulation</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-white" />
                  <span>Run Leak Simulation</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Dashboard Navigation Tabs */}
        <div className="max-w-7xl mx-auto mt-3 pt-2 border-t border-gray-100 flex items-center gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setActiveTab('live_monitoring')}
            className={`px-3.5 py-1.5 rounded-md text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer shrink-0 ${
              activeTab === 'live_monitoring'
                ? 'bg-blue-50 text-blue-700 border border-blue-200 shadow-2xs'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Hydraulic Overview & Simulation</span>
          </button>

          <button
            onClick={() => setActiveTab('nrw_audit')}
            className={`px-3.5 py-1.5 rounded-md text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer shrink-0 ${
              activeTab === 'nrw_audit'
                ? 'bg-blue-50 text-blue-700 border border-blue-200 shadow-2xs'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <PieChartIcon className="w-4 h-4" />
            <span>NRW & AWWA Water Audit</span>
            {isSimulating && (
              <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse"></span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('sensor_placement')}
            className={`px-3.5 py-1.5 rounded-md text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer shrink-0 ${
              activeTab === 'sensor_placement'
                ? 'bg-blue-50 text-blue-700 border border-blue-200 shadow-2xs'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <Radio className="w-4 h-4" />
            <span>Sensor Placement & Genetic Optimizer</span>
          </button>

          <button
            onClick={() => setActiveTab('work_orders')}
            className={`px-3.5 py-1.5 rounded-md text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer shrink-0 ${
              activeTab === 'work_orders'
                ? 'bg-blue-50 text-blue-700 border border-blue-200 shadow-2xs'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <Truck className="w-4 h-4" />
            <span>Work Orders & Dispatch</span>
            {isSimulating && (
              <span className="px-1.5 py-0.2 rounded text-[10px] bg-red-100 text-red-700 font-bold">
                1 Alert
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto w-full p-4 md:p-6 space-y-6 flex-1">
        {/* Metric Cards Row */}
        <section aria-label="Key Performance Indicators" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Inflow Demand</span>
              <Waves className={`w-4 h-4 ${isSimulating ? 'text-red-500' : 'text-blue-500'}`} />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-gray-900">
                {(flowData.find(d => d.time === '14:00')?.actualFlow || 68.9).toFixed(1)}
              </span>
              <span className="text-xs font-medium text-gray-500">L/s</span>
            </div>
            <div className="mt-1 flex items-center text-xs">
              {isSimulating ? (
                <span className="text-red-600 font-medium flex items-center gap-0.5">
                  <TrendingUp className="w-3.5 h-3.5" /> +85.0 L/s physical rupture
                </span>
              ) : (
                <span className="text-gray-500 font-medium flex items-center gap-0.5">
                  <Activity className="w-3.5 h-3.5 text-gray-400" /> Diurnal consumer baseline
                </span>
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">AWWA NRW Ratio</span>
              <TrendingDown className={`w-4 h-4 ${isSimulating ? 'text-red-500' : 'text-emerald-500'}`} />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className={`text-2xl font-bold ${isSimulating ? 'text-red-600' : 'text-gray-900'}`}>
                {nrwMetric.nrwPercentage.toFixed(1)}%
              </span>
              <span className="text-xs font-medium text-gray-500">of bulk supply</span>
            </div>
            <div className="mt-1 flex items-center text-xs font-medium">
              <span className={isSimulating ? 'text-red-600' : 'text-emerald-600'}>
                ILI: {nrwMetric.waterBalance.infrastructureLeakIndexIli} ({isSimulating ? 'Critical' : 'Optimal'})
              </span>
            </div>
          </div>

          <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Hazen-Williams Head</span>
              <Gauge className={`w-4 h-4 ${isSimulating ? 'text-amber-500' : 'text-indigo-500'}`} />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-gray-900">
                {(flowData.find(d => d.time === '14:00')?.pressurePsi || 64.7).toFixed(1)}
              </span>
              <span className="text-xs font-medium text-gray-500">psi</span>
            </div>
            <div className="mt-1 flex items-center text-xs">
              {isSimulating ? (
                <span className="text-amber-600 font-medium flex items-center gap-0.5">
                  <TrendingDown className="w-3.5 h-3.5" /> -18.4 psi gradient deficit
                </span>
              ) : (
                <span className="text-emerald-600 font-medium flex items-center gap-0.5">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Optimal hydraulic head
                </span>
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Sensor Coverage</span>
              <Radio className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-gray-900">6 / 6</span>
              <span className="text-xs font-medium text-gray-500">Loggers Active</span>
            </div>
            <div className="mt-1 flex items-center text-xs text-gray-500 font-medium">
              <span>98.4% Network Observability</span>
            </div>
          </div>
        </section>

        {/* TAB 1: Live Monitoring & EPANET Simulation (Core Dashboard) */}
        {activeTab === 'live_monitoring' && (
          <div className="space-y-6">
            <section aria-label="Hydraulic Visualizations" className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Panel 1: Network Map (Localization) */}
              <div className="bg-white rounded-lg border border-gray-200 shadow-xs flex flex-col overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-bold text-gray-900">Panel 1: Network Map (Localization)</h2>
                      <span className="text-xs px-2 py-0.5 rounded font-medium bg-gray-100 text-gray-600 border border-gray-200">
                        Topology View
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      EPANET industrial piping network with optimized sensor placements
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {isSimulating ? (
                      <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-600"></span>
                        </span>
                        RUPTURE LOCALIZED
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        Network Nominal
                      </span>
                    )}
                  </div>
                </div>

                <div className="p-4 bg-slate-50/50 flex-1 flex flex-col justify-center">
                  <div className="relative w-full aspect-4/3 bg-white rounded-lg border border-gray-200 shadow-2xs overflow-hidden">
                    <svg className="absolute inset-0 w-full h-full pointer-events-none" xmlns="http://www.w3.org/2000/svg">
                      <defs>
                        <pattern id="smallGrid" width="20" height="20" patternUnits="userSpaceOnUse">
                          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#f1f5f9" strokeWidth="1" />
                        </pattern>
                      </defs>
                      <rect width="100%" height="100%" fill="url(#smallGrid)" />
                    </svg>

                    <svg viewBox="0 0 760 400" className="w-full h-full relative z-10" aria-label="EPANET Hydraulic Network Map">
                      <defs>
                        <linearGradient id="mainPipeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#0284c7" />
                          <stop offset="100%" stopColor="#0ea5e9" />
                        </linearGradient>
                        <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                          <feGaussianBlur stdDeviation="3" result="blur" />
                          <feComposite in="SourceGraphic" in2="blur" operator="over" />
                        </filter>
                      </defs>

                      {PIPE_SEGMENTS.map((pipe, idx) => {
                        const fromNode = NETWORK_NODES.find(n => n.id === pipe.from);
                        const toNode = NETWORK_NODES.find(n => n.id === pipe.to);
                        if (!fromNode || !toNode) return null;
                        const isNearLeak = isSimulating && (pipe.from === 'J-108' || pipe.to === 'J-108');

                        return (
                          <g key={`pipe-${idx}`}>
                            <line x1={fromNode.x} y1={fromNode.y} x2={toNode.x} y2={toNode.y} stroke="#cbd5e1" strokeWidth={pipe.strokeWidth + 3} strokeLinecap="round" />
                            <line x1={fromNode.x} y1={fromNode.y} x2={toNode.x} y2={toNode.y} stroke={isNearLeak ? '#f87171' : 'url(#mainPipeGrad)'} strokeWidth={pipe.strokeWidth} strokeLinecap="round" strokeDasharray={isNearLeak ? '6 3' : undefined} />
                            <circle cx={(fromNode.x + toNode.x) / 2} cy={(fromNode.y + toNode.y) / 2} r={2} fill={isNearLeak ? '#dc2626' : '#0369a1'} />
                          </g>
                        );
                      })}

                      {NETWORK_NODES.map((node) => {
                        const isLeak = node.id === 'J-108';
                        const isSelected = selectedNode?.id === node.id;

                        if (node.type === 'reservoir') {
                          return (
                            <g key={node.id} className="cursor-pointer" onClick={() => setSelectedNode(node)} role="button" tabIndex={0} aria-label={`Reservoir ${node.label}`}>
                              <rect x={node.x - 22} y={node.y - 20} width={44} height={40} rx={6} fill="#0284c7" stroke="#0369a1" strokeWidth={2} />
                              <text x={node.x} y={node.y + 4} textAnchor="middle" fill="#ffffff" fontSize="11" fontWeight="bold">R-1</text>
                              <text x={node.x} y={node.y - 26} textAnchor="middle" fill="#334155" fontSize="10" fontWeight="600">Main Reservoir</text>
                            </g>
                          );
                        }

                        if (node.type === 'pump') {
                          return (
                            <g key={node.id} className="cursor-pointer" onClick={() => setSelectedNode(node)} role="button" tabIndex={0} aria-label={`Pump station ${node.label}`}>
                              <circle cx={node.x} cy={node.y} r={15} fill="#0ea5e9" stroke="#0284c7" strokeWidth={2} />
                              <text x={node.x} y={node.y + 3.5} textAnchor="middle" fill="#ffffff" fontSize="10" fontWeight="bold">PS</text>
                              <text x={node.x} y={node.y + 28} textAnchor="middle" fill="#475569" fontSize="9" fontWeight="500">PS-01</text>
                            </g>
                          );
                        }

                        if (node.type === 'sensor') {
                          return (
                            <g key={node.id} className="cursor-pointer group" onClick={() => setSelectedNode(node)} role="button" tabIndex={0} aria-label={`Optimized Sensor ${node.label}`}>
                              <circle cx={node.x} cy={node.y} r={isSelected ? 11 : 9} fill="#10b981" stroke="#ffffff" strokeWidth={2.5} className="shadow-sm transition-all" />
                              <circle cx={node.x} cy={node.y} r={4} fill="#065f46" />
                              <text x={node.x} y={node.y - 13} textAnchor="middle" fill="#047857" fontSize="9.5" fontWeight="bold">{node.id}</text>
                            </g>
                          );
                        }

                        return (
                          <g key={node.id} className="cursor-pointer" onClick={() => setSelectedNode(node)} role="button" tabIndex={0} aria-label={`Junction node ${node.label}`}>
                            {isLeak && isSimulating ? (
                              <g>
                                <circle cx={node.x} cy={node.y} r={24} fill="none" stroke="#ef4444" strokeWidth={2} className="animate-ping origin-center" style={{ transformOrigin: `${node.x}px ${node.y}px` }} />
                                <circle cx={node.x} cy={node.y} r={16} fill="#fee2e2" stroke="#dc2626" strokeWidth={2} opacity={0.8} />
                                <circle cx={node.x} cy={node.y} r={9} fill="#dc2626" stroke="#ffffff" strokeWidth={2} filter="url(#glow)" />
                                <g transform={`translate(${node.x - 55}, ${node.y - 48})`}>
                                  <rect width={110} height={24} rx={4} fill="#dc2626" stroke="#b91c1c" strokeWidth={1} />
                                  <text x={55} y={16} textAnchor="middle" fill="#ffffff" fontSize="10.5" fontWeight="bold">LEAK: J-108 (85 L/s)</text>
                                  <polygon points="50,24 60,24 55,29" fill="#dc2626" />
                                </g>
                              </g>
                            ) : (
                              <g>
                                <circle cx={node.x} cy={node.y} r={isSelected ? 7 : 5} fill={isSelected ? '#2563eb' : '#64748b'} stroke="#ffffff" strokeWidth={2} />
                                <text x={node.x} y={node.y + 16} textAnchor="middle" fill="#64748b" fontSize="9" fontWeight="500">{node.id}</text>
                              </g>
                            )}
                          </g>
                        );
                      })}
                    </svg>

                    <div className="absolute bottom-2 left-2 bg-white/95 backdrop-blur-xs p-2 rounded border border-gray-200 text-[10px] text-gray-600 space-y-1 shadow-2xs">
                      <div className="font-semibold text-gray-800 text-[11px] mb-1">Network Legend</div>
                      <div className="flex items-center gap-2">
                        <span className="w-4 h-1 bg-sky-500 rounded-sm"></span>
                        <span>Pipes (Cyan/Blue Strokes)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 border border-white"></span>
                        <span className="font-medium text-emerald-800">Optimized Sensors (S1-S6)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-red-600 border border-white animate-pulse"></span>
                        <span className="font-semibold text-red-700">Localized Leak (Node J-108)</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 bg-white p-3 rounded-md border border-gray-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">
                        {selectedNode ? selectedNode.label : 'Active Sector:'}
                      </span>
                      <span className="text-gray-500">
                        {selectedNode ? selectedNode.description : 'Click any pipe junction or sensor marker to inspect live telemetry.'}
                      </span>
                    </div>
                    {selectedNode && (
                      <div className="flex items-center gap-3 font-mono shrink-0">
                        <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-700">
                          P: {isSimulating ? selectedNode.pressureSim : selectedNode.pressureNominal} psi
                        </span>
                        <span className="bg-blue-50 px-2 py-0.5 rounded text-blue-700">
                          Q: {selectedNode.flowLps} L/s
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Panel 2: Flow Monitor (Demand Filtering) */}
              <div className="bg-white rounded-lg border border-gray-200 shadow-xs flex flex-col overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-bold text-gray-900">Panel 2: Flow Monitor (Demand Filtering)</h2>
                      <span className="text-xs px-2 py-0.5 rounded font-medium bg-gray-100 text-gray-600 border border-gray-200">
                        Time Series
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Distinguishing genuine pipe rupture from normal diurnal customer consumption
                    </p>
                  </div>

                  {isSimulating ? (
                    <div className="text-right">
                      <span className="text-xs font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-1 rounded inline-flex items-center gap-1">
                        <TrendingUp className="w-3.5 h-3.5" /> +85 L/s Burst Spike
                      </span>
                    </div>
                  ) : (
                    <div className="text-right">
                      <span className="text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded inline-flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Normal Diurnal Curve
                      </span>
                    </div>
                  )}
                </div>

                <div className="p-4 flex-1 flex flex-col justify-center">
                  <div className="w-full h-72 sm:h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={flowData} margin={{ top: 15, right: 20, left: -10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis dataKey="time" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} />
                        <YAxis domain={[0, 200]} tick={{ fill: '#64748b', fontSize: 11 }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} unit=" L/s" />
                        <Tooltip
                          content={({ active, payload, label }) => {
                            if (active && payload && payload.length) {
                              const actual = payload.find(p => p.dataKey === 'actualFlow')?.value as number;
                              const expected = payload.find(p => p.dataKey === 'expectedDemand')?.value as number;
                              const diff = actual && expected ? Math.round((actual - expected) * 10) / 10 : 0;
                              return (
                                <div className="bg-white p-3 rounded-md shadow-md border border-gray-200 text-xs space-y-1.5 min-w-[170px]">
                                  <div className="font-bold text-gray-800 border-b border-gray-100 pb-1">Time: {label}</div>
                                  <div className="flex items-center justify-between text-gray-500">
                                    <span>Expected Demand:</span>
                                    <span className="font-semibold text-gray-700">{expected} L/s</span>
                                  </div>
                                  <div className="flex items-center justify-between text-blue-600">
                                    <span>Actual Sensor Flow:</span>
                                    <span className="font-bold text-blue-700">{actual} L/s</span>
                                  </div>
                                  {diff > 10 && (
                                    <div className="mt-1 pt-1 border-t border-red-100 flex items-center justify-between text-red-600 font-bold">
                                      <span>Anomaly Step:</span>
                                      <span>+{diff} L/s</span>
                                    </div>
                                  )}
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Legend wrapperStyle={{ paddingTop: '10px', fontSize: '12px' }} iconType="plainline" />

                        {isSimulating && (
                          <ReferenceArea x1="14:00" x2="22:00" y1={0} y2={200} fill="#fee2e2" fillOpacity={0.35} stroke="#f87171" strokeDasharray="3 3" />
                        )}

                        {isSimulating && (
                          <ReferenceLine x="14:00" stroke="#dc2626" strokeDasharray="4 4" label={{ value: 'Leak Onset (14:00)', fill: '#dc2626', fontSize: 10, position: 'insideTopLeft' }} />
                        )}

                        <Line type="monotone" name="Expected Normal Demand" dataKey="expectedDemand" stroke="#94a3b8" strokeWidth={2.5} dot={{ r: 3, fill: '#94a3b8' }} activeDot={{ r: 5 }} />
                        <Line type="monotone" name="Actual Sensor Flow" dataKey="actualFlow" stroke={isSimulating ? '#dc2626' : '#0284c7'} strokeWidth={3} dot={{ r: 3.5, fill: isSimulating ? '#dc2626' : '#0284c7' }} activeDot={{ r: 6 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="mt-2 bg-blue-50/60 p-3 rounded-md border border-blue-100 flex items-start gap-2.5 text-xs text-blue-900">
                    <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold">Demand Filtering Insight: </span>
                      {isSimulating ? (
                        <span>
                          Statistical Z-Score filter detected a +{activeAnomaly} L/s persistent excess (Z = +38.22σ) starting at 14:00. Emergency SMS alerts were instantly dispatched to {smsConfig.phoneNumber}.
                        </span>
                      ) : (
                        <span>
                          Standard morning (08:00) and evening (18:00) consumption surges are classified as expected user demand (Z &lt; 1.5σ). The system continuously tracks against baseline historical consumption profiles.
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Panel 3: Prioritization Alerts (Bottom Width) */}
            <section aria-label="System Prioritization Alerts">
              {!isSimulating ? (
                <div className="bg-white rounded-lg border border-gray-200 p-8 shadow-xs text-center flex flex-col items-center justify-center">
                  <div className="w-12 h-12 bg-gray-100 text-gray-500 rounded-full flex items-center justify-center mb-3">
                    <ShieldCheck className="w-6 h-6 text-gray-400" />
                  </div>
                  <h3 className="text-base font-bold text-gray-800 tracking-tight">System Operating Normally</h3>
                  <p className="text-sm text-gray-500 max-w-lg mt-1">
                    All 6 optimized acoustic sensors and pressure transducers in DMA-04 report nominal hydraulic gradients. No unaccounted flow anomalies or pressure drops detected. SMS dispatch gateway active on {smsConfig.phoneNumber}.
                  </p>
                  <div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-xs text-gray-400">
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> EPANET 2.2 Simulation Synced
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Activity className="w-3.5 h-3.5 text-emerald-500" /> Diurnal Filter Active
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Smartphone className="w-3.5 h-3.5 text-emerald-500" /> SMS Emergency Relay Ready
                    </span>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-lg border-2 border-red-500 shadow-sm overflow-hidden transition-all duration-300">
                  <div className="bg-red-600 px-6 py-3 text-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="p-1.5 bg-red-700 rounded-md">
                        <ShieldAlert className="w-5 h-5 text-white animate-bounce" />
                      </div>
                      <div>
                        <span className="text-xs uppercase tracking-wider font-semibold opacity-90">
                          Emergency Alert • DMA-04 East
                        </span>
                        <h3 className="text-lg font-extrabold leading-tight">
                          CRITICAL PIPE RUPTURE DETECTED & LOCALIZED
                        </h3>
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                      <span className="inline-block bg-white text-red-700 font-black text-xs md:text-sm px-3.5 py-1.5 rounded shadow-sm border border-red-200 uppercase tracking-wide">
                        {alertDetails?.dispatchUrgency}
                      </span>
                    </div>
                  </div>

                  <div className="p-6 bg-red-50/20">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                      <div className="bg-white p-4 rounded-lg border border-red-200 shadow-2xs">
                        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                          <MapPin className="w-4 h-4 text-red-600" /> Localized Node ID
                        </div>
                        <div className="mt-2 text-xl font-bold text-red-700 flex items-center gap-1.5">
                          <span>{alertDetails?.nodeId}</span>
                          <span className="text-xs px-2 py-0.5 rounded bg-red-100 text-red-800 font-medium">
                            Arterial
                          </span>
                        </div>
                        <div className="mt-1 text-xs text-gray-600 font-medium">
                          {alertDetails?.locationName}
                        </div>
                        <div className="mt-2 pt-2 border-t border-gray-100 text-[11px] text-gray-500">
                          Pipe ID: <span className="font-semibold text-gray-700">{alertDetails?.pipeId}</span>
                        </div>
                      </div>

                      <div className="bg-white p-4 rounded-lg border border-red-200 shadow-2xs">
                        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                          <Droplets className="w-4 h-4 text-red-600" /> Estimated Leak Size
                        </div>
                        <div className="mt-2 text-2xl font-black text-gray-900">
                          {alertDetails?.estimatedLeakSizeLps} <span className="text-sm font-semibold text-gray-500">L/s</span>
                        </div>
                        <div className="mt-1 text-xs text-red-600 font-semibold">
                          ~306.0 m³/hr ({(alertDetails?.hourlyLossGallons ?? 0).toLocaleString()} gal/hr)
                        </div>
                        <div className="mt-2 pt-2 border-t border-gray-100 text-[11px] text-gray-500 flex items-center justify-between">
                          <span>Orifice Area (Torricelli):</span>
                          <span className="font-bold text-red-600">{alertDetails?.orificeAreaMm2} mm²</span>
                        </div>
                      </div>

                      <div className="bg-white p-4 rounded-lg border border-red-200 shadow-2xs">
                        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                          <AlertTriangle className="w-4 h-4 text-amber-600" /> Calculated Priority Score
                        </div>
                        <div className="mt-2 flex items-baseline gap-2">
                          <span className="text-3xl font-black text-red-700">
                            {alertDetails?.priorityScore}
                          </span>
                          <span className="text-sm font-bold text-gray-500">/ 100</span>
                          <span className="ml-auto text-xs px-2 py-0.5 rounded font-black bg-red-600 text-white">
                            {alertDetails?.priorityLevel}
                          </span>
                        </div>
                        <div className="mt-1 text-xs text-gray-600">
                          Ranking: <span className="font-semibold text-red-700">Tier 1 Municipal Urgency</span>
                        </div>
                        <div className="mt-2 pt-2 border-t border-gray-100 text-[11px] text-gray-500 flex items-center justify-between">
                          <span>SMS Recipient:</span>
                          <span className="font-bold text-emerald-700 font-mono">{smsConfig.phoneNumber}</span>
                        </div>
                      </div>

                      <div className="bg-white p-4 rounded-lg border border-red-200 shadow-2xs flex flex-col justify-between">
                        <div>
                          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                            <DollarSign className="w-4 h-4 text-amber-600" /> Economic Loss Rate
                          </div>
                          <div className="mt-2 text-2xl font-black text-amber-600">
                            ${alertDetails?.hourlyCostUsd} <span className="text-xs font-semibold text-gray-500">/ hour</span>
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            Physical losses computed via AWWA M36 standard volumetric water balance.
                          </div>
                        </div>

                        <div className="mt-3 flex gap-2">
                          <button
                            onClick={handleDispatchAction}
                            aria-label="Dispatch Rapid Response Team"
                            className={`flex-1 py-2.5 px-3 rounded-md font-bold text-xs uppercase tracking-wide flex items-center justify-center gap-2 transition-all cursor-pointer ${
                              isDispatched
                                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                                : 'bg-red-600 text-white hover:bg-red-700 shadow-xs'
                            }`}
                          >
                            {isDispatched ? (
                              <>
                                <CheckCircle2 className="w-4 h-4" /> Dispatched
                              </>
                            ) : (
                              <>
                                <Truck className="w-4 h-4" /> Dispatch Crew
                              </>
                            )}
                          </button>

                          <button
                            onClick={() => {
                              setShowSmsModal(true);
                              setSmsModalTab('phone_preview');
                            }}
                            aria-label="View Sent SMS Dispatch Logs"
                            className="px-3 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md font-semibold text-xs flex items-center justify-center cursor-pointer transition-colors"
                            title="Open SMS Thread"
                          >
                            <Smartphone className="w-4 h-4 text-emerald-700" />
                          </button>

                          <button
                            onClick={handleSyncLeakToSupabase}
                            disabled={isSyncingSupabase}
                            aria-label="Sync Leak Incident to Supabase Database"
                            className="px-3 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-md font-semibold text-xs flex items-center justify-center cursor-pointer transition-colors"
                            title="Sync Incident to Supabase (atgbqxmergxaaazrhbpr)"
                          >
                            <Database className="w-4 h-4 text-emerald-600" />
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 bg-white p-3.5 rounded-lg border border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-gray-600 gap-3">
                      <div className="flex items-center gap-2">
                        <Wrench className="w-4 h-4 text-gray-500 shrink-0" />
                        <span>
                          <strong className="text-gray-900">Recommended Action Plan: </strong>
                          Isolate isolation gate valves <strong>V-108A</strong> and <strong>V-108B</strong> on Oak Street to bypass 16" arterial without dropping pressure to nearby City Central Hospital.
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-semibold text-gray-700">Estimated Repair Window:</span>
                        <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-800 font-mono">1.8 hrs</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </section>
          </div>
        )}

        {/* TAB 2: NRW & AWWA Water Audit Dashboard */}
        {activeTab === 'nrw_audit' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4">
                <div>
                  <h2 className="text-base font-bold text-gray-900">
                    AWWA M36 Standard Volumetric Water Balance
                  </h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    District Metered Area System Input Volume (SIV) apportionment and economic loss tracking
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                    SIV: {nrwMetric.waterBalance.systemInputVolumeM3.toLocaleString()} m³ / day
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-5 items-center">
                <div className="h-64 flex flex-col items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={waterBalancePieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {waterBalancePieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: any) => `${Number(value).toLocaleString()} m³`} />
                      <Legend verticalAlign="bottom" height={36} iconType="circle" />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-sky-50/60 p-4 rounded-lg border border-sky-100">
                    <span className="text-xs font-bold text-sky-800 uppercase tracking-wider">Authorized Consumption</span>
                    <div className="mt-2 text-xl font-extrabold text-sky-900">
                      {nrwMetric.waterBalance.authorizedConsumptionM3.toLocaleString()} <span className="text-xs font-semibold text-sky-700">m³</span>
                    </div>
                    <div className="text-xs text-sky-700 mt-1">
                      {((nrwMetric.waterBalance.authorizedConsumptionM3 / (nrwMetric.waterBalance.systemInputVolumeM3 || 1)) * 100).toFixed(1)}% of supply volume
                    </div>
                    <div className="mt-2 pt-2 border-t border-sky-200/60 text-[11px] text-sky-600">
                      Billed metered residential & commercial revenue
                    </div>
                  </div>

                  <div className="bg-amber-50/60 p-4 rounded-lg border border-amber-100">
                    <span className="text-xs font-bold text-amber-800 uppercase tracking-wider">Apparent Losses</span>
                    <div className="mt-2 text-xl font-extrabold text-amber-900">
                      {nrwMetric.waterBalance.apparentLossesM3.toLocaleString()} <span className="text-xs font-semibold text-amber-700">m³</span>
                    </div>
                    <div className="text-xs text-amber-700 mt-1">
                      4.0% estimated metering inaccuracy
                    </div>
                    <div className="mt-2 pt-2 border-t border-amber-200/60 text-[11px] text-amber-600">
                      Data handling error & unauthorized consumption
                    </div>
                  </div>

                  <div className={`p-4 rounded-lg border ${isSimulating ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'}`}>
                    <span className={`text-xs font-bold uppercase tracking-wider ${isSimulating ? 'text-red-800' : 'text-gray-700'}`}>
                      Real Physical Losses
                    </span>
                    <div className={`mt-2 text-xl font-extrabold ${isSimulating ? 'text-red-700' : 'text-gray-900'}`}>
                      {nrwMetric.waterBalance.realLossesM3.toLocaleString()} <span className="text-xs font-semibold text-gray-500">m³</span>
                    </div>
                    <div className={`text-xs mt-1 font-semibold ${isSimulating ? 'text-red-600' : 'text-gray-600'}`}>
                      {((nrwMetric.waterBalance.realLossesM3 / (nrwMetric.waterBalance.systemInputVolumeM3 || 1)) * 100).toFixed(1)}% of total SIV
                    </div>
                    <div className="mt-2 pt-2 border-t border-gray-200/60 text-[11px] text-gray-500">
                      Active pipe ruptures & joint leakage
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* DMA Municipal Sectors Comparison Matrix */}
            <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-xs">
              <div className="flex items-center justify-between mb-4 border-b border-gray-100 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-gray-900">
                    Municipal District Metered Areas (DMA) Benchmarking
                  </h3>
                  <p className="text-xs text-gray-500">
                    Comparative tracking of Minimum Night Flow (MNF), Pressure Head, and Infrastructure Leakage Index (ILI)
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-gray-50 text-gray-600 font-semibold border-b border-gray-200">
                      <th className="py-2.5 px-3">DMA Sector</th>
                      <th className="py-2.5 px-3">Mains (km)</th>
                      <th className="py-2.5 px-3">Connections</th>
                      <th className="py-2.5 px-3">Inflow (L/s)</th>
                      <th className="py-2.5 px-3">Min. Night Flow</th>
                      <th className="py-2.5 px-3">Avg Pressure</th>
                      <th className="py-2.5 px-3">NRW Ratio</th>
                      <th className="py-2.5 px-3">ILI Index</th>
                      <th className="py-2.5 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {dmaList.map((dma) => (
                      <tr
                        key={dma.id}
                        className={dma.status === 'Critical' ? 'bg-red-50/70 font-semibold' : 'hover:bg-gray-50'}
                      >
                        <td className="py-2.5 px-3 font-medium text-gray-900">
                          {dma.name} <span className="text-[10px] text-gray-400">({dma.id})</span>
                        </td>
                        <td className="py-2.5 px-3 font-mono">{dma.pipeLengthKm}</td>
                        <td className="py-2.5 px-3 font-mono">{dma.connections.toLocaleString()}</td>
                        <td className="py-2.5 px-3 font-mono">{dma.currentInflowLps} L/s</td>
                        <td className="py-2.5 px-3 font-mono">{dma.minimumNightFlowLps} L/s</td>
                        <td className="py-2.5 px-3 font-mono">{dma.pressureAvgPsi} psi</td>
                        <td className="py-2.5 px-3 font-mono font-bold">
                          <span className={dma.nrwPercentage > 25 ? 'text-red-600' : 'text-gray-800'}>
                            {dma.nrwPercentage}%
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono">
                          <span className={dma.iliScore > 4 ? 'text-red-700 font-bold' : 'text-gray-700'}>
                            {dma.iliScore}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          {dma.status === 'Critical' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black bg-red-100 text-red-800 border border-red-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse"></span>
                              CRITICAL OUTLIER
                            </span>
                          ) : dma.status === 'Warning' ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-800 border border-amber-200">
                              Warning
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Optimal
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: Sensor Placement & Genetic Optimizer Dashboard */}
        {activeTab === 'sensor_placement' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
                <div>
                  <h2 className="text-base font-bold text-gray-900">
                    Genetic Algorithm Sensor Placement Optimizer
                  </h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Maximizing hydraulic fault observability under restricted municipal capital expenditure budgets
                  </p>
                </div>
                <div className="flex items-center gap-4 bg-gray-50 p-2.5 rounded-lg border border-gray-200">
                  <div className="text-xs font-semibold text-gray-700">Sensor Budget (k):</div>
                  <input
                    type="range"
                    min={3}
                    max={12}
                    value={sensorBudgetK}
                    onChange={(e) => setSensorBudgetK(Number(e.target.value))}
                    className="w-28 accent-blue-600 cursor-pointer"
                  />
                  <span className="text-xs font-mono font-bold bg-white px-2 py-0.5 rounded border border-gray-300">
                    {sensorBudgetK} loggers
                  </span>
                  <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    {Math.min(99.6, Math.round((0.55 + (sensorBudgetK / 12) * 0.44) * 1000) / 10)}% Observability
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5">
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <span className="text-xs font-semibold text-gray-500 uppercase">Naive / Uniform Placement</span>
                  <div className="mt-2 text-xl font-bold text-gray-700">58.2% Coverage</div>
                  <p className="text-xs text-gray-500 mt-1">Requires 18 sensor loggers to cover main junction loops, blind to low-pressure branches.</p>
                </div>

                <div className="bg-blue-50/70 p-4 rounded-lg border border-blue-200">
                  <span className="text-xs font-semibold text-blue-700 uppercase">EPANET Entropy Optimizer</span>
                  <div className="mt-2 text-xl font-bold text-blue-900">98.4% Coverage</div>
                  <p className="text-xs text-blue-700 mt-1">Only 6 loggers needed. Genetic algorithm placed sensors at maximal Jacobian pressure sensitivity nodes.</p>
                </div>

                <div className="bg-emerald-50/70 p-4 rounded-lg border border-emerald-200">
                  <span className="text-xs font-semibold text-emerald-700 uppercase">Capital Savings</span>
                  <div className="mt-2 text-xl font-bold text-emerald-900">$48,200 Saved</div>
                  <p className="text-xs text-emerald-700 mt-1">Reduced sensor procurement and annual calibration truck rolls by 66.7%.</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-xs">
              <div className="flex items-center justify-between mb-4 border-b border-gray-100 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-gray-900">
                    Deployed Sensor Instrumentation Inventory (DMA-04)
                  </h3>
                  <p className="text-xs text-gray-500">
                    Real-time battery life, LoRaWAN / NB-IoT signal power, and sampling frequencies
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-gray-50 text-gray-600 font-semibold border-b border-gray-200">
                      <th className="py-2.5 px-3">Device Tag</th>
                      <th className="py-2.5 px-3">Junction Location</th>
                      <th className="py-2.5 px-3">Instrumentation Type</th>
                      <th className="py-2.5 px-3">Hardware Model</th>
                      <th className="py-2.5 px-3">Battery</th>
                      <th className="py-2.5 px-3">RSSI Signal</th>
                      <th className="py-2.5 px-3">Sampling Freq</th>
                      <th className="py-2.5 px-3">Sensitivity</th>
                      <th className="py-2.5 px-3">Device State</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-mono">
                    {SENSOR_INVENTORY.map((sensor) => (
                      <tr key={sensor.id} className="hover:bg-gray-50">
                        <td className="py-2.5 px-3 font-bold text-blue-700">{sensor.id}</td>
                        <td className="py-2.5 px-3 font-sans font-medium text-gray-800">{sensor.nodeLocation}</td>
                        <td className="py-2.5 px-3 font-sans text-gray-600">{sensor.type}</td>
                        <td className="py-2.5 px-3 font-sans text-gray-500">{sensor.model}</td>
                        <td className="py-2.5 px-3">
                          <span className="flex items-center gap-1.5 font-bold text-emerald-700">
                            <Battery className="w-4 h-4 text-emerald-600" />
                            {sensor.batteryPct}%
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="flex items-center gap-1.5 text-gray-700">
                            <Wifi className="w-3.5 h-3.5 text-blue-500" />
                            {sensor.signalDbm} dBm
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-gray-600">{sensor.samplingRateHz} Hz</td>
                        <td className="py-2.5 px-3 font-bold text-indigo-700">{sensor.hydraulicSensitivityScore}%</td>
                        <td className="py-2.5 px-3 font-sans">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            Online
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: Work Orders & Valve Isolation Dispatch Dashboard */}
        {activeTab === 'work_orders' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4">
                <div>
                  <h2 className="text-base font-bold text-gray-900">
                    Municipal Repair Crew Dispatch & Valve Isolation Management
                  </h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Prioritizing repair actions to eliminate Non-Revenue Water and prevent infrastructure damage
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={handleSyncWorkOrdersToSupabase}
                    disabled={isSyncingSupabase}
                    className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-md font-semibold text-xs flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors"
                    title="Sync current work orders to Supabase PostgreSQL table"
                  >
                    <Database className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Sync to Supabase ({workOrdersList.length})</span>
                  </button>
                  {isSimulating && (
                    <span className="px-3 py-1 bg-red-100 text-red-800 text-xs font-bold rounded-full border border-red-200 flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-red-600 animate-pulse" />
                      1 Emergency Work Order Awaiting Dispatch
                    </span>
                  )}
                </div>
              </div>

              <div className="overflow-x-auto mt-4">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-gray-50 text-gray-600 font-semibold border-b border-gray-200">
                      <th className="py-2.5 px-3">Order ID</th>
                      <th className="py-2.5 px-3">Sector & Location</th>
                      <th className="py-2.5 px-3">Priority Tier</th>
                      <th className="py-2.5 px-3">Assigned Crew</th>
                      <th className="py-2.5 px-3">Pipe Specification</th>
                      <th className="py-2.5 px-3">Isolation Valves</th>
                      <th className="py-2.5 px-3">Affected Meters</th>
                      <th className="py-2.5 px-3">Est. Duration</th>
                      <th className="py-2.5 px-3">Dispatch Status</th>
                      <th className="py-2.5 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {workOrdersList.map((wo) => {
                      const isEmergency = wo.id === 'WO-8842';
                      return (
                        <tr
                          key={wo.id}
                          className={isEmergency ? 'bg-red-50/70 font-semibold' : 'hover:bg-gray-50'}
                        >
                          <td className="py-2.5 px-3 font-mono font-bold text-gray-900">{wo.id}</td>
                          <td className="py-2.5 px-3">
                            <div className="font-semibold text-gray-900">{wo.sector}</div>
                            <div className="text-[11px] text-gray-500">{wo.address}</div>
                            {wo.hasSensitiveFacilities && (
                              <span className="inline-block mt-0.5 text-[10px] font-bold text-red-700 bg-red-100 px-1.5 py-0.2 rounded">
                                Adjacent: City Central Hospital
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                              wo.priority.includes('Critical')
                                ? 'bg-red-600 text-white'
                                : wo.priority.includes('High')
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-gray-100 text-gray-700'
                            }`}>
                              {wo.priority}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-gray-700">{wo.assignedCrew}</td>
                          <td className="py-2.5 px-3 text-gray-600 font-mono text-[11px]">{wo.pipeDiameter} • {wo.pipeMaterial}</td>
                          <td className="py-2.5 px-3 font-mono font-semibold text-blue-700">{wo.isolationValves.join(', ')}</td>
                          <td className="py-2.5 px-3 font-mono">{wo.affectedCustomers}</td>
                          <td className="py-2.5 px-3 font-mono">{wo.estimatedRepairHrs} hrs</td>
                          <td className="py-2.5 px-3">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                              wo.status === 'Pending Dispatch'
                                ? 'bg-red-100 text-red-800 animate-pulse'
                                : wo.status === 'En Route'
                                ? 'bg-blue-100 text-blue-800'
                                : wo.status === 'Excavating'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}>
                              {wo.status}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            {isEmergency && !isDispatched && (
                              <button
                                onClick={handleDispatchAction}
                                className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-[11px] font-bold cursor-pointer transition-colors"
                              >
                                Dispatch
                              </button>
                            )}
                            {isEmergency && isDispatched && (
                              <button
                                onClick={() => setShowDispatchModal(true)}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-semibold cursor-pointer transition-colors"
                              >
                                View Order
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Notification / SMS Receiving Options Modal */}
      {showSmsModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-gray-200 shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-200">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">
                    Emergency SMS Alerts & Dispatch Center
                  </h3>
                  <p className="text-xs text-gray-500">
                    Real-time field notifications and on-call engineer receiving settings
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowSmsModal(false)}
                className="p-1 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Navigation Tabs */}
            <div className="px-6 border-b border-gray-200 flex gap-4 bg-white text-xs font-semibold">
              <button
                onClick={() => setSmsModalTab('phone_preview')}
                className={`py-3 border-b-2 flex items-center gap-1.5 cursor-pointer ${
                  smsModalTab === 'phone_preview'
                    ? 'border-emerald-600 text-emerald-700'
                    : 'border-transparent text-gray-500 hover:text-gray-800'
                }`}
              >
                <Smartphone className="w-4 h-4" />
                <span>Live SMS Thread ({smsMessages.length})</span>
              </button>
              <button
                onClick={() => setSmsModalTab('recipient_settings')}
                className={`py-3 border-b-2 flex items-center gap-1.5 cursor-pointer ${
                  smsModalTab === 'recipient_settings'
                    ? 'border-emerald-600 text-emerald-700'
                    : 'border-transparent text-gray-500 hover:text-gray-800'
                }`}
              >
                <Settings className="w-4 h-4" />
                <span>Receiving Phone & Gateway Settings</span>
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-auto p-6 bg-slate-50/50">
              {smsModalTab === 'phone_preview' ? (
                <div className="space-y-4">
                  {/* Smartphone View Mockup */}
                  <div className="max-w-md mx-auto bg-slate-900 text-white rounded-3xl p-4 shadow-xl border-4 border-slate-700">
                    {/* Phone Top Notch */}
                    <div className="flex justify-between items-center text-[10px] text-gray-400 px-3 pb-2 border-b border-slate-800 mb-3">
                      <span>9:41 AM</span>
                      <div className="w-16 h-3 bg-slate-800 rounded-full"></div>
                      <div className="flex items-center gap-1">
                        <Wifi className="w-2.5 h-2.5" />
                        <Battery className="w-3 h-3 text-emerald-400" />
                      </div>
                    </div>

                    {/* Sender Header */}
                    <div className="text-center pb-2 border-b border-slate-800 mb-3">
                      <div className="w-9 h-9 rounded-full bg-blue-600 mx-auto flex items-center justify-center font-bold text-xs text-white">
                        LN
                      </div>
                      <div className="text-xs font-bold text-white mt-1">LeakNova SCADA Core</div>
                      <div className="text-[10px] text-gray-400">EPANET Gateway • PID: cqvdsywibtbdonsuuwpc</div>
                    </div>

                    {/* Message Thread */}
                    <div className="space-y-2.5 max-h-72 overflow-y-auto px-1 text-xs">
                      {smsMessages.map((msg) => {
                        const isOutbound = msg.direction === 'OUTBOUND_ALERT';
                        return (
                          <div
                            key={msg.id}
                            className={`flex flex-col ${isOutbound ? 'items-start' : 'items-end'}`}
                          >
                            <div className="text-[9px] text-gray-400 px-1 mb-0.5">
                              {msg.recipientName} • {msg.timestamp}
                            </div>
                            <div
                              className={`p-2.5 rounded-2xl max-w-[88%] text-[11px] leading-relaxed shadow-sm ${
                                isOutbound
                                  ? 'bg-slate-800 text-slate-100 border border-slate-700 rounded-tl-xs'
                                  : 'bg-emerald-600 text-white rounded-tr-xs'
                              }`}
                            >
                              {msg.messageText}
                            </div>
                            <span className="text-[8px] text-gray-500 mt-0.5 px-1">
                              {msg.status}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Quick SMS Input */}
                    <form onSubmit={handleSendManualReply} className="mt-3 pt-2 border-t border-slate-800 flex gap-2">
                      <input
                        type="text"
                        placeholder="Reply via SMS (e.g. ACK, En route)..."
                        value={manualSmsText}
                        onChange={(e) => setManualSmsText(e.target.value)}
                        className="flex-1 bg-slate-800 border border-slate-700 rounded-full px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-hidden focus:border-emerald-500"
                      />
                      <button
                        type="submit"
                        className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full cursor-pointer transition-colors"
                      >
                        <Send className="w-3.5 h-3.5" />
                      </button>
                    </form>
                  </div>

                  <div className="text-center text-xs text-gray-500">
                    Live SMS relay configured for on-call engineer: <strong className="text-gray-800">{smsConfig.phoneNumber}</strong>
                  </div>
                </div>
              ) : (
                /* Recipient & Gateway Settings Form */
                <form onSubmit={handleSaveSmsSettings} className="space-y-5 bg-white p-5 rounded-lg border border-gray-200 shadow-2xs">
                  <div>
                    <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-1">
                      On-Call Engineer Contact Details
                    </h4>
                    <p className="text-xs text-gray-500 mb-4">
                      Enter the phone number that will receive emergency SMS rupture dispatches.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          Receiving Mobile Phone Number:
                        </label>
                        <input
                          type="text"
                          value={smsPhoneInput}
                          onChange={(e) => setSmsPhoneInput(e.target.value)}
                          placeholder="+1 (555) 349-2810"
                          className="w-full px-3 py-2 text-xs border border-gray-300 rounded-md font-mono focus:border-blue-500 focus:outline-hidden"
                          required
                        />
                        {!isValidPhoneNumber(smsPhoneInput) && (
                          <p className="text-[10px] text-red-600 mt-1">Please enter a valid phone number (10-15 digits).</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          Duty Engineer Name:
                        </label>
                        <input
                          type="text"
                          value={smsNameInput}
                          onChange={(e) => setSmsNameInput(e.target.value)}
                          placeholder="Marcus Vance, P.E."
                          className="w-full px-3 py-2 text-xs border border-gray-300 rounded-md focus:border-blue-500 focus:outline-hidden"
                          required
                        />
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-gray-100">
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Emergency SMS Carrier Gateway:
                    </label>
                    <select
                      value={smsGatewayInput}
                      onChange={(e) => setSmsGatewayInput(e.target.value as any)}
                      className="w-full px-3 py-2 text-xs border border-gray-300 rounded-md bg-white focus:border-blue-500 focus:outline-hidden"
                    >
                      <option value="Twilio Cloud SMS">Twilio Cloud SMS (Municipal Dedicated Shortcode)</option>
                      <option value="AWS SNS Emergency Relay">AWS SNS Emergency Relay (High Priority Telephony)</option>
                      <option value="FirstNet Public Safety">FirstNet Public Safety Dedicated LTE Network</option>
                    </select>
                  </div>

                  {/* Trigger Toggles */}
                  <div className="pt-3 border-t border-gray-100 space-y-3">
                    <span className="block text-xs font-semibold text-gray-700">Automated Notification Triggers:</span>
                    
                    <label className="flex items-center gap-2.5 text-xs text-gray-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={smsConfig.sendOnCriticalBurst}
                        onChange={(e) => setSmsConfig(prev => ({ ...prev, sendOnCriticalBurst: e.target.checked }))}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span>Dispatch instant SMS on Critical Pipe Rupture (&gt;50 L/s flow step)</span>
                    </label>

                    <label className="flex items-center gap-2.5 text-xs text-gray-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={smsConfig.sendValveIsolationProtocol}
                        onChange={(e) => setSmsConfig(prev => ({ ...prev, sendValveIsolationProtocol: e.target.checked }))}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span>Include valve isolation key tags (e.g. V-108A & V-108B) in message body</span>
                    </label>

                    <label className="flex items-center gap-2.5 text-xs text-gray-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={smsConfig.sendDailyNrwDigest}
                        onChange={(e) => setSmsConfig(prev => ({ ...prev, sendDailyNrwDigest: e.target.checked }))}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span>Send daily AWWA Non-Revenue Water percentage summary at 08:00</span>
                    </label>
                  </div>

                  <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={handleSendTestSms}
                      className="px-3.5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                      Send Test SMS
                    </button>

                    <button
                      type="submit"
                      disabled={!isValidPhoneNumber(smsPhoneInput)}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-md text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Save Phone Settings
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 flex justify-between items-center text-xs text-gray-500">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                Encrypted E.164 Telephony Protocol
              </span>
              <button
                onClick={() => setShowSmsModal(false)}
                className="px-4 py-1.5 bg-gray-800 hover:bg-gray-900 text-white rounded-md text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Telemetry Data Drawer / Ingestion Modal */}
      {showDataDrawer && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-gray-200 shadow-2xl max-w-4xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-gray-900">
                    LeakNova Telemetry Dataset & Real SCADA Ingestion
                  </h3>
                  <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-800">PID: cqvdsywibtbdonsuuwpc</span>
                </div>
                <div className="text-xs text-gray-500 flex flex-wrap items-center gap-2 mt-0.5">
                  <span>Calibrated EPANET Net3 baseline or custom municipal flow logger upload</span>
                  <span>•</span>
                  <a
                    href="https://aquasense-smart-city-monitor.ai.studio"
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-600 hover:underline flex items-center gap-0.5 font-mono text-[11px]"
                  >
                    aquasense-smart-city-monitor.ai.studio
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
              <button
                onClick={() => setShowDataDrawer(false)}
                className="p-1 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 border-b border-gray-200 bg-white flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <label className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-semibold flex items-center gap-2 cursor-pointer shadow-xs transition-colors">
                  <FileUp className="w-4 h-4" />
                  <span>Upload SCADA CSV</span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>

                {customDataset && (
                  <button
                    onClick={handleResetToBenchmark}
                    className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Reset to Benchmark
                  </button>
                )}
              </div>

              <button
                onClick={handleExportCsv}
                className="px-3.5 py-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs transition-colors"
              >
                <ArrowDownToLine className="w-4 h-4 text-gray-500" />
                Download Current CSV
              </button>
            </div>

            {csvUploadFeedback && (
              <div className="px-6 py-2 bg-blue-50 text-blue-800 text-xs font-medium border-b border-blue-100 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                <span>{csvUploadFeedback}</span>
              </div>
            )}

            <div className="flex-1 overflow-auto p-4">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-100 text-gray-600 font-semibold border-b border-gray-200">
                    <th className="py-2.5 px-3">Timestamp</th>
                    <th className="py-2.5 px-3">Actual Flow (L/s)</th>
                    <th className="py-2.5 px-3">Expected Demand (L/s)</th>
                    <th className="py-2.5 px-3">Pressure (psi)</th>
                    <th className="py-2.5 px-3">Anomaly (L/s)</th>
                    <th className="py-2.5 px-3">Z-Score</th>
                    <th className="py-2.5 px-3">Statistical Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-mono">
                  {flowData.map((row) => {
                    const isRowAnomaly = (row.leakAnomaly || 0) > 0;
                    return (
                      <tr
                        key={row.time}
                        className={isRowAnomaly ? 'bg-red-50/60 font-semibold text-red-900' : 'hover:bg-gray-50'}
                      >
                        <td className="py-2 px-3 font-sans font-medium">{row.time}</td>
                        <td className="py-2 px-3">{row.actualFlow.toFixed(1)}</td>
                        <td className="py-2 px-3 text-gray-500">{row.expectedDemand.toFixed(1)}</td>
                        <td className="py-2 px-3">{row.pressurePsi.toFixed(1)}</td>
                        <td className="py-2 px-3">
                          {isRowAnomaly ? (
                            <span className="text-red-600">+{row.leakAnomaly?.toFixed(1)}</span>
                          ) : (
                            <span className="text-gray-400">0.0</span>
                          )}
                        </td>
                        <td className="py-2 px-3">
                          {row.zScore !== undefined ? (
                            <span className={row.zScore > 2.0 ? 'text-red-600 font-bold' : 'text-gray-500'}>
                              {row.zScore > 0 ? `+${row.zScore.toFixed(2)}` : row.zScore.toFixed(2)}σ
                            </span>
                          ) : (
                            '--'
                          )}
                        </td>
                        <td className="py-2 px-3 font-sans">
                          {isRowAnomaly ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800">
                              RUPTURE OUTLIER
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700">
                              Nominal Demand
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => setShowDataDrawer(false)}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-900 text-white rounded-md text-xs font-semibold cursor-pointer"
              >
                Close Table
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dispatch Modal confirmation for interactive hackathon demo */}
      {showDispatchModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-gray-200 shadow-xl max-w-md w-full p-6 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center gap-3 text-emerald-600 mb-4">
              <div className="p-2 bg-emerald-50 rounded-full border border-emerald-200">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-base font-bold text-gray-900">Work Order Generated #WO-8842</h4>
                <p className="text-xs text-gray-500">Municipal Repair Crew Dispatched & SMS Logged</p>
              </div>
            </div>

            <div className="bg-gray-50 rounded-md p-3.5 border border-gray-200 text-xs space-y-2 mb-4">
              <div className="flex justify-between">
                <span className="text-gray-500">Assigned Unit:</span>
                <span className="font-semibold text-gray-900">Rapid Response Unit #4 (Hydraulics)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Target Junction:</span>
                <span className="font-semibold text-gray-900">Node J-108 (Oak & 5th Ave)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Estimated Size:</span>
                <span className="font-bold text-red-600">85 L/s (~306 m³/h)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Calculated Fracture:</span>
                <span className="font-semibold text-gray-900">Ø {alertDetails?.equivalentDiameterMm} mm ({alertDetails?.orificeAreaMm2} mm²)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Isolation Plan:</span>
                <span className="font-semibold text-gray-900">Valves V-108A & V-108B</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Field Lead SMS:</span>
                <span className="font-semibold text-emerald-700 font-mono">+1 (555) 792-4419 (ACK Received)</span>
              </div>
            </div>

            <p className="text-xs text-gray-600 mb-4">
              Repair team has received GPS coordinates and telemetry logs. Valve isolation protocol confirmed via field SMS.
            </p>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowDispatchModal(false)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-semibold cursor-pointer"
              >
                Return to Dashboard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Supabase Cloud Hub Modal */}
      {showSupabaseModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-gray-200 shadow-2xl max-w-3xl w-full flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg border border-emerald-500/30">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-white">Supabase Cloud Database</h3>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-950 text-emerald-300 border border-emerald-700">
                      atgbqxmergxaaazrhbpr
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-gray-300">
                      ap-northeast-1
                    </span>
                  </div>
                  <p className="text-xs text-gray-300 mt-0.5">
                    Project: <span className="text-white font-medium">{SUPABASE_CONFIG.projectName}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowSupabaseModal(false)}
                className="text-gray-400 hover:text-white p-1 rounded-md cursor-pointer transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="flex border-b border-gray-200 bg-gray-50 px-6 text-xs font-semibold gap-6">
              <button
                onClick={() => setSupabaseTab('status')}
                className={`py-3 border-b-2 flex items-center gap-1.5 cursor-pointer transition-colors ${
                  supabaseTab === 'status'
                    ? 'border-emerald-600 text-emerald-700'
                    : 'border-transparent text-gray-500 hover:text-gray-800'
                }`}
              >
                <Activity className="w-4 h-4" />
                <span>Live Connection & Sync</span>
              </button>
              <button
                onClick={() => setSupabaseTab('sql_schema')}
                className={`py-3 border-b-2 flex items-center gap-1.5 cursor-pointer transition-colors ${
                  supabaseTab === 'sql_schema'
                    ? 'border-emerald-600 text-emerald-700'
                    : 'border-transparent text-gray-500 hover:text-gray-800'
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>PostgreSQL Schema (SQL Editor)</span>
              </button>
              <button
                onClick={() => setSupabaseTab('sync_data')}
                className={`py-3 border-b-2 flex items-center gap-1.5 cursor-pointer transition-colors ${
                  supabaseTab === 'sync_data'
                    ? 'border-emerald-600 text-emerald-700'
                    : 'border-transparent text-gray-500 hover:text-gray-800'
                }`}
              >
                <Settings className="w-4 h-4" />
                <span>Credentials & REST API</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-auto p-6 bg-slate-50/50 space-y-5">
              {supabaseTab === 'status' && (
                <div className="space-y-5">
                  {/* Connection Card */}
                  <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-full mt-0.5 ${
                        supabaseStatus?.connected
                          ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                          : 'bg-amber-50 text-amber-600 border border-amber-200'
                      }`}>
                        <Cloud className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-gray-900">Supabase Cloud REST Endpoint</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            supabaseStatus?.connected
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}>
                            {supabaseStatus?.connected ? 'ONLINE & RESPONSIVE' : 'CHECKING...'}
                          </span>
                        </div>
                        <div className="text-xs font-mono text-gray-600 mt-1 break-all">
                          {SUPABASE_CONFIG.url}/rest/v1/
                        </div>
                        <div className="text-[11px] text-gray-400 mt-1 flex items-center gap-2">
                          <span>Region: {SUPABASE_CONFIG.region}</span>
                          <span>•</span>
                          <span>Ping Latency: <strong className="text-gray-700">{supabaseStatus?.latencyMs ?? 85} ms</strong></span>
                          <span>•</span>
                          <span>Last Checked: {supabaseStatus?.timestamp ?? 'Just now'}</span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={handleTestSupabase}
                      disabled={isTestingSupabase}
                      className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-md text-xs font-semibold shrink-0 cursor-pointer flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                    >
                      {isTestingSupabase ? (
                        <>
                          <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                          <span>Testing...</span>
                        </>
                      ) : (
                        <>
                          <Zap className="w-3.5 h-3.5 text-amber-400" />
                          <span>Ping REST API</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Quick Push Operations Grid */}
                  <div>
                    <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                      Live Push Actions (Client to Supabase)
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {/* Card 1: Leak Incidents */}
                      <div className="bg-white p-3.5 rounded-lg border border-gray-200 shadow-2xs flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between text-xs font-bold text-gray-800 mb-1">
                            <span className="flex items-center gap-1.5 text-red-600">
                              <ShieldAlert className="w-4 h-4" />
                              Leak Incidents
                            </span>
                            <span className="text-[10px] font-mono text-gray-500">public.leak_incidents</span>
                          </div>
                          <p className="text-[11px] text-gray-500 mb-3">
                            {isSimulating
                              ? `Rupture active at Node J-108 (${alertDetails?.estimatedLeakSizeLps} L/s)`
                              : 'Nominal monitoring state (no active rupture)'}
                          </p>
                        </div>
                        <button
                          onClick={handleSyncLeakToSupabase}
                          disabled={isSyncingSupabase || !isSimulating}
                          className="w-full py-1.5 px-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <Send className="w-3 h-3" />
                          <span>Push Leak Event</span>
                        </button>
                      </div>

                      {/* Card 2: Work Orders */}
                      <div className="bg-white p-3.5 rounded-lg border border-gray-200 shadow-2xs flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between text-xs font-bold text-gray-800 mb-1">
                            <span className="flex items-center gap-1.5 text-blue-600">
                              <Wrench className="w-4 h-4" />
                              Work Orders
                            </span>
                            <span className="text-[10px] font-mono text-gray-500">public.work_orders</span>
                          </div>
                          <p className="text-[11px] text-gray-500 mb-3">
                            {workOrdersList.length} municipal repair tickets & isolation valve records
                          </p>
                        </div>
                        <button
                          onClick={handleSyncWorkOrdersToSupabase}
                          disabled={isSyncingSupabase}
                          className="w-full py-1.5 px-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors disabled:opacity-50"
                        >
                          <Send className="w-3 h-3" />
                          <span>Push Work Orders</span>
                        </button>
                      </div>

                      {/* Card 3: SMS Dispatches */}
                      <div className="bg-white p-3.5 rounded-lg border border-gray-200 shadow-2xs flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between text-xs font-bold text-gray-800 mb-1">
                            <span className="flex items-center gap-1.5 text-emerald-600">
                              <Smartphone className="w-4 h-4" />
                              SMS Dispatches
                            </span>
                            <span className="text-[10px] font-mono text-gray-500">public.sms_dispatches</span>
                          </div>
                          <p className="text-[11px] text-gray-500 mb-3">
                            {smsMessages.length} outbound alerts and field crew ACK replies
                          </p>
                        </div>
                        <button
                          onClick={handleSyncSmsToSupabase}
                          disabled={isSyncingSupabase}
                          className="w-full py-1.5 px-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors disabled:opacity-50"
                        >
                          <Send className="w-3 h-3" />
                          <span>Push SMS Logs</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Sync Activity Feed */}
                  <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-2xs">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-bold text-gray-800">
                        Supabase Synchronization Activity Feed
                      </h4>
                      <span className="text-[11px] text-gray-400 font-mono">
                        {supabaseSyncLogs.length} transactions
                      </span>
                    </div>
                    <div className="space-y-2 max-h-48 overflow-y-auto font-mono text-xs">
                      {supabaseSyncLogs.map((log, idx) => (
                        <div
                          key={idx}
                          className={`p-2.5 rounded border text-[11px] flex items-start justify-between gap-3 ${
                            log.success
                              ? 'bg-emerald-50/60 border-emerald-200 text-emerald-900'
                              : 'bg-amber-50/70 border-amber-200 text-amber-900'
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            {log.success ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                            ) : (
                              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                            )}
                            <div>
                              <div className="font-semibold">{log.message}</div>
                              <div className="text-[10px] text-gray-500 mt-0.5">
                                Target: {log.table} • Records: {log.count}
                              </div>
                            </div>
                          </div>
                          <span className="text-[10px] text-gray-400 shrink-0">{log.timestamp}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {supabaseTab === 'sql_schema' && (
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg text-xs text-blue-900 flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="font-bold flex items-center gap-1.5 text-blue-950">
                        <Info className="w-4 h-4 text-blue-600" />
                        Quick Setup: Run this script in your Supabase SQL Editor
                      </div>
                      <p className="text-blue-800 leading-relaxed">
                        To enable persistent storage, copy the script below and paste it into your Supabase Dashboard:
                        <strong> SQL Editor &rarr; + New Query &rarr; Run</strong>. This creates the tables for leaks, work orders, SMS dispatches, and telemetry with Row Level Security.
                      </p>
                    </div>
                    <a
                      href={`https://supabase.com/dashboard/project/${SUPABASE_CONFIG.projectId}/sql`}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold shrink-0 flex items-center gap-1.5 transition-colors"
                    >
                      <span>Open SQL Editor</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>

                  <div className="relative">
                    <div className="flex items-center justify-between bg-slate-900 text-slate-300 px-4 py-2 rounded-t-lg text-xs font-mono border-b border-slate-800">
                      <span>supabase_schema.sql</span>
                      <button
                        onClick={handleCopySql}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-colors"
                      >
                        {copiedSql ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="text-emerald-400 font-semibold">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy SQL Script</span>
                          </>
                        )}
                      </button>
                    </div>
                    <pre className="bg-slate-950 text-slate-100 p-4 rounded-b-lg font-mono text-[11px] leading-relaxed max-h-80 overflow-y-auto whitespace-pre-wrap selection:bg-blue-600">
                      {SUPABASE_SQL_SCHEMA}
                    </pre>
                  </div>
                </div>
              )}

              {supabaseTab === 'sync_data' && (
                <div className="space-y-4">
                  <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-2xs space-y-4 text-xs">
                    <h4 className="font-bold text-gray-900 text-sm border-b border-gray-100 pb-2">
                      Active Supabase Project Credentials
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-3 bg-gray-50 rounded border border-gray-200">
                        <span className="text-[11px] font-semibold text-gray-500 uppercase block">Project Name</span>
                        <span className="font-semibold text-gray-900 text-sm mt-0.5 block">{SUPABASE_CONFIG.projectName}</span>
                      </div>
                      <div className="p-3 bg-gray-50 rounded border border-gray-200">
                        <span className="text-[11px] font-semibold text-gray-500 uppercase block">Project ID</span>
                        <span className="font-mono font-bold text-blue-700 text-sm mt-0.5 block">{SUPABASE_CONFIG.projectId}</span>
                      </div>
                      <div className="p-3 bg-gray-50 rounded border border-gray-200">
                        <span className="text-[11px] font-semibold text-gray-500 uppercase block">Region</span>
                        <span className="font-mono font-bold text-gray-800 text-sm mt-0.5 block">{SUPABASE_CONFIG.region} (Tokyo)</span>
                      </div>
                      <div className="p-3 bg-gray-50 rounded border border-gray-200">
                        <span className="text-[11px] font-semibold text-gray-500 uppercase block">API REST URL</span>
                        <span className="font-mono text-gray-800 text-xs mt-0.5 block break-all">{SUPABASE_CONFIG.url}/rest/v1/</span>
                      </div>
                    </div>

                    <div className="p-3 bg-gray-50 rounded border border-gray-200">
                      <span className="text-[11px] font-semibold text-gray-500 uppercase block">Publishable Anon Key</span>
                      <span className="font-mono text-gray-700 text-xs mt-1 block break-all bg-white p-2 rounded border border-gray-200">
                        {SUPABASE_CONFIG.publishableKey}
                      </span>
                    </div>

                    <div className="pt-2 flex justify-between items-center text-gray-500 text-xs">
                      <span>Configured in <code className="font-mono text-blue-600">.env</code> and <code className="font-mono text-blue-600">src/lib/supabase.ts</code></span>
                      <a
                        href={`https://supabase.com/dashboard/project/${SUPABASE_CONFIG.projectId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 hover:underline flex items-center gap-1 font-semibold"
                      >
                        Open Supabase Project Dashboard
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
              <span className="text-xs text-gray-500 font-mono">
                Instance: {SUPABASE_CONFIG.projectId}.supabase.co
              </span>
              <button
                onClick={() => setShowSupabaseModal(false)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-md text-xs font-semibold cursor-pointer transition-colors"
              >
                Close Hub
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clean Enterprise Footer */}
      <footer className="bg-white border-t border-gray-200 px-6 py-4 mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between text-xs text-gray-500 gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-gray-800">LeakNova</span>
            <span>—</span>
            <span>EPANET 2.2 Numerical Engine & Emergency SMS Telephony Gateway</span>
            <span className="hidden sm:inline text-gray-300">|</span>
            <span className="hidden sm:inline font-mono text-[11px] text-gray-600">PID: cqvdsywibtbdonsuuwpc</span>
            <span className="hidden lg:inline font-mono text-[11px] text-gray-400">UUID: bd0f6dee-0647-4d81-9582-0929186cd9e4</span>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <button
              onClick={() => setShowSupabaseModal(true)}
              className="inline-flex items-center gap-1 font-mono text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 hover:bg-emerald-100 transition-colors cursor-pointer"
            >
              <Database className="w-3 h-3 text-emerald-600" />
              <span>Supabase: {SUPABASE_CONFIG.projectId}</span>
            </button>
            <a
              href="https://aquasense-smart-city-monitor.ai.studio"
              target="_blank"
              rel="noreferrer"
              className="text-blue-600 hover:underline flex items-center gap-1 font-mono text-[11px]"
            >
              aquasense-smart-city-monitor.ai.studio
              <ExternalLink className="w-3 h-3" />
            </a>
            <span className="text-gray-300">•</span>
            <span>SMS Dispatch: <strong className="text-emerald-700 font-mono">{smsConfig.phoneNumber}</strong></span>
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            <span>Status: Nominal SCADA Feed</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
