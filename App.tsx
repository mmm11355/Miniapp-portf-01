
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Layout from './components/Layout';
import AdminDashboard from './components/AdminDashboard';
import { ViewState, Product, TelegramConfig } from './types';
import { INITIAL_PRODUCTS, ADMIN_PASSWORD } from './constants';
import { analyticsService } from './services/analyticsService';
import { 
  Plus, Trash2, Edit3, Save, X, ExternalLink, ChevronRight, Check, 
  Send, Link, Hash, Settings, Gift, Sparkles, CreditCard, Type, 
  Palette, PlayCircle, Image as ImageIcon, Info, ChevronLeft, Play, Layout as LayoutIcon, Tag, Youtube,
  FileText, Headphones, Map, LayoutTemplate, CheckSquare, BarChart3, Presentation, Table as TableIcon, User, Mail,
  Trophy, Award, Users as UsersIcon, Briefcase as BriefcaseIcon, Globe, Phone, ShieldCheck, Database, RefreshCw
} from 'lucide-react';

const App: React.FC = () => {
  const [view, setView] = useState<ViewState>('home');
  const [isSyncing, setIsSyncing] = useState(false);
  
  const [products, setProducts] = useState<Product[]>(() => {
    try {
      const saved = localStorage.getItem('olga_products_v27');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error("Failed to load products", e);
    }
    return INITIAL_PRODUCTS.map(p => ({
      ...p,
      mediaType: p.mediaType || 'image',
      useDetailModal: p.useDetailModal || false,
      buttonColor: p.buttonColor || '#6366f1',
      titleColor: p.titleColor || '',
      cardBgColor: p.cardBgColor || '', 
      section: p.section || 'shop'
    })) as Product[];
  });

  const [telegramConfig, setTelegramConfig] = useState<TelegramConfig>(() => {
    try {
      const saved = localStorage.getItem('olga_tg_config');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return { 
      botToken: '8319068202:AAERCkMtwnWXNGHLSN246DQShyaOHDK6z58', 
      chatId: '-1002095569247',
      googleSheetWebhook: 'https://script.google.com/macros/s/AKfycbwjPg6wu9cXpxcXpS5_DGkq18e5RSRgnD0szdntniGyZM5Qdh4vXITD6-J6Iezy0ltY/exec'
    };
  });

  const syncWithCloud = useCallback(async (showLoading = false) => {
    if (!telegramConfig.googleSheetWebhook) return;
    if (showLoading) setIsSyncing(true);
    
    try {
      const response = await fetch(`${telegramConfig.googleSheetWebhook}?action=getProducts&_t=${Date.now()}`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const rawData = await response.json();
      
      if (rawData && Array.isArray(rawData)) {
        const sanitizedData = rawData
          .filter((item: any) => {
            if (!item) return false;
            const hasTitle = item.title || item.Title || item.TITLE;
            return !!(hasTitle && String(hasTitle).trim() !== "");
          })
          .map((item: any, index: number) => {
            const p: any = {};
            Object.keys(item).forEach(key => {
              p[key.trim().toLowerCase()] = item[key];
            });

            let parsedGallery = [];
            const rawGallery = p.detailgallery || p.detailGallery;
            if (rawGallery) {
              if (Array.isArray(rawGallery)) {
                parsedGallery = rawGallery;
              } else if (typeof rawGallery === 'string') {
                const str = rawGallery.trim();
                if (str.startsWith('[') && str.endsWith(']')) {
                  try { parsedGallery = JSON.parse(str); } catch (e) { parsedGallery = []; }
                }
              }
            }

            return {
              ...p,
              id: p.id ? String(p.id) : `row-${index + 2}`,
              title: p.title || 'Без названия',
              description: p.description || '',
              category: p.category || 'GetCourse',
              price: Number(p.price) || 0,
              imageUrl: p.imageurl || p.imageUrl || '',
              mediaType: (p.mediatype || p.mediaType) === 'video' ? 'video' : 'image',
              features: Array.isArray(p.features) 
                ? p.features 
                : (p.features && typeof p.features === 'string' ? p.features.split(',').map((s: string) => s.trim()).filter(Boolean) : []),
              detailGallery: parsedGallery,
              useDetailModal: String(p.usedetailmodal || p.useDetailModal).toLowerCase() === 'true',
              section: (p.section === 'shop' || p.section === 'portfolio' || p.section === 'bonus') ? p.section : 'shop',
              buttonText: p.buttontext || p.buttonText || '',
              buttonColor: p.buttoncolor || p.buttonColor || '#6366f1',
              titleColor: p.titlecolor || p.titleColor || '',
              cardBgColor: p.cardbgcolor || p.cardBgColor || '',
              prodamusId: p.prodamusid || p.prodamusId || '',
              externalLink: p.externallink || p.externalLink || '',
              detailFullDescription: p.detailfulldescription || p.detailFullDescription || '',
              detailButtonText: p.detailbuttontext || p.detailButtonText || '',
              detailButtonColor: p.detailbuttoncolor || p.detailButtonColor || ''
            };
          });
        
        setProducts(sanitizedData);
        localStorage.setItem('olga_products_v27', JSON.stringify(sanitizedData));
      }
    } catch (e) {
      console.error("Cloud Sync Error:", e);
    } finally {
      if (showLoading) setIsSyncing(false);
    }
  }, [telegramConfig.googleSheetWebhook]);

  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp;
    if (tg) {
      tg.ready();
      tg.expand();
    }
    syncWithCloud(true);
  }, []);

  const [categories] = useState<string[]>(['GetCourse', 'Prodamus.xl']);
  const [sessionId, setSessionId] = useState<string>('');
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [filter, setFilter] = useState<string>('All');
  
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [activeDetailProduct, setActiveDetailProduct] = useState<Product | null>(null);
  const [checkoutProduct, setCheckoutProduct] = useState<Product | null>(null);
  const [activePaymentUrl, setActivePaymentUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');

  const [featureInput, setFeatureInput] = useState(''); 
  const [galleryInput, setGalleryInput] = useState('');

  const XL_API_KEY = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIwVUNwZElLa2pVLVVMR0lMNEFGVlNRIiwianRpIjoiYmNmMmI0ZjktMTFmOC00NTIzLWE3MjEtNmI3NGQzNTQ3OTY5IiwiaWF0IjoxNzY4NDU1MTk4LCJleHAiOjIwODM5ODc5OTcsInVzZXIiOiJ7XCJ0eXBlXCI6XCJhcGlcIixcImlkXCI6XCIwVUNwZElLa2pVLVVMR0lMNEFGVlNRXCIsXCJlbWFpbFwiOm51bGwsXCJmaXJzdE5hbWVcIjpcItC80LjQvdC40LDRgNGAXCIsXCJsYXN0TmFtZVwiOm51bGwsXCJwaG9uZVwiOm51bGwsXCJzY2hvb2xJZFwiOlwiNmpseWJERXRCa1NHZDc0MEUwckxzUVwiLFwiY29tbXVuaWNhdGlvbklkXCI6bnVsbCxcImNvbmN1cnJlbmN5U3RhbXBcIjpudWxsLFwic2Vzc2lvbklkXCI6bnVsbCxcImNoYXRVc2VyRGF0YVwiOntcImlkXCI6XCJJUnNiQnNQSEJrbW1aNkFNZmVhV3RnXCIsXCJyb2xlc1wiOlswXX19IiwiaHR0cDovL3NjaGVtYXMueG1sc29hcC5vcmcvd3MvMjAwNS8wNS9pZGVudGl0eS9jbGFpbXMvc3lzdGVtIjoiQWRtaW4iLCJuYmYiOjE3Njg0NTUxOTgsImlzcyI6IkFjY2VsIiwiYXVkIjoiYXBwLnhsLnJ1In0.daLjWzon5Avdcl6Iwtdk5cOx-LUiBsl27U9W5um8jLI";
  const XL_API_BASE = "https://api.xl.ru/api/v1";
  const FALLBACK_PAYMENT_URL = "https://antol.payform.ru/";

  const portfolioItems = useMemo(() => products.filter(p => p.section === 'portfolio'), [products]);
  const bonuses = useMemo(() => products.filter(p => p.section === 'bonus'), [products]);
  
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      if (p.section !== 'shop') return false;
      if (filter === 'All') return true;
      return p.category === filter;
    });
  }, [products, filter]);

  useEffect(() => {
    const initSession = async () => {
      try {
        const id = await analyticsService.startSession();
        setSessionId(id);
      } catch (e) { console.warn("Analytics error", e); }
    };
    initSession();
    return () => { if (sessionId) analyticsService.endSession(sessionId); };
  }, []);

  useEffect(() => {
    if (sessionId) {
      analyticsService.updateSessionPath(sessionId, view);
    }
    window.scrollTo(0, 0);
  }, [view, sessionId]);

  useEffect(() => {
    localStorage.setItem('olga_products_v27', JSON.stringify(products));
  }, [products]);

  useEffect(() => {
    localStorage.setItem('olga_tg_config', JSON.stringify(telegramConfig));
  }, [telegramConfig]);

  useEffect(() => {
    if (editingProduct) {
      setFeatureInput(editingProduct.features?.join(', ') || '');
      setGalleryInput(editingProduct.detailGallery?.map(g => g.url).join('\n') || '');
    }
  }, [editingProduct?.id]);

  const sendToGoogleSheet = async (leadData: any) => {
    if (!telegramConfig.googleSheetWebhook) return;
    try {
      await fetch(telegramConfig.googleSheetWebhook, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({
          action: 'log',
          type: 'lead',
          sessionId: sessionId,
          name: leadData.name,
          email: leadData.email,
          phone: leadData.phone,
          product: leadData.productTitle,
          price: leadData.price,
          dateStr: new Date().toLocaleString('ru-RU')
        })
      });
    } catch (e) { console.error("Sheet Error", e); }
  };

  const sendTelegramNotification = async (leadData: any) => {
    if (!telegramConfig.botToken || !telegramConfig.chatId) return;
    try {
      const tgUser = (window as any).Telegram?.WebApp?.initDataUnsafe?.user;
      const tgNick = tgUser?.username ? `@${tgUser.username}` : 'не определен';
      const tgFullName = [tgUser?.first_name, tgUser?.last_name].filter(Boolean).join(' ') || leadData.name;

      const message = `🚀 *НОВАЯ ЗАЯВКА!*\n\n` +
        `👤 Имя: ${tgFullName}\n` +
        `🆔 TG: ${tgNick}\n` +
        `📧 Email: ${leadData.email || '—'}\n` +
        `📱 Телефон: ${leadData.phone || '—'}\n` +
        `🛍 Товар: ${leadData.productTitle || '—'}\n` +
        `💰 Сумма: ${leadData.price || 0}₽`;

      await fetch(`https://api.telegram.org/bot${telegramConfig.botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: telegramConfig.chatId,
          text: message,
          parse_mode: 'Markdown'
        })
      });
    } catch (e) { console.error("TG Notify Error", e); }
  };

  const extractId = (data: any): string | null => {
    if (!data) return null;
    if (data.body && typeof data.body === 'string' && data.body.length > 5) return data.body;
    if (data.id) return String(data.id);
    if (data.data?.id) return String(data.data.id);
    return null;
  };

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkoutProduct || isSubmitting) return;
    setIsSubmitting(true);

    const userPaymentLink = (checkoutProduct.prodamusId || '').trim();
    const isFullUrl = userPaymentLink.startsWith('http');
    const params = new URLSearchParams(window.location.search);
    
    try {
      const leadInfo = {
        productTitle: checkoutProduct.title,
        price: checkoutProduct.price,
        name: customerName,
        email: customerEmail,
        phone: customerPhone
      };

      analyticsService.logOrder({
        productTitle: checkoutProduct.title,
        price: checkoutProduct.price,
        customerName: customerName,
        customerEmail: customerEmail,
        customerPhone: customerPhone,
        utmSource: params.get('utm_source') || 'direct'
      }, sessionId);

      sendToGoogleSheet(leadInfo);
      sendTelegramNotification(leadInfo);

      let axlOrderId: string | null = null;
      try {
        const leadId = await (async () => {
          const payload = {
            email: customerEmail.trim(),
            firstName: customerName.trim(),
            phone: customerPhone.trim(),
            utmSource: params.get('utm_source') || 'miniapp',
            comment: `Заказ: ${checkoutProduct.title}`
          };
          const res = await fetch(`${XL_API_BASE}/crm/lead`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': XL_API_KEY },
            body: JSON.stringify(payload)
          });
          const data = await res.json();
          return extractId(data);
        })();

        if (leadId) {
          const slug = userPaymentLink.split('/').pop()?.split('?')[0] || '';
          if (slug && !userPaymentLink.startsWith('http')) {
            const res = await fetch(`${XL_API_BASE}/purchase-order`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': XL_API_KEY },
              body: JSON.stringify({
                info: { leadId },
                contents: [{ productId: slug, quantity: 1, price: checkoutProduct.price }]
              })
            });
            const data = await res.json();
            axlOrderId = extractId(data);
          }
        }
      } catch (err) {
        console.warn("AXL Integration failed", err);
      }

      let finalRedirectUrl = axlOrderId && axlOrderId !== 'undefined' 
        ? `https://axl.antol.net.ru/checkout?orderId=${axlOrderId}`
        : isFullUrl ? userPaymentLink : FALLBACK_PAYMENT_URL;

      try {
        const urlObj = new URL(finalRedirectUrl);
        urlObj.searchParams.set('customer_email', customerEmail);
        urlObj.searchParams.set('customer_name', customerName);
        urlObj.searchParams.set('customer_phone', customerPhone);
        finalRedirectUrl = urlObj.toString();
      } catch (e) {
        const sep = finalRedirectUrl.includes('?') ? '&' : '?';
        finalRedirectUrl += `${sep}customer_email=${encodeURIComponent(customerEmail)}`;
      }

      setActivePaymentUrl(finalRedirectUrl);
      setCheckoutProduct(null); 
    } catch (err) {
      setActivePaymentUrl(`${FALLBACK_PAYMENT_URL}?email=${encodeURIComponent(customerEmail)}`);
      setCheckoutProduct(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    
    const galleryLines = (galleryInput || '').split('\n').filter(l => l.trim() !== '');
    const gallery = galleryLines.map(url => ({
      url: url.trim(),
      type: (url.match(/\.(mp4|webm|mov|gif)$/i) || url.includes('youtube') || url.includes('rutube') || url.includes('dzen.ru')) ? 'video' : 'image'
    }));
    
    const updatedProduct: Product = {
      ...editingProduct,
      features: (featureInput || '').split(',').map(s => s.trim()).filter(s => s !== ''),
      detailGallery: gallery as any
    };

    if (products.find(p => p.id === updatedProduct.id)) {
      setProducts(products.map(p => p.id === updatedProduct.id ? updatedProduct : p));
    } else {
      setProducts([...products, updatedProduct]);
    }
    setEditingProduct(null);
  };

  const getEmbedUrl = (url: string) => {
    if (!url) return null;
    const cleanUrl = url.trim();
    const ytMatch = cleanUrl.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
    if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;
    const rtMatch = cleanUrl.match(/(?:rutube\.ru\/video\/|rutube\.ru\/play\/embed\/)([a-zA-Z0-9]+)/);
    if (rtMatch) return `https://rutube.ru/play/embed/${rtMatch[1]}`;
    const dzenMatch = cleanUrl.match(/dzen\.ru\/(?:video\/watch\/|shorts\/)([a-zA-Z0-9_-]+)/);
    if (dzenMatch) return `https://dzen.ru/embed/${dzenMatch[1]}`;
    return null;
  };

  const MediaRenderer: React.FC<{ url: string; type: 'image' | 'video'; className?: string }> = ({ url, type, className }) => {
    if (!url) return <div className={`bg-slate-100 flex items-center justify-center text-slate-300 ${className}`}><ImageIcon size={24} /></div>;
    const embedUrl = getEmbedUrl(url);
    if (embedUrl) return <iframe src={embedUrl} className={className} frameBorder="0" allowFullScreen loading="lazy" />;
    const isVideoFile = type === 'video' || url.match(/\.(mp4|webm|mov|gif)$/i);
    if (isVideoFile) return <video src={url} className={className} autoPlay muted loop playsInline style={{ objectFit: 'cover' }} />;
    return <img src={url} className={className} alt="" style={{ objectFit: 'cover' }} />;
  };

  const renderProductCard = (p: Product) => {
    const isGC = (p.category || '').toLowerCase().includes('getcourse');
    const isPro = (p.category || '').toLowerCase().includes('prodamus');
    const bg = p.cardBgColor || (isGC ? '#f3f0ff' : isPro ? '#ecfdf5' : '#eff6ff');
    const iconColor = p.buttonColor || '#6366f1';

    return (
      <div key={p.id} style={{ backgroundColor: bg }} className="rounded-lg border border-white/50 overflow-hidden shadow-sm flex flex-col active:scale-[0.98] transition-all">
        <div className="p-6 pb-2 flex justify-between items-start">
          <div style={{ color: iconColor }} className="opacity-80"><Sparkles size={24} strokeWidth={2.5} /></div>
          <button onClick={(e) => {e.stopPropagation(); setEditingProduct(p);}} className="p-2 bg-white/40 rounded-full text-slate-600 active:scale-75 transition-transform"><Edit3 size={14} /></button>
        </div>
        <div className="px-6 pb-4">
          <h3 
            style={{ color: p.titleColor }} 
            className="text-2xl font-black tracking-tighter leading-[1.1]"
          >
            {p.title}
          </h3>
        </div>
        <div className="aspect-[16/9] relative bg-slate-900/5 mx-6 rounded-lg overflow-hidden mb-4"><MediaRenderer url={p.imageUrl} type={p.mediaType} className="w-full h-full" /></div>
        <div className="px-6 pb-6 space-y-4">
          <p className="text-[13px] text-slate-500 font-bold opacity-80 line-clamp-2 leading-tight">{p.description}</p>
          <div className="flex flex-wrap gap-1.5">
            {p.features?.slice(0, 3).map((f, i) => (
              <span key={i} className="bg-white/60 text-slate-400 text-[9px] font-black px-3 py-1 rounded-lg uppercase tracking-tighter border border-white/20">{f}</span>
            ))}
          </div>
          <button 
            onClick={() => {
              if (p.useDetailModal) setActiveDetailProduct(p);
              else if (p.prodamusId && p.section === 'shop') setCheckoutProduct(p);
              else if (p.externalLink) window.open(p.externalLink, '_blank');
            }}
            style={{ backgroundColor: p.buttonColor || '#6366f1' }}
            className="w-full flex items-center justify-center gap-2 text-white py-4 px-6 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl active:scale-95 transition-transform"
          >
            {p.buttonText || (p.section === 'shop' ? 'Купить' : 'Забрать')} <ChevronRight size={14} />
          </button>
        </div>
      </div>
    );
  };

  return (
    <Layout activeView={view} onNavigate={setView}>
      <div className="space-y-4">
        {view === 'home' && (
          <div className="space-y-4 animate-in fade-in duration-700">
            <div className="relative text-center py-2">
              <div className="w-44 h-44 mx-auto relative mb-4">
                 <div className="absolute inset-0 bg-indigo-600 rounded-[3rem] rotate-3 opacity-10 scale-105" />
                 <div className="relative w-full h-full bg-white rounded-[3rem] p-1.5 shadow-2xl overflow-hidden border border-slate-100">
                    <img src="https://i.imgur.com/bQ8ic2w.png" alt="Ольга" className="w-full h-full object-cover rounded-[2.5rem]" />
                 </div>
                 <div className="absolute -bottom-1 -right-1 bg-indigo-600 text-white p-2.5 rounded-2xl shadow-lg"><Sparkles size={20} fill="currentColor" /></div>
              </div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase leading-none mb-1">Ольга Антонова</h1>
              <p className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em] opacity-80">Решения GetCourse & Prodamus.XL</p>
            </div>
            <div className="bg-white p-6 rounded-lg border border-slate-100 shadow-sm space-y-3">
              <div className="flex items-center gap-4"><Trophy className="text-amber-500" size={18} /><p className="text-xs font-bold text-slate-700">Победитель Хакатона EdMarket</p></div>
              <div className="flex items-center gap-4"><Award className="text-indigo-500" size={18} /><p className="text-xs font-bold text-slate-700">Сертифицированный специалист GetCourse и Prodamus.XL</p></div>
              <div className="flex items-center gap-4"><BriefcaseIcon className="text-emerald-500" size={18} /><p className="text-xs font-bold text-slate-700">60+ реализованных проектов</p></div>
              <div className="flex items-center gap-4"><Globe className="text-blue-500" size={18} /><p className="text-xs font-bold text-slate-700">Сайт-портфолио <a href="https://vk.cc/cOx50S" target="_blank" className="text-indigo-600 underline">https://vk.cc/cOx50S</a></p></div>
            </div>
            <button onClick={() => setView('contact')} className="w-full bg-indigo-600 text-white p-6 rounded-lg shadow-xl text-left relative overflow-hidden active:scale-98 transition-transform">
              <div className="relative z-10 space-y-0.5">
                <h3 className="text-lg font-black tracking-tighter leading-none">Нужна консультация?</h3>
                <p className="text-[9px] font-black opacity-70 uppercase tracking-widest mt-1">Связаться в Telegram</p>
              </div>
              <Send className="absolute top-1/2 -right-4 -translate-y-1/2 opacity-10" size={100} />
            </button>
          </div>
        )}
        
        {view === 'portfolio' && <div className="grid grid-cols-1 gap-6">{portfolioItems.map(renderProductCard)}</div>}
        {view === 'shop' && (
          <div className="space-y-6">
            <div className="flex gap-2 overflow-x-auto no-scrollbar py-2">
              {['All', ...categories].map(c => (
                <button key={c} onClick={() => setFilter(c)} className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border flex-shrink-0 transition-all ${filter === c ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white text-slate-400 border-slate-100'}`}>{c === 'All' ? 'Все' : c}</button>
              ))}
            </div>
            <div className="grid grid-cols-1 gap-6">{filteredProducts.map(renderProductCard)}</div>
          </div>
        )}
        {view === 'bonuses' && <div className="grid grid-cols-1 gap-6">{bonuses.map(renderProductCard)}</div>}
        {view === 'contact' && (
          <div className="text-center py-20 space-y-8 animate-in zoom-in duration-300">
            <div className="w-24 h-24 bg-indigo-600 rounded-[2rem] flex items-center justify-center text-white mx-auto shadow-2xl"><Send size={40} /></div>
            <h2 className="text-3xl font-black uppercase tracking-tighter leading-none">Связь со мной</h2>
            <a href="https://t.me/Olga_lav" target="_blank" className="inline-block bg-slate-900 text-white px-12 py-5 rounded-2xl font-black uppercase tracking-widest active:scale-95 transition-transform">Telegram</a>
          </div>
        )}

        {view === 'admin' && (
          isAdminAuthenticated ? (
            <div className="space-y-10 pb-32 animate-in fade-in duration-300">
              <div className="flex flex-col gap-4 bg-white p-6 rounded-lg border border-slate-100 shadow-sm">
                <div className="flex items-center justify-between gap-2 mb-2">
                   <div className="flex items-center gap-2">
                    <Database className="text-indigo-600" size={16} />
                    <h3 className="font-black text-[10px] uppercase text-slate-400 tracking-wider">Интеграции</h3>
                   </div>
                   <button 
                    onClick={() => syncWithCloud(true)} 
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all ${isSyncing ? 'bg-indigo-100 text-indigo-400' : 'bg-indigo-600 text-white shadow-lg active:scale-90'}`}
                    disabled={isSyncing}
                   >
                    {isSyncing ? <RefreshCw className="animate-spin" size={10} /> : <RefreshCw size={10} />}
                    {isSyncing ? 'Синхронизация...' : 'Обновить каталог'}
                   </button>
                </div>
                <div className="space-y-2">
                  <label className="text-[8px] font-black uppercase text-slate-400 ml-2">Telegram Bot Token</label>
                  <input placeholder="Bot Token" className="w-full bg-slate-50 p-4 rounded-xl text-xs font-bold border border-slate-100 outline-none" value={telegramConfig.botToken} onChange={e => setTelegramConfig({...telegramConfig, botToken: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="text-[8px] font-black uppercase text-slate-400 ml-2">Telegram Chat ID</label>
                  <input placeholder="Chat ID" className="w-full bg-slate-50 p-4 rounded-xl text-xs font-bold border border-slate-100 outline-none" value={telegramConfig.chatId} onChange={e => setTelegramConfig({...telegramConfig, chatId: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="text-[8px] font-black uppercase text-rose-400 ml-2">Google Apps Script URL (Таблица)</label>
                  <input placeholder="https://script.google.com/macros/s/..." className="w-full bg-slate-50 p-4 rounded-xl text-xs font-bold border border-rose-100 outline-none" value={telegramConfig.googleSheetWebhook || ''} onChange={e => setTelegramConfig({...telegramConfig, googleSheetWebhook: e.target.value})} />
                </div>
                <button onClick={() => { localStorage.setItem('olga_tg_config', JSON.stringify(telegramConfig)); alert('Настройки сохранены! Обновляю данные...'); syncWithCloud(true); }} className="bg-indigo-600 text-white py-4 rounded-xl font-black text-[9px] uppercase tracking-widest shadow-lg active:scale-95 transition-transform">Сохранить всё</button>
              </div>
              <AdminDashboard />
              <div className="flex justify-between items-center px-2">
                <h3 className="font-black text-slate-800 uppercase text-[10px] tracking-widest">Контент ({products.length})</h3>
                <button onClick={() => setEditingProduct({ id: Math.random().toString(36).substr(2, 9), title: '', description: '', category: 'GetCourse', price: 0, imageUrl: '', mediaType: 'image', features: [], section: 'shop', useDetailModal: false })} className="bg-slate-900 text-white p-4 rounded-2xl shadow-xl"><Plus size={24} /></button>
              </div>
              <div className="space-y-3">
                {products.map(p => (
                  <div key={p.id} className="bg-white p-5 rounded-[2rem] border border-slate-100 flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-slate-100 overflow-hidden"><MediaRenderer url={p.imageUrl} type={p.mediaType} className="w-full h-full" /></div>
                      <div>
                        <p className="font-black text-sm text-slate-900 truncate w-32 tracking-tight leading-none">{p.title}</p>
                        <p className="text-[9px] font-black text-slate-400 uppercase mt-1">{p.section}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setEditingProduct(p)} className="p-3 text-indigo-600 bg-indigo-50/50 rounded-xl active:scale-75 transition-transform"><Edit3 size={18} /></button>
                      <button onClick={() => {if(window.confirm('Удалить?')) setProducts(products.filter(x => x.id !== p.id))}} className="p-3 text-red-400 bg-red-50/50 rounded-xl active:scale-75 transition-transform"><Trash2 size={18} /></button>
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={() => setIsAdminAuthenticated(false)} className="w-full text-[10px] font-black text-slate-400 uppercase py-4">Выйти</button>
            </div>
          ) : (
            <div className="py-12 text-center space-y-6">
              <div className="w-16 h-16 bg-slate-900 text-white rounded-[1.5rem] flex items-center justify-center mx-auto shadow-2xl"><ShieldCheck size={32} /></div>
              <h2 className="text-2xl font-black tracking-tighter leading-none">Вход в панель</h2>
              <input type="password" placeholder="Пароль" className="w-full p-5 bg-white border border-slate-100 rounded-2xl font-bold text-center outline-none shadow-sm" value={password} onChange={e => setPassword(e.target.value)} />
              <button onClick={() => password === ADMIN_PASSWORD && setIsAdminAuthenticated(true)} className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black uppercase tracking-widest active:scale-95 transition-transform shadow-xl">Войти</button>
            </div>
          )
        )}
      </div>

      {checkoutProduct && (
        <div className="fixed inset-0 z-[2000] bg-slate-900/60 backdrop-blur-md flex items-start justify-center p-6 pt-12 animate-in fade-in duration-300">
          <div className="w-full max-w-md bg-white rounded-lg p-8 pb-10 space-y-6 shadow-2xl relative animate-in zoom-in duration-300">
            <button onClick={() => setCheckoutProduct(null)} className="absolute top-6 right-8 p-2 bg-slate-50 rounded-xl text-slate-400 active:scale-75 transition-transform"><X size={24}/></button>
            <h2 className="text-2xl font-black tracking-tighter uppercase text-slate-900 leading-none">Оформление</h2>
            <form onSubmit={handleCheckout} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400 ml-4">Как вас зовут?</label>
                <input required placeholder="Имя" className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 font-bold outline-none focus:ring-2 ring-indigo-500/20" value={customerName} onChange={e => setCustomerName(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400 ml-4">Email для чека</label>
                <input required type="email" placeholder="Email" className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 font-bold outline-none focus:ring-2 ring-indigo-500/20" value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400 ml-4">Телефон</label>
                <input required type="tel" placeholder="Телефон" className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 font-bold outline-none focus:ring-2 ring-indigo-500/20" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} />
              </div>
              <div className="bg-indigo-50 p-6 rounded-3xl flex justify-between items-center border border-indigo-100 mt-2">
                <p className="text-2xl font-black text-indigo-600">{checkoutProduct.price} ₽</p>
                <CreditCard size={24} className="text-indigo-400" />
              </div>
              <button disabled={isSubmitting} type="submit" className="w-full bg-indigo-600 text-white py-5 rounded-2xl font-black uppercase tracking-widest shadow-xl disabled:opacity-50 active:scale-95 transition-transform flex items-center justify-center gap-2">
                {isSubmitting ? <><div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" /> Подготовка...</> : 'Оплатить'}
              </button>
            </form>
          </div>
        </div>
      )}

      {activePaymentUrl && (
        <div className="fixed inset-0 z-[3000] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="w-full max-w-lg bg-white rounded-lg shadow-2xl overflow-hidden flex flex-col h-[75vh] max-h-[700px] animate-in zoom-in duration-300 relative">
            <button onClick={() => setActivePaymentUrl(null)} className="absolute top-4 right-4 z-[3010] p-3 bg-red-500 text-white rounded-xl active:scale-75 transition-transform shadow-xl"><X size={24} strokeWidth={3} /></button>
            <div className="p-4 bg-white border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-emerald-500 rounded-md flex items-center justify-center text-white"><Check size={14} strokeWidth={3} /></div>
                <span className="font-black text-[10px] uppercase tracking-widest text-slate-500">Безопасная оплата</span>
              </div>
            </div>
            <div className="flex-grow bg-slate-50 relative">
              <iframe 
                src={activePaymentUrl} 
                className="w-full h-full border-none"
                title="Payment"
                allow="payment"
              />
            </div>
          </div>
        </div>
      )}

      {activeDetailProduct && (
        <div className="fixed inset-0 z-[1000] bg-white animate-in slide-in-from-bottom duration-500 overflow-y-auto pb-32">
          <div className="p-4 flex items-center gap-4 sticky top-0 bg-white/95 backdrop-blur-md z-10 border-b border-slate-100">
            <button onClick={() => setActiveDetailProduct(null)} className="p-2 bg-slate-50 rounded-xl text-slate-500"><ChevronLeft size={24} /></button>
            <span className="font-black uppercase text-[10px] tracking-widest truncate text-slate-400 leading-none">{activeDetailProduct.title}</span>
          </div>
          <div className="p-6 space-y-8">
            <div className="aspect-video rounded-lg overflow-hidden shadow-2xl bg-slate-900">
               <MediaRenderer url={activeDetailProduct.imageUrl} type={activeDetailProduct.mediaType} className="w-full h-full" />
            </div>
            <h2 className="text-3xl font-black tracking-tighter leading-[1.1] text-slate-900 uppercase">{activeDetailProduct.title}</h2>
            <p className="text-sm font-bold text-slate-600 leading-[1.4] whitespace-pre-wrap">{activeDetailProduct.detailFullDescription || activeDetailProduct.description}</p>
            {activeDetailProduct.detailGallery && activeDetailProduct.detailGallery.length > 0 && (
              <div className="space-y-4">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Галерея</h4>
                {activeDetailProduct.detailGallery.map((item, idx) => (
                  <div key={idx} className="rounded-lg overflow-hidden border border-slate-100 bg-slate-50 shadow-sm mb-4">
                     <MediaRenderer url={item.url} type={item.type} className="w-full aspect-auto" />
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-full max-w-xs px-6">
            <button 
              onClick={() => {
                const p = activeDetailProduct;
                setActiveDetailProduct(null); 
                if (p.prodamusId && p.section === 'shop') {
                  setTimeout(() => setCheckoutProduct(p), 400);
                } else if (p.externalLink) {
                  window.open(p.externalLink, '_blank');
                }
              }}
              style={{ backgroundColor: activeDetailProduct.detailButtonColor || activeDetailProduct.buttonColor || '#6366f1' }}
              className="w-full text-white py-5 rounded-2xl font-black uppercase tracking-widest shadow-2xl active:scale-95 transition-transform"
            >
              {activeDetailProduct.detailButtonText || activeDetailProduct.buttonText || 'Заказать'} <ChevronRight size={18} className="inline ml-1" />
            </button>
          </div>
        </div>
      )}

      {editingProduct && (
        <div className="fixed inset-0 z-[3000] bg-slate-900/95 p-4 flex items-center justify-center backdrop-blur-sm">
          <form onSubmit={handleSaveProduct} className="bg-white w-full max-w-sm rounded-lg p-6 space-y-6 overflow-y-auto max-h-[90vh] shadow-2xl relative">
            <div className="flex justify-between items-center sticky top-0 bg-white pb-2 z-10">
              <h4 className="font-black uppercase tracking-widest text-slate-400 text-xs">Редактор</h4>
              <button type="button" onClick={() => setEditingProduct(null)} className="p-2 bg-slate-50 rounded-xl"><X size={20}/></button>
            </div>
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[8px] font-black uppercase text-slate-400 ml-2">Название</label>
                <input required className="w-full bg-slate-50 border border-slate-100 p-4 rounded-xl font-bold" value={editingProduct.title} onChange={e => setEditingProduct({...editingProduct, title: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[8px] font-black uppercase text-slate-400 ml-2">Категория</label>
                  <select className="w-full bg-slate-50 border border-slate-100 p-4 rounded-xl font-bold text-xs" value={editingProduct.category} onChange={e => setEditingProduct({...editingProduct, category: e.target.value})}>
                    {['GetCourse', 'Prodamus.xl'].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[8px] font-black uppercase text-slate-400 ml-2">Раздел</label>
                  <select className="w-full bg-slate-50 border border-slate-100 p-4 rounded-xl font-bold text-xs" value={editingProduct.section} onChange={e => setEditingProduct({...editingProduct, section: e.target.value as any})}>
                    <option value="shop">Магазин</option>
                    <option value="portfolio">Кейсы</option>
                    <option value="bonus">Бонусы</option>
                  </select>
                </div>
              </div>
              <button type="submit" className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black uppercase shadow-xl active:scale-95 transition-transform flex items-center justify-center gap-2"><Save size={18} /> Сохранить</button>
            </div>
          </form>
        </div>
      )}
    </Layout>
  );
};

export default App;
