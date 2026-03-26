import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface MonthlyBarChartProps {
  data: { month: string; income: number; expense: number }[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'rgba(20, 25, 30, 0.95)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: '12px',
      padding: '12px 16px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      backdropFilter: 'blur(10px)',
    }}>
      <p style={{ color: '#888', fontSize: '11px', fontFamily: 'monospace', marginBottom: '6px' }}>{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ 
          color: p.dataKey === 'income' ? '#4edeb3' : '#ff7886', 
          fontWeight: 700, fontSize: '13px', fontFamily: 'monospace',
          marginBottom: '2px'
        }}>
          {p.dataKey === 'income' ? '↑ Gelir' : '↓ Gider'}: {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(p.value)}
        </p>
      ))}
    </div>
  );
};

export const MonthlyBarChart = ({ data }: MonthlyBarChartProps) => {
  if (!data || data.length === 0) return null;

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 5, right: 5, bottom: 0, left: 0 }} barGap={2}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.04)" />
          <XAxis 
            dataKey="month" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10, fontFamily: 'monospace' }}
            dy={8}
          />
          <YAxis 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10, fontFamily: 'monospace' }}
            tickFormatter={(value) => `${value > 1000 ? (value/1000).toFixed(0) + 'k' : value}`}
            width={45}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="income" fill="#4edeb3" radius={[4, 4, 0, 0]} maxBarSize={20} opacity={0.85} />
          <Bar dataKey="expense" fill="#ff7886" radius={[4, 4, 0, 0]} maxBarSize={20} opacity={0.85} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
