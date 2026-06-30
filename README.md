# 🛡️ CloudMon — Multi-Cloud Monitoring SaaS MVP

CloudMon is a lightweight, secure, and multi-tenant monitoring SaaS tailored for small businesses with no dedicated DevOps staff. It unifies server monitoring and shared hosting URL monitoring, translates raw technical alerts into plain English, and dispatches them via WhatsApp and Email.

---

## 🚀 MVP Decisions for the User (Review Required)

Please review and confirm these MVP defaults during your evaluation:
1. **Alerting Channels Fallback**: Real alerts require Twilio WhatsApp and SMTP credentials. If these are omitted from your `.env` configuration, CloudMon will log all formatted plain-English messages directly to the system console and a local debug file (`backend/logs/alerts.log`) for local testing.
2. **Prometheus Retention Policy**: Confirmed 30-day metrics history default (`--storage.tsdb.retention.time=30d`).
3. **Starter Tier Limits**: Confirmed and enforced a starter tier limit of **2 monitored items** (combination of servers/URLs) per tenant in the API from day one.

---

## 🛠️ Technology Stack & Folder Structure

*   **`agent/`**: Zero-dependency Python 3 agent that parses `/proc` filesystem metrics (CPU percentage delta, memory, disk `statvfs`, system and process uptime) and submits them via HTTPS POST with TLS validation.
*   **`infra/`**: Docker Compose stack containing PostgreSQL, Prometheus, Alertmanager, Prometheus Blackbox Exporter, and Nginx.
*   **`backend/`**: Node.js + TypeScript + Express API service utilizing PostgreSQL Row-Level Security (RLS) policies.
*   **`frontend/`**: React + Vite + TailwindCSS v3 single-page dashboard.
*   **`tests/`**: Automated verification test suite for agent and backend translations.

---

## 📦 Setting Up the System Locally

### Step 1: Clone the monorepo and generate TLS certificates
Ensure you have Docker and Docker Compose installed.
We must generate self-signed TLS certificates for local Nginx HTTPS gateway termination.

In Git Bash / Linux:
```bash
cd infra/nginx
./generate-certs.sh
cd ../..
```

On Windows (PowerShell):
```powershell
cd infra/nginx
./generate-certs.ps1
cd ../..
```

### Step 2: Configure Environment Variables
Create a `.env` file in the `backend/` directory:
```env
PORT=5000
DB_HOST=postgres
DB_PORT=5432
DB_NAME=cloudmon
DB_USER=cloudmon_user
DB_PASS=cloudmon_pass_change_me
JWT_SECRET=super_secret_jwt_key_mvp_change_me
PROMETHEUS_TARGETS_FILE=/etc/prometheus/blackbox_targets.json

# Optional: WhatsApp Integration (Twilio)
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886

# Optional: Email Integration (SMTP)
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=alerts@cloudmon.io
```

### Step 3: Spin up the Docker Compose Stack
From the root workspace directory, run:
```bash
cd infra
docker compose up --build -d
```
This will compile and launch Nginx, Postgres, Prometheus, Alertmanager, Blackbox Exporter, the Node backend, and the React frontend.

---

## 🧪 Running Automated Tests

To verify calculations and translation pipelines before launching the services:

### 1. Test Agent CPU Delta calculation
Run the Python test script:
```bash
python tests/test_agent.py
```

### 2. Test Backend Alert translation and Token Binding
First compile the backend:
```bash
cd backend
npm install
npm run build
cd ..
```
Then run the Node test runner:
```bash
node tests/test_backend.js
```

---

## 📈 Manual Verification Walkthrough

Follow these steps to manually test the onboarding flow and alerting pipeline:

### 1. Portal Onboarding
1. Open `https://localhost` in your browser. (Accept the self-signed certificate warning in your browser for local testing).
2. Register a new account.
3. Click **Add App / Server** in the dashboard.
4. **Test Website Monitor**:
    *   Enter a display name and register `http://httpbin.org/status/200`.
    *   The backend will perform a synchronous probe, verify it returns 200, save the target to `blackbox_targets.json`, and the card will immediately show a **green** status.
5. **Test Linux Server Monitor**:
    *   Enter a display name (e.g. `My Cloud VPS`).
    *   Click **Register**. An overlay will open showing the unique bearer token and a `curl` installer command.
    *   Run the installer script on a test Linux server (or run `agent.py` locally for testing by manually placing a config file at `/etc/cloudmon-agent.conf`).
    *   Once the agent checks in, the dashboard overlay will transition to a **success** screen.

### 2. Triggering Alert & Translation Pipeline
Let's simulate a website outage to test the translation layer:
1. Register a website monitor targeting a failing URL, e.g., `http://httpbin.org/status/500`.
2. Within 2 minutes, Prometheus will detect the failure (`probe_success == 0`) and Alertmanager will fire the alert.
3. Alertmanager POSTs the firing webhook internally to Nginx -> backend `/internal/alerts/webhook`.
4. The translation layer converts the alert:
    *   *Resulting message*: `🚨 Your website [httpbin] is currently OFFLINE.`
    *   *Action recommendation*: `Check your hosting provider's status page, verify DNS settings, or restart your web server.`
5. The alert is saved to the **Alert History** log, the dashboard card status turns **red**, and notifications are sent. Verify the notification text in `backend/logs/alerts.log` or your console output.
6. Delete the failing monitor or wait for it to recover. Alertmanager sends a resolution webhook, the alert status updates to `resolved`, a green status notification is dispatched, and the dashboard transitions back to **green**.

---

## 🔒 Security Summary

1.  **Row-Level Security (RLS)**: Enforced via PostgreSQL rules on `monitored_items`, `agent_tokens`, and `alert_history` ensuring full multi-tenancy. Verified through custom connection context parameters.
2.  **Hashed Credentials**: Password strings and server agent tokens are never stored in plaintext and are hashed using bcrypt.
3.  **Low-Privilege Execution**: The client agent runs under a dedicated system user/group `cloudmon-agent` with strict configuration file permissions (`600`) and systemd security sandboxing.
4.  **Network Isolation**: Administrative metrics (`/internal/metrics`) and Postgres/Prometheus admin ports are blocked by Nginx and accessible only within the container bridge network.
