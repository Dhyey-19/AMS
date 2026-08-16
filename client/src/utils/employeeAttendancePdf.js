/**
 * Employee Attendance PDF & Print Generation Utility
 * Generates an official, beautifully styled Hospital Attendance & Salary Statement
 * optimized for A4 Landscape PDF export with crisp vector printing.
 */

const formatMonthName = (monthStr) => {
  if (!monthStr) return '';
  const [year, month] = monthStr.split('-');
  if (!year || !month) return monthStr;
  const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
  return date.toLocaleString('en-US', { month: 'long', year: 'numeric' });
};

const formatCurrency = (amount) => {
  if (amount === null || amount === undefined || isNaN(amount)) return '₹0';
  return '₹' + Number(amount).toLocaleString('en-IN');
};

export const generateEmployeeAttendanceHtml = (sheetData, options = {}) => {
  const {
    showSalary = true,
    showSignatures = true,
    showSpecialRules = true,
    hospitalName = 'GLOBAL IVF HOSPITAL',
    hospitalSubtitle = 'Department of Human Resources & Administration • Attendance & Payroll Statement'
  } = options;

  if (!sheetData) return '';

  const emp = sheetData.employee || {};
  const summary = sheetData.summary || {};
  const records = sheetData.dailyRecords || [];
  const monthDisplay = formatMonthName(summary.month || '2026-05');
  const generationDate = new Date().toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });

  const empCode = emp.employee_code || 'N/A';
  const empName = emp.employee_name || 'Staff Member';
  const isResigned = emp.status === 'Resigned';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${empCode}_${empName.replace(/\s+/g, '_')}_Attendance_${summary.month || 'Statement'}</title>
  <style>
    @page {
      size: landscape;
      margin: 8mm 6mm;
    }

    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      font-size: 11px;
      line-height: 1.35;
      color: #1e293b;
      background: #ffffff;
      padding: 10px;
    }

    .report-container {
      width: 100%;
      max-width: 100%;
      margin: 0 auto;
    }

    /* Hospital Header */
    .header-banner {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 14px;
      background: #0284c7;
      color: #ffffff;
      border-radius: 6px;
      margin-bottom: 10px;
      border-bottom: 3px solid #0369a1;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .hospital-logo-badge {
      width: 36px;
      height: 36px;
      background: #ffffff;
      color: #0284c7;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
      font-weight: 800;
    }

    .hospital-title {
      font-size: 16px;
      font-weight: 800;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      line-height: 1.2;
    }

    .hospital-sub {
      font-size: 10px;
      opacity: 0.9;
    }

    .header-right {
      text-align: right;
    }

    .report-badge {
      display: inline-block;
      padding: 3px 8px;
      background: rgba(255, 255, 255, 0.2);
      border-radius: 4px;
      font-size: 11px;
      font-weight: 700;
      margin-bottom: 2px;
    }

    .gen-date {
      font-size: 9px;
      opacity: 0.85;
    }

    /* Info Grid */
    .info-grid {
      display: grid;
      grid-template-columns: ${showSalary ? '1.4fr 1.3fr 1.3fr' : '1.5fr 1.5fr'};
      gap: 8px;
      margin-bottom: 10px;
    }

    .info-card {
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      background: #f8fafc;
      padding: 8px 10px;
    }

    .card-heading {
      font-size: 10px;
      font-weight: 800;
      color: #0369a1;
      text-transform: uppercase;
      margin-bottom: 6px;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 3px;
    }

    .emp-name-row {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 4px;
    }

    .emp-name {
      font-size: 13px;
      font-weight: 800;
      color: #0f172a;
    }

    .status-badge {
      display: inline-block;
      padding: 1px 6px;
      border-radius: 10px;
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
    }

    .status-badge.working {
      background: #dcfce7;
      color: #15803d;
      border: 1px solid #86efac;
    }

    .status-badge.resigned {
      background: #fee2e2;
      color: #b91c1c;
      border: 1px solid #fca5a5;
    }

    .info-table {
      width: 100%;
      font-size: 10px;
      border-collapse: collapse;
    }

    .info-table td {
      padding: 2px 0;
    }

    .info-table td.label {
      color: #64748b;
      font-weight: 600;
      width: 42%;
    }

    .info-table td.val {
      color: #0f172a;
      font-weight: 700;
    }

    /* KPI Summary Boxes */
    .kpi-row {
      display: grid;
      grid-template-columns: repeat(${showSalary ? '5' : '4'}, 1fr);
      gap: 8px;
      margin-bottom: 10px;
    }

    .kpi-box {
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 6px 8px;
      background: #ffffff;
      text-align: center;
    }

    .kpi-box.highlight {
      background: #0284c7;
      color: #ffffff;
      border-color: #0369a1;
    }

    .kpi-title {
      font-size: 9px;
      font-weight: 700;
      color: #64748b;
      text-transform: uppercase;
      margin-bottom: 2px;
    }

    .kpi-box.highlight .kpi-title {
      color: #bae6fd;
    }

    .kpi-val {
      font-size: 15px;
      font-weight: 800;
      color: #0f172a;
      line-height: 1.2;
    }

    .kpi-box.highlight .kpi-val {
      color: #ffffff;
    }

    .kpi-sub {
      font-size: 8.5px;
      color: #64748b;
      margin-top: 2px;
    }

    .kpi-box.highlight .kpi-sub {
      color: #e0f2fe;
    }

    /* Special Rules Alert */
    .rules-alert {
      background: #fffbeb;
      border: 1px solid #fde68a;
      border-radius: 6px;
      padding: 5px 10px;
      margin-bottom: 10px;
      font-size: 9.5px;
      color: #92400e;
    }

    /* Attendance Data Table */
    .data-table-container {
      width: 100%;
      margin-bottom: 10px;
      overflow-x: visible;
    }

    .pdf-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 9px;
      table-layout: auto;
    }

    .pdf-table th {
      background: #f1f5f9;
      color: #334155;
      font-weight: 800;
      padding: 4px 3px;
      border: 1px solid #cbd5e1;
      text-align: center;
      text-transform: uppercase;
      font-size: 8px;
      letter-spacing: 0.2px;
      white-space: nowrap;
    }

    .pdf-table td {
      padding: 3px 3px;
      border: 1px solid #e2e8f0;
      color: #1e293b;
      white-space: nowrap;
      text-align: center;
    }

    .pdf-table td.num {
      text-align: right;
      font-variant-numeric: tabular-nums;
    }

    .pdf-table td.left {
      text-align: left;
    }

    .pdf-table tr:nth-child(even) {
      background: #f8fafc;
    }

    /* Status row highlights */
    .pdf-table tr.row-wo {
      background: #f0f9ff;
    }
    .pdf-table tr.row-wop {
      background: #f0fdfa;
    }
    .pdf-table tr.row-absent {
      background: #fff1f2;
    }

    .tbl-badge {
      display: inline-block;
      padding: 1px 4px;
      border-radius: 3px;
      font-size: 8px;
      font-weight: 700;
    }

    .tbl-badge.p { background: #dcfce7; color: #166534; }
    .tbl-badge.a { background: #fee2e2; color: #991b1b; }
    .tbl-badge.wo { background: #e0f2fe; color: #075985; }
    .tbl-badge.wop { background: #ccfbf1; color: #115e59; }

    .tbl-badge-late {
      background: #fef3c7;
      color: #92400e;
      font-weight: 700;
      padding: 1px 3px;
      border-radius: 3px;
    }

    .pdf-table tfoot td {
      background: #e2e8f0;
      font-weight: 800;
      color: #0f172a;
      border-top: 2px solid #94a3b8;
      border-bottom: 2px solid #94a3b8;
      padding: 4px 3px;
      font-size: 8.5px;
    }

    /* Signature Section */
    .signatures-box {
      margin-top: 14px;
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 20px;
      page-break-inside: avoid;
    }

    .sig-line-card {
      border: 1px dashed #94a3b8;
      border-radius: 4px;
      padding: 24px 10px 8px 10px;
      text-align: center;
      background: #fafafa;
    }

    .sig-title {
      font-size: 9.5px;
      font-weight: 700;
      color: #475569;
      text-transform: uppercase;
      border-top: 1px solid #cbd5e1;
      padding-top: 4px;
    }

    .sig-note {
      font-size: 8px;
      color: #94a3b8;
    }

    /* Footer */
    .report-footer {
      margin-top: 10px;
      display: flex;
      justify-content: space-between;
      font-size: 8px;
      color: #94a3b8;
      border-top: 1px solid #e2e8f0;
      padding-top: 4px;
    }

    @media print {
      body {
        padding: 0;
      }
      .no-print {
        display: none !important;
      }
    }
  </style>
</head>
<body>
  <div class="report-container">
    <!-- Top Hospital Header -->
    <div class="header-banner">
      <div class="header-left">
        <div class="hospital-logo-badge">✚</div>
        <div>
          <div class="hospital-title">${hospitalName}</div>
          <div class="hospital-sub">${hospitalSubtitle}</div>
        </div>
      </div>
      <div class="header-right">
        <div class="report-badge">STATEMENT FOR ${monthDisplay.toUpperCase()}</div>
        <div class="gen-date">Generated: ${generationDate} • Employee #${empCode}</div>
      </div>
    </div>

    <!-- Employee Profile & Shift Parameters Grid -->
    <div class="info-grid">
      <!-- Profile Card -->
      <div class="info-card">
        <div class="card-heading">Employee Profile</div>
        <div class="emp-name-row">
          <span class="emp-name">${empName}</span>
          <span class="status-badge ${isResigned ? 'resigned' : 'working'}">${emp.status || 'Working'}</span>
        </div>
        <table class="info-table">
          <tr>
            <td class="label">Employee Code:</td>
            <td class="val">#${empCode}</td>
          </tr>
          <tr>
            <td class="label">Department:</td>
            <td class="val">${emp.department || 'General'}</td>
          </tr>
          <tr>
            <td class="label">Designation:</td>
            <td class="val">${emp.designation || 'Staff'}</td>
          </tr>
          <tr>
            <td class="label">Date of Joining:</td>
            <td class="val">${emp.doj || 'N/A'}</td>
          </tr>
          <tr>
            <td class="label">Payment Mode:</td>
            <td class="val">${emp.payment_mode || 'Bank Transfer'}</td>
          </tr>
        </table>
      </div>

      <!-- Schedule & Master Rules Card -->
      <div class="info-card">
        <div class="card-heading">Master Schedule & Policies</div>
        <table class="info-table">
          <tr>
            <td class="label">Standard Shift:</td>
            <td class="val">${emp.standard_in_time || '09:00'} to ${emp.standard_out_time || '21:00'}</td>
          </tr>
          <tr>
            <td class="label">Target Work / Day:</td>
            <td class="val">${emp.standard_work_hours ? Number(emp.standard_work_hours).toFixed(2) : '12.00'} hrs</td>
          </tr>
          <tr>
            <td class="label">Standard Break:</td>
            <td class="val">${emp.standard_break_time || '00:00'} (${emp.standard_break_minutes || 0} mins)</td>
          </tr>
          <tr>
            <td class="label">Late Grace Window:</td>
            <td class="val">${emp.late_grace_minutes || 11} Minutes</td>
          </tr>
          <tr>
            <td class="label">Leaves (WOP / YPL):</td>
            <td class="val">${emp.wop || 0} WOP / ${emp.ypl || 0} YPL</td>
          </tr>
          <tr>
            <td class="label">Overtime Multiplier:</td>
            <td class="val">${emp.overtime_multiplier || 1.0}x</td>
          </tr>
        </table>
      </div>

      ${showSalary ? `
      <!-- Rates & Compensation Card -->
      <div class="info-card">
        <div class="card-heading">Salary Rates & Dynamics</div>
        <table class="info-table">
          <tr>
            <td class="label">Base Salary:</td>
            <td class="val" style="color: #059669; font-size: 11px;">${formatCurrency(emp.salary)}</td>
          </tr>
          <tr>
            <td class="label">Incentive:</td>
            <td class="val">${formatCurrency(emp.incentive || 0)}</td>
          </tr>
          <tr>
            <td class="label">Hourly Rate:</td>
            <td class="val">₹${summary.hourlyRate || 0}/hr</td>
          </tr>
          <tr>
            <td class="label">Daily Rate:</td>
            <td class="val">₹${summary.dailyRate || 0}/day (${summary.calendarDays || 30} days)</td>
          </tr>
          <tr>
            <td class="label">Working Days:</td>
            <td class="val">${summary.workingDaysInMonth || 0} Days</td>
          </tr>
        </table>
      </div>
      ` : ''}
    </div>

    ${showSpecialRules && emp.special_rules ? `
    <div class="rules-alert">
      <strong>Special Employee Rules & Remarks:</strong> ${emp.special_rules}
    </div>
    ` : ''}

    <!-- Performance & Monthly Summary KPI Grid -->
    <div class="kpi-row">
      <!-- Attendance Rate -->
      <div class="kpi-box">
        <div class="kpi-title">Attendance Rate</div>
        <div class="kpi-val" style="color: ${summary.attendancePercentage >= 90 ? '#16a34a' : (summary.attendancePercentage >= 75 ? '#d97706' : '#dc2626')}">
          ${summary.attendancePercentage || 0}%
        </div>
        <div class="kpi-sub">
          P: <strong>${summary.presentDays || 0}</strong> | WOP: <strong>${summary.weeklyOffPresentDays || 0}</strong> | A: <strong>${summary.absentDays || 0}</strong> | Off: <strong>${summary.weeklyOffDays || 0}</strong>
        </div>
      </div>

      <!-- Total Work Time -->
      <div class="kpi-box">
        <div class="kpi-title">Actual Work Hours</div>
        <div class="kpi-val">${summary.totalActualWorkFormatted || '00:00'} <span style="font-size: 10px; font-weight: normal;">hrs</span></div>
        <div class="kpi-sub">
          Target: ${summary.totalExpectedWorkFormatted || '00:00'} • Diff: <strong>${summary.totalWorkDiffFormatted || '00:00'}</strong>
        </div>
      </div>

      <!-- Late Arrivals -->
      <div class="kpi-box">
        <div class="kpi-title">Late Arrivals</div>
        <div class="kpi-val" style="color: ${(summary.lateDaysCount || 0) > 0 ? '#d97706' : '#16a34a'}">
          ${summary.totalLateFormatted || '00:00'} <span style="font-size: 10px; font-weight: normal;">hrs</span>
        </div>
        <div class="kpi-sub">
          ${summary.lateDaysCount || 0} Days Late ${showSalary ? `• Ded: -₹${summary.totalLateDeductions || 0}` : ''}
        </div>
      </div>

      <!-- Overtime -->
      <div class="kpi-box">
        <div class="kpi-title">Overtime (O.T.)</div>
        <div class="kpi-val" style="color: #16a34a;">
          ${summary.totalOvertimeFormatted || '00:00'} <span style="font-size: 10px; font-weight: normal;">hrs</span>
        </div>
        <div class="kpi-sub">
          ${showSalary ? `OT Pay: +₹${summary.totalOvertimePay || 0}` : `${emp.overtime_multiplier || 1}x Multiplier`}
        </div>
      </div>

      ${showSalary ? `
      <!-- Net Payable Salary Highlight Card -->
      <div class="kpi-box highlight">
        <div class="kpi-title">Net Payable Salary</div>
        <div class="kpi-val">${formatCurrency(summary.netPayableSalary)}</div>
        <div class="kpi-sub">
          Gross: ₹${summary.grossEarnedSalary || 0} • Ded: ₹${summary.totalDeductions || 0}
        </div>
      </div>
      ` : ''}
    </div>

    <!-- Attendance Breakdown Table -->
    <div class="data-table-container">
      <table class="pdf-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>P/A</th>
            <th>Mode</th>
            <th>Sched In</th>
            <th>Sched Out</th>
            <th>Target</th>
            <th>Std Brk</th>
            <th>Sched Wk</th>
            <th>Act In</th>
            <th>Act Out</th>
            <th>Duration</th>
            <th>Brk Out</th>
            <th>Brk In</th>
            <th>Eff Brk</th>
            <th>Actual Work</th>
            <th>Diff (+/-)</th>
            <th>Late</th>
            <th>O.T.</th>
            ${showSalary ? `
            <th>Rate</th>
            <th>Gross</th>
            <th>Late Ded</th>
            <th>OT Pay</th>
            <th style="background: #0284c7; color: #ffffff;">Net Salary</th>
            ` : ''}
          </tr>
        </thead>
        <tbody>
          ${records.map((r) => {
            const isWO = r.status_code === 'WO';
            const isWOP = r.status_code === 'WOP';
            const isAbsent = r.status_code === 'A';
            const isLate = r.is_late;
            const rowClass = isWO ? 'row-wo' : (isWOP ? 'row-wop' : (isAbsent ? 'row-absent' : ''));
            const badgeClass = isAbsent ? 'a' : (isWO ? 'wo' : (isWOP ? 'wop' : 'p'));

            return `
            <tr class="${rowClass}">
              <td style="font-weight: 700;">${r.attendance_date || r.attendance_date_iso}</td>
              <td><span class="tbl-badge ${badgeClass}">${r.status_code}</span></td>
              <td style="font-size: 7.5px; color: #64748b;">${r.calc_mode || 'Normal'}</td>
              <td>${r.scheduled_in_time || '—'}</td>
              <td>${r.scheduled_out_time || '—'}</td>
              <td>${r.scheduled_duration_formatted || '12:00'}</td>
              <td>${r.scheduled_break_formatted || '00:00'}</td>
              <td style="font-weight: 600;">${r.scheduled_work_formatted || '12:00'}</td>
              <td style="${isLate ? 'background: #fef3c7; color: #92400e; font-weight: 700;' : ''}">${r.actual_in_time || '—'}</td>
              <td>${r.actual_out_time || '—'}</td>
              <td style="font-weight: 600;">${r.actual_duration_formatted || '00:00'}</td>
              <td>${r.break_out || '—'}</td>
              <td>${r.break_in || '—'}</td>
              <td style="${r.effective_break_minutes > 0 ? 'font-weight: 600; color: #0284c7;' : ''}">${r.effective_break_minutes > 0 ? r.effective_break_formatted : '—'}</td>
              <td style="font-weight: 800; color: #0f172a;">${r.actual_work_formatted || '00:00'}</td>
              <td style="font-weight: 700; color: ${r.work_diff_minutes > 0 ? '#16a34a' : (r.work_diff_minutes < 0 ? '#dc2626' : '#64748b')}">
                ${r.work_diff_formatted || '00:00'}
              </td>
              <td>${isLate ? `<span class="tbl-badge-late">${r.late_formatted}</span>` : '—'}</td>
              <td style="${r.overtime_minutes > 0 ? 'font-weight: 700; color: #16a34a;' : ''}">${r.overtime_minutes > 0 ? r.overtime_formatted : '—'}</td>
              ${showSalary ? `
              <td class="num">₹${r.hourly_rate || 0}</td>
              <td class="num" style="font-weight: 600;">₹${r.daily_salary_earned || 0}</td>
              <td class="num" style="color: ${r.late_salary_deduction > 0 ? '#dc2626' : '#64748b'}; font-weight: ${r.late_salary_deduction > 0 ? '700' : 'normal'};">
                ${r.late_salary_deduction > 0 ? `-₹${r.late_salary_deduction}` : '—'}
              </td>
              <td class="num" style="color: ${r.overtime_pay > 0 ? '#16a34a' : '#64748b'}; font-weight: ${r.overtime_pay > 0 ? '700' : 'normal'};">
                ${r.overtime_pay > 0 ? `+₹${r.overtime_pay}` : '—'}
              </td>
              <td class="num" style="font-weight: 800; color: #0369a1; background: #e0f2fe;">
                ₹${r.net_daily_salary || 0}
              </td>
              ` : ''}
            </tr>
            `;
          }).join('')}
        </tbody>
        <tfoot>
          <tr>
            <td>TOTAL</td>
            <td>${summary.presentDays || 0}P/${summary.absentDays || 0}A</td>
            <td>—</td>
            <td>—</td>
            <td>—</td>
            <td>—</td>
            <td>—</td>
            <td>${summary.totalExpectedWorkFormatted || '00:00'}</td>
            <td>—</td>
            <td>—</td>
            <td>—</td>
            <td>—</td>
            <td>—</td>
            <td style="color: #0284c7;">${summary.totalActualBreakFormatted || '00:00'}</td>
            <td style="color: #0284c7; font-weight: 800;">${summary.totalActualWorkFormatted || '00:00'}</td>
            <td style="color: ${Number(summary.totalWorkDiffHours) >= 0 ? '#16a34a' : '#dc2626'};">
              ${summary.totalWorkDiffFormatted || '00:00'}
            </td>
            <td style="color: #d97706;">${summary.totalLateFormatted || '00:00'}</td>
            <td style="color: #16a34a;">${summary.totalOvertimeFormatted || '00:00'}</td>
            ${showSalary ? `
            <td>—</td>
            <td class="num">₹${summary.grossEarnedSalary || 0}</td>
            <td class="num" style="color: #dc2626;">-₹${summary.totalLateDeductions || 0}</td>
            <td class="num" style="color: #16a34a;">+₹${summary.totalOvertimePay || 0}</td>
            <td class="num" style="background: #0284c7; color: #ffffff; font-size: 10px;">
              ₹${summary.netPayableSalary || 0}
            </td>
            ` : ''}
          </tr>
        </tfoot>
      </table>
    </div>

    ${showSignatures ? `
    <!-- Signatures & Verification Block -->
    <div class="signatures-box">
      <div class="sig-line-card">
        <div class="sig-title">Employee Signature</div>
        <div class="sig-note">I confirm the attendance and calculations recorded above</div>
      </div>
      <div class="sig-line-card">
        <div class="sig-title">Prepared by (HR Executive)</div>
        <div class="sig-note">Verified with Biometric Access logs and approvals</div>
      </div>
      <div class="sig-line-card">
        <div class="sig-title">Authorized Signatory / Medical Director</div>
        <div class="sig-note">Approved for Monthly Payroll Release</div>
      </div>
    </div>
    ` : ''}

    <!-- Document Footer -->
    <div class="report-footer">
      <div>Global IVF Hospital Attendance Management System (AMS) • Confidential Document</div>
      <div>Employee: ${empName} (#${empCode}) • Month: ${monthDisplay} • Page 1 of 1</div>
    </div>
  </div>
</body>
</html>`;
};

/**
 * Triggers Browser Print to Save as PDF with exact landscape dimensions
 */
export const printEmployeeAttendance = (sheetData, options = {}) => {
  const html = generateEmployeeAttendanceHtml(sheetData, options);
  if (!html) return;

  const emp = sheetData?.employee || {};
  const summary = sheetData?.summary || {};
  const filename = `${emp.employee_code || 'Employee'}_${(emp.employee_name || 'Staff').replace(/\s+/g, '_')}_Attendance_${summary.month || 'Statement'}`;

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = 'none';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow.document;
  doc.open();
  doc.write(html);
  doc.close();

  // Set title for the browser print PDF default name
  iframe.contentWindow.document.title = filename;

  iframe.contentWindow.focus();
  setTimeout(() => {
    try {
      iframe.contentWindow.print();
    } catch (err) {
      console.error('Print failed:', err);
    } finally {
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 2000);
    }
  }, 400);
};

/**
 * Download Standalone HTML Document
 */
export const downloadEmployeeAttendanceHtml = (sheetData, options = {}) => {
  const html = generateEmployeeAttendanceHtml(sheetData, options);
  if (!html) return;

  const emp = sheetData?.employee || {};
  const summary = sheetData?.summary || {};
  const filename = `${emp.employee_code || 'Employee'}_${(emp.employee_name || 'Staff').replace(/\s+/g, '_')}_Attendance_${summary.month || 'Statement'}.html`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
