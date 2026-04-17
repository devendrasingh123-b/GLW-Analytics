/**
 * analyticsUtils.js
 * ─────────────────────────────────────────────────────
 * Shared design tokens, helper functions, and JS-side
 * data aggregation logic for the GLW Analytics system.
 *
 * All heavy aggregations use plain JS (no SQL) so they
 * work with Supabase's client-side data and stay fast
 * even at 100k rows via useMemo caching.
 * ─────────────────────────────────────────────────────
 */

// ─── Design Tokens ───────────────────────────────────
export const C = {
  // Primary palette
  indigo:    '#4F46E5',
  indigoD:   '#3730A3',
  indigoL:   '#EEF2FF',
  indigoM:   '#C7D2FE',
  violet:    '#7C3AED',
  violetL:   '#F5F3FF',
  cyan:      '#0891B2',
  cyanL:     '#ECFEFF',
  emerald:   '#059669',
  emeraldL:  '#ECFDF5',
  amber:     '#D97706',
  amberL:    '#FFFBEB',
  rose:      '#E11D48',
  roseL:     '#FFF1F2',
  orange:    '#EA580C',
  orangeL:   '#FFF7ED',
  // Grays
  gray50:    '#F8FAFC',
  gray100:   '#F1F5F9',
  gray200:   '#E2E8F0',
  gray300:   '#CBD5E1',
  gray400:   '#94A3B8',
  gray500:   '#64748B',
  gray600:   '#475569',
  gray700:   '#334155',
  gray800:   '#1E293B',
  gray900:   '#0F172A',
  white:     '#FFFFFF',
  border:    '#E2E8F0',
}

// Chart color sequence (for multi-series charts)
export const CHART_COLORS = [
  C.indigo, C.emerald, C.amber, C.cyan, C.violet,
  C.rose, C.orange, '#8B5CF6', '#06B6D4', '#10B981',
]

