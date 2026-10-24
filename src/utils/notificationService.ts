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

export const USER_ALERT_PHONE = '7975453101';
export const USER_ALERT_PHONE_FORMATTED = '+91 79754 53101';

export const DEFAULT_SMS_CONFIG: SmsRecipientConfig = {
  phoneNumber: USER_ALERT_PHONE_FORMATTED,
  name: 'Chief On-Call Engineer',
  role: 'Chief Utility Engineer',
  sendOnCriticalBurst: true,
  sendValveIsolationProtocol: true,
  sendDailyNrwDigest: true,
  smsGateway: 'Twilio Cloud SMS'
};

/**
 * Normalizes and formats raw phone numbers into standard readable formats.
 * For 10-digit Indian numbers (e.g. 7975453101), formats as +91 79754 53101.
 */
export function formatPhoneNumber(phone: string): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) {
    if (phone.trim().startsWith('+1') || phone.trim().startsWith('1')) {
      return `+1 (${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    // Default 10-digit format (Indian mobile series starting 6-9, like 7975453101)
    return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  }
  if (digits.length === 12 && digits.startsWith('91')) {
    const local = digits.slice(2);
    return `+91 ${local.slice(0, 5)} ${local.slice(5)}`;
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    const local = digits.slice(1);
    return `+1 (${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6)}`;
  }
  return phone.trim();
}

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
 * Validates international E.164 or formatted domestic phone numbers (10 to 15 digits).
 */
export function isValidPhoneNumber(phone: string): boolean {
  if (!phone) return false;
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15;
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
