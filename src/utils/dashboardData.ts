/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface DmaOverview {
  id: string;
  name: string;
  pipeLengthKm: number;
  connections: number;
  currentInflowLps: number;
  minimumNightFlowLps: number;
  nrwPercentage: number;
  pressureAvgPsi: number;
  iliScore: number;
  status: 'Nominal' | 'Warning' | 'Critical';
}

export interface SensorDevice {
  id: string;
  nodeLocation: string;
  type: 'Acoustic Transducer' | 'Transient Pressure Logger' | 'Electromagnetic Flow Meter' | 'Multi-parameter Water Quality';
  model: string;
  batteryPct: number;
  signalDbm: number; // RSSI dBm (-60 to -110)
  lastTelemetry: string;
  samplingRateHz: number;
  hydraulicSensitivityScore: number; // 0-100
  status: 'Online' | 'Alert' | 'Maintenance';
}

export interface WorkOrder {
  id: string;
  nodeId: string;
  sector: string;
  address: string;
  priority: 'Tier 1 - Critical' | 'Tier 2 - High' | 'Tier 3 - Medium';
  assignedCrew: string;
  pipeDiameter: string;
  pipeMaterial: string;
  isolationValves: string[];
  affectedCustomers: number;
  hasSensitiveFacilities: boolean; // hospital, schools
  estimatedRepairHrs: number;
  status: 'Pending Dispatch' | 'En Route' | 'Excavating' | 'Repaired' | 'Monitoring';
}

export const DMA_BENCHMARK_LIST: DmaOverview[] = [
  {
    id: 'DMA-01',
    name: 'Downtown Commercial Core',
    pipeLengthKm: 28.4,
    connections: 3200,
    currentInflowLps: 112.5,
    minimumNightFlowLps: 31.0,
    nrwPercentage: 14.1,
    pressureAvgPsi: 62.0,
    iliScore: 1.6,
    status: 'Nominal'
  },
  {
    id: 'DMA-02',
    name: 'North Hills Residential',
    pipeLengthKm: 34.2,
    connections: 4850,
    currentInflowLps: 84.0,
    minimumNightFlowLps: 19.5,
    nrwPercentage: 12.8,
    pressureAvgPsi: 58.5,
    iliScore: 1.4,
    status: 'Nominal'
  },
  {
    id: 'DMA-03',
    name: 'West Industrial Park',
    pipeLengthKm: 19.8,
    connections: 420,
    currentInflowLps: 145.2,
    minimumNightFlowLps: 64.0,
    nrwPercentage: 15.6,
    pressureAvgPsi: 70.2,
    iliScore: 1.9,
    status: 'Nominal'
  },
  {
    id: 'DMA-04',
    name: 'Eastern Sector (Monitored Area)',
    pipeLengthKm: 42.6,
    connections: 5600,
    currentInflowLps: 68.9, // will update on simulation
    minimumNightFlowLps: 18.5,
    nrwPercentage: 11.8,
    pressureAvgPsi: 64.7,
    iliScore: 1.2,
    status: 'Nominal'
  },
  {
    id: 'DMA-05',
    name: 'South Port & Logistics Hub',
    pipeLengthKm: 22.1,
    connections: 950,
    currentInflowLps: 98.0,
    minimumNightFlowLps: 42.0,
    nrwPercentage: 16.2,
    pressureAvgPsi: 66.4,
    iliScore: 2.1,
    status: 'Warning'
  }
];

export const SENSOR_INVENTORY: SensorDevice[] = [
  {
    id: 'S-01',
    nodeLocation: 'Node S-01 (Inflow Trunk)',
    type: 'Electromagnetic Flow Meter',
    model: 'KROHNE Waterflux 3070',
    batteryPct: 94,
    signalDbm: -72,
    lastTelemetry: '10 sec ago',
    samplingRateHz: 64,
    hydraulicSensitivityScore: 98,
    status: 'Online'
  },
  {
    id: 'S-02',
    nodeLocation: 'Node S-02 (North Branch)',
    type: 'Transient Pressure Logger',
    model: 'Syrinix Pipeminder-ONE',
    batteryPct: 88,
    signalDbm: -78,
    lastTelemetry: '15 sec ago',
    samplingRateHz: 128,
    hydraulicSensitivityScore: 86,
    status: 'Online'
  },
  {
    id: 'S-03',
    nodeLocation: 'Node S-03 (Mid-Span Arterial)',
    type: 'Acoustic Transducer',
    model: 'Gutermann Zonescan 820',
    batteryPct: 91,
    signalDbm: -68,
    lastTelemetry: '5 sec ago',
    samplingRateHz: 256,
    hydraulicSensitivityScore: 95,
    status: 'Online'
  },
  {
    id: 'S-04',
    nodeLocation: 'Node S-04 (Sector 4B Downstream)',
    type: 'Transient Pressure Logger',
    model: 'Syrinix Pipeminder-ONE',
    batteryPct: 82,
    signalDbm: -84,
    lastTelemetry: '8 sec ago',
    samplingRateHz: 128,
    hydraulicSensitivityScore: 92,
    status: 'Online'
  },
  {
    id: 'S-05',
    nodeLocation: 'Node S-05 (South Feeder)',
    type: 'Electromagnetic Flow Meter',
    model: 'Siemens SITRANS MAG 8000',
    batteryPct: 79,
    signalDbm: -81,
    lastTelemetry: '20 sec ago',
    samplingRateHz: 32,
    hydraulicSensitivityScore: 84,
    status: 'Online'
  },
  {
    id: 'S-06',
    nodeLocation: 'Node S-06 (Boundary DMZ)',
    type: 'Transient Pressure Logger',
    model: 'Metasphere Point Orange IoT',
    batteryPct: 95,
    signalDbm: -74,
    lastTelemetry: '12 sec ago',
    samplingRateHz: 64,
    hydraulicSensitivityScore: 89,
    status: 'Online'
  }
];

