/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface SmsRecipientConfig {
  phoneNumber: string;
  name: string;
  role: 'Chief Utility Engineer' | 'Field Operations Supervisor' | 'SCADA On-Call Officer';
  sendOnCriticalBurst: boolean;
  sendValveIsolationProtocol: boolean;
  sendDailyNrwDigest: boolean;
  smsGateway: 'Twilio Cloud SMS' | 'AWS SNS Emergency Relay' | 'FirstNet Public Safety';
}

export interface SmsMessage {
  id: string;
  timestamp: string;
  recipientPhone: string;
  recipientName: string;
  direction: 'OUTBOUND_ALERT' | 'INBOUND_REPLY';
  messageText: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  status: 'Delivered' | 'Received' | 'Queued';
}

export const DEFAULT_SMS_CONFIG: SmsRecipientConfig = {
  phoneNumber: '+1 (555) 349-2810',
  name: 'Marcus Vance, P.E.',
  role: 'Chief Utility Engineer',
  sendOnCriticalBurst: true,
  sendValveIsolationProtocol: true,
  sendDailyNrwDigest: false,
  smsGateway: 'Twilio Cloud SMS'
};

/**
 * Formats standard municipal emergency SMS dispatch payload.
 */
export function formatEmergencySms(
  nodeId: string,
  leakLps: number,
  location: string,
  isolationValves: string[],
  workOrderId: string
): string {
  return `🚨 [LeakNova Alert] CRITICAL MAIN RUPTURE localized at Node ${nodeId} (${location}). Flow Deficit: ${leakLps} L/s (~${Math.round(leakLps * 3.6)} m³/h). Priority: TIER-1. Emergency Protocol: Isolate valves ${isolationValves.join(' & ')}. Work Order #${workOrderId} generated. Portal: https://aquasense-smart-city-monitor.ai.studio. Reply ACK to confirm dispatch.`;
}

/**
 * Validates international E.164 or formatted domestic phone numbers.
 */
export function isValidPhoneNumber(phone: string): boolean {
  const cleaned = phone.replace(/[^\d+]/g, '');
  return cleaned.length >= 10 && cleaned.length <= 15;
}

/**
 * Generates automated field response reply message.
 */
export function generateCrewAcknowledgmentSms(crewName: string, workOrderId: string, etaMins: number): SmsMessage {
  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  
  return {
    id: `sms-in-${Date.now()}`,
    timestamp: timeStr,
    recipientPhone: '+1 (555) 792-4419',
    recipientName: `${crewName} Lead (Field)`,
    direction: 'INBOUND_REPLY',
    messageText: `ACK WO #${workOrderId}. Field truck deployed with hydro-vac & valve key wrenches. ETA to site: ${etaMins} mins. Beginning V-108A isolation upon arrival.`,
    severity: 'INFO',
    status: 'Received'
  };
}
