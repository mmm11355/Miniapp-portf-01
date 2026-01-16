
import { Session, OrderLog } from '../types';

const STORAGE_KEY = 'olga_analytics_sessions_v2';
const ORDERS_KEY = 'olga_analytics_orders_v2';
const DEFAULT_WEBHOOK = 'https://script.google.com/macros/s/AKfycbwjPg6wu9cXpxcXpS5_DGkq18e5RSRgnD0szdntniGyZM5Qdh4vXITD6-J6Iezy0ltY/exec';

const getWebhookUrl = () => {
  try {
    const config = localStorage.getItem('olga_tg_config');
    if (config) {
      const parsed = JSON.parse(config);
      if (parsed.googleSheetWebhook) return parsed.googleSheetWebhook;
    }
  } catch (e) {}
  return DEFAULT_WEBHOOK;
};

let globalSessionId: string | null = null;
const formatNow = () => new Date().toLocaleString('ru-RU');

const sendToScript = async (payload: any) => {
  const webhook = getWebhookUrl();
  if (!webhook || webhook.trim() === '') return;

  try {
    // text/plain — это ключ к успеху для Google Script + CORS (no-cors)
    await fetch(webhook, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(payload)
    });
  } catch (e) {
    console.error("Critical Analytics Error:", e);
  }
};

export const analyticsService = {
  getSessions: (): Session[] => {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) { return []; }
  },

  getOrders: (): OrderLog[] => {
    try {
      const data = localStorage.getItem(ORDERS_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) { return []; }
  },

  logOrder: async (order: Omit<OrderLog, 'id' | 'timestamp'>, currentSessionId?: string) => {
    const timestamp = Date.now();
    const newOrder: OrderLog = {
      ...order,
      id: Math.random().toString(36).substr(2, 9),
      timestamp
    };

    const orders = analyticsService.getOrders();
    orders.push(newOrder);
    localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));

    await sendToScript({
      action: 'log',
      type: 'order',
      sessionId: currentSessionId || globalSessionId || 'unknown',
      name: newOrder.customerName,
      email: newOrder.customerEmail,
      phone: newOrder.customerPhone,
      product: newOrder.productTitle,
      price: newOrder.price,
      utmSource: newOrder.utmSource,
      dateStr: formatNow()
    });
  },

  startSession: async (): Promise<string> => {
    const sessionId = Math.random().toString(36).substr(2, 9);
    globalSessionId = sessionId;
    const params = new URLSearchParams(window.location.search);
    const timestamp = Date.now();
    
    let city = 'Unknown';
    let country = 'Unknown';

    try {
      const res = await fetch('https://ipapi.co/json/');
      if (res.ok) {
        const data = await res.json();
        city = data.city || 'Unknown';
        country = data.country_name || 'Unknown';
      }
    } catch (e) {}

    const newSession: Session = {
      id: sessionId,
      startTime: timestamp,
      city,
      country,
      pathHistory: ['home'],
      duration: 0,
      utmSource: params.get('utm_source') || 'direct',
      utmMedium: params.get('utm_medium') || 'none',
      utmCampaign: params.get('utm_campaign') || 'none'
    };

    const sessions = analyticsService.getSessions();
    sessions.push(newSession);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));

    await sendToScript({
      action: 'log',
      type: 'session_start',
      sessionId: sessionId,
      city: city,
      country: country,
      utmSource: newSession.utmSource,
      dateStr: formatNow()
    });

    return sessionId;
  },

  updateSessionPath: async (sessionId: string, path: string) => {
    if (!sessionId) return;
    
    const sessions = analyticsService.getSessions();
    const index = sessions.findIndex(s => s.id === sessionId);
    if (index !== -1) {
      if (!sessions[index].pathHistory.includes(path)) {
        sessions[index].pathHistory.push(path);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
      }
    }

    await sendToScript({
      action: 'log',
      type: 'path_update',
      sessionId: sessionId,
      path: path,
      product: `Переход: ${path}`,
      dateStr: formatNow()
    });
  },

  endSession: (sessionId: string) => {
    const sessions = analyticsService.getSessions();
    const index = sessions.findIndex(s => s.id === sessionId);
    if (index !== -1) {
      sessions[index].endTime = Date.now();
      sessions[index].duration = Math.floor((sessions[index].endTime! - sessions[index].startTime) / 1000);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
    }
  }
};
