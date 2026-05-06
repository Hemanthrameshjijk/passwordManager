# Startup Guide

Follow these steps to start the application components.

## 1. Backend (FastAPI)
The backend handles the API, database, and file storage.

### Prerequisites
- Python 3.9+
- Virtual environment (recommended)

### Steps
1. Navigate to the `backend` directory:
   ```bash
   cd backend
   ```
2. Activate the virtual environment (if not already active):
   - Windows: `.venv\Scripts\activate`
   - Linux/Mac: `source .venv/bin/activate`
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Start the server:
   ```bash
   python -m uvicorn app.main:app --reload --port 8000
   ```
   The API will be available at [http://localhost:8000](http://localhost:8000).

---

## 2. Frontend (React + Vite)
The frontend provides the user interface for managing credentials.

### Prerequisites
- Node.js (v18+)
- npm

### Steps
1. Navigate to the `frontend` directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```
   The application will be available at [http://localhost:3000](http://localhost:3000).

---

## 3. Browser Extension
The extension provides autofill functionality on websites.

### Steps
1. Open Google Chrome (or any Chromium-based browser).
2. Go to `chrome://extensions/`.
3. Enable **"Developer mode"** (toggle in the top right corner).
4. Click **"Load unpacked"**.
5. Select the `extension` folder from the root of this project.

---

## Default Credentials
- **Admin Email**: `admin@gmail.com`
- **Password**: `admin`
