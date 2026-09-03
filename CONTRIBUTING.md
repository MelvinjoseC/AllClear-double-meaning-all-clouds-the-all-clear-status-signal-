# 🤝 Contributing to AllClear

Thank you for your interest in contributing to **AllClear**! We welcome pull requests, bug reports, and feature proposals.

---

## Code of Conduct

All contributors are expected to uphold a welcoming, inclusive, and professional environment for all community members.

---

## Development Setup

### Prerequisites
- **Node.js**: v20.x or higher (`npm v10+`)
- **Python**: v3.8 or higher
- **Docker & Docker Compose**: v2.20+
- **PostgreSQL**: v16+ (or use Docker Compose)

### 1. Clone & Setup
```bash
git clone https://github.com/MelvinjoseC/AllClear-double-meaning-all-clouds-.git
cd AllClear-double-meaning-all-clouds-
```

### 2. Backend Setup
```bash
cd backend
npm install
npm run build
```

### 3. Frontend Setup
```bash
cd ../frontend
npm install
npm run build
```

### 4. Running the Test Suites
```bash
# Backend unit tests (RLS, Alert translation, Dispatchers, SSL prober)
node tests/test_backend.js

# Agent unit tests (CPU delta, /proc parsers, fallback resilience)
python tests/test_agent.py
```

---

## Coding Standards

### Git Commit Conventions
We enforce the **Conventional Commits** specification:
- `feat(...)`: New end-user features or capabilities
- `fix(...)`: Bug fixes and defect corrections
- `refactor(...)`: Code refactoring without changing user behavior
- `test(...)`: Adding or updating unit/integration tests
- `docs(...)`: Documentation updates or additions
- `ci(...)`: Workflow or pipeline adjustments
- `chore(...)`: Maintenance, dependency, or branding updates

### Pure-Python Agent Design
The Linux agent in `agent/agent.py` must maintain **zero external third-party dependencies**. Always use Python standard library modules (`urllib.request`, `json`, `os`, `shutil`, `time`, `argparse`, `socket`).

---

## Submitting Pull Requests

1. Fork the repository and create a descriptive feature branch:
   ```bash
   git checkout -b feat/my-new-feature
   ```
2. Write clean, documented code with accompanying unit tests.
3. Ensure all tests pass:
   ```bash
   node tests/test_backend.js
   python tests/test_agent.py
   ```
4. Push your branch and open a Pull Request against `main`.
