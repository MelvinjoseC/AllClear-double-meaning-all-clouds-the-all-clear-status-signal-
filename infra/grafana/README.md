# 📊 AllClear Grafana Dashboards

This directory contains production-ready dashboard definitions for **AllClear**.

## Dashboards Included

1. **`allclear-overview.json`** (`uid: allclear-overview`):
   - **Executive Stats**: Critical Incidents Firing, Active Multi-Cloud Nodes, Overall Web Availability, Closest SSL Expiration.
   - **Compute Saturation**: CPU utilization percentage timeseries, Memory utilization percentage timeseries.
   - **Network & I/O**: Network throughput (KB/s in/out) and packet error counters.
   - **HTTP & TLS**: Probe response times, HTTP status code distributions, and SSL validity counters.

## Quick Import

### Option 1: Via Grafana Web UI
1. Navigate to **Dashboards** -> **New** -> **Import**.
2. Upload `allclear-overview.json` or paste its contents.
3. Select your Prometheus datasource (default UID: `prometheus`).
4. Click **Import**.

### Option 2: Automatic Docker Provisioning
Mount this directory into your Grafana container's provisioning path:
```yaml
volumes:
  - ./grafana/allclear-overview.json:/etc/grafana/provisioning/dashboards/allclear-overview.json:ro
```
