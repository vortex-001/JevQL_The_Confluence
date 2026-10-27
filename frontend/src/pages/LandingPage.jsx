import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import {
  Search,
  Database,
  Sparkles,
  ArrowRight,
  Code2,
  Table,
  Cpu,
  Layers,
  Bookmark,
  FileSpreadsheet,
  Terminal,
} from 'lucide-react';


const SQL_EXAMPLES = [
  {
    title: 'Customer Sentiment Search',
    natural: 'Find recent low-rated feedback with delivery complaints',
    sql: `SELECT id, employee_name, department, rating, feedback_text
FROM employee_feedback
WHERE rating <= 2 
  AND sentiment = 'Negative'
  AND feedback_text ILIKE '%delivery%'
ORDER BY submission_date DESC;`,
    explanation: 'Translates colloquial concepts like "low-rated" into structured rating boundaries and filters tags/text without requiring complex SQL joins.',
  },
  {
    title: 'Burnout & Workload Signals',
    natural: 'Show engineering team members showing signs of burnout with high workload',
    sql: `SELECT anonymized_id, role, workload_level, feedback_text
FROM employee_feedback
WHERE department = 'Engineering'
  AND (workload_level = 'High' OR feedback_text ILIKE '%burnout%')
ORDER BY rating ASC;`,
    explanation: 'Detects implicit intent ("burnout") using semantic cosine embeddings or PostgreSQL trigram text similarity (pg_trgm).',
  },
  {
    title: 'Team Mentorship & High Ratings',
    natural: 'Show positive reviews praising mentorship and management',
    sql: `SELECT *
FROM employee_feedback
WHERE sentiment = 'Positive'
  AND rating >= 4
  AND (feedback_text ILIKE '%mentorship%' OR feedback_text ILIKE '%leadership%');`,
    explanation: 'Safely maps sentiment adjectives directly to enum choices while parameterizing search terms to eliminate injection vulnerabilities.',
  },
];

