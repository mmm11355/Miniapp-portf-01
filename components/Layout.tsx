
import React from 'react';
import { Home, Briefcase, ShoppingBag, Gift, Send, ShieldCheck } from 'lucide-react';
import { ViewState } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  activeView: ViewState;
  onNavigate: (view: ViewState) => void;
}

const Layout: React.FC<LayoutProps> = ({ children, activeView, onNavigate }) => {
  const navItems = [
    { id: 'home', label: 'Инфо', icon: Home },
    { id: 'portfolio', label: 'Кейсы', icon: Briefcase },
    { id: 'shop', label: 'Магазин', icon: ShoppingBag },
    { id: 'bonuses', label: 'Бонусы', icon: Gift },
    { id: 'contact', label: 'TG', icon: Send },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col max-w-md mx-auto shadow-2xl relative">
      <header className="sticky top-0 z-40 glass border-b border-slate-100 p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-xs shadow-lg shadow-indigo-200">ОА</div>
          <span className="font-bold text-slate-800 text-sm tracking-tight">О ГЕТКУРС И НЕ ТОЛЬКО</span>
        </div>
        <button 
          onClick={() => onNavigate('admin')}
          className={`p-2 rounded-xl transition-colors ${activeView === 'admin' ? 'bg-indigo-100 text-indigo-600' : 'text-slate-400'}`}
        >
          <ShieldCheck size={20} />
        </button>
      </header>

      <main className="flex-grow p-4 pb-24 overflow-x-hidden">
        {children}
      </main>

      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md glass border-t border-slate-200 grid grid-cols-5 h-20 px-1 z-50 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id as ViewState)}
              className={`flex flex-col items-center justify-center gap-1 transition-all ${
                isActive ? 'text-indigo-600' : 'text-slate-400'
              }`}
            >
              <div className={`p-2 rounded-xl transition-all ${isActive ? 'bg-indigo-50 scale-105' : ''}`}>
                <Icon size={isActive ? 22 : 20} strokeWidth={isActive ? 2.5 : 2} />
              </div>
              <span className={`text-[9px] font-black uppercase tracking-tighter ${isActive ? 'opacity-100' : 'opacity-70'}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};

export default Layout;
