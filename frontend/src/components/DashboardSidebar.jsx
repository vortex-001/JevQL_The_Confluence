import React from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import logoImg from '../assets/logo.png';
import {
  Search,
  LayoutDashboard,
  Bookmark,
  BarChart3,
  History,
  Network,
  Settings,
  LogOut,
  X,
} from 'lucide-react';

const NAV_ITEMS = [
  { to: '/app', label: 'Search', icon: Search, end: true },
  { to: '/app/overview', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/app/saved-queries', label: 'Saved Queries', icon: Bookmark },
  { to: '/app/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/app/history', label: 'Query History', icon: History },
  { to: '/app/integrations', label: 'Integrations', icon: Network },
  { to: '/app/settings', label: 'Settings', icon: Settings },
];

export default function DashboardSidebar({ mobileOpen, onCloseMobile }) {
  const { logout } = useAuth();
  const { info } = useToast();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
      info('Signed out successfully.');
      navigate('/login');
    } catch {
      navigate('/login');
    }
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          onClick={onCloseMobile}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(20, 14, 12, 0.65)',
            backdropFilter: 'blur(3px)',
            zIndex: 90,
          }}
          className="sidebar-backdrop"
          aria-hidden="true"
        />
      )}

      <aside
        style={{
          width: '260px',
          backgroundColor: 'var(--surface-dark)',
          color: 'var(--text-inverse-muted)',
          display: 'flex',
          flexDirection: 'column',
          height: '100vh',
          position: 'sticky',
          top: 0,
          flexShrink: 0,
          borderRight: '1px solid var(--surface-dark-border)',
          zIndex: 100,
          transition: 'transform var(--transition-normal)',
        }}
        className={`dashboard-sidebar ${mobileOpen ? 'mobile-open' : ''}`}
      >
        {/* Brand Section */}
        <div style={{
          padding: '1.25rem 1.25rem',
          borderBottom: '1px solid var(--surface-dark-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <Link
            to="/"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
            }}
          >
            <img
              src={logoImg}
              alt="JevQL"
              style={{ width: '36px', height: '36px', objectFit: 'contain' }}
            />
            <div>
              <span style={{
                color: '#FFFFFF',
                fontSize: '1.35rem',
                fontWeight: 800,
                letterSpacing: '-0.02em',
                lineHeight: 1.1,
                display: 'block',
              }}>
                JevQL
              </span>
              <span style={{
                fontSize: '0.68rem',
                color: 'var(--primary-orange)',
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}>
                Natural Language DB
              </span>
            </div>
          </Link>

          {/* Close button on mobile */}
          <button
            onClick={onCloseMobile}
            style={{
              color: 'var(--text-inverse-muted)',
              display: 'none',
              padding: '0.25rem',
            }}
            className="mobile-close-btn"
            aria-label="Close sidebar"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation Menu */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '1rem 0.85rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.25rem',
        }}>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={onCloseMobile}
                className={({ isActive }) =>
                  `sidebar-nav-link ${isActive ? 'active' : ''}`
                }
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}

          {/* Sidebar Graphic Feature Card */}
          <div style={{
            marginTop: 'auto',
            paddingTop: '1rem',
          }}>
            <div style={{
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.07)',
              borderRadius: 'var(--radius-md)',
              padding: '1rem',
              position: 'relative',
              overflow: 'hidden',
            }}>
              <div style={{
                color: '#FFFFFF',
                fontWeight: 700,
                fontSize: '0.85rem',
                marginBottom: '0.25rem',
              }}>
                NL Database Search
              </div>
              <p style={{
                color: 'var(--text-inverse-muted)',
                fontSize: '0.74rem',
                lineHeight: 1.45,
                marginBottom: '0.75rem',
              }}>
                Query PostgreSQL in natural language with zero SQL syntax barriers.
              </p>

              {/* 3D Database Graphic representation */}
              <svg viewBox="0 0 100 50" fill="none" style={{ width: '100%', height: '40px', opacity: 0.85 }}>
                <polygon points="10,20 12,22 10,24 8,22" fill="#E6C280" />
                <polygon points="18,32 19,33 18,34 17,33" fill="#E6C280" />
                <ellipse cx="65" cy="12" rx="28" ry="8" fill="#D97706" />
                <path d="M37 12 v14 c0 4.4 12.5 8 28 8 s28 -3.6 28 -8 v-14" fill="#B45309" />
                <path d="M37 26 v14 c0 4.4 12.5 8 28 8 s28 -3.6 28 -8 v-14" fill="#92400E" />
                <ellipse cx="65" cy="12" rx="25" ry="6" fill="#F59E0B" />
                <path d="M37 16 c0 4.4 12.5 8 28 8 s28 -3.6 28 -8" stroke="#FDE68A" strokeWidth="1.2" strokeDasharray="2 2" />
                <path d="M37 30 c0 4.4 12.5 8 28 8 s28 -3.6 28 -8" stroke="#FDE68A" strokeWidth="1.2" strokeDasharray="2 2" />
              </svg>
            </div>

            {/* Team Attribution */}
            <div style={{
              textAlign: 'center',
              fontSize: '0.72rem',
              color: '#8E847D',
              marginTop: '0.75rem',
              letterSpacing: '0.02em',
            }}>
              Built by The Confluence
            </div>
          </div>
        </div>

        {/* Separated Logout Section at Bottom */}
        <div style={{
          padding: '0.85rem',
          borderTop: '1px solid var(--surface-dark-border)',
          background: 'var(--surface-dark-subtle)',
        }}>
          <button
            onClick={handleLogout}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              width: '100%',
              padding: '0.7rem 1rem',
              borderRadius: 'var(--radius-sm)',
              color: '#F87171',
              background: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              fontWeight: 600,
              fontSize: '0.88rem',
              transition: 'all 0.15s ease',
            }}
            className="sidebar-logout-btn"
          >
            <LogOut size={18} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      <style>{`
        .sidebar-nav-link {
          display: flex;
          align-items: center;
          gap: 0.85rem;
          padding: 0.65rem 0.95rem;
          color: var(--text-inverse-muted);
          text-decoration: none;
          font-size: 0.88rem;
          font-weight: 500;
          border-radius: var(--radius-sm);
          transition: all 0.15s ease;
        }
        .sidebar-nav-link:hover {
          color: #FFFFFF;
          background-color: rgba(255, 255, 255, 0.06);
        }
        .sidebar-nav-link.active {
          color: #FFFFFF;
          background-color: var(--primary-orange);
          font-weight: 600;
          box-shadow: 0 2px 8px rgba(200, 83, 47, 0.35);
        }
        .sidebar-logout-btn:hover {
          background: rgba(239, 68, 68, 0.18) !important;
          color: #FFFFFF !important;
          border-color: rgba(239, 68, 68, 0.4) !important;
        }

        /* Mobile Responsive Sidebar */
        @media (max-width: 991px) {
          .dashboard-sidebar {
            position: fixed !important;
            top: 0;
            left: 0;
            bottom: 0;
            transform: translateX(-100%);
          }
          .dashboard-sidebar.mobile-open {
            transform: translateX(0);
          }
          .mobile-close-btn {
            display: block !important;
          }
        }
      `}</style>
    </>
  );
}
