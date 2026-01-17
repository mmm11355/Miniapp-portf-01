
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
      {/* Шапка: возврат к py-4 и крупным текстам */}
      <header className="sticky top-0 z-[80] bg-[#f0f3ff]/95 backdrop-blur-md border-b border-indigo-100/50 px-5 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3" onClick={() => onNavigate('home')}>
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-black text-[12px] shadow-md">ОА</div>
          <div className="flex flex-col">
             <span className="font-bold text-slate-900 text-[14px] tracking-tight uppercase leading-none">О ГЕТКУРС</span>
             <span className="font-bold text-indigo-500 text-[9px] tracking-widest uppercase mt-1">И НЕ ТОЛЬКО</span>
          </div>
        </div>
        <button onClick={() => onNavigate('admin')} className={`p-2.5 transition-all rounded-xl ${activeView === 'admin' ? 'bg-indigo-100 text-indigo-700' : 'text-indigo-200'}`}>
          <ShieldCheck size={20} strokeWidth={2.5} />
        </button>
      </header>

      {/* Контент: возврат к p-5 */}
      <main className="flex-grow p-5 pb-32">
        {children}
      </main>

      {/* Навигация с повышенной контрастностью неактивных элементов */}
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
              {/* Неактивная иконка стала ярче (indigo-400 вместо indigo-300) */}
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all ${isActive ? 'bg-indigo-600 text-white shadow-indigo-200 shadow-lg' : 'text-indigo-400'}`}>
                <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
              </div>
              {/* Неактивный текст стал значительно контрастнее (indigo-500/80 вместо indigo-300/80) */}
              <span className={`text-[9px] font-bold tracking-widest ${isActive ? 'text-indigo-700' : 'text-indigo-500/80'}`}>
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
