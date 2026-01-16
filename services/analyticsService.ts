
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

let pendingLogs: { path: string }[] = [];
let globalSessionId: string | null = null;

const formatNow = () => new Date().toLocaleString('ru-RU');

export const analyticsService = {
  getSessions: (): Session[] => {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  },

  getOrders: (): OrderLog[] => {
    const data = localStorage.getItem(ORDERS_KEY);
    return data ? JSON.parse(data) : [];
  },

  // Используем GET для логирования, так как Google Script гарантированно видит параметры в doGet
  logOrder: async (order: Omit<OrderLog, 'id' | 'timestamp'>, currentSessionId?: string) => {
    const orders = analyticsService.getOrders();
    const timestamp = Date.now();
    const newOrder: OrderLog = {
      ...order,
      id: Math.random().toString(36).substr(2, 9),
      timestamp
    };
    orders.push(newOrder);
    localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));

    const webhook = getWebhookUrl();
    if (webhook) {
      const sid = currentSessionId || globalSessionId || 'unknown';
      const params = new URLSearchParams({
        action: 'log',
        type: 'order',
        sessionId: sid,
        name: newOrder.customerName,
        email: newOrder.customerEmail,
        product: newOrder.productTitle,
        price: String(newOrder.price),
        utmSource: newOrder.utmSource,
        dateStr: formatNow(),
        _t: String(timestamp)
      });
      
      // GET запрос для надежности
      fetch(`${webhook}${webhook.includes('?') ? '&' : '?'}${params.toString()}`, {
        method: 'GET',
        mode: 'no-cors'
      }).catch(e => console.error("Order logging failed", e));
    }
  },

  startSession: async (): Promise<string> => {
    const sessionId = Math.random().toString(36).substr(2, 9);
    globalSessionId = sessionId;
    const params = new URLSearchParams(window.location.search);
    const timestamp = Date.now();
    
    let city = 'Unknown';
    let country = 'Unknown';

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1200);
      const response = await fetch('https://ipapi.co/json/', { signal: controller.signal });
      clearTimeout(timeoutId);
      if (response.ok) {
        const locationData = await response.json();
        city = locationData.city || 'Unknown';
        country = locationData.country_name || 'Unknown';
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

    const webhook = getWebhookUrl();
    if (webhook) {
      const queryParams = new URLSearchParams({
        action: 'log',
        type: 'session_start',
        sessionId: sessionId,
        city: city,
        country: country,
        utmSource: newSession.utmSource,
        dateStr: formatNow(),
        _t: String(timestamp)
      });
      
      fetch(`${webhook}${webhook.includes('?') ? '&' : '?'}${queryParams.toString()}`, {
        method: 'GET',
        mode: 'no-cors'
      }).catch(e => console.error("Session start failed", e));
    }

    if (pendingLogs.length > 0) {
      const logs = [...pendingLogs];
      pendingLogs = [];
      logs.forEach(log => analyticsService.updateSessionPath(sessionId, log.path));
    }

    return sessionId;
  },

  updateSessionPath: async (sessionId: string, path: string) => {
    if (!sessionId) {
      pendingLogs.push({ path });
      return;
    }
    
    const timestamp = Date.now();
    const sessions = analyticsService.getSessions();
    const index = sessions.findIndex(s => s.id === sessionId);
    if (index !== -1) {
      if (!sessions[index].pathHistory.includes(path)) {
        sessions[index].pathHistory.push(path);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
      }
    }

    const webhook = getWebhookUrl();
    if (webhook) {
      const queryParams = new URLSearchParams({
        action: 'log',
        type: 'path_update',
        sessionId: sessionId,
        path: path,
        product: `Переход: ${path}`,
        dateStr: formatNow(),
        _t: String(timestamp)
      });
      
      fetch(`${webhook}${webhook.includes('?') ? '&' : '?'}${queryParams.toString()}`, {
        method: 'GET',
        mode: 'no-cors'
      }).catch(e => console.error("Path update failed", e));
    }
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
