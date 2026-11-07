export const platformAnalyticsDashboardTemplate = () => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PlayNest - Platform Analytics Dashboard</title>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <style>
    :root {
      --bg: #090d16;
      --card-bg: #111827;
      --card-hover: #1f2937;
      --border: #1f293d;
      --border-accent: #374151;
      --text: #f3f4f6;
      --text-muted: #9ca3af;
      --primary: #6366f1;
      --primary-hover: #4f46e5;
      --primary-glow: rgba(99, 102, 241, 0.25);
      --accent: #ef4444;
      --success: #10b981;
      --warning: #f59e0b;
      --info: #06b6d4;
      --surface: #182234;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
    body { background-color: var(--bg); color: var(--text); min-height: 100vh; display: flex; flex-direction: column; }

    .super-badge {
      background: linear-gradient(90deg, #1e1b4b, #312e81, #1e1b4b);
      border-bottom: 1px solid rgba(99, 102, 241, 0.3);
      color: #c7d2fe;
      text-align: center;
      padding: 8px 18px;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.5px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
    }

    header {
      background: var(--card-bg);
      border-bottom: 1px solid var(--border);
      padding: 16px 28px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;
    }
    .brand { font-size: 18px; font-weight: 800; display: flex; align-items: center; gap: 12px; color: white; }
    .brand i { color: var(--primary); font-size: 22px; }
    .brand span.tag { font-size: 11px; padding: 2px 8px; border-radius: 9999px; background: rgba(99,102,241,0.2); color: #a5b4fc; border: 1px solid rgba(99,102,241,0.4); font-weight: normal; }

    .nav-links { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
    .nav-links a { color: var(--text-muted); text-decoration: none; font-size: 13px; font-weight: 600; transition: color 0.2s, background-color 0.2s; padding: 6px 12px; border-radius: 6px; display: inline-flex; align-items: center; gap: 6px; }
    .nav-links a:hover, .nav-links a.active { color: white; background-color: var(--card-hover); }

    .btn { padding: 8px 14px; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer; border: none; text-decoration: none; display: inline-flex; align-items: center; gap: 8px; transition: all 0.2s; }
    .btn-primary { background: var(--primary); color: white; }
    .btn-primary:hover { background: var(--primary-hover); }
    .btn-secondary { background: var(--border-accent); color: white; }
    .btn-secondary:hover { background: #4b5563; }
    .btn-danger { background: var(--accent); color: white; }
    .btn-danger:hover { background: #dc2626; }
    .btn-sm { padding: 5px 10px; font-size: 12px; }

    .container { max-width: 1520px; margin: 0 auto; padding: 24px 20px; width: 100%; flex: 1; }

    /* Control & Filter Bar */
    .filter-panel {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 16px 20px;
      margin-bottom: 24px;
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
    }
    .filter-group { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    .filter-label { font-size: 12px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; }
    .quick-range-btn {
      background: var(--surface);
      color: var(--text-muted);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 6px 12px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }
    .quick-range-btn:hover { color: white; border-color: var(--border-accent); }
    .quick-range-btn.active { background: var(--primary); color: white; border-color: var(--primary); }

    .form-control-sm {
      background: var(--surface);
      border: 1px solid var(--border);
      color: white;
      padding: 6px 10px;
      border-radius: 6px;
      font-size: 12px;
    }
    .form-control-sm:focus { outline: none; border-color: var(--primary); }

    .freshness-info {
      font-size: 12px;
      color: var(--text-muted);
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--success);
      display: inline-block;
    }

    /* Sub Navigation Tabs */
    .section-tabs {
      display: flex;
      gap: 6px;
      margin-bottom: 22px;
      border-bottom: 1px solid var(--border);
      padding-bottom: 8px;
      overflow-x: auto;
      scrollbar-width: thin;
    }
    .sec-tab-btn {
      background: none;
      border: none;
      color: var(--text-muted);
      font-weight: 600;
      font-size: 13px;
      padding: 8px 16px;
      cursor: pointer;
      border-radius: 8px;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      white-space: nowrap;
      transition: all 0.2s;
    }
    .sec-tab-btn:hover { color: white; background-color: var(--card-hover); }
    .sec-tab-btn.active { background: var(--primary); color: white; box-shadow: 0 2px 8px var(--primary-glow); }

    /* KPI Cards */
    .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 16px; margin-bottom: 24px; }
    .kpi-card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 18px 20px;
      transition: transform 0.2s, border-color 0.2s;
      position: relative;
    }
    .kpi-card:hover { transform: translateY(-2px); border-color: var(--border-accent); }
    .kpi-card .kpi-header {
      font-size: 12px;
      color: var(--text-muted);
      text-transform: uppercase;
      font-weight: 600;
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .kpi-card .kpi-val { font-size: 24px; font-weight: 800; color: white; letter-spacing: -0.5px; }
    .kpi-card .kpi-sub { font-size: 12px; color: var(--text-muted); margin-top: 6px; display: flex; align-items: center; gap: 6px; }
    .kpi-card .currency { font-size: 12px; font-weight: 500; color: #94a3b8; margin-inline-start: 4px; }

    /* Cards & Layout */
    .card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 22px;
      margin-bottom: 24px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3);
    }
    .card-title {
      font-size: 16px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 16px;
      color: white;
    }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    .grid-3 { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 20px; }
    @media (max-width: 1024px) {
      .grid-2 { grid-template-columns: 1fr; }
    }

    /* Charts */
    .chart-container {
      width: 100%;
      height: 260px;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .chart-svg { width: 100%; height: 100%; overflow: visible; }

    /* Tables */
    table { width: 100%; border-collapse: collapse; font-size: 13px; text-align: left; }
    th { padding: 12px 14px; border-bottom: 1px solid var(--border); color: var(--text-muted); font-weight: 600; white-space: nowrap; }
    td { padding: 12px 14px; border-bottom: 1px solid var(--border); color: var(--text); vertical-align: middle; }
    tr:last-child td { border-bottom: none; }
    tr:hover td { background-color: rgba(255, 255, 255, 0.02); }

    .badge { padding: 4px 8px; border-radius: 5px; font-size: 11px; font-weight: 700; display: inline-flex; align-items: center; gap: 4px; }
    .badge-success { background: rgba(16, 185, 129, 0.15); color: var(--success); border: 1px solid rgba(16, 185, 129, 0.3); }
    .badge-danger { background: rgba(239, 68, 68, 0.15); color: var(--accent); border: 1px solid rgba(239, 68, 68, 0.3); }
    .badge-warning { background: rgba(245, 158, 11, 0.15); color: var(--warning); border: 1px solid rgba(245, 158, 11, 0.3); }
    .badge-info { background: rgba(6, 182, 212, 0.15); color: var(--info); border: 1px solid rgba(6, 182, 212, 0.3); }
    .badge-primary { background: rgba(99, 102, 241, 0.15); color: var(--primary); border: 1px solid rgba(99, 102, 241, 0.3); }

    .tooltip {
      position: relative;
      cursor: help;
      color: var(--text-muted);
      margin-inline-start: 6px;
    }

    .notice-box {
      background: rgba(99, 102, 241, 0.08);
      border: 1px solid rgba(99, 102, 241, 0.25);
      border-radius: 8px;
      padding: 12px 16px;
      font-size: 12px;
      color: #cbd5e1;
      display: flex;
      align-items: center;
      gap: 10px;
      margin-top: 14px;
    }

    /* Loading & Empty States */
    .state-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 48px 20px;
      color: var(--text-muted);
      text-align: center;
      gap: 12px;
    }
    .state-container i { font-size: 32px; opacity: 0.6; }

    /* Auth Modal */
    .auth-overlay {
      position: fixed;
      inset: 0;
      background: rgba(9, 13, 22, 0.88);
      backdrop-filter: blur(8px);
      display: none;
      justify-content: center;
      align-items: center;
      z-index: 1000;
      padding: 20px;
    }
    .auth-card {
      background: var(--card-bg);
      border: 1px solid var(--border-accent);
      border-radius: 14px;
      padding: 32px;
      width: 100%;
      max-width: 440px;
    }
    .auth-card h2 { font-size: 20px; margin-bottom: 8px; font-weight: 700; color: white; }
    .form-group { margin-bottom: 16px; }
    .form-group label { display: block; font-size: 12px; font-weight: 600; color: var(--text-muted); margin-bottom: 6px; }
    .form-control { width: 100%; background: var(--surface); border: 1px solid var(--border-accent); color: white; padding: 10px 14px; border-radius: 6px; font-size: 14px; }
    .form-control:focus { outline: none; border-color: var(--primary); }
    .btn-block { width: 100%; justify-content: center; padding: 11px; }

    #toast {
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: #1f293d;
      border: 1px solid var(--primary);
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      display: none;
      box-shadow: 0 10px 15px -3px rgba(0,0,0,0.5);
      z-index: 2000;
    }
  </style>
</head>
<body>
  <div class="super-badge">
    <i class="fa-solid fa-chart-line"></i>
    <span>PLAYNEST PLATFORM SUPERUSER — STANDALONE PLATFORM ANALYTICS</span>
  </div>

  <header>
    <div class="brand">
      <i class="fa-solid fa-gamepad"></i>
      <div>PlayNest Platform Administration</div>
      <span class="tag">Analytics Console</span>
    </div>
    <div class="nav-links">
      <a href="/api/v1/platform-admin/dashboard"><i class="fa-solid fa-gauge"></i> Global Overview</a>
      <a href="/api/v1/platform-admin/analytics/dashboard" class="active"><i class="fa-solid fa-chart-line"></i> Platform Analytics</a>
      <a href="/platform-admin-panel" target="_blank"><i class="fa-solid fa-layer-group"></i> AdminJS</a>
      <a href="/docs" target="_blank"><i class="fa-solid fa-book-open"></i> Swagger</a>
      <a href="/redoc" target="_blank"><i class="fa-solid fa-file-code"></i> ReDoc</a>
      <button class="btn btn-danger btn-sm" onclick="logout()"><i class="fa-solid fa-right-from-bracket"></i> Logout</button>
    </div>
  </header>

  <main class="container">
    <!-- Filters & Action Bar -->
    <div class="filter-panel">
      <div class="filter-group">
        <span class="filter-label"><i class="fa-regular fa-calendar"></i> Date Range:</span>
        <button class="quick-range-btn" onclick="setQuickRange('TODAY')">Today</button>
        <button class="quick-range-btn" onclick="setQuickRange('7D')">Last 7 Days</button>
        <button class="quick-range-btn active" onclick="setQuickRange('30D')">Last 30 Days</button>
        <button class="quick-range-btn" onclick="setQuickRange('90D')">Last 90 Days</button>
        <input type="date" id="filterStartDate" class="form-control-sm" title="Custom Start Date" onchange="onCustomDateChange()">
        <input type="date" id="filterEndDate" class="form-control-sm" title="Custom End Date" onchange="onCustomDateChange()">
      </div>

      <div class="filter-group">
        <span class="filter-label">Group By:</span>
        <select id="filterGroupBy" class="form-control-sm" onchange="applyFilters()">
          <option value="DAILY" selected>Daily</option>
          <option value="WEEKLY">Weekly</option>
          <option value="MONTHLY">Monthly</option>
        </select>

        <span class="filter-label">Center:</span>
        <select id="filterCenter" class="form-control-sm" onchange="applyFilters()" style="max-width: 180px;">
          <option value="">All Gaming Centers</option>
        </select>

        <label style="font-size: 12px; display: flex; align-items: center; gap: 4px; cursor: pointer;">
          <input type="checkbox" id="filterCompare" onchange="applyFilters()"> Compare Prev Period
        </label>

        <button class="btn btn-secondary btn-sm" onclick="applyFilters()"><i class="fa-solid fa-arrows-rotate"></i> Refresh</button>
      </div>

      <div class="freshness-info">
        <span class="status-dot"></span>
        <span id="refreshTimestamp">Awaiting data...</span>
      </div>
    </div>

    <!-- Analytics Section Tabs -->
    <div class="section-tabs">
      <button class="sec-tab-btn active" onclick="switchSection('overview')"><i class="fa-solid fa-gauge-high"></i> Overview Dashboard</button>
      <button class="sec-tab-btn" onclick="switchSection('financials')"><i class="fa-solid fa-coins"></i> Financial Analytics</button>
      <button class="sec-tab-btn" onclick="switchSection('performance')"><i class="fa-solid fa-trophy"></i> Gaming Center Performance</button>
      <button class="sec-tab-btn" onclick="switchSection('reservations')"><i class="fa-solid fa-calendar-check"></i> Reservation Analytics</button>
      <button class="sec-tab-btn" onclick="switchSection('users')"><i class="fa-solid fa-users"></i> User Analytics</button>
      <button class="sec-tab-btn" onclick="switchSection('devices')"><i class="fa-solid fa-tv"></i> Device Analytics</button>
    </div>

    <!-- Error State Box -->
    <div id="analyticsErrorState" class="card" style="display: none; border-color: var(--accent); background: rgba(239, 68, 68, 0.05);">
      <div class="card-title" style="color: var(--accent);"><i class="fa-solid fa-triangle-exclamation"></i> Analytics Request Failed</div>
      <p id="analyticsErrorMessage" style="font-size: 13px; color: #fca5a5; margin-bottom: 12px;">Failed to fetch analytics.</p>
      <button class="btn btn-secondary btn-sm" onclick="applyFilters()"><i class="fa-solid fa-arrow-rotate-right"></i> Retry Request</button>
    </div>

    <!-- Section A: Overview Dashboard -->
    <div id="sec-overview" class="analytics-section">
      <div class="kpi-grid">
        <div class="kpi-card">
          <div class="kpi-header"><span>Total Revenue</span><i class="fa-solid fa-money-bill-wave" style="color: var(--success);"></i></div>
          <div class="kpi-val" id="ov-revenue">-</div>
          <div class="kpi-sub" id="ov-revenue-diff"><i class="fa-solid fa-circle-info"></i> Paid minus refunds</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-header"><span>Net Revenue (Centers)</span><i class="fa-solid fa-building-columns" style="color: var(--info);"></i></div>
          <div class="kpi-val" id="ov-net-revenue">-</div>
          <div class="kpi-sub"><i class="fa-solid fa-percent"></i> After platform commission</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-header"><span>Total Reservations</span><i class="fa-solid fa-calendar-days" style="color: var(--warning);"></i></div>
          <div class="kpi-val" id="ov-reservations">-</div>
          <div class="kpi-sub" id="ov-reservations-diff">All reservation bookings</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-header"><span>Total Users</span><i class="fa-solid fa-users" style="color: var(--primary);"></i></div>
          <div class="kpi-val" id="ov-total-users">-</div>
          <div class="kpi-sub" id="ov-users-sub">Registered gamers</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-header"><span>Active Users</span><i class="fa-solid fa-user-check" style="color: var(--success);"></i></div>
          <div class="kpi-val" id="ov-active-users">-</div>
          <div class="kpi-sub">Booked in period</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-header"><span>Gaming Centers</span><i class="fa-solid fa-gamepad" style="color: var(--primary);"></i></div>
          <div class="kpi-val" id="ov-centers">-</div>
          <div class="kpi-sub"><span id="ov-active-centers">-</span> Active Centers</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-header"><span>Total Stations</span><i class="fa-solid fa-desktop" style="color: var(--info);"></i></div>
          <div class="kpi-val" id="ov-stations">-</div>
          <div class="kpi-sub">Platform-wide devices</div>
        </div>
      </div>

      <div class="grid-2">
        <div class="card">
          <div class="card-title">
            <span><i class="fa-solid fa-chart-line"></i> Revenue Trend (IRR)</span>
            <span class="badge badge-info">Payments Ingestion</span>
          </div>
          <div class="chart-container" id="chart-revenue-container"></div>
        </div>
        <div class="card">
          <div class="card-title">
            <span><i class="fa-solid fa-chart-bar"></i> Reservation Trends</span>
            <span class="badge badge-warning">Bookings</span>
          </div>
          <div class="chart-container" id="chart-reservations-container"></div>
        </div>
      </div>

      <div class="grid-2">
        <div class="card">
          <div class="card-title">
            <span><i class="fa-solid fa-trophy"></i> Top Performing Centers by Revenue</span>
          </div>
          <div id="top-centers-table-container">
            <table>
              <thead>
                <tr>
                  <th>Gaming Center</th>
                  <th>Status</th>
                  <th>Reservations</th>
                  <th>Revenue (IRR)</th>
                </tr>
              </thead>
              <tbody id="top-centers-tbody">
                <tr><td colspan="4" class="state-container"><i class="fa-solid fa-spinner fa-spin"></i> Loading rankings...</td></tr>
              </tbody>
            </table>
          </div>
        </div>
        <div class="card">
          <div class="card-title">
            <span><i class="fa-solid fa-user-plus"></i> Gamer Growth Trend</span>
            <span class="badge badge-primary">New Accounts</span>
          </div>
          <div class="chart-container" id="chart-users-container"></div>
        </div>
      </div>
    </div>

    <!-- Section B: Financial Analytics -->
    <div id="sec-financials" class="analytics-section" style="display: none;">
      <div class="kpi-grid">
        <div class="kpi-card">
          <div class="kpi-header"><span>Total Paid Volume</span><i class="fa-solid fa-circle-dollar-to-slot" style="color: var(--success);"></i></div>
          <div class="kpi-val" id="fin-paid">-</div>
          <div class="kpi-sub">Gross payment transactions</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-header"><span>Total Refunds</span><i class="fa-solid fa-arrow-rotate-left" style="color: var(--accent);"></i></div>
          <div class="kpi-val" id="fin-refunds">-</div>
          <div class="kpi-sub">Returned to customers</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-header"><span>Net Collected</span><i class="fa-solid fa-scale-balanced" style="color: var(--info);"></i></div>
          <div class="kpi-val" id="fin-net">-</div>
          <div class="kpi-sub">Gross minus refunds</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-header"><span>Platform Commission</span><i class="fa-solid fa-hand-holding-dollar" style="color: var(--warning);"></i></div>
          <div class="kpi-val" id="fin-commission">-</div>
          <div class="kpi-sub">Platform revenue share</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-header"><span>Center Net Revenue</span><i class="fa-solid fa-building" style="color: var(--primary);"></i></div>
          <div class="kpi-val" id="fin-center-rev">-</div>
          <div class="kpi-sub">Disbursable to tenants</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-header"><span>Average Order Value</span><i class="fa-solid fa-receipt" style="color: var(--info);"></i></div>
          <div class="kpi-val" id="fin-aov">-</div>
          <div class="kpi-sub">Per realized booking</div>
        </div>
      </div>

      <div class="grid-2">
        <div class="card">
          <div class="card-title">
            <span><i class="fa-solid fa-coins"></i> Financial Breakdown by Stream</span>
          </div>
          <div class="chart-container" id="chart-fin-breakdown-container"></div>
        </div>
        <div class="card">
          <div class="card-title">
            <span><i class="fa-solid fa-credit-card"></i> Payment Method Breakdown</span>
          </div>
          <div class="state-container" style="padding: 24px;">
            <i class="fa-solid fa-circle-nodes"></i>
            <p>Direct Gateway & Wallet Payment distribution is aggregated across platform ledgers.</p>
            <div class="notice-box">
              <i class="fa-solid fa-shield-halved"></i>
              <span>All payment volumes are tracked and strictly reported in Iranian Rials (IRR minor units). Multi-currency conversion is not permitted by backend policy.</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Section C: Gaming Center Performance -->
    <div id="sec-performance" class="analytics-section" style="display: none;">
      <div class="card">
        <div class="card-title">
          <span><i class="fa-solid fa-ranking-star"></i> Gaming Center Performance Matrix</span>
          <button class="btn btn-secondary btn-sm" onclick="applyFilters()"><i class="fa-solid fa-rotate"></i> Refresh Matrix</button>
        </div>
        <div style="overflow-x: auto;">
          <table>
            <thead>
              <tr>
                <th>Center Name</th>
                <th>Slug</th>
                <th>Operational Status</th>
                <th>Period Reservations</th>
                <th>Period Revenue (IRR)</th>
                <th>Direct Center Action</th>
              </tr>
            </thead>
            <tbody id="center-performance-tbody">
              <tr><td colspan="6" class="state-container"><i class="fa-solid fa-spinner fa-spin"></i> Loading center metrics...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Section D: Reservation Analytics -->
    <div id="sec-reservations" class="analytics-section" style="display: none;">
      <div class="kpi-grid">
        <div class="kpi-card">
          <div class="kpi-header"><span>Total Bookings</span><i class="fa-solid fa-calendar-check" style="color: var(--primary);"></i></div>
          <div class="kpi-val" id="res-total">-</div>
          <div class="kpi-sub">Created in period</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-header"><span>Completed Bookings</span><i class="fa-solid fa-flag-checkered" style="color: var(--success);"></i></div>
          <div class="kpi-val" id="res-completed">-</div>
          <div class="kpi-sub">Fulfillments</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-header"><span>Confirmed / In-Progress</span><i class="fa-solid fa-clock" style="color: var(--info);"></i></div>
          <div class="kpi-val" id="res-confirmed">-</div>
          <div class="kpi-sub">Active session states</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-header"><span>Cancelled Bookings</span><i class="fa-solid fa-ban" style="color: var(--accent);"></i></div>
          <div class="kpi-val" id="res-cancelled">-</div>
          <div class="kpi-sub">User & Admin cancellations</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-header"><span>Cancellation Rate</span><i class="fa-solid fa-percent" style="color: var(--accent);"></i></div>
          <div class="kpi-val" id="res-cancellation-rate">-</div>
          <div class="kpi-sub">Cancelled / Total</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-header"><span>Average Duration</span><i class="fa-solid fa-stopwatch" style="color: var(--warning);"></i></div>
          <div class="kpi-val" id="res-duration">-</div>
          <div class="kpi-sub">Hours per reservation</div>
        </div>
      </div>

      <div class="grid-2">
        <div class="card">
          <div class="card-title">
            <span><i class="fa-solid fa-chart-pie"></i> Reservation Status Distribution</span>
          </div>
          <div class="chart-container" id="chart-res-status-container"></div>
        </div>
        <div class="card">
          <div class="card-title">
            <span><i class="fa-solid fa-chart-line"></i> Reservation Volume Timeline</span>
          </div>
          <div class="chart-container" id="chart-res-timeline-container"></div>
        </div>
      </div>
    </div>

    <!-- Section E: User Analytics -->
    <div id="sec-users" class="analytics-section" style="display: none;">
      <div class="kpi-grid">
        <div class="kpi-card">
          <div class="kpi-header"><span>Total Platform Users</span><i class="fa-solid fa-users" style="color: var(--primary);"></i></div>
          <div class="kpi-val" id="usr-total">-</div>
          <div class="kpi-sub">Total registered customer accounts</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-header"><span>New Users</span><i class="fa-solid fa-user-plus" style="color: var(--success);"></i></div>
          <div class="kpi-val" id="usr-new">-</div>
          <div class="kpi-sub">Created in selected window</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-header"><span>Active Users</span><i class="fa-solid fa-user-check" style="color: var(--info);"></i></div>
          <div class="kpi-val" id="usr-active">-</div>
          <div class="kpi-sub">Unique reservation bookers</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-header"><span>Returning Users</span><i class="fa-solid fa-repeat" style="color: var(--warning);"></i></div>
          <div class="kpi-val" id="usr-returning">-</div>
          <div class="kpi-sub">Repeat reservation bookers</div>
        </div>
      </div>

      <div class="grid-2">
        <div class="card">
          <div class="card-title">
            <span><i class="fa-solid fa-chart-area"></i> Gamer Registration Timeline</span>
          </div>
          <div class="chart-container" id="chart-usr-growth-container"></div>
        </div>
        <div class="card">
          <div class="card-title">
            <span><i class="fa-solid fa-arrows-spin"></i> Platform Customer Retention Analysis</span>
          </div>
          <div class="state-container" style="padding: 24px;">
            <i class="fa-solid fa-database"></i>
            <p>Returning Users count is calculated deterministically from multi-booking history in the database.</p>
            <div class="notice-box">
              <i class="fa-solid fa-info-circle"></i>
              <span>Multi-cohort cross-tenant retention matrices are scoped to individual Gaming Center analytics endpoints and are omitted platform-wide in adherence to backend specifications.</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Section F: Device Analytics -->
    <div id="sec-devices" class="analytics-section" style="display: none;">
      <div class="kpi-grid">
        <div class="kpi-card">
          <div class="kpi-header"><span>Total Game Stations</span><i class="fa-solid fa-tv" style="color: var(--primary);"></i></div>
          <div class="kpi-val" id="dev-total">-</div>
          <div class="kpi-sub">Registered platform devices</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-header"><span>Active Gaming Centers</span><i class="fa-solid fa-building-circle-check" style="color: var(--success);"></i></div>
          <div class="kpi-val" id="dev-active-centers">-</div>
          <div class="kpi-sub">Centers hosting active stations</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-header"><span>Average Stations / Center</span><i class="fa-solid fa-calculator" style="color: var(--info);"></i></div>
          <div class="kpi-val" id="dev-avg-stations">-</div>
          <div class="kpi-sub">Device deployment density</div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">
          <span><i class="fa-solid fa-microchip"></i> Platform Device Infrastructure Notice</span>
        </div>
        <div class="state-container" style="padding: 24px;">
          <i class="fa-solid fa-server"></i>
          <p>Gaming stations across centers are categorized by PC, PS4, PS5, and Xbox.</p>
          <div class="notice-box">
            <i class="fa-solid fa-triangle-exclamation"></i>
            <span>Real-time device utilization telemetry and per-game execution hours require active station agent integration and are not fabricated when no direct stream is present.</span>
          </div>
        </div>
      </div>
    </div>
  </main>

  <!-- Login Modal -->
  <div id="authOverlay" class="auth-overlay">
    <div class="auth-card">
      <h2>Platform Super Admin Login</h2>
      <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 20px;">
        Authentication required to access platform-wide analytics.
      </p>
      <div id="authError" style="display:none; color: var(--accent); background: rgba(239, 68, 68, 0.1); border: 1px solid var(--accent); padding: 10px; border-radius: 6px; font-size: 13px; margin-bottom: 16px;"></div>
      <form id="loginForm" onsubmit="handleLogin(event)">
        <div class="form-group">
          <label for="adminPhone">Phone Number</label>
          <input type="text" id="adminPhone" class="form-control" placeholder="09123456789" required autocomplete="tel" />
        </div>
        <div class="form-group">
          <label for="adminPassword">Password</label>
          <input type="password" id="adminPassword" class="form-control" placeholder="••••••••" required autocomplete="current-password" />
        </div>
        <button type="submit" id="loginSubmitBtn" class="btn btn-primary btn-block">
          <i class="fa-solid fa-lock"></i> Sign In to Platform Console
        </button>
      </form>
    </div>
  </div>

  <div id="toast"></div>

  <script>
    var token = localStorage.getItem('platform_token');
    var activeSection = 'overview';
    var cachedGamingCenters = [];

    function headers() {
      return {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + (token || '')
      };
    }

    function showToast(msg, duration) {
      var toast = document.getElementById('toast');
      toast.textContent = msg;
      toast.style.display = 'block';
      setTimeout(function() { toast.style.display = 'none'; }, duration || 3000);
    }

    function showLoginModal(errorMessage) {
      var overlay = document.getElementById('authOverlay');
      var errorDiv = document.getElementById('authError');
      if (errorMessage) {
        errorDiv.textContent = errorMessage;
        errorDiv.style.display = 'block';
      } else {
        errorDiv.style.display = 'none';
      }
      overlay.style.display = 'flex';
      document.getElementById('adminPhone').focus();
    }

    function hideLoginModal() {
      document.getElementById('authOverlay').style.display = 'none';
    }

    async function handleLogin(e) {
      e.preventDefault();
      var phone = document.getElementById('adminPhone').value.trim();
      var password = document.getElementById('adminPassword').value;
      var btn = document.getElementById('loginSubmitBtn');
      var errorDiv = document.getElementById('authError');

      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Authenticating...';
      errorDiv.style.display = 'none';

      try {
        var response = await fetch('/api/v1/auth/platform-admin/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: phone, password: password })
        });

        var resData = await response.json();
        if (!response.ok) {
          throw new Error(resData.message || 'Invalid credentials or access denied');
        }

        var issuedToken = resData.data && resData.data.tokens ? resData.data.tokens.accessToken : (resData.data ? resData.data.token : resData.token);
        if (!issuedToken) {
          throw new Error('Authentication failed: Missing token in response');
        }

        token = issuedToken;
        localStorage.setItem('platform_token', token);
        hideLoginModal();
        initDashboard();
      } catch (err) {
        errorDiv.textContent = err.message || 'Authentication failed';
        errorDiv.style.display = 'block';
      } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-lock"></i> Sign In to Platform Console';
      }
    }

    function logout() {
      localStorage.removeItem('platform_token');
      token = null;
      showLoginModal('You have been logged out.');
    }

    function formatNumber(num) {
      if (num === null || num === undefined || isNaN(num)) return '-';
      return Number(num).toLocaleString();
    }

    function formatCurrency(num) {
      if (num === null || num === undefined || isNaN(num)) return '-';
      return Number(num).toLocaleString() + ' <span class="currency">IRR</span>';
    }

    function switchSection(secId) {
      activeSection = secId;
      var sections = ['overview', 'financials', 'performance', 'reservations', 'users', 'devices'];
      sections.forEach(function(s) {
        var el = document.getElementById('sec-' + s);
        if (el) el.style.display = s === secId ? 'block' : 'none';
      });

      document.querySelectorAll('.sec-tab-btn').forEach(function(btn) {
        btn.classList.remove('active');
        if (btn.getAttribute('onclick').indexOf(secId) !== -1) {
          btn.classList.add('active');
        }
      });
    }

    function setQuickRange(type) {
      document.querySelectorAll('.quick-range-btn').forEach(function(b) { b.classList.remove('active'); });
      var evtBtn = event ? event.currentTarget : null;
      if (evtBtn) evtBtn.classList.add('active');

      var now = new Date();
      var start = new Date();

      if (type === 'TODAY') {
        start.setHours(0, 0, 0, 0);
      } else if (type === '7D') {
        start.setDate(now.getDate() - 7);
      } else if (type === '30D') {
        start.setDate(now.getDate() - 30);
      } else if (type === '90D') {
        start.setDate(now.getDate() - 90);
      }

      document.getElementById('filterStartDate').value = start.toISOString().split('T')[0];
      document.getElementById('filterEndDate').value = now.toISOString().split('T')[0];

      applyFilters();
    }

    function onCustomDateChange() {
      document.querySelectorAll('.quick-range-btn').forEach(function(b) { b.classList.remove('active'); });
      applyFilters();
    }

    async function loadGamingCentersList() {
      try {
        var res = await fetch('/api/v1/platform-admin/gaming-centers?limit=100', { headers: headers() });
        if (!res.ok) return;
        var json = await res.json();
        var centers = Array.isArray(json.data) ? json.data : (json.data && json.data.items ? json.data.items : []);
        cachedGamingCenters = centers;
        var select = document.getElementById('filterCenter');
        var currentVal = select.value;
        select.innerHTML = '<option value="">All Gaming Centers</option>';
        centers.forEach(function(c) {
          var opt = document.createElement('option');
          opt.value = c.id;
          opt.textContent = c.name + (c.isActive ? '' : ' (Inactive)');
          select.appendChild(opt);
        });
        select.value = currentVal;
      } catch (e) {
        console.error('Failed loading centers dropdown', e);
      }
    }

    // High quality zero-dependency SVG Line/Bar charts
    function renderSvgLineChart(containerId, dataPoints, keyName, label, color) {
      var container = document.getElementById(containerId);
      if (!container) return;
      if (!dataPoints || dataPoints.length === 0) {
        container.innerHTML = '<div class="state-container"><i class="fa-solid fa-chart-line"></i><span>No timeline data points for this window</span></div>';
        return;
      }

      var maxVal = Math.max.apply(Math, dataPoints.map(function(d) { return d[keyName] || 0; })) || 1;
      var width = 600;
      var height = 240;
      var padLeft = 50;
      var padRight = 30;
      var padTop = 20;
      var padBottom = 40;

      var stepX = (width - padLeft - padRight) / Math.max(1, dataPoints.length - 1);
      var points = dataPoints.map(function(d, i) {
        var x = padLeft + i * stepX;
        var y = height - padBottom - ((d[keyName] || 0) / maxVal) * (height - padTop - padBottom);
        return { x: x, y: y, raw: d };
      });

      var pathD = 'M ' + points.map(function(p) { return p.x + ' ' + p.y; }).join(' L ');
      var areaD = pathD + ' L ' + points[points.length - 1].x + ' ' + (height - padBottom) + ' L ' + points[0].x + ' ' + (height - padBottom) + ' Z';

      var circles = points.map(function(p) {
        return '<circle cx="' + p.x + '" cy="' + p.y + '" r="4" fill="' + color + '"><title>' + p.raw.date + ': ' + Number(p.raw[keyName]).toLocaleString() + '</title></circle>';
      }).join('');

      var xLabels = '';
      var skip = Math.max(1, Math.floor(points.length / 5));
      for (var i = 0; i < points.length; i += skip) {
        xLabels += '<text x="' + points[i].x + '" y="' + (height - 10) + '" fill="#94a3b8" font-size="10" text-anchor="middle">' + points[i].raw.date.substring(5) + '</text>';
      }

      container.innerHTML = '<svg class="chart-svg" viewBox="0 0 ' + width + ' ' + height + '" preserveAspectRatio="none">' +
        '<line x1="' + padLeft + '" y1="' + padTop + '" x2="' + padLeft + '" y2="' + (height - padBottom) + '" stroke="#334155" stroke-width="1"/>' +
        '<line x1="' + padLeft + '" y1="' + (height - padBottom) + '" x2="' + (width - padRight) + '" y2="' + (height - padBottom) + '" stroke="#334155" stroke-width="1"/>' +
        '<path d="' + areaD + '" fill="' + color + '" fill-opacity="0.15" />' +
        '<path d="' + pathD + '" fill="none" stroke="' + color + '" stroke-width="2.5" />' +
        circles +
        xLabels +
        '<text x="' + (padLeft - 10) + '" y="' + (height - padBottom) + '" fill="#94a3b8" font-size="10" text-anchor="end">0</text>' +
        '<text x="' + (padLeft - 10) + '" y="' + (padTop + 10) + '" fill="#94a3b8" font-size="10" text-anchor="end">' + Number(maxVal).toLocaleString() + '</text>' +
      '</svg>';
    }

    function renderSvgBarChart(containerId, items) {
      var container = document.getElementById(containerId);
      if (!container) return;
      if (!items || items.length === 0) {
        container.innerHTML = '<div class="state-container"><i class="fa-solid fa-chart-column"></i><span>No comparison data points</span></div>';
        return;
      }

      var maxVal = Math.max.apply(Math, items.map(function(d) { return d.val || 0; })) || 1;
      var width = 500;
      var height = 240;
      var padLeft = 40;
      var padBottom = 30;
      var barWidth = Math.min(60, (width - padLeft) / items.length - 20);

      var bars = items.map(function(item, idx) {
        var x = padLeft + 20 + idx * (barWidth + 24);
        var barHeight = ((item.val || 0) / maxVal) * (height - padBottom - 30);
        var y = height - padBottom - barHeight;
        return '<rect x="' + x + '" y="' + y + '" width="' + barWidth + '" height="' + barHeight + '" fill="' + (item.color || '#6366f1') + '" rx="4"><title>' + item.label + ': ' + Number(item.val).toLocaleString() + '</title></rect>' +
          '<text x="' + (x + barWidth / 2) + '" y="' + (height - 10) + '" fill="#94a3b8" font-size="11" text-anchor="middle">' + item.label + '</text>' +
          '<text x="' + (x + barWidth / 2) + '" y="' + (y - 6) + '" fill="#ffffff" font-size="10" font-weight="bold" text-anchor="middle">' + Number(item.val).toLocaleString() + '</text>';
      }).join('');

      container.innerHTML = '<svg class="chart-svg" viewBox="0 0 ' + width + ' ' + height + '" preserveAspectRatio="none">' +
        '<line x1="' + padLeft + '" y1="' + (height - padBottom) + '" x2="' + width + '" y2="' + (height - padBottom) + '" stroke="#334155" stroke-width="1"/>' +
        bars +
      '</svg>';
    }

    async function applyFilters() {
      var startDate = document.getElementById('filterStartDate').value;
      var endDate = document.getElementById('filterEndDate').value;
      var groupBy = document.getElementById('filterGroupBy').value;
      var gamingCenterId = document.getElementById('filterCenter').value;
      var compare = document.getElementById('filterCompare').checked;

      var queryParts = [];
      if (startDate) queryParts.push('startDate=' + encodeURIComponent(new Date(startDate + 'T00:00:00.000Z').toISOString()));
      if (endDate) queryParts.push('endDate=' + encodeURIComponent(new Date(endDate + 'T23:59:59.999Z').toISOString()));
      if (groupBy) queryParts.push('groupBy=' + encodeURIComponent(groupBy));
      if (gamingCenterId) queryParts.push('gamingCenterId=' + encodeURIComponent(gamingCenterId));
      if (compare) queryParts.push('compare=true');

      var queryString = queryParts.length > 0 ? '?' + queryParts.join('&') : '';

      document.getElementById('analyticsErrorState').style.display = 'none';

      try {
        var res = await fetch('/api/v1/platform-admin/analytics/reports' + queryString, { headers: headers() });
        if (res.status === 401 || res.status === 403) {
          showLoginModal(res.status === 403 ? 'Access Denied: Platform superuser required.' : 'Session expired.');
          return;
        }

        if (!res.ok) {
          var errJson = await res.json().catch(function() { return {}; });
          throw new Error(errJson.message || 'Error fetching analytics report (HTTP ' + res.status + ')');
        }

        var json = await res.json();
        var data = json.data;
        renderAnalytics(data);
        document.getElementById('refreshTimestamp').textContent = 'Updated: ' + new Date().toLocaleTimeString();
      } catch (err) {
        console.error('Analytics load error', err);
        document.getElementById('analyticsErrorMessage').textContent = err.message || 'Network error fetching analytics.';
        document.getElementById('analyticsErrorState').style.display = 'block';
      }
    }

    function renderAnalytics(data) {
      if (!data) return;

      var fin = data.financials || {};
      var res = data.reservations || {};
      var usr = data.users || {};
      var gc = data.gamingCenters || {};
      var timeSeries = data.timeSeries || [];
      var topCenters = gc.topGamingCenters || [];

      // A. Overview Dashboard
      document.getElementById('ov-revenue').innerHTML = formatCurrency(fin.totalRevenue);
      document.getElementById('ov-net-revenue').innerHTML = formatCurrency(fin.gamingCentersRevenue);
      document.getElementById('ov-reservations').textContent = formatNumber(res.totalReservations);
      document.getElementById('ov-total-users').textContent = formatNumber(usr.totalUsers);
      document.getElementById('ov-active-users').textContent = formatNumber(usr.activeUsers);
      document.getElementById('ov-centers').textContent = formatNumber(gc.totalGamingCenters);
      document.getElementById('ov-active-centers').textContent = formatNumber(gc.activeGamingCenters);
      document.getElementById('ov-stations').textContent = formatNumber(gc.totalStations);

      renderSvgLineChart('chart-revenue-container', timeSeries, 'revenue', 'Revenue', '#10b981');
      renderSvgLineChart('chart-reservations-container', timeSeries, 'reservationCount', 'Reservations', '#f59e0b');
      renderSvgLineChart('chart-users-container', timeSeries, 'newUsers', 'New Users', '#6366f1');

      // Top Centers Table
      var topTbody = document.getElementById('top-centers-tbody');
      if (topCenters.length === 0) {
        topTbody.innerHTML = '<tr><td colspan="4" class="state-container"><i class="fa-solid fa-circle-exclamation"></i> No center activity recorded in this date range.</td></tr>';
      } else {
        topTbody.innerHTML = topCenters.map(function(c) {
          var statusBadge = c.isActive
            ? '<span class="badge badge-success"><i class="fa-solid fa-circle-check"></i> Active</span>'
            : '<span class="badge badge-danger"><i class="fa-solid fa-circle-xmark"></i> Inactive</span>';
          return '<tr>' +
            '<td><strong>' + (c.name || 'Unknown') + '</strong></td>' +
            '<td>' + statusBadge + '</td>' +
            '<td>' + formatNumber(c.reservationCount) + '</td>' +
            '<td>' + formatCurrency(c.revenue) + '</td>' +
          '</tr>';
        }).join('');
      }

      // B. Financial Analytics
      document.getElementById('fin-paid').innerHTML = formatCurrency(fin.totalPaidAmount);
      document.getElementById('fin-refunds').innerHTML = formatCurrency(fin.totalRefundAmount);
      document.getElementById('fin-net').innerHTML = formatCurrency(fin.totalRevenue);
      document.getElementById('fin-commission').innerHTML = formatCurrency(fin.platformCommission);
      document.getElementById('fin-center-rev').innerHTML = formatCurrency(fin.gamingCentersRevenue);
      document.getElementById('fin-aov').innerHTML = formatCurrency(fin.averageReservationValue);

      renderSvgBarChart('chart-fin-breakdown-container', [
        { label: 'Paid Volume', val: fin.totalPaidAmount || 0, color: '#10b981' },
        { label: 'Refunds', val: fin.totalRefundAmount || 0, color: '#ef4444' },
        { label: 'Platform Comm.', val: fin.platformCommission || 0, color: '#f59e0b' },
        { label: 'Center Net', val: fin.gamingCentersRevenue || 0, color: '#6366f1' }
      ]);

      // C. Gaming Center Performance
      var perfTbody = document.getElementById('center-performance-tbody');
      if (topCenters.length === 0 && cachedGamingCenters.length === 0) {
        perfTbody.innerHTML = '<tr><td colspan="6" class="state-container"><i class="fa-solid fa-building-circle-exclamation"></i> No centers found.</td></tr>';
      } else {
        var displayCenters = topCenters.length > 0 ? topCenters : cachedGamingCenters;
        perfTbody.innerHTML = displayCenters.map(function(c) {
          var statusBadge = c.isActive
            ? '<span class="badge badge-success"><i class="fa-solid fa-circle-check"></i> Active</span>'
            : '<span class="badge badge-danger"><i class="fa-solid fa-circle-xmark"></i> Inactive</span>';
          var resCount = c.reservationCount != null ? formatNumber(c.reservationCount) : '-';
          var revVal = c.revenue != null ? formatCurrency(c.revenue) : '-';
          return '<tr>' +
            '<td><strong>' + (c.name || 'Center') + '</strong></td>' +
            '<td><code>' + (c.slug || '-') + '</code></td>' +
            '<td>' + statusBadge + '</td>' +
            '<td>' + resCount + '</td>' +
            '<td>' + revVal + '</td>' +
            '<td><a href="/api/v1/platform-admin/dashboard" class="btn btn-secondary btn-sm"><i class="fa-solid fa-arrow-up-right-from-square"></i> Inspect Center</a></td>' +
          '</tr>';
        }).join('');
      }

      // D. Reservation Analytics
      document.getElementById('res-total').textContent = formatNumber(res.totalReservations);
      document.getElementById('res-completed').textContent = formatNumber(res.completedReservations);
      document.getElementById('res-confirmed').textContent = formatNumber(res.confirmedReservations);
      document.getElementById('res-cancelled').textContent = formatNumber(res.cancelledReservations);
      document.getElementById('res-cancellation-rate').textContent = (res.cancellationRate || 0) + ' %';
      document.getElementById('res-duration').textContent = (res.averageReservationDuration || 0) + ' hrs';

      renderSvgBarChart('chart-res-status-container', [
        { label: 'Confirmed', val: res.confirmedReservations || 0, color: '#06b6d4' },
        { label: 'Completed', val: res.completedReservations || 0, color: '#10b981' },
        { label: 'Cancelled', val: res.cancelledReservations || 0, color: '#ef4444' },
        { label: 'Pending', val: res.pendingReservations || 0, color: '#f59e0b' },
        { label: 'Expired', val: res.expiredReservations || 0, color: '#6b7280' }
      ]);
      renderSvgLineChart('chart-res-timeline-container', timeSeries, 'cancellationCount', 'Cancellations', '#ef4444');

      // E. User Analytics
      document.getElementById('usr-total').textContent = formatNumber(usr.totalUsers);
      document.getElementById('usr-new').textContent = formatNumber(usr.newUsers);
      document.getElementById('usr-active').textContent = formatNumber(usr.activeUsers);
      document.getElementById('usr-returning').textContent = formatNumber(usr.returningUsers);

      renderSvgLineChart('chart-usr-growth-container', timeSeries, 'newUsers', 'New Gamers', '#6366f1');

      // F. Device Analytics
      document.getElementById('dev-total').textContent = formatNumber(gc.totalStations);
      document.getElementById('dev-active-centers').textContent = formatNumber(gc.activeGamingCenters);
      document.getElementById('dev-avg-stations').textContent = formatNumber(gc.averageReservationsPerGamingCenter);
    }

    async function initDashboard() {
      // Set initial 30 days
      var now = new Date();
      var start = new Date();
      start.setDate(now.getDate() - 30);
      document.getElementById('filterStartDate').value = start.toISOString().split('T')[0];
      document.getElementById('filterEndDate').value = now.toISOString().split('T')[0];

      await loadGamingCentersList();
      await applyFilters();
    }

    if (!token) {
      showLoginModal();
    } else {
      initDashboard();
    }
  </script>
</body>
</html>`;
