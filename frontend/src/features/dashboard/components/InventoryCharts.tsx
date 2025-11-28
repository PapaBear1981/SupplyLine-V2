import { Card } from 'antd';
import { PieChartOutlined, LineChartOutlined } from '@ant-design/icons';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import styles from '../styles/Dashboard.module.scss';

interface InventoryPieChartProps {
  title: string;
  data: Array<{ name: string; value: number; color: string }>;
  loading?: boolean;
}

export const InventoryPieChart = ({ title, data, loading = false }: InventoryPieChartProps) => {
  const totalValue = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <Card
      className={`${styles.sectionCard} ${styles.chartCard}`}
      title={
        <span className={styles.sectionTitle}>
          <PieChartOutlined />
          {title}
        </span>
      }
      loading={loading}
    >
      <div className={styles.chartContainer}>
        {totalValue === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-secondary)' }}>
            No data available
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={2}
                dataKey="value"
                animationBegin={0}
                animationDuration={800}
                animationEasing="ease-out"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number) => [value, 'Count']}
                contentStyle={{
                  borderRadius: 8,
                  border: 'none',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                }}
              />
              <Legend
                verticalAlign="bottom"
                height={36}
                formatter={(value: string) => <span style={{ fontSize: 12 }}>{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
};

interface ActivityChartProps {
  title: string;
  data: Array<{ date: string; issuances: number; transfers: number }>;
  loading?: boolean;
}

export const ActivityChart = ({ title, data, loading = false }: ActivityChartProps) => {
  const formattedData = data.map((item) => ({
    ...item,
    date: item.date.split('-').slice(1).join('/'), // Format: MM/DD
  }));

  return (
    <Card
      className={`${styles.sectionCard} ${styles.chartCard}`}
      title={
        <span className={styles.sectionTitle}>
          <LineChartOutlined />
          {title}
        </span>
      }
      loading={loading}
    >
      <div className={styles.chartContainer}>
        {data.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-secondary)' }}>
            No activity data available
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={formattedData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorIssuances" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#1890ff" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#1890ff" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorTransfers" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#722ed1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#722ed1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: '#f0f0f0' }}
              />
              <YAxis
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: '#f0f0f0' }}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: 8,
                  border: 'none',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                }}
              />
              <Area
                type="monotone"
                dataKey="issuances"
                name="Issuances"
                stroke="#1890ff"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorIssuances)"
                animationDuration={800}
              />
              <Area
                type="monotone"
                dataKey="transfers"
                name="Transfers"
                stroke="#722ed1"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorTransfers)"
                animationDuration={800}
              />
              <Legend
                verticalAlign="bottom"
                height={36}
                formatter={(value: string) => <span style={{ fontSize: 12 }}>{value}</span>}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
};
