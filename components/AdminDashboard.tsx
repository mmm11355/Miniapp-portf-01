
import React, { useMemo, useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, ResponsiveContainer, YAxis, Tooltip } from 'recharts';
import { RefreshCw, Users, CreditCard, ListOrdered, CheckCircle, Clock, User, Archive, Activity, X } from 'lucide-react';

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

      // Если заказ старый (10 мин+) и не оплачен — ПРИНУДИТЕЛЬНО считаем его архивным
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
    <div className="space-y-8 pb-10 page-transition">
      <div className="flex justify-between items-center px-2">
        <h2 className="text-[11px] font-black uppercase tracking-[0.3em] text-indigo-600">Системный мониторинг</h2>
        <button onClick={fetchData} className={`p-3 rounded-2xl bg-white shadow-sm transition-all ${loading ? 'animate-spin' : ''}`}>
           <RefreshCw size={18} className="text-indigo-600" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-50">
          <div className="flex items-center gap-2 text-indigo-600 mb-1"><Users size={14} /><span className="text-[9px] font-black uppercase">Визиты</span></div>
          <p className="text-3xl font-black">{sessions.length}</p>
        </div>
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-50">
          <div className="flex items-center gap-2 text-emerald-600 mb-1"><CreditCard size={14} /><span className="text-[9px] font-black uppercase">Оплачено</span></div>
          <p className="text-3xl font-black">{processedOrders.filter(o => o.paymentStatus === 'paid').length}</p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between px-2">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-800">Журнал продаж</h3>
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button onClick={() => setActiveTab('active')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${activeTab === 'active' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>Активные</button>
            <button onClick={() => setActiveTab('archive')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${activeTab === 'archive' ? 'bg-white text-rose-500 shadow-sm' : 'text-slate-400'}`}>Архив</button>
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
                <div key={i} className={`bg-white p-6 rounded-[2rem] shadow-sm border border-slate-50 transition-all ${isFailed ? 'opacity-70' : ''}`}>
                  <div className="flex justify-between items-start mb-4">
                    <div className="space-y-1">
                      <p className="text-sm font-black text-slate-900 leading-tight">{o.productTitle || 'Без названия'}</p>
                      <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-tight">{o.tgUsername || '@guest'} | {o.customerName || 'Покупатель'}</p>
                    </div>
                    <div className="text-right flex-shrink-0 ml-4">
                      <div className={`text-sm font-black ${isPaid ? 'text-emerald-500' : 'text-indigo-600'}`}>{o.price} ₽</div>
                      <div className="text-[9px] font-bold text-slate-300 uppercase">{o.dateStr ? o.dateStr.split(',')[0] : ''}</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-3 border-t border-slate-50">
                    <div className={`flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider ${isPaid ? 'text-emerald-500' : isFailed ? 'text-rose-400' : 'text-amber-500'}`}>
                      {isPaid ? <CheckCircle size={14} /> : isFailed ? <X size={14} /> : <Clock size={14} />}
                      {isPaid ? 'Оплачено' : isFailed ? 'Отменено' : 'Ожидание'}
                    </div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase">{o.customerPhone}</span>
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
