export type CloudProvider = 'aws' | 'gcp' | 'azure' | 'digitalocean' | 'baremetal' | 'other';
export type Environment = 'production' | 'staging' | 'development';
export type ChannelType = 'slack' | 'discord' | 'telegram' | 'webhook' | 'whatsapp' | 'email' | 'pagerduty' | 'msteams';

export interface MonitoredItem {
  id: string;
  tenant_id: string;
  type: 'server' | 'url';
  name: string;
  url: string | null;
  cloud_provider?: CloudProvider;
  environment?: Environment;
  tags?: string[];
  status: 'green' | 'yellow' | 'red';
  last_checked_at: string | null;
  uptime_percentage: string;
  created_at: string;
}

export interface AlertHistory {
  id: string;
  tenant_id: string;
  monitored_item_id: string;
  item_name: string;
  item_type: string;
  alert_name: string;
  severity: string;
  status: 'firing' | 'resolved' | 'suppressed_maintenance';
  message: string;
  suggested_action: string;
  starts_at: string;
  ends_at: string | null;
  created_at: string;
}

export interface User {
  id: string;
  email: string;
  tenantId: string;
  companyName: string;
  whatsappName?: string;
}

export interface TelemetryPoint {
  timestamp: number;
  cpu: number;
  memory_pct: number;
  memory_used_bytes: number;
  disk_pct: number;
  disk_used_bytes: number;
  network_rx_kbps: number;
  network_tx_kbps: number;
  disk_read_kbps: number;
  disk_write_kbps: number;
}

export interface SslCertInfo {
  domain: string;
  issuer: string;
  subject: string;
  valid_from: string;
  valid_to: string;
  days_remaining: number;
  status: 'valid' | 'expiring_soon' | 'expired' | 'error';
  last_checked_at?: string;
  protocol?: string;
  cipher?: string;
  sans?: string[];
  security_grade?: 'A+' | 'A' | 'B' | 'C' | 'F';
}

export interface MaintenanceWindow {
  id: string;
  tenant_id: string;
  name: string;
  monitored_item_id: string | null;
  item_name?: string;
  start_time: string;
  end_time: string;
  reason: string;
  is_active: boolean;
  created_at: string;
}

export interface NotificationChannel {
  id: string;
  tenant_id: string;
  name: string;
  channel_type: ChannelType;
  config_json: Record<string, any>;
  is_enabled: boolean;
}

export interface AuditLogEntry {
  id: string;
  tenant_id: string;
  actor_email: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  details: Record<string, any>;
  ip_address: string;
  created_at: string;
}
