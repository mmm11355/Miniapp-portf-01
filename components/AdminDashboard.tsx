import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { analyticsService } from '../services/analyticsService';
import { RefreshCw } from 'lucide-react';
import React, { useMemo, useState, useEffect } from 'react';

const AdminDashboard: React.FC = () => {
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'stats' | 'leads'>('overview');
  const [loadingGlobal, setLoadingGlobal] = useState(false);
  
  const [sessions, setSessions] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);

  // Функция для приведения всех ключей объекта к нижнему регистру
  const normalizeKeys = (obj: any) => {
    if (!obj || typeof obj !== 'object') return {};
    return Object.keys(obj).reduce((acc: any, key) => {
      acc[key.toLowerCase()] = obj[key];
      return acc;
    }, {});
  };

  const fetchGlobalData = async () => {
    const config = localStorage.getItem('olga_tg_config');
    if (!config) return;
    const { googleSheetWebhook } = JSON.parse(config);
    if (!googleSheetWebhook) return;

    setLoadingGlobal(true);
    try {
      const response = await fetch(`${googleSheetWebhook}?action=getStats&_t=${Date.now()}`);
      const result = await response.json();
      
      if (result && result.status === 'success') {
        // Обрабатываем сессии с защитой от регистра ключей (ID vs id)
        const remoteSessions = (result.sessions || [])
          .filter((s: any) => s !== null && typeof s === 'object')
          .map((raw: any) => {
            const s = normalizeKeys(raw);
            return {
              id: s.id || Math.random().toString(36).substr(2, 9),
              city: s.city || 'Unknown',
              country: s.country || 'Unknown',
              utmSource: s.utmsource || s.utm_source || 'direct',
              startTime: s.starttime || s.timestamp || new Date().toISOString()
            };
          });
        
        // Обрабатываем заказы
        const remoteOrders = (result.orders || [])
          .filter((o: any) => o !== null && typeof o === 'object')
          .map((raw: any) => {
            const o = normalizeKeys(raw);
            return {
              productTitle: o.producttitle || o.title || 'Товар',
              customerEmail: o.customeremail || o.email || '',
              customerName: o.customername || o.name || '',
              price: Number(o.price || o.summa) || 0,
              timestamp: o.timestamp || o.date || new Date().toISOString()
            };
          });

        setSessions(remoteSessions);
        setOrders(remoteOrders);
      }
    } catch (e) {
      console.warn("Sync failed", e);
    } finally {
      setLoadingGlobal(false);
    }
  };

  useEffect(() => {
    setMounted(true);
    fetchGlobalData();
  }, []);

  const pathStats = useMemo(() => {
    const counts: Record<string, number> = {};
    sessions.forEach(s => {
      const label = s.city || 'Unknown';
      counts[label] = (counts[label] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a,b) => b.value - a.value)
      .slice(0, 5);
  }, [sessions]);

  const utmStats = useMemo(() => {
    const counts: Record<string, number> = {};
    sessions.forEach(s => {
      const src = s.utmSource || 'direct';
      counts[src] = (counts[src] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [sessions]);

  const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316'];

  if (!mounted) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between px-2">
        <h2 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Аналитика</h2>
        <button 
          onClick={fetchGlobalData} 
          disabled={loadingGlobal} 
          className={`p-2 rounded-xl bg-indigo-50 text-indigo-600 transition-all active:scale-90 ${loadingGlobal ? 'animate-spin' : ''}`}
        >
          <RefreshCw size={14} />
        </button>
      </div>

      <div className="flex p-1 bg-slate-100 rounded-2xl gap-1">
        {['overview', 'stats', 'leads'].map((tab) => (
          <button 
            key={tab} 
            onClick={() => setActiveTab(tab as any)} 
            className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${activeTab === tab ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}
          >
            {tab === 'overview' ? 'Обзор' : tab === 'stats' ? 'Трафик' : 'Заказы'}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="space-y-4 animate-in fade-in">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm">
              <p className="text-[8px] text-slate-400 font-black uppercase mb-1">Визиты</p>
              <p className="text-2xl font-black text-slate-900">{sessions.length}</p>
            </div>
            <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm">
              <p className="text-[8px] text-slate-400 font-black uppercase mb-1">Заказы</p>
              <p className="text-2xl font-black text-slate-900">{orders.length}</p>
            </div>
          </div>
          <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
             <h3 className="text-[9px] font-black uppercase text-slate-400 mb-4 tracking-widest">Топ локаций</h3>
             <div className="w-full h-[160px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={pathStats}>
                    <XAxis dataKey="name" fontSize={8} tick={{fill: '#94a3b8', fontWeight: 700}} axisLine={false} tickLine={false} />
                    <Bar dataKey="value" fill="#6366f1" radius={[6, 6, 0, 0]} />
                    <Tooltip cursor={{fill: 'transparent'}} contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontSize: '10px', fontWeight: 'bold'}} />
                  </BarChart>
                </ResponsiveContainer>
             </div>
          </div>
        </div>
      )}

      {activeTab === 'stats' && (
        <div className="space-y-4 animate-in fade-in">
          <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
             <h3 className="text-[9px] font-black uppercase text-slate-400 mb-4 tracking-widest">Источники трафика</h3>
             <div className="w-full h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie 
                      data={utmStats} 
                      innerRadius={50} 
                      outerRadius={80} 
                      paddingAngle={5} 
                      dataKey="value" 
                      stroke="none"
                    >
                      {utmStats.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{borderRadius: '12px', border: 'none', fontSize: '10px', fontWeight: 'bold'}} />
                    <Legend iconType="circle" wrapperStyle={{fontSize: '9px', fontWeight: '900', textTransform: 'uppercase', paddingTop: '10px'}} />
                  </PieChart>
                </ResponsiveContainer>
             </div>
          </div>
          
          <div className="space-y-2">
            <h3 className="text-[9px] font-black uppercase text-slate-400 px-4 mb-1">Последние визиты</h3>
            {sessions.length === 0 ? (
              <div className="p-10 text-center text-slate-300 text-[10px] font-black uppercase">Нет данных</div>
            ) : (
              sessions.slice(0, 10).map((s, i) => (
                <div key={s.id || i} className="bg-white p-4 rounded-2xl border border-slate-100 flex items-center justify-between shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <div>
                      <p className="text-xs font-black text-slate-900">{s.city}</p>
                      <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest">{s.utmSource}</p>
                    </div>
                  </div>
                  <div className="text-[9px] text-slate-300 font-black">
                    {s.startTime && !isNaN(Date.parse(s.startTime)) 
                      ? new Date(s.startTime).toLocaleTimeString('ru-RU', {hour: '2-digit', minute: '2-digit'})
                      : '--:--'}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {activeTab === 'leads' && (
        <div className="space-y-3 animate-in fade-in">
          {orders.length === 0 ? (
            <div className="py-20 text-center text-slate-300 text-[10px] font-black uppercase tracking-widest">Заказов пока нет</div>
          ) : (
            orders.map((o, i) => (
              <div key={i} className="bg-white p-5 rounded-2xl border border-slate-100 flex justify-between items-center shadow-sm">
                <div className="overflow-hidden pr-4">
                  <p className="font-black text-xs text-slate-900 truncate leading-none mb-1">{o.productTitle}</p>
                  <p className="text-[9px] text-slate-400 font-bold truncate uppercase tracking-tighter">{o.customerEmail || 'Без email'}</p>
                </div>
                <div className="bg-indigo-50 text-indigo-600 px-3 py-2 rounded-xl text-[10px] font-black whitespace-nowrap border border-indigo-100">
                  {Number(o.price).toLocaleString()} ₽
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;