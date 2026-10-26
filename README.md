<div align="center">

# 🛡️ AllClear — Multi-Cloud Observability Engine

### *"All Clouds. The All-Clear Status Signal."*

[![CI Pipeline](https://github.com/MelvinjoseC/AllClear-double-meaning-all-clouds-/actions/workflows/ci.yml/badge.svg)](https://github.com/MelvinjoseC/AllClear-double-meaning-all-clouds-/actions/workflows/ci.yml)
[![CodeQL Security](https://github.com/MelvinjoseC/AllClear-double-meaning-all-clouds-/actions/workflows/codeql.yml/badge.svg)](https://github.com/MelvinjoseC/AllClear-double-meaning-all-clouds-/actions/workflows/codeql.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Helm Chart: v2.0.0](https://img.shields.io/badge/Helm-v2.0.0-326CE5.svg?logo=helm&logoColor=white)](infra/helm/allclear)
[![API Docs: OpenAPI 3.0](https://img.shields.io/badge/API_Docs-OpenAPI_3.0-blueviolet.svg)](backend/src/docs/openapi.json)
[![Status Badge](https://img.shields.io/badge/AllClear-Operational-10b981.svg)](ARCHITECTURE.md)

<p align="center">
  <b>A production-grade, multi-tenant observability platform built for modern multi-cloud estates.</b><br/>
  Zero-dependency telemetry agents with offline ring buffers, PostgreSQL Row-Level Security (RLS) isolation, dynamic threshold engines, compliance audit trails, TLS security grading, multi-channel dispatchers (Slack, Discord, Telegram, PagerDuty, MS Teams, WhatsApp, Webhooks), and human-first incident translations.
</p>

</div>

---

## 💡 The Double Meaning Behind AllClear

| Concept | What It Delivers |
| :--- | :--- |
| **"All Clouds"** | Unifies disparate cloud infrastructure across **AWS, Google Cloud Platform (GCP), Microsoft Azure, DigitalOcean, and bare-metal VPS** into a single radar view without vendor lock-in. |
| **"The All-Clear Status Signal"** | Eliminates monitoring fatigue. Instead of cryptically screaming `deriv(node_disk_usage[5m]) > 0.02`, AllClear gives teams explicit operational reassurance: **"ALL SYSTEMS CLEAR — 100% OPERATIONAL"** when nominal, and actionable, plain-English human recommendations when an incident occurs. |

---

## ✨ Core Platform Features

### 🖥️ Zero-Dependency Pure-Python Agent
- Written strictly in standard library Python 3 (`urllib`, `os`, `json`, `shutil`) — **zero `pip` installations required**.
- Real-time `/proc/stat` CPU tick delta calculation, `/proc/meminfo` buffer/cache memory parser, and storage saturation metrics.
- High-throughput `/proc/net/dev` network bandwidth parser (KB/s in/out & packet errors) and `/proc/diskstats` I/O prober.
- Resilient cross-platform fallbacks for Windows and macOS development environments.
- CLI diagnostic flags: `--version`, `--dry-run`, `--test-config`, `--interval`.

### 🔒 Enterprise Multi-Tenant Row Level Security (RLS)
- True database engine tenant separation enforced through PostgreSQL 16 `FORCE ROW LEVEL SECURITY`.
- Connection-bound tenant scoping: `SET LOCAL app.current_tenant = '$tenant_id'` ensures zero cross-tenant data leakage even in complex relational queries.
- Hashed agent token authentication via salted Bcrypt with dedicated `SECURITY DEFINER` verification bypasses.

### 🌐 Continuous TLS & SSL Certificate Prober
- Background TLS socket handshake prober inspecting remote SSL certificates.
- Automatic extraction of Certificate Authority issuer, subject, valid date ranges, and days remaining.
- Multi-tier alert thresholds for certificates expiring within 14 days (warning) and 72 hours (critical).

### 🔔 Multi-Channel Alert Dispatchers & Maintenance Windows
- **Human-First Translations**: Automatically converts raw metrics into plain-English diagnostics and immediate suggested next steps.
- **Multi-Channel Delivery**:
  - 💬 **Slack**: Block Kit formatted incident cards.
  - 🎮 **Discord**: Color-coded rich embed status cards.
  - ✈️ **Telegram**: HTML bot notifications with node code blocks.
  - 📱 **WhatsApp**: High-priority SMS/WhatsApp dispatch via Twilio API.
  - 🔗 **Custom Webhooks**: JSON payload streaming with HMAC-SHA256 digital signatures (`X-AllClear-Signature`).
- **Maintenance Windows Engine**: Suppress false-positive alerts during scheduled downtime and maintenance periods.

### 📊 Public Status Pages & Embeddable Badges
- Unauthenticated public JSON status API for public transparency.
- Dynamic SVG status badge generator compatible with GitHub READMEs and landing pages (`/api/public/badges/:tenantId/status.svg`).
- Interactive React dashboard featuring the **AllClear Radar Pulse Banner**, real-time SVG sparklines, and cloud provider filtering.

---

## 🏗️ System Architecture

```
                 +-------------------------------------------------------+
                 |              Monitored Nodes (Any Cloud)             |
                 |  [ AWS EC2 ]   [ Azure VM ]   [ GCP GCE ]   [ VPS ]   |
                 +---------------------------+---------------------------+
                                             | HTTPS / Token-Bound POST
                                             v
+------------------------+      +---------------------------+      +------------------------+
|   AllClear Radar UI    |<---->|  AllClear Express API     |<---->|   PostgreSQL 16 (RLS)  |
|  (React 18 + Tailwind) |      |  (TypeScript Control)     |      |  (Strict Tenant Sep)   |
+------------------------+      +-------------+-------------+      +------------------------+
                                              |
                   +--------------------------+--------------------------+
                   |                          |                          |
                   v                          v                          v
      +------------------------+ +------------------------+ +------------------------+
      |    Prometheus TSDB     | |   TLS Certificate      | |   Multi-Channel Engine |
      |  (Scraping & Rules)    | |   Handshake Prober     | | (Slack/Discord/TG/SMS) |
      +-----------+------------+ +------------------------+ +------------------------+
                  |
                  v
      +------------------------+
      |  Alertmanager Router   |
      +------------------------+
```

*For comprehensive architecture specifications, database schemas, and STRIDE threat models, read [ARCHITECTURE.md](ARCHITECTURE.md).*

---

## 🚀 Quickstart Guide

### Prerequisites
- Docker & Docker Compose (`v2.20+`)
- Node.js `v20+` and Python `v3.8+` (for local development)

### 1. Run the Full Stack via Docker Compose
```bash
# Clone repository
git clone https://github.com/MelvinjoseC/AllClear-double-meaning-all-clouds-.git
cd AllClear-double-meaning-all-clouds-

# Generate TLS certificates for local Nginx gateway
cd infra/nginx
./generate-certs.sh # Or ./generate-certs.ps1 on Windows
cd ../..

# Launch all microservices
docker compose -f infra/docker-compose.yml up -d --build
```
Access the dashboard at **`https://localhost`** (or `http://localhost:5000` for raw API).

### 2. Connect a Linux Server
In the AllClear dashboard, click **Add Monitor** -> **Linux Server**. Copy the one-line shell installer:
```bash
curl -sSL https://localhost/api/agent/install.sh?token=YOUR_TOKEN&server_id=YOUR_ID | sudo bash
```

### 3. Deploy to Kubernetes via Helm
AllClear includes a production-ready Helm chart with Horizontal Pod Autoscaling (HPA) and Pod Disruption Budgets (PDB):
```bash
# Lint chart templates
helm lint infra/helm/allclear/

# Deploy to your Kubernetes cluster
helm install allclear infra/helm/allclear/ -f infra/helm/allclear/values.yaml
```

---

## 🧪 Automated Testing & Verification

The repository includes a comprehensive 17-test verification suite covering backend RLS isolation, alerting translators, multi-channel dispatchers, and Python agent telemetry parsing:

```bash
# 1. Run Backend Unit & Integration Tests (10 test suites)
npm run build --prefix backend
node tests/test_backend.js

# 2. Run Python Agent Diagnostic & /proc Parser Tests (7 test suites)
python tests/test_agent.py

# 3. Verify Agent CLI Diagnostics
python agent/agent.py --version
python agent/agent.py --dry-run
```

---

## 📁 Repository Structure

```
AllClear/
├── .github/
│   └── workflows/              # CI Pipeline (tests, linting) & CodeQL Static Security
├── agent/
│   ├── agent.py                # Pure-Python zero-dependency metrics collector
│   └── install.sh              # Idempotent Linux systemd service installer
├── backend/
│   ├── src/
│   │   ├── db/                 # PostgreSQL schema.sql & RLS context pool
│   │   ├── middleware/         # JWT authentication & tenant scoping
│   │   ├── routes/             # Monitored targets, agent, maintenance, status page
│   │   └── services/           # Notifier (Slack/Discord/TG), SSL prober, alert translation
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/         # Modular components (Radar banner, sparklines, cards)
│   │   ├── App.tsx             # Main AllClear dashboard application
│   │   └── types.ts            # TypeScript interfaces
│   └── package.json
├── infra/
│   ├── docker-compose.yml      # Local development and staging compose stack
│   ├── docker-compose.prod.yml # Production resource-limited compose stack
│   ├── grafana/                # Pre-configured AllClear Multi-Cloud overview dashboard
│   ├── helm/allclear/          # Production Kubernetes Helm chart (HPA, PDB, Ingress)
│   ├── nginx/                  # Reverse proxy gateway and SSL termination
│   ├── prometheus/             # Alert rules, scrape configs, and blackbox probers
│   └── terraform/              # AWS ECS Fargate, RDS PostgreSQL, and ALB IaC
├── tests/
│   ├── test_agent.py           # Python agent unit tests
│   └── test_backend.js         # Backend RLS, alert translation & prober tests
├── ARCHITECTURE.md             # Detailed architecture guide & STRIDE threat model
├── CHANGELOG.md                # Semantic version release notes
├── CONTRIBUTING.md             # Contribution guidelines & coding conventions
├── LICENSE                     # MIT License
└── SECURITY.md                 # Vulnerability disclosure policy & security model
```

---

## 📜 Documentation Index

- [🏛️ Architecture & Threat Model](ARCHITECTURE.md)
- [📋 Release Changelog](CHANGELOG.md)
- [🤝 Contributing Guidelines](CONTRIBUTING.md)
- [🔒 Security Policy](SECURITY.md)
- [📊 Grafana Dashboard Guide](infra/grafana/README.md)

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
<div align="center">
  <sub>Engineered with excellence by <a href="https://github.com/MelvinjoseC">MelvinjoseC</a></sub>
</div>
