import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'

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

function InfoRow({ label, value, color }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.65rem 0', borderBottom: '1px solid #1e1e3a' }}>
      <span style={{ color: '#64748b', fontSize: '0.82rem' }}>{label}</span>
      <span style={{ color: color || '#cbd5e1', fontSize: '0.82rem', fontWeight: 500, maxWidth: '60%', textAlign: 'right', wordBreak: 'break-word' }}>{value || '—'}</span>
    </div>
  )
}

function StatBox({ icon, label, value, color }) {
  return (
    <div style={{ background: '#0a0a18', borderRadius: 10, padding: '1rem', borderTop: `2px solid ${color}`, textAlign: 'center' }}>
      <div style={{ fontSize: 20, marginBottom: 6 }}>{icon}</div>
      <div style={{ color, fontSize: '1.4rem', fontWeight: 800 }}>{value}</div>
      <div style={{ color: '#64748b', fontSize: '0.72rem', marginTop: 4 }}>{label}</div>
    </div>
  )
}

export default function SessionDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [session, setSession] = useState(null)
  const [summary, setSummary] = useState(null)
  const [clicks, setClicks] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchSession() {
      setLoading(true)
      try {
        const [{ data: s }, { data: sm }, { data: cl }] = await Promise.all([
          supabase.from('glw_sessions').select('*').eq('id', id).single(),
          supabase.from('glw_session_summary').select('*').eq('session_id', id).maybeSingle(),
          supabase.from('glw_click_events').select('*').eq('session_id', id).order('occurred_at_ist', { ascending: true })
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
    fetchSession()
  }, [id])

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#060610', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#6366f1', fontSize: '1rem' }}>Loading session...</div>
    </div>
  )

  if (!session) return (
    <div style={{ minHeight: '100vh', background: '#060610', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#f87171', fontSize: '1rem' }}>Session not found</div>
    </div>
  )

  const device = parseDevice(session.user_agent)
  const deviceIcon = { Mobile: '📱', Desktop: '💻', Bot: '🤖', Tablet: '📟' }[device] || '❓'

  return (
    <div style={{ minHeight: '100vh', background: '#060610', color: '#e2e8f0', fontFamily: "'Inter', sans-serif" }}>
      <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`}</style>

      {/* NAVBAR */}
      <div style={{ background: '#0a0a18', borderBottom: '1px solid #1e1e3a', padding: '0 2rem', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => navigate(-1)} style={{ background: '#1e1e3a', color: '#94a3b8', border: 'none', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 6, transition: 'background 0.2s' }}
            onMouseEnter={e => e.currentTarget.style.background = '#2d2d4e'}
            onMouseLeave={e => e.currentTarget.style.background = '#1e1e3a'}>
            ← Back
          </button>
          <div style={{ width: 1, height: 20, background: '#1e1e3a' }} />
          <span style={{ color: '#475569', fontSize: '0.8rem' }}>Session Detail</span>
        </div>
        <div style={{ color: '#374151', fontSize: '0.7rem', fontFamily: 'monospace' }}>{id?.slice(0, 18)}...</div>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '2rem 1.5rem', animation: 'fadeIn 0.4s ease' }}>

        {/* HERO */}
        <div style={{ background: '#0f0f1a', border: '1px solid #1e1e3a', borderRadius: 14, padding: '1.5rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
          <div style={{ width: 56, height: 56, background: '#1e1e3a', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 }}>{deviceIcon}</div>
          <div style={{ flex: 1 }}>
            <div style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '1.1rem', marginBottom: 4 }}>{deviceIcon} {device} User</div>
            <div style={{ color: '#475569', fontSize: '0.78rem' }}>
              {new Date(session.started_at_ist).toLocaleString('en-IN', { dateStyle: 'long', timeStyle: 'short' })}
            </div>
            <div style={{ color: '#374151', fontSize: '0.72rem', marginTop: 3, fontFamily: 'monospace' }}>{session.path}</div>
          </div>
          {summary && (
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: '#6366f1', fontWeight: 800, fontSize: '1.3rem' }}>{Math.round(Number(summary.time_on_page_ms) / 1000)}s</div>
                <div style={{ color: '#475569', fontSize: '0.68rem' }}>Time</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: '#10b981', fontWeight: 800, fontSize: '1.3rem' }}>{Math.round(Number(summary.max_scroll_depth) * 100)}%</div>
                <div style={{ color: '#475569', fontSize: '0.68rem' }}>Scroll</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: '#f59e0b', fontWeight: 800, fontSize: '1.3rem' }}>{summary.click_count}</div>
                <div style={{ color: '#475569', fontSize: '0.68rem' }}>Clicks</div>
              </div>
            </div>
          )}
        </div>

        {/* STATS + INFO */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.25rem' }}>

          {/* Session Info */}
          <div style={{ background: '#0f0f1a', border: '1px solid #1e1e3a', borderRadius: 14, padding: '1.5rem' }}>
            <div style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.75rem' }}>Session Info</div>
            <InfoRow label="Started At" value={new Date(session.started_at_ist).toLocaleString()} />
            <InfoRow label="Page" value={session.path} color="#a78bfa" />
            <InfoRow label="Device" value={`${deviceIcon} ${device}`} />
            <InfoRow label="Source" value={parseReferrer(session.referrer)} color="#34d399" />
            <InfoRow label="Referrer" value={session.referrer || 'Direct'} />
          </div>

          {/* Engagement */}
          <div style={{ background: '#0f0f1a', border: '1px solid #1e1e3a', borderRadius: 14, padding: '1.5rem' }}>
            <div style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.75rem' }}>Engagement</div>
            {summary ? (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: '1rem' }}>
                  <StatBox icon="⏱️" label="Time" value={`${Math.round(Number(summary.time_on_page_ms) / 1000)}s`} color="#6366f1" />
                  <StatBox icon="📜" label="Scroll" value={`${Math.round(Number(summary.max_scroll_depth) * 100)}%`} color="#10b981" />
                  <StatBox icon="🖱️" label="Clicks" value={summary.click_count} color="#f59e0b" />
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ color: '#64748b', fontSize: '0.75rem' }}>Scroll Progress</span>
                    <span style={{ color: '#10b981', fontSize: '0.75rem' }}>{Math.round(Number(summary.max_scroll_depth) * 100)}%</span>
                  </div>
                  <div style={{ background: '#1e1e3a', borderRadius: 6, height: 8 }}>
                    <div style={{ width: `${Math.round(Number(summary.max_scroll_depth) * 100)}%`, height: 8, background: 'linear-gradient(90deg, #6366f1, #10b981)', borderRadius: 6, transition: 'width 1s ease' }} />
                  </div>
                </div>
              </>
            ) : (
              <div style={{ color: '#475569', textAlign: 'center', padding: '2rem', fontSize: '0.85rem' }}>No engagement data</div>
            )}
          </div>
        </div>

        {/* CLICK TIMELINE */}
        <div style={{ background: '#0f0f1a', border: '1px solid #1e1e3a', borderRadius: 14, padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div>
              <div style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '0.9rem' }}>Click Timeline</div>
              <div style={{ color: '#475569', fontSize: '0.72rem' }}>User interaction sequence</div>
            </div>
            {clicks.length > 0 && (
              <div style={{ background: '#1e1e3a', borderRadius: 20, padding: '3px 12px', fontSize: '0.72rem', color: '#06b6d4' }}>{clicks.length} clicks</div>
            )}
          </div>

          {clicks.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2.5rem', color: '#374151' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🖱️</div>
              <div style={{ fontSize: '0.85rem' }}>No clicks recorded for this session</div>
            </div>
          ) : (
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', left: 16, top: 0, bottom: 0, width: 2, background: '#1e1e3a', borderRadius: 2 }} />
              {clicks.map((c, i) => (
                <div key={c.id} style={{ display: 'flex', gap: '1rem', marginBottom: '0.75rem', paddingLeft: '2.5rem', position: 'relative', animation: `fadeIn 0.3s ease ${i * 0.05}s both` }}>
                  <div style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, borderRadius: '50%', background: '#6366f1', border: '2px solid #060610', zIndex: 1 }} />
                  <div style={{ flex: 1, background: '#0a0a18', borderRadius: 10, padding: '0.75rem 1rem', border: '1px solid #1e1e3a' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 4 }}>
                      <span style={{ color: '#e2e8f0', fontSize: '0.85rem', fontWeight: 500 }}>
                        🖱️ {c.target_text || c.target_tag || 'Unknown element'}
                      </span>
                      <span style={{ color: '#374151', fontSize: '0.7rem' }}>{new Date(c.occurred_at_ist).toLocaleTimeString()}</span>
                    </div>
                    {c.target_href && (
                      <div style={{ color: '#6366f1', fontSize: '0.72rem', marginTop: 4, wordBreak: 'break-all' }}>🔗 {c.target_href}</div>
                    )}
                    {c.target_analytics_id && (
                      <div style={{ color: '#475569', fontSize: '0.7rem', marginTop: 2 }}>ID: {c.target_analytics_id}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}