// ─── Shared CSS (inject once via <style>) ────────────
export const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,400&family=DM+Mono:wght@400;500&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #F8FAFC; font-family: 'DM Sans', sans-serif; }
  ::-webkit-scrollbar { width: 5px; height: 5px; }
  ::-webkit-scrollbar-track { background: #F1F5F9; }
  ::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 3px; }
  @keyframes fadeUp   { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
  @keyframes shimmer  { 0% { background-position:-600px 0; } 100% { background-position:600px 0; } }
  @keyframes spinR    { to { transform:rotate(360deg); } }
  @keyframes pulseDot { 0%,100%{ box-shadow:0 0 0 0 rgba(5,150,105,0.5); } 50%{ box-shadow:0 0 0 5px rgba(5,150,105,0); } }
  @keyframes slideIn  { from { opacity:0; transform:translateX(-6px); } to { opacity:1; transform:translateX(0); } }
`

// ─── Shared recharts tooltip ─────────────────────────
export function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: C.white, border: `1px solid ${C.border}`,
      borderRadius: 8, padding: '8px 12px',
      boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
      fontFamily: 'DM Sans, sans-serif', fontSize: 12,
      minWidth: 110,
    }}>
      {label !== undefined && (
        <div style={{ color: C.gray400, marginBottom: 4, fontSize: 11 }}>{label}</div>
      )}
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color || C.gray800, fontWeight: 500, marginBottom: 2 }}>
          {p.name ? <span style={{ color: C.gray500 }}>{p.name}: </span> : null}
          <span style={{ color: C.gray900 }}>{p.value?.toLocaleString()}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Parsing helpers ─────────────────────────────────
export function parseDevice(ua) {
  if (!ua) return 'Unknown'
  if (/bot|crawl|spider|headless|vercel-screenshot/i.test(ua)) return 'Bot'
  if (/Mobile|Android|iPhone/i.test(ua)) return 'Mobile'
  if (/Tablet|iPad/i.test(ua)) return 'Tablet'
  return 'Desktop'
}

export function parseReferrer(ref) {
  if (!ref) return 'Direct'
  try {
    const host = new URL(ref).hostname.replace('www.', '')
    if (host.includes('google'))   return 'Google'
    if (host.includes('amazon'))   return 'Amazon'
    if (host.includes('facebook')) return 'Facebook'
    if (host.includes('instagram'))return 'Instagram'
    if (host.includes('twitter') || host.includes('t.co')) return 'Twitter'
    if (host.includes('vercel'))   return 'Vercel'
    if (host.includes('linkedin')) return 'LinkedIn'
    return host || 'Other'
  } catch {
    return 'Other'
  }
}

export function parseDeviceIcon(device) {
  return { Mobile: '📱', Desktop: '💻', Bot: '🤖', Tablet: '📟', Unknown: '❓' }[device] || '❓'
}

// ─── Engagement scoring ───────────────────────────────
// Returns 'High' | 'Medium' | 'Low' | 'None'
export function engagementLevel(sm) {
  if (!sm) return 'None'
  const scroll = Number(sm.max_scroll_depth)
  const ms     = Number(sm.time_on_page_ms)
  const clicks = Number(sm.click_count)
  if (scroll > 0.7 && ms > 30000) return 'High'
  if (scroll > 0.4 || ms > 15000 || clicks > 0) return 'Medium'
  return 'Low'
}

// Engagement badge style
export function engagementStyle(level) {
  return {
    High:   { color: C.emerald, bg: C.emeraldL },
    Medium: { color: C.amber,   bg: C.amberL   },
    Low:    { color: C.rose,    bg: C.roseL     },
    None:   { color: C.gray400, bg: C.gray100   },
  }[level] || { color: C.gray400, bg: C.gray100 }
}

// ─── CTA detection ────────────────────────────────────
const CTA_KEYWORDS = [
  'buy','purchase','order','get','start','sign up','signup','register',
  'subscribe','book','contact','try','free','demo','learn more','shop',
  'download','explore','join','claim','apply',
]
export function isCTA(text = '') {
  const t = text.toLowerCase()
  return CTA_KEYWORDS.some(kw => t.includes(kw))
}

// ─── Date range filter ────────────────────────────────
export function filterByDays(rows, days, dateField = 'started_at_ist') {
  if (!days) return rows
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  return rows.filter(r => new Date(r[dateField]) >= cutoff)
}

// ─── Aggregation helpers ──────────────────────────────

/** Count occurrences of a key in an array, return sorted [{name, value}] */
export function countBy(arr, keyFn, limit = 0) {
  const m = {}
  arr.forEach(item => {
    const k = keyFn(item)
    if (k) m[k] = (m[k] || 0) + 1
  })
  let result = Object.entries(m)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
  if (limit) result = result.slice(0, limit)
  return result
}

/** Average a numeric field */
export function avgField(arr, fieldFn) {
  if (!arr.length) return 0
  return arr.reduce((s, x) => s + Number(fieldFn(x)), 0) / arr.length
}

/**
 * Build page-level analytics by joining sessions → summaries
 * Returns [{page, sessions, avgDuration, avgScroll, bounces, bounceRate}]
 */
export function buildPageStats(sessions, summaryMap) {
  const pages = {}
  sessions.forEach(s => {
    const page = s.path || '/'
    if (!pages[page]) pages[page] = { page, sessions: 0, totalMs: 0, totalScroll: 0, withSummary: 0, bounces: 0 }
    const p  = pages[page]
    const sm = summaryMap[s.id]
    p.sessions++
    if (sm) {
      p.totalMs    += Number(sm.time_on_page_ms)
      p.totalScroll+= Number(sm.max_scroll_depth)
      p.withSummary++
      if (Number(sm.click_count) === 0) p.bounces++
    } else {
      p.bounces++
    }
  })
  return Object.values(pages)
    .map(p => ({
      ...p,
      avgDuration: p.withSummary ? Math.round(p.totalMs  / p.withSummary / 1000) : 0,
      avgScroll:   p.withSummary ? Math.round(p.totalScroll / p.withSummary * 100) : 0,
      bounceRate:  p.sessions    ? Math.round(p.bounces / p.sessions * 100) : 0,
    }))
    .sort((a, b) => b.sessions - a.sessions)
}

/**
 * Build click analytics from click_events
 * Returns grouped data for text, tag, href, analytics_id
 */
export function buildClickStats(clicks) {
  const byText = countBy(clicks, c => c.target_text?.trim() || null, 20)
  const byTag  = countBy(clicks, c => c.target_tag?.toLowerCase() || null)
  const byHref = countBy(
    clicks.filter(c => c.target_href),
    c => {
      try { return new URL(c.target_href).pathname + new URL(c.target_href).search } catch { return c.target_href }
    },
    15
  )
  const byId   = countBy(clicks, c => c.target_analytics_id || null, 15)
  const ctaClicks = clicks.filter(c => isCTA(c.target_text || ''))

  return { byText, byTag, byHref, byId, ctaClicks, total: clicks.length }
}

/**
 * Build hourly traffic distribution
 * Returns [{hour, label, sessions, clicks}] for 0-23
 */
export function buildHourlyStats(sessions, clicks) {
  const hourSessions = Array(24).fill(0)
  const hourClicks   = Array(24).fill(0)

  sessions.forEach(s => {
    const h = new Date(s.started_at_ist).getHours()
    if (h >= 0 && h < 24) hourSessions[h]++
  })
  clicks.forEach(c => {
    const h = new Date(c.occurred_at_ist).getHours()
    if (h >= 0 && h < 24) hourClicks[h]++
  })

  return Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    label: h === 0 ? '12am' : h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h - 12}pm`,
    sessions: hourSessions[h],
    clicks: hourClicks[h],
  }))
}

