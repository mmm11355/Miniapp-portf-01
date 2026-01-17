
import { Session, OrderLog } from '../types';

const STORAGE_KEY = 'olga_analytics_sessions_v2';
const ORDERS_KEY = 'olga_analytics_orders_v2';
const DEFAULT_WEBHOOK = 'https://script.google.com/macros/s/AKfycby3JT65rFs7fB4n7GYph3h6qonOEERRxiyhD11DRD9lT4TkDCin9Q4uF5vcclXPpt46/exec';

const getTgUsername = () => {
  try {
    const tg = (window as any).Telegram?.WebApp;
    return tg?.initDataUnsafe?.user?.username ? `@${tg.initDataUnsafe.user.username}` : 'нет_ника';
  } catch (e) {
    return 'undefined';
  }
};

const getWebhookUrl = () => {
  try {
    const config = localStorage.getItem('olga_tg_config');
    if (config) {
      const parsed = JSON.parse(config);
      if (parsed.googleSheetWebhook && parsed.googleSheetWebhook.trim() !== '') {
        return parsed.googleSheetWebhook;
      }
    }
  } catch (e) {}
  return DEFAULT_WEBHOOK;
};

let globalSessionId: string | null = null;
const formatNow = () => new Date().toLocaleString('ru-RU');

const sendToScript = async (payload: any) => {
  const webhook = getWebhookUrl();
  if (!webhook) return;

  try {
    await fetch(webhook, {
      method: 'POST',
      keepalive: true,
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    });
  } catch (e) {
    console.warn("Analytics Sync Issue:", e);
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

  logOrder: async (order: Omit<OrderLog, 'id' | 'timestamp' | 'paymentStatus'>, currentSessionId?: string) => {
    const timestamp = Date.now();
    const tgUsername = getTgUsername();
    const newOrder: OrderLog = {
      ...order,
      id: Math.random().toString(36).substr(2, 9),
      timestamp,
      tgUsername,
      paymentStatus: 'pending'
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
      tgUsername: tgUsername,
      product: newOrder.productTitle,
      price: newOrder.price,
      utmSource: newOrder.utmSource,
      paymentStatus: 'pending',
      agreedToMarketing: newOrder.agreedToMarketing ? 'Да' : 'Нет',
      dateStr: formatNow()
    });
    
    return newOrder;
  },

  updateOrderStatus: async (orderId: string, status: 'paid' | 'failed') => {
    const orders = analyticsService.getOrders();
    const idx = orders.findIndex(o => o.id === orderId);
    if (idx !== -1) {
      orders[idx].paymentStatus = status;
      localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
      
      await sendToScript({
        action: 'log',
        type: 'path_update',
        sessionId: globalSessionId || 'unknown',
        path: `payment_${status}`,
        product: `Статус заказа ${orderId} изменен на ${status}`,
        dateStr: formatNow()
      });
    }
  },

  startSession: async (): Promise<string> => {
    const sessionId = Math.random().toString(36).substr(2, 9);
    globalSessionId = sessionId;
    const params = new URLSearchParams(window.location.search);
    const timestamp = Date.now();
    
    const utmSource = params.get('utm_source') || 'direct';
    const tgUsername = getTgUsername();
    
    const newSession: Session = {
      id: sessionId,
      startTime: timestamp,
      city: 'Mobile Device',
      country: 'Detected',
      pathHistory: ['home'],
      duration: 0,
      utmSource: utmSource,
      utmMedium: params.get('utm_medium') || 'none',
      utmCampaign: params.get('utm_campaign') || 'none'
    };

    const sessions = analyticsService.getSessions();
    sessions.push(newSession);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));

    sendToScript({
      action: 'log',
      type: 'session_start',
      sessionId: sessionId,
      tgUsername: tgUsername,
      city: 'Mobile/Web',
      country: 'Active',
      utmSource: utmSource,
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
  }
};