export const INITIAL_WORK_ORDERS: WorkOrder[] = [
  {
    id: 'WO-8839',
    nodeId: 'J-104',
    sector: 'DMA-01 Downtown',
    address: '142 Market St (Commercial District)',
    priority: 'Tier 3 - Medium',
    assignedCrew: 'Rapid Response Unit #2',
    pipeDiameter: '12" (300mm)',
    pipeMaterial: 'Cast Iron (Installed 1974)',
    isolationValves: ['V-104A', 'V-104C'],
    affectedCustomers: 45,
    hasSensitiveFacilities: false,
    estimatedRepairHrs: 3.5,
    status: 'Repaired'
  },
  {
    id: 'WO-8840',
    nodeId: 'J-112',
    sector: 'DMA-02 North Hills',
    address: '88 Crestview Rd',
    priority: 'Tier 2 - High',
    assignedCrew: 'Rapid Response Unit #1',
    pipeDiameter: '8" (200mm)',
    pipeMaterial: 'Ductile Iron (Installed 1998)',
    isolationValves: ['V-112B'],
    affectedCustomers: 120,
    hasSensitiveFacilities: false,
    estimatedRepairHrs: 2.2,
    status: 'Excavating'
  }
];

export function getSimulatedDmaList(isSimulating: boolean): DmaOverview[] {
  return DMA_BENCHMARK_LIST.map((dma) => {
    if (dma.id === 'DMA-04' && isSimulating) {
      return {
        ...dma,
        currentInflowLps: 153.9,
        nrwPercentage: 48.1,
        pressureAvgPsi: 46.3,
        iliScore: 6.4,
        status: 'Critical'
      };
    }
    return dma;
  });
}

export function getSimulatedWorkOrders(isSimulating: boolean, isDispatched: boolean): WorkOrder[] {
  if (!isSimulating) {
    return INITIAL_WORK_ORDERS;
  }

  const emergencyOrder: WorkOrder = {
    id: 'WO-8842',
    nodeId: 'J-108',
    sector: 'DMA-04 Eastern Sector',
    address: 'Oak St & 5th Ave (Sector 4B Arterial)',
    priority: 'Tier 1 - Critical',
    assignedCrew: 'Rapid Response Unit #4 (Hydraulics)',
    pipeDiameter: '16" (406.4mm)',
    pipeMaterial: 'Ductile Iron Class 52',
    isolationValves: ['V-108A', 'V-108B'],
    affectedCustomers: 280,
    hasSensitiveFacilities: true, // City Central Hospital adjacent
    estimatedRepairHrs: 1.8,
    status: isDispatched ? 'En Route' : 'Pending Dispatch'
  };

  return [emergencyOrder, ...INITIAL_WORK_ORDERS];
}

export interface IsometricHotspot {
  id: string;
  label: string;
  type: 'leak' | 'sensor' | 'valve' | 'pump' | 'junction' | 'reservoir';
  xPct: number;
  yPct: number;
  pressureNominal: number;
  pressureSim: number;
  flowLps: number;
  spec: string;
  description: string;
  subType?: string;
}

