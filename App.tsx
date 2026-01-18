
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Layout from './components/Layout';
import AdminDashboard from './components/AdminDashboard';
import { ViewState, Product, TelegramConfig, OrderLog } from './types';
import { INITIAL_PRODUCTS, ADMIN_PASSWORD } from './constants';
import { analyticsService } from './services/analyticsService';
import { 
  X, ChevronRight, Send, Gift, Sparkles, CreditCard, PlayCircle, ChevronLeft, 
  Trophy, Award, Briefcase as BriefcaseIcon, Globe, ShieldCheck, ShoppingBag, Clock, CheckCircle, MessageCircle
} from 'lucide-react';

const App: React.FC = () => {
  const [view, setView] = useState<ViewState>('home');
  const [isSyncing, setIsSyncing] = useState(false);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const isProcessingRef = useRef(false); 
  
  const [products, setProducts] = useState<Product[]>(() => {
    try {
      const saved = localStorage.getItem('olga_products_v28');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return INITIAL_PRODUCTS;
  });

  const [telegramConfig, setTelegramConfig] = useState<TelegramConfig>(() => {
    try {
      const saved = localStorage.getItem('olga_tg_config');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return { 
      botToken: '8319068202:AAERCkMtwnWXNGHLSN246DQShyaOHDK6z58', 
      chatId: '-1002095569247',
      googleSheetWebhook: 'https://script.google.com/macros/s/AKfycby3JT65rFs7fB4n7GYph3h6qonOEERRxiyhD11DRD9lT4TkDCin9Q4uF5vcclXPpt46/exec'
    };
  });

  const sanitize = (str: string) => (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

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

  useEffect(() => {
    const monitorOrders = async () => {
      if (isProcessingRef.current) return;
      isProcessingRef.current = true;

      try {
        const localOrders = analyticsService.getOrders();
        const now = Date.now();
        const processedCancelled = JSON.parse(localStorage.getItem('olga_processed_cancelled') || '[]').map(String);
        
        let cloudOrders: any[] = [];
        if (telegramConfig.googleSheetWebhook) {
          try {
            const res = await fetch(`${telegramConfig.googleSheetWebhook}?action=getStats&_t=${Date.now()}`, { 
              method: 'GET',
              redirect: 'follow',
              cache: 'no-store' 
            });
            const data = await res.json();
            if (data.status === 'success') {
              cloudOrders = data.orders || data.data?.orders || [];
            }
          } catch (e) {}
        }

        const allOrdersToCheck = [...localOrders];
        cloudOrders.forEach(co => {
          if (!allOrdersToCheck.find(lo => String(lo.id) === String(co.id))) allOrdersToCheck.push(co);
        });

        for (const order of allOrdersToCheck) {
          const orderIdStr = String(order.id);
          const cloudInfo = cloudOrders.find((co: any) => String(co.id) === orderIdStr);
          const currentStatus = (cloudInfo?.paymentStatus || order.paymentStatus || '').toLowerCase();
          
          const isPaid = currentStatus.includes('оплачено') || currentStatus === 'paid';
          const isFailed = currentStatus.includes('отменен') || currentStatus.includes('архив') || currentStatus === 'failed';
          const isPending = currentStatus.includes('ожидание') || currentStatus === 'pending';
          
          const orderTime = parseSafeDate(cloudInfo?.timestamp || order.timestamp);
          
          if (orderTime > 0 && isPending && !isPaid && !isFailed && (now - orderTime) > 10 * 60 * 1000) {
            if (!processedCancelled.includes(orderIdStr)) {
              await analyticsService.updateOrderStatus(orderIdStr, 'failed');
              processedCancelled.push(orderIdStr);
              localStorage.setItem('olga_processed_cancelled', JSON.stringify(processedCancelled));

              if (telegramConfig.botToken && telegramConfig.chatId) {
                const cancelMsg = `<b>🔴 АВТО-АРХИВАЦИЯ (10 МИН+)</b>\n\n<b>ID:</b> <code>${orderIdStr}</code>\n<b>Товар:</b> ${sanitize(order.productTitle)}\n<b>Имя:</b> ${sanitize(order.customerName)}\n<b>Email:</b> ${sanitize(order.customerEmail)}\n<b>Username:</b> ${order.tgUsername || '---'}`;
                fetch(`https://api.telegram.org/bot${telegramConfig.botToken}/sendMessage`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ chat_id: telegramConfig.chatId, text: cancelMsg, parse_mode: 'HTML' })
                }).catch(() => {});
              }
            }
          }
        }
      } catch (e) {
      } finally {
        isProcessingRef.current = false;
      }
    };

    monitorOrders();
    const interval = setInterval(monitorOrders, 30000);
    return () => clearInterval(interval);
  }, [telegramConfig]);

  const syncWithCloud = useCallback(async (showLoading = false) => {
    if (!telegramConfig.googleSheetWebhook) return;
    if (showLoading) setIsSyncing(true);
    try {
      const response = await fetch(`${telegramConfig.googleSheetWebhook}?action=getProducts&_t=${Date.now()}`, { redirect: 'follow' });
      const rawData = await response.json();
      if (rawData && Array.isArray(rawData)) {
        const sanitizedData = rawData
          .filter((item: any) => (item.title || item.Title)?.trim())
          .map((item: any, index: number) => {
            const p: any = {};
            Object.keys(item).forEach(key => { p[key.trim().toLowerCase()] = item[key]; });
            let gallery = [];
            try { gallery = typeof (p.detailgallery || p.detailGallery) === 'string' ? JSON.parse(p.detailgallery || p.detailGallery) : (p.detailgallery || p.detailGallery || []); } catch (e) {}
            return {
              ...p,
              id: p.id ? String(p.id) : `row-${index + 2}`,
              title: p.title || 'Без названия',
              description: p.description || '',
              category: p.category || 'GetCourse',
              price: (isNaN(Number(p.price)) || p.price === "") ? String(p.price || 0) : Number(p.price),
              imageUrl: p.imageurl || p.imageUrl || '',
              mediaType: (p.mediatype || p.mediaType) === 'video' ? 'video' : 'image',
              section: (['bonus', 'bonuses', 'бонусы'].includes(String(p.section).toLowerCase())) ? 'bonus' : (['portfolio', 'кейсы'].includes(String(p.section).toLowerCase())) ? 'portfolio' : 'shop',
              useDetailModal: String(p.usedetailmodal || p.useDetailModal).toLowerCase() === 'true',
              buttonText: p.buttontext || p.buttonText || '',
              buttonColor: p.buttoncolor || p.buttonColor || '#6366f1',
              titleColor: p.titlecolor || p.titleColor || '#1e293b',
              cardBgColor: p.cardbgcolor || p.cardBgColor || '#f8fafc',
              prodamusId: p.prodamusid || p.prodamusId || '',
              externalLink: p.externallink || p.externalLink || '',
              detailFullDescription: p.detailfulldescription || p.detailFullDescription || '',
              detailButtonText: p.detailbuttontext || p.detailbutton || p.кнопкалонгрида || p.detailButtonText || p.buttontext || p.buttonText || '', 
              detailGallery: gallery
            };
          });
        setProducts(sanitizedData);
        localStorage.setItem('olga_products_v28', JSON.stringify(sanitizedData));
      }
    } catch (e) {} finally { if (showLoading) setIsSyncing(false); }
  }, [telegramConfig.googleSheetWebhook]);

  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp;
    if (tg) { tg.ready(); tg.expand(); }
    syncWithCloud(true);
    analyticsService.startSession().then(setSessionId);
  }, [syncWithCloud]);

  const [sessionId, setSessionId] = useState<string>('');
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [filter, setFilter] = useState<string>('All');
  const [activeDetailProduct, setActiveDetailProduct] = useState<Product | null>(null);
  const [checkoutProduct, setCheckoutProduct] = useState<Product | null>(null);
  const [activePaymentUrl, setActivePaymentUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [agreedToOferta, setAgreedToOferta] = useState(false);
  const [agreedToPrivacy, setAgreedToPrivacy] = useState(false);
  const [agreedToMarketing, setAgreedToMarketing] = useState(false);

  useEffect(() => {
    if (sessionId) analyticsService.updateSessionPath(sessionId, view);
    window.scrollTo(0, 0);
  }, [view, sessionId]);

  const portfolioItems = useMemo(() => products.filter(p => p.section === 'portfolio'), [products]);
  const bonuses = useMemo(() => products.filter(p => p.section === 'bonus'), [products]);
  const filteredProducts = useMemo(() => products.filter(p => p.section === 'shop' && (filter === 'All' || p.category === filter)), [products, filter]);
  const categories = useMemo(() => Array.from(new Set(products.filter(p => p.section === 'shop').map(p => p.category))).filter(Boolean), [products]);

  const handleNavigate = (newView: ViewState) => { 
    setView(newView); 
    setActiveDetailProduct(null); 
    setCheckoutProduct(null);      
    setFullscreenImage(null);     
    setActivePaymentUrl(null);    
    setIframeLoaded(false);       
    window.scrollTo(0, 0); 
  };

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkoutProduct || isSubmitting || !agreedToOferta || !agreedToPrivacy) return;
    setIsSubmitting(true);
    try {
      const order = await analyticsService.logOrder({
        productTitle: checkoutProduct.title, price: checkoutProduct.price,
        customerName, customerEmail, customerPhone, agreedToMarketing,
        utmSource: new URLSearchParams(window.location.search).get('utm_source') || 'direct'
      }, sessionId);

      // ПРЯМОЕ УВЕДОМЛЕНИЕ В TELEGRAM ПРИ СОЗДАНИИ ЗАКАЗА
      if (telegramConfig.botToken && telegramConfig.chatId) {
        const orderMsg = `<b>🆕 НОВЫЙ ЗАКАЗ</b>\n\n<b>Товар:</b> ${sanitize(checkoutProduct.title)}\n<b>Сумма:</b> ${checkoutProduct.price} ₽\n<b>Имя:</b> ${sanitize(customerName)}\n<b>Email:</b> ${sanitize(customerEmail)}\n<b>Тел:</b> ${sanitize(customerPhone)}\n<b>Username:</b> ${order.tgUsername || '---'}\n<b>UTM:</b> ${order.utmSource}`;
        fetch(`https://api.telegram.org/bot${telegramConfig.botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: telegramConfig.chatId, text: orderMsg, parse_mode: 'HTML' })
        }).catch(() => {});
      }

      let paymentUrl = checkoutProduct.prodamusId?.startsWith('http') ? checkoutProduct.prodamusId : 'https://antol.payform.ru/';
      const connector = paymentUrl.includes('?') ? '&' : '?';
      paymentUrl += `${connector}order_id=${order.id}&customer_email=${encodeURIComponent(customerEmail)}&customer_phone=${encodeURIComponent(customerPhone)}`;
      setActivePaymentUrl(paymentUrl);
      setCheckoutProduct(null);
    } catch (err) {} finally { setIsSubmitting(false); }
  };

  const MediaRenderer: React.FC<{ url: string; type: 'image' | 'video'; className?: string; onClick?: () => void; isDetail?: boolean }> = ({ url, type, className, onClick, isDetail }) => {
    if (!url) return null;
    if (url.includes('rutube.ru') || url.includes('youtube.com') || url.includes('youtu.be')) {
      let embedUrl = url;
      if (url.includes('rutube.ru')) embedUrl = url.replace('/video/', '/play/embed/');
      else if (url.includes('watch?v=')) embedUrl = url.replace('watch?v=', 'embed/');
      else if (url.includes('youtu.be/')) embedUrl = url.replace('youtu.be/', 'youtube.com/embed/');
      
      return (
        <div className={`relative w-full aspect-video overflow-hidden shadow-sm bg-black ${isDetail ? 'rounded-2xl' : 'rounded-lg'}`}>
          <iframe src={embedUrl} className="w-full h-full border-none" allowFullScreen></iframe>
        </div>
      );
    }
    if (type === 'video' || url.match(/\.(mp4|webm|mov)$/i)) {
      return (
        <div className={`relative w-full overflow-hidden ${isDetail ? 'rounded-2xl bg-black' : 'h-full'}`} onClick={onClick}>
          <video src={url} className={isDetail ? 'w-full h-auto' : className} autoPlay muted loop playsInline />
        </div>
      );
    }
    return <img src={url} className={isDetail ? 'w-full h-auto rounded-2xl' : className} alt="" onClick={onClick} />;
  };

  const renderRichText = (text: string) => {
    if (!text) return null;
    const parts = text.split(/(\[\[(?:video|image):.*?\]\])/g);
    return parts.map((part, index) => {
      const match = part.match(/\[\[(video|image):(.*?)\]\]/);
      if (match) {
        const [, type, url] = match;
        return (
          <div key={index} className="my-6">
            <MediaRenderer 
              url={url.trim()} 
              type={type as 'video' | 'image'} 
              isDetail={true} 
              onClick={() => type === 'image' && setFullscreenImage(url.trim())} 
            />
          </div>
        );
      }
      return <span key={index} className="whitespace-pre-wrap">{part}</span>;
    });
  };

  return (
    <Layout activeView={view} onNavigate={handleNavigate}>
      {view === 'home' && (
        <div className="space-y-5 animate-in fade-in duration-500 text-center">
          <div className="w-40 h-40 mx-auto relative mb-4">
            <div className="relative w-full h-full bg-white rounded-[2.5rem] p-1.5 shadow-2xl overflow-hidden border-4 border-white">
              <img src="https://i.imgur.com/bQ8ic2w.png" alt="Ольга" className="w-full h-full object-cover rounded-[2.2rem]" />
            </div>
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase leading-none">Ольга Антонова</h1>
          <div className="space-y-1">
            <p className="text-[16px] font-black text-indigo-600 uppercase tracking-widest mt-3">Решения GetCourse & Prodamus.XL</p>
            <p className="text-[12px] font-bold text-slate-500 uppercase tracking-tight">Кастомизация ЛК, сайты, скрипты, настройка</p>
          </div>
          <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-4 text-left">
            <div className="flex items-center gap-4"><Trophy className="text-amber-500" size={18} /><p className="text-[13px] font-bold text-slate-700">Победитель Хакатона EdMarket</p></div>
            <div className="flex items-center gap-4"><Award className="text-indigo-500" size={18} /><p className="text-[13px] font-bold text-slate-700">Специалист GetCourse и Prodamus.XL</p></div>
            <div className="flex items-center gap-4"><BriefcaseIcon className="text-emerald-500" size={18} /><p className="text-[13px] font-bold text-slate-700">60+ реализованных проектов</p></div>
            <div className="flex items-center gap-4">
              <Globe className="text-indigo-400" size={18} />
              <p className="text-[13px] font-bold text-slate-700">Сайт-портфолио <a href="https://vk.cc/cOx50S" target="_blank" className="text-indigo-600 underline ml-1">vk.cc/cOx50S</a></p>
            </div>
          </div>
          <button onClick={() => window.open('https://t.me/Olga_lav', '_blank')} className="w-full bg-indigo-600 text-white p-5 rounded-[10px] shadow-2xl flex items-center justify-between transition-all active:scale-[0.98]">
            <div className="text-left"><h3 className="text-lg font-black uppercase">Нужна помощь?</h3><p className="text-[9px] font-black opacity-70 uppercase tracking-widest">СВЯЗАТЬСЯ В TELEGRAM</p></div>
            <Send size={28} className="opacity-30" />
          </button>
        </div>
      )}

      {view === 'contact' && (
        <div className="space-y-10 text-center animate-in fade-in duration-500 py-10">
          <div className="w-24 h-24 bg-white rounded-[2rem] flex items-center justify-center mx-auto text-indigo-600 shadow-2xl border border-slate-50">
             <MessageCircle size={44} strokeWidth={1.5} />
          </div>
          <div className="space-y-3">
            <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter leading-none">СВЯЗАТЬСЯ<br/>СО МНОЙ</h2>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em]">ОТВЕТ В ТЕЧЕНИЕ ПАРУ ЧАСОВ</p>
          </div>
          
          <button 
            onClick={() => window.open('https://t.me/Olga_lav', '_blank')} 
            className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 text-white p-5 rounded-[10px] shadow-2xl flex items-center justify-between active:scale-[0.98] transition-all"
          >
            <div className="text-left">
              <h3 className="text-lg font-black uppercase leading-none">Написать в TG</h3>
              <p className="text-[8px] font-black opacity-70 uppercase tracking-widest mt-1">ПРЯМАЯ СВЯЗЬ СО МНОЙ</p>
            </div>
            <Send size={24} className="opacity-50" />
          </button>
        </div>
      )}

      {(view === 'portfolio' || view === 'shop' || view === 'bonuses') && (
        <div className="space-y-4">
          {view === 'shop' && (
            <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
              {['All', ...categories].map(c => (
                <button key={c} onClick={() => setFilter(c)} className={`px-5 py-2 rounded-full text-[10px] font-bold uppercase transition-all flex-shrink-0 ${filter === c ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-200 text-slate-600' }`}>
                  {c === 'All' ? 'Все' : c}
                </button>
              ))}
            </div>
          )}
          <div className="grid grid-cols-1 gap-1">
            {(view === 'portfolio' ? portfolioItems : view === 'bonuses' ? bonuses : filteredProducts).map(p => (
              <div key={p.id} style={{ backgroundColor: p.cardBgColor }} className="rounded-2xl border border-slate-100 border-opacity-10 overflow-hidden shadow-sm flex flex-col mb-5 p-4 transition-all">
                <div className="flex justify-between items-center mb-2">
                  <span style={{ color: p.buttonColor }} className="text-[10px] font-black uppercase tracking-widest opacity-60">{p.category}</span>
                  <Sparkles size={14} style={{ color: p.buttonColor }} className="opacity-30" />
                </div>
                <h3 style={{ color: p.titleColor }} className="text-[17px] font-bold leading-tight mb-1">{p.title}</h3>
                <div style={{ color: p.buttonColor }} className="text-[15px] font-black mb-3">{p.price} ₽</div>
                <div className="aspect-video relative bg-slate-50 rounded-xl overflow-hidden mb-4">
                  <MediaRenderer url={p.imageUrl} type={p.mediaType} className="w-full h-full object-cover" onClick={() => p.useDetailModal && setActiveDetailProduct(p)} />
                </div>
                <button onClick={() => p.useDetailModal ? setActiveDetailProduct(p) : (p.section === 'shop' ? setCheckoutProduct(p) : window.open(p.externalLink, '_blank'))} style={{ backgroundColor: p.buttonColor }} className="w-full py-4 rounded-xl text-white font-bold text-[12px] uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm transition-all active:scale-[0.98]">
                  {p.buttonText || 'Выбрать'} <ChevronRight size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {activeDetailProduct && (
        <div className="fixed inset-x-0 top-0 bottom-20 z-[85] bg-white flex flex-col animate-in slide-in-from-bottom border-b border-slate-50">
          <div className="p-4 flex items-center justify-between border-b bg-white/95 sticky top-0 z-[10]">
            <button onClick={() => setActiveDetailProduct(null)} className="p-2 bg-slate-50 rounded-xl"><ChevronLeft size={20}/></button>
            <span className="font-bold text-[11px] text-slate-400 uppercase truncate px-4 tracking-widest">{activeDetailProduct.title}</span>
            <button onClick={() => setActiveDetailProduct(null)} className="p-2 bg-slate-50 rounded-xl"><X size={20}/></button>
          </div>
          <div className="flex-grow overflow-y-auto p-6 space-y-6 pb-24 no-scrollbar">
            <h2 className="text-2xl font-black text-slate-900 uppercase leading-tight tracking-tight">{activeDetailProduct.title}</h2>
            
            <div className="flex flex-col gap-6">
              {activeDetailProduct.detailGallery && activeDetailProduct.detailGallery.length > 0 ? (
                activeDetailProduct.detailGallery.map((m:any, i:number) => (
                  <div key={i} className="w-full">
                    <MediaRenderer url={m.url} type={m.type} isDetail={true} onClick={() => m.type === 'image' && setFullscreenImage(m.url)} />
                  </div>
                ))
              ) : (
                <MediaRenderer url={activeDetailProduct.imageUrl} type={activeDetailProduct.mediaType} isDetail={true} onClick={() => activeDetailProduct.mediaType === 'image' && setFullscreenImage(activeDetailProduct.imageUrl)} />
              )}
            </div>

            <div className="text-slate-700 font-medium leading-relaxed text-[15px]">
              {renderRichText(activeDetailProduct.detailFullDescription || activeDetailProduct.description)}
            </div>
          </div>
          
          <div className="absolute bottom-6 left-6 right-6 z-[20]">
            <button onClick={() => { const p = activeDetailProduct; setActiveDetailProduct(null); if (p.section === 'shop') setCheckoutProduct(p); else if (p.externalLink) window.open(p.externalLink, '_blank'); }} style={{ backgroundColor: activeDetailProduct.buttonColor }} className="w-full py-5 rounded-2xl text-white font-black uppercase text-[12px] shadow-2xl flex items-center justify-center gap-3 transition-all active:scale-95">
              {activeDetailProduct.detailButtonText || 'ЗАКАЗАТЬ'} <ChevronRight size={18} />
            </button>
          </div>
        </div>
      )}

      {view === 'admin' && (isAdminAuthenticated ? (
        <div className="space-y-8 pb-32 animate-in fade-in duration-300">
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4 mb-6">
            <div className="space-y-1">
              <label className="text-[9px] font-black uppercase text-indigo-600">Bot Token</label>
              <input className="w-full bg-slate-50 p-4 rounded-xl text-sm font-bold border border-slate-100 outline-none focus:ring-2 focus:ring-indigo-100 transition-all" value={telegramConfig.botToken} onChange={e => setTelegramConfig({...telegramConfig, botToken: e.target.value})} />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black uppercase text-indigo-600">Chat ID</label>
              <input className="w-full bg-slate-50 p-4 rounded-xl text-sm font-bold border border-slate-100 outline-none focus:ring-2 focus:ring-indigo-100 transition-all" value={telegramConfig.chatId} onChange={e => setTelegramConfig({...telegramConfig, chatId: e.target.value})} />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black uppercase text-rose-500">Webhook URL</label>
              <input className="w-full bg-slate-50 p-4 rounded-xl text-sm font-bold border border-slate-100 outline-none focus:ring-2 focus:ring-rose-100 transition-all" value={telegramConfig.googleSheetWebhook || ''} onChange={e => setTelegramConfig({...telegramConfig, googleSheetWebhook: e.target.value})} />
            </div>
            <button onClick={() => { localStorage.setItem('olga_tg_config', JSON.stringify(telegramConfig)); alert('Сохранено!'); syncWithCloud(true); }} className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold text-[11px] uppercase tracking-widest shadow-lg shadow-indigo-100 transition-all active:scale-95">Обновить настройки</button>
          </div>
          <AdminDashboard />
          <button onClick={() => setIsAdminAuthenticated(false)} className="w-full text-[10px] font-black text-slate-300 uppercase py-4 tracking-widest">Выйти из панели</button>
        </div>
      ) : (
        <div className="py-20 text-center space-y-6">
          <h2 className="text-xl font-black uppercase tracking-tight">Вход в систему</h2>
          <input type="password" placeholder="Пароль" className="w-full p-5 bg-white border border-slate-200 rounded-2xl text-center font-bold text-lg outline-none focus:ring-4 focus:ring-indigo-50" value={password} onChange={e => setPassword(e.target.value)} />
          <button onClick={() => password === ADMIN_PASSWORD && setIsAdminAuthenticated(true)} className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black uppercase tracking-widest shadow-xl transition-all active:scale-95">Авторизоваться</button>
        </div>
      ))}
      
      {checkoutProduct && (
        <div className="fixed inset-0 z-[6000] bg-slate-900/40 backdrop-blur-sm flex items-start justify-center p-6 pt-12">
          <div className="w-full max-w-md bg-white rounded-[2rem] p-8 space-y-6 relative shadow-2xl animate-in fade-in zoom-in duration-200">
            <button onClick={() => setCheckoutProduct(null)} className="absolute top-6 right-8 text-slate-300 hover:text-rose-500 transition-colors">
              <X size={24}/>
            </button>
            <div className="space-y-1">
              <h2 className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Оформление заказа</h2>
              <p className="text-xl font-black text-slate-900 leading-tight tracking-tight">{checkoutProduct.title}</p>
            </div>
            <form onSubmit={handleCheckout} className="space-y-4">
              <input required placeholder="Ваше имя" className="w-full bg-slate-50 border border-slate-100 p-4 rounded-xl outline-none focus:border-indigo-300 transition-all font-bold text-[15px]" value={customerName} onChange={e => setCustomerName(e.target.value)} />
              <input required type="email" placeholder="Email" className="w-full bg-slate-50 border border-slate-100 p-4 rounded-xl outline-none focus:border-indigo-300 transition-all font-bold text-[15px]" value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} />
              <input required type="tel" placeholder="Телефон" className="w-full bg-slate-50 border border-slate-100 p-4 rounded-xl outline-none focus:border-indigo-300 transition-all font-bold text-[15px]" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} />
              
              <div className="space-y-3 py-2">
                <label className="flex items-start gap-3 text-[11px] text-slate-500 font-bold leading-snug cursor-pointer group">
                  <input type="checkbox" required className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" checked={agreedToOferta} onChange={e => setAgreedToOferta(e.target.checked)} /> 
                  <span className="group-hover:text-slate-700 transition-colors">Принимаю условия <a href="https://axl.antol.net.ru/shabl/oferta_shab" target="_blank" className="text-indigo-600 font-black underline">публичной оферты</a></span>
                </label>
                <label className="flex items-start gap-3 text-[11px] text-slate-500 font-bold leading-snug cursor-pointer group">
                  <input type="checkbox" required className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" checked={agreedToPrivacy} onChange={e => setAgreedToPrivacy(e.target.checked)} /> 
                  <span className="group-hover:text-slate-700 transition-colors">Согласен с <a href="https://axl.antol.net.ru/politica" target="_blank" className="text-indigo-600 font-black underline">политикой конфиденциальности</a></span>
                </label>
                <label className="flex items-start gap-3 text-[11px] text-slate-500 font-bold leading-snug cursor-pointer group">
                  <input type="checkbox" className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" checked={agreedToMarketing} onChange={e => setAgreedToMarketing(e.target.checked)} /> 
                  <span className="group-hover:text-slate-700 transition-colors">Согласен на получение <a href="https://shopscript.lpxl.ru/soglasie" target="_blank" className="text-indigo-600 font-black underline">рекламных рассылок</a></span>
                </label>
              </div>

              <div className="space-y-3">
                <button type="submit" disabled={!agreedToOferta || !agreedToPrivacy} className={`w-full py-5 rounded-2xl font-black uppercase text-[12px] tracking-widest shadow-xl transition-all active:scale-95 ${(!agreedToOferta || !agreedToPrivacy) ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-indigo-600 text-white shadow-indigo-100 hover:shadow-indigo-200'}`}>
                  ОПЛАТИТЬ {checkoutProduct.price} ₽
                </button>
                <p className="text-[10px] text-center text-slate-500 font-black uppercase leading-tight tracking-tight mt-4">
                  В течение дня доступ к материалам <br/> будет отправлен на вашу эл. почту
                </p>
                <p className="text-[8px] text-center text-slate-300 uppercase font-bold tracking-widest mt-1">Safe payment via Prodamus</p>
              </div>
            </form>
          </div>
        </div>
      )}

      {fullscreenImage && <div className="fixed inset-0 z-[8000] bg-black/95 flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setFullscreenImage(null)}><img src={fullscreenImage} className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" alt="" /></div>}
      {activePaymentUrl && <div className="fixed inset-0 z-[7000] bg-white flex flex-col"><div className="p-4 border-b flex justify-between items-center"><span className="font-bold text-[11px] uppercase text-slate-400 tracking-widest">Процессинг оплаты</span><button onClick={() => { setActivePaymentUrl(null); setIframeLoaded(false); }} className="p-2 bg-rose-500 text-white rounded-xl shadow-lg active:scale-90 transition-all"><X size={20}/></button></div><div className="flex-grow relative bg-slate-50">{!iframeLoaded && <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/50 backdrop-blur-sm"><div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div><p className="mt-4 text-[10px] font-black uppercase text-indigo-600 tracking-widest">Безопасное соединение...</p></div>}<iframe src={activePaymentUrl} className={`w-full h-full border-none transition-opacity duration-500 ${iframeLoaded ? 'opacity-100' : 'opacity-0'}`} onLoad={() => setIframeLoaded(true)} /></div></div>}
    </Layout>
  );
};

export default App;
