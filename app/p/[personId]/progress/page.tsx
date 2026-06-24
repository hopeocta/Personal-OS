'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

const MONO  = "'Space Mono', monospace"
const SERIF = "system-ui, -apple-system, sans-serif"

const MO = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez']

function weekLabel(wk: string) {
  const d = new Date(wk + 'T12:00:00')
  const end = new Date(wk + 'T12:00:00')
  end.setDate(end.getDate() + 6)
  return `${d.getDate()}. ${MO[d.getMonth()]}`
}

function TssBar({ plan, ist, max }: { plan: number; ist: number; max: number }) {
  const pct = (v: number) => Math.min(100, Math.round(v / max * 100))
  const over = ist > plan
  return (
    <div style={{ position: 'relative', height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.06)', width: '100%', minWidth: 60 }}>
      <div style={{
        position: 'absolute', left: 0, top: 0, height: '100%', borderRadius: 3,
        width: `${pct(plan)}%`, background: 'rgba(196,151,58,0.25)',
      }} />
      <div style={{
        position: 'absolute', left: 0, top: 0, height: '100%', borderRadius: 3,
        width: `${pct(ist)}%`,
        background: over ? '#C45A3A' : '#3D9B78',
        opacity: 0.85,
      }} />
    </div>
  )
}

function SimpleBar({ value, max, color }: { value: number; max: number; color: string }) {
  return (
    <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.06)', width: '100%', minWidth: 60 }}>
      <div style={{
        height: '100%', borderRadius: 3,
        width: `${Math.min(100, Math.round(value / max * 100))}%`,
        background: color, opacity: 0.75,
      }} />
    </div>
  )
}

type TpWeek = {
  week: string; tss_plan: number; tss_ist: number
  run_hr_avg: number | null; bike_np_avg: number | null
  bike_if_avg: number | null; rpe_avg: number | null
  planned: number; done: number; compliance: number | null
}

type GarminWeek = {
  week: string; activities: number; total_min: number
  run_hr_avg: number | null; bike_np_avg: number | null; bike_hr_avg: number | null
  ctl: number | null; vo2max: number | null
  planned: number; done: number; compliance: number | null
}

type ProgressData =
  | { dataSource: 'tp';     weeks: TpWeek[];     person: { ftp_w: number | null; lthr_run: number | null; lthr_bike: number | null } }
  | { dataSource: 'garmin'; weeks: GarminWeek[]; person: { ftp_w: number | null; lthr_run: number | null; lthr_bike: number | null } }

