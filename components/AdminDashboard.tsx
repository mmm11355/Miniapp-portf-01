import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { RefreshCw } from 'lucide-react';
import React, { useMemo, useState, useEffect } from 'react';

const AdminDashboard: React.FC = () => {
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'stats' | 'leads'>('overview');
  const [loadingGlobal, setLoadingGlobal] = useState(false);
  
  const [sessions, setSessions] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);

  // Функция для очистки текста от JSON и объектов
  const cleanText = (val: any, fallback: string = 'Unknown'): string => {
    if (val === null || val === undefined) return fallback;
    const str = String(val).trim();
    // Если строка похожа на JSON или содержит [object, значит это ошибка данных
    if (str.startsWith('{') || str.startsWith('[') || str.includes('[object')) {
      return fallback;
    }
    return str;
  };

  const safeParse = (raw: any) => {
    let obj = raw;
    if (typeof raw === 'string') {
      try {
        if (raw.trim().startsWith('{')) obj = JSON.parse(raw);
      } catch (e) { return {}; }
    }
    if (!obj || typeof obj !== 'object') return {};
    
    // Приводим все ключи к нижнему регистру для надежности
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
        const remoteSessions = (result.sessions || [])
          .map((item: any) => {
            const s = safeParse(item);
            return {
              id: cleanText(s.id, Math.random().toString(36).substr(2, 9)),
              city: cleanText(s.city, 'Unknown'),
              utmSource: cleanText(s.utmsource || s.utm_source, 'DIRECT').toUpperCase(),
              startTime: s.starttime || s.timestamp || new Date().toISOString()
            };
          });
        
        const remoteOrders = (result.orders || [])
          .map((item: any) => {
            const o = safeParse(item);
            return {
              productTitle: cleanText(o.producttitle || o.title, 'Товар'),
              customerEmail: cleanText(o.customeremail || o.email, ''),
              price: Number(o.price || o.summa) || 0
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
      const label = s.city;
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
      const src = s.utmSource;
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
        <button onClick={fetchGlobalData} disabled={loadingGlobal} className={`p-2 rounded-xl bg-indigo-50 text-indigo-600 transition-all active:scale-90 ${loadingGlobal ? 'animate-spin' : ''}`}>
          <RefreshCw size={14} />
        </button>
      </div>

      <div className="flex p-1 bg-slate-100 rounded-2xl gap-1">
        {['overview', 'stats', 'leads'].map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab as any)} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${activeTab === tab ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>
            {tab === 'overview' ? 'Обзор' : tab === 'stats' ? 'Трафик' : 'Заказы'}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="space-y-4 animate-in fade-in duration-300">
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
             <h3 className="text-[9px] font-black uppercase text-slate-400 mb-4 tracking-widest text-center">Топ городов</h3>
             <div className="w-full h-[160px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={pathStats}>
                    <XAxis dataKey="name" fontSize={8} tick={{fill: '#94a3b8', fontWeight: 700}} axisLine={false} tickLine={false} />
                    <Bar dataKey="value" fill="#6366f1" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
             </div>
          </div>
        </div>
      )}

      {activeTab === 'stats' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
             <h3 className="text-[9px] font-black uppercase text-slate-400 mb-4 tracking-widest text-center">Источники трафика</h3>
             <div className="w-full h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={utmStats} innerRadius={50} outerRadius={80} paddingAngle={5} dataKey="value" stroke="none">
                      {utmStats.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Legend iconType="circle" wrapperStyle={{fontSize: '9px', fontWeight: '900', textTransform: 'uppercase'}} />
                  </PieChart>
                </ResponsiveContainer>
             </div>
          </div>
          
          <div className="space-y-2">
            <h3 className="text-[9px] font-black uppercase text-slate-400 px-4 mb-2 tracking-widest">Последние визиты</h3>
            <div className="space-y-2">
              {sessions.slice(0, 8).map((s, i) => (
                <div key={s.id || i} className="bg-white p-4 rounded-2xl border border-slate-100 flex items-center justify-between shadow-sm">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <div className="truncate">
                      <p className="text-xs font-black text-slate-900 truncate">{s.city}</p>
                      <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest">{s.utmSource}</p>
                    </div>
                  </div>
                  <div className="text-[9px] text-slate-300 font-black flex-shrink-0">
                    {s.startTime && !isNaN(Date.parse(s.startTime)) 
                      ? new Date(s.startTime).toLocaleTimeString('ru-RU', {hour: '2-digit', minute: '2-digit'})
                      : '--:--'}
                  </div>
                </div>
              ))}
              {sessions.length === 0 && <div className="p-8 text-center text-[10px] font-black text-slate-300 uppercase">Нет данных</div>}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'leads' && (
        <div className="space-y-3 animate-in fade-in duration-300">
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