import React from 'react';
import MobileBottomNav from './MobileBottomNav';
import { FaDoorOpen, FaBroom, FaChartLine, FaCog, FaHeadphones } from 'react-icons/fa';

type NavItem = { path: string; title: string; icon: React.ReactNode };
type Props = {
  children: React.ReactNode;
  showNav?: boolean;
  navItems?: NavItem[];
};

const defaultNav: NavItem[] = [
  { path: '/rooms', title: 'Odalar', icon: <FaDoorOpen /> },
  { path: '/housekeeping/rooms', title: 'Temizlik', icon: <FaBroom /> },
  { path: '/admin', title: 'Panel', icon: <FaChartLine /> },
  { path: '/portal', title: 'Misafir Portalı', icon: <FaHeadphones /> },
  { path: '/admin/settings', title: 'Ayarlar', icon: <FaCog /> },
];

const MobileAppShell: React.FC<Props> = ({ children, showNav = true, navItems }) => {
  return (
    <div className="min-h-screen w-full bg-[#0b0b0b] text-white">
      <div className="flex flex-col min-h-screen pt-safe">
        <main className="flex-1 overflow-y-auto pb-[72px] md:pb-0">
          {children}
        </main>
        {showNav && (
          <footer className="fixed bottom-0 left-0 right-0 z-50">
            <MobileBottomNav items={navItems && navItems.length ? navItems : defaultNav} />
            <div className="safe-bottom" />
          </footer>
        )}
      </div>
    </div>
  );
};

export default MobileAppShell;