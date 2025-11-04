import React from 'react';
import { Outlet } from 'react-router-dom';
// Logo kaldırıldı: yalnızca login ekranında görsel kullanılacak

const GuestLayout: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <div className="min-h-screen px-2 py-3 sm:px-4 md:px-6 relative">
        <div className="absolute inset-0 bg-black/20" />
        <div className="relative mx-auto max-w-3xl">
          <div className="rounded-2xl border border-amber-400/30 bg-white/10 backdrop-blur-xl shadow-2xl">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
};

export default GuestLayout;