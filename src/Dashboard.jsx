/**
 * Dashboard.jsx — GLW Analytics v4
 * Changes from v3:
 *  • Custom date range now filters entire dashboard correctly
 *  • CTA panel: "BUY NOW" removed, only Platform names shown
 *  • Gel Wink / long product text buttons removed from CTA
 *  • Chart zoom-out issue fixed (pointer-events on YAxis labels)
 *  • Sessions table: CTA column added with filter
 *  • Hourly report / Peak hours section added
 *  • More insights from analyticsUtils
 */

import { useState, useEffect, useMemo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, BarChart, Bar, Cell,
} from 'recharts'
import { supabase } from './supabaseClient'
import {
  C, GLOBAL_CSS, CHART_COLORS, CustomTooltip,
  parseDevice, parseDeviceIcon, parseReferrer,
  engagementLevel, engagementStyle,
  filterByDays, buildClickStats, buildHourlyStats,
  generateInsights, isCTA,
  Card, CardHeader, KPICard, InsightPill,
  SkeletonCard, paginBtnStyle,
} from './analyticsUtils.jsx'

const DATE_FILTERS = [
  { label: '7D',     value: 7  },
  { label: '14D',    value: 14 },
  { label: '30D',    value: 30 },
  { label: 'All',    value: 0  },
  { label: 'Custom', value: -1 },
]

const PLATFORM_LIST = [
  'Amazon', 'Flipkart', 'Blinkit', 'Zepto', 'Instamart', 'Aromahpure', 'Vercel'
]

const SORT_OPTIONS = [
  { label: 'Time (newest)',  value: 'time_desc'   },
  { label: 'Time (oldest)',  value: 'time_asc'    },
  { label: 'Duration ↓',    value: 'dur_desc'    },
  { label: 'Clicks ↓',      value: 'clicks_desc' },
  { label: 'Scroll ↓',      value: 'scroll_desc' },
]
const LIMIT = 15

function isProduct(text) {
  if (!text) return false
  if (isCTA(text)) return false
  return text.length < 40
}

// Extract platform name from CTA text
function extractPlatform(text) {
  if (!text) return null
  const cleaned = text.replace(/buy now/gi, '').replace(/buy/gi, '').replace(/\s+/g, ' ').trim()
  if (!cleaned || cleaned.length > 30) return null
  const match = PLATFORM_LIST.find(p => cleaned.toLowerCase().includes(p.toLowerCase()))
  return match || null
}