/**
 * Generate automatic marketing insights
 * Returns [{type, text, severity}]
 */
export function generateInsights({ sessions, summaryMap, clicks, pageStats }) {
  const ins = []
  const total    = sessions.length
  if (!total) return [{ type: 'info', text: 'Not enough data yet. Insights will appear once sessions are recorded.' }]

  // Device mix
  const mobileCount  = sessions.filter(s => parseDevice(s.user_agent) === 'Mobile').length
  const desktopCount = sessions.filter(s => parseDevice(s.user_agent) === 'Desktop').length
  const mobilePct    = Math.round(mobileCount / total * 100)
  if (mobilePct >= 55)
    ins.push({ type: 'info', icon: '📱',
      text: `${mobilePct}% of traffic is mobile. Ensure your primary CTAs are above the fold and easy to tap.` })
  else if (desktopCount > mobileCount && mobilePct > 0)
    ins.push({ type: 'info', icon: '💻',
      text: `Majority traffic is Desktop (${Math.round(desktopCount/total*100)}%). Optimize layout for larger screens and consider hover interactions.` })

  // Bounce rate
  const bounced    = sessions.filter(s => { const sm = summaryMap[s.id]; return !sm || Number(sm.click_count) === 0 }).length
  const bounceRate = Math.round(bounced / total * 100)
  if (bounceRate >= 65)
    ins.push({ type: 'warning', icon: '↩️',
      text: `Bounce rate is ${bounceRate}% — very high. Users are leaving without clicking anything. Review your landing page hook.` })
  else if (bounceRate <= 25)
    ins.push({ type: 'success', icon: '✅',
      text: `Low bounce rate (${bounceRate}%). Visitors are exploring the site — good content engagement.` })

  // Avg time
  const summaries = Object.values(summaryMap)
  if (summaries.length) {
    const avgMs = summaries.reduce((a, b) => a + Number(b.time_on_page_ms), 0) / summaries.length
    const avgS  = Math.round(avgMs / 1000)
    if (avgS < 8)
      ins.push({ type: 'warning', icon: '⏱️',
        text: `Average session time is just ${avgS}s. Users may be bouncing before they understand your offer.` })
    else if (avgS > 60)
      ins.push({ type: 'success', icon: '⏱️',
        text: `Strong avg. time on page (${avgS}s). Users are reading your content thoroughly.` })
  }

  // Peak hour insight
  const hourSessions = Array(24).fill(0)
  sessions.forEach(s => {
    const h = new Date(s.started_at_ist).getHours()
    if (h >= 0 && h < 24) hourSessions[h]++
  })
  const peakHour = hourSessions.indexOf(Math.max(...hourSessions))
  const peakCount = hourSessions[peakHour]
  if (peakCount > 0) {
    const label = peakHour === 0 ? '12am' : peakHour < 12 ? `${peakHour}am` : peakHour === 12 ? '12pm' : `${peakHour - 12}pm`
    ins.push({ type: 'tip', icon: '⏰',
      text: `Peak traffic hour is ${label} with ${peakCount} session${peakCount > 1 ? 's' : ''}. Schedule campaigns and posts to go live 30 min before.` })
  }

  // Evening vs daytime split
  const eveningSessions = hourSessions.slice(18, 24).reduce((a, b) => a + b, 0)
  const daySessions     = hourSessions.slice(9, 18).reduce((a, b) => a + b, 0)
  const eveningPct = total ? Math.round(eveningSessions / total * 100) : 0
  if (eveningPct >= 40)
    ins.push({ type: 'info', icon: '🌙',
      text: `${eveningPct}% of sessions happen in the evening (6pm–12am). Evening is prime time — boost your ad spend after 6pm.` })
  else if (daySessions > eveningSessions)
    ins.push({ type: 'info', icon: '☀️',
      text: `Most sessions happen during daytime (9am–6pm). Publish content and run promotions in business hours for max reach.` })

  // Top CTA — cleaned platform name
  const ctaMap = {}
  clicks.filter(c => isCTA(c.target_text || '')).forEach(c => {
    const raw = c.target_text?.trim()
    if (!raw) return
    // Strip "BUY NOW" and get platform
    const cleaned = raw.replace(/buy now/gi, '').replace(/buy/gi, '').replace(/\s+/g, ' ').trim()
    if (cleaned && cleaned.length < 30) ctaMap[cleaned] = (ctaMap[cleaned] || 0) + 1
  })
  const topCTA = Object.entries(ctaMap).sort((a, b) => b[1] - a[1])[0]
  if (topCTA)
    ins.push({ type: 'tip', icon: '🎯',
      text: `Top platform CTA: "${topCTA[0]}" clicked ${topCTA[1]} time${topCTA[1] > 1 ? 's' : ''}. Prioritise its placement and A/B test button copy.` })

  // Platform preference
  const platformMap = {}
  clicks.filter(c => isCTA(c.target_text || '')).forEach(c => {
    const raw = c.target_text?.trim() || ''
    const cleaned = raw.replace(/buy now/gi, '').replace(/buy/gi, '').replace(/\s+/g, ' ').trim()
    if (cleaned && cleaned.length < 30) platformMap[cleaned] = (platformMap[cleaned] || 0) + 1
  })
  const sortedPlatforms = Object.entries(platformMap).sort((a, b) => b[1] - a[1])
  if (sortedPlatforms.length >= 2) {
    const top = sortedPlatforms[0]
    const second = sortedPlatforms[1]
    ins.push({ type: 'success', icon: '🛒',
      text: `${top[0]} is your top purchase platform (${top[1]} clicks), followed by ${second[0]} (${second[1]} clicks). Prioritize product listing on ${top[0]}.` })
  }

  // Low-engagement page
  const lowPage = pageStats
    .filter(p => p.sessions >= 3)
    .sort((a, b) => b.bounceRate - a.bounceRate)[0]
  if (lowPage && lowPage.bounceRate >= 70)
    ins.push({ type: 'warning', icon: '📄',
      text: `Page "${lowPage.page}" has a ${lowPage.bounceRate}% bounce rate across ${lowPage.sessions} sessions. Consider improving the content or CTA placement.` })

  // Best page
  const bestPage = pageStats
    .filter(p => p.sessions >= 3)
    .sort((a, b) => b.avgScroll - a.avgScroll)[0]
  if (bestPage && bestPage.avgScroll >= 70)
    ins.push({ type: 'success', icon: '🔥',
      text: `"${bestPage.page}" has avg. scroll depth of ${bestPage.avgScroll}% — your best-performing page. Model other pages after it.` })

  // Traffic source insight
  const sourceMap = {}
  sessions.forEach(s => { const r = parseReferrer(s.referrer); sourceMap[r] = (sourceMap[r] || 0) + 1 })
  const topSource = Object.entries(sourceMap).sort((a, b) => b[1] - a[1])[0]
  if (topSource && topSource[0] !== 'Direct')
    ins.push({ type: 'info', icon: '🌐',
      text: `Top traffic source is ${topSource[0]} (${topSource[1]} sessions). Strengthen this channel — it's bringing the most visitors.` })
  else if (topSource && topSource[0] === 'Direct')
    ins.push({ type: 'success', icon: '🔗',
      text: `Most traffic is Direct (${topSource[1]} sessions) — strong brand recall. Consider adding UTM links to identify organic channels better.` })

  // Bot traffic
  const botCount = sessions.filter(s => parseDevice(s.user_agent) === 'Bot').length
  if (botCount > total * 0.15)
    ins.push({ type: 'warning', icon: '🤖',
      text: `${Math.round(botCount/total*100)}% of sessions are bots/crawlers (${botCount} sessions). Filter these from paid reports.` })

  // High engagement rate
  const highEngCount = summaries.filter(s => Number(s.max_scroll_depth) > 0.7 && Number(s.time_on_page_ms) > 30000).length
  const highEngPct   = total ? Math.round(highEngCount / total * 100) : 0
  if (highEngPct >= 30)
    ins.push({ type: 'success', icon: '🔥',
      text: `${highEngPct}% of sessions are highly engaged (scroll>70% & 30s+). Your content is resonating well — keep the current format.` })

  return ins
}

