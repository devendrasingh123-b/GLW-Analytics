/**
 * GLW Analytics Dashboard — Professional Light Theme
 * Clean, white-card SaaS dashboard for marketing managers.
 * Redesigned from dark → light with improved UX, insights panel,
 * better charts, and decision-focused layout.
 */

import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar, CartesianGrid, Legend
} from 'recharts'

/* ─── Design Tokens ─── */
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

/* ─── Utility Functions ─── */
function parseDevice(ua) {
  if (!ua) return 'Unknown'
  if (/bot|crawl|spider|headless|vercel-screenshot/i.test(ua)) return 'Bot'
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

/* ─── Global Styles (injected once) ─── */
const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=DM+Mono:wght@400;500&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #F8FAFC; }
  ::-webkit-scrollbar { width: 5px; height: 5px; }
  ::-webkit-scrollbar-track { background: #F1F5F9; }
  ::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 3px; }
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes shimmer {
    0%   { background-position: -400px 0; }
    100% { background-position: 400px 0; }
  }
  @keyframes pulse-dot {
    0%, 100% { box-shadow: 0 0 0 0 rgba(5,150,105,0.5); }
    50%       { box-shadow: 0 0 0 5px rgba(5,150,105,0); }
  }
`

/* ─── Sub-components ─── */

/** Skeleton loader card */
function SkeletonCard() {
  return (
    <div style={{
      background: C.white, borderRadius: 12, border: `1px solid ${C.border}`,
      padding: '1.5rem', height: 110,
      backgroundImage: 'linear-gradient(90deg, #F1F5F9 25%, #E2E8F0 50%, #F1F5F9 75%)',
      backgroundSize: '400px 100%',
      animation: 'shimmer 1.4s infinite linear',
    }} />
  )
}

/** KPI card with color accent */
function KPICard({ label, value, sub, color, bgColor, icon, trend, onClick }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: C.white,
        borderRadius: 12,
        border: `1px solid ${hovered ? color : C.border}`,
        padding: '1.25rem 1.5rem',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'border-color 0.2s, box-shadow 0.2s, transform 0.2s',
        transform: hovered ? 'translateY(-2px)' : 'none',
        boxShadow: hovered ? `0 4px 20px ${color}22` : '0 1px 3px rgba(0,0,0,0.04)',
      }}
    >
      {/* Icon + Label row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
        <div style={{
          width: 36, height: 36, borderRadius: 8,
          background: bgColor, display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontSize: 16,
        }}>{icon}</div>
        {trend !== undefined && (
          <span style={{
            fontSize: 11, fontWeight: 600, fontFamily: 'DM Sans, sans-serif',
            color: trend >= 0 ? C.emerald : C.rose,
            background: trend >= 0 ? C.emeraldL : C.roseL,
            padding: '2px 8px', borderRadius: 20,
          }}>
            {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
          </span>
        )}
      </div>
      {/* Value */}
      <div style={{ color: C.gray900, fontSize: '1.75rem', fontWeight: 600, lineHeight: 1, fontFamily: 'DM Sans, sans-serif', letterSpacing: '-0.02em' }}>
        {value}
      </div>
      {/* Label */}
      <div style={{ color: C.gray500, fontSize: '0.8rem', marginTop: 4, fontFamily: 'DM Sans, sans-serif' }}>{label}</div>
      {sub && <div style={{ color: C.gray400, fontSize: '0.72rem', marginTop: 2, fontFamily: 'DM Sans, sans-serif' }}>{sub}</div>}
    </div>
  )
}

/** Chart wrapper card */
function ChartCard({ title, sub, badge, children, style = {} }) {
  return (
    <div style={{
      background: C.white, borderRadius: 12, border: `1px solid ${C.border}`,
      padding: '1.25rem 1.5rem',
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      ...style,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
        <div>
          <div style={{ color: C.gray800, fontWeight: 600, fontSize: '0.9rem', fontFamily: 'DM Sans, sans-serif' }}>{title}</div>
          {sub && <div style={{ color: C.gray400, fontSize: '0.75rem', marginTop: 2, fontFamily: 'DM Sans, sans-serif' }}>{sub}</div>}
        </div>
        {badge && (
          <span style={{ fontSize: 11, background: C.indigoL, color: C.indigo, padding: '3px 10px', borderRadius: 20, fontFamily: 'DM Sans, sans-serif', fontWeight: 500 }}>
            {badge}
          </span>
        )}
      </div>
      {children}
    </div>
  )
}

/** Custom tooltip for recharts */
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: C.white, border: `1px solid ${C.border}`,
      borderRadius: 8, padding: '8px 12px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
      fontFamily: 'DM Sans, sans-serif', fontSize: 12,
    }}>
      {label && <div style={{ color: C.gray500, marginBottom: 4 }}>{label}</div>}
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color || C.gray800, fontWeight: 500 }}>
          {p.name ? `${p.name}: ` : ''}{p.value}
        </div>
      ))}
    </div>
  )
}

/** Insight pill — auto-generated marketing insight */
function InsightPill({ type, text, color, bg }) {
  const icons = { warning: '⚠️', success: '✅', info: 'ℹ️', tip: '💡' }
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 10,
      background: bg, border: `1px solid ${color}33`,
      borderRadius: 10, padding: '0.75rem 1rem',
    }}>
      <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>{icons[type] || '💡'}</span>
      <p style={{ color: C.gray700, fontSize: '0.82rem', lineHeight: 1.5, fontFamily: 'DM Sans, sans-serif' }}>{text}</p>
    </div>
  )
}

/* ─── Date Filter Tabs ─── */
const DATE_FILTERS = [
  { label: '7D',  value: 7  },
  { label: '14D', value: 14 },
  { label: '30D', value: 30 },
  { label: 'All', value: 0  },
]

const CHART_COLORS = [C.indigo, C.violet, C.cyan, C.emerald, C.amber]

/* ═══════════════════════════════════════════════
   MAIN DASHBOARD COMPONENT
═══════════════════════════════════════════════ */
export default function Dashboard() {
  const navigate = useNavigate()

  /* ── State ── */
  const [allSessions, setAllSessions] = useState([])
  const [allSummary,  setAllSummary]  = useState([])
  const [allClicks,   setAllClicks]   = useState([])
  const [loading,     setLoading]     = useState(true)
  const [lastUpdate,  setLastUpdate]  = useState(new Date())
  const [liveFlash,   setLiveFlash]   = useState(false)
  const [days,        setDays]        = useState(30)
  const [page,        setPage]        = useState(1)
  const [deviceFilter, setDeviceFilter] = useState('All')
  const LIMIT = 15

  /* ── Data fetch ── */
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
    const ch = supabase.channel('glw-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'glw_sessions'        }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'glw_session_summary' }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'glw_click_events'    }, fetchData)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [])

  /* ── Filtered data (date + device) ── */
  const sessions = useMemo(() => {
    let s = allSessions
    if (days) {
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() - days)
      s = s.filter(x => new Date(x.started_at_ist) >= cutoff)
    }
    if (deviceFilter !== 'All') {
      s = s.filter(x => parseDevice(x.user_agent) === deviceFilter)
    }
    return s
  }, [allSessions, days, deviceFilter])

  const sessionIds = useMemo(() => new Set(sessions.map(s => s.id)), [sessions])

  const summary = useMemo(() =>
    allSummary.filter(s => sessionIds.has(s.session_id)), [allSummary, sessionIds])

  const clicks = useMemo(() =>
    allClicks.filter(c => sessionIds.has(c.session_id)), [allClicks, sessionIds])

  const summaryMap = useMemo(() => {
    const m = {}
    summary.forEach(s => { m[s.session_id] = s })
    return m
  }, [summary])

  /* ── KPI calculations ── */
  const totalSessions  = sessions.length
  const realSessions   = sessions.filter(s => parseDevice(s.user_agent) !== 'Bot')
  const botSessions    = totalSessions - realSessions.length

  const avgTime = summary.length
    ? Math.round(summary.reduce((a, b) => a + Number(b.time_on_page_ms), 0) / summary.length / 1000)
    : 0

  const totalClicks = summary.reduce((a, b) => a + Number(b.click_count), 0)

  const bounceSessions = sessions.filter(s => {
    const sm = summaryMap[s.id]
    return !sm || Number(sm.click_count) === 0
  }).length
  const bounceRate = totalSessions ? Math.round((bounceSessions / totalSessions) * 100) : 0

  const engagedSessions = summary.filter(s =>
    Number(s.max_scroll_depth) > 0.5 && Number(s.time_on_page_ms) > 20000
  ).length
  const engagementRate = totalSessions ? Math.round((engagedSessions / totalSessions) * 100) : 0

  /* ── Chart data ── */
  const dailyData = useMemo(() => {
    const m = {}
    sessions.forEach(s => {
      const d = s.started_at_ist?.slice(0, 10)
      if (d) m[d] = (m[d] || 0) + 1
    })
    return Object.entries(m)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, visitors]) => ({ date: date.slice(5), visitors }))
  }, [sessions])

  const deviceData = useMemo(() => {
    const m = {}
    sessions.forEach(s => { const d = parseDevice(s.user_agent); m[d] = (m[d] || 0) + 1 })
    return Object.entries(m).map(([name, value]) => ({ name, value }))
  }, [sessions])

  const refData = useMemo(() => {
    const m = {}
    sessions.forEach(s => { const r = parseReferrer(s.referrer); m[r] = (m[r] || 0) + 1 })
    return Object.entries(m)
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count)
  }, [sessions])

  const clickMap = useMemo(() => {
    const m = {}
    clicks.forEach(c => { if (c.target_text) m[c.target_text] = (m[c.target_text] || 0) + 1 })
    return m
  }, [clicks])

  const clickData = useMemo(() =>
    Object.entries(clickMap)
      .map(([name, value]) => ({ name: name.length > 22 ? name.slice(0, 22) + '…' : name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 7),
    [clickMap]
  )

  /* ── Auto-generated insights ── */
  const insights = useMemo(() => {
    const ins = []
    const mobileCount = sessions.filter(s => parseDevice(s.user_agent) === 'Mobile').length
    const mobilePct   = totalSessions ? Math.round((mobileCount / totalSessions) * 100) : 0

    if (mobilePct >= 50)
      ins.push({ type: 'info', bg: C.cyanL,    text: `${mobilePct}% of visitors are on mobile. Make sure your CTAs are thumb-friendly and above the fold.` })

    if (bounceRate >= 60)
      ins.push({ type: 'warning', bg: C.amberL, text: `High bounce rate (${bounceRate}%). Many users leave without clicking anything — consider a stronger above-fold hook.` })
    else if (bounceRate < 30)
      ins.push({ type: 'success', bg: C.emeraldL, text: `Low bounce rate (${bounceRate}%) — visitors are engaging well with the page content.` })

    if (avgTime < 10 && avgTime > 0)
      ins.push({ type: 'warning', bg: C.roseL, text: `Average time on page is only ${avgTime}s. Users may be leaving before absorbing the value proposition.` })

    if (engagementRate >= 40)
      ins.push({ type: 'success', bg: C.emeraldL, text: `${engagementRate}% of sessions are highly engaged (scroll > 50% + 20s+ on page). Great content depth!` })

    const topClicked = Object.entries(clickMap).sort((a, b) => b[1] - a[1])[0]
    if (topClicked)
      ins.push({ type: 'tip', bg: C.indigoL, text: `"${topClicked[0]}" is your most-clicked element (${topClicked[1]} clicks). Consider A/B testing copy or placement.` })

    if (botSessions > totalSessions * 0.2)
      ins.push({ type: 'warning', bg: C.amberL, text: `${botSessions} bot/crawler sessions detected (${Math.round(botSessions/totalSessions*100)}%). Exclude bots from ad reports.` })

    if (ins.length === 0)
      ins.push({ type: 'info', bg: C.gray100, text: 'Not enough data yet to generate insights. Check back once more sessions are recorded.' })

    return ins
  }, [sessions, bounceRate, engagementRate, avgTime, clickMap, botSessions, totalSessions])

  /* ── Session table pagination ── */
  const totalPages  = Math.ceil(sessions.length / LIMIT)
  const pageSessions = sessions.slice((page - 1) * LIMIT, page * LIMIT)

  /* ═══ RENDER ═══ */
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: C.gray50, padding: '2rem', fontFamily: 'DM Sans, sans-serif' }}>
        <style>{GLOBAL_CSS}</style>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ height: 60, background: C.white, borderRadius: 12, border: `1px solid ${C.border}`, marginBottom: '2rem' }} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: '1rem', marginBottom: '2rem' }}>
            {[1,2,3,4,5].map(i => <SkeletonCard key={i} />)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
            <SkeletonCard />
            <SkeletonCard />
          </div>
        </div>
      </div>
    )
  }

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
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 8,
            background: `linear-gradient(135deg, ${C.indigo}, ${C.violet})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, color: C.white, fontWeight: 700,
          }}>G</div>
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.9rem', color: C.gray900, lineHeight: 1.2 }}>GLW Analytics</div>
            <div style={{ fontSize: '0.68rem', color: C.gray400 }}>Marketing Intelligence</div>
          </div>
        </div>

        {/* Live indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%', background: C.emerald, flexShrink: 0,
            animation: liveFlash ? 'pulse-dot 0.8s ease' : 'pulse-dot 2s infinite',
          }} />
          <span style={{ fontSize: '0.75rem', color: C.gray500 }}>
            Live · updated {lastUpdate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </nav>

      {/* ── PAGE CONTENT ── */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '1.5rem', animation: 'fadeUp 0.35s ease' }}>

        {/* ── HEADER + FILTERS ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 600, color: C.gray900, letterSpacing: '-0.02em' }}>Dashboard Overview</h1>
            <p style={{ fontSize: '0.78rem', color: C.gray400, marginTop: 2 }}>
              {totalSessions} sessions · {realSessions.length} real users
            </p>
          </div>

          {/* Date filter + Device filter */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Device filter */}
            <select
              value={deviceFilter}
              onChange={e => { setDeviceFilter(e.target.value); setPage(1) }}
              style={{
                padding: '6px 12px', borderRadius: 8, border: `1px solid ${C.border}`,
                fontSize: '0.8rem', color: C.gray700, background: C.white, cursor: 'pointer',
                fontFamily: 'DM Sans, sans-serif',
              }}
            >
              {['All', 'Desktop', 'Mobile', 'Tablet', 'Bot'].map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>

            {/* Date tabs */}
            <div style={{ display: 'flex', gap: 4, background: C.gray100, padding: 4, borderRadius: 10 }}>
              {DATE_FILTERS.map(f => (
                <button key={f.value} onClick={() => { setDays(f.value); setPage(1) }} style={{
                  padding: '5px 14px', borderRadius: 7, border: 'none', cursor: 'pointer',
                  fontSize: '0.78rem', fontWeight: 500, fontFamily: 'DM Sans, sans-serif',
                  background: days === f.value ? C.white : 'transparent',
                  color:      days === f.value ? C.gray900 : C.gray500,
                  boxShadow:  days === f.value ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  transition: 'all 0.15s',
                }}>{f.label}</button>
              ))}
            </div>
          </div>
        </div>

        {/* ── KPI CARDS (5 metrics) ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: '1rem', marginBottom: '1.25rem' }}>
          <KPICard icon="👥" label="Total Sessions"   value={totalSessions}      sub={`${realSessions.length} real users`}      color={C.indigo}   bgColor={C.indigoL}   />
          <KPICard icon="⏱️" label="Avg Time on Page" value={`${avgTime}s`}      sub="per session"                              color={C.violet}   bgColor={C.violetL}   />
          <KPICard icon="🖱️" label="Total Clicks"     value={totalClicks}        sub="user interactions"                        color={C.cyan}     bgColor={C.cyanL}     />
          <KPICard icon="↩️" label="Bounce Rate"      value={`${bounceRate}%`}   sub={`${bounceSessions} no-click sessions`}    color={bounceRate > 60 ? C.rose : C.emerald} bgColor={bounceRate > 60 ? C.roseL : C.emeraldL} />
          <KPICard icon="🔥" label="Engagement Rate"  value={`${engagementRate}%`} sub="scroll>50% & 20s+"                     color={C.emerald}  bgColor={C.emeraldL}  />
        </div>

        {/* ── CHARTS ROW 1: Daily visitors + Device pie ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
          <ChartCard title="Daily Visitors" sub={`Trend over selected period`} badge={`${days || 'All'} days`}>
            <ResponsiveContainer width="100%" height={210}>
              <LineChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.gray100} />
                <XAxis dataKey="date" tick={{ fill: C.gray400, fontSize: 11, fontFamily: 'DM Mono, monospace' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: C.gray400, fontSize: 11, fontFamily: 'DM Mono, monospace' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone" dataKey="visitors" name="Visitors"
                  stroke={C.indigo} strokeWidth={2.5}
                  dot={{ fill: C.indigo, r: 3, strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: C.indigo, stroke: C.white, strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Device Breakdown" sub="Session distribution">
            <ResponsiveContainer width="100%" height={210}>
              <PieChart>
                <Pie
                  data={deviceData} dataKey="value" nameKey="name"
                  cx="50%" cy="50%" outerRadius={75} innerRadius={38}
                  paddingAngle={3}
                >
                  {deviceData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} stroke="none" />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  iconType="circle" iconSize={8}
                  formatter={v => <span style={{ color: C.gray600, fontSize: 12, fontFamily: 'DM Sans, sans-serif' }}>{v}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        {/* ── CHARTS ROW 2: Traffic sources + Top clicks ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
          <ChartCard title="Traffic Sources" sub="Where visitors are coming from">
            <ResponsiveContainer width="100%" height={190}>
              <BarChart data={refData} layout="vertical" barSize={14}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.gray100} horizontal={false} />
                <XAxis type="number" tick={{ fill: C.gray400, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="source" tick={{ fill: C.gray600, fontSize: 12, fontFamily: 'DM Sans, sans-serif' }} axisLine={false} tickLine={false} width={58} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" name="Sessions" fill={C.violet} radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Top Clicked Elements" sub="Most interacted buttons & links">
            {clickData.length === 0 ? (
              <div style={{ color: C.gray400, textAlign: 'center', padding: '2.5rem', fontSize: '0.85rem' }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>🖱️</div>
                No click data yet
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={190}>
                <BarChart data={clickData} layout="vertical" barSize={14}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.gray100} horizontal={false} />
                  <XAxis type="number" tick={{ fill: C.gray400, fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fill: C.gray600, fontSize: 11, fontFamily: 'DM Sans, sans-serif' }} axisLine={false} tickLine={false} width={110} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="value" name="Clicks" fill={C.cyan} radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </div>

        {/* ── INSIGHTS PANEL ── */}
        <div style={{
          background: C.white, borderRadius: 12, border: `1px solid ${C.border}`,
          padding: '1.25rem 1.5rem', marginBottom: '1rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1rem' }}>
            <span style={{ fontSize: 16 }}>💡</span>
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.9rem', color: C.gray800 }}>Automatic Insights</div>
              <div style={{ fontSize: '0.72rem', color: C.gray400 }}>AI-detected patterns to help you make faster decisions</div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '0.75rem' }}>
            {insights.map((ins, i) => (
              <InsightPill key={i} {...ins} />
            ))}
          </div>
        </div>

        {/* ── SESSIONS TABLE ── */}
        <div style={{
          background: C.white, borderRadius: 12, border: `1px solid ${C.border}`,
          padding: '1.25rem 1.5rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}>
          {/* Table header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.9rem', color: C.gray800 }}>Recent Sessions</div>
              <div style={{ fontSize: '0.72rem', color: C.gray400, marginTop: 2 }}>Click any row to view session detail</div>
            </div>
            <span style={{
              fontSize: 11, background: C.indigoL, color: C.indigo,
              padding: '3px 10px', borderRadius: 20, fontWeight: 500,
            }}>{sessions.length} sessions</span>
          </div>

          {/* Table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.gray100}` }}>
                  {['Time', 'Device', 'Source', 'Referrer', 'Page', 'Duration', 'Scroll %', 'Clicks'].map(h => (
                    <th key={h} style={{
                      color: C.gray400, fontSize: '0.68rem', textTransform: 'uppercase',
                      letterSpacing: '0.08em', padding: '0.5rem 0.75rem', textAlign: 'left',
                      fontWeight: 600, fontFamily: 'DM Sans, sans-serif',
                      whiteSpace: 'nowrap',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageSessions.map((s, i) => {
                  const sm = summaryMap[s.id]
                  const device = parseDevice(s.user_agent)
                  const deviceIcon = { Mobile: '📱', Desktop: '💻', Bot: '🤖', Tablet: '📟', Unknown: '❓' }[device] || '❓'
                  const scrollPct = sm ? Math.round(Number(sm.max_scroll_depth) * 100) : null
                  const scrollColor = scrollPct >= 75 ? C.emerald : scrollPct >= 40 ? C.amber : C.rose

                  return (
                    <tr
                      key={s.id}
                      onClick={() => navigate(`/session/${s.id}`)}
                      style={{
                        cursor: 'pointer',
                        borderBottom: `1px solid ${C.gray100}`,
                        transition: 'background 0.12s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = C.gray50}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      {/* Time */}
                      <td style={{ padding: '0.7rem 0.75rem', whiteSpace: 'nowrap' }}>
                        <div style={{ fontSize: '0.78rem', color: C.gray700, fontWeight: 500 }}>
                          {new Date(s.started_at_ist).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                        </div>
                        <div style={{ fontSize: '0.68rem', color: C.gray400, fontFamily: 'DM Mono, monospace', marginTop: 1 }}>
                          {new Date(s.started_at_ist).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>
                      {/* Device */}
                      <td style={{ padding: '0.7rem 0.75rem', fontSize: '0.78rem', color: C.gray700 }}>
                        {deviceIcon} {device}
                      </td>
                      {/* Source */}
                      <td style={{ padding: '0.7rem 0.75rem' }}>
                        <span style={{
                          fontSize: 11, padding: '2px 8px', borderRadius: 20,
                          background: C.indigoL, color: C.indigo, fontWeight: 500,
                        }}>{parseReferrer(s.referrer)}</span>
                      </td>
                      {/* Referrer URL */}
                      <td style={{
                        padding: '0.7rem 0.75rem', fontSize: '0.72rem', color: C.gray400,
                        maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        fontFamily: 'DM Mono, monospace',
                      }}>
                        {s.referrer || '—'}
                      </td>
                      {/* Page */}
                      <td style={{
                        padding: '0.7rem 0.75rem', fontSize: '0.78rem', color: C.gray600,
                        maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        fontFamily: 'DM Mono, monospace',
                      }}>
                        {s.path || '/'}
                      </td>
                      {/* Duration */}
                      <td style={{ padding: '0.7rem 0.75rem', fontSize: '0.78rem', color: sm ? C.violet : C.gray300, fontWeight: sm ? 600 : 400 }}>
                        {sm ? `${Math.round(Number(sm.time_on_page_ms) / 1000)}s` : '—'}
                      </td>
                      {/* Scroll bar */}
                      <td style={{ padding: '0.7rem 0.75rem' }}>
                        {sm ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ width: 48, height: 4, background: C.gray100, borderRadius: 2, overflow: 'hidden' }}>
                              <div style={{ width: `${scrollPct}%`, height: 4, background: scrollColor, borderRadius: 2 }} />
                            </div>
                            <span style={{ fontSize: '0.7rem', color: scrollColor, fontWeight: 600, minWidth: 28 }}>
                              {scrollPct}%
                            </span>
                          </div>
                        ) : '—'}
                      </td>
                      {/* Click count badge */}
                      <td style={{ padding: '0.7rem 0.75rem' }}>
                        {sm ? (
                          <span style={{
                            display: 'inline-block', minWidth: 24, textAlign: 'center',
                            fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 20,
                            background: Number(sm.click_count) > 0 ? C.amberL : C.gray100,
                            color:      Number(sm.click_count) > 0 ? C.amber   : C.gray400,
                          }}>{sm.click_count}</span>
                        ) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: '1rem' }}>
              <button onClick={() => setPage(1)} disabled={page === 1} style={paginBtn(page === 1)}>«</button>
              <button onClick={() => setPage(p => p - 1)} disabled={page === 1} style={paginBtn(page === 1)}>Prev</button>
              <span style={{ fontSize: '0.8rem', color: C.gray500, padding: '0 8px', fontFamily: 'DM Mono, monospace' }}>
                {page} / {totalPages}
              </span>
              <button onClick={() => setPage(p => p + 1)} disabled={page >= totalPages} style={paginBtn(page >= totalPages)}>Next</button>
              <button onClick={() => setPage(totalPages)} disabled={page >= totalPages} style={paginBtn(page >= totalPages)}>»</button>
            </div>
          )}
        </div>

      </div>{/* /page content */}
    </div>
  )
}

/* ── Pagination button helper ── */
function paginBtn(disabled) {
  return {
    padding: '5px 14px', borderRadius: 8,
    border: `1px solid ${disabled ? C.gray200 : C.border}`,
    background: disabled ? C.gray50 : C.white,
    color: disabled ? C.gray300 : C.gray600,
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontSize: '0.8rem', fontFamily: 'DM Sans, sans-serif',
    transition: 'all 0.15s',
  }
}
