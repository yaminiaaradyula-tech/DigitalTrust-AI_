import { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  ArrowUpRight,
  Bell,
  Building2,
  Check,
  ChevronDown,
  CircleHelp,
  Download,
  Fingerprint,
  LayoutDashboard,
  Menu,
  Radio,
  Search,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  X,
} from 'lucide-react'
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import { getDashboardSnapshot } from './api'
import './App.css'

const navigation = [
  { label: 'Dashboard', icon: LayoutDashboard },
  { label: 'Brand Profile', icon: Building2 },
  { label: 'Social Monitoring', icon: Radio },
  { label: 'App Monitoring', icon: Smartphone },
  { label: 'Alerts', icon: Bell },
]

const metricCards = [
  {
    label: 'Registered brands',
    key: 'registered_brands',
    change: 'In this workspace',
    icon: Building2,
    tone: 'blue',
  },
  {
    label: 'Social profiles scanned',
    key: 'social_profiles_scanned',
    change: 'Connected API records',
    icon: Fingerprint,
    tone: 'cyan',
  },
  {
    label: 'Apps scanned',
    key: 'apps_scanned',
    change: 'Connected API records',
    icon: Smartphone,
    tone: 'violet',
  },
  {
    label: 'Suspicious detections',
    key: 'suspicious_detections',
    change: 'Current findings',
    icon: ShieldAlert,
    tone: 'amber',
  },
]

function MetricCard({ metric }) {
  const Icon = metric.icon

  return (
    <article className="metric-card">
      <div className={`metric-icon ${metric.tone}`}><Icon size={18} /></div>
      <p className="metric-label">{metric.label}</p>
      <div className="metric-value-row">
        <strong className="metric-value">{metric.value}</strong>
        <span className="metric-change"><span className="metric-change-dot" />{metric.change}</span>
      </div>
    </article>
  )
}

function RiskBadge({ risk }) {
  return <span className={`risk-badge ${risk.toLowerCase()}`}><span />{risk}</span>
}

