import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Menu, X, ArrowRight } from 'lucide-react';
import logoImg from '../assets/logo.png';

export default function Navbar() {
  const { isAuthenticated } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);


  return (
    <nav style={{
      position: 'sticky',
      top: 0,
      zIndex: 100,
      background: 'rgba(24, 17, 14, 0.92)',
      backdropFilter: 'blur(12px)',
      borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
      padding: '0.9rem 2rem',
    }}>
      <div style={{
        maxWidth: '1240px',
        margin: '0 auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        {/* Brand */}
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <img src={logoImg} alt="JevQL Logo" style={{ width: '36px', height: '36px', objectFit: 'contain' }} />
          <div>
            <div style={{ color: '#FFFFFF', fontWeight: 800, fontSize: '1.3rem', letterSpacing: '-0.02em', lineHeight: 1 }}>
              JevQL
            </div>
            <div style={{ color: 'var(--primary-orange)', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Database Intelligence
            </div>
          </div>
        </Link>

        {/* Desktop Links */}
        <div style={{
          display: 'none',
          alignItems: 'center',
          gap: '2rem',
          color: 'var(--text-inverse-muted)',
          fontSize: '0.92rem',
          fontWeight: 500,
        }} className="desktop-nav-links">
          <a href="#product" style={{ transition: 'color 0.15s' }} className="nav-hover-link">Product</a>
          <a href="#features" style={{ transition: 'color 0.15s' }} className="nav-hover-link">Features</a>
          <a href="#how-it-works" style={{ transition: 'color 0.15s' }} className="nav-hover-link">How It Works</a>
          <a href="#examples" style={{ transition: 'color 0.15s' }} className="nav-hover-link">SQL Examples</a>
          <a href="#architecture" style={{ transition: 'color 0.15s' }} className="nav-hover-link">Architecture</a>
          <a href="#docs" style={{ transition: 'color 0.15s' }} className="nav-hover-link">Documentation</a>
        </div>

        {/* Right CTA */}
        <div style={{ display: 'none', alignItems: 'center', gap: '1rem' }} className="desktop-nav-auth">
          {isAuthenticated ? (
            <Link to="/app" className="btn-primary" style={{ padding: '0.55rem 1.15rem' }}>
              <span>Dashboard</span>
              <ArrowRight size={16} />
            </Link>
          ) : (
            <>
              <Link to="/login" style={{ color: '#FFFFFF', fontWeight: 600, fontSize: '0.9rem', padding: '0.55rem 0.9rem' }}>
                Sign In
              </Link>
              <Link to="/register" className="btn-primary" style={{ padding: '0.55rem 1.25rem' }}>
                <span>Get Started</span>
                <ArrowRight size={16} />
              </Link>
            </>
          )}
        </div>

        {/* Mobile menu button */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          style={{ color: '#FFFFFF', display: 'flex', alignItems: 'center' }}
          className="mobile-nav-toggle"
          aria-label="Toggle mobile menu"
        >
          {mobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div style={{
          padding: '1.5rem 0',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          maxWidth: '1240px',
          margin: '0 auto',
        }}>
          <a href="#product" onClick={() => setMobileOpen(false)} style={{ color: '#FFFFFF', fontSize: '1rem' }}>Product</a>
          <a href="#features" onClick={() => setMobileOpen(false)} style={{ color: '#FFFFFF', fontSize: '1rem' }}>Features</a>
          <a href="#how-it-works" onClick={() => setMobileOpen(false)} style={{ color: '#FFFFFF', fontSize: '1rem' }}>How It Works</a>
          <a href="#examples" onClick={() => setMobileOpen(false)} style={{ color: '#FFFFFF', fontSize: '1rem' }}>SQL Examples</a>
          <a href="#architecture" onClick={() => setMobileOpen(false)} style={{ color: '#FFFFFF', fontSize: '1rem' }}>Architecture</a>
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
            {isAuthenticated ? (
              <Link to="/app" className="btn-primary" style={{ flex: 1, justifyContent: 'center' }}>
                Go to Dashboard
              </Link>
            ) : (
              <>
                <Link to="/login" className="btn-secondary" style={{ flex: 1, justifyContent: 'center', background: 'rgba(255,255,255,0.1)', color: '#FFF' }}>
                  Sign In
                </Link>
                <Link to="/register" className="btn-primary" style={{ flex: 1, justifyContent: 'center' }}>
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      )}

      <style>{`
        @media (min-width: 860px) {
          .desktop-nav-links { display: flex !important; }
          .desktop-nav-auth { display: flex !important; }
          .mobile-nav-toggle { display: none !important; }
        }
        .nav-hover-link:hover {
          color: #FFFFFF !important;
        }
      `}</style>
    </nav>
  );
}
