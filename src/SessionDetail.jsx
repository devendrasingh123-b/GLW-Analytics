/**
 * GLW Analytics — Session Detail Page
 * Clean white SaaS-style session drill-down with:
 * - Summary stat cards
 * - Highlighted CTA clicks
 * - Visual click timeline
 * - Scroll & time visualizations
 */

import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'

/* ─── Design Tokens (shared with Dashboard) ─── */
const C = {
  indigo:   '#4F46E5',
  indigoL:  '#EEF2FF',
  indigoM:  '#C7D2FE',
  violet:   '#7C3AED',
  violetL:  '#F5F3FF',
  cyan:     '#0891B2',
  cyanL:    '#ECFEFF',
  emerald:  '#059669',
  emeraldL: '#ECFDF5',
  amber:    '#D97706',
  amberL:   '#FFFBEB',
  rose:     '#E11D48',
  roseL:    '#FFF1F2',
  gray50:   '#F8FAFC',
  gray100:  '#F1F5F9',
  gray200:  '#E2E8F0',
  gray300:  '#CBD5E1',
  gray400:  '#94A3B8',
  gray500:  '#64748B',
  gray600:  '#475569',
  gray700:  '#334155',
  gray800:  '#1E293B',
  gray900:  '#0F172A',
  white:    '#FFFFFF',
  border:   '#E2E8F0',
}

const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=DM+Mono:wght@400;500&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #F8FAFC; }
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes slideIn {
    from { opacity: 0; transform: translateX(-8px); }
    to   { opacity: 1; transform: translateX(0); }
  }
