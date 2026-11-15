import { useEffect, useMemo, useRef, useState } from "react"
import { fetchMatchSlices } from "./api"
import { formatTime, headUrl, matchUrl, percent } from "./format"
import { anyPercentMatches, buildPace, categoryOf, detailOrder, modeOf } from "./stats"
import type { DetailSlice, MatchSummary } from "./types"

type Props = {
  matches: MatchSummary[]
  uuid: string
  nickname: string
  season: number
  details: Map<number, DetailSlice>
  onBatch: (batch: [number, DetailSlice][]) => void
  onClear: () => void
}

export function PacePanel({ matches, uuid, nickname, season, details, onBatch, onClear }: Props) {
  const [includeScout, setIncludeScout] = useState(false)
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const anyMatches = useMemo(() => matches.filter((match) => categoryOf(match) === "ANY"), [matches])
  const scoutCount = anyMatches.filter((match) => modeOf(match) === "scout_route").length
  const otherCount = anyMatches.filter((match) => {
    const mode = modeOf(match)
    return mode !== "default" && mode !== "scout_route"
  }).length
  const targets = useMemo(() => anyPercentMatches(matches, includeScout), [matches, includeScout])
  const report = useMemo(() => buildPace(targets, uuid, details), [targets, uuid, details])
  const missing = targets.filter((match) => !details.has(match.id)).length

  useEffect(() => {
    return () => abortRef.current?.abort()
  }, [uuid, season])

  async function loadSplits() {
    if (running) return
    const ids = detailOrder(targets, uuid, details).filter((id) => !details.has(id))
    if (ids.length === 0) return

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    const already = targets.length - ids.length
    setRunning(true)
    setNote(null)
    setProgress({ done: already, total: targets.length })

    const status = await fetchMatchSlices(
      ids,
      onBatch,
      (done, total) => setProgress({ done: already + done, total: already + total }),
      controller.signal,
    )

    if (controller.signal.aborted || status === "abort") {
      setRunning(false)
      return
    }
    if (status === "rate") {
      setNote("The Ranked API rate limit was hit. The card below uses every timeline already loaded. Wait a few minutes, then continue.")
    }
    setRunning(false)
  }

  const scale = Math.max(report.average ?? 0, ...report.splits.map((split) => split.average ?? 0), 1)
  const bucketMax = Math.max(...report.buckets.map((bucket) => bucket.count), 1)
  const fastestRun = report.splits.filter((split) => split.id !== "finish" && split.onFastestRun != null)

  return (
    <section className="panel stack">
      <div className="pace-head">
        <img src={headUrl(uuid)} alt="" width={48} height={48} />
        <div>
          <h2>
            {nickname} · Season {season} Any%
          </h2>
          <p>
            Private standard runs{includeScout ? " plus scout routes" : ""}. Overworld through End are the clock time
            when that split happened. Finish average uses completed runs only.
          </p>
        </div>
      </div>

      <div className="stat-grid">
        <Stat label="Matches" value={String(report.played)} />
        <Stat label="Finishes" value={`${report.finishes} · ${percent(report.finishes, report.played)}`} />
        <Stat label="Average" value={formatTime(report.average)} />
        <Stat label="Median" value={formatTime(report.median)} />
        <Stat
          label="Fastest"
          value={formatTime(report.fastest)}
          href={report.fastestMatchId ? matchUrl(nickname, report.fastestMatchId) : undefined}
        />
        <Stat label="Slowest finish" value={formatTime(report.slowest)} />
      </div>

      {(scoutCount > 0 || otherCount > 0) && (
        <div className="inline-options">
          {scoutCount > 0 && (
            <label className="check">
              <input
                type="checkbox"
                checked={includeScout}
                onChange={(event) => setIncludeScout(event.target.checked)}
              />
              Include {scoutCount} scout {scoutCount === 1 ? "route" : "routes"}
            </label>
          )}
          {otherCount > 0 && <p className="note">{otherCount} Most% or other Any% modes stay out of this card.</p>}
        </div>
      )}

      {targets.length === 0 ? (
        <p className="empty">
          No standard private Any% matches this season.
          {scoutCount > 0 ? " There are scout routes, and the checkbox above can include them." : ""}
        </p>
      ) : (
        <>
          <div className="load-row">
            {missing > 0 && (
              <button type="button" className="primary" onClick={() => void loadSplits()} disabled={running}>
                {running ? "Reading timelines…" : report.covered > 0 ? "Continue split timelines" : "Load split timelines"}
              </button>
            )}
            {running && (
              <button
                type="button"
                onClick={() => {
                  abortRef.current?.abort()
                  setRunning(false)
                }}
              >
                Cancel
              </button>
            )}
            {details.size > 0 && !running && (
              <button type="button" onClick={onClear}>
                Forget saved timelines
              </button>
            )}
            <span className="note">
              {report.covered} of {report.played} matches have split data
              {missing > 0 ? ` · ${missing} still to read` : ""}
            </span>
          </div>

          {progress && running && (
            <div className="bar" aria-hidden="true">
              <span style={{ width: `${(progress.done / Math.max(progress.total, 1)) * 100}%` }} />
            </div>
          )}
          {note && <p className="banner bad">{note}</p>}

          {report.fastest != null && (
            <p className="pb-line">
              <span>Fastest run</span>
              {report.fastestMatchId && (
                <a href={matchUrl(nickname, report.fastestMatchId)} target="_blank" rel="noreferrer">
                  {formatTime(report.fastest)}
                </a>
              )}
              {fastestRun.length > 0 && (
                <span className="pb-splits">
                  {fastestRun.map((split) => (
                    <span key={split.id}>
                      {split.label} {formatTime(split.onFastestRun)}
                    </span>
                  ))}
                </span>
              )}
            </p>
          )}

          {report.covered === 0 ? (
            <p className="note">
              Finish stats above come from the match list. Split times live on each match, so loading them takes one
              request per run. Fastest finishes are read first. The Ranked API allows 500 requests every 10 minutes,
              and timelines stay saved in this browser.
            </p>
          ) : (
            <div className="table-wrap">
              <table className="splits">
                <caption className="sr">Average and fastest Any% splits</caption>
                <thead>
                  <tr>
                    <th>Split</th>
                    <th>Average</th>
                    <th>Fastest</th>
                    <th>On fastest run</th>
                    <th>Runs</th>
                  </tr>
                </thead>
                <tbody>
                  {report.splits.map((split) => (
                    <tr key={split.id}>
                      <td>
                        <strong>{split.label}</strong>
                        <small>{split.hint}</small>
                        <div className="split-track" title={split.average != null ? `Average ${formatTime(split.average)}` : undefined}>
                          <span
                            className="split-avg"
                            style={{ width: `${((split.average ?? 0) / scale) * 100}%` }}
                          />
                          {split.fastest != null && (
                            <span
                              className="split-best"
                              style={{ left: `${(split.fastest / scale) * 100}%` }}
                              title={`Fastest ${formatTime(split.fastest)}`}
                            />
                          )}
                        </div>
                      </td>
                      <td className="time">
                        {formatTime(split.average)}
                        {split.averageLeg != null && split.id !== "ow" && <small>leg {formatTime(split.averageLeg)}</small>}
                      </td>
                      <td className="time">
                        {split.fastestMatchId ? (
                          <a href={matchUrl(nickname, split.fastestMatchId)} target="_blank" rel="noreferrer">
                            {formatTime(split.fastest)}
                          </a>
                        ) : (
                          formatTime(split.fastest)
                        )}
                      </td>
                      <td className="time">{formatTime(split.onFastestRun)}</td>
                      <td>{split.samples}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {report.finishes > 0 && report.covered > 0 && (
            <div className="buckets">
              <h3>Finish spread</h3>
              {report.buckets.map((bucket) => (
                <div key={bucket.label} className="bucket">
                  <span>{bucket.label}</span>
                  <div className="split-track">
                    <span className="split-avg" style={{ width: `${(bucket.count / bucketMax) * 100}%` }} />
                  </div>
                  <span className="time">{bucket.count}</span>
                </div>
              ))}
            </div>
          )}

          <p className="note">
            The gold mark is the fastest time that split was reached, on any private run in this set. It can be a
            different run from the fastest finish. Average legs are the time spent since the previous split.
          </p>
        </>
      )}
    </section>
  )
}

function Stat({ label, value, href }: { label: string; value: string; href?: string }) {
  return (
    <div className="stat">
      <span>{label}</span>
      {href ? (
        <a className="hero-time" href={href} target="_blank" rel="noreferrer">
          {value}
        </a>
      ) : (
        <strong className="hero-time">{value}</strong>
      )}
    </div>
  )
}
