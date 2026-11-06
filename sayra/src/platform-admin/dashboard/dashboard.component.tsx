import React from 'react';
import { Box, H2, H4, Text, Badge, Table, TableHead, TableRow, TableCell, TableBody } from '@adminjs/design-system';

interface QueueMetrics {
  name: string;
  waiting: number;
  active: number;
  failed: number;
  delayed: number;
  status: 'HEALTHY' | 'DEGRADED';
}

interface DashboardProps {
  data?: {
    totalGamingCenters: number;
    totalUsers: number;
    totalManagers: number;
    reservations: {
      total: number;
      confirmed: number;
      completed: number;
      canceled: number;
      todayTotal: number;
      todayConfirmed: number;
      todayActive: number;
      todayCanceled: number;
    };
    financials: {
      todayRevenue: number;
      monthRevenue: number;
      totalVolume: number;
      successfulCount: number;
      failedCount: number;
      pendingRefundsCount: number;
      pendingRefundsAmount: number;
    };
    payments: {
      totalVolume: number;
      successfulCount: number;
      failedCount: number;
    };
    recentAuditLogs: Array<{
      id: string;
      action: string;
      entity: string;
      entityId: string;
      createdAt: string;
    }>;
    health: {
      database: { status: 'UP' | 'DOWN'; latencyMs: number };
      redis: { status: 'UP' | 'DOWN'; latencyMs: number };
      queues?: {
        sms: QueueMetrics;
        analytics: QueueMetrics;
        cmsMedia: QueueMetrics;
        reminders: QueueMetrics;
      };
      timestamp: string;
    };
  };
}

const cardStyle: React.CSSProperties = {
  backgroundColor: '#ffffff',
  borderRadius: '8px',
  padding: '24px',
  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
};

const metricTitleStyle: React.CSSProperties = {
  fontSize: '13px',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: '#6b7280',
  marginBottom: '8px',
  fontWeight: 600,
};

const metricValueStyle: React.CSSProperties = {
  fontSize: '28px',
  fontWeight: 700,
  color: '#111827',
  lineHeight: 1.2,
};

