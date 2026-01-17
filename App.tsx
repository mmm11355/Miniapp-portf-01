
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Layout from './components/Layout';
import AdminDashboard from './components/AdminDashboard';
import { ViewState, Product, TelegramConfig, OrderLog } from './types';
import { INITIAL_PRODUCTS, ADMIN_PASSWORD } from './constants';
import { analyticsService } from './services/analyticsService';
import { 
  X, ChevronRight, Send, Gift, Sparkles, CreditCard, PlayCircle, ChevronLeft, 
  Trophy, Award, Briefcase as BriefcaseIcon, Globe, ShieldCheck, ShoppingBag, Clock, CheckCircle
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

  const MediaRenderer: React.FC<{ url: string; type: 'image' | 'video'; className?: string; onClick?: () => void; isDetail?: boolean }> = ({ url, type, className, onClick, isDetail }) => {
    if (!url) return null;
    const isDirectVideo = url.match(/\.(mp4|webm|mov|gif|m4v|avi)$/i);
    const isRutube = url.includes('rutube.ru');
    const isYoutube = url.includes('youtube.com') || url.includes('youtu.be');
    if (isRutube || isYoutube) {
      let embedUrl = url;
      if (isRutube) {
        if (url.includes('/video/')) embedUrl = url.replace('/video/', '/play/embed/');
        else if (!url.includes('/play/embed/')) {
          const id = url.split('/').filter(Boolean).pop();
          embedUrl = `https://rutube.ru/play/embed/${id}/`;
        }
      } else if (isYoutube) {
        if (url.includes('watch?v=')) embedUrl = url.replace('watch?v=', 'embed/');
        else if (url.includes('youtu.be/')) embedUrl = url.replace('youtu.be/', 'youtube.com/embed/');
      }
      return (
        <div className={`relative w-full aspect-video overflow-hidden shadow-sm bg-black ${isDetail ? 'rounded-2xl' : 'rounded-lg'}`}>
          <iframe src={embedUrl} className="w-full h-full border-none" allow="autoplay; encrypted-media; fullscreen; picture-in-picture" allowFullScreen></iframe>
        </div>
      );
    }
    if (type === 'video' || isDirectVideo) {
      return (
        <div className={`relative w-full overflow-hidden ${isDetail ? 'rounded-2xl bg-black shadow-sm' : 'h-full'}`} onClick={onClick}>
          <video src={url} className={isDetail ? 'w-full h-auto max-h-[65vh] mx-auto' : className} autoPlay muted loop playsInline preload="auto" style={{ objectFit: isDetail ? 'contain' : 'cover' }} />
          {!isDetail && <div className="absolute inset-0 flex items-center justify-center bg-black/10 pointer-events-none"><PlayCircle size={36} className="text-white opacity-40" /></div>}
        </div>
      );
    }
    return <img src={url} className={`${isDetail ? 'w-full h-auto rounded-2xl shadow-sm mx-auto' : className}`} alt="" onClick={onClick} style={{ objectFit: isDetail ? 'contain' : 'cover', cursor: isDetail ? 'zoom-in' : 'pointer' }} />;
  };

  const renderRichContent = (text: string) => {
    if (!text) return null;
    const parts = text.split(/(\[\[(?:image|video):[^\]]+\]\])/g);
    const urlRegex = /(https?:\/\/[^\s]+)/g;

    return (
      <div className="text-[16px] font-medium text-slate-600 leading-[1.4] whitespace-pre-wrap">
        {parts.map((part, i) => {
          const mediaMatch = part.match(/\[\[(image|video):([^\]]+)\]\]/);
          if (mediaMatch) {
            const [_, type, url] = mediaMatch;
            const mediaUrl = url.trim();
            return (
              <div key={i} className="my-6 block">
                <MediaRenderer 
                  url={mediaUrl} 
                  type={type as 'image' | 'video'} 
                  isDetail={true} 
                  onClick={() => type === 'image' && setFullscreenImage(mediaUrl)} 
                />
              </div>
            );
          }
          return (
            <React.Fragment key={i}>
              {part.split(urlRegex).map((subPart, j) => {
                if (subPart.match(urlRegex)) {
                  return (
                    <a key={j} href={subPart} target="_blank" rel="noopener noreferrer" className="text-indigo-600 underline decoration-indigo-200 break-all font-bold">
                      {subPart}
                    </a>
                  );
                }
                return subPart;
              })}
            </React.Fragment>
          );
        })}
      </div>
    );
  };

  useEffect(() => {
    const monitorOrders = async () => {
      if (isProcessingRef.current) return;
      isProcessingRef.current = true;

      try {
        const localOrders = analyticsService.getOrders();
        const now = Date.now();
        
        const safeParse = (key: string) => {
          try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch(e) { return []; }
        };

        const processedNotifies = safeParse('olga_processed_notifies');
        const processedCancelled = safeParse('olga_processed_cancelled');
        
        let cloudOrders: any[] = [];
        if (telegramConfig.googleSheetWebhook) {
          try {
            const res = await fetch(`${telegramConfig.googleSheetWebhook}?action=getStats&_t=${now}`);
            const data = await res.json();
            if (data.status === 'success') cloudOrders = data.orders || [];
          } catch (e) { console.warn("Monitoring: Cloud Fetch Fail", e); }
        }

        const sanitize = (str: string) => (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

        // ГЛОБАЛЬНЫЙ МОНИТОРИНГ: Проверяем и локальные, и облачные заказы
        const allOrdersToCheck = [...localOrders];
        cloudOrders.forEach(co => {
          if (!allOrdersToCheck.find(lo => lo.id === co.id)) {
            allOrdersToCheck.push(co);
          }
        });

        for (const order of allOrdersToCheck) {
          // Ищем актуальный статус в облаке (если он там есть)
          const cloudInfo = cloudOrders.find((co: any) => co.id === order.id);
          const currentStatus = cloudInfo?.paymentStatus || order.paymentStatus;
          const isPaid = currentStatus === 'paid';

          // ЕСЛИ ПРОШЛО 10 МИНУТ И ВСЁ ЕЩЁ ОЖИДАНИЕ
          if (!isPaid && currentStatus === 'pending' && (now - order.timestamp) > 10 * 60 * 1000 && !processedCancelled.includes(order.id)) {
            // Сразу шлем команду на отмену в Google Таблицу и обновляем локально
            await analyticsService.updateOrderStatus(order.id, 'failed');
            processedCancelled.push(order.id);
            localStorage.setItem('olga_processed_cancelled', JSON.stringify(processedCancelled));

            if (telegramConfig.botToken && telegramConfig.chatId) {
              const cancelMsg = `<b>🔴 ЗАКАЗ ОТМЕНЕН (AUTO-ARCHIVE)</b>\n\n` +
                                `<b>ID:</b> <code>${order.id}</code>\n` +
                                `<b>Клиент:</b> ${sanitize(order.customerName)}\n` +
                                `<b>Товар:</b> ${sanitize(order.productTitle)}\n` +
                                `<b>Сумма:</b> ${order.price} ₽\n\n` +
                                `<i>Заказ перенесен в архив из-за отсутствия оплаты дольше 10 мин.</i>`;
              fetch(`https://api.telegram.org/bot${telegramConfig.botToken}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: telegramConfig.chatId, text: cancelMsg, parse_mode: 'HTML' })
              }).catch(e => console.error("Monitoring: Cancel Notify Failed", e));
            }
            continue;
          }

          // ЕСЛИ ПРОШЛО 5 МИНУТ
          if (!isPaid && currentStatus === 'pending' && (now - order.timestamp) > 5 * 60 * 1000 && !processedNotifies.includes(order.id)) {
            if (telegramConfig.botToken && telegramConfig.chatId) {
              const message = `<b>⚠️ ОПЛАТА НЕ НАЙДЕНА (5 МИН)</b>\n\n<b>ID:</b> <code>${order.id}</code>\n<b>Клиент:</b> ${sanitize(order.customerName)}\n<b>Товар:</b> ${sanitize(order.productTitle)}`;
              fetch(`https://api.telegram.org/bot${telegramConfig.botToken}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: telegramConfig.chatId, text: message, parse_mode: 'HTML' })
              }).then(res => {
                if (res.ok) {
                  processedNotifies.push(order.id);
                  localStorage.setItem('olga_processed_notifies', JSON.stringify(processedNotifies));
                }
              }).catch(e => console.error("Monitoring: Pending Notify Failed", e));
            }
          }

          // Синхронизируем статус оплаты, если в облаке оплачено, а у нас нет
          if (isPaid && order.paymentStatus !== 'paid') {
            await analyticsService.updateOrderStatus(order.id, 'paid');
          }
        }
      } catch (globalError) {
        console.error("Monitoring: Critical Error", globalError);
      } finally {
        isProcessingRef.current = false;
      }
    };

    monitorOrders();
    const checkInterval = setInterval(monitorOrders, 60000); 
    return () => clearInterval(checkInterval);
  }, [telegramConfig]);

  const syncWithCloud = useCallback(async (showLoading = false) => {
    if (!telegramConfig.googleSheetWebhook) return;
    if (showLoading) setIsSyncing(true);
    try {
      const response = await fetch(`${telegramConfig.googleSheetWebhook}?action=getProducts&_t=${Date.now()}`);
      const rawData = await response.json();
      if (rawData && Array.isArray(rawData)) {
        const sanitizedData = rawData
          .filter((item: any) => (item.title || item.Title)?.trim())
          .map((item: any, index: number) => {
            const p: any = {};
            Object.keys(item).forEach(key => { p[key.trim().toLowerCase()] = item[key]; });
            let gallery = [];
            try { gallery = typeof (p.detailgallery || p.detailGallery) === 'string' ? JSON.parse(p.detailgallery || p.detailGallery) : (p.detailgallery || p.detailGallery || []); } catch (e) {}
            
            const dBtnText = p.detailbuttontext || p.detailbutton || p.кнопкалонгрида || p.detailButtonText || p.buttontext || p.buttonText || '';

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
              detailButtonText: dBtnText, 
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
      let paymentUrl = checkoutProduct.prodamusId?.startsWith('http') ? checkoutProduct.prodamusId : 'https://antol.payform.ru/';
      const connector = paymentUrl.includes('?') ? '&' : '?';
      paymentUrl += `${connector}order_id=${order.id}&customer_email=${encodeURIComponent(customerEmail)}&customer_phone=${encodeURIComponent(customerPhone)}`;
      setActivePaymentUrl(paymentUrl);
      setCheckoutProduct(null);
    } catch (err) {} finally { setIsSubmitting(false); }
  };

  const renderProductCard = (p: Product) => (
    <div key={p.id} style={{ backgroundColor: p.cardBgColor }} className="rounded-2xl border border-slate-100 overflow-hidden shadow-sm flex flex-col active:scale-[0.99] transition-all mb-5">
      <div className="p-4 pb-0 flex justify-between items-center">
         <span style={{ color: p.buttonColor }} className="text-[10px] font-black uppercase tracking-[0.15em] opacity-60">{p.category}</span>
         <span className="opacity-30"><Sparkles size={14} style={{ color: p.buttonColor }} /></span>
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
        <div className="text-[16px] text-slate-500 font-medium leading-[1.4] line-clamp-3">
          {renderRichContent(p.description)}
        </div>
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
            <p className="text-[16px] font-black text-indigo-600 uppercase tracking-widest mt-3">Решения GetCourse & Prodamus.XL</p>
          </div>
          <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-4">
            <div className="flex items-center gap-4"><Trophy className="text-amber-500" size={18} /><p className="text-[13px] font-bold text-slate-700">Победитель Хакатона EdMarket</p></div>
            <div className="flex items-center gap-4"><Award className="text-indigo-500" size={18} /><p className="text-[13px] font-bold text-slate-700">Специалист GetCourse и Prodamus.XL</p></div>
            <div className="flex items-center gap-4"><BriefcaseIcon className="text-emerald-500" size={18} /><p className="text-[13px] font-bold text-slate-700">60+ реализованных проектов</p></div>
          </div>
          <button onClick={() => window.open('https://t.me/Olga_lav', '_blank')} className="w-full bg-indigo-600 text-white p-5 rounded-[2rem] shadow-2xl flex items-center justify-between active:scale-[0.98] transition-all">
            <div className="text-left"><h3 className="text-lg font-black uppercase">Нужна помощь?</h3><p className="text-[9px] font-black opacity-70 uppercase tracking-widest">СВЯЗАТЬСЯ В TELEGRAM</p></div>
            <Send size={28} className="opacity-30" />
          </button>
        </div>
      )}
      {(view === 'portfolio' || view === 'shop' || view === 'bonuses') && (
        <div className="space-y-4">
          {view === 'shop' && (
            <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
              {['All', ...categories].map(c => (
                <button key={c} onClick={() => setFilter(c)} className={`px-5 py-2 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all flex-shrink-0 ${filter === c ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-200 text-slate-600' }`}>
                  {c === 'All' ? 'Все' : c}
                </button>
              ))}
            </div>
          )}
          <div className="grid grid-cols-1 gap-1">{(view === 'portfolio' ? portfolioItems : view === 'bonuses' ? bonuses : filteredProducts).map(renderProductCard)}</div>
        </div>
      )}
      {view === 'contact' && (
        <div className="text-center py-20 space-y-6">
          <div className="w-20 h-20 bg-indigo-600 rounded-[1.8rem] flex items-center justify-center text-white mx-auto"><Send size={32} /></div>
          <h2 className="text-2xl font-black uppercase tracking-tighter text-slate-900">Связь со мной</h2>
          <a href="https://t.me/Olga_lav" target="_blank" className="w-full max-w-[280px] mx-auto flex items-center justify-center gap-3 bg-slate-900 text-white px-10 py-5 rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-xl">Открыть Telegram</a>
        </div>
      )}
      {activeDetailProduct && (
        <div className="fixed top-0 left-0 right-0 bottom-20 z-[100] bg-white flex flex-col animate-in slide-in-from-bottom duration-300">
          <div className="p-4 flex items-center justify-between border-b shrink-0 bg-white/95 backdrop-blur-md">
            <button onClick={() => setActiveDetailProduct(null)} className="p-2.5 bg-slate-50 rounded-xl text-slate-400"><ChevronLeft size={20} /></button>
            <span className="font-bold text-[12px] text-slate-300 uppercase truncate max-w-[60%]">{activeDetailProduct.title}</span>
            <button onClick={() => setActiveDetailProduct(null)} className="p-2.5 bg-slate-50 rounded-xl text-slate-400"><X size={20} /></button>
          </div>
          <div className="flex-grow overflow-y-auto p-6 space-y-6 no-scrollbar pb-40">
            <div className="space-y-3">
              <h2 className="text-2xl font-bold text-slate-900 uppercase leading-tight">{activeDetailProduct.title}</h2>
              <div style={{ color: activeDetailProduct.buttonColor }} className="text-lg font-black bg-slate-50 w-fit px-4 py-2 rounded-full">
                {typeof activeDetailProduct.price === 'number' && activeDetailProduct.price > 0 ? `${activeDetailProduct.price} ₽` : activeDetailProduct.price}
              </div>
            </div>
            <div className="space-y-5">
              {activeDetailProduct.detailGallery?.length ? activeDetailProduct.detailGallery.map((media, idx) => (
                <MediaRenderer key={idx} url={media.url} type={media.type} isDetail={true} onClick={() => media.type === 'image' && setFullscreenImage(media.url)} />
              )) : (
                <MediaRenderer url={activeDetailProduct.imageUrl} type={activeDetailProduct.mediaType} isDetail={true} onClick={() => activeDetailProduct.mediaType === 'image' && setFullscreenImage(activeDetailProduct.imageUrl)} />
              )}
            </div>
            <div className="pt-4 border-t border-slate-50">
               {renderRichContent(activeDetailProduct.detailFullDescription || activeDetailProduct.description)}
            </div>
          </div>
          <div className="fixed bottom-24 left-6 right-6">
            <button onClick={() => { const p = activeDetailProduct; setActiveDetailProduct(null); if (p.section === 'shop') setCheckoutProduct(p); else if (p.externalLink) window.open(p.externalLink, '_blank'); }} style={{ backgroundColor: activeDetailProduct.buttonColor || '#6366f1' }} className="w-full text-white py-5 rounded-2xl font-bold uppercase text-[12px] tracking-widest shadow-2xl flex items-center justify-center gap-3">
              {activeDetailProduct.detailButtonText || activeDetailProduct.buttonText || 'ЗАКАЗАТЬ РЕШЕНИЕ'} <ChevronRight size={18} />
            </button>
          </div>
        </div>
      )}
      {view === 'admin' && (isAdminAuthenticated ? <div className="space-y-8 pb-32"><div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4 mb-6"><div className="space-y-1"><label className="text-[9px] font-black uppercase text-indigo-600">Bot Token</label><input className="w-full bg-slate-50 p-4 rounded-xl text-sm font-bold border border-slate-100 outline-none" value={telegramConfig.botToken} onChange={e => setTelegramConfig({...telegramConfig, botToken: e.target.value})} /></div><div className="space-y-1"><label className="text-[9px] font-black uppercase text-indigo-600">Chat ID</label><input className="w-full bg-slate-50 p-4 rounded-xl text-sm font-bold border border-slate-100 outline-none" value={telegramConfig.chatId} onChange={e => setTelegramConfig({...telegramConfig, chatId: e.target.value})} /></div><div className="space-y-1"><label className="text-[9px] font-black uppercase text-rose-500">Webhook URL</label><input className="w-full bg-slate-50 p-4 rounded-xl text-sm font-bold border border-slate-100 outline-none" value={telegramConfig.googleSheetWebhook || ''} onChange={e => setTelegramConfig({...telegramConfig, googleSheetWebhook: e.target.value})} /></div><button onClick={() => { localStorage.setItem('olga_tg_config', JSON.stringify(telegramConfig)); alert('Сохранено!'); syncWithCloud(true); }} className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold text-[11px] uppercase tracking-widest">Обновить данные</button></div><AdminDashboard /><button onClick={() => setIsAdminAuthenticated(false)} className="w-full text-[10px] font-black text-slate-300 uppercase py-4">Выйти</button></div> : <div className="py-12 text-center space-y-6"><h2 className="text-xl font-bold uppercase text-slate-900">Вход в панель</h2><input type="password" placeholder="Пароль" className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl text-center outline-none" value={password} onChange={e => setPassword(e.target.value)} /><button onClick={() => password === ADMIN_PASSWORD && setIsAdminAuthenticated(true)} className="w-full bg-slate-900 text-white py-5 rounded-2xl font-bold uppercase text-[11px] tracking-widest">Войти</button></div>)}
      {checkoutProduct && (
        <div className="fixed inset-0 z-[6000] bg-slate-900/40 backdrop-blur-sm flex items-start justify-center p-6 pt-12">
          <div className="w-full max-w-md bg-white rounded-[2rem] p-8 space-y-6 relative shadow-2xl">
            <button onClick={() => setCheckoutProduct(null)} className="absolute top-6 right-8 text-slate-300"><X size={24}/></button>
            <h2 className="text-lg font-bold text-slate-900 uppercase">Оформление заказа</h2>
            <form onSubmit={handleCheckout} className="space-y-4">
              <input required placeholder="Ваше имя" className="w-full bg-slate-50 border border-slate-100 rounded-xl px-5 py-4 outline-none" value={customerName} onChange={e => setCustomerName(e.target.value)} />
              <input required type="email" placeholder="Email" className="w-full bg-slate-50 border border-slate-100 rounded-xl px-5 py-4 outline-none" value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} />
              <input required type="tel" placeholder="Телефон" className="w-full bg-slate-50 border border-slate-100 rounded-xl px-5 py-4 outline-none" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} />
              <div className="space-y-3 py-2">
                <label className="flex items-start gap-3"><input type="checkbox" required className="mt-1" /> <span className="text-[12px] text-slate-500">Согласен с <a href="https://axl.antol.net.ru/shabl/oferta_shab" target="_blank" className="text-indigo-600 underline">Офертой</a></span></label>
                <label className="flex items-start gap-3"><input type="checkbox" required className="mt-1" /> <span className="text-[12px] text-slate-500">Ознакомлен с <a href="https://axl.antol.net.ru/politica" target="_blank" className="text-indigo-600 underline">Политикой конфиденциальности</a></span></label>
              </div>
              <button type="submit" className="w-full py-5 rounded-xl font-bold uppercase text-[12px] tracking-widest bg-indigo-600 text-white">Оплатить {checkoutProduct.price} ₽</button>
            </form>
          </div>
        </div>
      )}
      {fullscreenImage && <div className="fixed inset-0 z-[8000] bg-black/95 flex items-center justify-center p-4" onClick={() => setFullscreenImage(null)}><img src={fullscreenImage} className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" alt="Full view" /></div>}
      {activePaymentUrl && (
        <div className="fixed inset-0 z-[7000] bg-white flex flex-col">
          <div className="p-4 border-b flex justify-between items-center"><span className="font-bold text-[11px] uppercase text-slate-400">Оплата</span><button onClick={() => { setActivePaymentUrl(null); setIframeLoaded(false); }} className="p-2 bg-rose-500 text-white rounded-xl shadow-md"><X size={20}/></button></div>
          <div className="flex-grow relative bg-slate-50">
            {!iframeLoaded && <div className="absolute inset-0 flex flex-col items-center justify-center p-10"><div className="w-16 h-16 border-[5px] border-indigo-600 border-t-transparent rounded-full animate-spin"></div><p className="mt-4 font-black uppercase text-[13px]">Загрузка оплаты...</p></div>}
            <iframe src={activePaymentUrl} className={`w-full h-full border-none transition-opacity ${iframeLoaded ? 'opacity-100' : 'opacity-0'}`} onLoad={() => setIframeLoaded(true)} />
          </div>
        </div>
      )}
    </Layout>
  );
};

export default App;
