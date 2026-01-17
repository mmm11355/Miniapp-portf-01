
import React, { useMemo, useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, ResponsiveContainer, YAxis, Tooltip } from 'recharts';
// Add X to imports from lucide-react
import { RefreshCw, Users, CreditCard, MapPin, ListOrdered, CheckCircle, Clock, User, Archive, Activity, X } from 'lucide-react';

const AdminDashboard: React.FC = () => {
  const [sessions, setSessions] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'active' | 'archive'>('active');

  const fetchData = async () => {
    setLoading(true);
    try {
      const config = localStorage.getItem('olga_tg_config');
      if (!config) return;
      const { googleSheetWebhook } = JSON.parse(config);
      const res = await fetch(`${googleSheetWebhook}?action=getStats&_t=${Date.now()}`);
      const data = await res.json();
      if (data.status === 'success') {
        setSessions(data.sessions || []);
        setOrders(data.orders || []);
      }
    } catch (e) {} finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const stats = useMemo(() => {
    const counts: Record<string, number> = {};
    sessions.forEach(s => { 
      const label = s.city || 'Неизвестно'; 
      counts[label] = (counts[label] || 0) + 1; 
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value).slice(0, 5);
  }, [sessions]);

  const filteredOrders = useMemo(() => {
    if (activeTab === 'active') {
      return orders.filter(o => o.paymentStatus !== 'failed');
    }
    return orders.filter(o => o.paymentStatus === 'failed');
  }, [orders, activeTab]);

  return (
    <div className="space-y-8 page-transition pb-20">
      <div className="flex justify-between items-center px-2">
        <h2 className="text-[11px] font-black uppercase tracking-[0.3em] text-indigo-600">Системный мониторинг</h2>
        <button onClick={fetchData} className={`p-3 rounded-2xl bg-slate-50 transition-all ${loading ? 'animate-spin' : ''}`}>
           <RefreshCw size={18} className="text-indigo-600" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-[#f8f7ff] p-6 rounded-[2rem] border border-slate-50 shadow-sm space-y-2">
          <div className="flex items-center gap-2 text-indigo-600 mb-2"><Users size={16} /><span className="text-[10px] font-black uppercase tracking-widest">Визиты</span></div>
          <p className="text-4xl font-black text-slate-900">{sessions.length}</p>
        </div>
        <div className="bg-[#f8f7ff] p-6 rounded-[2rem] border border-slate-50 shadow-sm space-y-2">
          <div className="flex items-center gap-2 text-emerald-600 mb-2"><CreditCard size={16} /><span className="text-[10px] font-black uppercase tracking-widest">Заказы</span></div>
          <p className="text-4xl font-black text-slate-900">{orders.filter(o => o.paymentStatus === 'paid').length}</p>
        </div>
      </div>

      <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 premium-shadow space-y-6">
        <div className="flex items-center gap-3"><User size={20} className="text-indigo-600" /><h3 className="text-xs font-black uppercase tracking-widest text-slate-800">Активность пользователей</h3></div>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats} layout="vertical">
              <XAxis type="number" hide />
              <YAxis dataKey="name" type="category" width={120} fontSize={10} axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontWeight: 700}} />
              <Tooltip cursor={{fill: 'transparent'}} contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 20px rgba(0,0,0,0.05)'}} />
              <Bar dataKey="value" fill="#6366f1" radius={[0, 8, 8, 0]} barSize={24} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-3">
            <ListOrdered size={20} className="text-indigo-600" />
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-800">Журнал продаж</h3>
          </div>
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button 
              onClick={() => setActiveTab('active')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${activeTab === 'active' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}
            >
              <Activity size={12} /> Активные
            </button>
            <button 
              onClick={() => setActiveTab('archive')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${activeTab === 'archive' ? 'bg-white text-rose-500 shadow-sm' : 'text-slate-400'}`}
            >
              <Archive size={12} /> Архив
            </button>
          </div>
        </div>
        
        <div className="space-y-3">
          {filteredOrders.length === 0 ? <p className="text-center text-slate-300 py-10 font-bold uppercase text-[10px]">{activeTab === 'active' ? 'Активных заказов нет' : 'Архив пуст'}</p> : 
            filteredOrders.slice(0, 30).map((o, i) => (
              <div key={i} className={`bg-white border border-slate-50 p-6 rounded-[2rem] premium-shadow transition-all ${o.paymentStatus === 'failed' ? 'opacity-60 border-rose-50' : 'hover:border-indigo-100'}`}>
                <div className="flex justify-between items-start mb-4">
                  <div className="space-y-1">
                    <p className="text-sm font-black text-slate-900">{o.productTitle || 'Товар'}</p>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-tight">{o.tgUsername || '@guest'}</span>
                      <span className="text-[10px] text-slate-300">|</span>
                      <span className="text-[10px] font-medium text-slate-400">{o.customerName}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-sm font-black ${o.paymentStatus === 'failed' ? 'text-slate-400' : 'text-indigo-600'}`}>{o.price} ₽</div>
                    <div className="text-[9px] font-bold text-slate-300 uppercase">{new Date(o.timestamp).toLocaleDateString()}</div>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-slate-50">
                  <div className="flex items-center gap-2">
                    {o.paymentStatus === 'paid' ? (
                      <div className="flex items-center gap-1.5 text-[9px] font-black text-emerald-500 uppercase tracking-wider">
                        <CheckCircle size={14} /> Оплачено
                      </div>
                    ) : o.paymentStatus === 'failed' ? (
                      <div className="flex items-center gap-1.5 text-[9px] font-black text-rose-400 uppercase tracking-wider">
                        <X size={14} /> Отменено
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-[9px] font-black text-amber-500 uppercase tracking-wider">
                        <Clock size={14} /> Ожидание
                      </div>
                    )}
                  </div>
                  <span className="text-[9px] font-bold text-slate-400 uppercase">{o.customerPhone}</span>
                </div>
              </div>
            ))
          }
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
