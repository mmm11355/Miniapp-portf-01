
import React, { useMemo, useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, ResponsiveContainer, YAxis, Tooltip } from 'recharts';
import { RefreshCw, Users, CreditCard, MapPin, ListOrdered, CheckCircle, Clock } from 'lucide-react';

const AdminDashboard: React.FC = () => {
  const [sessions, setSessions] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

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
        // Синхронизируем локальные статусы с данными из таблицы
        setOrders(data.orders || []);
      }
    } catch (e) {} finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const stats = useMemo(() => {
    const counts: Record<string, number> = {};
    sessions.forEach(s => { const city = s.city || 'Неизвестно'; counts[city] = (counts[city] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value).slice(0, 5);
  }, [sessions]);

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
          <p className="text-4xl font-black text-slate-900">{orders.length}</p>
        </div>
      </div>

      <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 premium-shadow space-y-6">
        <div className="flex items-center gap-3"><MapPin size={20} className="text-indigo-600" /><h3 className="text-xs font-black uppercase tracking-widest text-slate-800">География</h3></div>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats} layout="vertical">
              <XAxis type="number" hide />
              <YAxis dataKey="name" type="category" width={100} fontSize={10} axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontWeight: 700}} />
              <Tooltip cursor={{fill: 'transparent'}} contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 20px rgba(0,0,0,0.05)'}} />
              <Bar dataKey="value" fill="#6366f1" radius={[0, 8, 8, 0]} barSize={24} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-3 px-2"><ListOrdered size={20} className="text-indigo-600" /><h3 className="text-xs font-black uppercase tracking-widest text-slate-800">Журнал продаж</h3></div>
        <div className="space-y-3">
          {orders.length === 0 ? <p className="text-center text-slate-300 py-10 font-bold uppercase text-[10px]">Заказов пока нет</p> : 
            orders.slice(0, 10).map((o, i) => (
              <div key={i} className="bg-white border border-slate-50 p-6 rounded-[2rem] premium-shadow transition-all hover:border-indigo-100">
                <div className="flex justify-between items-start mb-4">
                  <div className="space-y-1">
                    <p className="text-sm font-black text-slate-900">{o.productTitle || 'Товар'}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{o.customerEmail || 'No Email'}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-black text-indigo-600">{o.price} ₽</div>
                    <div className="text-[9px] font-bold text-slate-300 uppercase">{new Date(o.timestamp).toLocaleDateString()}</div>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-slate-50">
                  <div className="flex items-center gap-2">
                    {o.paymentStatus === 'paid' ? (
                      <div className="flex items-center gap-1.5 text-[9px] font-black text-emerald-500 uppercase tracking-wider">
                        <CheckCircle size={14} /> Оплачено
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-[9px] font-black text-amber-500 uppercase tracking-wider">
                        <Clock size={14} /> В ожидании
                      </div>
                    )}
                  </div>
                  <span className="text-[9px] font-bold text-slate-400 uppercase">{o.customerName}</span>
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
