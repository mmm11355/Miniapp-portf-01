
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

  const parseDate = (val: any): number => {
    if (!val) return 0;
    if (typeof val === 'number') return val;
    const std = Date.parse(String(val));
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
        // Очищаем данные от возможных дублей и неправильных форматов
        const remoteSessions = (result.sessions || []).filter((s: any) => s && typeof s === 'object');
        const remoteOrders = (result.orders || []).filter((o: any) => o && typeof o === 'object');

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

  const filteredData = useMemo(() => {
    return {
      sessions: sessions || [],
      orders: orders || []
    };
  }, [sessions, orders]);

  const pathStats = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredData.sessions.forEach(s => {
      const label = s.city || 'Unknown';
      counts[label] = (counts[label] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value).slice(0, 5);
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
  const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316'];

  if (!mounted) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between px-2">
        <h2 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Аналитика</h2>
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
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm">
              <p className="text-[8px] text-slate-400 font-black uppercase mb-1">Визиты</p>
              <p className="text-2xl font-black text-slate-900">{filteredData.sessions.length}</p>
            </div>
            <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm">
              <p className="text-[8px] text-slate-400 font-black uppercase mb-1">Заказы</p>
              <p className="text-2xl font-black text-slate-900">{filteredData.orders.length}</p>
            </div>
          </div>
          <div className="bg-white p-6 rounded-[2rem] border border-slate-100">
             <h3 className="text-[9px] font-black uppercase text-slate-400 mb-4">География визитов</h3>
             <div className="w-full h-[150px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={pathStats}>
                    <XAxis dataKey="name" fontSize={8} />
                    <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
             </div>
          </div>
        </div>
      )}

      {activeTab === 'stats' && (
        <div className="bg-white p-6 rounded-[2rem] border border-slate-100">
           <h3 className="text-[9px] font-black uppercase text-slate-400 mb-4">Источники</h3>
           <div className="w-full h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={utmStats} innerRadius={40} outerRadius={70} dataKey="value" stroke="none">
                    {utmStats.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend wrapperStyle={{fontSize: '9px', fontWeight: 'bold'}} />
                </PieChart>
              </ResponsiveContainer>
           </div>
        </div>
      )}

      {activeTab === 'leads' && (
        <div className="space-y-3">
          {filteredData.orders.length === 0 ? (
            <div className="py-10 text-center text-slate-300 text-[10px] font-black uppercase">Нет данных</div>
          ) : (
            filteredData.orders.map((o, i) => (
              <div key={i} className="bg-white p-4 rounded-2xl border border-slate-100 flex justify-between items-center shadow-sm">
                <div className="overflow-hidden">
                  <p className="font-black text-xs text-slate-900 truncate">{o.productTitle || 'Товар'}</p>
                  <p className="text-[9px] text-slate-400 font-bold">{o.customerEmail || 'No Email'}</p>
                </div>
                <div className="bg-indigo-50 text-indigo-600 px-3 py-1 rounded-lg text-[10px] font-black whitespace-nowrap">{o.price}₽</div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
