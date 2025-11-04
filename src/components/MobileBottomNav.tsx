import React from 'react';
import { Link, useLocation } from 'react-router-dom';

type NavItem = {
  path: string;
  title: string;
  icon: React.ReactNode;
};

type Props = {
  items: NavItem[];
};

const MobileBottomNav: React.FC<Props> = ({ items }) => {
  const location = useLocation();
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 mobile-bottom-nav">
      <ul className="flex justify-around items-center">
        {items.slice(0, 5).map((item) => {
          const active = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
          return (
            <li key={item.path}>
              <Link
                to={item.path}
                className={`flex flex-col items-center justify-center px-3 py-2 rounded-md text-xs ${active ? 'text-white' : 'text-white/80'}`}
              >
                <span className={`text-lg mb-1 ${active ? 'text-amber-400' : 'text-white/70'}`}>{item.icon}</span>
                <span className="truncate max-w-[80px]">{item.title}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};

export default MobileBottomNav;