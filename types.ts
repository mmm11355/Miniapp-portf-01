
export interface Product {
  id: string;
  title: string;
  description: string;
  category: string;
  price: number;
  imageUrl: string; 
  mediaType: 'image' | 'video'; 
  features: string[];
  externalLink?: string;
  buttonText?: string;
  buttonColor?: string; 
  titleColor?: string;
  cardBgColor?: string; 
  prodamusId?: string; 
  section: 'shop' | 'portfolio' | 'bonus';
  useDetailModal: boolean; 
  detailFullDescription?: string;
  detailGallery?: { url: string; type: 'image' | 'video' }[];
  detailButtonText?: string;
  detailButtonColor?: string;
}

export interface OrderLog {
  id: string;
  timestamp: number;
  productTitle: string;
  price: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  utmSource: string;
}

export interface Session {
  id: string;
  startTime: number;
  endTime?: number;
  city: string;
  country: string;
  pathHistory: string[];
  duration: number;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
}

export interface TelegramConfig {
  botToken: string;
  chatId: string;
  googleSheetWebhook?: string;
}

export type ViewState = 'home' | 'portfolio' | 'shop' | 'bonuses' | 'contact' | 'admin';