// ─── Small reusable UI components ────────────────────

export function Card({ children, style = {} }) {
  return (
    <div style={{
      background: C.white, borderRadius: 12,
      border: `1px solid ${C.border}`,
      padding: '1.25rem 1.5rem',
      boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
      ...style,
    }}>
      {children}
    </div>
  )
}

export function CardHeader({ title, sub, badge, badgeColor, badgeBg, action }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
      <div>
        <div style={{ fontWeight: 600, fontSize: '0.9rem', color: C.gray800 }}>{title}</div>
        {sub && <div style={{ fontSize: '0.72rem', color: C.gray400, marginTop: 2 }}>{sub}</div>}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {badge && (
          <span style={{
            fontSize: 11, padding: '3px 10px', borderRadius: 20, fontWeight: 500,
            background: badgeBg || C.indigoL, color: badgeColor || C.indigo,
          }}>{badge}</span>
        )}
        {action}
      </div>
    </div>
  )
}

export function KPICard({ icon, label, value, sub, color, bgColor, trend }) {
  return (
    <div style={{
      background: C.white, borderRadius: 12, border: `1px solid ${C.border}`,
      padding: '1.1rem 1.25rem',
      boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
      transition: 'box-shadow 0.2s',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: bgColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>{icon}</div>
        {trend !== undefined && (
          <span style={{ fontSize: 11, fontWeight: 600, color: trend >= 0 ? C.emerald : C.rose, background: trend >= 0 ? C.emeraldL : C.roseL, padding: '2px 7px', borderRadius: 20 }}>
            {trend >= 0 ? '↑' : '↓'}{Math.abs(trend)}%
          </span>
        )}
      </div>
      <div style={{ fontSize: '1.6rem', fontWeight: 600, color: C.gray900, lineHeight: 1, letterSpacing: '-0.02em' }}>{value}</div>
      <div style={{ fontSize: '0.78rem', color: C.gray500, marginTop: 3 }}>{label}</div>
      {sub && <div style={{ fontSize: '0.7rem', color: C.gray400, marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

export function InsightPill({ type = 'info', icon, text }) {
  const styles = {
    warning: { border: C.amber,   bg: C.amberL   },
    success: { border: C.emerald, bg: C.emeraldL  },
    tip:     { border: C.indigo,  bg: C.indigoL   },
    info:    { border: C.cyan,    bg: C.cyanL      },
  }
  const s = styles[type] || styles.info
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 10,
      background: s.bg, border: `1px solid ${s.border}33`,
      borderRadius: 10, padding: '0.7rem 1rem',
    }}>
      {icon && <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>{icon}</span>}
      <p style={{ color: C.gray700, fontSize: '0.82rem', lineHeight: 1.5 }}>{text}</p>
    </div>
  )
}

export function SkeletonCard({ h = 110 }) {
  return (
    <div style={{
      background: C.white, borderRadius: 12, border: `1px solid ${C.border}`,
      height: h,
      backgroundImage: 'linear-gradient(90deg,#F1F5F9 25%,#E8EEF5 50%,#F1F5F9 75%)',
      backgroundSize: '600px 100%',
      animation: 'shimmer 1.4s infinite linear',
    }} />
  )
}

export function Spinner() {
  return (
    <div style={{ width: 28, height: 28, border: `3px solid ${C.indigoM}`, borderTopColor: C.indigo, borderRadius: '50%', animation: 'spinR 0.7s linear infinite' }} />
  )
}

// Pagination button style helper
export function paginBtnStyle(disabled) {
  return {
    padding: '5px 13px', borderRadius: 8, border: `1px solid ${disabled ? C.gray100 : C.border}`,
    background: disabled ? C.gray50 : C.white, color: disabled ? C.gray300 : C.gray600,
    cursor: disabled ? 'not-allowed' : 'pointer', fontSize: '0.8rem',
    fontFamily: 'DM Sans, sans-serif', transition: 'all 0.15s',
  }
}