function RiskDistribution({ riskData, dataMode }) {
  const total = riskData.reduce((sum, item) => sum + item.value, 0)

  return (
    <section className="panel risk-panel" aria-labelledby="risk-title">
      <div className="panel-heading">
        <div>
          <h2 id="risk-title">Risk distribution</h2>
          <p>Detections by severity</p>
        </div>
        <button className="icon-button subtle-button" type="button" aria-label="Risk distribution information" title="Risk distribution information">
          <CircleHelp size={16} />
        </button>
      </div>
      <div className="risk-content">
        <div className="donut-wrap">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={riskData}
                dataKey="value"
                nameKey="name"
                innerRadius="72%"
                outerRadius="94%"
                paddingAngle={4}
                stroke="none"
                startAngle={90}
                endAngle={-270}
              >
                {riskData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
              </Pie>
              <Tooltip
                contentStyle={{ background: '#111d30', border: '1px solid #26354b', borderRadius: 8, color: '#edf3fc', fontSize: 12 }}
                itemStyle={{ color: '#edf3fc' }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="donut-center"><strong>{total}</strong><span>total findings</span></div>
        </div>
        <div className="risk-legend">
          {riskData.map((item) => (
            <div className="legend-row" key={item.name}>
              <span className="legend-name"><i style={{ backgroundColor: item.color }} />{item.name}</span>
              <strong>{item.value}<span>{Math.round((item.value / total) * 100)}%</span></strong>
            </div>
          ))}
        </div>
      </div>
      <div className="risk-footnote"><Activity size={14} />{dataMode === 'DEMO' ? 'Backend demo records · not live monitoring' : 'Connected backend records'}</div>
    </section>
  )
}

function DetectionTable({ rows, loading }) {
  return (
    <div className="table-scroll">
      <table className="detections-table">
        <thead>
          <tr><th>Profile / app</th><th>Type</th><th>Risk score</th><th>Reason</th><th>Status</th></tr>
        </thead>
        <tbody>
          {rows.map((detection) => (
            <tr key={detection.name}>
              <td>
                <div className="entity-cell">
                  <span className={`entity-avatar ${detection.color}`}>{detection.initials}</span>
                  <span className="entity-text"><strong>{detection.name}</strong><small>{detection.detail}</small></span>
                </div>
              </td>
              <td><span className="type-label">{detection.type}</span></td>
              <td><div className="score-cell"><strong>{detection.score}</strong><span className="score-track"><i className={detection.risk.toLowerCase()} style={{ width: `${detection.score}%` }} /></span><RiskBadge risk={detection.risk} /></div></td>
              <td className="reason-cell">{detection.reason}</td>
              <td><span className={`status-label ${detection.status.toLowerCase().replace(' ', '-')}`}><i />{detection.status}</span></td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td className="empty-state" colSpan="5">{loading ? 'Loading findings from the connected API…' : 'No findings match your search.'}</td></tr>}
        </tbody>
      </table>
    </div>
  )
}

function downloadReport(rows) {
  const columns = ['Name', 'Type', 'Risk score', 'Risk level', 'Reason', 'Status']
  const csvRows = rows.map(({ name, type, score, risk, reason, status }) => [name, type, score, risk, reason, status])
  const csv = [columns, ...csvRows].map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = 'brandshield-demo-detections.csv'
  link.click()
  URL.revokeObjectURL(url)
}

function App() {
  const [activePage, setActivePage] = useState('Dashboard')
  const [search, setSearch] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [snapshot, setSnapshot] = useState(null)
  const [apiStatus, setApiStatus] = useState('loading')
  const [apiError, setApiError] = useState('')
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    const controller = new AbortController()

    getDashboardSnapshot(controller.signal)
      .then((data) => {
        setSnapshot(data)
        setApiStatus('connected')
      })
      .catch((error) => {
        if (error.name === 'AbortError') return
        setApiError(error.message)
        setApiStatus('offline')
      })

    return () => controller.abort()
  }, [retryCount])

  const filteredDetections = useMemo(() => {
    const query = search.trim().toLowerCase()
    const rows = snapshot?.detections || []
    if (!query) return rows
    return rows.filter((detection) => Object.values(detection).some((value) => String(value).toLowerCase().includes(query)))
  }, [search, snapshot])
  const summary = snapshot?.summary
  const riskData = snapshot?.riskData || []
  const metrics = metricCards.map((metric) => ({
    ...metric,
    value: summary ? Number(summary[metric.key] || 0).toLocaleString() : apiStatus === 'loading' ? '...' : '--',
  }))
  const alertCount = summary?.suspicious_detections || 0
  const brandName = snapshot?.brands?.[0]?.name || 'Brand workspace'
  const dataMode = snapshot?.dataMode || 'API'

  return (
    <div className="app-shell">
      {sidebarOpen && <button className="mobile-scrim" type="button" aria-label="Close navigation" onClick={() => setSidebarOpen(false)} />}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="brand-lockup">
          <div className="brand-mark"><ShieldCheck size={21} strokeWidth={2.2} /></div>
          <div><strong>BrandShield<span>AI</span></strong><small>THREAT INTELLIGENCE</small></div>
          <button className="icon-button close-sidebar" type="button" aria-label="Close navigation" onClick={() => setSidebarOpen(false)}><X size={18} /></button>
        </div>
        <div className="workspace-switcher"><span className="workspace-avatar">{brandName.charAt(0).toUpperCase()}</span><span><strong>{brandName}</strong><small>Connected workspace</small></span><ChevronDown size={15} /></div>
        <nav className="side-nav" aria-label="Main navigation">
          <p className="nav-caption">WORKSPACE</p>
          {navigation.map(({ label, icon: Icon }) => (
            <button key={label} className={`nav-item ${activePage === label ? 'active' : ''}`} type="button" onClick={() => { setActivePage(label); setSidebarOpen(false) }} aria-current={activePage === label ? 'page' : undefined}>
              <Icon size={18} strokeWidth={1.8} /><span>{label}</span>{label === 'Alerts' && alertCount > 0 && <small className="nav-count">{alertCount}</small>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="plan-card"><div className="plan-top"><span>{apiStatus === 'connected' ? `${dataMode} API` : apiStatus === 'loading' ? 'CONNECTING API' : 'API OFFLINE'}</span><span className={`plan-dot ${apiStatus}`} /></div><strong>Protection overview</strong><p>{dataMode === 'DEMO' ? 'Backend data is simulated. External accounts are not being monitored.' : 'External account monitoring depends on configured integrations.'}</p><div className="plan-progress"><i /></div><small>{apiStatus === 'connected' ? 'Backend connected' : apiStatus === 'loading' ? 'Connecting to backend' : 'Backend unavailable'}</small></div>
          <button className="help-link" type="button"><CircleHelp size={16} />Help center<ArrowUpRight size={14} /></button>
          <div className="profile-row"><span className="profile-avatar">JD</span><span><strong>Jordan Davis</strong><small>Workspace admin</small></span><button className="icon-button profile-more" type="button" aria-label="Account options"><ChevronDown size={15} /></button></div>
        </div>
      </aside>

      <main className="main-area" id="dashboard">
        <header className="topbar">
          <button className="icon-button mobile-menu" type="button" aria-label="Open navigation" onClick={() => setSidebarOpen(true)}><Menu size={20} /></button>
          <div className="breadcrumbs"><span>Workspace</span><i>/</i><strong>{activePage}</strong></div>
          <div className="topbar-actions"><span className={`demo-chip ${apiStatus}`}><span />{apiStatus === 'loading' ? 'CONNECTING API' : apiStatus === 'offline' ? 'API OFFLINE' : dataMode === 'DEMO' ? 'DEMO DATA' : 'API CONNECTED'}</span><span className="topbar-divider" /><button className="icon-button notification-button" type="button" aria-label="Notifications"><Bell size={18} /><i /></button><span className="top-avatar">JD</span></div>
        </header>

        {activePage === 'Dashboard' ? (
          <div className="page-content">
            <section className="welcome-row">
              <div><div className="eyebrow"><span />SECURITY OVERVIEW</div><h1>{brandName} protection overview</h1><p>Dashboard metrics and findings loaded from your BrandShield backend.</p></div>
              <div className="welcome-actions"><span className={`snapshot-label ${apiStatus}`}><span />{apiStatus === 'connected' ? `${dataMode} API · backend snapshot` : apiStatus === 'loading' ? 'Connecting to backend' : 'Backend unavailable'}</span><button className="button-secondary" type="button" onClick={() => downloadReport(filteredDetections)} disabled={!snapshot}><Download size={15} />Export report</button></div>
            </section>

            {apiStatus === 'offline' && <div className="api-error" role="alert"><div><strong>Could not load backend data</strong><span>{apiError || 'Check that the FastAPI server is running.'}</span></div><button className="button-secondary" type="button" onClick={() => { setApiStatus('loading'); setApiError(''); setRetryCount((count) => count + 1) }}>Retry connection</button></div>}

            <section className="metrics-grid" aria-label="Dashboard metrics">{metrics.map((metric) => <MetricCard key={metric.label} metric={metric} />)}</section>

            <section className="overview-grid">
              <RiskDistribution riskData={riskData} dataMode={dataMode} />
              <section className="panel activity-panel" aria-labelledby="activity-title">
                <div className="panel-heading"><div><h2 id="activity-title">Source coverage</h2><p>Records returned by the connected API</p></div><span className={`source-status ${apiStatus}`}><i />{apiStatus === 'connected' ? 'Connected' : apiStatus === 'loading' ? 'Loading' : 'Offline'}</span></div>
                <div className="activity-chart" aria-label={`API records: ${summary?.social_profiles_scanned || 0} social profiles and ${summary?.apps_scanned || 0} apps`}>
                  <div className="chart-y-labels"><span>{Math.max(summary?.social_profiles_scanned || 0, summary?.apps_scanned || 0, 1)}</span><span>{Math.ceil(Math.max(summary?.social_profiles_scanned || 0, summary?.apps_scanned || 0, 1) / 2)}</span><span>0</span></div>
                  <div className="chart-plot"><div className="chart-grid"><i /><i /><i /></div><div className="chart-bars">{[
                    { label: 'Social profiles', value: summary?.social_profiles_scanned || 0 },
                    { label: 'Mobile apps', value: summary?.apps_scanned || 0 },
                  ].map((source) => {
                    const max = Math.max(summary?.social_profiles_scanned || 0, summary?.apps_scanned || 0, 1)
                    return <div className="bar-column" key={source.label}><i style={{ height: `${Math.max(source.value / max * 88, 4)}%` }} /><span>{source.label}</span></div>
                  })}</div></div>
                </div>
                <div className="activity-footnote"><span><i />Social and app records</span><small>{dataMode === 'DEMO' ? 'Simulated backend data' : 'Backend response'}</small></div>
              </section>
            </section>

            <section className="panel detections-panel" aria-labelledby="detections-title">
              <div className="detections-heading"><div><div className="title-with-count"><h2 id="detections-title">Recent detections</h2><span>{filteredDetections.length}</span></div><p>Potential impersonation activity across monitored channels</p></div><div className="table-actions"><label className="search-box"><Search size={15} /><input type="search" placeholder="Search detections" value={search} onChange={(event) => setSearch(event.target.value)} /></label><button className="filter-button" type="button" aria-label="Filter detections"><ChevronDown size={15} /></button></div></div>
              <DetectionTable rows={filteredDetections} loading={apiStatus === 'loading'} />
              <div className="table-footer"><span>Showing <strong>{filteredDetections.length ? 1 : 0}-{filteredDetections.length}</strong> of <strong>{snapshot?.detections.length || 0}</strong> API detections</span><span className="table-demo-note"><Check size={13} />{dataMode === 'DEMO' ? 'Backend demo records' : 'Backend records'}</span></div>
            </section>

            <footer className="page-footer"><span><ShieldCheck size={14} />BrandShield AI</span><span>{apiStatus === 'connected' ? `${dataMode} backend · External monitoring not active` : 'External monitoring not active'}</span></footer>
          </div>
        ) : (
          <section className="preview-state"><div className="preview-icon"><ShieldCheck size={25} /></div><span className="eyebrow"><span />DEMO WORKSPACE</span><h1>{activePage}</h1><p>This workspace section is a preview. Data integrations and live monitoring are not connected.</p><button className="button-secondary" type="button" onClick={() => setActivePage('Dashboard')}><LayoutDashboard size={15} />Back to dashboard</button></section>
        )}
      </main>
    </div>
  )
}

export default App