export default function Dashboard() {
  const navigate = useNavigate()

  const [allSessions, setAllSessions] = useState([])
  const [allSummary,  setAllSummary]  = useState([])
  const [allClicks,   setAllClicks]   = useState([])
  const [loading,     setLoading]     = useState(true)
  const [lastUpdate,  setLastUpdate]  = useState(new Date())
  const [liveFlash,   setLiveFlash]   = useState(false)

  // Filters
  const [days,         setDays]         = useState(30)
  const [customFrom,   setCustomFrom]   = useState('')
  const [customTo,     setCustomTo]     = useState('')
  const [deviceFilter, setDeviceFilter] = useState('All')
  const [searchQuery,  setSearchQuery]  = useState('')
  const [ctaFilter,    setCtaFilter]    = useState('All')  // NEW: CTA filter for sessions table
  const [sortBy,       setSortBy]       = useState('time_desc')
  const [page,         setPage]         = useState(1)

  async function fetchData() {
    const [{ data: s }, { data: sm }, { data: cl }] = await Promise.all([
      supabase.from('glw_sessions').select('*').order('started_at_ist', { ascending: false }),
      supabase.from('glw_session_summary').select('*'),
      supabase.from('glw_click_events').select('*').order('occurred_at_ist', { ascending: false }),
    ])
    setAllSessions(s || [])
    setAllSummary(sm || [])
    setAllClicks(cl || [])
    setLoading(false)
    setLastUpdate(new Date())
    setLiveFlash(true)
    setTimeout(() => setLiveFlash(false), 1500)
  }

  useEffect(() => {
    fetchData()
    const ch = supabase.channel('glw-dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'glw_sessions'        }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'glw_session_summary' }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'glw_click_events'    }, fetchData)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [])

  // ── Date filter logic — FIX: properly applies custom range to ALL data
  const sessions = useMemo(() => {
    let s = allSessions
    if (days === -1) {
      // Custom date range — only apply if both dates are set
      if (customFrom && customTo) {
        const from = new Date(customFrom)
        from.setHours(0, 0, 0, 0)
        const to = new Date(customTo)
        to.setHours(23, 59, 59, 999)
        s = s.filter(x => {
          const d = new Date(x.started_at_ist)
          return d >= from && d <= to
        })
      }
    } else if (days > 0) {
      s = filterByDays(s, days)
    }
    if (deviceFilter !== 'All') s = s.filter(x => parseDevice(x.user_agent) === deviceFilter)
    return s
  }, [allSessions, days, deviceFilter, customFrom, customTo])

  const sessionIds = useMemo(() => new Set(sessions.map(s => s.id)), [sessions])

  const summary = useMemo(() =>
    allSummary.filter(s => sessionIds.has(s.session_id)), [allSummary, sessionIds])

  // FIX: clicks also filtered by sessionIds so all charts reflect the date range
  const clicks = useMemo(() =>
    allClicks.filter(c => sessionIds.has(c.session_id)), [allClicks, sessionIds])

  const summaryMap = useMemo(() => {
    const m = {}
    summary.forEach(s => { m[s.session_id] = s })
    return m
  }, [summary])

  // Build a map: session_id → list of platform CTAs clicked
  const sessionCtaMap = useMemo(() => {
    const m = {}
    clicks.forEach(c => {
      if (!isCTA(c.target_text || '')) return
      const platform = extractPlatform(c.target_text)
      if (!platform) return
      if (!m[c.session_id]) m[c.session_id] = new Set()
      m[c.session_id].add(platform)
    })
    return m
  }, [clicks])

  // All platforms that appear in clicks (for CTA filter dropdown)
  const allCtaPlatforms = useMemo(() => {
    const s = new Set()
    Object.values(sessionCtaMap).forEach(set => set.forEach(p => s.add(p)))
    return ['All', 'None', ...Array.from(s).sort()]
  }, [sessionCtaMap])

  // ── KPI calculations
  const totalSessions  = sessions.length
  const realSessions   = sessions.filter(s => parseDevice(s.user_agent) !== 'Bot').length
  const uniqueSessions = new Set(sessions.map(s => s.id)).size
  const avgTime = summary.length
    ? Math.round(summary.reduce((a, b) => a + Number(b.time_on_page_ms), 0) / summary.length / 1000)
    : 0
  const totalClicks = summary.reduce((a, b) => a + Number(b.click_count), 0)

  // ── Engagement level counts
  const engCounts = useMemo(() => {
    const counts = { High: 0, Medium: 0, Low: 0, 'No data': 0 }
    sessions.forEach(s => {
      const sm = summaryMap[s.id]
      const level = engagementLevel(sm)
      counts[level] = (counts[level] || 0) + 1
    })
    return counts
  }, [sessions, summaryMap])

  // ── Chart data
  const dailyData = useMemo(() => {
    const m = {}
    sessions.forEach(s => {
      const d = s.started_at_ist?.slice(0, 10); if (d) m[d] = (m[d] || 0) + 1
    })
    return Object.entries(m).sort((a,b) => a[0].localeCompare(b[0]))
      .map(([date, visitors]) => ({ date: date.slice(5), visitors }))
  }, [sessions])

  const trafficData = useMemo(() => {
    const m = {}
    sessions.forEach(s => { const r = parseReferrer(s.referrer); m[r] = (m[r] || 0) + 1 })
    return Object.entries(m).map(([name, value]) => ({ name, value })).sort((a,b)=>b.value-a.value)
  }, [sessions])

  const clickStats = useMemo(() => buildClickStats(clicks), [clicks])

  // Hourly data — uses date-filtered sessions & clicks
  const hourlyData = useMemo(() => buildHourlyStats(sessions, clicks), [sessions, clicks])
  const peakHour   = useMemo(() => {
    const max = Math.max(...hourlyData.map(h => h.sessions))
    return hourlyData.find(h => h.sessions === max)
  }, [hourlyData])

  const productClicks = useMemo(() =>
    clickStats.byText.filter(x => isProduct(x.name)).slice(0, 10),
    [clickStats]
  )

  // Cleaned platform CTAs — remove "BUY NOW", filter to known platforms, remove long garbage
  const platformCTAClicks = useMemo(() => {
    const m = {}
    clickStats.ctaClicks.forEach(c => {
      const platform = extractPlatform(c.target_text)
      if (!platform) return
      m[platform] = (m[platform] || 0) + 1
    })
    return Object.entries(m).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value)
  }, [clickStats])

  const insights = useMemo(() =>
    generateInsights({ sessions, summaryMap, clicks, pageStats: [] }),
    [sessions, summaryMap, clicks]
  )

  // ── Session table with CTA filter
  const filteredSessions = useMemo(() => {
    let s = [...sessions]
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      s = s.filter(x =>
        (x.id || '').toLowerCase().includes(q) ||
        (x.path || '').toLowerCase().includes(q) ||
        parseReferrer(x.referrer).toLowerCase().includes(q) ||
        parseDevice(x.user_agent).toLowerCase().includes(q)
      )
    }
    // CTA filter
    if (ctaFilter !== 'All') {
      if (ctaFilter === 'None') {
        s = s.filter(x => !sessionCtaMap[x.id] || sessionCtaMap[x.id].size === 0)
      } else {
        s = s.filter(x => sessionCtaMap[x.id]?.has(ctaFilter))
      }
    }
    s.sort((a, b) => {
      const sa = summaryMap[a.id], sb = summaryMap[b.id]
      switch (sortBy) {
        case 'time_asc':    return new Date(a.started_at_ist) - new Date(b.started_at_ist)
        case 'dur_desc':    return (Number(sb?.time_on_page_ms)||0) - (Number(sa?.time_on_page_ms)||0)
        case 'clicks_desc': return (Number(sb?.click_count)||0) - (Number(sa?.click_count)||0)
        case 'scroll_desc': return (Number(sb?.max_scroll_depth)||0) - (Number(sa?.max_scroll_depth)||0)
        default:            return new Date(b.started_at_ist) - new Date(a.started_at_ist)
      }
    })
    return s
  }, [sessions, searchQuery, sortBy, summaryMap, ctaFilter, sessionCtaMap])

  const totalPages   = Math.ceil(filteredSessions.length / LIMIT)
  const pageSessions = filteredSessions.slice((page - 1) * LIMIT, page * LIMIT)
  useMemo(() => setPage(1), [searchQuery, sortBy, days, deviceFilter, ctaFilter])

  // ─── Loading
  if (loading) return (
    <div style={{ minHeight: '100vh', background: C.gray50, padding: '2rem' }}>
      <style>{GLOBAL_CSS}</style>
      <div style={{ maxWidth: 1240, margin: '0 auto' }}>
        <div style={{ height: 56, background: C.white, borderRadius: 12, border: `1px solid ${C.border}`, marginBottom: '1.5rem' }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '0.75rem', marginBottom: '1.25rem' }}>
          {[...Array(4)].map((_,i) => <SkeletonCard key={i} h={100} />)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
          <SkeletonCard h={220} /> <SkeletonCard h={220} />
        </div>
      </div>
    </div>
  )

  // ═══════════════════════════════════
  return (
    <div style={{ minHeight: '100vh', background: C.gray50 }}>
      <style>{GLOBAL_CSS}</style>

      {/* NAVBAR */}
      <nav style={{
        background: C.white, borderBottom: `1px solid ${C.border}`,
        padding: '0 1.5rem', height: 56,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 100,
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 7,
              background: `linear-gradient(135deg,${C.indigo},${C.violet})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: C.white, fontSize: 13, fontWeight: 700,
            }}>G</div>
            <span style={{ fontWeight: 600, fontSize: '0.88rem', color: C.gray900 }}>GLW Analytics</span>
          </div>
          <div style={{ display: 'flex', gap: 2 }}>
            {[{ label: 'Dashboard', href: '/' }, { label: 'Deep Dive', href: '/analytics' }].map(({ label, href }) => {
              const active = href === '/'
              return (
                <Link key={href} to={href} style={{
                  padding: '5px 14px', borderRadius: 7, fontSize: '0.82rem',
                  fontWeight: active ? 500 : 400,
                  background: active ? C.indigoL : 'transparent',
                  color: active ? C.indigo : C.gray500,
                  textDecoration: 'none', transition: 'all 0.15s',
                }}>{label}</Link>
              )
            })}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{
            width: 7, height: 7, borderRadius: '50%', background: C.emerald,
            animation: liveFlash ? 'pulseDot 0.8s' : 'pulseDot 2.5s infinite',
          }} />
          <span style={{ fontSize: '0.73rem', color: C.gray400 }}>
            Live · {lastUpdate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </nav>

      {/* PAGE BODY */}
      <div style={{ maxWidth: 1240, margin: '0 auto', padding: '1.25rem 1.5rem', animation: 'fadeUp 0.3s ease' }}>

        {/* HEADER + FILTERS */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h1 style={{ fontSize: '1.1rem', fontWeight: 600, color: C.gray900, letterSpacing: '-0.02em' }}>Dashboard</h1>
            <p style={{ fontSize: '0.75rem', color: C.gray400, marginTop: 1 }}>{totalSessions} sessions · {realSessions} real users
              {days === -1 && customFrom && customTo && (
                <span style={{ marginLeft: 6, color: C.indigo, fontWeight: 500 }}>
                  ({customFrom} → {customTo})
                </span>
              )}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Device filter */}
            <select value={deviceFilter} onChange={e => setDeviceFilter(e.target.value)} style={selectStyle}>
              {['All','Desktop','Mobile','Tablet','Bot'].map(d => <option key={d}>{d}</option>)}
            </select>
            {/* Date tabs */}
            <div style={{ display: 'flex', gap: 3, background: C.gray100, padding: 3, borderRadius: 9 }}>
              {DATE_FILTERS.map(f => (
                <button key={f.value} onClick={() => setDays(f.value)} style={{
                  ...tabBtnStyle,
                  background: days === f.value ? C.white : 'transparent',
                  color: days === f.value ? C.gray900 : C.gray500,
                  boxShadow: days === f.value ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                }}>{f.label}</button>
              ))}
            </div>
            {/* Custom date inputs */}
            {days === -1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} style={inputStyle} />
                <span style={{ color: C.gray400, fontSize: 12 }}>→</span>
                <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} style={inputStyle} />
              </div>
            )}
            <Link to="/analytics" style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '6px 14px', borderRadius: 8, fontSize: '0.8rem',
              background: C.indigo, color: C.white, textDecoration: 'none',
              fontWeight: 500,
            }}>Deep Dive →</Link>
          </div>
        </div>

        {/* KPI CARDS */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '0.75rem', marginBottom: '1rem' }}>
          <KPICard icon="👥" label="Sessions"        value={totalSessions}  sub={`${realSessions} real`}      color={C.indigo}  bgColor={C.indigoL}  />
          <KPICard icon="⏱️" label="Avg Time"        value={`${avgTime}s`}  sub="per session"                 color={C.violet}  bgColor={C.violetL}  />
          <KPICard icon="🖱️" label="Total Clicks"    value={totalClicks}    sub="interactions"                color={C.cyan}    bgColor={C.cyanL}    />
          <KPICard icon="🆔" label="Unique Sessions" value={uniqueSessions} sub="distinct session IDs"        color={C.emerald} bgColor={C.emeraldL} />
        </div>

        {/* ROW 1: Daily trend + Engagement Breakdown */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
          <Card>
            <CardHeader title="Sessions Over Time" sub="Daily visitor trend" badge={days === -1 ? 'Custom' : `${days || 'All'} days`} />
            <ResponsiveContainer width="100%" height={190}>
              <LineChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.gray100} />
                <XAxis dataKey="date" tick={{ fill: C.gray400, fontSize: 11, fontFamily: 'DM Mono, monospace' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: C.gray400, fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="visitors" name="Visitors" stroke={C.indigo} strokeWidth={2.5}
                  dot={{ fill: C.indigo, r: 3, strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: C.indigo, stroke: C.white, strokeWidth: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          <Card>
            <CardHeader title="Engagement Levels" sub="Breakdown by session engagement" badge="Live" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
              {[
                { level: 'High',    color: C.emerald, bg: C.emeraldL, desc: 'scroll>70% & 30s+' },
                { level: 'Medium',  color: C.amber,   bg: C.amberL,   desc: 'some interaction' },
                { level: 'Low',     color: C.rose,    bg: C.roseL,    desc: 'minimal interaction' },
                { level: 'No data', color: C.gray400, bg: C.gray100,  desc: 'no summary recorded' },
              ].map(({ level, color, bg, desc }) => {
                const count = engCounts[level] || 0
                const pct   = totalSessions ? Math.round(count / totalSessions * 100) : 0
                return (
                  <div key={level}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: bg, color, fontWeight: 600 }}>{level}</span>
                        <span style={{ fontSize: 11, color: C.gray400 }}>{desc}</span>
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 600, color }}>{count} <span style={{ color: C.gray400, fontWeight: 400 }}>({pct}%)</span></span>
                    </div>
                    <div style={{ background: C.gray100, borderRadius: 4, height: 6 }}>
                      <div style={{ width: `${pct}%`, height: 6, background: color, borderRadius: 4, transition: 'width 0.6s ease' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        </div>

        {/* ROW 2: Platform CTAs + Traffic Sources */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>

          <Card>
            <CardHeader
              title="Top Clicked Elements"
              sub="Platform & product insights"
              action={<Link to="/analytics" style={{ fontSize: 11, color: C.indigo, textDecoration: 'none' }}>Full click report →</Link>}
            />

            {productClicks.length === 0 && platformCTAClicks.length === 0 ? (
              <div style={{ color: C.gray300, fontSize: '0.82rem', textAlign: 'center', padding: '1.5rem' }}>
                No click data yet
              </div>
            ) : (
              <>
                {/* Product pills */}
                {productClicks.length > 0 && (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 11, color: C.gray400, marginBottom: 8, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      Product Interest
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {productClicks.map(item => (
                        <div key={item.name} style={{
                          padding: '5px 12px', borderRadius: 20,
                          border: `1px solid ${C.indigoM}`, background: C.indigoL,
                          color: C.indigo, fontSize: 12, fontWeight: 500,
                          display: 'flex', alignItems: 'center', gap: 5,
                        }}>
                          {item.name}
                          <span style={{ background: C.indigo + '22', borderRadius: 10, padding: '1px 6px', fontSize: 10, fontWeight: 700 }}>
                            {item.value}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Platform bars — FIX: no "BUY NOW", no Gel Wink garbage */}
                {platformCTAClicks.length > 0 && (
                  <div>
                    <div style={{ fontSize: 11, color: C.gray400, marginBottom: 8, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      Platforms
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                      {platformCTAClicks.map((item) => (
                        <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 10, background: C.emerald, color: C.white, padding: '2px 8px', borderRadius: 4, fontWeight: 600, minWidth: 72, textAlign: 'center' }}>
                            {item.name}
                          </span>
                          <div style={{ flex: 1, position: 'relative', height: 20 }}>
                            <div style={{
                              position: 'absolute', left: 0, top: 2,
                              width: `${Math.round(item.value / (platformCTAClicks[0]?.value || 1) * 100)}%`,
                              height: 16, borderRadius: 4, background: C.emeraldL,
                            }} />
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 600, color: C.emerald, width: 24, textAlign: 'right' }}>
                            {item.value}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </Card>

          <Card>
            <CardHeader
              title="Traffic Sources"
              sub="Where visitors come from"
              action={<Link to="/analytics" style={{ fontSize: 11, color: C.indigo, textDecoration: 'none' }}>Full report →</Link>}
            />
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={trafficData} layout="vertical" barSize={12}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.gray100} horizontal={false} />
                <XAxis type="number" tick={{ fill: C.gray400, fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fill: C.gray600, fontSize: 11 }} axisLine={false} tickLine={false} width={60} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" name="Sessions" fill={C.violet} radius={[0,5,5,0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>

        {/* ── HOURLY REPORT — Peak Hours */}
        <Card style={{ marginBottom: '1rem' }}>
          <CardHeader
            title="⏰ Hourly Traffic Report"
            sub="Sessions and clicks by hour of day — all times in IST"
            badge={peakHour ? `Peak: ${peakHour.label}` : undefined}
            badgeColor={C.amber} badgeBg={C.amberL}
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '1.5rem', alignItems: 'start' }}>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={hourlyData} barSize={14} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.gray100} vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: C.gray400, fontSize: 9, fontFamily: 'DM Mono, monospace' }}
                  axisLine={false} tickLine={false}
                  interval={1}
                />
                <YAxis tick={{ fill: C.gray400, fontSize: 10 }} axisLine={false} tickLine={false} width={24} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="sessions" name="Sessions" radius={[3,3,0,0]}>
                  {hourlyData.map((entry, i) => (
                    <Cell key={i}
                      fill={entry.hour === peakHour?.hour ? C.amber : C.indigo + 'BB'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            {/* Peak hours summary panel */}
            <div style={{ minWidth: 160, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* Top 3 peak hours */}
              {[...hourlyData].sort((a,b) => b.sessions - a.sessions).slice(0, 5).map((h, i) => (
                <div key={h.hour} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: i === 0 ? C.amberL : C.gray50,
                  border: `1px solid ${i === 0 ? C.amber + '44' : C.border}`,
                  borderRadius: 8, padding: '6px 10px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 10, color: i === 0 ? C.amber : C.gray400, fontWeight: 600 }}>#{i+1}</span>
                    <span style={{ fontSize: 12, fontFamily: 'DM Mono, monospace', color: C.gray700, fontWeight: 500 }}>{h.label}</span>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: i === 0 ? C.amber : C.gray600 }}>{h.sessions}</span>
                </div>
              ))}
              <div style={{ fontSize: 10, color: C.gray400, marginTop: 2, textAlign: 'center' }}>sessions per hour</div>
            </div>
          </div>

          {/* Day part summary */}
          {(() => {
            const morning   = hourlyData.slice(5, 12).reduce((a,b) => a + b.sessions, 0)
            const afternoon = hourlyData.slice(12, 17).reduce((a,b) => a + b.sessions, 0)
            const evening   = hourlyData.slice(17, 21).reduce((a,b) => a + b.sessions, 0)
            const night     = hourlyData.slice(21, 24).reduce((a,b) => a + b.sessions, 0) + hourlyData.slice(0, 5).reduce((a,b) => a + b.sessions, 0)
            const parts = [
              { label: '🌅 Morning',   sub: '5am–12pm', value: morning,   color: C.amber   },
              { label: '☀️ Afternoon', sub: '12pm–5pm', value: afternoon, color: C.orange  },
              { label: '🌆 Evening',   sub: '5pm–9pm',  value: evening,   color: C.indigo  },
              { label: '🌙 Night',     sub: '9pm–5am',  value: night,     color: C.violet  },
            ]
            const maxPart = Math.max(...parts.map(p => p.value))
            return (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginTop: '1rem', paddingTop: '0.875rem', borderTop: `1px solid ${C.gray100}` }}>
                {parts.map(p => (
                  <div key={p.label} style={{
                    background: p.value === maxPart ? p.color + '14' : C.gray50,
                    border: `1px solid ${p.value === maxPart ? p.color + '33' : C.border}`,
                    borderRadius: 10, padding: '0.75rem', textAlign: 'center',
                  }}>
                    <div style={{ fontSize: 11, color: C.gray600, fontWeight: 500, marginBottom: 4 }}>{p.label}</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 700, color: p.value === maxPart ? p.color : C.gray700 }}>{p.value}</div>
                    <div style={{ fontSize: 9, color: C.gray400, marginTop: 2 }}>{p.sub}</div>
                  </div>
                ))}
              </div>
            )
          })()}
        </Card>

        {/* INSIGHTS PANEL */}
        <Card style={{ marginBottom: '1rem' }}>
          <CardHeader
            title="Automatic Insights"
            sub="AI-detected patterns for faster marketing decisions"
            badge={`${insights.length} insights`}
          />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(270px,1fr))', gap: '0.65rem' }}>
            {insights.map((ins, i) => <InsightPill key={i} {...ins} />)}
          </div>
        </Card>

        {/* SESSIONS TABLE */}
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.875rem', flexWrap: 'wrap', gap: 8 }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.88rem', color: C.gray800 }}>Recent Sessions</div>
              <div style={{ fontSize: '0.7rem', color: C.gray400, marginTop: 1 }}>Click any row for session detail</div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: C.gray400 }}>🔍</span>
                <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search ID, page, source…"
                  style={{ ...inputStyle, paddingLeft: 28, width: 200 }} />
              </div>
              {/* CTA / Platform filter */}
              <select value={ctaFilter} onChange={e => setCtaFilter(e.target.value)} style={selectStyle}>
                {allCtaPlatforms.map(p => <option key={p}>{p}</option>)}
              </select>
              <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={selectStyle}>
                {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <span style={{ fontSize: 11, background: C.indigoL, color: C.indigo, padding: '3px 10px', borderRadius: 20, alignSelf: 'center', fontWeight: 500 }}>
                {filteredSessions.length}
              </span>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.gray100}` }}>
                  {['Session ID', 'Started', 'Device', 'Source', 'Clicks', 'Left At', 'CTA', 'Engagement'].map(h => (
                    <th key={h} style={{
                      color: C.gray400, fontSize: '0.66rem', textTransform: 'uppercase',
                      letterSpacing: '0.08em', padding: '0.45rem 0.7rem', textAlign: 'left',
                      fontWeight: 600, whiteSpace: 'nowrap',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageSessions.map(s => {
                  const sm     = summaryMap[s.id]
                  const device = parseDevice(s.user_agent)
                  const eng    = engagementLevel(sm)
                  const engSt  = engagementStyle(eng)
                  const leftAt = sm?.ended_at_ist
                    ? new Date(sm.ended_at_ist).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
                    : null
                  const ctaPlatforms = sessionCtaMap[s.id] ? Array.from(sessionCtaMap[s.id]) : []

                  return (
                    <tr key={s.id} onClick={() => navigate(`/session/${s.id}`)}
                      style={{ cursor: 'pointer', borderBottom: `1px solid ${C.gray100}`, transition: 'background 0.1s' }}
                      onMouseEnter={e => e.currentTarget.style.background = C.gray50}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={tdStyle}>
                        <span style={{ fontSize: '0.72rem', color: C.indigo, fontFamily: 'DM Mono, monospace', background: C.indigoL, padding: '2px 7px', borderRadius: 5 }}>
                          {s.id.slice(0, 8)}…
                        </span>
                      </td>
                      <td style={tdStyle}>
                        <div style={{ fontSize: '0.76rem', color: C.gray700, fontWeight: 500 }}>
                          {new Date(s.started_at_ist).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                        </div>
                        <div style={{ fontSize: '0.67rem', color: C.gray400, fontFamily: 'DM Mono, monospace' }}>
                          {new Date(s.started_at_ist).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>
                      <td style={tdStyle}>
                        <span style={{ fontSize: '0.76rem', color: C.gray700 }}>{parseDeviceIcon(device)} {device}</span>
                      </td>
                      <td style={tdStyle}>
                        <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 20, background: C.indigoL, color: C.indigo, fontWeight: 500 }}>
                          {parseReferrer(s.referrer)}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        {sm ? (
                          <span style={{
                            fontSize: 10, padding: '2px 7px', borderRadius: 20, fontWeight: 600,
                            background: Number(sm.click_count) > 0 ? C.amberL : C.gray100,
                            color:      Number(sm.click_count) > 0 ? C.amber   : C.gray400,
                          }}>{sm.click_count}</span>
                        ) : <span style={{ color: C.gray300, fontSize: '0.76rem' }}>—</span>}
                      </td>
                      <td style={tdStyle}>
                        <span style={{ fontSize: '0.72rem', color: leftAt ? C.gray600 : C.gray300, fontFamily: leftAt ? 'DM Mono, monospace' : 'inherit' }}>
                          {leftAt || '—'}
                        </span>
                      </td>
                      {/* CTA column — shows platform badges */}
                      <td style={tdStyle}>
                        {ctaPlatforms.length > 0 ? (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                            {ctaPlatforms.map(p => (
                              <span key={p} style={{
                                fontSize: 9, padding: '2px 6px', borderRadius: 4,
                                background: C.emeraldL, color: C.emerald, fontWeight: 600,
                              }}>{p}</span>
                            ))}
                          </div>
                        ) : (
                          <span style={{ color: C.gray300, fontSize: '0.72rem' }}>—</span>
                        )}
                      </td>
                      <td style={tdStyle}>
                        <span style={{
                          fontSize: 10, padding: '2px 7px', borderRadius: 20, fontWeight: 500,
                          background: engSt.bg, color: engSt.color,
                        }}>{eng}</span>
                      </td>
                    </tr>
                  )
                })}
                {pageSessions.length === 0 && (
                  <tr><td colSpan={8} style={{ textAlign: 'center', padding: '2.5rem', color: C.gray300, fontSize: '0.85rem' }}>No sessions match your filters</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: '0.875rem' }}>
              <button onClick={() => setPage(1)} disabled={page===1} style={paginBtnStyle(page===1)}>«</button>
              <button onClick={() => setPage(p=>p-1)} disabled={page===1} style={paginBtnStyle(page===1)}>Prev</button>
              <span style={{ fontSize: '0.78rem', color: C.gray500, fontFamily: 'DM Mono, monospace', padding: '0 6px' }}>{page} / {totalPages}</span>
              <button onClick={() => setPage(p=>p+1)} disabled={page>=totalPages} style={paginBtnStyle(page>=totalPages)}>Next</button>
              <button onClick={() => setPage(totalPages)} disabled={page>=totalPages} style={paginBtnStyle(page>=totalPages)}>»</button>
            </div>
          )}
        </Card>

      </div>
    </div>
  )
}

const selectStyle = {
  padding: '5px 10px', borderRadius: 8, border: `1px solid ${C.border}`,
  fontSize: '0.78rem', color: C.gray700, background: C.white,
  cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
}
const tabBtnStyle = {
  padding: '4px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
  fontSize: '0.76rem', fontWeight: 500, fontFamily: 'DM Sans, sans-serif',
  transition: 'all 0.15s',
}
const inputStyle = {
  padding: '5px 10px', borderRadius: 8, border: `1px solid ${C.border}`,
  fontSize: '0.78rem', color: C.gray700, background: C.white,
  fontFamily: 'DM Sans, sans-serif', outline: 'none',
}
const tdStyle = { padding: '0.6rem 0.7rem' }
