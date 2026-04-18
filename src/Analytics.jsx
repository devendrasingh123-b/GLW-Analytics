/**
 * Analytics.jsx — GLW Analytics v4
 * Deep Dive page — all fixes applied:
 *  • KPI strip: responsive auto-fit grid
 *  • Click tab: platform-only display (no BUY NOW, no products, no URLs in text view)
 *  • By URL tab: proper layout, truncated URLs, single-column clean list
 *  • Engagement tab: unique insights (not duplicated from Dashboard)
 *  • Full responsive CSS — production-grade
 */

import { useState, useEffect, useMemo, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, PieChart, Pie, Cell, Legend,
  LineChart, Line,
} from 'recharts'
import { supabase } from './supabaseClient'
import {
  C, GLOBAL_CSS, CHART_COLORS, CustomTooltip,
  parseDevice, parseDeviceIcon, parseReferrer,
  engagementLevel, engagementStyle, isCTA,
  filterByDays, buildPageStats, buildClickStats, buildHourlyStats, generateInsights,
  Card, CardHeader, KPICard, InsightPill,
  SkeletonCard, paginBtnStyle,
} from './analyticsUtils'

// ── Constants ─────────────────────────────────────────
const DATE_FILTERS = [
  { label: '7D', value: 7 }, { label: '14D', value: 14 },
  { label: '30D', value: 30 }, { label: 'All', value: 0 },
]
const TABS = [
  { id: 'pages',      label: '📄 Pages'      },
  { id: 'clicks',     label: '🖱️ Clicks'     },
  { id: 'engagement', label: '🔥 Engagement' },
  { id: 'traffic',    label: '🌐 Traffic'    },
  { id: 'hours',      label: '⏰ Peak Hours' },
  { id: 'sessions',   label: '📋 Sessions'   },
]
const PLATFORM_LIST = ['Amazon','Flipkart','Blinkit','Zepto','Instamart','Aromahpure','Vercel']
const LIMIT = 20

// Extract clean platform name from raw CTA text
function extractPlatform(text) {
  if (!text) return null
  const cleaned = text.replace(/buy now/gi,'').replace(/buy/gi,'').replace(/\s+/g,' ').trim()
  if (!cleaned || cleaned.length > 30) return null
  return PLATFORM_LIST.find(p => cleaned.toLowerCase().includes(p.toLowerCase())) || null
}

// ── Sub-components ─────────────────────────────────────
function SectionHeading({ children, sub }) {
  return (
    <div style={{ marginBottom: '1rem' }}>
      <h2 style={{ fontSize: '1rem', fontWeight: 600, color: C.gray900 }}>{children}</h2>
      {sub && <p style={{ fontSize: '0.75rem', color: C.gray400, marginTop: 2 }}>{sub}</p>}
    </div>
  )
}

function BarRow({ label, value, max, color, sub }) {
  const pct = max ? Math.round((value / max) * 100) : 0
  return (
    <div style={{ marginBottom: '0.55rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3, gap: 8 }}>
        <span style={{
          fontSize: '0.78rem', color: C.gray700,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
        }}>{label}</span>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          {sub && <span style={{ fontSize: '0.7rem', color: C.gray400 }}>{sub}</span>}
          <span style={{ fontSize: '0.78rem', fontWeight: 600, color }}>{value.toLocaleString()}</span>
        </div>
      </div>
      <div style={{ background: C.gray100, borderRadius: 4, height: 5, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: 5, background: color, borderRadius: 4, transition: 'width 0.6s ease' }} />
      </div>
    </div>
  )
}

function StatCell({ value, color, sub }) {
  return (
    <td style={{ padding: '0.55rem 0.75rem', whiteSpace: 'nowrap' }}>
      <div style={{ fontSize: '0.82rem', fontWeight: 600, color: color || C.gray700 }}>{value}</div>
      {sub && <div style={{ fontSize: '0.67rem', color: C.gray400 }}>{sub}</div>}
    </td>
  )
}

function TagBadge({ name, value, color, bg }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      background: bg, borderRadius: 8, padding: '0.5rem 0.85rem',
      border: `1px solid ${color}22`,
    }}>
      <span style={{ fontSize: '0.82rem', color: C.gray700, fontWeight: 500 }}>{name}</span>
      <span style={{ fontSize: '0.82rem', fontWeight: 600, color }}>{value.toLocaleString()}</span>
    </div>
  )
}

// Platform bar row — clean simple bar like Traffic Sources
function PlatformRow({ name, value, max, color, bg, rank }) {
  const pct = max ? Math.round((value / max) * 100) : 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
      <span style={{ fontSize: 10, color: C.gray400, fontFamily: 'DM Mono, monospace', width: 18, textAlign: 'right', flexShrink: 0 }}>
        #{rank}
      </span>
      <span style={{ fontSize: '0.8rem', color: C.gray700, fontWeight: 500, minWidth: 80, flexShrink: 0 }}>{name}</span>
      <div style={{ flex: 1, background: C.gray100, borderRadius: 4, height: 8, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: 8, background: color, borderRadius: 4, transition: 'width 0.6s ease' }} />
      </div>
      <span style={{ fontSize: '0.8rem', fontWeight: 600, color, width: 24, textAlign: 'right', flexShrink: 0 }}>{value}</span>
    </div>
  )
}

