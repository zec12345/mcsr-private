import { Fragment, useEffect, useState } from "react"
import { PAGE_SIZE } from "./constants"
import { categoryLabel, formatDate, formatTime, matchUrl, modeLabel, seedLabel } from "./format"
import {
  categoryOf,
  modeOf,
  outcome,
  paceRanks,
  scopeMatches,
  sortMatches,
  summarize,
  uniqueCategories,
  uniqueModes,
} from "./stats"
import type { DetailSlice, MatchSummary, SortKey } from "./types"

const SORTS: { id: SortKey; label: string }[] = [
  { id: "fastest", label: "Fastest" },
  { id: "slowest", label: "Slowest" },
  { id: "newest", label: "Newest" },
  { id: "oldest", label: "Oldest" },
]

type Props = {
  matches: MatchSummary[]
  uuid: string
  nickname: string
  listKey: string
  details: Map<number, DetailSlice>
  category: string
  mode: string
  sort: SortKey
  hideResets: boolean
  onCategory: (category: string) => void
  onMode: (mode: string) => void
  onSort: (sort: SortKey) => void
  onHideResets: (hide: boolean) => void
}

export function MatchBoard({
  matches,
  uuid,
  nickname,
  listKey,
  details,
  category,
  mode,
  sort,
  hideResets,
  onCategory,
  onMode,
  onSort,
  onHideResets,
}: Props) {
  const [page, setPage] = useState(0)
  const categories = uniqueCategories(matches)
  const modes = uniqueModes(matches)
  const scoped = scopeMatches(matches, category, mode)
  const summary = summarize(scoped, uuid, details)
  const ranks = paceRanks(scoped, uuid, details)
  const visible = hideResets ? scoped.filter((match) => outcome(match, uuid, details.get(match.id)).kind !== "reset") : scoped
  const sorted = sortMatches(visible, sort, uuid, details, category === "all")
  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount - 1)
  const start = safePage * PAGE_SIZE
  const rows = sorted.slice(start, start + PAGE_SIZE)

  useEffect(() => {
    setPage(0)
  }, [listKey, category, mode, sort, hideResets])

  return (
    <section className="panel stack">
      <div className="filters">
        <label>
          Category
          <select value={category} onChange={(event) => onCategory(event.target.value)}>
            <option value="all">All categories, kept separate</option>
            {categories.map((id) => (
              <option key={id} value={id}>
                {categoryLabel(id)} ({matches.filter((match) => categoryOf(match) === id).length})
              </option>
            ))}
          </select>
        </label>
        <label>
          Room mode
          <select value={mode} onChange={(event) => onMode(event.target.value)}>
            <option value="all">All modes</option>
            {modes.map((id) => (
              <option key={id} value={id}>
                {modeLabel(id)} ({matches.filter((match) => modeOf(match) === id).length})
              </option>
            ))}
          </select>
        </label>
        <fieldset>
          <legend>Sort</legend>
          <div className="segment">
            {SORTS.map((option) => (
              <button
                key={option.id}
                type="button"
                className={sort === option.id ? "on" : ""}
                onClick={() => onSort(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </fieldset>
        <label className="check">
          <input
            type="checkbox"
            checked={hideResets}
            onChange={(event) => onHideResets(event.target.checked)}
          />
          Hide resets
        </label>
      </div>

      <div className="summary">
        <div>
          <span>Fastest finish</span>
          <strong className="hero-time">
            {summary.fastestMatchId ? (
              <a href={matchUrl(nickname, summary.fastestMatchId)} target="_blank" rel="noreferrer">
                {formatTime(summary.fastest)}
              </a>
            ) : (
              "No finish"
            )}
          </strong>
        </div>
        <div>
          <span>Average finish</span>
          <strong className="hero-time">{formatTime(summary.average)}</strong>
        </div>
        <div className="summary-counts">
          <span>{summary.played} matches</span>
          <span>{summary.finishes} finishes</span>
          <span>{summary.resets} resets</span>
          {summary.dnfs > 0 && <span>{summary.dnfs} won by someone else</span>}
        </div>
      </div>

      {summary.dnfs > 0 && (
        <p className="note">
          If another player won the room, {nickname}&apos;s own finish is filled in after Analysis reads that match.
          Until then the row stays blank instead of using the winner&apos;s time.
        </p>
      )}

      {sorted.length === 0 ? (
        <p className="empty">
          {scoped.length === 0
            ? "Nothing in this category and mode. Try another category, or switch room mode."
            : "Every match in this filter is a reset."}
        </p>
      ) : (
        <>
          <div className="table-wrap">
            <table>
              <caption className="sr">
                Private matches for {nickname}, sorted by {sort}
              </caption>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Result</th>
                  <th>When</th>
                  <th>Seed</th>
                  <th>Room</th>
                  <th>Match</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((match, index) => {
                  const result = outcome(match, uuid, details.get(match.id))
                  const previous = rows[index - 1]
                  const showCategory =
                    category === "all" && (index === 0 || categoryOf(match) !== categoryOf(previous))
                  const isPb = result.kind === "finish" && result.time === summary.fastest
                  const others = match.players.filter((player) => player.uuid !== uuid)
                  const winner = match.players.find((player) => player.uuid === match.result.uuid)
                  const vod = match.vod?.find((entry) => entry.url)

                  return (
                    <Fragment key={match.id}>
                      {showCategory && (
                        <tr className="group">
                          <td colSpan={6}>{categoryLabel(categoryOf(match))}</td>
                        </tr>
                      )}
                      <tr className={isPb ? "pb" : result.kind === "reset" ? "reset" : ""}>
                        <td className="time">
                          {result.kind === "finish" ? formatTime(result.time) : "—"}
                          {result.kind === "finish" && ranks.get(match.id) != null && (
                            <small>#{ranks.get(match.id)}</small>
                          )}
                        </td>
                        <td>
                          {result.kind === "finish" && <span className="tag finish">Finish</span>}
                          {result.kind === "reset" && (
                            <span className="tag reset">Reset {formatTime(result.time)}</span>
                          )}
                          {result.kind === "dnf" && (
                            <span className="tag dnf">
                              Winner {winner?.nickname ?? "opponent"} · {formatTime(result.winnerTime)}
                            </span>
                          )}
                          <span className="tags">
                            {category === "all" && <span className="tag">{categoryLabel(categoryOf(match))}</span>}
                            {mode === "all" && modeOf(match) !== "default" && (
                              <span className="tag">{modeLabel(modeOf(match))}</span>
                            )}
                            {match.beginner && <span className="tag">Beginner</span>}
                            {match.tag && <span className="tag">{match.tag}</span>}
                          </span>
                        </td>
                        <td>{formatDate(match.date)}</td>
                        <td>{seedLabel(match)}</td>
                        <td>{others.length === 0 ? "Solo" : others.map((player) => player.nickname).join(", ")}</td>
                        <td className="links">
                          <a href={matchUrl(nickname, match.id)} target="_blank" rel="noreferrer">
                            #{match.id}
                          </a>
                          {vod && (
                            <a href={vod.url} target="_blank" rel="noreferrer">
                              VOD
                            </a>
                          )}
                        </td>
                      </tr>
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="pager">
            <span>
              {start + 1}–{start + rows.length} of {sorted.length}
              {hideResets && summary.resets > 0 ? ` · ${summary.resets} resets hidden` : ""}
            </span>
            <div>
              <button type="button" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>
                Previous
              </button>
              <button
                type="button"
                disabled={safePage >= pageCount - 1}
                onClick={() => setPage(safePage + 1)}
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  )
}
