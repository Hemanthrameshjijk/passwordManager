# Zero-Knowledge Access Control Platform (Local MVP)

This is a local-first MVP of a secure credential management system.

## 🚀 Getting Started

### 1. Backend Setup (FastAPI)

Prerequisites:
- Python 3.9+
- PostgreSQL running locally (or via Docker)

```bash
cd backend
pip install -r requirements.txt
```

**Database Configuration:**
Ensure you have a PostgreSQL database named `password_manager`. 
You can update the connection string in `.env`.

**Run Backend:**
```bash
python -m uvicorn main:app --reload
```
The API will be available at `http://localhost:8000`.

**Seed Test Data:**
```bash
python -m seed
```
This creates a test user: `test@example.com` / `password123`.

---

### 2. Chrome Extension Setup

1. Open Chrome and navigate to `chrome://extensions/`.
2. Enable **"Developer mode"** (top right).
3. Click **"Load unpacked"**.
4. Select the `extension` folder from this repository.

---

### 3. Usage

1. Click the extension icon in your browser.
2. Login with `test@example.com` / `password123`.
3. Navigate to any login page (e.g., GitHub, Google).
4. Select a credential from the list and click **"Autofill"**.
5. Watch the fields get populated automatically!

---

## 🔐 Architecture Notes

- **Zero-Knowledge**: In this MVP, the "encrypted" data is simulated. In a full version, the extension would perform client-side encryption before sending to the server.
- **Autofill**: The content script uses a robust strategy to find email/password pairs and triggers DOM events to ensure compatibility with modern frameworks (React, etc.).
- **Local-First**: Everything runs on your machine for maximum security and privacy during development.