function exportCSV(sessions, summaryMap) {
  const headers = ['Time','Device','Source','Referrer','Page','Duration (s)','Max Scroll %','Clicks','Engagement']
  const rows = sessions.map(s => {
    const sm  = summaryMap[s.id]
    const dur = sm ? Math.round(Number(sm.time_on_page_ms)/1000) : ''
    const sc  = sm ? Math.round(Number(sm.max_scroll_depth)*100) : ''
    return [
      new Date(s.started_at_ist).toLocaleString(),
      parseDevice(s.user_agent),
      parseReferrer(s.referrer),
      s.referrer || '',
      s.path || '/',
      dur, sc,
      sm?.click_count || '',
      engagementLevel(sm),
    ].map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')
  })
  const blob = new Blob([[headers.join(','), ...rows].join('\n')], { type: 'text/csv' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `glw-sessions-${new Date().toISOString().slice(0,10)}.csv`
  a.click()
}

// ── Unique engagement-only insights ───────────────────
function generateEngagementInsights({ sessions, summaryMap, clicks }) {
  const ins = []
  const total = sessions.length
  if (!total) return [{ type: 'info', icon: 'ℹ️', text: 'Not enough data for engagement insights yet.' }]

  const summaries = Object.values(summaryMap)

  // Scroll depth distribution
  const deep   = summaries.filter(s => Number(s.max_scroll_depth) >= 0.75).length
  const mid    = summaries.filter(s => Number(s.max_scroll_depth) >= 0.4 && Number(s.max_scroll_depth) < 0.75).length
  const shallow= summaries.filter(s => Number(s.max_scroll_depth) < 0.4).length
  if (summaries.length) {
    const deepPct = Math.round(deep/summaries.length*100)
    if (deepPct >= 40)
      ins.push({ type: 'success', icon: '📜', text: `${deepPct}% of tracked sessions scroll past 75% of the page — strong content depth. Your lower sections are being seen.` })
    else if (deepPct < 20)
      ins.push({ type: 'warning', icon: '📜', text: `Only ${deepPct}% of sessions reach 75% scroll depth. Most users leave before the bottom — move your key CTAs higher up.` })
  }

  // Sessions with zero clicks
  const noClickSessions = summaries.filter(s => Number(s.click_count) === 0).length
  const noClickPct = summaries.length ? Math.round(noClickSessions/summaries.length*100) : 0
  if (noClickPct >= 50)
    ins.push({ type: 'warning', icon: '🖱️', text: `${noClickPct}% of sessions have zero clicks. Users are reading but not interacting — add more clickable CTAs in the content body.` })
  else if (noClickPct <= 20)
    ins.push({ type: 'success', icon: '🖱️', text: `${100-noClickPct}% of sessions have at least one click — excellent interaction rate. Your page is prompting action effectively.` })

  // Avg clicks per session
  const avgClicks = summaries.length ? (summaries.reduce((a,b) => a+Number(b.click_count),0)/summaries.length).toFixed(1) : 0
  if (Number(avgClicks) >= 3)
    ins.push({ type: 'success', icon: '✅', text: `Average of ${avgClicks} clicks per session — users are actively exploring multiple elements. Good sign for purchase intent.` })
  else if (Number(avgClicks) < 1.5 && summaries.length > 3)
    ins.push({ type: 'tip', icon: '💡', text: `Avg ${avgClicks} clicks/session is low. Consider adding internal links, product comparisons, or "related products" sections to increase engagement depth.` })

  // Long session (>2 min) %
  const longSessions = summaries.filter(s => Number(s.time_on_page_ms) >= 120000).length
  const longPct = summaries.length ? Math.round(longSessions/summaries.length*100) : 0
  if (longPct >= 25)
    ins.push({ type: 'success', icon: '⏳', text: `${longPct}% of sessions last 2+ minutes — high-value visitors spending real time. These are your warmest leads.` })

  // Short sessions (<10s)
  const quickLeave = summaries.filter(s => Number(s.time_on_page_ms) < 10000).length
  const quickPct   = summaries.length ? Math.round(quickLeave/summaries.length*100) : 0
  if (quickPct >= 35)
    ins.push({ type: 'warning', icon: '⚡', text: `${quickPct}% of sessions end within 10 seconds — immediate drop-off. Check page load speed and first-screen content relevance.` })

  // High engagement (scroll > 70% AND time > 30s) vs CTA click rate
  const highEngaged = summaries.filter(s => Number(s.max_scroll_depth) > 0.7 && Number(s.time_on_page_ms) > 30000).length
  const ctaClickers = clicks.filter(c => isCTA(c.target_text || ''))
  const uniqueCTASessions = new Set(ctaClickers.map(c => c.session_id)).size
  if (highEngaged > 0) {
    const convRate = Math.round(uniqueCTASessions/highEngaged*100)
    if (convRate >= 60)
      ins.push({ type: 'success', icon: '🎯', text: `${convRate}% of highly-engaged sessions led to a CTA click — strong conversion from engaged visitors.` })
    else if (convRate < 30)
      ins.push({ type: 'warning', icon: '🎯', text: `Only ${convRate}% of deeply-engaged sessions result in a CTA click. Consider adding platform links at the 70% scroll mark.` })
  }

  // Mobile engagement vs desktop
  const mobileSessions = sessions.filter(s => parseDevice(s.user_agent) === 'Mobile')
  const desktopSessions = sessions.filter(s => parseDevice(s.user_agent) === 'Desktop')
  const mobileAvgScroll = mobileSessions.length
    ? mobileSessions.reduce((a,s) => a + Number(summaryMap[s.id]?.max_scroll_depth||0),0)/mobileSessions.length
    : 0
  const desktopAvgScroll = desktopSessions.length
    ? desktopSessions.reduce((a,s) => a + Number(summaryMap[s.id]?.max_scroll_depth||0),0)/desktopSessions.length
    : 0
  if (mobileSessions.length > 2 && desktopSessions.length > 2) {
    const diff = Math.abs(Math.round(mobileAvgScroll*100) - Math.round(desktopAvgScroll*100))
    if (diff >= 15) {
      const higher = mobileAvgScroll > desktopAvgScroll ? 'Mobile' : 'Desktop'
      const lower  = higher === 'Mobile' ? 'Desktop' : 'Mobile'
      ins.push({ type: 'tip', icon: '📱', text: `${higher} users scroll ${diff}% deeper on average than ${lower} users. Optimize ${lower.toLowerCase()} layout — content may not be well-adapted for that device.` })
    }
  }

  if (ins.length === 0)
    ins.push({ type: 'info', icon: 'ℹ️', text: 'Engagement looks balanced. Keep monitoring as more sessions come in for deeper insights.' })

  return ins
}

// ═══════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════
export default function Analytics() {
  const navigate = useNavigate()

  const [allSessions, setAllSessions] = useState([])
  const [allSummary,  setAllSummary]  = useState([])
  const [allClicks,   setAllClicks]   = useState([])
  const [loading,     setLoading]     = useState(true)
  const [lastUpdate,  setLastUpdate]  = useState(new Date())
  const [liveFlash,   setLiveFlash]   = useState(false)

  const [activeTab,    setActiveTab]    = useState('pages')
  const [days,         setDays]         = useState(30)
  const [deviceFilter, setDeviceFilter] = useState('All')
  const [sourceFilter, setSourceFilter] = useState('All')
  const [searchQuery,  setSearchQuery]  = useState('')
  const [sortBy,       setSortBy]       = useState('time_desc')
  const [page,         setPage]         = useState(1)
  const [clickSubTab,  setClickSubTab]  = useState('platforms')

  const fetchData = useCallback(async () => {
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
  }, [])

  useEffect(() => {
    fetchData()
    const ch = supabase.channel('glw-analytics')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'glw_sessions'        }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'glw_session_summary' }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'glw_click_events'    }, fetchData)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [fetchData])

  const sessions = useMemo(() => {
    let s = filterByDays(allSessions, days)
    if (deviceFilter !== 'All') s = s.filter(x => parseDevice(x.user_agent) === deviceFilter)
    if (sourceFilter !== 'All') s = s.filter(x => parseReferrer(x.referrer) === sourceFilter)
    return s
  }, [allSessions, days, deviceFilter, sourceFilter])

  const sessionIds  = useMemo(() => new Set(sessions.map(s => s.id)), [sessions])
  const summary     = useMemo(() => allSummary.filter(s => sessionIds.has(s.session_id)), [allSummary, sessionIds])
  const clicks      = useMemo(() => allClicks.filter(c => sessionIds.has(c.session_id)), [allClicks, sessionIds])
  const summaryMap  = useMemo(() => { const m = {}; summary.forEach(s => { m[s.session_id] = s }); return m }, [summary])

  const pageStats       = useMemo(() => buildPageStats(sessions, summaryMap), [sessions, summaryMap])
  const clickStats      = useMemo(() => buildClickStats(clicks), [clicks])
  const engagementInsights = useMemo(() => generateEngagementInsights({ sessions, summaryMap, clicks }), [sessions, summaryMap, clicks])

  // KPIs
  const totalSessions  = sessions.length
  const realSessions   = sessions.filter(s => parseDevice(s.user_agent) !== 'Bot').length
  const avgTime = summary.length ? Math.round(summary.reduce((a,b) => a+Number(b.time_on_page_ms),0)/summary.length/1000) : 0
  const totalClicks = summary.reduce((a,b) => a+Number(b.click_count),0)
  const bouncedCount   = sessions.filter(s => { const sm = summaryMap[s.id]; return !sm||Number(sm.click_count)===0 }).length
  const bounceRate     = totalSessions ? Math.round(bouncedCount/totalSessions*100) : 0
  const engagedCount   = summary.filter(s => Number(s.max_scroll_depth)>0.5&&Number(s.time_on_page_ms)>20000).length
  const engagementRate = totalSessions ? Math.round(engagedCount/totalSessions*100) : 0
  const ctaCount       = clicks.filter(c => isCTA(c.target_text||'')).length

  // Engagement dist
  const engDist = useMemo(() => {
    const dist = { High:0, Medium:0, Low:0, None:0 }
    sessions.forEach(s => { dist[engagementLevel(summaryMap[s.id])]++ })
    return [
      { name:'High',    value:dist.High,   color:C.emerald, bg:C.emeraldL },
      { name:'Medium',  value:dist.Medium, color:C.amber,   bg:C.amberL   },
      { name:'Low',     value:dist.Low,    color:C.rose,    bg:C.roseL    },
      { name:'No data', value:dist.None,   color:C.gray400, bg:C.gray100  },
    ]
  }, [sessions, summaryMap])

  // Traffic & device
  const trafficData = useMemo(() => {
    const m = {}
    sessions.forEach(s => { const r = parseReferrer(s.referrer); m[r]=(m[r]||0)+1 })
    return Object.entries(m).map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value)
  }, [sessions])

  const deviceData = useMemo(() => {
    const m = {}
    sessions.forEach(s => { const d = parseDevice(s.user_agent); m[d]=(m[d]||0)+1 })
    return Object.entries(m).map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value)
  }, [sessions])

  const dailyData = useMemo(() => {
    const m = {}
    sessions.forEach(s => { const d = s.started_at_ist?.slice(0,10); if(d) m[d]=(m[d]||0)+1 })
    return Object.entries(m).sort((a,b)=>a[0].localeCompare(b[0])).map(([date,visitors])=>({ date:date.slice(5), visitors }))
  }, [sessions])

  const hourlyData = useMemo(() => buildHourlyStats(sessions, clicks), [sessions, clicks])
  const peakHour   = useMemo(() => {
    const max = Math.max(...hourlyData.map(h => h.sessions))
    return hourlyData.find(h => h.sessions === max)
  }, [hourlyData])

  const allSources = useMemo(() => {
    const s = new Set(allSessions.map(x => parseReferrer(x.referrer)))
    return ['All', ...Array.from(s).sort()]
  }, [allSessions])

  // ── Platform CTA data (cleaned)
  const platformData = useMemo(() => {
    const m = {}
    clicks.forEach(c => {
      if (!isCTA(c.target_text||'')) return
      const p = extractPlatform(c.target_text)
      if (!p) return
      m[p] = (m[p]||0)+1
    })
    return Object.entries(m).map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value)
  }, [clicks])

  // ── Product interest data (non-CTA, short text)
  const productData = useMemo(() => {
    return clickStats.byText
      .filter(x => !isCTA(x.name) && x.name.length < 40 && x.name.length > 2)
      .slice(0, 10)
  }, [clickStats])

  // ── URL data — truncated for display
  const urlData = useMemo(() => {
    return clickStats.byHref.slice(0, 12).map(item => ({
      ...item,
      displayName: item.name.length > 35 ? '…' + item.name.slice(-32) : item.name,
    }))
  }, [clickStats])

  // Sessions table
  const filteredSessions = useMemo(() => {
    let s = [...sessions]
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      s = s.filter(x =>
        (x.path||'').toLowerCase().includes(q) ||
        (x.referrer||'').toLowerCase().includes(q) ||
        parseReferrer(x.referrer).toLowerCase().includes(q) ||
        parseDevice(x.user_agent).toLowerCase().includes(q)
      )
    }
    s.sort((a,b) => {
      const sa = summaryMap[a.id], sb = summaryMap[b.id]
      switch(sortBy) {
        case 'time_asc':    return new Date(a.started_at_ist)-new Date(b.started_at_ist)
        case 'dur_desc':    return (Number(sb?.time_on_page_ms)||0)-(Number(sa?.time_on_page_ms)||0)
        case 'clicks_desc': return (Number(sb?.click_count)||0)-(Number(sa?.click_count)||0)
        case 'scroll_desc': return (Number(sb?.max_scroll_depth)||0)-(Number(sa?.max_scroll_depth)||0)
        case 'eng_desc': {
          const order={High:3,Medium:2,Low:1,None:0}
          return (order[engagementLevel(sb)]||0)-(order[engagementLevel(sa)]||0)
        }
        default: return new Date(b.started_at_ist)-new Date(a.started_at_ist)
      }
    })
    return s
  }, [sessions, searchQuery, sortBy, summaryMap])

  const totalPages   = Math.ceil(filteredSessions.length/LIMIT)
  const pageSessions = filteredSessions.slice((page-1)*LIMIT, page*LIMIT)
  useMemo(() => setPage(1), [searchQuery, sortBy, days, deviceFilter, sourceFilter])

  // ── Loading
  if (loading) return (
    <div style={{ minHeight:'100vh', background:C.gray50, padding:'2rem' }}>
      <style>{GLOBAL_CSS}</style>
      <div style={{ maxWidth:1240, margin:'0 auto' }}>
        <div style={{ height:56, background:C.white, borderRadius:12, border:`1px solid ${C.border}`, marginBottom:'1.5rem' }} />
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:'1rem' }}>
          {[...Array(6)].map((_,i) => <SkeletonCard key={i} h={100} />)}
        </div>
      </div>
    </div>
  )

  // ══════════════════════════════════════════════════════
  return (
    <div style={{ minHeight:'100vh', background:C.gray50 }}>
      <style>{GLOBAL_CSS + RESPONSIVE_CSS}</style>

      {/* NAVBAR */}
      <nav style={{
        background:C.white, borderBottom:`1px solid ${C.border}`,
        padding:'0 1.5rem', height:56,
        display:'flex', alignItems:'center', justifyContent:'space-between',
        position:'sticky', top:0, zIndex:100,
        boxShadow:'0 1px 3px rgba(0,0,0,0.04)',
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:24 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <div style={{
              width:28, height:28, borderRadius:7,
              background:`linear-gradient(135deg,${C.indigo},${C.violet})`,
              display:'flex', alignItems:'center', justifyContent:'center',
              color:C.white, fontSize:13, fontWeight:700,
            }}>G</div>
            <span style={{ fontWeight:600, fontSize:'0.88rem', color:C.gray900 }}>GLW Analytics</span>
          </div>
          <div style={{ display:'flex', gap:2 }}>
            {[{ label:'Dashboard', href:'/' }, { label:'Deep Dive', href:'/analytics' }].map(({ label, href }) => {
              const active = href === '/analytics'
              return (
                <Link key={href} to={href} style={{
                  padding:'5px 14px', borderRadius:7, fontSize:'0.82rem',
                  fontWeight:active?500:400,
                  background:active?C.indigoL:'transparent',
                  color:active?C.indigo:C.gray500,
                  textDecoration:'none', transition:'all 0.15s',
                }}>{label}</Link>
              )
            })}
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <div style={{
            width:7, height:7, borderRadius:'50%', background:C.emerald,
            animation:liveFlash?'pulseDot 0.8s':'pulseDot 2.5s infinite',
          }} />
          <span style={{ fontSize:'0.73rem', color:C.gray400 }}>
            Live · {lastUpdate.toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' })}
          </span>
        </div>
      </nav>

      <div style={{ maxWidth:1240, margin:'0 auto', padding:'1.25rem 1.5rem', animation:'fadeUp 0.3s ease' }}>

        {/* HEADER + FILTERS */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem', flexWrap:'wrap', gap:10 }}>
          <div>
            <h1 style={{ fontSize:'1.1rem', fontWeight:600, color:C.gray900, letterSpacing:'-0.02em' }}>Deep Dive Analytics</h1>
            <p style={{ fontSize:'0.75rem', color:C.gray400, marginTop:1 }}>Full breakdown · {totalSessions} sessions in period</p>
          </div>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
            <select value={deviceFilter} onChange={e=>setDeviceFilter(e.target.value)} style={selectStyle}>
              {['All','Desktop','Mobile','Tablet','Bot'].map(d=><option key={d}>{d}</option>)}
            </select>
            <select value={sourceFilter} onChange={e=>setSourceFilter(e.target.value)} style={selectStyle}>
              {allSources.map(s=><option key={s}>{s}</option>)}
            </select>
            <div style={{ display:'flex', gap:3, background:C.gray100, padding:3, borderRadius:9 }}>
              {DATE_FILTERS.map(f=>(
                <button key={f.value} onClick={()=>setDays(f.value)} style={{
                  ...tabBtnStyle, background:days===f.value?C.white:'transparent',
                  color:days===f.value?C.gray900:C.gray500,
                  boxShadow:days===f.value?'0 1px 3px rgba(0,0,0,0.08)':'none',
                }}>{f.label}</button>
              ))}
            </div>
          </div>
        </div>

        {/* ── KPI STRIP — responsive auto-fit ── */}
        <div className="kpi-grid" style={{ marginBottom:'1.25rem' }}>
          <KPICard icon="👥" label="Sessions"    value={totalSessions}       sub={`${realSessions} real`}      color={C.indigo}  bgColor={C.indigoL}  />
          <KPICard icon="⏱️" label="Avg Time"    value={`${avgTime}s`}       sub="per session"                 color={C.violet}  bgColor={C.violetL}  />
          <KPICard icon="🖱️" label="Total Clicks" value={totalClicks}        sub="all interactions"            color={C.cyan}    bgColor={C.cyanL}    />
          <KPICard icon="↩️" label="Bounce Rate" value={`${bounceRate}%`}    sub={`${bouncedCount} bounced`}   color={bounceRate>60?C.rose:C.emerald} bgColor={bounceRate>60?C.roseL:C.emeraldL} />
          <KPICard icon="🔥" label="Engagement"  value={`${engagementRate}%`} sub="scroll>50% & 20s+"         color={C.emerald} bgColor={C.emeraldL} />
          <KPICard icon="🎯" label="CTA Clicks"  value={ctaCount}            sub="high-intent"                 color={C.amber}   bgColor={C.amberL}   />
        </div>

        {/* ── SECTION TABS ── */}
        <div style={{
          display:'flex', gap:3, background:C.white,
          border:`1px solid ${C.border}`, borderRadius:10,
          padding:4, marginBottom:'1.25rem',
          boxShadow:'0 1px 3px rgba(0,0,0,0.04)',
          overflowX:'auto',
        }}>
          {TABS.map(t=>(
            <button key={t.id} onClick={()=>setActiveTab(t.id)} style={{
              padding:'7px 16px', borderRadius:7, border:'none', cursor:'pointer',
              fontSize:'0.8rem', fontWeight:activeTab===t.id?500:400,
              fontFamily:'DM Sans, sans-serif', whiteSpace:'nowrap',
              background:activeTab===t.id?C.indigo:'transparent',
              color:activeTab===t.id?C.white:C.gray500,
              transition:'all 0.15s',
            }}>{t.label}</button>
          ))}
        </div>

        {/* ════════════════════════════════════════════
            TAB 1 — PAGES
        ════════════════════════════════════════════ */}
        {activeTab === 'pages' && (
          <div style={{ animation:'fadeUp 0.25s ease' }}>
            <SectionHeading sub="Session volume, engagement, and bounce rate per URL path">
              Page-wise Performance
            </SectionHeading>
            <Card>
              <CardHeader title="All Pages — Full Breakdown" sub="Sorted by sessions" />
              <div style={{ overflowX:'auto' }}>
                <table style={{ width:'100%', borderCollapse:'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom:`1px solid ${C.gray100}` }}>
                      {['Page','Sessions','Avg Duration','Avg Scroll %','Bounce Rate','w/ Summary'].map(h=>(
                        <th key={h} style={thStyle}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pageStats.map((p,i)=>(
                      <tr key={p.page}
                        style={{ borderBottom:`1px solid ${C.gray100}`, transition:'background 0.1s' }}
                        onMouseEnter={e=>e.currentTarget.style.background=C.gray50}
                        onMouseLeave={e=>e.currentTarget.style.background='transparent'}
                      >
                        <td style={{ padding:'0.55rem 0.75rem' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                            <span style={{
                              width:20, height:20, borderRadius:5, flexShrink:0,
                              background:CHART_COLORS[i%CHART_COLORS.length]+'22',
                              color:CHART_COLORS[i%CHART_COLORS.length],
                              fontSize:10, fontWeight:700,
                              display:'flex', alignItems:'center', justifyContent:'center',
                            }}>{i+1}</span>
                            <span style={{ fontSize:'0.8rem', color:C.gray700, fontFamily:'DM Mono, monospace', wordBreak:'break-all' }}>{p.page}</span>
                          </div>
                        </td>
                        <StatCell value={p.sessions.toLocaleString()} color={C.indigo} />
                        <StatCell value={p.avgDuration?`${p.avgDuration}s`:'—'} color={C.violet} sub={p.withSummary?`${p.withSummary} tracked`:null} />
                        <StatCell value={p.avgScroll?`${p.avgScroll}%`:'—'} color={p.avgScroll>=70?C.emerald:p.avgScroll>=40?C.amber:C.rose} />
                        <StatCell value={`${p.bounceRate}%`} color={p.bounceRate>=65?C.rose:p.bounceRate>=40?C.amber:C.emerald} sub={`${p.bounces} bounced`} />
                        <StatCell value={`${p.withSummary}/${p.sessions}`} color={C.gray500} />
                      </tr>
                    ))}
                    {pageStats.length===0&&(<tr><td colSpan={6} style={{ textAlign:'center', padding:'2rem', color:C.gray300, fontSize:'0.82rem' }}>No page data</td></tr>)}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {/* ════════════════════════════════════════════
            TAB 2 — CLICK ANALYTICS
        ════════════════════════════════════════════ */}
        {activeTab === 'clicks' && (
          <div style={{ animation:'fadeUp 0.25s ease' }}>
            <SectionHeading sub="Platform CTA conversions, product interest, and element clicks">
              Click Analytics
            </SectionHeading>

            {/* Click KPIs */}
            <div className="click-kpi-grid" style={{ marginBottom:'1rem' }}>
              {[
                { icon:'🖱️', label:'Total Clicks',    value:clickStats.total,           color:C.indigo,  bg:C.indigoL  },
                { icon:'🎯', label:'CTA Clicks',      value:clickStats.ctaClicks.length, color:C.emerald, bg:C.emeraldL },
                { icon:'🔗', label:'Unique Elements', value:clickStats.byText.length,    color:C.cyan,    bg:C.cyanL    },
                { icon:'🏷️', label:'Tracked IDs',     value:clickStats.byId.length,      color:C.violet,  bg:C.violetL  },
              ].map(item=>(
                <div key={item.label} style={{
                  background:item.bg, borderRadius:10, padding:'0.9rem 1rem',
                  border:`1px solid ${item.color}22`,
                }}>
                  <div style={{ fontSize:16, marginBottom:5 }}>{item.icon}</div>
                  <div style={{ fontSize:'1.4rem', fontWeight:600, color:item.color, letterSpacing:'-0.02em' }}>
                    {item.value.toLocaleString()}
                  </div>
                  <div style={{ fontSize:'0.73rem', color:C.gray500, marginTop:2 }}>{item.label}</div>
                </div>
              ))}
            </div>

            {/* Sub-tabs */}
            <div style={{ display:'flex', gap:4, marginBottom:'1rem', flexWrap:'wrap' }}>
              {[
                { id:'platforms', label:'Platforms'              },
                { id:'products',  label:'Product Interest'       },
                { id:'tag',       label:'By Tag'                 },
                { id:'href',      label:'By URL'                 },
                { id:'id',        label:'By Analytics ID'        },
              ].map(t=>(
                <button key={t.id} onClick={()=>setClickSubTab(t.id)} style={{
                  padding:'5px 14px', borderRadius:7,
                  border:`1px solid ${clickSubTab===t.id?C.indigo:C.border}`,
                  background:clickSubTab===t.id?C.indigoL:C.white,
                  color:clickSubTab===t.id?C.indigo:C.gray500,
                  fontSize:'0.78rem', fontWeight:clickSubTab===t.id?500:400,
                  cursor:'pointer', fontFamily:'DM Sans, sans-serif', transition:'all 0.15s',
                }}>{t.label}</button>
              ))}
            </div>

            {/* ── PLATFORMS sub-tab ── */}
            {clickSubTab === 'platforms' && (
              <Card>
                <CardHeader
                  title="Platform Performance"
                  sub="Where users buy — CTA clicks by platform"
                  badge={`${platformData.reduce((a,p)=>a+p.value,0)} CTA clicks`}
                  badgeColor={C.emerald} badgeBg={C.emeraldL}
                />
                {platformData.length === 0 ? (
                  <div style={{ padding:'3rem', textAlign:'center', color:C.gray300, fontSize:'0.82rem' }}>
                    No platform CTA clicks yet
                  </div>
                ) : (
                  <div style={{ display:'flex', flexDirection:'column', gap:0 }}>
                    {platformData.map((p,i)=>(
                      <PlatformRow key={p.name} rank={i+1} name={p.name} value={p.value}
                        max={platformData[0]?.value||1} color={CHART_COLORS[i%CHART_COLORS.length]}
                        bg={CHART_COLORS[i%CHART_COLORS.length]+'14'}
                      />
                    ))}
                  </div>
                )}
              </Card>
            )}

            {/* ── PRODUCTS sub-tab ── */}
            {clickSubTab === 'products' && (
              <Card>
                <CardHeader title="Product Interest" sub="Most-clicked product names on page" />
                {productData.length === 0 ? (
                  <div style={{ padding:'3rem', textAlign:'center', color:C.gray300, fontSize:'0.82rem' }}>No product click data</div>
                ) : (
                  <div style={{ display:'flex', flexDirection:'column', gap:0 }}>
                    {productData.map((p,i)=>(
                      <PlatformRow key={p.name} rank={i+1} name={p.name} value={p.value}
                        max={productData[0]?.value||1} color={CHART_COLORS[i%CHART_COLORS.length]}
                        bg={CHART_COLORS[i%CHART_COLORS.length]+'14'}
                      />
                    ))}
                  </div>
                )}
              </Card>
            )}

            {/* ── TAG sub-tab ── */}
            {clickSubTab === 'tag' && (
              <Card>
                <CardHeader title="Clicks by Element Tag" sub="button vs a vs div vs other" />
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={clickStats.byTag} barSize={36} margin={{ top:4, right:16, left:0, bottom:0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={C.gray100} />
                    <XAxis dataKey="name" tick={{ fill:C.gray600, fontSize:12, fontFamily:'DM Mono, monospace' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill:C.gray400, fontSize:10 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="value" name="Clicks" radius={[5,5,0,0]}>
                      {clickStats.byTag.map((_,i)=>(<Cell key={i} fill={CHART_COLORS[i%CHART_COLORS.length]} />))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div style={{ display:'flex', flexDirection:'column', gap:0, marginTop:16, paddingTop:16, borderTop:`1px solid ${C.gray100}` }}>
                  {clickStats.byTag.map((t,i)=>(
                    <PlatformRow key={t.name} rank={i+1} name={t.name} value={t.value}
                      max={clickStats.byTag[0]?.value||1} color={CHART_COLORS[i%CHART_COLORS.length]}
                    />
                  ))}
                </div>
              </Card>
            )}

            {/* ── BY URL sub-tab — FIXED layout ── */}
            {clickSubTab === 'href' && (
              <Card>
                <CardHeader title="Top Clicked URLs" sub="External links and internal paths users navigate to" />
                {urlData.length === 0 ? (
                  <div style={{ padding:'3rem', textAlign:'center', color:C.gray300, fontSize:'0.82rem' }}>No URL click data</div>
                ) : (
                  <div style={{ display:'flex', flexDirection:'column', gap:0 }}>
                    {urlData.map((u,i)=>(
                      <div key={u.name} style={{
                        display:'flex', alignItems:'center', gap:10,
                        padding:'0.6rem 0', borderBottom:`1px solid ${C.gray100}`,
                      }}>
                        <span style={{ fontSize:10, color:C.gray400, fontFamily:'DM Mono, monospace', width:20, textAlign:'right', flexShrink:0 }}>#{i+1}</span>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{
                            fontSize:'0.75rem', color:C.gray700, fontFamily:'DM Mono, monospace',
                            overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
                          }} title={u.name}>{u.displayName}</div>
                          <div style={{ height:4, background:C.gray100, borderRadius:2, marginTop:4, overflow:'hidden' }}>
                            <div style={{
                              width:`${Math.round(u.value/(urlData[0]?.value||1)*100)}%`,
                              height:4, background:CHART_COLORS[i%CHART_COLORS.length], borderRadius:2,
                            }} />
                          </div>
                        </div>
                        <span style={{ fontSize:'0.8rem', fontWeight:600, color:CHART_COLORS[i%CHART_COLORS.length], flexShrink:0, minWidth:24, textAlign:'right' }}>{u.value}</span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            )}

            {/* ── ANALYTICS ID sub-tab ── */}
            {clickSubTab === 'id' && (
              <Card>
                <CardHeader title="Clicks by Analytics ID" sub="data-analytics-id tracked elements" />
                {clickStats.byId.length === 0 ? (
                  <div style={{ padding:'3rem', textAlign:'center', color:C.gray300, fontSize:'0.82rem' }}>
                    <div style={{ fontSize:28, marginBottom:8 }}>🏷️</div>
                    No analytics IDs found.<br />
                    Add <code style={{ fontSize:11, background:C.gray100, padding:'1px 5px', borderRadius:4 }}>data-analytics-id="element_name"</code> to important buttons.
                  </div>
                ) : (
                  <div style={{ display:'flex', flexDirection:'column', gap:0 }}>
                    {clickStats.byId.slice(0,15).map((item,i)=>(
                      <PlatformRow key={item.name} rank={i+1} name={item.name} value={item.value}
                        max={clickStats.byId[0]?.value||1} color={CHART_COLORS[i%CHART_COLORS.length]}
                      />
                    ))}
                  </div>
                )}
              </Card>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════
            TAB 3 — ENGAGEMENT
        ════════════════════════════════════════════ */}
        {activeTab === 'engagement' && (
          <div style={{ animation:'fadeUp 0.25s ease' }}>
            <SectionHeading sub="Scroll depth, session time, click activity, and engagement quality">
              Engagement Distribution
            </SectionHeading>

            <div className="engagement-grid" style={{ marginBottom:'1rem' }}>
              {/* Pie chart */}
              <Card>
                <CardHeader title="Engagement Levels" sub="High / Medium / Low / No data" />
                <ResponsiveContainer width="100%" height={230}>
                  <PieChart>
                    <Pie data={engDist} dataKey="value" nameKey="name" cx="50%" cy="50%"
                      outerRadius={85} innerRadius={42} paddingAngle={3}>
                      {engDist.map((e,i)=><Cell key={i} fill={e.color} stroke="none" />)}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend iconType="circle" iconSize={8}
                      formatter={v=><span style={{ color:C.gray600, fontSize:12 }}>{v}</span>} />
                  </PieChart>
                </ResponsiveContainer>
              </Card>

              {/* Breakdown bars */}
              <Card>
                <CardHeader title="Level Breakdown" sub="Sessions per engagement level" />
                <div style={{ display:'flex', flexDirection:'column', gap:14, paddingTop:8 }}>
                  {engDist.map(e=>(
                    <div key={e.name}>
                      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
                        <span style={{ fontSize:12, fontWeight:500, padding:'2px 10px', borderRadius:20, background:e.bg, color:e.color }}>{e.name}</span>
                        <span style={{ fontSize:13, fontWeight:600, color:e.color }}>
                          {e.value} <span style={{ color:C.gray400, fontWeight:400, fontSize:11 }}>({totalSessions?Math.round(e.value/totalSessions*100):0}%)</span>
                        </span>
                      </div>
                      <div style={{ background:C.gray100, borderRadius:6, height:8, overflow:'hidden' }}>
                        <div style={{ width:`${totalSessions?Math.round(e.value/totalSessions*100):0}%`, height:8, background:e.color, borderRadius:6, transition:'width 0.8s ease' }} />
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginTop:'1.25rem', paddingTop:'1rem', borderTop:`1px solid ${C.gray100}` }}>
                  {[
                    { label:'Avg Scroll',  value:`${summary.length?Math.round(summary.reduce((a,b)=>a+Number(b.max_scroll_depth),0)/summary.length*100):0}%`, color:C.emerald },
                    { label:'Avg Time',    value:`${avgTime}s`,  color:C.violet },
                    { label:'Avg Clicks',  value:(summary.length?(summary.reduce((a,b)=>a+Number(b.click_count),0)/summary.length).toFixed(1):0), color:C.amber },
                  ].map(m=>(
                    <div key={m.label} style={{ textAlign:'center', background:C.gray50, borderRadius:8, padding:'0.6rem' }}>
                      <div style={{ fontSize:'1.1rem', fontWeight:600, color:m.color }}>{m.value}</div>
                      <div style={{ fontSize:'0.7rem', color:C.gray400, marginTop:2 }}>{m.label}</div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            {/* Engagement-SPECIFIC insights — NOT duplicated from Dashboard */}
            <Card>
              <CardHeader title="Engagement Insights" sub="Scroll depth, session quality, and interaction patterns specific to this period" />
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(270px,1fr))', gap:'0.65rem' }}>
                {engagementInsights.map((ins,i)=><InsightPill key={i} {...ins} />)}
              </div>
            </Card>
          </div>
        )}

        {/* ════════════════════════════════════════════
            TAB 4 — TRAFFIC
        ════════════════════════════════════════════ */}
        {activeTab === 'traffic' && (
          <div style={{ animation:'fadeUp 0.25s ease' }}>
            <SectionHeading sub="Where your visitors come from and what devices they use">
              Traffic & Device Analytics
            </SectionHeading>

            <div className="traffic-top-grid" style={{ marginBottom:'1rem' }}>
              <Card>
                <CardHeader title="Sessions Over Time" sub="Daily visitor trend" badge={`${days||'All'} days`} />
                <ResponsiveContainer width="100%" height={210}>
                  <LineChart data={dailyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={C.gray100} />
                    <XAxis dataKey="date" tick={{ fill:C.gray400, fontSize:11, fontFamily:'DM Mono, monospace' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill:C.gray400, fontSize:11 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Line type="monotone" dataKey="visitors" name="Sessions" stroke={C.indigo} strokeWidth={2.5}
                      dot={{ fill:C.indigo, r:3, strokeWidth:0 }}
                      activeDot={{ r:5, fill:C.indigo, stroke:C.white, strokeWidth:2 }} />
                  </LineChart>
                </ResponsiveContainer>
              </Card>
              <Card>
                <CardHeader title="Device Breakdown" sub="Desktop / Mobile / Tablet / Bot" />
                <ResponsiveContainer width="100%" height={210}>
                  <PieChart>
                    <Pie data={deviceData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                      outerRadius={78} innerRadius={36} paddingAngle={3}
                      label={({ name, percent })=>`${name} ${Math.round(percent*100)}%`} labelLine={false}>
                      {deviceData.map((_,i)=><Cell key={i} fill={CHART_COLORS[i%CHART_COLORS.length]} stroke="none" />)}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </Card>
            </div>

            <div className="traffic-bottom-grid">
              <Card>
                <CardHeader title="Traffic Sources" sub="Visitor origin — referrer breakdown" />
                <div style={{ display:'flex', flexDirection:'column', gap:0 }}>
                  {trafficData.map((s,i)=>(
                    <PlatformRow key={s.name} rank={i+1} name={s.name} value={s.value} max={trafficData[0]?.value||1} color={CHART_COLORS[i%CHART_COLORS.length]} />
                  ))}
                  {trafficData.length===0&&<div style={{ color:C.gray300, fontSize:'0.8rem', textAlign:'center', padding:'1.5rem' }}>No data</div>}
                </div>
              </Card>
              <Card>
                <CardHeader title="Device Summary" sub="Sessions per device type" />
                <div style={{ display:'flex', flexDirection:'column', gap:0 }}>
                  {deviceData.map((d,i)=>(
                    <PlatformRow key={d.name} rank={i+1} name={`${parseDeviceIcon(d.name)} ${d.name}`} value={d.value} max={deviceData[0]?.value||1} color={CHART_COLORS[i%CHART_COLORS.length]} />
                  ))}
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(90px,1fr))', gap:8, marginTop:'1rem', paddingTop:'1rem', borderTop:`1px solid ${C.gray100}` }}>
                  {deviceData.map((d,i)=>(
                    <div key={d.name} style={{
                      background:CHART_COLORS[i%CHART_COLORS.length]+'14',
                      border:`1px solid ${CHART_COLORS[i%CHART_COLORS.length]}22`,
                      borderRadius:9, padding:'0.65rem', textAlign:'center',
                    }}>
                      <div style={{ fontSize:18, marginBottom:4 }}>{parseDeviceIcon(d.name)}</div>
                      <div style={{ fontSize:'1rem', fontWeight:600, color:CHART_COLORS[i%CHART_COLORS.length] }}>
                        {totalSessions?Math.round(d.value/totalSessions*100):0}%
                      </div>
                      <div style={{ fontSize:'0.68rem', color:C.gray400, marginTop:1 }}>{d.name}</div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════
            TAB 5 — PEAK HOURS
        ════════════════════════════════════════════ */}
        {activeTab === 'hours' && (
          <div style={{ animation:'fadeUp 0.25s ease' }}>
            <SectionHeading sub="Hourly session and click distribution — all times in IST">
              Peak Hours Analysis
            </SectionHeading>

            <Card style={{ marginBottom:'1rem' }}>
              <CardHeader
                title="Sessions by Hour"
                sub="Which hours drive the most traffic"
                badge={peakHour?`Peak: ${peakHour.label} (${peakHour.sessions} sessions)`:undefined}
                badgeColor={C.amber} badgeBg={C.amberL}
              />
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={hourlyData} barSize={18} margin={{ top:4, right:8, left:0, bottom:0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.gray100} vertical={false} />
                  <XAxis dataKey="label" tick={{ fill:C.gray400, fontSize:10, fontFamily:'DM Mono, monospace' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill:C.gray400, fontSize:10 }} axisLine={false} tickLine={false} width={28} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="sessions" name="Sessions" radius={[4,4,0,0]}>
                    {hourlyData.map((entry,i)=>(<Cell key={i} fill={entry.hour===peakHour?.hour?C.amber:C.indigo+'BB'} />))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card style={{ marginBottom:'1rem' }}>
              <CardHeader title="Clicks by Hour" sub="High-intent interactions per hour" />
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={hourlyData} barSize={16} margin={{ top:4, right:8, left:0, bottom:0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.gray100} vertical={false} />
                  <XAxis dataKey="label" tick={{ fill:C.gray400, fontSize:10, fontFamily:'DM Mono, monospace' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill:C.gray400, fontSize:10 }} axisLine={false} tickLine={false} width={28} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="clicks" name="Clicks" fill={C.emerald} radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card>
              <CardHeader title="Day Part Summary" sub="Morning / Afternoon / Evening / Night split" />
              {(()=>{
                const morning   = hourlyData.slice(5,12).reduce((a,b)=>a+b.sessions,0)
                const afternoon = hourlyData.slice(12,17).reduce((a,b)=>a+b.sessions,0)
                const evening   = hourlyData.slice(17,21).reduce((a,b)=>a+b.sessions,0)
                const night     = hourlyData.slice(21,24).reduce((a,b)=>a+b.sessions,0)+hourlyData.slice(0,5).reduce((a,b)=>a+b.sessions,0)
                const parts = [
                  { label:'🌅 Morning',   sub:'5am–12pm', value:morning,   color:C.amber  },
                  { label:'☀️ Afternoon', sub:'12pm–5pm', value:afternoon, color:C.orange },
                  { label:'🌆 Evening',   sub:'5pm–9pm',  value:evening,   color:C.indigo },
                  { label:'🌙 Night',     sub:'9pm–5am',  value:night,     color:C.violet },
                ]
                const tot = parts.reduce((a,p)=>a+p.value,0)||1
                const maxPart = Math.max(...parts.map(p=>p.value))
                return (
                  <>
                    <div className="daypart-grid" style={{ marginBottom:'1rem' }}>
                      {parts.map(p=>(
                        <div key={p.label} style={{
                          background:p.value===maxPart?p.color+'14':C.gray50,
                          border:`1px solid ${p.value===maxPart?p.color+'44':C.border}`,
                          borderRadius:12, padding:'1rem', textAlign:'center',
                        }}>
                          <div style={{ fontSize:13, fontWeight:500, color:C.gray600, marginBottom:6 }}>{p.label}</div>
                          <div style={{ fontSize:'1.5rem', fontWeight:700, color:p.value===maxPart?p.color:C.gray700 }}>{p.value}</div>
                          <div style={{ fontSize:10, color:C.gray400, marginTop:3 }}>{p.sub}</div>
                          <div style={{ fontSize:10, color:p.color, fontWeight:600, marginTop:3 }}>{Math.round(p.value/tot*100)}%</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ overflowX:'auto' }}>
                      <table style={{ width:'100%', borderCollapse:'collapse' }}>
                        <thead>
                          <tr style={{ borderBottom:`1px solid ${C.gray100}` }}>
                            {['Rank','Hour','Sessions','Clicks','Share'].map(h=>(
                              <th key={h} style={thStyle}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {[...hourlyData].sort((a,b)=>b.sessions-a.sessions).slice(0,10).map((h,i)=>(
                            <tr key={h.hour} style={{ borderBottom:`1px solid ${C.gray100}` }}
                              onMouseEnter={e=>e.currentTarget.style.background=C.gray50}
                              onMouseLeave={e=>e.currentTarget.style.background='transparent'}
                            >
                              <td style={{ padding:'0.55rem 0.75rem' }}>
                                <span style={{ fontSize:12, fontWeight:700, color:i===0?C.amber:C.gray400, background:i===0?C.amberL:C.gray100, padding:'2px 8px', borderRadius:20 }}>#{i+1}</span>
                              </td>
                              <td style={{ padding:'0.55rem 0.75rem', fontFamily:'DM Mono, monospace', fontSize:13, color:C.gray700, fontWeight:600 }}>{h.label}</td>
                              <td style={{ padding:'0.55rem 0.75rem', fontSize:13, fontWeight:600, color:C.indigo }}>{h.sessions}</td>
                              <td style={{ padding:'0.55rem 0.75rem', fontSize:13, fontWeight:600, color:C.emerald }}>{h.clicks}</td>
                              <td style={{ padding:'0.55rem 0.75rem' }}>
                                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                                  <div style={{ width:60, height:5, background:C.gray100, borderRadius:3 }}>
                                    <div style={{ width:`${Math.round(h.sessions/tot*100)}%`, height:5, background:C.indigo, borderRadius:3 }} />
                                  </div>
                                  <span style={{ fontSize:11, color:C.gray500 }}>{Math.round(h.sessions/tot*100)}%</span>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )
              })()}
            </Card>
          </div>
        )}

        {/* ════════════════════════════════════════════
            TAB 6 — SESSIONS TABLE
        ════════════════════════════════════════════ */}
        {activeTab === 'sessions' && (
          <div style={{ animation:'fadeUp 0.25s ease' }}>
            <SectionHeading sub="Full session log with search, sort, and CSV export">
              Smart Sessions Table
            </SectionHeading>
            <Card>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem', flexWrap:'wrap', gap:8 }}>
                <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                  <div style={{ position:'relative' }}>
                    <span style={{ position:'absolute', left:9, top:'50%', transform:'translateY(-50%)', fontSize:12, color:C.gray400 }}>🔍</span>
                    <input value={searchQuery} onChange={e=>setSearchQuery(e.target.value)}
                      placeholder="Search page, source, device…"
                      style={{ ...inputStyle, paddingLeft:28, width:210 }} />
                  </div>
                  <select value={sortBy} onChange={e=>setSortBy(e.target.value)} style={selectStyle}>
                    {[
                      { value:'time_desc',  label:'Newest first'       },
                      { value:'time_asc',   label:'Oldest first'       },
                      { value:'dur_desc',   label:'Longest duration'   },
                      { value:'clicks_desc',label:'Most clicks'        },
                      { value:'scroll_desc',label:'Deepest scroll'     },
                      { value:'eng_desc',   label:'Highest engagement' },
                    ].map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  <span style={{ fontSize:11, background:C.indigoL, color:C.indigo, padding:'4px 10px', borderRadius:20, alignSelf:'center', fontWeight:500 }}>
                    {filteredSessions.length} results
                  </span>
                </div>
                <button onClick={()=>exportCSV(filteredSessions, summaryMap)} style={{
                  display:'flex', alignItems:'center', gap:5,
                  padding:'6px 14px', borderRadius:8,
                  border:`1px solid ${C.border}`, background:C.white,
                  color:C.gray600, fontSize:'0.8rem', cursor:'pointer',
                  fontFamily:'DM Sans, sans-serif', transition:'all 0.15s',
                }}
                  onMouseEnter={e=>{e.currentTarget.style.background=C.gray50}}
                  onMouseLeave={e=>{e.currentTarget.style.background=C.white}}
                >⬇ Export CSV</button>
              </div>

              <div style={{ overflowX:'auto' }}>
                <table style={{ width:'100%', borderCollapse:'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom:`1px solid ${C.gray100}` }}>
                      {['#','Time','Device','Source','Referrer','Page','Duration','Scroll','Clicks','Engagement'].map(h=>(
                        <th key={h} style={thStyle}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pageSessions.map((s,idx)=>{
                      const sm     = summaryMap[s.id]
                      const device = parseDevice(s.user_agent)
                      const scroll = sm?Math.round(Number(sm.max_scroll_depth)*100):null
                      const dur    = sm?Math.round(Number(sm.time_on_page_ms)/1000):null
                      const eng    = engagementLevel(sm)
                      const engSt  = engagementStyle(eng)
                      const sColor = scroll>=75?C.emerald:scroll>=40?C.amber:C.rose
                      return (
                        <tr key={s.id} onClick={()=>navigate(`/session/${s.id}`)}
                          style={{ cursor:'pointer', borderBottom:`1px solid ${C.gray100}`, transition:'background 0.1s' }}
                          onMouseEnter={e=>e.currentTarget.style.background=C.gray50}
                          onMouseLeave={e=>e.currentTarget.style.background='transparent'}
                        >
                          <td style={{ ...tdStyle, color:C.gray300, fontSize:'0.72rem', fontFamily:'DM Mono, monospace' }}>{(page-1)*LIMIT+idx+1}</td>
                          <td style={tdStyle}>
                            <div style={{ fontSize:'0.75rem', color:C.gray700, fontWeight:500 }}>
                              {new Date(s.started_at_ist).toLocaleDateString('en-IN',{day:'2-digit',month:'short'})}
                            </div>
                            <div style={{ fontSize:'0.67rem', color:C.gray400, fontFamily:'DM Mono, monospace' }}>
                              {new Date(s.started_at_ist).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}
                            </div>
                          </td>
                          <td style={{ ...tdStyle, fontSize:'0.76rem', color:C.gray700 }}>{parseDeviceIcon(device)} {device}</td>
                          <td style={tdStyle}>
                            <span style={{ fontSize:10, padding:'2px 7px', borderRadius:20, background:C.indigoL, color:C.indigo, fontWeight:500 }}>
                              {parseReferrer(s.referrer)}
                            </span>
                          </td>
                          <td style={{ ...tdStyle, maxWidth:100, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontSize:'0.7rem', color:C.gray400, fontFamily:'DM Mono, monospace' }}>
                            {s.referrer||'—'}
                          </td>
                          <td style={{ ...tdStyle, maxWidth:120, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontSize:'0.76rem', color:C.gray600, fontFamily:'DM Mono, monospace' }}>
                            {s.path||'/'}
                          </td>
                          <td style={{ ...tdStyle, fontSize:'0.76rem', color:dur!=null?C.violet:C.gray300, fontWeight:dur!=null?500:400 }}>{dur!=null?`${dur}s`:'—'}</td>
                          <td style={tdStyle}>
                            {scroll!=null?(
                              <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                                <div style={{ width:40, height:4, background:C.gray100, borderRadius:2, overflow:'hidden' }}>
                                  <div style={{ width:`${scroll}%`, height:4, background:sColor, borderRadius:2 }} />
                                </div>
                                <span style={{ fontSize:'0.68rem', color:sColor, fontWeight:600 }}>{scroll}%</span>
                              </div>
                            ):<span style={{ color:C.gray300, fontSize:'0.76rem' }}>—</span>}
                          </td>
                          <td style={tdStyle}>
                            {sm?(
                              <span style={{ fontSize:10, padding:'2px 7px', borderRadius:20, fontWeight:600, background:Number(sm.click_count)>0?C.amberL:C.gray100, color:Number(sm.click_count)>0?C.amber:C.gray400 }}>{sm.click_count}</span>
                            ):<span style={{ color:C.gray300, fontSize:'0.76rem' }}>—</span>}
                          </td>
                          <td style={tdStyle}>
                            <span style={{ fontSize:10, padding:'2px 7px', borderRadius:20, fontWeight:500, background:engSt.bg, color:engSt.color }}>{eng}</span>
                          </td>
                        </tr>
                      )
                    })}
                    {pageSessions.length===0&&(
                      <tr><td colSpan={10} style={{ textAlign:'center', padding:'2.5rem', color:C.gray300, fontSize:'0.85rem' }}>No sessions match your filters</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              {totalPages>1&&(
                <div style={{ display:'flex', justifyContent:'center', alignItems:'center', gap:6, marginTop:'1rem' }}>
                  <button onClick={()=>setPage(1)} disabled={page===1} style={paginBtnStyle(page===1)}>«</button>
                  <button onClick={()=>setPage(p=>p-1)} disabled={page===1} style={paginBtnStyle(page===1)}>Prev</button>
                  <span style={{ fontSize:'0.78rem', color:C.gray500, fontFamily:'DM Mono, monospace', padding:'0 6px' }}>{page} / {totalPages}</span>
                  <button onClick={()=>setPage(p=>p+1)} disabled={page>=totalPages} style={paginBtnStyle(page>=totalPages)}>Next</button>
                  <button onClick={()=>setPage(totalPages)} disabled={page>=totalPages} style={paginBtnStyle(page>=totalPages)}>»</button>
                </div>
              )}
            </Card>
          </div>
        )}

      </div>
    </div>
  )
}

// ── Responsive CSS ─────────────────────────────────────
const RESPONSIVE_CSS = `
  /* KPI strip — 6 cols on wide, 3 on tablet, 2 on mobile */
  .kpi-grid {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 0.75rem;
  }
  @media (max-width: 1100px) {
    .kpi-grid { grid-template-columns: repeat(3, 1fr); }
  }
  @media (max-width: 600px) {
    .kpi-grid { grid-template-columns: repeat(2, 1fr); gap: 0.5rem; }
  }

  /* Click KPIs — 4 cols → 2 → 2 */
  .click-kpi-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 0.75rem;
  }
  @media (max-width: 900px) {
    .click-kpi-grid { grid-template-columns: repeat(2, 1fr); }
  }

  /* Engagement top grid — 1:1.4 → stack */
  .engagement-grid {
    display: grid;
    grid-template-columns: 1fr 1.4fr;
    gap: 1rem;
  }
  @media (max-width: 860px) {
    .engagement-grid { grid-template-columns: 1fr; }
  }

  /* Traffic top — 1.4:1 → stack */
  .traffic-top-grid {
    display: grid;
    grid-template-columns: 1.4fr 1fr;
    gap: 1rem;
  }
  @media (max-width: 860px) {
    .traffic-top-grid { grid-template-columns: 1fr; }
  }

  /* Traffic bottom — 1:1 → stack */
  .traffic-bottom-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }
  @media (max-width: 860px) {
    .traffic-bottom-grid { grid-template-columns: 1fr; }
  }

  /* Day part — 4 cols → 2 → 2 */
  .daypart-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 0.75rem;
  }
  @media (max-width: 700px) {
    .daypart-grid { grid-template-columns: repeat(2, 1fr); }
  }

  /* Nav scroll on small screens */
  @media (max-width: 600px) {
    nav { padding: 0 1rem !important; }
    nav .nav-links { display: none; }
  }

  /* Table horizontal scroll always available */
  .table-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; }
`

// ── Style constants ────────────────────────────────────
const selectStyle = {
  padding:'5px 10px', borderRadius:8, border:`1px solid ${C.border}`,
  fontSize:'0.78rem', color:C.gray700, background:C.white,
  cursor:'pointer', fontFamily:'DM Sans, sans-serif',
}
const tabBtnStyle = {
  padding:'4px 12px', borderRadius:6, border:'none', cursor:'pointer',
  fontSize:'0.76rem', fontWeight:500, fontFamily:'DM Sans, sans-serif',
  transition:'all 0.15s',
}
const inputStyle = {
  padding:'5px 10px', borderRadius:8, border:`1px solid ${C.border}`,
  fontSize:'0.78rem', color:C.gray700, background:C.white,
  fontFamily:'DM Sans, sans-serif', outline:'none',
}
const thStyle = {
  color:C.gray400, fontSize:'0.66rem', textTransform:'uppercase',
  letterSpacing:'0.08em', padding:'0.45rem 0.75rem', textAlign:'left',
  fontWeight:600, whiteSpace:'nowrap',
}
const tdStyle = { padding:'0.55rem 0.75rem' }
