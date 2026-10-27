import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Menu, ChevronDown, Settings, LogOut, Database } from 'lucide-react';

export default function DashboardHeader({ onToggleSidebar }) {

  const { user, logout } = useAuth();
  const { info } = useToast();
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
      info('Signed out successfully.');
      navigate('/login');
    } catch {
      navigate('/login');
    }
  };

  const displayName = user?.name || user?.username || 'Authenticated User';
  const displayInitial = (displayName || 'U')[0].toUpperCase();

  return (
    <header style={{
      background: '#FFFFFF',
      borderBottom: '1px solid var(--border-color)',
      padding: '0.85rem 2rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      position: 'sticky',
      top: 0,
      zIndex: 40,
    }}>
      {/* Left: Mobile hamburger & breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <button
          onClick={onToggleSidebar}
          style={{
            display: 'flex',
            alignItems: 'center',
            color: 'var(--text-main)',
            padding: '0.35rem',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-color)',
            background: 'var(--bg-subtle)',
          }}
          className="mobile-header-toggle"
          aria-label="Toggle navigation sidebar"
        >
          <Menu size={18} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <span style={{
            fontSize: '0.88rem',
            fontWeight: 700,
            color: 'var(--text-main)',
            letterSpacing: '-0.01em',
          }}>
            JevQL Console
          </span>
          <span style={{ color: 'var(--border-color)' }}>/</span>
          <span style={{
            fontSize: '0.82rem',
            color: 'var(--text-muted)',
            fontWeight: 500,
          }}>
            Natural Language Database Search
          </span>
        </div>
      </div>

      {/* Right: DB connection status + Profile */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
        {/* Connection status indicator */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          background: 'var(--bg-subtle)',
          border: '1px solid var(--border-color)',
          padding: '0.35rem 0.75rem',
          borderRadius: 'var(--radius-full)',
          fontSize: '0.8rem',
          fontWeight: 600,
          color: 'var(--text-secondary)',
        }}>
          <span style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: '#10B981',
            boxShadow: '0 0 0 2px rgba(16, 185, 129, 0.25)',
          }} />
          <span>PostgreSQL Active</span>
        </div>

        {/* Profile Dropdown */}
        <div style={{ position: 'relative' }} ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.65rem',
              padding: '0.3rem 0.5rem',
              borderRadius: 'var(--radius-md)',
              transition: 'background 0.15s',
            }}
            className="profile-btn"
            aria-expanded={dropdownOpen}
            aria-label="User profile options"
          >
            <div style={{
              width: '34px',
              height: '34px',
              borderRadius: 'var(--radius-full)',
              background: 'var(--surface-dark)',
              color: '#FFFFFF',
              fontWeight: 700,
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 4px rgba(35, 24, 21, 0.15)',
            }}>
              {displayInitial}
            </div>
            <div style={{ textAlign: 'left', display: 'none' }} className="profile-text-label">
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', lineHeight: 1.2 }}>
                {displayName}
              </div>
              {user?.email && (
                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                  {user.email}
                </div>
              )}
            </div>
            <ChevronDown size={14} color="var(--text-muted)" />
          </button>

          {/* Dropdown Menu */}
          {dropdownOpen && (
            <div style={{
              position: 'absolute',
              right: 0,
              top: '100%',
              marginTop: '0.5rem',
              width: '230px',
              background: '#FFFFFF',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-lg)',
              border: '1px solid var(--border-color)',
              padding: '0.5rem 0',
              zIndex: 50,
              animation: 'dropdownFade 0.15s ease-out',
            }}>
              {/* User info banner */}
              <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border-subtle)' }}>
                <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-main)' }}>
                  {displayName}
                </div>
                <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {user?.email || `@${user?.username}`}
                </div>
                {user?.is_staff && (
                  <span className="badge badge-orange" style={{ marginTop: '0.35rem', fontSize: '0.7rem' }}>
                    Staff Admin
                  </span>
                )}
              </div>

              {/* Menu items */}
              <div style={{ padding: '0.25rem 0' }}>
                <Link
                  to="/app/settings"
                  onClick={() => setDropdownOpen(false)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.65rem',
                    padding: '0.6rem 1rem',
                    fontSize: '0.85rem',
                    color: 'var(--text-secondary)',
                    transition: 'background 0.1s',
                  }}
                  className="dropdown-item"
                >
                  <Settings size={16} />
                  <span>Developer Settings</span>
                </Link>

                <Link
                  to="/"
                  onClick={() => setDropdownOpen(false)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.65rem',
                    padding: '0.6rem 1rem',
                    fontSize: '0.85rem',
                    color: 'var(--text-secondary)',
                    transition: 'background 0.1s',
                  }}
                  className="dropdown-item"
                >
                  <Database size={16} />
                  <span>Public Landing Page</span>
                </Link>
              </div>

              {/* Logout button */}
              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '0.25rem' }}>
                <button
                  onClick={handleLogout}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.65rem',
                    padding: '0.6rem 1rem',
                    fontSize: '0.85rem',
                    color: 'var(--status-negative)',
                    width: '100%',
                    textAlign: 'left',
                    fontWeight: 600,
                  }}
                  className="dropdown-item"
                >
                  <LogOut size={16} />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @media (min-width: 640px) {
          .profile-text-label { display: block !important; }
        }
        @media (min-width: 992px) {
          .mobile-header-toggle { display: none !important; }
        }
        .profile-btn:hover {
          background: var(--bg-subtle);
        }
        .dropdown-item:hover {
          background: var(--bg-subtle);
          color: var(--text-main) !important;
        }
        @keyframes dropdownFade {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </header>
  );
}