export default function LandingPage() {
  const [activeExampleIndex, setActiveExampleIndex] = useState(0);
  const [interactiveQuery, setInteractiveQuery] = useState("Show low rated reviews from Product and Customer Success with complaints");
  const [simulatedResults, setSimulatedResults] = useState(false);

  const handleSimulate = (e) => {
    e.preventDefault();
    setSimulatedResults(true);
  };

  return (
    <div style={{ backgroundColor: 'var(--bg-main)', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar />

      {/* Hero Section */}
      <section style={{
        background: 'linear-gradient(180deg, var(--surface-dark-deep) 0%, var(--surface-dark) 65%, #2B1D19 100%)',
        color: '#FFFFFF',
        padding: '5.5rem 2rem 5rem 2rem',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Ambient Glows */}
        <div style={{
          position: 'absolute',
          top: '-10%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '700px',
          height: '400px',
          background: 'radial-gradient(ellipse at center, rgba(200, 83, 47, 0.22) 0%, rgba(200, 83, 47, 0) 70%)',
          pointerEvents: 'none',
        }} />

        <div style={{ maxWidth: '1240px', margin: '0 auto', position: 'relative', zIndex: 2 }}>
          {/* Tagline Pill */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.6rem',
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              padding: '0.4rem 1rem',
              borderRadius: 'var(--radius-full)',
              fontSize: '0.85rem',
              color: '#FDE68A',
              fontWeight: 600,
            }}>
              <Sparkles size={16} color="var(--primary-orange)" />
              <span>Natural-Language PostgreSQL Search Platform</span>
            </div>
          </div>

          {/* Main Headline */}
          <h1 style={{
            fontSize: 'clamp(2.5rem, 5vw, 4.2rem)',
            fontWeight: 800,
            textAlign: 'center',
            letterSpacing: '-0.03em',
            lineHeight: 1.15,
            maxWidth: '920px',
            margin: '0 auto 1.5rem auto',
          }}>
            Ask Your Database in <span style={{ color: 'var(--primary-orange)' }}>Plain English</span>
          </h1>

          {/* Subtitle */}
          <p style={{
            fontSize: 'clamp(1.05rem, 2vw, 1.25rem)',
            color: 'var(--text-inverse-muted)',
            textAlign: 'center',
            maxWidth: '740px',
            margin: '0 auto 2.5rem auto',
            lineHeight: 1.6,
          }}>
            JevQL translates human curiosity into safe, structured PostgreSQL queries. Explore survey feedback, customer records, and operational databases without writing complex SQL.
          </p>

          {/* Call to Actions */}
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: '1rem',
            marginBottom: '4rem',
          }}>
            <Link
              to="/app"
              className="btn-primary"
              style={{
                padding: '0.85rem 1.85rem',
                fontSize: '1rem',
                borderRadius: 'var(--radius-md)',
              }}
            >
              <span>Explore Live Dashboard</span>
              <ArrowRight size={18} />
            </Link>
            <Link
              to="/register"
              className="btn-dark"
              style={{
                padding: '0.85rem 1.85rem',
                fontSize: '1rem',
                background: 'rgba(255, 255, 255, 0.08)',
                borderRadius: 'var(--radius-md)',
              }}
            >
              Create Free Account
            </Link>
          </div>

          {/* Realistic SQL Editor & Query Visualizer */}
          <div style={{
            maxWidth: '960px',
            margin: '0 auto',
            background: 'var(--surface-dark-subtle)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-dark)',
            overflow: 'hidden',
          }}>
            {/* Editor Window Bar */}
            <div style={{
              background: 'rgba(0, 0, 0, 0.35)',
              padding: '0.75rem 1.25rem',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#EF4444' }} />
                <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#F59E0B' }} />
                <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#10B981' }} />
                <span style={{ marginLeft: '0.75rem', fontSize: '0.8rem', color: '#A89B95', fontFamily: 'var(--font-mono)' }}>
                  jevql-interactive-session.sql — PostgreSQL 18.6
                </span>
              </div>
              <span className="badge badge-orange" style={{ fontSize: '0.72rem' }}>
                Parameterized Read-Only
              </span>
            </div>

            {/* Interactive Query Input Bar */}
            <div style={{ padding: '1.25rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
              <form onSubmit={handleSimulate} style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <div style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '0.65rem 1rem',
                  minWidth: '280px',
                }}>
                  <Search size={18} color="var(--primary-orange)" />
                  <input
                    type="text"
                    value={interactiveQuery}
                    onChange={(e) => setInteractiveQuery(e.target.value)}
                    placeholder="Enter natural language query..."
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#FFFFFF',
                      width: '100%',
                      outline: 'none',
                      fontSize: '0.92rem',
                    }}
                  />
                </div>
                <button type="submit" className="btn-primary" style={{ padding: '0.65rem 1.25rem' }}>
                  Run JevQL →
                </button>
              </form>
            </div>

            {/* Compiled SQL Query Display */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              divideX: '1px solid rgba(255, 255, 255, 0.08)',
            }}>
              {/* Left Column: Compiled SQL */}
              <div style={{ padding: '1.5rem', background: '#160E0C' }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '0.75rem',
                }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary-orange)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Compiled PostgreSQL Query
                  </span>
                  <span style={{ fontSize: '0.75rem', color: '#8E847D', fontFamily: 'var(--font-mono)' }}>
                    Latency: ~12.4ms
                  </span>
                </div>
                <pre style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.84rem',
                  color: '#F4EFEA',
                  lineHeight: 1.6,
                  overflowX: 'auto',
                }}>
                  <code>{`SELECT *
FROM employee_feedback
WHERE sentiment = 'negative'
  AND rating <= 2
ORDER BY submission_date DESC
LIMIT 50;`}</code>
                </pre>
                <div style={{
                  marginTop: '1rem',
                  padding: '0.75rem',
                  background: 'rgba(255, 255, 255, 0.03)',
                  borderRadius: 'var(--radius-xs)',
                  fontSize: '0.76rem',
                  color: '#A89B95',
                  lineHeight: 1.5,
                  borderLeft: '3px solid var(--primary-orange)',
                }}>
                  * Semantic interpretation is dynamically evaluated using the configured Gemini provider or fallback PostgreSQL trigram similarity.
                </div>
              </div>

              {/* Right Column: Matched Records Preview */}
              <div style={{ padding: '1.5rem', background: '#1C1310' }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '0.75rem',
                }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#10B981', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Real-Time Matched Records (5 Found)
                  </span>
                  <span className="badge badge-positive" style={{ fontSize: '0.72rem' }}>
                    100% Parameterized
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                  <div style={{
                    background: 'rgba(255, 255, 255, 0.04)',
                    padding: '0.65rem 0.85rem',
                    borderRadius: 'var(--radius-xs)',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '0.2rem' }}>
                      <span style={{ fontWeight: 700, color: '#FFFFFF' }}>EMP-1042 • Product Manager</span>
                      <span className="badge badge-negative" style={{ fontSize: '0.68rem' }}>Negative (1/5)</span>
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#D4CBC3', fontStyle: 'italic' }}>
                      "CI/CD bottleneck causing delayed deployments and customer escalation."
                    </div>
                  </div>

                  <div style={{
                    background: 'rgba(255, 255, 255, 0.04)',
                    padding: '0.65rem 0.85rem',
                    borderRadius: 'var(--radius-xs)',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '0.2rem' }}>
                      <span style={{ fontWeight: 700, color: '#FFFFFF' }}>EMP-1019 • Customer Success Lead</span>
                      <span className="badge badge-negative" style={{ fontSize: '0.68rem' }}>Negative (2/5)</span>
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#D4CBC3', fontStyle: 'italic' }}>
                      "Client onboarding workflow is broken due to recent portal release."
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" style={{ padding: '5.5rem 2rem', background: '#FFFFFF' }}>
        <div style={{ maxWidth: '1240px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
            <span className="badge badge-orange" style={{ marginBottom: '0.75rem' }}>
              Execution Lifecycle
            </span>
            <h2 style={{ fontSize: '2.4rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
              How JevQL Works
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', maxWidth: '640px', margin: '0.5rem auto 0 auto' }}>
              From natural human question to safe PostgreSQL result sets in five systematic steps.
            </p>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '1.5rem',
          }}>
            {[
              {
                step: '01',
                title: 'Connect Database',
                desc: 'Connect to any standard PostgreSQL 14+ instance with read-only transaction guardrails.',
                icon: Database,
              },
              {
                step: '02',
                title: 'Select Dataset / Table',
                desc: 'Choose from demo Employee Feedback or introspect custom schemas and tables dynamically.',
                icon: Table,
              },
              {
                step: '03',
                title: 'Ask in Plain English',
                desc: 'Describe what you need: ratings, departments, sentiment, workload, or business themes.',
                icon: Search,
              },
              {
                step: '04',
                title: 'Query Planner Translation',
                desc: 'Structured filters are extracted and combined with Gemini semantic embeddings or trigrams.',
                icon: Code2,
              },
              {
                step: '05',
                title: 'Records & Deep Insights',
                desc: 'Review verified results, explore sentiment breakdowns, or export matching CSV records.',
                icon: Sparkles,
              },
            ].map((item, idx) => {
              const Icon = item.icon;
              return (
                <div key={idx} className="card" style={{
                  position: 'relative',
                  padding: '2rem 1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                }}>
                  <div style={{
                    fontSize: '2.5rem',
                    fontWeight: 900,
                    color: 'rgba(200, 83, 47, 0.15)',
                    lineHeight: 1,
                    marginBottom: '1rem',
                  }}>
                    {item.step}
                  </div>
                  <div style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--primary-orange-subtle)',
                    color: 'var(--primary-orange)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '1rem',
                  }}>
                    <Icon size={20} />
                  </div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.5rem' }}>
                    {item.title}
                  </h3>
                  <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                    {item.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" style={{ padding: '5.5rem 2rem', background: 'var(--bg-main)' }}>
        <div style={{ maxWidth: '1240px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
            <span className="badge badge-orange" style={{ marginBottom: '0.75rem' }}>
              Core Capabilities
            </span>
            <h2 style={{ fontSize: '2.4rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
              Engineered for PostgreSQL Databases
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', maxWidth: '640px', margin: '0.5rem auto 0 auto' }}>
              Built specifically around real features implemented in the JevQL codebase.
            </p>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
            gap: '1.5rem',
          }}>
            {[
              {
                title: 'Natural-Language Database Search',
                desc: 'Ask questions without learning PostgreSQL syntax. JevQL automatically parses filters, numeric ratings, departments, and text intent.',
                icon: Search,
              },
              {
                title: 'PostgreSQL Introspection & Testing',
                desc: 'Connect to external PostgreSQL servers, measure server round-trip latency, inspect tables and column datatypes dynamically.',
                icon: Database,
              },
              {
                title: 'Configured Gemini Semantic Provider',
                desc: 'Utilizes Google Gemini embedding models (text-embedding-004) with SHA-256 persistent database caching and local fallback.',
                icon: Cpu,
              },
              {
                title: 'Dynamic Refine Filters & Skeletons',
                desc: 'Fine-tune results with real-time department checkboxes, 1-5 star ratings, sentiment facets, and responsive loading skeletons.',
                icon: Layers,
              },
              {
                title: 'Saved Queries & Execution Audit History',
                desc: 'Bookmark frequently executed questions, review exact latency measurements in milliseconds, and re-run queries with a single click.',
                icon: Bookmark,
              },
              {
                title: 'Dataset Exploration & CSV Export',
                desc: 'Browse complete feedback records, import custom CSV datasets with automatic sentiment tagging, and export query results to CSV.',
                icon: FileSpreadsheet,
              },
            ].map((f, i) => {
              const Icon = f.icon;
              return (
                <div key={i} className="card" style={{ padding: '2rem' }}>
                  <div style={{
                    width: '46px',
                    height: '46px',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--primary-orange-subtle)',
                    color: 'var(--primary-orange)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '1.25rem',
                  }}>
                    <Icon size={22} />
                  </div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.65rem' }}>
                    {f.title}
                  </h3>
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    {f.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* SQL Examples Section */}
      <section id="examples" style={{ padding: '5.5rem 2rem', background: '#FFFFFF' }}>
        <div style={{ maxWidth: '1240px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
            <span className="badge badge-orange" style={{ marginBottom: '0.75rem' }}>
              Comparison
            </span>
            <h2 style={{ fontSize: '2.4rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
              Traditional SQL vs. JevQL Workflow
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', maxWidth: '720px', margin: '0.5rem auto 0 auto' }}>
              See how everyday natural language questions map into clean, safe parameterized PostgreSQL operations.
            </p>
          </div>

          {/* Tab Selector */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '0.75rem',
            marginBottom: '2rem',
            flexWrap: 'wrap',
          }}>
            {SQL_EXAMPLES.map((ex, idx) => (
              <button
                key={idx}
                onClick={() => setActiveExampleIndex(idx)}
                style={{
                  padding: '0.65rem 1.25rem',
                  borderRadius: 'var(--radius-sm)',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  transition: 'all 0.15s',
                  background: activeExampleIndex === idx ? 'var(--primary-orange)' : 'var(--bg-subtle)',
                  color: activeExampleIndex === idx ? '#FFFFFF' : 'var(--text-main)',
                  border: activeExampleIndex === idx ? '1px solid transparent' : '1px solid var(--border-color)',
                }}
              >
                {ex.title}
              </button>
            ))}
          </div>

          {/* Active Comparison Card */}
          <div className="card" style={{
            padding: '2.5rem',
            background: 'var(--surface-dark)',
            color: '#FFFFFF',
            border: '1px solid var(--surface-dark-border)',
          }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '2rem',
              marginBottom: '2rem',
            }}>
              {/* Natural Language Prompt */}
              <div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  color: 'var(--primary-orange)',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginBottom: '0.75rem',
                }}>
                  <Search size={16} />
                  Natural Language Query
                </div>
                <div style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  padding: '1.25rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  fontSize: '1.15rem',
                  fontWeight: 600,
                  color: '#FFFFFF',
                  lineHeight: 1.4,
                }}>
                  "{SQL_EXAMPLES[activeExampleIndex].natural}"
                </div>
              </div>

              {/* Generated Parameterized SQL */}
              <div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  color: '#10B981',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginBottom: '0.75rem',
                }}>
                  <Terminal size={16} />
                  Compiled Safe SQL
                </div>
                <pre style={{
                  background: '#140E0C',
                  padding: '1.25rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.84rem',
                  color: '#F4EFEA',
                  lineHeight: 1.5,
                  overflowX: 'auto',
                }}>
                  <code>{SQL_EXAMPLES[activeExampleIndex].sql}</code>
                </pre>
              </div>
            </div>

            {/* Note on pgjev functions & JevQL implementation */}
            <div style={{
              borderTop: '1px solid rgba(255, 255, 255, 0.1)',
              paddingTop: '1.25rem',
              fontSize: '0.85rem',
              color: '#A89B95',
              lineHeight: 1.6,
            }}>
              <strong style={{ color: '#FDE68A' }}>Technical Architecture Note:</strong> {SQL_EXAMPLES[activeExampleIndex].explanation}
              <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#8E847D' }}>
                * Note: The reference <code>pgjev</code> system defines in-database functions like <code>jev()</code>, <code>jev_prob()</code>, and <code>jev_choice()</code>. JevQL provides an open application-layer translation using standard PostgreSQL <code>django.contrib.postgres</code> (pg_trgm trigrams) alongside external Gemini semantic embeddings without requiring paid or proprietary PostgreSQL server extensions.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Architecture Section */}
      <section id="architecture" style={{ padding: '5.5rem 2rem', background: 'var(--bg-main)' }}>
        <div style={{ maxWidth: '1240px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
            <span className="badge badge-orange" style={{ marginBottom: '0.75rem' }}>
              Full-Stack System Design
            </span>
            <h2 style={{ fontSize: '2.4rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
              System Architecture
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', maxWidth: '640px', margin: '0.5rem auto 0 auto' }}>
              Clean separation of concerns with React frontend, Django REST API, and PostgreSQL engine.
            </p>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '1.5rem',
            marginBottom: '3rem',
          }}>
            <div className="card" style={{ borderTop: '4px solid var(--primary-orange)' }}>
              <div style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--text-main)', marginBottom: '0.5rem' }}>
                1. React 19 + Vite
              </div>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                Modern, responsive Single Page Application with dynamic dashboards, facet filters, CSV export triggers, and toast notifications.
              </p>
            </div>

            <div className="card" style={{ borderTop: '4px solid #F59E0B' }}>
              <div style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--text-main)', marginBottom: '0.5rem' }}>
                2. Django REST Framework
              </div>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                Python backend handling session & token authentication, query planning, schema introspection, and read-only database transactions.
              </p>
            </div>

            <div className="card" style={{ borderTop: '4px solid #10B981' }}>
              <div style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--text-main)', marginBottom: '0.5rem' }}>
                3. PostgreSQL 14+ Engine
              </div>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                Direct SQL storage and execution, utilizing standard <code>pg_trgm</code> trigrams for fast full-text fuzzy similarity search without proprietary lock-in.
              </p>
            </div>

            <div className="card" style={{ borderTop: '4px solid #6366F1' }}>
              <div style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--text-main)', marginBottom: '0.5rem' }}>
                4. Gemini Semantic Provider
              </div>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                AI-driven semantic ranking using Google Gemini embeddings (<code>text-embedding-004</code>), with persistent SHA-256 caching and local fallback.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section style={{
        background: 'linear-gradient(135deg, var(--surface-dark-deep) 0%, var(--surface-dark) 100%)',
        color: '#FFFFFF',
        padding: '5rem 2rem',
        textAlign: 'center',
      }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <h2 style={{ fontSize: 'clamp(2rem, 4vw, 2.8rem)', fontWeight: 800, marginBottom: '1.25rem', letterSpacing: '-0.02em' }}>
            Ready to explore your data in plain English?
          </h2>
          <p style={{ fontSize: '1.1rem', color: 'var(--text-inverse-muted)', marginBottom: '2.5rem', lineHeight: 1.6 }}>
            Launch the JevQL Search Console to test natural-language search, connect your PostgreSQL instance, or review query latency.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <Link to="/app" className="btn-primary" style={{ padding: '0.85rem 2rem', fontSize: '1rem', borderRadius: 'var(--radius-md)' }}>
              <span>Launch Search Console</span>
              <ArrowRight size={18} />
            </Link>
            <Link to="/register" className="btn-dark" style={{ padding: '0.85rem 2rem', fontSize: '1rem', borderRadius: 'var(--radius-md)' }}>
              Sign Up Now
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
