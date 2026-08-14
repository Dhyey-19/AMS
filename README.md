# 🏥 Global IVF Hospital - Attendance Management System (AMS)

A full-stack, monolithic web application for managing hospital staff master records and attendance tracking.

## 🛠️ Technology Stack
- **Frontend:** React.js (Vite, Lucide Icons, Custom Vanilla CSS Design System)
- **Backend:** Node.js + Express.js
- **Database:** Local SQLite database (`ams.db` with WAL mode)
- **Authentication:** JWT (JSON Web Tokens) & Bcrypt password hashing

---

## ⚡ Quick Start

### 1. Unified Monolithic Run (Single Server)
Serves both backend API and React frontend on port `5050`:
```bash
npm start
```
Open **[http://127.0.0.1:5050](http://127.0.0.1:5050)** in your web browser.

### 2. Development Mode (With Hot Reloading)
Runs Express backend on `5050` and Vite dev server on `3000`:
```bash
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your web browser.

### 3. Rebuild React Frontend
```bash
npm run build
```

---

## 🔐 Default Admin Credentials
- **Username:** `admin`
- **Password:** `admin123`

*(You can also use the Signup page to register new staff accounts at any time).*

---

## 🌟 Key Features Implemented

1. **Monolithic Single Repository**: Complete frontend, backend, database, and Excel datasets reside within one single project.
2. **Local SQLite Storage (`ams.db`)**: No external database setup or cloud services required. Auto-creates schema and indexes on startup.
3. **Hospital Dashboard**:
   - Live KPI cards: Total Staff, Active Working, Resigned, Total Departments.
   - Dynamic department visual breakdown bars.
   - Real-time digital clock and quick action shortcuts.
4. **Master Data CSV & Excel Ingestion**:
   - 1-Click **"Load Sample File (MD MASTER.csv)"** button to instantly sync hospital records.
   - Drag-and-drop file upload supporting `.csv`, `.xlsx`, and `.xls`.
   - Conflict-free **deduplication / upsert** based on `EmployeeCode` (126 unique employees, 0 duplicate insertions).
5. **Interactive Employee Directory**:
   - Real-time search across Name, Employee Code, Department, and Designation.
   - Multi-filtering by Department, Status (*Working* / *Resigned*), and Gender.
   - Sortable columns and pagination.
   - Full 23-field Employee Profile modal (DOJ, DOC, DOB, RFID, PAN, Voter ID, Shift Group, etc.).
   - CSV Export button.
6. **Extensible Architecture**: Clean separation into `routes/`, `controllers/`, `services/`, and `middleware/` designed for the upcoming attendance CSV import and reporting phases.
