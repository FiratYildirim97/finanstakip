import { PieChart as RechartsPieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

interface ChartData {
  name: string;
  value: number;
}

interface ExpensePieChartProps {
  data: ChartData[];
  colors?: string[];
  compact?: boolean;
}

const DEFAULT_COLORS = ['#4edeb3', '#adc6ff', '#ffcf70', '#ff7886', '#cda4ff', '#ff9e64', '#64d2ff'];

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'rgba(20, 25, 30, 0.95)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: '12px',
      padding: '10px 14px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      backdropFilter: 'blur(10px)',
    }}>
      <p style={{ color: '#fff', fontWeight: 700, fontSize: '13px', marginBottom: '2px' }}>{payload[0].name}</p>
      <p style={{ color: payload[0].payload.fill || '#4edeb3', fontWeight: 800, fontSize: '15px', fontFamily: 'monospace' }}>
        {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(payload[0].value)}
      </p>
    </div>
  );
};

const RADIAN = Math.PI / 180;
const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
  if (percent < 0.08) return null;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="rgba(0,0,0,0.8)" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={700} fontFamily="monospace">
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

export const ExpensePieChart = ({ data, colors = DEFAULT_COLORS, compact = false }: ExpensePieChartProps) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 bg-[var(--color-surface-lowest)] rounded-2xl border border-white/5">
        <p className="text-[var(--color-text-variant)] text-sm">Henüz veri yok</p>
      </div>
    );
  }

  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <div className={compact ? '' : ''}>
      <div className={compact ? 'h-44' : 'h-52'} style={{ width: '100%' }}>
        <ResponsiveContainer width="100%" height="100%">
          <RechartsPieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={compact ? 40 : 55}
              outerRadius={compact ? 65 : 80}
              paddingAngle={3}
              dataKey="value"
              labelLine={false}
              label={renderCustomizedLabel}
              animationBegin={0}
              animationDuration={800}
            >
              {data.map((_, index) => (
                <Cell key={`cell-${index}`} fill={colors[index % colors.length]} stroke="transparent" />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </RechartsPieChart>
        </ResponsiveContainer>
      </div>
      <div className={`grid ${compact ? 'grid-cols-2 gap-1.5 mt-2' : 'grid-cols-2 gap-2 mt-4'}`}>
        {data.map((item, idx) => (
          <div key={item.name} className="flex items-center gap-2 text-xs">
            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: colors[idx % colors.length] }} />
            <span className="text-[var(--color-text-variant)] truncate flex-1">{item.name}</span>
            <span className="font-mono font-bold text-white text-[11px] shrink-0">
              {total > 0 ? `${((item.value / total) * 100).toFixed(0)}%` : '0%'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
