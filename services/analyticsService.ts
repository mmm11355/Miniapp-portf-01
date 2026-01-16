
import { Session, OrderLog } from '../types';

const STORAGE_KEY = 'olga_analytics_sessions_v2';
const ORDERS_KEY = 'olga_analytics_orders_v2';

const getWebhookUrl = () => {
  try {
    const config = localStorage.getItem('olga_tg_config');
    if (config) {
      const parsed = JSON.parse(config);
      return parsed.googleSheetWebhook;
    }
  } catch (e) {}
  return null;
};

export const analyticsService = {
  getSessions: (): Session[] => {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  },

  getOrders: (): OrderLog[] => {
    const data = localStorage.getItem(ORDERS_KEY);
    return data ? JSON.parse(data) : [];
  },

  logOrder: async (order: Omit<OrderLog, 'id' | 'timestamp'>) => {
    const orders = analyticsService.getOrders();
    const newOrder: OrderLog = {
      ...order,
      id: Math.random().toString(36).substr(2, 9),
      timestamp: Date.now()
    };
    orders.push(newOrder);
    localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));

    const webhook = getWebhookUrl();
    if (webhook) {
      try {
        await fetch(webhook, {
          method: 'POST',
          mode: 'no-cors',
          body: JSON.stringify({ type: 'order', data: newOrder })
        });
      } catch (e) { console.error("Sync error", e); }
    }
  },

  startSession: async (): Promise<string> => {
    const sessionId = Math.random().toString(36).substr(2, 9);
    const params = new URLSearchParams(window.location.search);
    
    let city = 'Unknown';
    let country = 'Unknown';

    try {
      const response = await fetch('https://ipapi.co/json/');
      const locationData = await response.json();
      city = locationData.city || 'Unknown';
      country = locationData.country_name || 'Unknown';
    } catch (e) {
      console.warn('Could not fetch location', e);
    }

    const newSession: Session = {
      id: sessionId,
      startTime: Date.now(),
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
      try {
        await fetch(webhook, {
          method: 'POST',
          mode: 'no-cors',
          body: JSON.stringify({ type: 'session_start', data: newSession })
        });
      } catch (e) { console.error("Sync error", e); }
    }

    return sessionId;
  },

  updateSessionPath: async (sessionId: string, path: string) => {
    const sessions = analyticsService.getSessions();
    const index = sessions.findIndex(s => s.id === sessionId);
    if (index !== -1) {
      if (!sessions[index].pathHistory.includes(path)) {
        sessions[index].pathHistory.push(path);
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));

      const webhook = getWebhookUrl();
      if (webhook) {
        try {
          await fetch(webhook, {
            method: 'POST',
            mode: 'no-cors',
            body: JSON.stringify({ 
              type: 'path_update', 
              sessionId, 
              path, 
              timestamp: Date.now() 
            })
          });
        } catch (e) {}
      }
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
