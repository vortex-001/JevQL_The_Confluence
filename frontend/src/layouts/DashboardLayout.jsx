import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import DashboardSidebar from '../components/DashboardSidebar';
import DashboardHeader from '../components/DashboardHeader';

export default function DashboardLayout() {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      backgroundColor: 'var(--bg-main)',
    }}>
      {/* Sidebar */}
      <DashboardSidebar
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
        minHeight: '100vh',
      }}>
        {/* Top Header */}
        <DashboardHeader
          onToggleSidebar={() => setMobileSidebarOpen(!mobileSidebarOpen)}
        />

        {/* Page Container */}
        <main style={{
          flex: 1,
          padding: '2rem',
          maxWidth: '1440px',
          width: '100%',
          margin: '0 auto',
        }} className="dashboard-main-content">
          <Outlet />
        </main>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .dashboard-main-content {
            padding: 1.25rem !important;
          }
        }
      `}</style>
    </div>
  );
}