const Dashboard: React.FC<DashboardProps> = ({ data }) => {
  if (!data) {
    return (
      <Box p="xl">
        <Text>Loading PlayNest Platform Metrics...</Text>
      </Box>
    );
  }

  const {
    totalGamingCenters,
    totalUsers,
    totalManagers,
    reservations,
    financials,
    payments,
    recentAuditLogs,
    health,
  } = data;

  const dbStatusVariant = health.database.status === 'UP' ? 'success' : 'danger';
  const redisStatusVariant = health.redis.status === 'UP' ? 'success' : 'danger';

  return (
    <Box p="xl" style={{ direction: 'ltr', maxWidth: '1400px', margin: '0 auto' }}>
      <Box mb="xl">
        <H2 style={{ fontWeight: 800, color: '#111827' }}>Platform Admin Dashboard</H2>
        <Text color="grey80">Real-time overview of the PlayNest gaming ecosystem and platform infrastructure.</Text>
      </Box>

      {/* Infrastructure Health Section */}
      <Box mb="xl" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
        <div style={cardStyle}>
          <div>
            <div style={metricTitleStyle}>PostgreSQL Database</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px' }}>
              <Badge variant={dbStatusVariant}>{health.database.status}</Badge>
              <Text color="grey80" fontSize="sm">{health.database.latencyMs} ms response</Text>
            </div>
          </div>
        </div>

        <div style={cardStyle}>
          <div>
            <div style={metricTitleStyle}>Redis Infrastructure</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px' }}>
              <Badge variant={redisStatusVariant}>{health.redis.status}</Badge>
              <Text color="grey80" fontSize="sm">{health.redis.latencyMs} ms response</Text>
            </div>
          </div>
        </div>

        <div style={cardStyle}>
          <div>
            <div style={metricTitleStyle}>Gaming Centers</div>
            <div style={metricValueStyle}>{totalGamingCenters.toLocaleString()}</div>
          </div>
        </div>

        <div style={cardStyle}>
          <div>
            <div style={metricTitleStyle}>Platform Users & Managers</div>
            <div style={metricValueStyle}>{totalUsers.toLocaleString()}</div>
            <Text color="grey80" fontSize="sm">{totalManagers.toLocaleString()} Branch Managers</Text>
          </div>
        </div>
      </Box>

      {/* Operational & Financial Overview */}
      <Box mb="xl" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
        <div style={cardStyle}>
          <H4 mb="md" style={{ fontWeight: 700 }}>Reservation Operations</H4>
          <Box mb="sm">
            <Text color="grey80">Today's Bookings: <strong>{reservations.todayTotal?.toLocaleString() ?? 0}</strong></Text>
          </Box>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
            <Badge variant="info">Today Confirmed: {reservations.todayConfirmed ?? 0}</Badge>
            <Badge variant="success">Today Active: {reservations.todayActive ?? 0}</Badge>
            <Badge variant="danger">Today Canceled: {reservations.todayCanceled ?? 0}</Badge>
          </div>
          <Box mt="md" mb="sm">
            <Text color="grey80">All-time Reservations: <strong>{reservations.total.toLocaleString()}</strong></Text>
          </Box>
        </div>

        <div style={cardStyle}>
          <H4 mb="md" style={{ fontWeight: 700 }}>Financial Performance</H4>
          <Box mb="sm">
            <Text color="grey80">Today's Revenue: <strong>{(financials?.todayRevenue ?? 0).toLocaleString()} IRR</strong></Text>
          </Box>
          <Box mb="sm">
            <Text color="grey80">This Month's Revenue: <strong>{(financials?.monthRevenue ?? 0).toLocaleString()} IRR</strong></Text>
          </Box>
          <Box mb="sm">
            <Text color="grey80">Pending Refunds: <strong>{financials?.pendingRefundsCount ?? 0} ({(financials?.pendingRefundsAmount ?? 0).toLocaleString()} IRR)</strong></Text>
          </Box>
          <div style={{ marginTop: '8px' }}>
            <Text style={{ fontSize: '20px', fontWeight: 700, color: '#059669' }}>
              {(financials?.totalVolume ?? payments.totalVolume).toLocaleString()} <span style={{ fontSize: '13px', fontWeight: 500, color: '#6b7280' }}>Lifetime Volume</span>
            </Text>
          </div>
        </div>
      </Box>

      {/* BullMQ Background Queues Health */}
      {health.queues && (
        <Box mb="xl">
          <H4 mb="md" style={{ fontWeight: 700 }}>Background Workers & Queues</H4>
          <Box style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
            {Object.entries(health.queues).map(([key, q]) => (
              <div key={key} style={cardStyle}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={metricTitleStyle}>{q.name}</span>
                    <Badge variant={q.status === 'HEALTHY' ? 'success' : 'danger'}>{q.status}</Badge>
                  </div>
                  <div style={{ display: 'flex', gap: '12px', marginTop: '8px', fontSize: '13px' }}>
                    <span>Wait: <strong>{q.waiting}</strong></span>
                    <span>Act: <strong>{q.active}</strong></span>
                    <span>Fail: <strong style={{ color: q.failed > 0 ? '#dc2626' : undefined }}>{q.failed}</strong></span>
                  </div>
                </div>
              </div>
            ))}
          </Box>
        </Box>
      )}

      {/* Recent Administrative Activity */}
      <div style={cardStyle}>
        <H4 mb="md" style={{ fontWeight: 700 }}>Recent System Activity</H4>
        {recentAuditLogs.length === 0 ? (
          <Text color="grey80">No recent activity found.</Text>
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Timestamp</TableCell>
                <TableCell>Action</TableCell>
                <TableCell>Entity</TableCell>
                <TableCell>Entity ID</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {recentAuditLogs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>{new Date(log.createdAt).toLocaleString('en-US')}</TableCell>
                  <TableCell><Badge variant="primary">{log.action}</Badge></TableCell>
                  <TableCell>{log.entity}</TableCell>
                  <TableCell><code>{log.entityId}</code></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </Box>
  );
};

export default Dashboard;
