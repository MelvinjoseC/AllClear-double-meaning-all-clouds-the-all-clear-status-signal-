# 🔒 Security Policy

Security is a primary design pillar of the **AllClear** observability platform.

---

## Supported Versions

| Version | Supported |
| :--- | :--- |
| `1.1.x` | ✅ Active Security Updates |
| `< 1.1.0` | ❌ End of Life |

---

## Reporting a Vulnerability

If you discover a security vulnerability within AllClear, please **do not open a public GitHub issue**. Instead, report it privately to our security team:

- **Email**: `security@allclear.dev` or via GitHub Private Vulnerability Reporting.
- Please include:
  - Description of the vulnerability and attack vector
  - Step-by-step reproduction steps or proof-of-concept
  - Affected components (`backend`, `agent`, `frontend`, or `helm`)

We strive to acknowledge receipt within **24 hours** and provide a resolution timeline within **72 hours**.

---

## Security Architecture

1. **Multi-Tenant Row-Level Security (RLS)**:
   - All tenant queries are strictly bound via `SET LOCAL app.current_tenant = '$tenant_id'` in PostgreSQL transactions.
   - Database tables enforce `FORCE ROW LEVEL SECURITY`.
2. **Cryptographic Token Binding**:
   - Host node agents authenticate using unique `agent_<hex>` tokens.
   - Raw tokens are never stored in the database; only salted Bcrypt hashes are persisted.
3. **Webhook Verification**:
   - Custom outgoing webhook payloads are digitally signed with HMAC-SHA256 (`X-AllClear-Signature`).
4. **CodeQL Automated Scanning**:
   - Automated CodeQL security analysis scans every push and pull request for CWE vulnerabilities.
