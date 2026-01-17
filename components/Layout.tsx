
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
    { id: 'home', label: 'ИНФО', icon: Home },
    { id: 'portfolio', label: 'КЕЙСЫ', icon: Briefcase },
    { id: 'shop', label: 'МАГАЗИН', icon: ShoppingBag },
    { id: 'bonuses', label: 'БОНУСЫ', icon: Gift },
    { id: 'contact', label: 'TG', icon: Send },
  ];

  return (
    <div className="min-h-screen bg-[#f6f8fb] flex flex-col max-w-md mx-auto relative border-x border-slate-50 overflow-x-hidden">
      {/* Шапка стала более компактной (py-2.5 вместо py-4) */}
      <header className="sticky top-0 z-[80] bg-[#f0f3ff]/95 backdrop-blur-md border-b border-indigo-100/50 px-5 py-2.5 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3" onClick={() => onNavigate('home')}>
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-black text-[10px] shadow-md">ОА</div>
          <div className="flex flex-col">
             <span className="font-bold text-slate-900 text-[12px] tracking-tight uppercase leading-none">О ГЕТКУРС</span>
             <span className="font-bold text-indigo-500 text-[8px] tracking-widest uppercase mt-0.5">И НЕ ТОЛЬКО</span>
          </div>
        </div>
        <button onClick={() => onNavigate('admin')} className={`p-2 transition-all rounded-xl ${activeView === 'admin' ? 'bg-indigo-100 text-indigo-700' : 'text-indigo-200'}`}>
          <ShieldCheck size={18} strokeWidth={2.5} />
        </button>
      </header>

      {/* Основной отступ уменьшен (p-4 вместо p-5) */}
      <main className="flex-grow p-4 pb-32">
        {children}
      </main>

      {/* Навигация */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-[#f0f3ff]/95 backdrop-blur-xl border-t border-indigo-100/50 grid grid-cols-5 h-20 px-2 z-[90] pb-safe shadow-[0_-8px_30px_rgba(79,70,229,0.08)]">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id as ViewState)}
              className="flex flex-col items-center justify-center gap-1 transition-all active:scale-90"
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${isActive ? 'bg-indigo-600 text-white shadow-indigo-200 shadow-lg' : 'text-indigo-300'}`}>
                <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
              </div>
              <span className={`text-[8px] font-bold tracking-widest ${isActive ? 'text-indigo-700' : 'text-indigo-300/80'}`}>
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
