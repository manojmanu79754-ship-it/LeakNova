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
