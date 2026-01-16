
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { analyticsService } from '../services/analyticsService';
import { Users, Clock, MapPin, MousePointer, Calendar, ShoppingCart, Target, Globe, ArrowUpRight, TrendingUp, RefreshCw, Filter } from 'lucide-react';
import React, { useMemo, useState, useEffect } from 'react';

const AdminDashboard: React.FC = () => {
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'stats' | 'leads'>('overview');
  const [timeFilter, setTimeFilter] = useState<'day' | 'week' | 'month' | 'all'>('all');
  const [loadingGlobal, setLoadingGlobal] = useState(false);
  
  const [sessions, setSessions] = useState(analyticsService.getSessions());
  const [orders, setOrders] = useState(analyticsService.getOrders());

  // Ультимативный парсер дат
  const parseDate = (val: any): number => {
    if (!val) return 0;
    if (typeof val === 'number') return val;
    
    const str = String(val).trim();
    // Обработка ДД.ММ.ГГГГ
    if (str.includes('.')) {
      const parts = str.split(/[. :]/);
      if (parts.length >= 3) {
        const d = parts[0].padStart(2, '0');
        const m = parts[1].padStart(2, '0');
        const y = parts[2];
        const h = parts[3] || '00';
        const min = parts[4] || '00';
        const iso = `${y}-${m}-${d}T${h.padStart(2, '0')}:${min.padStart(2, '0')}:00`;
        const p = Date.parse(iso);
        if (!isNaN(p)) return p;
      }
    }
    
    const std = Date.parse(str);
    return isNaN(std) ? 0 : std;
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
        const remoteSessions = (result.sessions || []).map((s: any) => ({...s, startTime: parseDate(s.startTime)}));
        const remoteOrders = (result.orders || []).map((o: any) => ({...o, timestamp: parseDate(o.timestamp)}));

        setSessions(prev => {
          const local = prev.map(s => ({...s, startTime: parseDate(s.startTime)}));
          const combined = [...remoteSessions];
          local.forEach(l => {
            if (!combined.find(c => c.id === l.id)) combined.push(l);
          });
          return combined;
        });

        setOrders(prev => {
          const local = prev.map(o => ({...o, timestamp: parseDate(o.timestamp)}));
          const combined = [...remoteOrders];
          local.forEach(l => {
            if (!combined.find(c => c.id === l.id)) combined.push(l);
          });
          return combined;
        });
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

  const filteredData = useMemo(() => {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const limits = {
      day: now - dayMs,
      week: now - dayMs * 7,
      month: now - dayMs * 30,
      all: 0
    };
    const min = limits[timeFilter];

    return {
      sessions: sessions.filter(s => s.startTime >= min),
      orders: orders.filter(o => o.timestamp >= min)
    };
  }, [sessions, orders, timeFilter]);

  const pathStats = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredData.sessions.forEach(s => {
      const paths = Array.isArray(s.pathHistory) ? s.pathHistory : ['home'];
      paths.forEach(p => {
        const label = p === 'home' ? 'Главная' : p === 'shop' ? 'Магазин' : p === 'portfolio' ? 'Кейсы' : p === 'bonuses' ? 'Бонусы' : p;
        counts[label] = (counts[label] || 0) + 1;
      });
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value);
  }, [filteredData.sessions]);

  const utmStats = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredData.sessions.forEach(s => {
      const src = s.utmSource || 'direct';
      counts[src] = (counts[src] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [filteredData.sessions]);

  const revenue = useMemo(() => filteredData.orders.reduce((acc, o) => acc + (Number(o.price) || 0), 0), [filteredData.orders]);
  const conv = useMemo(() => filteredData.sessions.length ? ((new Set(filteredData.orders.map(o => o.customerEmail)).size / filteredData.sessions.length) * 100).toFixed(1) : 0, [filteredData.sessions, filteredData.orders]);

  const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316'];

  if (!mounted) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between px-2">
        <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
          {['day', 'week', 'month', 'all'].map((f) => (
            <button key={f} onClick={() => setTimeFilter(f as any)} className={`px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-wider transition-all ${timeFilter === f ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>
              {f === 'day' ? 'День' : f === 'week' ? 'Нед' : f === 'month' ? 'Мес' : 'Все'}
            </button>
          ))}
        </div>
        <button onClick={fetchGlobalData} disabled={loadingGlobal} className={`p-2 rounded-xl bg-indigo-50 text-indigo-600 ${loadingGlobal ? 'animate-spin' : ''}`}>
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
              <div className="flex items-center gap-2 mb-2"><Users size={14} className="text-indigo-500"/><p className="text-[8px] text-slate-400 font-black uppercase">Визиты</p></div>
              <p className="text-2xl font-black text-slate-900">{filteredData.sessions.length}</p>
            </div>
            <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm">
              <div className="flex items-center gap-2 mb-2"><ShoppingCart size={14} className="text-emerald-500"/><p className="text-[8px] text-slate-400 font-black uppercase">Заказы</p></div>
              <p className="text-2xl font-black text-slate-900">{filteredData.orders.length}</p>
            </div>
            <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm">
              <div className="flex items-center gap-2 mb-2"><TrendingUp size={14} className="text-amber-500"/><p className="text-[8px] text-slate-400 font-black uppercase">Конверсия</p></div>
              <p className="text-2xl font-black text-slate-900">{conv}%</p>
            </div>
            <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm">
              <div className="flex items-center gap-2 mb-2"><ArrowUpRight size={14} className="text-indigo-500"/><p className="text-[8px] text-slate-400 font-black uppercase">Оборот</p></div>
              <p className="text-2xl font-black text-slate-900">{revenue}₽</p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm">
             <div className="flex items-center gap-2 mb-6">
              <Target size={16} className="text-indigo-600" />
              <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Популярные разделы</h2>
            </div>
            <div className="w-full h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={pathStats} margin={{ top: 0, right: 0, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" fontSize={9} axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontWeight: 'bold'}} />
                  <YAxis fontSize={9} axisLine={false} tickLine={false} tick={{fill: '#94a3b8'}} />
                  <Tooltip cursor={{ fill: '#f8fafc' }} />
                  <Bar dataKey="value" fill="#6366f1" radius={[6, 6, 0, 0]} barSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'stats' && (
        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm animate-in fade-in duration-300">
           <div className="flex items-center gap-2 mb-6">
              <Globe size={16} className="text-rose-500" />
              <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Источники трафика</h2>
            </div>
            <div className="w-full h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={utmStats} cx="50%" cy="50%" innerRadius="55%" outerRadius="85%" paddingAngle={8} dataKey="value" stroke="none">
                    {utmStats.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', paddingTop: '20px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
        </div>
      )}

      {activeTab === 'leads' && (
        <div className="space-y-3 animate-in fade-in duration-300">
          {filteredData.orders.length === 0 ? (
            <div className="py-20 text-center text-slate-300 font-black text-[10px] uppercase tracking-widest">Нет заказов</div>
          ) : (
            [...filteredData.orders].sort((a,b) => b.timestamp - a.timestamp).map(o => (
              <div key={o.id} className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm flex justify-between items-center">
                <div>
                  <h4 className="font-black text-sm text-slate-900 tracking-tight">{o.productTitle}</h4>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{new Date(o.timestamp).toLocaleString('ru-RU')}</p>
                </div>
                <div className="bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-xl text-xs font-black">{o.price}₽</div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
