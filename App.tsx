
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Layout from './components/Layout';
import AdminDashboard from './components/AdminDashboard';
import { ViewState, Product, TelegramConfig } from './types';
import { INITIAL_PRODUCTS, ADMIN_PASSWORD } from './constants';
import { analyticsService } from './services/analyticsService';
import { 
  X, ChevronRight, Send, Gift, Sparkles, CreditCard, PlayCircle, ChevronLeft, 
  Trophy, Award, Briefcase as BriefcaseIcon, Globe, ShieldCheck, ShoppingBag
} from 'lucide-react';

const App: React.FC = () => {
  const [view, setView] = useState<ViewState>('home');
  const [isSyncing, setIsSyncing] = useState(false);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  
  const [products, setProducts] = useState<Product[]>(() => {
    try {
      const saved = localStorage.getItem('olga_products_v27');
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

  const syncWithCloud = useCallback(async (showLoading = false) => {
    if (!telegramConfig.googleSheetWebhook) return;
    if (showLoading) setIsSyncing(true);
    try {
      const response = await fetch(`${telegramConfig.googleSheetWebhook}?action=getProducts&_t=${Date.now()}`);
      const rawData = await response.json();
      if (rawData && Array.isArray(rawData)) {
        const sanitizedData = rawData
          .filter((item: any) => {
            const title = item.title || item.Title;
            return title && title.trim() !== "" && title.trim() !== "Без названия";
          })
          .map((item: any, index: number) => {
            const p: any = {};
            Object.keys(item).forEach(key => { p[key.trim().toLowerCase()] = item[key]; });
            const rawSec = String(p.section || '').trim().toLowerCase();
            const section = (rawSec === 'bonus' || rawSec === 'bonuses' || rawSec === 'бонусы' || rawSec === 'бонус') ? 'bonus' : 
                            (rawSec === 'portfolio' || rawSec === 'кейсы' || rawSec === 'кейс') ? 'portfolio' : 'shop';
            
            let gallery = [];
            try {
              const rawGallery = p.detailgallery || p.detailGallery;
              if (rawGallery) {
                gallery = typeof rawGallery === 'string' ? JSON.parse(rawGallery) : rawGallery;
              }
            } catch (e) { gallery = []; }

            const rawPrice = p.price;
            const price = (isNaN(Number(rawPrice)) || rawPrice === "" || rawPrice === null) ? String(rawPrice || 0) : Number(rawPrice);

            return {
              ...p,
              id: p.id ? String(p.id) : `row-${index + 2}`,
              title: p.title || 'Без названия',
              description: p.description || '',
              category: p.category || 'GetCourse',
              price,
              imageUrl: p.imageurl || p.imageUrl || '',
              mediaType: (p.mediatype || p.mediaType) === 'video' ? 'video' : 'image',
              features: Array.isArray(p.features) ? p.features : (p.features && typeof p.features === 'string' ? p.features.split(',').map((s: string) => s.trim()) : []),
              useDetailModal: String(p.usedetailmodal || p.useDetailModal).toLowerCase() === 'true',
              section,
              buttonText: p.buttontext || p.buttonText || '',
              buttonColor: p.buttoncolor || p.buttonColor || '#6366f1',
              titleColor: p.titlecolor || p.titleColor || '#1e293b',
              cardBgColor: p.cardbgcolor || p.cardBgColor || '#f8fafc',
              prodamusId: p.prodamusid || p.prodamusId || '',
              externalLink: p.externallink || p.externalLink || '',
              detailFullDescription: p.detailfulldescription || p.detailFullDescription || '',
              detailButtonText: p.detailbuttontext || p.detailButtonText || '',
              detailButtonColor: p.detailbuttoncolor || p.detailButtonColor || '',
              detailGallery: gallery
            };
          });
        setProducts(sanitizedData);
        localStorage.setItem('olga_products_v27', JSON.stringify(sanitizedData));
      }
    } catch (e) {} finally { if (showLoading) setIsSyncing(false); }
  }, [telegramConfig.googleSheetWebhook]);

  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp;
    if (tg) { tg.ready(); tg.expand(); }
    syncWithCloud(true);
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

  useEffect(() => {
    analyticsService.startSession().then(setSessionId);
  }, []);

  useEffect(() => {
    if (sessionId) analyticsService.updateSessionPath(sessionId, view);
    window.scrollTo(0, 0);
  }, [view, sessionId]);

  const portfolioItems = useMemo(() => products.filter(p => p.section === 'portfolio'), [products]);
  const bonuses = useMemo(() => products.filter(p => p.section === 'bonus'), [products]);
  const filteredProducts = useMemo(() => products.filter(p => p.section === 'shop' && (filter === 'All' || p.category === filter)), [products, filter]);

  const categories = useMemo(() => {
    const shopProducts = products.filter(p => p.section === 'shop');
    return Array.from(new Set(shopProducts.map(p => p.category))).filter(Boolean);
  }, [products]);

  const handleNavigate = (newView: ViewState) => {
    setActiveDetailProduct(null);
    setCheckoutProduct(null);
    setActivePaymentUrl(null);
    setView(newView);
    window.scrollTo(0, 0);
  };

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkoutProduct || isSubmitting) return;
    setIsSubmitting(true);
    try {
      analyticsService.logOrder({
        productTitle: checkoutProduct.title, price: checkoutProduct.price,
        customerName, customerEmail, customerPhone,
        utmSource: new URLSearchParams(window.location.search).get('utm_source') || 'direct'
      }, sessionId);
      setActivePaymentUrl(checkoutProduct.prodamusId?.startsWith('http') ? checkoutProduct.prodamusId : 'https://antol.payform.ru/');
      setCheckoutProduct(null);
    } catch (err) {} finally { setIsSubmitting(false); }
  };

  const MediaRenderer: React.FC<{ url: string; type: 'image' | 'video'; className?: string; onClick?: () => void; isDetail?: boolean }> = ({ url, type, className, onClick, isDetail }) => {
    if (!url) return null;
    
    const isDirectVideo = url.match(/\.(mp4|webm|mov|gif|m4v|avi)$/i);
    const isRutube = url.includes('rutube.ru');
    const isYoutube = url.includes('youtube.com') || url.includes('youtu.be');
    
    if (isRutube || isYoutube) {
      let embedUrl = url;
      if (isRutube) {
        if (url.includes('/video/')) {
          embedUrl = url.replace('/video/', '/play/embed/');
        } else if (!url.includes('/play/embed/')) {
          const parts = url.split('/').filter(Boolean);
          const id = parts[parts.length - 1];
          embedUrl = `https://rutube.ru/play/embed/${id}/`;
        }
      } else if (isYoutube) {
        if (url.includes('watch?v=')) embedUrl = url.replace('watch?v=', 'embed/');
        else if (url.includes('youtu.be/')) embedUrl = url.replace('youtu.be/', 'youtube.com/embed/');
      }
      
      return (
        <div className={`relative w-full aspect-video overflow-hidden shadow-sm bg-black ${isDetail ? 'rounded-2xl' : 'rounded-lg'}`}>
          <iframe 
            src={embedUrl} 
            className="w-full h-full border-none" 
            allow="autoplay; encrypted-media; fullscreen; picture-in-picture" 
            allowFullScreen
          ></iframe>
        </div>
      );
    }

    if (type === 'video' || isDirectVideo) {
      return (
        <div className={`relative w-full overflow-hidden ${isDetail ? 'rounded-2xl bg-black shadow-sm' : 'h-full'}`} onClick={onClick}>
          <video 
            src={url} 
            className={isDetail ? 'w-full h-auto max-h-[65vh] mx-auto' : className} 
            autoPlay muted loop playsInline preload="auto"
            style={{ objectFit: isDetail ? 'contain' : 'cover' }} 
          />
          {!isDetail && <div className="absolute inset-0 flex items-center justify-center bg-black/10 pointer-events-none"><PlayCircle size={36} className="text-white opacity-40" /></div>}
        </div>
      );
    }
    
    return <img src={url} className={`${isDetail ? 'w-full h-auto rounded-2xl shadow-sm mx-auto' : className}`} alt="" onClick={onClick} style={{ objectFit: isDetail ? 'contain' : 'cover', cursor: isDetail ? 'zoom-in' : 'pointer' }} />;
  };

  const renderProductCard = (p: Product) => (
    <div key={p.id} style={{ backgroundColor: p.cardBgColor }} className="rounded-2xl border border-slate-100 overflow-hidden shadow-sm flex flex-col active:scale-[0.99] transition-all mb-5">
      <div className="p-4 pb-0 flex justify-between items-center">
         <span style={{ color: p.buttonColor }} className="text-[10px] font-black uppercase tracking-[0.15em] opacity-60">{p.category}</span>
         <Sparkles size={14} style={{ color: p.buttonColor }} className="opacity-30" />
      </div>
      <div className="p-4 pt-2">
        <h3 style={{ color: p.titleColor }} className="text-[17px] font-bold tracking-tight leading-tight">{p.title}</h3>
        <div style={{ color: p.buttonColor }} className="text-[15px] font-black mt-1">
           {typeof p.price === 'number' && p.price > 0 ? `${p.price} ₽` : (p.price === 0 || p.price === "0" ? '0 ₽' : p.price)}
        </div>
      </div>
      <div className="aspect-[16/9] relative bg-slate-50 mx-4 rounded-xl overflow-hidden mb-3 border border-slate-50">
        <MediaRenderer url={p.imageUrl} type={p.mediaType} className="w-full h-full" onClick={() => { if (p.useDetailModal) setActiveDetailProduct(p); }} />
      </div>
      <div className="px-4 pb-4 space-y-3">
        <p className="text-[11px] text-slate-500 font-medium leading-relaxed line-clamp-2">{p.description}</p>
        <button 
          onClick={() => { if (p.useDetailModal) setActiveDetailProduct(p); else if (p.section === 'shop') setCheckoutProduct(p); else if (p.externalLink) window.open(p.externalLink, '_blank'); }}
          style={{ backgroundColor: p.buttonColor || '#6366f1' }}
          className="w-full flex items-center justify-center gap-2 text-white py-4 rounded-xl font-bold text-[12px] uppercase tracking-wider shadow-md active:scale-95 transition-transform"
        >
          {p.buttonText || (p.section === 'shop' ? 'Купить' : 'Забрать')} <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );

  return (
    <Layout activeView={view} onNavigate={handleNavigate}>
      {view === 'home' && (
        <div className="space-y-5 animate-in fade-in duration-500">
          <div className="text-center py-4">
            <div className="w-40 h-40 mx-auto relative mb-4">
              <div className="relative w-full h-full bg-white rounded-[2.5rem] p-1.5 shadow-2xl overflow-hidden border-4 border-white">
                <img src="https://i.imgur.com/bQ8ic2w.png" alt="Ольга" className="w-full h-full object-cover rounded-[2.2rem]" />
              </div>
            </div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase leading-none">Ольга Антонова</h1>
            <p className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.25em] mt-2.5">Решения GetCourse & Prodamus.XL</p>
          </div>
          
          <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-4">
            <div className="flex items-center gap-4"><Trophy className="text-amber-500 flex-shrink-0" size={18} /><p className="text-[13px] font-bold text-slate-700">Победитель Хакатона EdMarket</p></div>
            <div className="flex items-center gap-4"><Award className="text-indigo-500 flex-shrink-0" size={18} /><p className="text-[13px] font-bold text-slate-700">Специалист GetCourse и Prodamus.XL</p></div>
            <div className="flex items-center gap-4"><BriefcaseIcon className="text-emerald-500 flex-shrink-0" size={18} /><p className="text-[13px] font-bold text-slate-700">60+ реализованных проектов</p></div>
            <div className="flex items-center gap-4"><Globe className="text-blue-500 flex-shrink-0" size={18} /><p className="text-[13px] font-bold text-slate-700 truncate">Сайт: <a href="https://vk.cc/cOx50S" target="_blank" className="text-indigo-600 underline">https://vk.cc/cOx50S</a></p></div>
          </div>
          
          <button onClick={() => window.open('https://t.me/Olga_lav', '_blank')} className="w-full bg-indigo-600 text-white p-5 rounded-[2rem] shadow-2xl flex items-center justify-between active:scale-[0.98] transition-all">
            <div className="text-left"><h3 className="text-lg font-black leading-none mb-1.5 uppercase">Нужна помощь?</h3><p className="text-[9px] font-black opacity-70 uppercase tracking-widest">СВЯЗАТЬСЯ В TELEGRAM</p></div>
            <Send size={28} className="opacity-30" />
          </button>
        </div>
      )}
      {view === 'portfolio' && <div className="space-y-4">{portfolioItems.map(renderProductCard)}</div>}
      {view === 'shop' && (
        <div className="space-y-4">
          <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
            {['All', ...categories].map(c => (
              <button key={c} onClick={() => setFilter(c)} className={`px-5 py-2 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all flex-shrink-0 ${filter === c ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-50 text-slate-400 border border-slate-100'}`}>{c === 'All' ? 'Все' : c}</button>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-1">{filteredProducts.map(renderProductCard)}</div>
        </div>
      )}
      {view === 'bonuses' && <div className="space-y-4">{bonuses.map(renderProductCard)}</div>}
      {view === 'contact' && (
        <div className="text-center py-20 space-y-6 animate-in zoom-in duration-300">
          <div className="w-20 h-20 bg-indigo-600 rounded-[1.8rem] flex items-center justify-center text-white mx-auto shadow-2xl shadow-indigo-200"><Send size={32} /></div>
          <h2 className="text-2xl font-black uppercase tracking-tighter text-slate-900">Связь со мной</h2>
          <p className="text-slate-400 font-bold uppercase text-[10px] tracking-[0.2em]">Жду вашего сообщения!</p>
          <a href="https://t.me/Olga_lav" target="_blank" className="w-full max-w-[280px] mx-auto flex items-center justify-center gap-3 bg-slate-900 text-white px-10 py-5 rounded-2xl font-black uppercase text-[11px] tracking-widest active:scale-95 transition-transform shadow-xl">Открыть Telegram</a>
        </div>
      )}
      {activeDetailProduct && (
        <div className="fixed top-0 left-0 right-0 bottom-20 z-[100] bg-white flex flex-col animate-in slide-in-from-bottom duration-300 shadow-2xl">
          <div className="p-4 flex items-center justify-between border-b shrink-0 sticky top-0 z-[110] bg-white/95 backdrop-blur-md">
            <button onClick={() => setActiveDetailProduct(null)} className="p-2.5 bg-slate-50 rounded-xl text-slate-400 active:scale-90 transition-all"><ChevronLeft size={20} /></button>
            <span className="font-bold text-[12px] text-slate-300 uppercase tracking-widest truncate max-w-[60%]">{activeDetailProduct.title}</span>
            <button onClick={() => setActiveDetailProduct(null)} className="p-2.5 bg-slate-50 rounded-xl text-slate-400 active:scale-90 transition-all"><X size={20} /></button>
          </div>
          <div className="flex-grow overflow-y-auto p-6 space-y-6 no-scrollbar pb-40 overscroll-contain">
            <div className="space-y-3">
              <h2 className="text-2xl font-bold tracking-tight text-slate-900 leading-tight uppercase">{activeDetailProduct.title}</h2>
              <div style={{ color: activeDetailProduct.buttonColor }} className="text-lg font-black bg-slate-50 w-fit px-4 py-2 rounded-full border border-slate-100/50">
                {typeof activeDetailProduct.price === 'number' && activeDetailProduct.price > 0 ? `${activeDetailProduct.price} ₽` : (activeDetailProduct.price === 0 || activeDetailProduct.price === "0" ? '0 ₽' : activeDetailProduct.price)}
              </div>
            </div>
            <div className="space-y-5">
              {activeDetailProduct.detailGallery && activeDetailProduct.detailGallery.length > 0 ? (
                activeDetailProduct.detailGallery.map((media, idx) => (
                  <MediaRenderer key={idx} url={media.url} type={media.type} isDetail={true} onClick={() => { if (media.type === 'image') setFullscreenImage(media.url); }} />
                ))
              ) : (
                <MediaRenderer url={activeDetailProduct.imageUrl} type={activeDetailProduct.mediaType} isDetail={true} onClick={() => { if (activeDetailProduct.mediaType === 'image') setFullscreenImage(activeDetailProduct.imageUrl); }} />
              )}
            </div>
            <div className="space-y-5 pt-4"><div className="h-px bg-slate-50 w-full" /><div className="text-[14px] font-medium text-slate-600 leading-relaxed whitespace-pre-wrap">{activeDetailProduct.detailFullDescription || activeDetailProduct.description}</div></div>
          </div>
          <div className="fixed bottom-24 left-6 right-6 z-[120]">
            <button onClick={() => { const p = activeDetailProduct; setActiveDetailProduct(null); if (p.section === 'shop') setCheckoutProduct(p); else if (p.externalLink) window.open(p.externalLink, '_blank'); }} style={{ backgroundColor: activeDetailProduct.buttonColor || '#6366f1' }} className="w-full text-white py-5 rounded-2xl font-bold uppercase text-[12px] tracking-widest shadow-2xl flex items-center justify-center gap-3 active:scale-95 transition-transform">
              {activeDetailProduct.detailButtonText || 'ЗАКАЗАТЬ РЕШЕНИЕ'} <ChevronRight size={18} />
            </button>
          </div>
        </div>
      )}
      {view === 'admin' && (isAdminAuthenticated ? <div className="space-y-8 pb-32"><div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4 mb-6"><div className="space-y-1"><label className="text-[9px] font-black uppercase text-indigo-600 ml-1">Bot Token</label><input className="w-full bg-slate-50 p-4 rounded-xl text-sm font-bold border border-slate-100 text-slate-900 outline-none" value={telegramConfig.botToken} onChange={e => setTelegramConfig({...telegramConfig, botToken: e.target.value})} /></div><div className="space-y-1"><label className="text-[9px] font-black uppercase text-indigo-600 ml-1">Chat ID</label><input className="w-full bg-slate-50 p-4 rounded-xl text-sm font-bold border border-slate-100 text-slate-900 outline-none" value={telegramConfig.chatId} onChange={e => setTelegramConfig({...telegramConfig, chatId: e.target.value})} /></div><div className="space-y-1"><label className="text-[9px] font-black uppercase text-rose-500 ml-1">Webhook URL</label><input className="w-full bg-slate-50 p-4 rounded-xl text-sm font-bold border border-slate-100 text-slate-900 outline-none" value={telegramConfig.googleSheetWebhook || ''} onChange={e => setTelegramConfig({...telegramConfig, googleSheetWebhook: e.target.value})} /></div><button onClick={() => { localStorage.setItem('olga_tg_config', JSON.stringify(telegramConfig)); alert('Сохранено!'); syncWithCloud(true); }} className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold text-[11px] uppercase tracking-widest">Обновить данные</button></div><AdminDashboard /><button onClick={() => setIsAdminAuthenticated(false)} className="w-full text-[10px] font-black text-slate-300 uppercase py-4">Выйти из панели</button></div> : <div className="py-12 text-center space-y-6"><h2 className="text-xl font-bold tracking-tight uppercase text-slate-900">Вход в панель</h2><input type="password" placeholder="Пароль" className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-center text-slate-900 outline-none shadow-sm" value={password} onChange={e => setPassword(e.target.value)} /><button onClick={() => password === ADMIN_PASSWORD && setIsAdminAuthenticated(true)} className="w-full bg-slate-900 text-white py-5 rounded-2xl font-bold uppercase text-[11px] tracking-widest">Войти</button></div>)}
      {checkoutProduct && <div className="fixed inset-0 z-[6000] bg-slate-900/40 backdrop-blur-sm flex items-start justify-center p-6 pt-12 animate-in fade-in"><div className="w-full max-w-md bg-white rounded-[2rem] p-8 space-y-6 relative shadow-2xl"><button onClick={() => setCheckoutProduct(null)} className="absolute top-6 right-8 text-slate-300"><X size={24}/></button><h2 className="text-lg font-bold text-slate-900 uppercase tracking-tight">Оформление заказа</h2><form onSubmit={handleCheckout} className="space-y-3"><input required placeholder="Ваше имя" className="w-full bg-slate-50 border border-slate-100 rounded-xl px-5 py-4 font-medium text-slate-900 outline-none" value={customerName} onChange={e => setCustomerName(e.target.value)} /><input required type="email" placeholder="Email" className="w-full bg-slate-50 border border-slate-100 rounded-xl px-5 py-4 font-medium text-slate-900 outline-none" value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} /><input required type="tel" placeholder="Телефон" className="w-full bg-slate-50 border border-slate-100 rounded-xl px-5 py-4 font-medium text-slate-900 outline-none" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} /><button type="submit" className="w-full bg-indigo-600 text-white py-5 rounded-xl font-bold uppercase text-[12px] tracking-widest shadow-lg active:scale-95 transition-transform">Оплатить {checkoutProduct.price} ₽</button></form></div></div>}
      {fullscreenImage && <div className="fixed inset-0 z-[8000] bg-black/95 flex items-center justify-center p-4 animate-in zoom-in duration-200" onClick={() => setFullscreenImage(null)}><img src={fullscreenImage} className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" alt="Full view" /></div>}
      {activePaymentUrl && <div className="fixed inset-0 z-[7000] bg-white flex flex-col"><div className="p-4 border-b flex justify-between items-center bg-white"><span className="font-bold text-[11px] uppercase text-slate-400">Платеж</span><button onClick={() => setActivePaymentUrl(null)} className="p-2 bg-rose-500 text-white rounded-xl"><X size={20}/></button></div><iframe src={activePaymentUrl} className="flex-grow w-full border-none" /></div>}
    </Layout>
  );
};

export default App;
