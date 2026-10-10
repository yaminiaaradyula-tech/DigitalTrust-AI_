const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')

async function getJson(path, signal) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    headers: { Accept: 'application/json' },
    signal,
  })

  if (!response.ok) {
    throw new Error(`API request failed (${response.status}) for ${path}`)
  }

  return response.json()
}

function normalizeDetection(item) {
  const isApp = Boolean(item.app_name)
  const name = item.profile_name || item.app_name || item.brand || 'Unknown finding'
  const risk = item.risk_level || 'Low'

  return {
    name,
    detail: item.url || [item.store, item.publisher].filter(Boolean).join(' · ') || item.platform || '',
    type: isApp ? 'Mobile app' : 'Social profile',
    score: Math.round(Number(item.similarity_score) || 0),
    risk,
    reason: item.reason || 'Review this finding',
    status: risk === 'High' ? 'Flagged' : risk === 'Medium' ? 'Under review' : 'Monitoring',
    initials: (item.brand || name).trim().charAt(0).toUpperCase(),
    color: risk === 'High' ? 'coral' : risk === 'Medium' ? 'gold' : 'mint',
  }
}

export async function getDashboardSnapshot(signal) {
  const [summary, detections, socialProfiles, apps, brands, health] = await Promise.all([
    getJson('/api/dashboard', signal),
    getJson('/api/detections', signal),
    getJson('/api/social', signal),
    getJson('/api/apps', signal),
    getJson('/api/brands', signal),
    getJson('/api/health', signal),
  ])
  const allRecords = [...socialProfiles, ...apps]
  const riskData = [
    { name: 'High risk', value: allRecords.filter((item) => item.risk_level === 'High').length, color: '#ff6878' },
    { name: 'Medium risk', value: allRecords.filter((item) => item.risk_level === 'Medium').length, color: '#f3b94f' },
    { name: 'Low risk', value: allRecords.filter((item) => item.risk_level === 'Low').length, color: '#36c99a' },
  ]

  return {
    summary,
    detections: detections.map(normalizeDetection),
    riskData,
    brands,
    dataMode: health.data_mode || summary.data_mode || 'API',
  }
}