`

/* ─── Utility Functions ─── */
function parseDevice(ua) {
  if (!ua) return 'Unknown'
  if (/bot|crawl|spider|headless/i.test(ua)) return 'Bot'
  if (/Mobile|Android|iPhone/i.test(ua)) return 'Mobile'
  if (/Tablet|iPad/i.test(ua)) return 'Tablet'
  return 'Desktop'
}

function parseReferrer(ref) {
  if (!ref) return 'Direct'
  if (ref.includes('google')) return 'Google'
  if (ref.includes('amazon')) return 'Amazon'
  if (ref.includes('vercel')) return 'Vercel'
  return 'Other'
}

/** Detect if a click is on a CTA (call-to-action) */
function isCTA(click) {
  const ctaKeywords = ['buy', 'purchase', 'order', 'get', 'start', 'sign up', 'signup',
    'register', 'subscribe', 'book', 'contact', 'try', 'free', 'demo', 'learn more', 'shop']
  const text = (click.target_text || '').toLowerCase()
  return ctaKeywords.some(kw => text.includes(kw))
}

/* ─── Sub-components ─── */

/** Card wrapper */
function Card({ children, style = {} }) {
  return (
    <div style={{
      background: C.white, borderRadius: 12, border: `1px solid ${C.border}`,
      padding: '1.25rem 1.5rem',
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      ...style,
    }}>
      {children}
    </div>
  )
}

/** Section heading inside a card */
function CardTitle({ children, sub }) {
  return (
    <div style={{ marginBottom: '1rem' }}>
      <div style={{ fontWeight: 600, fontSize: '0.9rem', color: C.gray800, fontFamily: 'DM Sans, sans-serif' }}>{children}</div>
      {sub && <div style={{ fontSize: '0.72rem', color: C.gray400, marginTop: 2, fontFamily: 'DM Sans, sans-serif' }}>{sub}</div>}
    </div>
  )
}

/** A key:value info row */
function InfoRow({ label, value, mono, color }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
      padding: '0.55rem 0', borderBottom: `1px solid ${C.gray100}`,
    }}>
      <span style={{ fontSize: '0.8rem', color: C.gray400, fontFamily: 'DM Sans, sans-serif', flexShrink: 0, marginRight: 8 }}>
        {label}
      </span>
      <span style={{
        fontSize: '0.8rem', color: color || C.gray700,
        fontFamily: mono ? 'DM Mono, monospace' : 'DM Sans, sans-serif',
        fontWeight: 500, textAlign: 'right', wordBreak: 'break-word', maxWidth: '60%',
      }}>
        {value || '—'}
      </span>
    </div>
  )
}

/** Big metric stat box */
function StatBox({ icon, label, value, color, bg }) {
  return (
    <div style={{
      background: bg, borderRadius: 10, padding: '1rem',
      border: `1px solid ${color}33`, textAlign: 'center',
    }}>
      <div style={{ fontSize: 20, marginBottom: 6 }}>{icon}</div>
      <div style={{ color, fontSize: '1.4rem', fontWeight: 600, lineHeight: 1, fontFamily: 'DM Sans, sans-serif', letterSpacing: '-0.02em' }}>
        {value}
      </div>
      <div style={{ color: C.gray400, fontSize: '0.7rem', marginTop: 4, fontFamily: 'DM Sans, sans-serif' }}>{label}</div>
    </div>
  )
}

/* ═══════════════════════════════════════════════
   SESSION DETAIL COMPONENT
═══════════════════════════════════════════════ */
export default function SessionDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [session, setSession] = useState(null)
  const [summary, setSummary] = useState(null)
  const [clicks,  setClicks]  = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const [{ data: s }, { data: sm }, { data: cl }] = await Promise.all([
          supabase.from('glw_sessions').select('*').eq('id', id).single(),
          supabase.from('glw_session_summary').select('*').eq('session_id', id).maybeSingle(),
          supabase.from('glw_click_events').select('*').eq('session_id', id).order('occurred_at_ist', { ascending: true }),
        ])
        setSession(s)
        setSummary(sm)
        setClicks(cl || [])
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  /* ── Loading state ── */
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: C.gray50, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'DM Sans, sans-serif' }}>
        <style>{GLOBAL_CSS}</style>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, border: `3px solid ${C.indigoM}`, borderTopColor: C.indigo, borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <span style={{ color: C.gray400, fontSize: '0.85rem' }}>Loading session…</span>
        </div>
      </div>
    )
  }

  /* ── Not found state ── */
  if (!session) {
    return (
      <div style={{ minHeight: '100vh', background: C.gray50, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'DM Sans, sans-serif' }}>
        <style>{GLOBAL_CSS}</style>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>
          <div style={{ color: C.rose, fontWeight: 600, marginBottom: 8 }}>Session not found</div>
          <button onClick={() => navigate(-1)} style={{ color: C.indigo, background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.85rem', textDecoration: 'underline' }}>
            ← Go back
          </button>
        </div>
      </div>
    )
  }

  const device     = parseDevice(session.user_agent)
  const deviceIcon = { Mobile: '📱', Desktop: '💻', Bot: '🤖', Tablet: '📟' }[device] || '❓'
  const scrollPct  = summary ? Math.round(Number(summary.max_scroll_depth) * 100) : 0
  const durationS  = summary ? Math.round(Number(summary.time_on_page_ms) / 1000) : 0
  const ctaClicks  = clicks.filter(isCTA)

  /* ── Engagement quality label ── */
  const engagementLabel = (() => {
    if (!summary) return { label: 'No data', color: C.gray400, bg: C.gray100 }
    if (scrollPct > 70 && durationS > 30) return { label: 'High', color: C.emerald, bg: C.emeraldL }
    if (scrollPct > 40 || durationS > 15) return { label: 'Medium', color: C.amber, bg: C.amberL }
    return { label: 'Low', color: C.rose, bg: C.roseL }
  })()

  /* ═══ RENDER ═══ */
  return (
    <div style={{ minHeight: '100vh', background: C.gray50, fontFamily: 'DM Sans, sans-serif', color: C.gray900 }}>
      <style>{GLOBAL_CSS}</style>

      {/* ── NAVBAR ── */}
      <nav style={{
        background: C.white, borderBottom: `1px solid ${C.border}`,
        padding: '0 2rem', height: 60,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 100,
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={() => navigate(-1)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: C.gray100, color: C.gray600, border: 'none',
              borderRadius: 8, padding: '6px 14px', cursor: 'pointer',
              fontSize: '0.82rem', fontFamily: 'DM Sans, sans-serif',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = C.gray200}
            onMouseLeave={e => e.currentTarget.style.background = C.gray100}
          >
            ← Back to Dashboard
          </button>
          <span style={{ color: C.gray300, fontSize: '1rem' }}>|</span>
          <span style={{ color: C.gray400, fontSize: '0.8rem' }}>Session Detail</span>
        </div>
        <span style={{ color: C.gray300, fontSize: '0.72rem', fontFamily: 'DM Mono, monospace' }}>
          {id?.slice(0, 20)}…
        </span>
      </nav>

      {/* ── PAGE CONTENT ── */}
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '1.5rem', animation: 'fadeUp 0.35s ease' }}>

        {/* ── HERO CARD ── */}
        <Card style={{ marginBottom: '1rem', borderLeft: `4px solid ${C.indigo}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
            {/* Device avatar */}
            <div style={{
              width: 52, height: 52, borderRadius: 12,
              background: C.indigoL, display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: 24, flexShrink: 0,
            }}>{deviceIcon}</div>

            {/* Info */}
            <div style={{ flex: 1, minWidth: 180 }}>
              <div style={{ fontWeight: 600, fontSize: '1rem', color: C.gray900 }}>
                {deviceIcon} {device} User · {parseReferrer(session.referrer)}
              </div>
              <div style={{ color: C.gray400, fontSize: '0.78rem', marginTop: 3 }}>
                {new Date(session.started_at_ist).toLocaleString('en-IN', { dateStyle: 'long', timeStyle: 'short' })}
              </div>
              <div style={{ color: C.gray500, fontSize: '0.72rem', marginTop: 2, fontFamily: 'DM Mono, monospace' }}>
                {session.path || '/'}
              </div>
            </div>

            {/* Engagement badge */}
            <span style={{
              fontSize: '0.78rem', fontWeight: 600,
              padding: '4px 12px', borderRadius: 20,
              background: engagementLabel.bg, color: engagementLabel.color,
              border: `1px solid ${engagementLabel.color}33`,
            }}>
              {engagementLabel.label} Engagement
            </span>

            {/* CTA clicks badge (if any) */}
            {ctaClicks.length > 0 && (
              <span style={{
                fontSize: '0.78rem', fontWeight: 600,
                padding: '4px 12px', borderRadius: 20,
                background: C.emeraldL, color: C.emerald,
                border: `1px solid ${C.emerald}33`,
              }}>
                🎯 {ctaClicks.length} CTA click{ctaClicks.length > 1 ? 's' : ''}
              </span>
            )}
          </div>
        </Card>

        {/* ── STAT CARDS + SESSION INFO ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>

          {/* Session Info */}
          <Card>
            <CardTitle sub="Browser session metadata">Session Info</CardTitle>
            <InfoRow label="Started At"  value={new Date(session.started_at_ist).toLocaleString()}  />
            <InfoRow label="Page"        value={session.path || '/'}        mono color={C.violet}   />
            <InfoRow label="Device"      value={`${deviceIcon} ${device}`}                          />
            <InfoRow label="Source"      value={parseReferrer(session.referrer)} color={C.emerald}  />
            <InfoRow label="Referrer"    value={session.referrer || 'Direct'} mono                  />
          </Card>

          {/* Engagement */}
          <Card>
            <CardTitle sub="How deeply the user engaged">Engagement</CardTitle>
            {summary ? (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: '1rem' }}>
                  <StatBox icon="⏱️" label="Time on page" value={`${durationS}s`}        color={C.indigo}  bg={C.indigoL}  />
                  <StatBox icon="📜" label="Max scroll"   value={`${scrollPct}%`}         color={C.emerald} bg={C.emeraldL} />
                  <StatBox icon="🖱️" label="Total clicks" value={summary.click_count}     color={C.amber}   bg={C.amberL}   />
                </div>
                {/* Scroll progress bar */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: '0.75rem', color: C.gray500 }}>Scroll depth</span>
                    <span style={{ fontSize: '0.75rem', color: C.emerald, fontWeight: 600 }}>{scrollPct}%</span>
                  </div>
                  <div style={{ background: C.gray100, borderRadius: 6, height: 8, overflow: 'hidden' }}>
                    <div style={{
                      width: `${scrollPct}%`, height: 8,
                      background: `linear-gradient(90deg, ${C.indigo}, ${C.emerald})`,
                      borderRadius: 6, transition: 'width 1s ease',
                    }} />
                  </div>
                  {/* Depth markers */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                    {[0, 25, 50, 75, 100].map(p => (
                      <span key={p} style={{ fontSize: '0.62rem', color: scrollPct >= p ? C.emerald : C.gray300 }}>
                        {p}%
                      </span>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div style={{ color: C.gray300, textAlign: 'center', padding: '2rem', fontSize: '0.85rem' }}>
                No engagement data recorded
              </div>
            )}
          </Card>
        </div>

        {/* ── CLICK TIMELINE ── */}
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <CardTitle sub="User interaction sequence">Click Timeline</CardTitle>
            {clicks.length > 0 && (
              <div style={{ display: 'flex', gap: 8 }}>
                {ctaClicks.length > 0 && (
                  <span style={{
                    fontSize: 11, background: C.emeraldL, color: C.emerald,
                    padding: '3px 10px', borderRadius: 20, fontWeight: 500,
                  }}>🎯 {ctaClicks.length} CTA</span>
                )}
                <span style={{
                  fontSize: 11, background: C.cyanL, color: C.cyan,
                  padding: '3px 10px', borderRadius: 20, fontWeight: 500,
                }}>{clicks.length} total</span>
              </div>
            )}
          </div>

          {clicks.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: C.gray300 }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🖱️</div>
              <div style={{ fontSize: '0.85rem' }}>No clicks were recorded for this session</div>
            </div>
          ) : (
            <div style={{ position: 'relative', paddingLeft: '1.5rem' }}>
              {/* Vertical timeline line */}
              <div style={{
                position: 'absolute', left: 7, top: 4, bottom: 4,
                width: 2, background: C.gray100, borderRadius: 2,
              }} />

              {clicks.map((c, i) => {
                const cta = isCTA(c)
                return (
                  <div
                    key={c.id}
                    style={{
                      display: 'flex', gap: '0.75rem', marginBottom: '0.65rem',
                      animation: `slideIn 0.25s ease ${i * 0.04}s both`,
                    }}
                  >
                    {/* Timeline dot */}
                    <div style={{
                      position: 'absolute', left: 1,
                      width: 14, height: 14, borderRadius: '50%',
                      background: cta ? C.emerald : C.indigoM,
                      border: `2px solid ${C.white}`,
                      marginTop: 13,
                      boxShadow: cta ? `0 0 0 2px ${C.emerald}44` : 'none',
                    }} />

                    {/* Click card */}
                    <div style={{
                      flex: 1,
                      background: cta ? C.emeraldL : C.gray50,
                      borderRadius: 10,
                      padding: '0.65rem 1rem',
                      border: `1px solid ${cta ? C.emerald + '33' : C.border}`,
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 4 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {cta && (
                            <span style={{
                              fontSize: 10, background: C.emerald, color: C.white,
                              padding: '1px 6px', borderRadius: 4, fontWeight: 600,
                            }}>CTA</span>
                          )}
                          <span style={{
                            color: cta ? C.emerald : C.gray700,
                            fontSize: '0.83rem', fontWeight: cta ? 600 : 500,
                          }}>
                            {c.target_text || c.target_tag || 'Unknown element'}
                          </span>
                        </div>
                        <span style={{
                          color: C.gray300, fontSize: '0.7rem',
                          fontFamily: 'DM Mono, monospace',
                        }}>
                          {new Date(c.occurred_at_ist).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                      </div>

                      {c.target_href && (
                        <div style={{
                          color: C.indigo, fontSize: '0.72rem', marginTop: 4,
                          wordBreak: 'break-all', fontFamily: 'DM Mono, monospace',
                        }}>
                          🔗 {c.target_href}
                        </div>
                      )}

                      {c.target_analytics_id && (
                        <div style={{ color: C.gray400, fontSize: '0.68rem', marginTop: 3 }}>
                          ID: {c.target_analytics_id}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>

      </div>
    </div>
  )
}

