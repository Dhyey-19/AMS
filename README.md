# 🏥 Global IVF Hospital - Attendance Management System (AMS)

A complete, production-ready full-stack application for hospital employee master data management, biometric attendance log ingestion, dynamic salary/overtime calculation engine, and secure device authorization.

---

## 🛠️ Technology Stack
- **Frontend:** React 18, Vite, Lucide Icons, Custom Premium Vanilla CSS Design System (Glassmorphic cards, teal medical theme, mobile-responsive).
- **Backend:** Node.js + Express.js, `esbuild` bundler.
- **Database:** Local embedded SQLite database (`ams.db` with WAL mode & auto-schema migration).
- **File Parsing & Math:** SheetJS (`xlsx`), `csv-parser`, Dynamic Duration & Salary Calculation Engine.
- **Security & Authorization:** JWT authentication, Bcrypt password hashing, One-Click Device Registration Gate.

---

## ⚡ Quick Start (Development & Local Run)

### 1. Install All Dependencies (Single Unified Command)
```bash
npm install
```
*(Uses NPM Workspaces — installs both backend and frontend dependencies into a single root `node_modules`).*

### 2. Development Mode (With Hot Reloading)
Runs Express API backend on port `5050` and Vite React client with hot-module replacement on port `3000`:
```bash
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

### 3. Production Monolithic Run (Single Port)
Serves both backend API and the compiled React frontend together on port `5050`:
```bash
npm start
```
Open **[http://localhost:5050](http://localhost:5050)** in your browser.

---

## 🚀 Standalone Distribution (Zero Source Code Exposure)

To run this application on another Windows PC **without exposing any source code**:

1. Run the publish build command:
   ```bash
   npm run publish:build
   ```
2. Copy the generated `publish/` folder (or zip it) to the other Windows PC.
3. On that PC, double-click **`START_AMS.bat`**.
   - It will automatically launch the server and open **`http://localhost:5050`** in the default browser.
4. To stop the application, double-click **`STOP_AMS.bat`**.

---

## 🔐 Default Admin Credentials
- **Username:** `admin`
- **Password:** `admin123`

---

## 🌟 Core Features

1. **NPM Workspaces Monolithic Architecture**: Single unified `node_modules` without duplication.
2. **Dynamic Spreadsheet Ingestion & Column Mapping**:
   - Accepts `.csv`, `.xlsx`, and `.xls` files.
   - Automatically detects column headers and auto-maps fields based on intelligent fuzzy name matching.
   - Interactive live preview table rendering mapped rows before executing import.
   - Multi-sheet workbook selector for complex monthly Excel files.
   - Deduplication and upsert on `(employee_code, attendance_date_iso)`.
3. **Dynamic Attendance & Salary Calculation Engine**:
   - 4-Tier Duration Calculation threshold (11-minute grace rule, late IN, late OUT, both late).
   - Automated break time extraction from biometric punch logs.
   - Real-time Per-Day & Per-Hour salary calculation.
   - Overtime rules (Doctors exempt, Weekly Off counting, multipliers).
4. **Employee Master Management**:
   - 23+ profile fields, department filters, search, edit modals, and Excel export.
5. **One-Click Device Registration & License Gate**:
   - Secure authorization code system with auto-approval and revoke controls.

