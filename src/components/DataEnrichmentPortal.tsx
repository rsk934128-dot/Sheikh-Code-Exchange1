import React, { useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  TrendingUp,
  BarChart3,
  Users,
  Award,
  ArrowUpRight,
  Activity,
  DollarSign,
  Briefcase
} from 'lucide-react';

interface AuditLog {
  tx_id: string;
  senderName: string;
  senderUsername: string;
  receiverName: string;
  receiverUsername: string;
  amount: number;
  status: 'SUCCESS' | 'FAILED' | 'ROLLBACKED';
  timestamp: string;
  note: string;
}

interface DataEnrichmentPortalProps {
  auditLogs: AuditLog[];
}

export const DataEnrichmentPortal: React.FC<DataEnrichmentPortalProps> = ({ auditLogs }) => {
  // 1. Filter successful transactions
  const successfulTxs = useMemo(() => {
    return auditLogs.filter(log => log.status === 'SUCCESS');
  }, [auditLogs]);

  // 2. Compute key metrics
  const metrics = useMemo(() => {
    const totalVolume = successfulTxs.reduce((sum, log) => sum + log.amount, 0);
    const count = successfulTxs.length;
    const avgValue = count > 0 ? totalVolume / count : 0;
    
    // Find largest single transaction
    const maxTx = successfulTxs.reduce((max, log) => log.amount > max ? log.amount : max, 0);

    return {
      totalVolume,
      count,
      avgValue,
      maxTx
    };
  }, [successfulTxs]);

  // 3. Prepare Top Recipients data
  const topRecipientsData = useMemo(() => {
    const groups: Record<string, { name: string; username: string; totalAmount: number; txCount: number }> = {};
    
    successfulTxs.forEach(log => {
      const key = log.receiverUsername || log.receiverName || 'Unknown';
      if (!groups[key]) {
        groups[key] = {
          name: log.receiverName || log.receiverUsername || 'Unknown',
          username: log.receiverUsername || 'Unknown',
          totalAmount: 0,
          txCount: 0
        };
      }
      groups[key].totalAmount += log.amount;
      groups[key].txCount += 1;
    });

    return Object.values(groups)
      .sort((a, b) => b.totalAmount - a.totalAmount)
      .slice(0, 5)
      .map(item => ({
        ...item,
        // Shorten name for chart label if too long
        label: item.name.length > 12 ? item.name.substring(0, 12) + '...' : item.name,
      }));
  }, [successfulTxs]);

  // 4. Prepare Volume Trend data (grouped by relative timeline or order)
  const volumeTrendData = useMemo(() => {
    // Show last 8 successful transactions in chronological order (left-to-right)
    return [...successfulTxs]
      .slice(0, 8)
      .reverse()
      .map((log, index) => {
        const time = new Date(log.timestamp);
        const formattedTime = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        return {
          id: log.tx_id.substring(0, 4),
          time: formattedTime,
          amount: log.amount,
          note: log.note.length > 15 ? log.note.substring(0, 15) + '...' : log.note,
        };
      });
  }, [successfulTxs]);

  // Custom colors for charts
  const CHART_COLORS = ['#0D9488', '#6366F1', '#3B82F6', '#10B981', '#F59E0B'];

  return (
    <div className="col-span-12 mt-4" id="data_enrichment_portal_container">
      <div className="bg-gradient-to-b from-[#0F1321] to-[#0A0D18] border border-slate-800/80 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
        {/* Decorative background glow */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/5 rounded-full filter blur-[100px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-indigo-500/5 rounded-full filter blur-[100px] pointer-events-none" />

        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-800/60">
          <div>
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-emerald-400" />
              <h2 className="text-lg font-extrabold tracking-tight bg-gradient-to-r from-emerald-400 via-teal-300 to-indigo-400 bg-clip-text text-transparent">
                Data Enrichment Portal (ডাটা এনরিচমেন্ট পোর্টাল)
              </h2>
            </div>
            <p className="text-xs text-slate-400 font-medium mt-1">
              Sovereign Ledger Analytics • 10.42.0.1 Real-Time Transaction Mining & Analytics
            </p>
          </div>
          <span className="self-start md:self-center text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-3 py-1 rounded-full uppercase tracking-wider">
            Active Intelligence Engine
          </span>
        </div>

        {/* Metric Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {/* Stat 1: Total Volume */}
          <div className="bg-[#13192B]/50 border border-slate-800/60 rounded-xl p-4 transition-all duration-300 hover:border-emerald-500/20 hover:bg-[#161D33]/60">
            <div className="flex justify-between items-start">
              <span className="text-xs text-slate-400 font-bold tracking-wide">মোট ভলিউম (Total Volume)</span>
              <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                <TrendingUp className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2.5">
              <h3 className="text-xl font-black font-mono text-emerald-400">
                {metrics.totalVolume.toLocaleString('en-US', { minimumFractionDigits: 2 })} BDT
              </h3>
              <p className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
                <span>সব সফল লেনদেনের সমষ্টি</span>
                <ArrowUpRight className="h-3 w-3 text-emerald-500" />
              </p>
            </div>
          </div>

          {/* Stat 2: Average Value */}
          <div className="bg-[#13192B]/50 border border-slate-800/60 rounded-xl p-4 transition-all duration-300 hover:border-indigo-500/20 hover:bg-[#161D33]/60">
            <div className="flex justify-between items-start">
              <span className="text-xs text-slate-400 font-bold tracking-wide">গড় লেনদেন (Average Value)</span>
              <div className="h-8 w-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                <BarChart3 className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2.5">
              <h3 className="text-xl font-black font-mono text-indigo-400">
                {metrics.avgValue.toLocaleString('en-US', { minimumFractionDigits: 2 })} BDT
              </h3>
              <p className="text-[10px] text-slate-500 mt-1">লেনদেন প্রতি গড় অর্থের পরিমাণ</p>
            </div>
          </div>

          {/* Stat 3: Successful Count */}
          <div className="bg-[#13192B]/50 border border-slate-800/60 rounded-xl p-4 transition-all duration-300 hover:border-blue-500/20 hover:bg-[#161D33]/60">
            <div className="flex justify-between items-start">
              <span className="text-xs text-slate-400 font-bold tracking-wide">সফল ট্রানজ্যাকশন</span>
              <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400">
                <Users className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2.5">
              <h3 className="text-xl font-black font-mono text-blue-400">
                {metrics.count} <span className="text-xs font-bold text-slate-400">টি</span>
              </h3>
              <p className="text-[10px] text-slate-500 mt-1">অ্যাক্টিভ ও ভ্যালিডেটেড রেকর্ড</p>
            </div>
          </div>

          {/* Stat 4: Largest Single Tx */}
          <div className="bg-[#13192B]/50 border border-slate-800/60 rounded-xl p-4 transition-all duration-300 hover:border-amber-500/20 hover:bg-[#161D33]/60">
            <div className="flex justify-between items-start">
              <span className="text-xs text-slate-400 font-bold tracking-wide">সর্বোচ্চ একক লেনদেন</span>
              <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400">
                <Award className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2.5">
              <h3 className="text-xl font-black font-mono text-amber-400">
                {metrics.maxTx.toLocaleString('en-US', { minimumFractionDigits: 2 })} BDT
              </h3>
              <p className="text-[10px] text-slate-500 mt-1">একক সর্বোচ্চ স্থানান্তরিত অর্থ</p>
            </div>
          </div>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Chart 1: Financial Flow Trend (Area Chart) */}
          <div className="lg:col-span-7 bg-[#0B0E17]/60 border border-slate-800/50 rounded-xl p-5">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xs font-bold text-slate-350 uppercase tracking-wider">
                লেনদেন ভলিউম ট্রেন্ড (Recent Transaction Trend)
              </h3>
              <span className="text-[9px] text-slate-400 font-mono bg-slate-800/40 px-2 py-0.5 rounded">
                সর্বশেষ ৮টি সফল রেকর্ড
              </span>
            </div>

            <div className="h-[260px] w-full">
              {volumeTrendData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={volumeTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0D9488" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#0D9488" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="time"
                      stroke="#475569"
                      fontSize={10}
                      tickLine={false}
                    />
                    <YAxis
                      stroke="#475569"
                      fontSize={10}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0F172A',
                        border: '1px solid #1E293B',
                        borderRadius: '0.75rem',
                        fontSize: '11px',
                        color: '#F1F5F9',
                      }}
                      labelFormatter={(label) => `সময়: ${label}`}
                    />
                    <Area
                      type="monotone"
                      dataKey="amount"
                      name="টাকা (BDT)"
                      stroke="#0D9488"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorAmount)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs">
                  <Activity className="h-8 w-8 mb-2 stroke-1 opacity-40" />
                  বিশ্লেষণের জন্য কোনো সফল লেনদেনের ডাটা পাওয়া যায়নি
                </div>
              )}
            </div>
          </div>

          {/* Chart 2: Top Recipients (Bar Chart & Summary) */}
          <div className="lg:col-span-5 bg-[#0B0E17]/60 border border-slate-800/50 rounded-xl p-5 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xs font-bold text-slate-355 uppercase tracking-wider">
                  শীর্ষ প্রাপক তালিকা (Top Recipients Ledger)
                </h3>
                <span className="text-[9px] text-slate-400 font-mono bg-slate-800/40 px-2 py-0.5 rounded">
                  BDT মোট পরিমাণ
                </span>
              </div>

              <div className="h-[180px] w-full mb-4">
                {topRecipientsData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topRecipientsData} layout="vertical" margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                      <XAxis type="number" stroke="#475569" fontSize={9} hide />
                      <YAxis
                        dataKey="label"
                        type="category"
                        stroke="#94A3B8"
                        fontSize={10}
                        tickLine={false}
                        axisLine={false}
                        width={80}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0F172A',
                          border: '1px solid #1E293B',
                          borderRadius: '0.75rem',
                          fontSize: '11px',
                        }}
                        formatter={(value) => [`${Number(value).toLocaleString()} BDT`, 'মোট প্রাপ্তি']}
                      />
                      <Bar
                        dataKey="totalAmount"
                        fill="#6366F1"
                        radius={[0, 4, 4, 0]}
                        barSize={12}
                      >
                        {topRecipientsData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs">
                    <Users className="h-8 w-8 mb-2 stroke-1 opacity-40" />
                    ডাটা খালি আছে
                  </div>
                )}
              </div>
            </div>

            {/* List breakdown for accessibility */}
            <div className="border-t border-slate-800/80 pt-3">
              <h4 className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <Award className="h-3 w-3 text-emerald-400" />
                শীর্ষ ৩ জন প্রাপকের প্রাপ্ত ফান্ড
              </h4>
              <div className="space-y-1.5">
                {topRecipientsData.slice(0, 3).map((item, idx) => (
                  <div key={item.username} className="flex justify-between items-center text-xs">
                    <div className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: CHART_COLORS[idx] }} />
                      <span className="font-semibold text-slate-300">{item.name}</span>
                      <span className="text-[9px] text-slate-500 font-mono">({item.username})</span>
                    </div>
                    <span className="font-bold text-slate-100 font-mono">
                      {item.totalAmount.toLocaleString('en-US')} BDT
                    </span>
                  </div>
                ))}
                {topRecipientsData.length === 0 && (
                  <p className="text-[10px] text-slate-500 italic">কোনো ট্রানজ্যাকশন ডাটা নেই</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Portal Information Banner */}
        <div className="mt-6 bg-slate-900/40 border border-slate-800/60 rounded-xl p-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-medium">
              অটোনমাস লেনদেন ফিল্টারিং ইঞ্জিন সক্রিয়। প্রতিটি নতুন লেনদেন স্বয়ংক্রিয়ভাবে ইনভেন্টরিতে যুক্ত হচ্ছে।
            </span>
          </div>
          <div className="flex gap-4 font-mono text-[10px] text-slate-500 shrink-0">
            <span>Anycast Nodes: 1</span>
            <span>Ledger Integrity: OK</span>
          </div>
        </div>
      </div>
    </div>
  );
};
