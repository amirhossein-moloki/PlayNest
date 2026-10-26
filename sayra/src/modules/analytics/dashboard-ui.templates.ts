export const dashboardTemplate = (gamingCenterId: string) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Play-Nest Internal Management Dashboard</title>
    <style>
      :root {
        --bg-main: #f8fafc;
        --bg-card: #ffffff;
        --border-color: #e2e8f0;
        --text-primary: #0f172a;
        --text-secondary: #64748b;
        --primary: #2563eb;
        --primary-hover: #1d4ed8;
        --success: #16a34a;
        --warning: #d97706;
        --danger: #dc2626;
        --badge-bg: #eff6ff;
        --badge-text: #1d4ed8;
      }

      * { box-sizing: border-box; }

      body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
        margin: 0;
        background: var(--bg-main);
        color: var(--text-primary);
        line-height: 1.5;
      }

      header {
        background: var(--bg-card);
        border-bottom: 1px solid var(--border-color);
        padding: 20px 32px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 16px;
      }

      .header-title h1 {
        margin: 0;
        font-size: 22px;
        font-weight: 700;
        letter-spacing: -0.02em;
      }

      .header-title .subtitle {
        color: var(--text-secondary);
        font-size: 13px;
        margin-top: 2px;
      }

      .header-controls {
        display: flex;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;
      }

      .freshness-badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 6px 12px;
        border-radius: 9999px;
        font-size: 12px;
        font-weight: 600;
        border: 1px solid var(--border-color);
        background: #f1f5f9;
        color: var(--text-secondary);
      }

      .freshness-badge.fresh {
        background: #f0fdf4;
        color: var(--success);
        border-color: #bbf7d0;
      }

      .freshness-badge.stale {
        background: #fffbeb;
        color: var(--warning);
        border-color: #fde68a;
      }

      .freshness-indicator {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: currentColor;
      }

      .token-input {
        padding: 8px 12px;
        border-radius: 8px;
        border: 1px solid var(--border-color);
        font-size: 13px;
        width: 220px;
      }

      main {
        padding: 28px 32px 48px;
        max-width: 1400px;
        margin: 0 auto;
      }

      .toolbar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 16px;
        margin-bottom: 24px;
        background: var(--bg-card);
        padding: 16px 20px;
        border-radius: 12px;
        border: 1px solid var(--border-color);
      }

      .filter-group {
        display: flex;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;
      }

      .filter-group label {
        font-size: 13px;
        font-weight: 500;
        color: var(--text-secondary);
      }

      .filter-group input, .filter-group select {
        padding: 8px 12px;
        border-radius: 8px;
        border: 1px solid var(--border-color);
        background: #fff;
        font-size: 13px;
        color: var(--text-primary);
      }

      .btn {
        padding: 8px 16px;
        border-radius: 8px;
        border: 1px solid var(--border-color);
        background: #fff;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.15s ease;
      }

      .btn:hover {
        background: #f8fafc;
        border-color: #cbd5e1;
      }

      .btn-primary {
        background: var(--primary);
        color: #fff;
        border-color: var(--primary);
      }

      .btn-primary:hover {
        background: var(--primary-hover);
      }

      .grid-kpi {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 16px;
        margin-bottom: 24px;
      }

      .card {
        background: var(--bg-card);
        border: 1px solid var(--border-color);
        border-radius: 12px;
        padding: 20px;
        box-shadow: 0 1px 3px rgba(0,0,0,0.02);
      }

      .kpi-card .kpi-title {
        font-size: 12px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--text-secondary);
        margin-bottom: 8px;
      }

      .kpi-card .kpi-value {
        font-size: 26px;
        font-weight: 700;
        color: var(--text-primary);
        letter-spacing: -0.02em;
      }

      .kpi-card .kpi-subtext {
        font-size: 12px;
        color: var(--text-secondary);
        margin-top: 4px;
      }

      .grid-sections {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(420px, 1fr));
        gap: 20px;
        margin-bottom: 24px;
      }

      .section-title {
        font-size: 16px;
        font-weight: 600;
        margin: 0 0 16px 0;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      table {
        width: 100%;
        border-collapse: collapse;
        font-size: 13px;
      }

      th, td {
        padding: 10px 12px;
        text-align: left;
        border-bottom: 1px solid #f1f5f9;
      }

      th {
        color: var(--text-secondary);
        font-weight: 600;
        background: #f8fafc;
      }

      .amount-col {
        text-align: right;
        font-variant-numeric: tabular-nums;
      }

      .status-badge {
        display: inline-block;
        padding: 2px 8px;
        border-radius: 9999px;
        font-size: 11px;
        font-weight: 600;
      }

      .status-COMPLETED, .status-PAID, .status-SUCCESSFUL {
        background: #dcfce7;
        color: #15803d;
      }

      .status-CANCELED, .status-FAILED {
        background: #fee2e2;
        color: #b91c1c;
      }

      .status-PENDING, .status-IN_PROGRESS {
        background: #fef3c7;
        color: #b45309;
      }

      .loading-overlay {
        position: fixed;
        inset: 0;
        background: rgba(255,255,255,0.7);
        display: flex;
        justify-content: center;
        align-items: center;
        font-weight: 600;
        color: var(--primary);
        z-index: 50;
      }

      .error-box {
        background: #fef2f2;
        border: 1px solid #fecaca;
        color: #991b1b;
        padding: 12px 16px;
        border-radius: 8px;
        margin-bottom: 20px;
        font-size: 13px;
      }

      @media (max-width: 768px) {
        main { padding: 16px; }
        .grid-sections { grid-template-columns: 1fr; }
      }
    </style>
  </head>
  <body>
    <header>
      <div class="header-title">
        <h1>Internal Management Dashboard</h1>
        <div class="subtitle">GamingCenter ID: ${gamingCenterId} • Operational & Customer Analytics</div>
      </div>
      <div class="header-controls">
        <div id="freshnessBadge" class="freshness-badge">
          <span class="freshness-indicator"></span>
          <span id="freshnessText">Checking freshness...</span>
        </div>
        <input type="password" id="authToken" class="token-input" placeholder="Paste Auth Bearer Token" />
        <button id="refreshBtn" class="btn btn-primary">Refresh Data</button>
      </div>
    </header>

    <main>
      <div id="errorBox" class="error-box" style="display: none;"></div>

      <div class="toolbar">
        <div class="filter-group">
          <label for="startDate">Start Date:</label>
          <input type="date" id="startDate" />
          <label for="endDate">End Date:</label>
          <input type="date" id="endDate" />
          <button id="applyFilterBtn" class="btn">Apply Filter</button>
        </div>
        <div class="filter-group">
          <label for="currencyFilter">Currency:</label>
          <select id="currencyFilter">
            <option value="IRR">IRR (Rials)</option>
            <option value="IRT">IRT (Toman)</option>
          </select>
        </div>
      </div>

      <!-- KPI Summary Cards -->
      <div class="grid-kpi">
        <div class="card kpi-card">
          <div class="kpi-title">Total Revenue (Recognized)</div>
          <div class="kpi-value" id="kpiTotalRevenue">-</div>
          <div class="kpi-subtext" id="kpiAverageOrder">-</div>
        </div>
        <div class="card kpi-card">
          <div class="kpi-title">Realized Cash Collected</div>
          <div class="kpi-value" id="kpiRealizedCash">-</div>
          <div class="kpi-subtext">Gross paid payments</div>
        </div>
        <div class="card kpi-card">
          <div class="kpi-title">Active Customers</div>
          <div class="kpi-value" id="kpiActiveCustomers">-</div>
          <div class="kpi-subtext" id="kpiNewVsReturning">-</div>
        </div>
        <div class="card kpi-card">
          <div class="kpi-title">Repeat Visit Rate</div>
          <div class="kpi-value" id="kpiRepeatRate">-</div>
          <div class="kpi-subtext" id="kpiAvgDaysBetween">-</div>
        </div>
      </div>

      <!-- Phase 3 Customer Analytics Section -->
      <div class="grid-sections">
        <!-- Customer Segmentation -->
        <div class="card">
          <div class="section-title">Customer Segments</div>
          <table id="tblCustomerSegments">
            <thead>
              <tr>
                <th>Segment</th>
                <th>Description</th>
                <th class="amount-col">Customers</th>
              </tr>
            </thead>
            <tbody></tbody>
          </table>
        </div>

        <!-- Top Spenders -->
        <div class="card">
          <div class="section-title">
            Top Customer Spenders
            <span class="status-badge status-PAID">Masked PII</span>
          </div>
          <table id="tblTopSpenders">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Phone</th>
                <th>Visits</th>
                <th class="amount-col">Recorded Spend</th>
              </tr>
            </thead>
            <tbody></tbody>
          </table>
        </div>
      </div>

      <!-- Operations & Data Quality Health Section -->
      <div class="grid-sections">
        <!-- Operational Data Quality Checks -->
        <div class="card">
          <div class="section-title">
            Data Quality & Integrity Checks
            <span id="dataQualityScoreBadge" class="status-badge status-PAID">Score: 100%</span>
          </div>
          <table id="tblDataQualityChecks">
            <thead>
              <tr>
                <th>Check ID</th>
                <th>Title</th>
                <th>Severity</th>
                <th>Status</th>
                <th>Findings</th>
              </tr>
            </thead>
            <tbody></tbody>
          </table>
        </div>

        <!-- Customer Support SLA -->
        <div class="card">
          <div class="section-title">Customer Support SLA Performance</div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px;">
            <div style="background: var(--bg-main); padding: 12px; border-radius: 8px; text-align: center;">
              <div style="font-size: 11px; color: var(--text-secondary);">AVG FIRST RESPONSE</div>
              <div id="supportAvgResponse" style="font-size: 20px; font-weight: 700;">-</div>
            </div>
            <div style="background: var(--bg-main); padding: 12px; border-radius: 8px; text-align: center;">
              <div style="font-size: 11px; color: var(--text-secondary);">AVG RESOLUTION (CLOSED)</div>
              <div id="supportAvgResolution" style="font-size: 20px; font-weight: 700;">-</div>
            </div>
          </div>
          <div style="font-size: 12px; font-weight: 600; color: var(--text-secondary); margin-bottom: 8px;">TICKET STATUS BREAKDOWN</div>
          <table id="tblTicketStatus">
            <thead>
              <tr>
                <th>Status</th>
                <th class="amount-col">Count</th>
              </tr>
            </thead>
            <tbody></tbody>
          </table>
        </div>
      </div>

      <!-- Feature Adoption Section -->
      <div class="grid-sections">
        <div class="card" style="grid-column: span 2;">
          <div class="section-title">Product Feature Adoption</div>
          <table id="tblFeatureAdoption">
            <thead>
              <tr>
                <th>Feature</th>
                <th>Availability</th>
                <th>Adoption Status</th>
                <th>Usage Events</th>
                <th class="amount-col">Conversion / Metric</th>
              </tr>
            </thead>
            <tbody></tbody>
          </table>
        </div>
      </div>

      <!-- Phase 4 Financial Reconciliation & Audit Section -->
      <div class="grid-sections">
        <div class="card" style="grid-column: span 2;">
          <div class="section-title">
            Financial Reconciliation Diagnostics (Phase 4)
            <button id="runReconciliationBtn" class="btn btn-primary" style="font-size: 11px; padding: 4px 10px;">Run Audit Check</button>
          </div>
          <table id="tblReconciliationFindings">
            <thead>
              <tr>
                <th>Rule ID</th>
                <th>Rule Name</th>
                <th>Severity</th>
                <th>Status</th>
                <th>Source Record</th>
                <th>Details</th>
                <th class="amount-col">Expected / Actual</th>
              </tr>
            </thead>
            <tbody></tbody>
          </table>
        </div>
      </div>

      <!-- Financial & Operational Sections -->
      <div class="grid-sections">
        <!-- Financial Overview -->
        <div class="card">
          <div class="section-title">
            Financial Breakdown
            <span id="financialCurrencyBadge" class="status-badge status-PAID">IRR</span>
          </div>
          <table>
            <tbody>
              <tr>
                <td>Gross Collected (Paid Payments)</td>
                <td class="amount-col" id="finGrossCollected">-</td>
              </tr>
              <tr>
                <td>Total Refunded</td>
                <td class="amount-col" id="finTotalRefunded" style="color: var(--danger);">-</td>
              </tr>
              <tr>
                <td><strong>Net Cash Collected</strong></td>
                <td class="amount-col"><strong id="finNetCollected">-</strong></td>
              </tr>
            </tbody>
          </table>

          <div style="margin-top: 16px;">
            <div style="font-size: 12px; font-weight: 600; color: var(--text-secondary); margin-bottom: 8px;">PAYMENT METHODS</div>
            <table id="tblPaymentMethods">
              <thead>
                <tr>
                  <th>Method</th>
                  <th>Count</th>
                  <th class="amount-col">Amount</th>
                </tr>
              </thead>
              <tbody></tbody>
            </table>
          </div>
        </div>

        <!-- Station Performance -->
        <div class="card">
          <div class="section-title">Game Station Utilization</div>
          <table id="tblStationPerformance">
            <thead>
              <tr>
                <th>Station</th>
                <th>Type</th>
                <th>Booked Hours</th>
                <th>Utilization</th>
                <th class="amount-col">Revenue</th>
              </tr>
            </thead>
            <tbody></tbody>
          </table>
        </div>
      </div>

      <div class="grid-sections">
        <!-- Operations (Waitlist & Notifications) -->
        <div class="card">
          <div class="section-title">Operational Health</div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px;">
            <div style="background: var(--bg-main); padding: 12px; border-radius: 8px; text-align: center;">
              <div style="font-size: 11px; color: var(--text-secondary);">WAITLIST CONVERSION</div>
              <div id="waitlistConversionRate" style="font-size: 20px; font-weight: 700;">-</div>
            </div>
            <div style="background: var(--bg-main); padding: 12px; border-radius: 8px; text-align: center;">
              <div style="font-size: 11px; color: var(--text-secondary);">SMS FAILURE RATE</div>
              <div id="notificationFailureRate" style="font-size: 20px; font-weight: 700;">-</div>
            </div>
          </div>
          <div style="font-size: 12px; font-weight: 600; color: var(--text-secondary); margin-bottom: 8px;">STAFF PERFORMANCE</div>
          <table id="tblStaffPerformance">
            <thead>
              <tr>
                <th>Staff</th>
                <th>Completed Res</th>
                <th>Avg Rating</th>
                <th class="amount-col">Revenue</th>
              </tr>
            </thead>
            <tbody></tbody>
          </table>
        </div>

        <!-- Data Ingestion Details -->
        <div class="card">
          <div class="section-title">Analytics Ingestion Pipeline</div>
          <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 12px;">
            Last Ingested: <span id="pipelineLastIngested" style="font-weight: 600; color: var(--text-primary);">-</span>
          </div>
          <table id="tblWatermarks">
            <thead>
              <tr>
                <th>Entity</th>
                <th>Watermark Position</th>
              </tr>
            </thead>
            <tbody></tbody>
          </table>
        </div>
      </div>
    </main>

    <div id="loadingOverlay" class="loading-overlay" style="display: none;">
      Loading Dashboard Metrics...
    </div>

    <script>
      const gamingCenterId = '${gamingCenterId}';
      const authTokenInput = document.getElementById('authToken');
      const errorBox = document.getElementById('errorBox');
      const loadingOverlay = document.getElementById('loadingOverlay');

      // Date Defaults (Last 30 days)
      const endDateInput = document.getElementById('endDate');
      const startDateInput = document.getElementById('startDate');
      const today = new Date().toISOString().split('T')[0];
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      endDateInput.value = today;
      startDateInput.value = thirtyDaysAgo;

      // Token Persistence
      const storedToken = localStorage.getItem('sayraAdminToken');
      if (storedToken) authTokenInput.value = storedToken;
      authTokenInput.addEventListener('change', () => {
        localStorage.setItem('sayraAdminToken', authTokenInput.value.trim());
      });

      function formatIRR(amount) {
        return (amount || 0).toLocaleString('fa-IR') + ' Rial';
      }

      function getAuthHeaders() {
        const token = authTokenInput.value.trim();
        return token ? { 'Authorization': 'Bearer ' + token } : {};
      }

      async function fetchAPI(endpoint) {
        const res = await fetch('/api/v1/gamingCenters/' + gamingCenterId + '/analytics' + endpoint, {
          headers: getAuthHeaders()
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ message: res.statusText }));
          throw new Error(err.message || 'API Request failed');
        }
        return (await res.json()).data;
      }

      async function loadDashboard() {
        errorBox.style.display = 'none';
        loadingOverlay.style.display = 'flex';

        const start = startDateInput.value;
        const end = endDateInput.value;
        const query = '?startDate=' + start + '&endDate=' + end;

        try {
          const [summary, custSummary, custSegments, custSpenders, financials, reconciliation, stations, waitlist, notifications, staff, ingestion, dq, supportSla, featureAdoption] = await Promise.all([
            fetchAPI('/summary' + query),
            fetchAPI('/customers/summary' + query),
            fetchAPI('/customers/segmentation' + query),
            fetchAPI('/customers/top-spenders' + query),
            fetchAPI('/financials/overview' + query),
            fetchAPI('/financials/reconciliation' + query),
            fetchAPI('/stations' + query),
            fetchAPI('/operations/waitlist' + query),
            fetchAPI('/operations/notifications' + query),
            fetchAPI('/staff' + query),
            fetchAPI('/ingestion-status'),
            fetchAPI('/operations/data-quality').catch(() => null),
            fetchAPI('/operations/support' + query).catch(() => null),
            fetchAPI('/operations/feature-adoption' + query).catch(() => null)
          ]);

          // Render Data Quality Checks
          if (dq) {
            document.getElementById('dataQualityScoreBadge').textContent = 'Quality Score: ' + (dq.qualityScore || 100) + '%';
            const tblDq = document.querySelector('#tblDataQualityChecks tbody');
            tblDq.innerHTML = (dq.checks || []).map(c => \`
              <tr>
                <td><strong>\${c.checkId}</strong></td>
                <td>\${c.title}</td>
                <td><span class="status-badge \${c.severity === 'HIGH' ? 'status-FAILED' : 'status-PENDING'}">\${c.severity}</span></td>
                <td><span class="status-badge \${c.status === 'PASSED' ? 'status-COMPLETED' : 'status-FAILED'}">\${c.status}</span></td>
                <td>\${c.findingCount} findings</td>
              </tr>
            \`).join('') || '<tr><td colspan="5" style="text-align:center; color:#15803d;">✓ All data quality checks passed</td></tr>';
          }

          // Render Support SLA
          if (supportSla) {
            document.getElementById('supportAvgResponse').textContent = (supportSla.slaMetrics?.avgFirstResponseMinutes || 0) + ' min';
            document.getElementById('supportAvgResolution').textContent = (supportSla.slaMetrics?.avgResolutionMinutes || 0) + ' min';
            const tblTicket = document.querySelector('#tblTicketStatus tbody');
            tblTicket.innerHTML = Object.entries(supportSla.statusDistribution || {}).map(([st, cnt]) => \`
              <tr>
                <td>\${st.toUpperCase()}</td>
                <td class="amount-col">\${cnt}</td>
              </tr>
            \`).join('');
          }

          // Render Feature Adoption
          if (featureAdoption) {
            const tblFa = document.querySelector('#tblFeatureAdoption tbody');
            tblFa.innerHTML = (featureAdoption.features || []).map(f => \`
              <tr>
                <td><strong>\${f.title}</strong></td>
                <td><span class="status-badge status-PAID">\${f.availability}</span></td>
                <td><span class="status-badge \${f.adoptionStatus === 'ADOPTED' ? 'status-COMPLETED' : 'status-PENDING'}">\${f.adoptionStatus}</span></td>
                <td>\${f.usageEventsCount || f.activeCampaignsCount || 0}</td>
                <td class="amount-col">\${f.conversionRate != null ? f.conversionRate + '%' : f.averageScore ? f.averageScore + ' ★' : '-'}</td>
              </tr>
            \`).join('');
          }

          // Freshness Badge
          const badge = document.getElementById('freshnessBadge');
          const freshnessText = document.getElementById('freshnessText');
          if (ingestion.status === 'FRESH') {
            badge.className = 'freshness-badge fresh';
            freshnessText.textContent = 'Data Fresh (~' + (ingestion.lastIngestedAt ? new Date(ingestion.lastIngestedAt).toLocaleTimeString() : 'Recent') + ')';
          } else {
            badge.className = 'freshness-badge stale';
            freshnessText.textContent = 'Data Stale';
          }

          // Summary KPIs
          document.getElementById('kpiTotalRevenue').textContent = formatIRR(summary.totalRevenue);
          document.getElementById('kpiAverageOrder').textContent = 'Avg order: ' + formatIRR(summary.averageReservationValue);
          document.getElementById('kpiRealizedCash').textContent = formatIRR(summary.realizedCash);

          // Phase 3 Customer KPIs
          document.getElementById('kpiActiveCustomers').textContent = custSummary.activeCustomers;
          document.getElementById('kpiNewVsReturning').textContent = custSummary.newCustomers + ' new • ' + custSummary.returningCustomers + ' returning';
          document.getElementById('kpiRepeatRate').textContent = custSummary.repeatVisitRate + '%';
          document.getElementById('kpiAvgDaysBetween').textContent = 'Avg ' + custSummary.avgDaysBetweenVisits + ' days between visits';

          // Customer Segments Table
          const tblSegments = document.querySelector('#tblCustomerSegments tbody');
          tblSegments.innerHTML = (custSegments.segments || []).map(s => \`
            <tr>
              <td><strong>\${s.title}</strong></td>
              <td style="color: var(--text-secondary);">\${s.description}</td>
              <td class="amount-col">\${s.count}</td>
            </tr>
          \`).join('') || '<tr><td colspan="3" style="text-align:center; color:#94a3b8;">No segments available</td></tr>';

          // Top Spenders Table
          const tblSpenders = document.querySelector('#tblTopSpenders tbody');
          tblSpenders.innerHTML = (custSpenders.topSpenders || []).map(sp => \`
            <tr>
              <td>\${sp.fullName || 'Anonymous Customer'}</td>
              <td>\${sp.phone}</td>
              <td>\${sp.visits} visits</td>
              <td class="amount-col">\${formatIRR(sp.totalSpend)}</td>
            </tr>
          \`).join('') || '<tr><td colspan="4" style="text-align:center; color:#94a3b8;">No customer spend records</td></tr>';

          // Financials Overview
          const paidPaymentsSum = (financials.payments || []).filter(p => p.status === 'PAID').reduce((acc, p) => acc + p.totalAmount, 0);
          const refundsSum = (financials.refunds || []).filter(r => r.status === 'SUCCESSFUL').reduce((acc, r) => acc + r.totalAmount, 0);
          document.getElementById('finGrossCollected').textContent = formatIRR(paidPaymentsSum);
          document.getElementById('finTotalRefunded').textContent = formatIRR(refundsSum);
          document.getElementById('finNetCollected').textContent = formatIRR(paidPaymentsSum - refundsSum);

          const tblMethods = document.querySelector('#tblPaymentMethods tbody');
          tblMethods.innerHTML = (financials.payments || []).map(m => \`
            <tr>
              <td>\${m.status}</td>
              <td>\${m.count}</td>
              <td class="amount-col">\${formatIRR(m.totalAmount)}</td>
            </tr>
          \`).join('') || '<tr><td colspan="3" style="text-align:center; color:#94a3b8;">No payment records</td></tr>';

          // Reconciliation Table
          const tblFindings = document.querySelector('#tblReconciliationFindings tbody');
          tblFindings.innerHTML = (reconciliation.findings || []).map(f => \`
            <tr>
              <td><strong>\${f.ruleId}</strong></td>
              <td>\${f.ruleName}</td>
              <td><span class="status-badge \${f.severity === 'HIGH' ? 'status-FAILED' : 'status-PENDING'}">\${f.severity}</span></td>
              <td><span class="status-badge status-PENDING">\${f.status}</span></td>
              <td>\${f.sourceEntity} (\${f.sourceId.substring(0, 8)}...)</td>
              <td style="color: var(--text-secondary); max-width: 300px;">\${f.details}</td>
              <td class="amount-col">\${formatIRR(f.expectedAmount || 0)} / \${formatIRR(f.actualAmount || 0)}</td>
            </tr>
          \`).join('') || '<tr><td colspan="7" style="text-align:center; color:#15803d; font-weight:600; padding:16px;">✓ No financial discrepancies or reconciliation findings detected</td></tr>';

          // Stations
          const tblStations = document.querySelector('#tblStationPerformance tbody');
          tblStations.innerHTML = (stations || []).map(s => \`
            <tr>
              <td>\${s.stationName}</td>
              <td>\${s.stationType}</td>
              <td>\${s.totalHoursBooked} hrs</td>
              <td>\${s.utilizationRate}%</td>
              <td class="amount-col">\${formatIRR(s.revenue)}</td>
            </tr>
          \`).join('') || '<tr><td colspan="5" style="text-align:center; color:#94a3b8;">No stations found</td></tr>';

          // Operations
          document.getElementById('waitlistConversionRate').textContent = waitlist.conversionRate + '%';
          document.getElementById('notificationFailureRate').textContent = notifications.failureRate + '%';

          const tblStaff = document.querySelector('#tblStaffPerformance tbody');
          tblStaff.innerHTML = (staff || []).map(st => \`
            <tr>
              <td>\${st.staffName}</td>
              <td>\${st.reservationCount}</td>
              <td>\${st.averageRating || '-'} ★</td>
              <td class="amount-col">\${formatIRR(st.revenue)}</td>
            </tr>
          \`).join('') || '<tr><td colspan="4" style="text-align:center; color:#94a3b8;">No staff activity recorded</td></tr>';

          // Ingestion Pipeline
          document.getElementById('pipelineLastIngested').textContent = ingestion.lastIngestedAt ? new Date(ingestion.lastIngestedAt).toLocaleString() : 'Never';
          const tblWatermarks = document.querySelector('#tblWatermarks tbody');
          tblWatermarks.innerHTML = (ingestion.watermarks || []).map(w => \`
            <tr>
              <td>\${w.entity}</td>
              <td>\${new Date(w.lastIngestedAt).toLocaleString()}</td>
            </tr>
          \`).join('');

        } catch (err) {
          errorBox.style.display = 'block';
          errorBox.textContent = 'Dashboard load failed: ' + err.message;
        } finally {
          loadingOverlay.style.display = 'none';
        }
      }

      document.getElementById('refreshBtn').addEventListener('click', loadDashboard);
      document.getElementById('applyFilterBtn').addEventListener('click', loadDashboard);

      // Initial load
      loadDashboard();
    </script>
  </body>
</html>`;
