import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import Reservations from './pages/Reservations';
import CardDesignPlayground from './pages/CardDesignPlayground';

// Layout bileşenleri
import AdminLayout from './layouts/AdminLayout';
import GuestLayout from './layouts/GuestLayout';
import HousekeepingLayout from './layouts/HousekeepingLayout';
import ManagementLayout from './layouts/ManagementLayout';

// Sayfa bileşenleri
import Dashboard from './pages/Dashboard';
import GuestPortal from './pages/GuestPortal';
import HousekeepingPanel from './pages/HousekeepingPanel';
import HousekeepingDashboard from './pages/HousekeepingDashboard';
import HKRooms from './pages/HKRooms';
import HousekeepingLostFound from './pages/HousekeepingLostFound';
import LostAndFoundAdmin from './pages/LostAndFoundAdmin';
import Rooms from './pages/Rooms';
import Settings from './pages/Settings';
import Guests from './pages/Guests';
import NotificationSystem from './pages/NotificationSystem';
import Login from './pages/Login';
import NotFound from './pages/NotFound';
import AdminChat from './pages/AdminChat';
import ReceptionStaffTracking from './pages/ReceptionStaffTracking';
import ManagementSatisfaction from './pages/ManagementSatisfaction';
import ManagementDashboard from './pages/ManagementDashboard';
import ManagementFinance from './pages/ManagementFinance';
import StaffProfile from './pages/StaffProfile';
import RoomCardsShowcase from './pages/RoomCardsShowcase';
import Applications from './pages/Applications';
import Reports from './pages/Reports';
import SustainabilityTracker from './pages/SustainabilityTracker';
import MaintenanceReports from './pages/MaintenanceReports';
import CleaningReports from './pages/CleaningReports';
import RoomQRCodes from './pages/RoomQRCodes';

function App() {
  return (
    <Router basename={process.env.PUBLIC_URL}>
      <Routes>
        {/* Misafir Portalı Rotaları */}
        <Route path="/portal" element={<GuestLayout />}>
          <Route index element={<GuestPortal />} />
          <Route path="chat" element={<GuestPortal activeTab="chat" />} />
          <Route path="services" element={<GuestPortal activeTab="services" />} />
          <Route path="feedback" element={<GuestPortal activeTab="feedback" />} />
        </Route>
        
        {/* Yönetim Paneli Rotaları */}
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="rooms" element={<Rooms />} />
          <Route path="qr-codes" element={<RoomQRCodes />} />
          <Route path="reservations" element={<Reservations />} />
          <Route path="rezervasyon" element={<Reservations />} />
          <Route path="reports" element={<Reports />} />
          <Route path="cleaning-reports" element={<CleaningReports />} />
          <Route path="maintenance" element={<MaintenanceReports />} />
          <Route path="personnel" element={<ReceptionStaffTracking />} />
          <Route path="staff/:id" element={<StaffProfile />} />
          <Route path="applications" element={<Applications />} />
          <Route path="settings" element={<Settings />} />
          <Route path="guests" element={<Guests />} />
          <Route path="chat" element={<AdminChat />} />
          {/* Türkçe takma yollar */}
          <Route path="misafirler" element={<Guests />} />
          <Route path="notifications" element={<NotificationSystem />} />
          <Route path="bildirimler" element={<NotificationSystem />} />
          <Route path="lost-and-found" element={<LostAndFoundAdmin />} />
          {/* Yönetim menü öğesi için admin alt rotası */}
          <Route path="management" element={<ManagementDashboard />} />
          {/* Sürdürülebilirlik sayfası admin panel altına eklendi */}
          <Route path="sustainability" element={<SustainabilityTracker />} />
        </Route>

        {/* Housekeeping Bağımsız Portal */}
        <Route path="/housekeeping" element={<HousekeepingLayout />}>
          <Route index element={<HousekeepingDashboard />} />
          <Route path="dashboard" element={<HousekeepingDashboard />} />
          <Route path="rooms" element={<HKRooms />} />
          <Route path="materials" element={<HousekeepingPanel />} />
          <Route path="notifications" element={<NotificationSystem />} />
          <Route path="lost-and-found" element={<HousekeepingLostFound />} />
        </Route>

        {/* Yönetim Bağımsız Portal */}
        <Route path="/management" element={<ManagementLayout />}>
          <Route index element={<ManagementDashboard />} />
          <Route path="dashboard" element={<ManagementDashboard />} />
          <Route path="finance" element={<ManagementFinance />} />
          <Route path="reports" element={<Reports />} />
          <Route path="staff" element={<ReceptionStaffTracking />} />
          <Route path="staff/:id" element={<StaffProfile />} />
          <Route path="satisfaction" element={<ManagementSatisfaction />} />
          <Route path="sustainability" element={<SustainabilityTracker />} />
        </Route>
        
        {/* Giriş ve Diğer Rotalar */}
        {/* Kısa yol: Rooms sayfası doğrudan kök altında */}
        <Route path="/rooms" element={<Rooms />} />
        <Route path="/guestlist" element={<Guests />} />
        <Route path="/room-cards-showcase" element={<RoomCardsShowcase />} />
        {/* Giriş ve Diğer Rotalar */}
        <Route path="/login" element={<Login />} />
        <Route path="/reservations" element={<Reservations />} />
        <Route path="/rezervasyon" element={<Reservations />} />
        <Route path="/deneme" element={<CardDesignPlayground />} />
        <Route path="/sustainability" element={<SustainabilityTracker />} />
        <Route path="/" element={<Login />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Router>
  );
}

export default App;