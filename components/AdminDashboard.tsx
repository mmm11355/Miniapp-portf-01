
import React, { useMemo, useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, ResponsiveContainer, YAxis, Tooltip, Cell, CartesianGrid } from 'recharts';
import { RefreshCw, Users, CreditCard, ListOrdered, CheckCircle, Clock, User, Archive, Activity, X, MousePointer2 } from 'lucide-react';

const AdminDashboard: React.FC = () => {
  const [sessions, setSessions] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'active' | 'archive'>('active');

  const parseSafeDate = (dateVal: any): number => {
    if (!dateVal) return 0;
    if (typeof dateVal === 'number') return dateVal;
    if (typeof dateVal === 'string') {
      const clean = dateVal.split(',')[0].trim();
      if (clean.includes('.')) {
        const [d, m, y] = clean.split('.').map(Number);
        if (!isNaN(d) && !isNaN(m) && !isNaN(y)) {
          return new Date(y, m - 1, d).getTime();
        }
      }
    }
    const parsed = Date.parse(dateVal);
    return isNaN(parsed) ? 0 : parsed;
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const config = localStorage.getItem('olga_tg_config');
      if (!config) {
        setLoading(false);
        return;
      }
      const { googleSheetWebhook } = JSON.parse(config);
      if (!googleSheetWebhook) {
        setLoading(false);
        return;
      }
      const res = await fetch(`${googleSheetWebhook}?action=getStats&_t=${Date.now()}`, { cache: 'no-store' });
      const data = await res.json();
      if (data.status === 'success') {
        setSessions(data.sessions || []);
        setOrders(data.orders || []);
      }
    } catch (e) {
      console.error("Dashboard Fetch Error:", e);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const chartData = useMemo(() => {
    const days: Record<string, { name: string, orders: number }> = {};
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const label = d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
      days[label] = { name: label, orders: 0 };
    }

    orders.forEach(o => {
      const date = new Date(parseSafeDate(o.timestamp));
      const label = date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
      if (days[label]) days[label].orders++;
    });

    return Object.values(days);
  }, [orders]);

  // ИСПРАВЛЕННЫЙ ПОДСЧЕТ КЛИКОВ (ОБРАБОТКА СТРОК И МАССИВОВ)
  const pathStats = useMemo(() => {
    const stats: Record<string, number> = { 'home': 0, 'portfolio': 0, 'shop': 0, 'bonuses': 0 };
    sessions.forEach(s => {
      let history = s.pathHistory || [];
      // Если GAS прислал массив как строку JSON
      if (typeof history === 'string') {
        try { history = JSON.parse(history); } catch(e) { history = []; }
      }
      if (Array.isArray(history)) {
        const uniquePaths = Array.from(new Set(history.map(p => String(p).toLowerCase())));
        uniquePaths.forEach((p: string) => {
          if (stats[p] !== undefined) stats[p]++;
        });
      }
    });
    return Object.entries(stats)
      .map(([name, count]) => ({ 
        name: name === 'home' ? 'ИНФО' : name === 'portfolio' ? 'КЕЙСЫ' : name === 'shop' ? 'МАГАЗИН' : 'БОНУСЫ',
        count 
      }))
      .sort((a, b) => b.count - a.count);
  }, [sessions]);

  const processedOrders = useMemo(() => {
    const now = Date.now();
    const cancelledLocal = JSON.parse(localStorage.getItem('olga_processed_cancelled') || '[]').map(String);

    return orders.map(o => {
      const oid = String(o.id);
      const status = (o.paymentStatus || '').toLowerCase();
      const orderTime = parseSafeDate(o.timestamp);
      
      const isPaid = status.includes('оплачено') || status === 'paid';
      const isFailed = status.includes('отменен') || status.includes('архив') || status === 'failed' || cancelledLocal.includes(oid);
      const isOld = orderTime > 0 && (now - orderTime) > 10 * 60 * 1000;

      if (!isPaid && (isOld || isFailed)) {
        return { ...o, paymentStatus: 'failed', forceArchived: true };
      }
      if (isPaid) return { ...o, paymentStatus: 'paid' };
      return { ...o, paymentStatus: 'pending' };
    });
  }, [orders]);

  const filteredOrders = useMemo(() => {
    if (activeTab === 'active') {
      return processedOrders.filter(o => o.paymentStatus !== 'failed');
    }
    return processedOrders.filter(o => o.paymentStatus === 'failed');
  }, [processedOrders, activeTab]);

  return (
    <div className="space-y-8 pb-10 animate-in fade-in duration-500">
      <div className="flex justify-between items-center px-2">
        <h2 className="text-[11px] font-black uppercase tracking-[0.3em] text-indigo-600">Системный мониторинг</h2>
        <button onClick={fetchData} className={`p-3 rounded-2xl bg-white shadow-sm transition-all active:scale-90 ${loading ? 'animate-spin' : ''}`}>
           <RefreshCw size={18} className="text-indigo-600" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-50 flex flex-col justify-between h-32">
          <div className="flex items-center gap-2 text-indigo-600 mb-1">
            <Users size={14} strokeWidth={3} />
            <span className="text-[9px] font-black uppercase tracking-widest">Визиты</span>
          </div>
          <p className="text-3xl font-black text-slate-900 leading-none">{sessions.length}</p>
        </div>
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-50 flex flex-col justify-between h-32">
          <div className="flex items-center gap-2 text-emerald-500 mb-1">
            <CreditCard size={14} strokeWidth={3} />
            <span className="text-[9px] font-black uppercase tracking-widest">Оплачено</span>
          </div>
          <p className="text-3xl font-black text-slate-900 leading-none">
            {processedOrders.filter(o => o.paymentStatus === 'paid').length}
          </p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-50 space-y-4">
        <div className="flex items-center gap-2 text-slate-400 mb-2">
          <Activity size={14} strokeWidth={3} />
          <span className="text-[9px] font-black uppercase tracking-widest">График заказов (7 дней)</span>
        </div>
        <div className="h-40 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 800, fill: '#cbd5e1'}} dy={10} />
              <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontSize: '10px', fontWeight: 'bold' }} />
              <Bar dataKey="orders" radius={[6, 6, 6, 6]} barSize={20}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.orders > 0 ? '#6366f1' : '#e2e8f0'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-50 space-y-5">
        <div className="flex items-center gap-2 text-slate-400">
          <MousePointer2 size={14} strokeWidth={3} />
          <span className="text-[9px] font-black uppercase tracking-widest">Популярные разделы</span>
        </div>
        <div className="space-y-4">
          {pathStats.map((item, idx) => (
            <div key={idx} className="space-y-1.5">
              <div className="flex justify-between text-[10px] font-black uppercase tracking-tight">
                <span className="text-slate-600">{item.name}</span>
                <span className="text-indigo-600">{item.count} кликов</span>
              </div>
              <div className="h-1.5 bg-slate-50 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-500 rounded-full transition-all duration-1000" style={{ width: `${(item.count / (sessions.length || 1)) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between px-2">
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-800">Журнал продаж</h3>
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button onClick={() => setActiveTab('active')} className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase transition-all ${activeTab === 'active' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>Активные</button>
            <button onClick={() => setActiveTab('archive')} className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase transition-all ${activeTab === 'archive' ? 'bg-white text-rose-500 shadow-sm' : 'text-slate-400'}`}>Архив</button>
          </div>
        </div>
        
        <div className="space-y-3">
          {filteredOrders.length === 0 ? (
            <div className="text-center py-20 bg-white/50 rounded-[2rem] border border-dashed border-slate-200">
              <p className="text-slate-300 font-bold uppercase text-[10px] tracking-widest">Заказов нет</p>
            </div>
          ) : 
            filteredOrders.map((o, i) => {
              const status = (o.paymentStatus || '').toLowerCase();
              const isPaid = status === 'paid';
              const isFailed = status === 'failed';
              
              return (
                <div key={i} className={`bg-white p-6 rounded-[2rem] shadow-sm border border-slate-50 transition-all ${isFailed ? 'opacity-70' : ''} hover:border-indigo-100`}>
                  <div className="flex justify-between items-start mb-4">
                    <div className="space-y-1">
                      <p className="text-sm font-black text-slate-900 leading-tight">{o.productTitle || 'Без названия'}</p>
                      <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-tight">{o.tgUsername || '@guest'} | {o.customerName || 'Покупатель'}</p>
                    </div>
                    <div className="text-right flex-shrink-0 ml-4">
                      <div className={`text-sm font-black ${isPaid ? 'text-emerald-500' : 'text-indigo-600'}`}>{o.price} ₽</div>
                      {/* ВОЗВРАЩЕНО ПОЛНОЕ ВРЕМЯ ЗАКАЗА */}
                      <div className="text-[9px] font-bold text-slate-300 uppercase tracking-tighter">{o.dateStr || ''}</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-3 border-t border-slate-50">
                    <div className={`flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider ${isPaid ? 'text-emerald-500' : isFailed ? 'text-rose-400' : 'text-amber-500'}`}>
                      {isPaid ? <CheckCircle size={14} strokeWidth={3} /> : isFailed ? <X size={14} strokeWidth={3} /> : <Clock size={14} strokeWidth={3} />}
                      {isPaid ? 'Оплачено' : isFailed ? 'Архив' : 'Ожидание'}
                    </div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">{o.customerPhone}</span>
                  </div>
                </div>
              );
            })
          }
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