export default function ProgressPage() {
  const { personId } = useParams<{ personId: string }>()
  const dark = personId !== 'p1'

  const BG     = dark ? '#0B1520'  : '#F2EDE4'
  const CARD   = dark ? '#111E30'  : '#FFFFFF'
  const BORDER = dark ? 'rgba(255,255,255,0.06)' : '#E8E0D4'
  const TEXT   = dark ? '#D8CFC0'  : '#2A3828'
  const DIM    = dark ? '#5A7A9A'  : '#8A8070'
  const ACC    = dark ? '#C4973A'  : '#2D7A5F'

  const [data, setData]       = useState<ProgressData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/p/${personId}/progress?weeks=12`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [personId])

  if (loading) return (
    <div style={{ textAlign: 'center', marginTop: '4rem', color: DIM, fontFamily: MONO, fontSize: 12 }}>
      LADEN…
    </div>
  )
  if (!data) return <div style={{ color: DIM, fontFamily: MONO, fontSize: 12 }}>Keine Daten</div>

  // ── TP-View (Markus) ───────────────────────────────────
  if (data.dataSource === 'tp') {
    const weeks = data.weeks
    const maxTss = Math.max(...weeks.map(w => Math.max(w.tss_plan, w.tss_ist)), 100)
    const maxNp  = Math.max(...weeks.map(w => w.bike_np_avg ?? 0), 100)

    // Trend: NP letzte 4 vs erste 4 Wochen
    const first4 = weeks.slice(0, 4).map(w => w.bike_np_avg).filter(Boolean) as number[]
    const last4  = weeks.slice(-4).map(w => w.bike_np_avg).filter(Boolean) as number[]
    const npTrend = first4.length && last4.length
      ? Math.round((last4.reduce((a,b)=>a+b,0)/last4.length) - (first4.reduce((a,b)=>a+b,0)/first4.length))
      : null

    const hrFirst4 = weeks.slice(0, 4).map(w => w.run_hr_avg).filter(Boolean) as number[]
    const hrLast4  = weeks.slice(-4).map(w => w.run_hr_avg).filter(Boolean) as number[]
    const hrTrend  = hrFirst4.length && hrLast4.length
      ? Math.round((hrLast4.reduce((a,b)=>a+b,0)/hrLast4.length) - (hrFirst4.reduce((a,b)=>a+b,0)/hrFirst4.length))
      : null

    return (
      <div style={{ color: TEXT, fontFamily: SERIF }}>

        {/* KPI-Karten */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 20 }}>
          {[
            {
              label: 'RAD-WATT TREND',
              value: npTrend != null ? `${npTrend > 0 ? '+' : ''}${npTrend}W` : '—',
              sub: 'Ø NP letzte 4 vs erste 4 Wochen',
              col: npTrend != null ? (npTrend >= 0 ? '#3D9B78' : '#C45A3A') : DIM,
            },
            {
              label: 'LAUF-HF TREND',
              value: hrTrend != null ? `${hrTrend > 0 ? '+' : ''}${hrTrend} bpm` : '—',
              sub: 'HF sinkt = aerob effizienter',
              col: hrTrend != null ? (hrTrend <= 0 ? '#3D9B78' : '#C45A3A') : DIM,
            },
            {
              label: 'COMPLIANCE',
              value: weeks.length
                ? `${Math.round(weeks.filter(w => w.compliance != null).reduce((s, w) => s + (w.compliance ?? 0), 0) / weeks.filter(w => w.compliance != null).length)}%`
                : '—',
              sub: 'Einheiten gemacht',
              col: ACC,
            },
          ].map(k => (
            <div key={k.label} style={{
              background: CARD, borderRadius: 8, padding: '10px 10px 8px',
              border: `1px solid ${BORDER}`, borderLeft: `3px solid ${k.col}`,
            }}>
              <div style={{ fontFamily: MONO, fontSize: 8, color: DIM, letterSpacing: '0.12em', marginBottom: 6 }}>{k.label}</div>
              <div style={{ fontFamily: MONO, fontSize: 18, color: k.col, lineHeight: 1 }}>{k.value}</div>
              <div style={{ fontSize: 10, color: DIM, marginTop: 4 }}>{k.sub}</div>
            </div>
          ))}
        </div>

        {/* Wochen-Tabelle */}
        <div style={{ fontFamily: MONO, fontSize: 9, color: DIM, letterSpacing: '0.12em', marginBottom: 8 }}>
          WOCHENÜBERSICHT — LETZTE 12 WOCHEN
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[...weeks].reverse().map(w => (
            <div key={w.week} style={{
              background: CARD, borderRadius: 8, padding: '10px 12px',
              border: `1px solid ${BORDER}`,
            }}>
              {/* Zeile 1: Datum + Compliance */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                <span style={{ fontFamily: MONO, fontSize: 11, color: ACC }}>{weekLabel(w.week)}</span>
                <span style={{ fontFamily: MONO, fontSize: 10, color: w.compliance != null ? (w.compliance >= 80 ? '#3D9B78' : w.compliance >= 60 ? '#C4973A' : '#C45A3A') : DIM }}>
                  {w.done}/{w.planned} Einheiten{w.compliance != null ? ` · ${w.compliance}%` : ''}
                </span>
              </div>

              {/* TSS Bar */}
              <div style={{ marginBottom: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={{ fontFamily: MONO, fontSize: 9, color: DIM }}>TSS PLAN / IST</span>
                  <span style={{ fontFamily: MONO, fontSize: 10, color: w.tss_ist >= w.tss_plan * 0.85 ? '#3D9B78' : '#C4973A' }}>
                    {w.tss_plan} / {w.tss_ist}
                  </span>
                </div>
                <TssBar plan={w.tss_plan} ist={w.tss_ist} max={maxTss} />
              </div>

              {/* Metriken-Chips */}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 4 }}>
                {w.bike_np_avg != null && (
                  <div>
                    <div style={{ fontFamily: MONO, fontSize: 9, color: DIM, marginBottom: 2 }}>RAD NP</div>
                    <div>
                      <SimpleBar value={w.bike_np_avg} max={maxNp} color="#C4973A" />
                      <span style={{ fontFamily: MONO, fontSize: 10, color: '#C4973A' }}>{w.bike_np_avg}W</span>
                    </div>
                  </div>
                )}
                {w.run_hr_avg != null && (
                  <div>
                    <div style={{ fontFamily: MONO, fontSize: 9, color: DIM, marginBottom: 2 }}>LAUF HF</div>
                    <span style={{ fontFamily: MONO, fontSize: 10, color: '#3D9B78' }}>{w.run_hr_avg} bpm</span>
                  </div>
                )}
                {w.bike_if_avg != null && (
                  <div>
                    <div style={{ fontFamily: MONO, fontSize: 9, color: DIM, marginBottom: 2 }}>IF</div>
                    <span style={{ fontFamily: MONO, fontSize: 10, color: TEXT }}>{w.bike_if_avg.toFixed(2)}</span>
                  </div>
                )}
                {w.rpe_avg != null && (
                  <div>
                    <div style={{ fontFamily: MONO, fontSize: 9, color: DIM, marginBottom: 2 }}>RPE</div>
                    <span style={{ fontFamily: MONO, fontSize: 10, color: w.rpe_avg <= 6 ? '#3D9B78' : w.rpe_avg <= 8 ? '#C4973A' : '#C45A3A' }}>
                      {w.rpe_avg}/10
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {data.person.lthr_run && (
          <div style={{ fontFamily: MONO, fontSize: 9, color: DIM, marginTop: 16, textAlign: 'center' }}>
            LTHR Laufen {data.person.lthr_run} bpm · FTP {data.person.ftp_w ?? '—'}W
          </div>
        )}
      </div>
    )
  }

  // ── Garmin-View (Ute / Christoph) ──────────────────────
  const weeks = data.weeks
  const maxCtl = Math.max(...weeks.map(w => w.ctl ?? 0), 100)
  const maxNp  = Math.max(...weeks.map(w => w.bike_np_avg ?? 0), 100)

  const ctlFirst = weeks.slice(0, 4).map(w => w.ctl).filter(Boolean) as number[]
  const ctlLast  = weeks.slice(-4).map(w => w.ctl).filter(Boolean) as number[]
  const ctlTrend = ctlFirst.length && ctlLast.length
    ? Math.round((ctlLast.reduce((a,b)=>a+b,0)/ctlLast.length) - (ctlFirst.reduce((a,b)=>a+b,0)/ctlFirst.length))
    : null

  const npFirst = weeks.slice(0, 4).map(w => w.bike_np_avg).filter(Boolean) as number[]
  const npLast  = weeks.slice(-4).map(w => w.bike_np_avg).filter(Boolean) as number[]
  const npTrend = npFirst.length && npLast.length
    ? Math.round((npLast.reduce((a,b)=>a+b,0)/npLast.length) - (npFirst.reduce((a,b)=>a+b,0)/npFirst.length))
    : null

  return (
    <div style={{ color: TEXT, fontFamily: SERIF }}>

      {/* KPI-Karten */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20 }}>
        {[
          {
            label: 'FITNESS (CTL)',
            value: ctlTrend != null ? `${ctlTrend > 0 ? '+' : ''}${ctlTrend}` : '—',
            sub: 'Änderung letzte 4 vs erste 4 Wochen',
            col: ctlTrend != null ? (ctlTrend >= 0 ? '#3D9B78' : '#C45A3A') : DIM,
          },
          {
            label: 'RAD-WATT TREND',
            value: npTrend != null ? `${npTrend > 0 ? '+' : ''}${npTrend}W` : '—',
            sub: 'Ø NP letzte 4 vs erste 4 Wochen',
            col: npTrend != null ? (npTrend >= 0 ? '#3D9B78' : '#C45A3A') : DIM,
          },
        ].map(k => (
          <div key={k.label} style={{
            background: CARD, borderRadius: 8, padding: '10px 10px 8px',
            border: `1px solid ${BORDER}`, borderLeft: `3px solid ${k.col}`,
          }}>
            <div style={{ fontFamily: MONO, fontSize: 8, color: DIM, letterSpacing: '0.12em', marginBottom: 6 }}>{k.label}</div>
            <div style={{ fontFamily: MONO, fontSize: 18, color: k.col, lineHeight: 1 }}>{k.value}</div>
            <div style={{ fontSize: 10, color: DIM, marginTop: 4 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ fontFamily: MONO, fontSize: 9, color: DIM, letterSpacing: '0.12em', marginBottom: 8 }}>
        WOCHENÜBERSICHT — LETZTE 12 WOCHEN
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {[...weeks].reverse().map(w => (
          <div key={w.week} style={{
            background: CARD, borderRadius: 8, padding: '10px 12px',
            border: `1px solid ${BORDER}`,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
              <span style={{ fontFamily: MONO, fontSize: 11, color: ACC }}>{weekLabel(w.week)}</span>
              <span style={{ fontFamily: MONO, fontSize: 10, color: DIM }}>
                {w.activities} Einheiten · {Math.round(w.total_min / 60 * 10) / 10}h
              </span>
            </div>

            {w.ctl != null && (
              <div style={{ marginBottom: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={{ fontFamily: MONO, fontSize: 9, color: DIM }}>FITNESS (CTL)</span>
                  <span style={{ fontFamily: MONO, fontSize: 10, color: '#3D9B78' }}>{w.ctl}</span>
                </div>
                <SimpleBar value={w.ctl} max={maxCtl} color="#3D9B78" />
              </div>
            )}

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 4 }}>
              {w.bike_np_avg != null && (
                <div>
                  <div style={{ fontFamily: MONO, fontSize: 9, color: DIM, marginBottom: 2 }}>RAD NP</div>
                  <div>
                    <SimpleBar value={w.bike_np_avg} max={maxNp} color="#C4973A" />
                    <span style={{ fontFamily: MONO, fontSize: 10, color: '#C4973A' }}>{w.bike_np_avg}W</span>
                  </div>
                </div>
              )}
              {w.run_hr_avg != null && (
                <div>
                  <div style={{ fontFamily: MONO, fontSize: 9, color: DIM, marginBottom: 2 }}>LAUF HF</div>
                  <span style={{ fontFamily: MONO, fontSize: 10, color: '#3D9B78' }}>{w.run_hr_avg} bpm</span>
                </div>
              )}
              {w.bike_hr_avg != null && (
                <div>
                  <div style={{ fontFamily: MONO, fontSize: 9, color: DIM, marginBottom: 2 }}>RAD HF</div>
                  <span style={{ fontFamily: MONO, fontSize: 10, color: '#C4973A' }}>{w.bike_hr_avg} bpm</span>
                </div>
              )}
              {w.vo2max != null && (
                <div>
                  <div style={{ fontFamily: MONO, fontSize: 9, color: DIM, marginBottom: 2 }}>VO2MAX</div>
                  <span style={{ fontFamily: MONO, fontSize: 10, color: TEXT }}>{w.vo2max}</span>
                </div>
              )}
              {w.compliance != null && (
                <div>
                  <div style={{ fontFamily: MONO, fontSize: 9, color: DIM, marginBottom: 2 }}>PLAN</div>
                  <span style={{ fontFamily: MONO, fontSize: 10, color: w.compliance >= 80 ? '#3D9B78' : '#C4973A' }}>
                    {w.done}/{w.planned} · {w.compliance}%
                  </span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {(data.person.lthr_run || data.person.ftp_w) && (
        <div style={{ fontFamily: MONO, fontSize: 9, color: DIM, marginTop: 16, textAlign: 'center' }}>
          {data.person.lthr_run && `LTHR ${data.person.lthr_run} bpm`}
          {data.person.lthr_run && data.person.ftp_w && ' · '}
          {data.person.ftp_w && `FTP ${data.person.ftp_w}W`}
        </div>
      )}
    </div>
  )
}
