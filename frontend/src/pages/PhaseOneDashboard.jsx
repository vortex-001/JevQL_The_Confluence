import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { LayoutDashboard, Database, ShieldCheck, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { api } from '../services/api';

export default function PhaseOneDashboard() {
  const { user, logout } = useAuth();
  const { error, success } = useToast();
  const navigate = useNavigate();
  const [status, setStatus] = useState('Checking backend…');

  useEffect(() => {
    let active = true;
    api.getDashboardOverview()
      .then(() => { if (active) setStatus('Connected'); })
      .catch((err) => {
        if (active) {
          setStatus('Dashboard API unavailable');
          error(err.message || 'Could not load dashboard status.');
        }
      });
    return () => { active = false; };
  }, [error]);

  const handleLogout = async () => {
    try {
      await logout();
      success('You have been logged out.');
    } catch {
      // The client token is cleared by AuthContext even if the server is unavailable.
    } finally {
      navigate('/login', { replace: true });
    }
  };

  return (
    <main style={{ minHeight: '100vh', background: 'var(--bg-main)', color: 'var(--text-main)' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', padding: '1.2rem 2rem', background: 'var(--surface-dark)', color: '#fff' }}>
        <Link to="/" style={{ color: '#fff', fontWeight: 800, fontSize: '1.3rem', textDecoration: 'none' }}>JevQL</Link>
        <button onClick={handleLogout} style={{ display: 'inline-flex', alignItems: 'center', gap: '.5rem', border: '1px solid #ffffff55', borderRadius: '8px', padding: '.65rem 1rem', background: 'transparent', color: '#fff', cursor: 'pointer' }}>
          <LogOut size={16} /> Log out
        </button>
      </header>
      <section style={{ maxWidth: '1100px', margin: '0 auto', padding: '3rem 1.5rem' }}>
        <p style={{ color: 'var(--primary-orange)', fontWeight: 700, marginBottom: '.5rem' }}>PHASE 1 · ACCOUNT & DASHBOARD</p>
        <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3rem)', margin: '0 0 .75rem' }}>Welcome{user?.first_name ? `, ${user.first_name}` : user?.username ? `, ${user.username}` : ''}.</h1>
        <p style={{ color: 'var(--text-secondary)', maxWidth: '650px', lineHeight: 1.7 }}>Your JevQL account is ready. This initial dashboard confirms the authenticated area and backend connection. Search, datasets, analytics and integrations will be added in later phases.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginTop: '2rem' }}>
          <article style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '1.5rem' }}>
            <LayoutDashboard color="var(--primary-orange)" size={24} />
            <h2 style={{ fontSize: '1.1rem' }}>Dashboard</h2>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>Protected page visible after login or registration.</p>
          </article>
          <article style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '1.5rem' }}>
            <ShieldCheck color="var(--primary-orange)" size={24} />
            <h2 style={{ fontSize: '1.1rem' }}>Account</h2>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>Signed in as <strong>{user?.username || 'user'}</strong>.</p>
          </article>
          <article style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '1.5rem' }}>
            <Database color="var(--primary-orange)" size={24} />
            <h2 style={{ fontSize: '1.1rem' }}>Backend status</h2>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>{status}</p>
          </article>
        </div>
      </section>
    </main>
  );
}
