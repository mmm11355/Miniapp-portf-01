
import React, { useMemo, useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, ResponsiveContainer, YAxis, Tooltip, Cell, CartesianGrid } from 'recharts';
import { RefreshCw, Clock, CheckCircle, X as XIcon, AlertCircle, Calendar, MousePointer2, Users, Filter } from 'lucide-react';

type Period = 'today' | '7days' | 'month' | 'all';

const AdminDashboard: React.FC = () => {
  const [sessions, setSessions] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'active' | 'archive'>('active');
  const [period, setPeriod] = useState<Period>('all');
  
  const getWebhook = () => {
    try {
      const saved = localStorage.getItem('olga_tg_config');
      return saved ? JSON.parse(saved).googleSheetWebhook : null;
    } catch (e) { return null; }
  };

  const getVal = (obj: any, key: string) => {
    if (!obj || typeof obj !== 'object') return null;
    const target = key.toLowerCase().replace(/[^a-zа-я0-9]/g, '');
    const foundKey = Object.keys(obj).find(k => {
      const cleanKey = k.toLowerCase().replace(/[^a-zа-я0-9]/g, '');
      return cleanKey === target || cleanKey.includes(target);
    });
    return foundKey ? obj[foundKey] : null;
  };

  const parseSafeDate = (dateVal: any): number => {
    if (!dateVal) return 0;
    if (typeof dateVal === 'number') return dateVal;
    const str = String(dateVal).trim();
    
    const dmyMatch = str.match(/(\d{2})\.(\d{2})\.(\d{4})/);
    if (dmyMatch) {
      const [_, d, m, y] = dmyMatch;
      const timePart = str.split(',')[1]?.trim() || '00:00:00';
      const isoStr = `${y}-${m}-${d}T${timePart.replace(/\s/g, '')}`;
      const ts = Date.parse(isoStr);
      if (!isNaN(ts)) return ts;
    }
    
    const ts = Date.parse(str);
    return isNaN(ts) ? 0 : ts;
  };

  const fetchData = async () => {
    const webhook = getWebhook();
    if (!webhook) { setError("Webhook не настроен"); return; }
    
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${webhook}?action=getStats&_t=${Date.now()}`, { 
        method: 'GET',
        redirect: 'follow',
        cache: 'no-store'
      });
      const data: any = await res.json();
      
      if (data && data.status === 'success') {
        setSessions(Array.isArray(data.sessions) ? data.sessions : []);
        setOrders(Array.isArray(data.orders) ? data.orders : []);
      } else {
        setSessions(data.sessions || []);
        setOrders(data.orders || []);
      }
    } catch (e: any) {
      setError(`Ошибка: ${e.message}`);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const stats = useMemo(() => {
    const now = Date.now();
    const todayStart = new Date().setHours(0,0,0,0);
    const weekStart = now - 7 * 24 * 60 * 60 * 1000;
    const monthStart = now - 30 * 24 * 60 * 60 * 1000;

    let periodStart = 0;
    if (period === 'today') periodStart = todayStart;
    else if (period === '7days') periodStart = weekStart;
    else if (period === 'month') periodStart = monthStart;

    const uniqueSessions = new Map();
    const sectionClicks: Record<string, number> = { 'ИНФО': 0, 'КЕЙСЫ': 0, 'МАГАЗИН': 0, 'БОНУСЫ': 0, 'TG': 0 };

    sessions.forEach(s => {
      const time = parseSafeDate(getVal(s, 'startTime') || getVal(s, 'дата'));
      if (period !== 'all' && time < periodStart) return;

      const sidFromCol = getVal(s, 'country');
      const rawStartTime = getVal(s, 'startTime');
      const finalSid = (sidFromCol && sidFromCol !== 'App' && sidFromCol !== 'direct') 
        ? sidFromCol 
        : `visit-${rawStartTime}`;

      if (!uniqueSessions.has(finalSid)) {
        uniqueSessions.set(finalSid, time);
      }

      const action = String(getVal(s, 'city') || '').toLowerCase();
      if (action.includes('home') || action.includes('инфо')) sectionClicks['ИНФО']++;
      else if (action.includes('portfolio') || action.includes('кейсы')) sectionClicks['КЕЙСЫ']++;
      else if (action.includes('shop') || action.includes('магазин')) sectionClicks['МАГАЗИН']++;
      else if (action.includes('bonus') || action.includes('бонусы')) sectionClicks['БОНУСЫ']++;
      else if (action.includes('contact') || action.includes('tg')) sectionClicks['TG']++;
    });

    const filteredOrders = orders.filter(o => {
      const time = parseSafeDate(getVal(o, 'timestamp') || getVal(o, 'дата'));
      return period === 'all' || time >= periodStart;
    });

    const paidOrders = filteredOrders.filter(o => {
      const s = String(getVal(o, 'paymentstatus') || getVal(o, 'статус') || '').toLowerCase();
      return s.includes('оплачено') || s === 'paid';
    });

    return {
      visits: uniqueSessions.size,
      paidCount: paidOrders.length,
      totalOrders: filteredOrders.length,
      sectionStats: Object.entries(sectionClicks).map(([name, count]) => ({ name, count })),
      rawOrders: filteredOrders
    };
  }, [sessions, orders, period]);

  const processedOrders = useMemo(() => {
    return stats.rawOrders.map(o => {
      const time = parseSafeDate(getVal(o, 'timestamp') || getVal(o, 'дата'));
      const status = String(getVal(o, 'paymentstatus') || getVal(o, 'статус') || '').toLowerCase();
      
      const isPaid = status.includes('оплачено') || status === 'paid';
      const isExpired = !isPaid && time > 0 && (Date.now() - time) > 10 * 60 * 1000;
      const isFailed = status.includes('отменен') || status.includes('архив') || status === 'failed';

      return { 
        ...o, 
        pStatus: isPaid ? 'paid' : (isExpired || isFailed ? 'failed' : 'pending'),
        displayDate: getVal(o, 'timestamp') || getVal(o, 'дата') || '---',
        displayTitle: getVal(o, 'producttitle') || getVal(o, 'товар') || 'Заказ',
        displayPrice: getVal(o, 'price') || getVal(o, 'сумма') || 0,
        displayName: getVal(o, 'customername') || getVal(o, 'имя') || 'Гость',
        displayEmail: getVal(o, 'customeremail') || getVal(o, 'email') || 'no-email',
      };
    });
  }, [stats.rawOrders]);

  const filteredList = useMemo(() => {
    const list = activeTab === 'active' 
      ? processedOrders.filter(o => o.pStatus !== 'failed')
      : processedOrders.filter(o => o.pStatus === 'failed');
    return [...list].sort((a,b) => parseSafeDate(b.displayDate) - parseSafeDate(a.displayDate));
  }, [processedOrders, activeTab]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="flex justify-between items-center px-2">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
          <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Система аналитики</h2>
        </div>
        <button onClick={fetchData} className="p-2.5 rounded-xl bg-white shadow-sm border border-slate-50 active:scale-95 transition-all">
           <RefreshCw size={16} className={loading ? 'animate-spin text-indigo-600' : 'text-slate-400'} />
        </button>
      </div>

      <div className="flex bg-slate-200/50 p-1 rounded-2xl mx-1">
        {(['today', '7days', 'month', 'all'] as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`flex-1 py-2.5 rounded-xl text-[9px] font-bold uppercase transition-all ${period === p ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}
          >
            {p === 'today' ? 'Сегодня' : p === '7days' ? '7 дней' : p === 'month' ? 'Месяц' : 'Все время'}
          </button>
        ))}
      </div>

      {error && (
        <div className="mx-2 p-3 bg-rose-50 border border-rose-100 rounded-xl flex items-center gap-2 text-rose-600 text-[10px] font-bold">
          <AlertCircle size={14} /> {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 px-1">
        <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-50">
          <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1">Визиты</p>
          <p className="text-2xl font-bold text-slate-900 leading-none">{stats.visits}</p>
          <div className="mt-2 text-[8px] font-bold text-indigo-500 uppercase flex items-center gap-1">
             <Users size={10} /> Уникальные
          </div>
        </div>
        <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-50">
          <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1">Оплачено</p>
          <p className="text-2xl font-bold text-emerald-500 leading-none">{stats.paidCount}</p>
          <div className="mt-2 text-[8px] font-bold text-slate-300 uppercase">Из {stats.totalOrders}</div>
        </div>
      </div>

      <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-50 mx-1">
        <h3 className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
          <MousePointer2 size={12} /> Активность по разделам
        </h3>
        <div className="space-y-3">
          {stats.sectionStats.map((item) => (
            <div key={item.name} className="space-y-1">
              <div className="flex justify-between text-[10px] font-bold uppercase">
                <span className="text-slate-500">{item.name}</span>
                <span className="text-indigo-600 font-bold">{item.count}</span>
              </div>
              <div className="w-full h-1.5 bg-slate-50 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-indigo-500 rounded-full transition-all duration-700" 
                  style={{ width: `${Math.min(100, (item.count / (stats.visits || 1)) * 20)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between px-3">
          <h3 className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Журнал заказов</h3>
          <div className="flex bg-slate-200/50 p-0.5 rounded-lg">
            <button onClick={() => setActiveTab('active')} className={`px-4 py-1.5 rounded-md text-[8px] font-bold uppercase transition-all ${activeTab === 'active' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>Актив</button>
            <button onClick={() => setActiveTab('archive')} className={`px-4 py-1.5 rounded-md text-[8px] font-bold uppercase transition-all ${activeTab === 'archive' ? 'bg-white text-rose-500 shadow-sm' : 'text-slate-400'}`}>Архив</button>
          </div>
        </div>

        <div className="space-y-2 px-1">
          {filteredList.length === 0 ? (
            <div className="py-12 text-center bg-white rounded-3xl border border-dashed border-slate-200 mx-2">
              <p className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">Нет данных за период</p>
            </div>
          ) : filteredList.map((o, i) => (
            <div key={i} className="bg-white p-5 rounded-[2rem] shadow-sm border border-slate-50 flex flex-col gap-4">
              <div className="flex justify-between items-start">
                <div className="space-y-1 pr-4">
                  <h4 className="text-[14px] font-semibold text-slate-800 leading-snug">{o.displayTitle}</h4>
                  <p className="text-[10px] font-medium text-indigo-500 uppercase tracking-tight">
                    {o.displayName} • {o.displayEmail}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <span className={`text-[15px] font-bold ${o.pStatus === 'paid' ? 'text-emerald-500' : 'text-slate-900'}`}>{o.displayPrice} ₽</span>
                </div>
              </div>
              <div className="flex items-center justify-between border-t border-slate-50 pt-3">
                <div className={`flex items-center gap-1.5 text-[8px] font-bold uppercase tracking-widest ${o.pStatus === 'paid' ? 'text-emerald-500' : o.pStatus === 'failed' ? 'text-rose-400' : 'text-amber-500'}`}>
                  {o.pStatus === 'paid' ? <CheckCircle size={12} /> : o.pStatus === 'failed' ? <XIcon size={12} /> : <Clock size={12} />}
                  {o.pStatus === 'paid' ? 'Оплачено' : o.pStatus === 'failed' ? 'Архив' : 'Ожидание'}
                </div>
                <div className="text-[9px] font-medium text-slate-400 uppercase tracking-tighter flex items-center gap-1">
                  <Calendar size={10} /> {o.displayDate ? String(o.displayDate).split(',')[0] : '---'}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