export const ISOMETRIC_HOTSPOTS: IsometricHotspot[] = [
  {
    id: 'J-108',
    label: 'Junction J-108 (Target Rupture)',
    type: 'leak',
    xPct: 58.2,
    yPct: 31.0,
    pressureNominal: 63.0,
    pressureSim: 44.6,
    flowLps: 85,
    spec: '16" Ductile Iron Flanged Arterial Tee',
    description: 'Critical physical fracture localized on Oak & 5th Ave arterial branch. Stress zone active.',
    subType: 'Manifold Tee Rupture'
  },
  {
    id: 'V-108A',
    label: 'Isolation Valve V-108A',
    type: 'valve',
    xPct: 52.8,
    yPct: 35.2,
    pressureNominal: 63.5,
    pressureSim: 48.0,
    flowLps: 85,
    spec: '16" Resilient Wedge Flanged Gate Valve',
    description: 'Upstream isolation point on Oak St. Disconnects main supply to rupture node.',
    subType: 'Upstream Isolation'
  },
  {
    id: 'V-108B',
    label: 'Isolation Valve V-108B',
    type: 'valve',
    xPct: 62.4,
    yPct: 39.4,
    pressureNominal: 62.8,
    pressureSim: 46.5,
    flowLps: 42,
    spec: '14" OS&Y Handwheel Flanged Gate Valve',
    description: 'Downstream isolation point on branch loop. Protects City Central Hospital bypass flow.',
    subType: 'Downstream Isolation'
  },
  {
    id: 'PS-01',
    label: 'Booster Pump Station PS-01',
    type: 'pump',
    xPct: 46.6,
    yPct: 76.5,
    pressureNominal: 64.7,
    pressureSim: 58.2,
    flowLps: 145,
    spec: 'Centrifugal Inline Booster • 35.5 kW • +38.5m Head',
    description: 'Dual-suction municipal pump maintaining distribution head across Sector 4B.',
    subType: 'Primary Booster'
  },
  {
    id: 'S-01',
    label: 'Sensor S-01 (Bulk Inflow)',
    type: 'sensor',
    xPct: 22.8,
    yPct: 62.0,
    pressureNominal: 65.0,
    pressureSim: 64.2,
    flowLps: 140,
    spec: 'Electromagnetic Flowmeter & Pressure Transducer',
    description: 'Bulk supply metering station. Reports baseline diurnal inflow into DMA-04.',
    subType: 'Inflow Logger'
  },
  {
    id: 'S-02',
    label: 'Sensor S-02 (Pump Discharge)',
    type: 'sensor',
    xPct: 54.0,
    yPct: 80.5,
    pressureNominal: 64.0,
    pressureSim: 62.5,
    flowLps: 98,
    spec: 'Acoustic Hydrophone & Dynamic Pressure Cell',
    description: 'Optimized sensor monitoring booster pump discharge gradients and cavitation.',
    subType: 'Discharge Logger'
  },
  {
    id: 'S-03',
    label: 'Sensor S-03 (Mid-Span Acoustic)',
    type: 'sensor',
    xPct: 51.5,
    yPct: 30.0,
    pressureNominal: 64.0,
    pressureSim: 55.0,
    flowLps: 92,
    spec: 'IoT Acoustic Correlator Transducer',
    description: 'Immediate upstream acoustic listening post. Captured high-frequency rupture soundings.',
    subType: 'Acoustic Transducer'
  },
  {
    id: 'S-04',
    label: 'Sensor S-04 (Sector 4B Downstream)',
    type: 'sensor',
    xPct: 64.8,
    yPct: 74.0,
    pressureNominal: 62.0,
    pressureSim: 46.0,
    flowLps: 42,
    spec: 'Downstream Transient Wave Recorder',
    description: 'Detects transient water hammer waves and downstream residual hydraulic head.',
    subType: 'Transient Recorder'
  },
  {
    id: 'S-05',
    label: 'Sensor S-05 (North Feeder Loop)',
    type: 'sensor',
    xPct: 49.0,
    yPct: 22.0,
    pressureNominal: 62.5,
    pressureSim: 61.0,
    flowLps: 40,
    spec: 'Ultra-low power IoT velocity logger',
    description: 'Residential feeder loop acoustic monitoring node.',
    subType: 'Feeder Logger'
  },
  {
    id: 'S-06',
    label: 'Sensor S-06 (Boundary DMZ)',
    type: 'sensor',
    xPct: 69.5,
    yPct: 39.0,
    pressureNominal: 61.0,
    pressureSim: 59.0,
    flowLps: 36,
    spec: 'District Boundary Multi-Parameter Cell',
    description: 'DMA boundary meter checking inter-district transfer balance.',
    subType: 'Boundary Logger'
  },
  {
    id: 'J-102',
    label: 'Header Cross J-102',
    type: 'junction',
    xPct: 30.5,
    yPct: 56.5,
    pressureNominal: 64.5,
    pressureSim: 63.8,
    flowLps: 135,
    spec: '20" x 16" Flanged 4-Way Cross Manifold',
    description: 'Arterial distribution node splitting bulk flow to north and south feeders.',
    subType: 'Main Cross Manifold'
  },
  {
    id: 'R-1',
    label: 'Bulk Feed Reservoir R-1 Flange',
    type: 'reservoir',
    xPct: 9.5,
    yPct: 35.5,
    pressureNominal: 65.5,
    pressureSim: 65.5,
    flowLps: 140,
    spec: '24" High-Pressure Ductile Iron Main Feed',
    description: 'Clearwell reservoir intake flange connection from municipal treatment works.',
    subType: 'Intake Flange'
  }
];

