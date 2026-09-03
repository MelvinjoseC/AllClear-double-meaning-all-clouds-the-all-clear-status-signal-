# 📋 Changelog

All notable changes to **AllClear** are documented in this file.  
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) and adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.1.0] - 2026-09-03

### 🚀 Added
- **Multi-Cloud Observability Engine**: Full support for tagging and filtering nodes across AWS, GCP, Azure, DigitalOcean, and Bare-Metal VPS.
- **Pure-Python Linux Agent**: Pure-Python `/proc/net/dev` network bandwidth parser and `/proc/diskstats` storage throughput parser with zero external dependencies.
- **Cross-Platform Resilience**: Automatic synthetic and `shutil.disk_usage` fallbacks for Windows and macOS local testing.
- **Agent CLI Diagnostics**: `--version`, `--dry-run`, `--test-config`, `--interval`, and `--config` CLI flags for seamless DevOps operations.
- **SSL / TLS Certificate Monitoring**: Background TLS handshake inspection prober checking domain, issuer CA, expiry dates, days remaining, and auto-refresh endpoints.
- **Multi-Channel Alert Dispatchers**:
  - Slack Block Kit formatted incident cards.
  - Discord rich embeds with severity color-coding.
  - Telegram Bot API channel with HTML formatting.
  - Custom Webhooks with HMAC-SHA256 signature verification (`X-AllClear-Signature`).
- **Maintenance Windows Engine**: Scheduled downtime maintenance windows to mute noisy false-positive alerts during planned system upgrades.
- **Public Status Page & Badges**: Unauthenticated public JSON status API and dynamic Shields.io-style SVG status badges for GitHub READMEs and landing pages.
- **Time-Series Telemetry Query API**: Rolling telemetry timeseries buffer endpoint for CPU, RAM, Disk, and Network sparklines.
- **Predictive Prometheus Rules**: Alertmanager rules for predictive disk fill (`HostDiskFillingFast`), network packet error spikes (`HostHighNetworkErrors`), and SSL expiration warnings.
- **Grafana Dashboard Template**: Pre-configured `allclear-overview.json` dashboard with executive health gauges, saturation heatmaps, and latency panels.
- **Frontend Modular Architecture**: Refactored monolithic dashboard into modular components (`Sidebar`, `StatusRadarBanner`, `ServerCard`, `UrlCard`, `Sparkline`, `CloudFilterTabs`, `AlertHistoryTable`, `ChannelSettingsModal`, `PublicStatusModal`).
- **AllClear Radar Status Signal**: Real-time pulsing radar indicator representing the dual concept: *"All Clouds. The All-Clear Status Signal."*
- **Kubernetes Cloud-Native Enhancements**:
  - `HorizontalPodAutoscaler` (HPA) targeting CPU (75%) and memory (80%).
  - `PodDisruptionBudget` (PDB) guaranteeing `minAvailable: 1`.
  - Cert-Manager automated TLS ingress annotations.
- **CI / CD & Security Workflows**:
  - GitHub CodeQL static security analysis workflow.
  - Multi-cloud linting, Helm linting, and automated unit test verification.
- **Comprehensive Documentation**: Detailed `ARCHITECTURE.md` with Mermaid diagrams, STRIDE threat model, `CONTRIBUTING.md`, and `SECURITY.md`.

### 🔄 Changed
- Rebranded platform identity uniformly from legacy `CloudMon` to **AllClear Multi-Cloud Observability Engine**.
- Expanded test suites to 17 automated unit tests across backend TypeScript and Python agent environments.
