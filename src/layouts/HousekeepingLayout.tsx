import React, { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { FaBroom, FaClipboardList, FaCalendarCheck, FaSignOutAlt } from 'react-icons/fa';
import Logo from '../components/Logo';
import MobileBottomNav from '../components/MobileBottomNav';

const HousekeepingLayout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const location = useLocation();

  const menuItems = [
    { path: '/housekeeping', icon: <FaBroom />, title: 'Dashboard' },
    { path: '/housekeeping/materials', icon: <FaClipboardList />, title: 'Malzemeler' },
    { path: '/housekeeping/rooms', icon: <FaCalendarCheck />, title: 'Odalar' },
    { path: '/housekeeping/lost-and-found', icon: <FaClipboardList />, title: 'Unutulan Eşya' }
  ];

  return (
    <div className="flex h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 animate-fade-in">
      {/* Sidebar */}
      <div className={`hidden md:block backdrop-blur-xl bg-white/10 border-r border-white/20 text-white ${sidebarOpen ? 'w-64' : 'w-20'} transition-all duration-300 ease-in-out`}>
        <div className="p-4 flex items-center justify-between">
          {sidebarOpen && (
            <div className="flex items-center">
              {/* logo kaldırıldı */}
              <h1 className="text-xl font-bold text-amber-300">Kat Hizmetleri</h1>
            </div>
          )}
          <button 
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1 rounded-full hover:bg-white/20 focus:outline-none"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {sidebarOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
              )}
            </svg>
          </button>
        </div>
        
        <nav className="mt-5">
          <ul className="space-y-2 px-2">
            {menuItems.map((item) => (
              <li key={item.path}>
                <Link
                  to={item.path}
                  className={`flex items-center p-3 rounded-lg transition ${
                    location.pathname === item.path 
                      ? 'bg-white/20 text-white' 
                      : 'text-white/80 hover:bg-white/10'
                  }`}
                >
                  <span className="text-lg">{item.icon}</span>
                  {sidebarOpen && <span className="ml-3">{item.title}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        
        <div className="absolute bottom-0 w-full p-4">
          <Link
            to="/login"
            className={`flex items-center p-3 rounded-lg text-white/80 hover:bg-white/10 transition`}
          >
            <span className="text-lg"><FaSignOutAlt /></span>
            {sidebarOpen && <span className="ml-3">Çıkış Yap</span>}
          </Link>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className="diamond-band animate-fade-in-delayed">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center">
              <h2 className="text-xl font-semibold text-white">
                {menuItems.find(item => item.path === location.pathname)?.title || 'Temizlik'}
              </h2>
            </div>

            <div className="flex items-center space-x-4">
              <div className="flex items-center">
                <Logo size={32} variant="housekeeping" className="mr-2" />
                <span className="text-sm font-medium text-white/90">Kent Otel</span>
              </div>
            </div>
          </div>
        </header>
        
        {/* Page Content */}
        <main className="flex-1 overflow-auto bg-transparent pb-16 md:pb-0">
          <Outlet />
        </main>

        {/* Mobile Bottom Navigation */}
        <MobileBottomNav
          items={[
            { path: '/housekeeping', icon: <FaBroom />, title: 'Dashboard' },
            { path: '/housekeeping/rooms', icon: <FaCalendarCheck />, title: 'Odalar' },
            { path: '/housekeeping/materials', icon: <FaClipboardList />, title: 'Malzemeler' },
            { path: '/housekeeping/lost-and-found', icon: <FaClipboardList />, title: 'Unutulan' },
          ]}
        />
      </div>
    </div>
  );
};

export default HousekeepingLayout;