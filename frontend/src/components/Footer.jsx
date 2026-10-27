import React from 'react';
import { Link } from 'react-router-dom';
import logoImg from '../assets/logo.png';
import { Database, ShieldCheck, Cpu, Terminal, ArrowUpRight } from 'lucide-react';

export default function Footer() {
  return (
    <footer style={{
      background: 'var(--surface-dark-deep)',
      color: 'var(--text-inverse-muted)',
      borderTop: '1px solid rgba(255, 255, 255, 0.08)',
      padding: '4rem 2rem 2.5rem 2rem',
    }}>
      <div style={{ maxWidth: '1240px', margin: '0 auto' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '3rem',
          marginBottom: '3.5rem',
        }}>
          {/* Brand & Mission */}
          <div style={{ maxWidth: '340px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <img src={logoImg} alt="JevQL" style={{ width: '32px', height: '32px', objectFit: 'contain' }} />
              <span style={{ color: '#FFFFFF', fontWeight: 800, fontSize: '1.25rem' }}>JevQL</span>
            </div>
            <p style={{ fontSize: '0.88rem', lineHeight: 1.6, color: '#A89B95', marginBottom: '1.25rem' }}>
              Natural-language database search platform bridging human queries with safe PostgreSQL query execution, semantic embeddings, and real-time analytics.
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.75rem', color: '#8E847D' }}>
              <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#10B981' }} />
              PostgreSQL 14+ • Python Django • React 19
            </div>
          </div>

          {/* Product Links */}
          <div>
            <div style={{ color: '#FFFFFF', fontWeight: 700, fontSize: '0.92rem', marginBottom: '1.1rem', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Platform
            </div>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.88rem' }}>
              <li><a href="#product" style={{ color: '#A89B95', transition: 'color 0.15s' }}>Natural Language Search</a></li>
              <li><a href="#features" style={{ color: '#A89B95', transition: 'color 0.15s' }}>Semantic Provider (Gemini)</a></li>
              <li><a href="#how-it-works" style={{ color: '#A89B95', transition: 'color 0.15s' }}>PostgreSQL Introspection</a></li>
              <li><a href="#architecture" style={{ color: '#A89B95', transition: 'color 0.15s' }}>Safety & Parameterization</a></li>
              <li><a href="#examples" style={{ color: '#A89B95', transition: 'color 0.15s' }}>SQL Comparison</a></li>
            </ul>
          </div>

          {/* Navigation & Auth */}
          <div>
            <div style={{ color: '#FFFFFF', fontWeight: 700, fontSize: '0.92rem', marginBottom: '1.1rem', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Access
            </div>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.88rem' }}>
              <li><Link to="/login" style={{ color: '#A89B95' }}>Sign In</Link></li>
              <li><Link to="/register" style={{ color: '#A89B95' }}>Create Account</Link></li>
              <li><Link to="/app" style={{ color: '#A89B95' }}>Search Console</Link></li>
              <li><Link to="/app/integrations" style={{ color: '#A89B95' }}>Connect PostgreSQL</Link></li>
              <li><Link to="/app/datasets" style={{ color: '#A89B95' }}>Upload CSV Dataset</Link></li>
            </ul>
          </div>

          {/* Project & Hackathon Info */}
          <div>
            <div style={{ color: '#FFFFFF', fontWeight: 700, fontSize: '0.92rem', marginBottom: '1.1rem', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Project Information
            </div>
            <p style={{ fontSize: '0.85rem', lineHeight: 1.6, color: '#A89B95', marginBottom: '1rem' }}>
              Built by <strong>The Confluence</strong> for college hackathon demonstration. Inspired by concept designs on pgjev.com with original architecture and zero paid extension lock-in.
            </p>
            <div style={{
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: 'var(--radius-sm)',
              padding: '0.65rem 0.85rem',
              fontSize: '0.78rem',
              color: '#C8532F',
              fontWeight: 600,
            }}>
              100% Free & Open-Source Stack
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div style={{
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          paddingTop: '2rem',
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '1rem',
          fontSize: '0.82rem',
          color: '#716864',
        }}>
          <div>
            © {new Date().getFullYear()} JevQL Project. All rights reserved.
          </div>
          <div style={{ display: 'flex', gap: '1.5rem' }}>
            <span>Read-Only Query Safety Active</span>
            <span>REST API v1.0</span>
            <span>PostgreSQL Driver (psycopg2)</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
