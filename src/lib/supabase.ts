/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createClient } from '@supabase/supabase-js';

// Clean Supabase URL (strip trailing slash or /rest/v1/ if passed)
export function sanitizeSupabaseUrl(rawUrl: string): string {
  if (!rawUrl) return '';
  let url = rawUrl.trim();
  // Strip trailing /rest/v1 or /rest/v1/
  url = url.replace(/\/rest\/v1\/?$/, '');
  // Strip any trailing slash
  url = url.replace(/\/+$/, '');
  return url;
}

export const SUPABASE_CONFIG = {
  url: sanitizeSupabaseUrl(
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) ||
    'https://atgbqxmergxaaazrhbpr.supabase.co'
  ),
  publishableKey:
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY) ||
    'sb_publishable_dHyqNhrZ-s5wldVFq_H3Fw_Weo8gWf5',
  projectId: 'atgbqxmergxaaazrhbpr',
  region: 'ap-northeast-1',
  projectName: "manumanu87181@gmail.com's Project"
};

// Initialize the Supabase Client
export const supabase = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.publishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true
  }
});

export interface SupabaseConnectionStatus {
  connected: boolean;
  timestamp: string;
  latencyMs: number;
  error?: string;
  projectInfo: {
    projectId: string;
    region: string;
    projectName: string;
    url: string;
  };
}

/**
 * Ping Supabase REST API endpoint to verify connectivity
 */
export async function testSupabaseConnection(): Promise<SupabaseConnectionStatus> {
  const start = performance.now();
  const info = {
    projectId: SUPABASE_CONFIG.projectId,
    region: SUPABASE_CONFIG.region,
    projectName: SUPABASE_CONFIG.projectName,
    url: SUPABASE_CONFIG.url
  };

  try {
    // Attempt request to Supabase REST root endpoint
    const response = await fetch(`${SUPABASE_CONFIG.url}/rest/v1/`, {
      method: 'GET',
      headers: {
        'apikey': SUPABASE_CONFIG.publishableKey,
        'Authorization': `Bearer ${SUPABASE_CONFIG.publishableKey}`
      }
    });

    const latency = Math.round(performance.now() - start);

    // 200 OK or 401/404 on root schema both confirm the Supabase instance is live and responsive
    if (response.ok || response.status === 200 || response.status === 404 || response.status === 401) {
      return {
        connected: true,
        timestamp: new Date().toLocaleTimeString(),
        latencyMs: latency,
        projectInfo: info
      };
    } else {
      return {
        connected: false,
        timestamp: new Date().toLocaleTimeString(),
        latencyMs: latency,
        error: `Supabase returned HTTP status ${response.status}: ${response.statusText}`,
        projectInfo: info
      };
    }
  } catch (err: any) {
    const latency = Math.round(performance.now() - start);
    return {
      connected: false,
      timestamp: new Date().toLocaleTimeString(),
      latencyMs: latency,
      error: err?.message || 'Unable to establish network connection to Supabase endpoint.',
      projectInfo: info
    };
  }
}
