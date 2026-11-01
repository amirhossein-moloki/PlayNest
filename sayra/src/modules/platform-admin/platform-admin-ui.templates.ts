export const platformAdminDashboardTemplate = () => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PlayNest - Platform Superuser Administration</title>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <style>
    :root {
      --bg: #0b0f19;
      --card-bg: #151c2e;
      --border: #232f48;
      --text: #e2e8f0;
      --text-muted: #94a3b8;
      --primary: #6366f1;
      --primary-hover: #4f46e5;
      --accent: #ef4444;
      --success: #10b981;
      --warning: #f59e0b;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    body { background-color: var(--bg); color: var(--text); min-height: 100vh; display: flex; flex-direction: column; }
    .super-badge {
      background: linear-gradient(90deg, #b91c1c, #dc2626);
      color: white;
      text-align: center;
      padding: 8px 16px;
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      box-shadow: 0 2px 10px rgba(220, 38, 38, 0.4);
    }
    header {
      background: var(--card-bg);
      border-bottom: 1px solid var(--border);
      padding: 16px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .brand { font-size: 20px; font-weight: 800; display: flex; align-items: center; gap: 12px; }
    .brand i { color: var(--primary); }
    .nav-links { display: flex; gap: 16px; align-items: center; }
    .nav-links a { color: var(--text-muted); text-decoration: none; font-size: 14px; font-weight: 500; transition: color 0.2s; }
    .nav-links a:hover, .nav-links a.active { color: white; }
    .btn { padding: 8px 16px; border-radius: 6px; font-size: 14px; font-weight: 600; cursor: pointer; border: none; text-decoration: none; display: inline-flex; align-items: center; gap: 8px; }
    .btn-primary { background: var(--primary); color: white; }
    .btn-primary:hover { background: var(--primary-hover); }
    .btn-danger { background: var(--accent); color: white; }
    .btn-sm { padding: 4px 8px; font-size: 12px; }
    .container { max-width: 1400px; margin: 0 auto; padding: 24px; width: 100%; flex: 1; }
    .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-bottom: 24px; }
    .kpi-card { background: var(--card-bg); border: 1px solid var(--border); border-radius: 8px; padding: 20px; }
    .kpi-card .title { font-size: 13px; color: var(--text-muted); text-transform: uppercase; font-weight: 600; margin-bottom: 8px; }
    .kpi-card .val { font-size: 28px; font-weight: 700; color: white; }
    .section-title { font-size: 18px; font-weight: 700; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; }
    .card { background: var(--card-bg); border: 1px solid var(--border); border-radius: 8px; padding: 20px; margin-bottom: 24px; overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; text-align: left; }
    th { padding: 12px 16px; border-bottom: 1px solid var(--border); color: var(--text-muted); font-weight: 600; }
    td { padding: 12px 16px; border-bottom: 1px solid var(--border); color: var(--text); }
    tr:last-child td { border-bottom: none; }
    .badge { padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; }
    .badge-success { background: rgba(16, 185, 129, 0.15); color: var(--success); }
    .badge-danger { background: rgba(239, 68, 68, 0.15); color: var(--accent); }
    .badge-primary { background: rgba(99, 102, 241, 0.15); color: var(--primary); }
    .tabs { display: flex; gap: 8px; margin-bottom: 16px; border-bottom: 1px solid var(--border); padding-bottom: 8px; }
    .tab-btn { background: none; border: none; color: var(--text-muted); font-weight: 600; font-size: 14px; padding: 8px 16px; cursor: pointer; border-radius: 6px; }
    .tab-btn.active { background: var(--border); color: white; }
  </style>
</head>
<body>
  <div class="super-badge">
    <i class="fa-solid fa-shield-halved"></i> PLATFORM SUPERUSER — GLOBAL PLATFORM ADMINISTRATION
  </div>
  <header>
    <div class="brand">
      <i class="fa-solid fa-gamepad"></i> PlayNest Platform Administration
    </div>
    <div class="nav-links">
      <a href="/api/v1/platform-admin/dashboard" class="active"><i class="fa-solid fa-gauge"></i> Global Overview</a>
      <a href="/admin" target="_blank"><i class="fa-solid fa-newspaper"></i> Payload CMS</a>
      <button class="btn btn-danger btn-sm" onclick="logout()"><i class="fa-solid fa-right-from-bracket"></i> Logout</button>
    </div>
  </header>
  <main class="container">
    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="title">Total Gaming Centers</div>
        <div class="val" id="kpi-centers">-</div>
      </div>
      <div class="kpi-card">
        <div class="title">Active Centers</div>
        <div class="val" id="kpi-active-centers">-</div>
      </div>
      <div class="kpi-card">
        <div class="title">Total Stations</div>
        <div class="val" id="kpi-stations">-</div>
      </div>
      <div class="kpi-card">
        <div class="title">Total Reservations</div>
        <div class="val" id="kpi-reservations">-</div>
      </div>
      <div class="kpi-card">
        <div class="title">Gross Payments (IRR)</div>
        <div class="val" id="kpi-gmv">-</div>
      </div>
    </div>

    <div class="tabs">
      <button class="tab-btn active" onclick="switchTab('centers')"><i class="fa-solid fa-building"></i> Gaming Centers</button>
      <button class="tab-btn" onclick="switchTab('users')"><i class="fa-solid fa-users"></i> Global Users</button>
      <button class="tab-btn" onclick="switchTab('audit')"><i class="fa-solid fa-list-check"></i> System Audit Logs</button>
    </div>

    <div id="tab-centers" class="card">
      <div class="section-title"><i class="fa-solid fa-building"></i> Gaming Centers Across Platform</div>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Slug</th>
            <th>City</th>
            <th>Stations</th>
            <th>Staff Users</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody id="centers-table-body">
          <tr><td colspan="7">Loading gaming centers...</td></tr>
        </tbody>
      </table>
    </div>

    <div id="tab-users" class="card" style="display:none;">
      <div class="section-title"><i class="fa-solid fa-users"></i> All Users Across Platform</div>
      <table>
        <thead>
          <tr>
            <th>Full Name</th>
            <th>Phone</th>
            <th>Gaming Center</th>
            <th>Role</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody id="users-table-body">
          <tr><td colspan="6">Loading users...</td></tr>
        </tbody>
      </table>
    </div>

    <div id="tab-audit" class="card" style="display:none;">
      <div class="section-title"><i class="fa-solid fa-list-check"></i> Platform Audit Trail</div>
      <table>
        <thead>
          <tr>
            <th>Timestamp</th>
            <th>Actor</th>
            <th>Action</th>
            <th>Entity</th>
            <th>Entity ID</th>
            <th>Gaming Center</th>
          </tr>
        </thead>
        <tbody id="audit-table-body">
          <tr><td colspan="6">Loading audit trail...</td></tr>
        </tbody>
      </table>
    </div>
  </main>

  <script>
    const token = localStorage.getItem('platform_token');

    function headers() {
      return {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + (token || '')
      };
    }

    function switchTab(tab) {
      document.getElementById('tab-centers').style.display = tab === 'centers' ? 'block' : 'none';
      document.getElementById('tab-users').style.display = tab === 'users' ? 'block' : 'none';
      document.getElementById('tab-audit').style.display = tab === 'audit' ? 'block' : 'none';
      document.querySelectorAll('.tab-btn').forEach((btn, idx) => {
        btn.classList.toggle('active', (tab === 'centers' && idx === 0) || (tab === 'users' && idx === 1) || (tab === 'audit' && idx === 2));
      });
      if (tab === 'users') loadUsers();
      if (tab === 'audit') loadAudit();
    }

    async function loadData() {
      try {
        const [opsRes, finRes, centersRes] = await Promise.all([
          fetch('/api/v1/platform-admin/operations/overview', { headers: headers() }),
          fetch('/api/v1/platform-admin/financials/overview', { headers: headers() }),
          fetch('/api/v1/platform-admin/gaming-centers', { headers: headers() })
        ]);

        if (opsRes.status === 401 || opsRes.status === 403) {
          const authKey = prompt('Please enter your PLATFORM_ADMIN Bearer Token:');
          if (authKey) {
            localStorage.setItem('platform_token', authKey.replace('Bearer ', ''));
            window.location.reload();
          }
          return;
        }

        const ops = (await opsRes.json()).data;
        const fin = (await finRes.json()).data;
        const centers = (await centersRes.json()).data;

        document.getElementById('kpi-centers').innerText = ops.totalCenters;
        document.getElementById('kpi-stations').innerText = ops.totalStations;
        document.getElementById('kpi-reservations').innerText = ops.totalReservations;
        document.getElementById('kpi-gmv').innerText = Number(fin.totalCompletedAmount || 0).toLocaleString();

        const activeCount = centers.filter(c => c.isActive !== false).length;
        document.getElementById('kpi-active-centers').innerText = activeCount;

        const tbody = document.getElementById('centers-table-body');
        tbody.innerHTML = centers.map(c => \`
          <tr>
            <td><strong>\${c.name}</strong></td>
            <td><code>\${c.slug}</code></td>
            <td>\${c.city || '-'}</td>
            <td>\${c._count?.stations || 0}</td>
            <td>\${c._count?.users || 0}</td>
            <td><span class="badge \${c.isActive !== false ? 'badge-success' : 'badge-danger'}">\${c.isActive !== false ? 'ACTIVE' : 'INACTIVE'}</span></td>
            <td>
              <a href="/api/v1/admin/gamingCenters/\${c.id}/dashboard" target="_blank" class="btn btn-primary btn-sm"><i class="fa-solid fa-arrow-up-right-from-square"></i> Center View</a>
            </td>
          </tr>
        \`).join('');
      } catch (e) {
        console.error(e);
      }
    }

    async function loadUsers() {
      try {
        const res = await fetch('/api/v1/platform-admin/users?limit=50', { headers: headers() });
        const data = (await res.json()).data;
        const tbody = document.getElementById('users-table-body');
        tbody.innerHTML = data.map(u => \`
          <tr>
            <td>\${u.fullName}</td>
            <td>\${u.phone}</td>
            <td>\${u.gamingCenter?.name || '-'}</td>
            <td><span class="badge badge-primary">\${u.role}</span></td>
            <td><span class="badge \${u.isActive ? 'badge-success' : 'badge-danger'}">\${u.isActive ? 'ACTIVE' : 'DEACTIVATED'}</span></td>
            <td>
              <button class="btn btn-sm btn-danger" onclick="revokeSessions('\${u.id}')"><i class="fa-solid fa-ban"></i> Revoke Sessions</button>
            </td>
          </tr>
        \`).join('');
      } catch (e) {
        console.error(e);
      }
    }

    async function loadAudit() {
      try {
        const res = await fetch('/api/v1/platform-admin/audit-logs?limit=50', { headers: headers() });
        const data = (await res.json()).data;
        const tbody = document.getElementById('audit-table-body');
        tbody.innerHTML = data.map(l => \`
          <tr>
            <td>\${new Date(l.createdAt).toLocaleString()}</td>
            <td>\${l.platformAdmin?.fullName || l.user?.fullName || 'System'}</td>
            <td><code>\${l.action}</code></td>
            <td>\${l.entity}</td>
            <td>\${l.entityId}</td>
            <td>\${l.gamingCenter?.name || '-'}</td>
          </tr>
        \`).join('');
      } catch (e) {
        console.error(e);
      }
    }

    async function revokeSessions(userId) {
      if (!confirm('Revoke all active sessions for this user?')) return;
      await fetch('/api/v1/platform-admin/users/' + userId + '/revoke-sessions', {
        method: 'POST',
        headers: headers()
      });
      alert('Sessions revoked');
      loadUsers();
    }

    function logout() {
      localStorage.removeItem('platform_token');
      window.location.reload();
    }

    loadData();
  </script>
</body>
</html>`;
