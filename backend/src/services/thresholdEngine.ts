// ==============================================================================
// ALLCLEAR DYNAMIC ALERT THRESHOLD EVALUATION ENGINE
// ==============================================================================

export interface MetricSample {
  cpu_usage_percentage: number;
  memory_usage_percentage: number;
  disk_usage_percentage: number;
  network_rx_errors?: number;
  network_tx_errors?: number;
  tcp_connections?: {
    established?: number;
    time_wait?: number;
    close_wait?: number;
    listen?: number;
    total?: number;
  };
}

export interface ThresholdRule {
  id?: string;
  tenant_id?: string;
  monitored_item_id?: string | null;
  metric_name: 'cpu' | 'memory' | 'disk' | 'network_errors' | 'tcp_connections';
  warning_threshold: number;
  critical_threshold: number;
  is_enabled?: boolean;
}

export interface ThresholdBreach {
  metricName: string;
  currentValue: number;
  thresholdValue: number;
  severity: 'warning' | 'critical';
  alertName: string;
  message: string;
  suggestedAction: string;
}

export const DEFAULT_THRESHOLDS: Record<string, { warning: number; critical: number }> = {
  cpu: { warning: 80.0, critical: 90.0 },
  memory: { warning: 80.0, critical: 90.0 },
  disk: { warning: 85.0, critical: 95.0 },
  network_errors: { warning: 10, critical: 50 },
  tcp_connections: { warning: 2000, critical: 5000 },
};

/**
 * Evaluates metric sample against active threshold rules.
 * Applies specific server override rules first, falling back to tenant rules, then system defaults.
 */
export function evaluateMetricsThresholds(
  metrics: MetricSample,
  serverName: string,
  customRules: ThresholdRule[] = []
): ThresholdBreach[] {
  const breaches: ThresholdBreach[] = [];

  const getRule = (metric: 'cpu' | 'memory' | 'disk' | 'network_errors' | 'tcp_connections') => {
    const custom = customRules.find((r) => r.metric_name === metric && r.is_enabled !== false);
    if (custom) {
      return { warning: custom.warning_threshold, critical: custom.critical_threshold };
    }
    return DEFAULT_THRESHOLDS[metric] || { warning: 80.0, critical: 90.0 };
  };

  // 1. CPU Check
  const cpuRule = getRule('cpu');
  if (metrics.cpu_usage_percentage >= cpuRule.critical) {
    breaches.push({
      metricName: 'cpu',
      currentValue: metrics.cpu_usage_percentage,
      thresholdValue: cpuRule.critical,
      severity: 'critical',
      alertName: 'HostHighCpu',
      message: `Critical CPU saturation on ${serverName}: ${metrics.cpu_usage_percentage.toFixed(1)}% (critical limit: ${cpuRule.critical}%)`,
      suggestedAction: 'Inspect runaway processes with `top -b -n 1` or scale compute instances.',
    });
  } else if (metrics.cpu_usage_percentage >= cpuRule.warning) {
    breaches.push({
      metricName: 'cpu',
      currentValue: metrics.cpu_usage_percentage,
      thresholdValue: cpuRule.warning,
      severity: 'warning',
      alertName: 'HostHighCpu',
      message: `Elevated CPU usage on ${serverName}: ${metrics.cpu_usage_percentage.toFixed(1)}% (warning limit: ${cpuRule.warning}%)`,
      suggestedAction: 'Monitor CPU trend over the next 15 minutes to identify batch compute spikes.',
    });
  }

  // 2. Memory Check
  const memRule = getRule('memory');
  if (metrics.memory_usage_percentage >= memRule.critical) {
    breaches.push({
      metricName: 'memory',
      currentValue: metrics.memory_usage_percentage,
      thresholdValue: memRule.critical,
      severity: 'critical',
      alertName: 'HostHighMemory',
      message: `Severe memory exhaustion on ${serverName}: ${metrics.memory_usage_percentage.toFixed(1)}% used (critical limit: ${memRule.critical}%)`,
      suggestedAction: 'OOM killer imminent. Review resident memory usage with `ps aux --sort=-%mem | head -n 10`.',
    });
  } else if (metrics.memory_usage_percentage >= memRule.warning) {
    breaches.push({
      metricName: 'memory',
      currentValue: metrics.memory_usage_percentage,
      thresholdValue: memRule.warning,
      severity: 'warning',
      alertName: 'HostHighMemory',
      message: `Elevated memory consumption on ${serverName}: ${metrics.memory_usage_percentage.toFixed(1)}% (warning limit: ${memRule.warning}%)`,
      suggestedAction: 'Verify cache/buffer allocations and restart leaky background workers.',
    });
  }

  // 3. Disk Check
  const diskRule = getRule('disk');
  if (metrics.disk_usage_percentage >= diskRule.critical) {
    breaches.push({
      metricName: 'disk',
      currentValue: metrics.disk_usage_percentage,
      thresholdValue: diskRule.critical,
      severity: 'critical',
      alertName: 'HostPredictiveDiskFill',
      message: `Volume almost full on ${serverName}: ${metrics.disk_usage_percentage.toFixed(1)}% utilized (critical limit: ${diskRule.critical}%)`,
      suggestedAction: 'Immediate action required: prune /var/log, clean docker images, or expand persistent disk volume.',
    });
  } else if (metrics.disk_usage_percentage >= diskRule.warning) {
    breaches.push({
      metricName: 'disk',
      currentValue: metrics.disk_usage_percentage,
      thresholdValue: diskRule.warning,
      severity: 'warning',
      alertName: 'HostPredictiveDiskFill',
      message: `Disk volume capacity alert on ${serverName}: ${metrics.disk_usage_percentage.toFixed(1)}% utilized (warning limit: ${diskRule.warning}%)`,
      suggestedAction: 'Plan storage cleanup or volume resizing before capacity reaches 90%.',
    });
  }

  // 4. Network Errors Check
  const totalNetErrors = (metrics.network_rx_errors || 0) + (metrics.network_tx_errors || 0);
  const netRule = getRule('network_errors');
  if (totalNetErrors >= netRule.critical) {
    breaches.push({
      metricName: 'network_errors',
      currentValue: totalNetErrors,
      thresholdValue: netRule.critical,
      severity: 'critical',
      alertName: 'HostNetworkPacketDrops',
      message: `Excessive network packet errors on ${serverName}: ${totalNetErrors} dropped/corrupt packets`,
      suggestedAction: 'Check network interface duplex configuration, MTU sizing, or VPC gateway packet loss.',
    });
  }

  // 5. TCP Sockets Exhaustion
  const tcpConns = metrics.tcp_connections?.total || 0;
  const tcpRule = getRule('tcp_connections');
  if (tcpConns >= tcpRule.critical) {
    breaches.push({
      metricName: 'tcp_connections',
      currentValue: tcpConns,
      thresholdValue: tcpRule.critical,
      severity: 'critical',
      alertName: 'HostTcpSocketExhaustion',
      message: `Socket table exhaustion on ${serverName}: ${tcpConns} active TCP sockets`,
      suggestedAction: 'Inspect connection leaks, tune net.ipv4.tcp_max_syn_backlog and net.ipv4.ip_local_port_range.',
    });
  }

  return breaches;
}
