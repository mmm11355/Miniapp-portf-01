
import React, { useMemo, useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { analyticsService } from '../services/analyticsService';
import { Users, Clock, MapPin, MousePointer, Calendar, ShoppingCart, Target, Globe, ArrowUpRight, TrendingUp, RefreshCw, Filter } from 'lucide-react';

const AdminDashboard: React.FC = () => {
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'stats' | 'leads'>('overview');
  const [timeFilter, setTimeFilter] = useState<'day' | 'week' | 'month' | 'all'>('all');
  const [loadingGlobal, setLoadingGlobal] = useState(false);
  
  const [sessions, setSessions] = useState(analyticsService.getSessions());
  const [orders, setOrders] = useState(analyticsService.getOrders());

  const fetchGlobalData = async () => {
    const config = localStorage.getItem('olga_tg_config');
    if (!config) return;
    const { googleSheetWebhook } = JSON.parse(config);
    if (!googleSheetWebhook) return;

    setLoadingGlobal(true);
    try {
      // Пытаемся получить данные. Скрипт в Google Таблицах должен поддерживать GET запрос с параметром action=getStats
      const response = await fetch(`${googleSheetWebhook}?action=getStats`);
      const result = await response.json();
      if (result.status === 'success') {
        setSessions(result.sessions || sessions);
        setOrders(result.orders || orders);
      }
    } catch (e) {
      console.warn("Could not fetch global stats, using local data", e);
    } finally {
      setLoadingGlobal(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setMounted(true);
      fetchGlobalData();
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  const filteredData = useMemo(() => {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    const periods = {
      day: now - day,
      week: now - day * 7,
      month: now - day * 30,
      all: 0
    };
    const minTime = periods[timeFilter];

    return {
      sessions: sessions.filter(s => s.startTime >= minTime),
      orders: orders.filter(o => o.timestamp >= minTime)
    };
  }, [sessions, orders, timeFilter]);

  const pathData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredData.sessions.forEach(s => {
      s.pathHistory.forEach(p => {
        counts[p] = (counts[p] || 0) + 1;
      });
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [filteredData.sessions]);

  const utmData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredData.sessions.forEach(s => {
      const src = s.utmSource || 'direct';
      counts[src] = (counts[src] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredData.sessions]);

  const cityData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredData.sessions.forEach(s => {
      const city = s.city || 'Неизвестно';
      counts[city] = (counts[city] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [filteredData.sessions]);

  const revenue = useMemo(() => filteredData.orders.reduce((acc, o) => acc + o.price, 0), [filteredData.orders]);
  const conversion = useMemo(() => {
    if (filteredData.sessions.length === 0) return 0;
    const uniqueOrderEmails = new Set(filteredData.orders.map(o => o.customerEmail)).size;
    return ((uniqueOrderEmails / filteredData.sessions.length) * 100).toFixed(1);
  }, [filteredData.sessions, filteredData.orders]);

  const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316'];

  if (!mounted) return <div className="h-64 flex items-center justify-center text-slate-300 font-black text-[9px] uppercase tracking-widest animate-pulse">Загрузка данных...</div>;

  return (
    <div className="space-y-6">
      {/* Time Filter Switcher */}
      <div className="flex items-center justify-between px-2">
        <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
          {[
            { id: 'day', label: 'День' },
            { id: 'week', label: 'Нед' },
            { id: 'month', label: 'Мес' },
            { id: 'all', label: 'Все' }
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setTimeFilter(f.id as any)}
              className={`px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-wider transition-all ${
                timeFilter === f.id ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <button 
          onClick={fetchGlobalData}
          disabled={loadingGlobal}
          className={`p-2 rounded-xl bg-indigo-50 text-indigo-600 ${loadingGlobal ? 'animate-spin' : 'active:scale-90'}`}
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Tab Switcher */}
      <div className="flex p-1 bg-slate-100 rounded-2xl gap-1">
        {(['overview', 'stats', 'leads'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
              activeTab === tab ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'
            }`}
          >
            {tab === 'overview' ? 'Обзор' : tab === 'stats' ? 'Трафик' : 'Заказы'}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="space-y-4 animate-in fade-in duration-300">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <Users size={14} className="text-indigo-500" />
                <p className="text-[8px] text-slate-400 font-black uppercase">Визиты</p>
              </div>
              <p className="text-2xl font-black text-slate-900 tracking-tight">{filteredData.sessions.length}</p>
            </div>
            <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <ShoppingCart size={14} className="text-emerald-500" />
                <p className="text-[8px] text-slate-400 font-black uppercase">Заказы</p>
              </div>
              <p className="text-2xl font-black text-slate-900 tracking-tight">{filteredData.orders.length}</p>
            </div>
            <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp size={14} className="text-amber-500" />
                <p className="text-[8px] text-slate-400 font-black uppercase">Конверсия</p>
              </div>
              <p className="text-2xl font-black text-slate-900 tracking-tight">{conversion}%</p>
            </div>
            <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <ArrowUpRight size={14} className="text-indigo-500" />
                <p className="text-[8px] text-slate-400 font-black uppercase">Оборот</p>
              </div>
              <p className="text-2xl font-black text-slate-900 tracking-tight">{revenue}₽</p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm">
            <div className="flex items-center gap-2 mb-6">
              <Target size={16} className="text-indigo-600" />
              <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Популярные разделы</h2>
            </div>
            <div className="w-full h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={pathData} margin={{ top: 0, right: 0, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontWeight: 'bold'}} />
                  <YAxis fontSize={10} axisLine={false} tickLine={false} tick={{fill: '#94a3b8'}} />
                  <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', fontSize: '11px', fontWeight: 'bold' }} />
                  <Bar dataKey="value" fill="#6366f1" radius={[6, 6, 0, 0]} barSize={32} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'stats' && (
        <div className="space-y-4 animate-in fade-in duration-300">
           <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm">
            <div className="flex items-center gap-2 mb-6">
              <Target size={16} className="text-rose-500" />
              <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Источники (UTM Source)</h2>
            </div>
            <div className="w-full h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={utmData} cx="50%" cy="50%" innerRadius="60%" outerRadius="90%" paddingAngle={8} dataKey="value" stroke="none">
                    {utmData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', fontWeight: 'bold' }} />
                  <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', paddingTop: '20px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Globe size={16} className="text-indigo-600" />
              <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Топ Городов</h2>
            </div>
            <div className="space-y-3">
              {cityData.map((city, i) => (
                <div key={city.name} className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center font-black text-[10px] text-indigo-600 shadow-sm">{i + 1}</div>
                    <span className="font-bold text-xs text-slate-700">{city.name}</span>
                  </div>
                  <span className="font-black text-xs text-slate-400">{city.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'leads' && (
        <div className="space-y-4 animate-in fade-in duration-300">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Последние заказы ({filteredData.orders.length})</h2>
          </div>
          <div className="space-y-3">
            {filteredData.orders.length === 0 ? (
              <div className="py-20 text-center space-y-4">
                <ShoppingCart size={40} className="mx-auto text-slate-200" />
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Заказов за период нет</p>
              </div>
            ) : (
              [...filteredData.orders].reverse().map((order) => (
                <div key={order.id} className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-black text-sm text-slate-900 tracking-tight leading-tight">{order.productTitle}</h4>
                      <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">{new Date(order.timestamp).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                    <div className="bg-emerald-50 text-emerald-600 px-4 py-2 rounded-xl text-xs font-black">{order.price}₽</div>
                  </div>
                  <div className="pt-2 border-t border-slate-50 flex items-center gap-4">
                     <div className="flex-1">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Клиент</p>
                        <p className="text-xs font-bold text-slate-700 truncate">{order.customerName}</p>
                     </div>
                     <div className="flex-1">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Источник</p>
                        <p className="text-xs font-bold text-rose-400 uppercase tracking-tighter">{order.utmSource}</p>
                     </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
