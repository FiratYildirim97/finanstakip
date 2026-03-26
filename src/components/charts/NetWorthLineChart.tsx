import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { NetWorthHistory } from '../../types';

interface NetWorthLineChartProps {
  history: NetWorthHistory[];
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
      <p style={{ color: '#888', fontSize: '11px', fontFamily: 'monospace', marginBottom: '4px' }}>{label}</p>
      <p style={{ color: '#4edeb3', fontWeight: 800, fontSize: '16px', fontFamily: 'monospace' }}>
        {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(payload[0].value)}
      </p>
    </div>
  );
};

export const NetWorthLineChart = ({ history }: NetWorthLineChartProps) => {
  if (!history || history.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-[var(--color-surface-lowest)] rounded-2xl border border-white/5">
        <p className="text-[var(--color-text-variant)] text-sm">Geçmiş net varlık verisi yok</p>
      </div>
    );
  }

  const formattedData = history.map(h => ({
    date: new Date(h.date).toLocaleDateString('tr-TR', { month: 'short', day: 'numeric' }),
    değer: h.total_value
  }));

  const minVal = Math.min(...formattedData.map(d => d.değer));
  const maxVal = Math.max(...formattedData.map(d => d.değer));
  const padding = (maxVal - minVal) * 0.1 || 1000;

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={formattedData} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="netWorthGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4edeb3" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#4edeb3" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.04)" />
          <XAxis 
            dataKey="date" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 11, fontFamily: 'monospace' }} 
            dy={10} 
          />
          <YAxis 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 11, fontFamily: 'monospace' }}
            tickFormatter={(value) => `₺${value > 1000 ? (value/1000).toFixed(0) + 'k' : value}`}
            domain={[minVal - padding, maxVal + padding]}
            width={65}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area 
            type="monotone" 
            dataKey="değer" 
            stroke="#4edeb3" 
            strokeWidth={2.5} 
            fill="url(#netWorthGradient)"
            dot={false}
            activeDot={{ r: 5, fill: '#4edeb3', stroke: '#0a1a12', strokeWidth: 3 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
