import { LineChart as RechartsLineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { NetWorthHistory } from '../../types';

interface NetWorthLineChartProps {
  history: NetWorthHistory[];
}

export const NetWorthLineChart = ({ history }: NetWorthLineChartProps) => {
  if (!history || history.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg border border-gray-100 dark:bg-zinc-900 border-zinc-800">
        <p className="text-gray-400">Geçmiş net varlık verisi yok</p>
      </div>
    );
  }

  const formattedData = history.map(h => ({
    date: new Date(h.date).toLocaleDateString('tr-TR', { month: 'short', day: 'numeric' }),
    değer: h.total_value
  }));

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RechartsLineChart data={formattedData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
          <XAxis 
            dataKey="date" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: '#6B7280', fontSize: 12 }} 
            dy={10} 
          />
          <YAxis 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: '#6B7280', fontSize: 12 }}
            tickFormatter={(value) => `₺${value > 1000 ? (value/1000).toFixed(1) + 'k' : value}`}
          />
          <Tooltip 
             formatter={(value: number) => [new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(value), 'Toplam Varlık']}
             contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
          />
          <Line 
            type="monotone" 
            dataKey="değer" 
            stroke="#10b981" 
            strokeWidth={3} 
            dot={{ r: 4, strokeWidth: 2 }} 
            activeDot={{ r: 6 }} 
          />
        </RechartsLineChart>
      </ResponsiveContainer>
    </div>
  );
};
