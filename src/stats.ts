// Sorting and Any% pace math for private rooms.
// Clock times come from the player's own timeline, not the room winner.

import { categoryLabel } from "./format"
import type { DetailSlice, MatchSummary, Outcome, SortKey } from "./types"

export function categoryOf(match: MatchSummary): string {
  return match.category || "ANY"
}

export function modeOf(match: MatchSummary): string {
  return match.gameMode || "default"
}

export function outcome(match: MatchSummary, uuid: string, detail?: DetailSlice): Outcome {
  const mine = detail?.completions.find((entry) => entry.uuid === uuid)
  if (mine) return { kind: "finish", time: mine.time }
  if (!match.forfeited && match.result.uuid === uuid) {
    return { kind: "finish", time: match.result.time }
  }
  if (match.forfeited || !match.result.uuid) {
    return { kind: "reset", time: match.result.time }
  }
  return { kind: "dnf", winnerTime: match.result.time, winnerUuid: match.result.uuid }
}

export function finishTime(match: MatchSummary, uuid: string, detail?: DetailSlice): number | null {
  const result = outcome(match, uuid, detail)
  return result.kind === "finish" ? result.time : null
}

const CATEGORY_ORDER = [
  "ANY",
  "ALL_ADVANCEMENTS",
  "HALF",
  "HALF_ADVANCEMENTS",
  "QUARTER",
  "QUARTER_ADVANCEMENTS",
  "ALL_PORTALS",
  "KILL_WITHER",
  "KILL_ELDER_GUARDIAN",
  "ALL_BOSSES",
  "ENTER_NETHER",
  "ENTER_END",
]

export function uniqueCategories(matches: MatchSummary[]): string[] {
  const ids = [...new Set(matches.map(categoryOf))]
  return ids.sort((a, b) => {
    const ai = CATEGORY_ORDER.indexOf(a)
    const bi = CATEGORY_ORDER.indexOf(b)
    if (ai !== -1 || bi !== -1) {
      if (ai === -1) return 1
      if (bi === -1) return -1
      return ai - bi
    }
    return categoryLabel(a).localeCompare(categoryLabel(b))
  })
}

const MODE_ORDER = ["default", "scout_route", "most_percent"]

export function uniqueModes(matches: MatchSummary[]): string[] {
  const ids = [...new Set(matches.map(modeOf))]
  return ids.sort((a, b) => {
    const ai = MODE_ORDER.indexOf(a)
    const bi = MODE_ORDER.indexOf(b)
    if (ai === -1 && bi === -1) return a.localeCompare(b)
    if (ai === -1) return 1
    if (bi === -1) return -1
    return ai - bi
  })
}

export function scopeMatches(matches: MatchSummary[], category: string, mode: string): MatchSummary[] {
  return matches.filter((match) => {
    if (category !== "all" && categoryOf(match) !== category) return false
    if (mode !== "all" && modeOf(match) !== mode) return false
    return true
  })
}

export function sortMatches(
  matches: MatchSummary[],
  sort: SortKey,
  uuid: string,
  details: Map<number, DetailSlice>,
  groupCategories: boolean,
): MatchSummary[] {
  const categories = groupCategories ? uniqueCategories(matches) : []
  const rank = new Map(categories.map((id, index) => [id, index]))

  return [...matches].sort((a, b) => {
    if (groupCategories) {
      const categoryDelta = (rank.get(categoryOf(a)) ?? 0) - (rank.get(categoryOf(b)) ?? 0)
      if (categoryDelta !== 0) return categoryDelta
    }
    if (sort === "newest") return b.date - a.date || b.id - a.id
    if (sort === "oldest") return a.date - b.date || a.id - b.id

    const aTime = finishTime(a, uuid, details.get(a.id))
    const bTime = finishTime(b, uuid, details.get(b.id))
    if ((aTime == null) !== (bTime == null)) return aTime == null ? 1 : -1
    if (aTime != null && bTime != null && aTime !== bTime) {
      return sort === "fastest" ? aTime - bTime : bTime - aTime
    }
    return b.date - a.date
  })
}

export type Summary = {
  played: number
  finishes: number
  resets: number
  dnfs: number
  fastest: number | null
  fastestMatchId: number | null
  average: number | null
  slowest: number | null
}

export function summarize(matches: MatchSummary[], uuid: string, details: Map<number, DetailSlice>): Summary {
  const finishTimes: { id: number; time: number }[] = []
  let resets = 0
  let dnfs = 0

  for (const match of matches) {
    const result = outcome(match, uuid, details.get(match.id))
    if (result.kind === "finish") finishTimes.push({ id: match.id, time: result.time })
    else if (result.kind === "reset") resets += 1
    else dnfs += 1
  }

  finishTimes.sort((a, b) => a.time - b.time)
  const total = finishTimes.reduce((sum, entry) => sum + entry.time, 0)

  return {
    played: matches.length,
    finishes: finishTimes.length,
    resets,
    dnfs,
    fastest: finishTimes[0]?.time ?? null,
    fastestMatchId: finishTimes[0]?.id ?? null,
    average: finishTimes.length ? total / finishTimes.length : null,
    slowest: finishTimes[finishTimes.length - 1]?.time ?? null,
  }
}

export function paceRanks(matches: MatchSummary[], uuid: string, details: Map<number, DetailSlice>): Map<number, number> {
  const finishes = matches
    .map((match) => ({ id: match.id, time: finishTime(match, uuid, details.get(match.id)) }))
    .filter((entry): entry is { id: number; time: number } => entry.time != null)
    .sort((a, b) => a.time - b.time || a.id - b.id)

  return new Map(finishes.map((entry, index) => [entry.id, index + 1]))
}

export const SPLITS = [
  { id: "ow", label: "Overworld", event: "story.enter_the_nether", hint: "Enter the Nether" },
  { id: "bastion", label: "Bastion", event: "nether.find_bastion", hint: "Find a bastion" },
  { id: "fortress", label: "Fortress", event: "nether.find_fortress", hint: "Find a fortress" },
  { id: "blind", label: "Blind", event: "projectelo.timeline.blind_travel", hint: "Start blind travel" },
  { id: "stronghold", label: "Stronghold", event: "story.follow_ender_eye", hint: "Enter the stronghold" },
  { id: "end", label: "End", event: "story.enter_the_end", hint: "Enter the End" },
] as const

export type SplitRow = {
  id: string
  label: string
  hint: string
  average: number | null
  fastest: number | null
  fastestMatchId: number | null
  onFastestRun: number | null
  averageLeg: number | null
  samples: number
}

export type PaceReport = Summary & {
  median: number | null
  splits: SplitRow[]
  covered: number
  buckets: { label: string; count: number }[]
}

const BUCKETS = [
  { label: "Sub 8", min: 0, max: 8 * 60_000 },
  { label: "8–10", min: 8 * 60_000, max: 10 * 60_000 },
  { label: "10–12", min: 10 * 60_000, max: 12 * 60_000 },
  { label: "12–15", min: 12 * 60_000, max: 15 * 60_000 },
  { label: "15–20", min: 15 * 60_000, max: 20 * 60_000 },
  { label: "20+", min: 20 * 60_000, max: Number.POSITIVE_INFINITY },
]

function earliestEvents(detail: DetailSlice | undefined, uuid: string): Map<string, number> {
  const events = new Map<string, number>()
  if (!detail) return events
  for (const event of detail.timelines) {
    if (event.uuid !== uuid) continue
    const previous = events.get(event.type)
    if (previous == null || event.time < previous) events.set(event.type, event.time)
  }
  return events
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 1) return sorted[mid] ?? null
  const left = sorted[mid - 1]
  const right = sorted[mid]
  if (left == null || right == null) return null
  return (left + right) / 2
}

export function anyPercentMatches(matches: MatchSummary[], includeScout: boolean): MatchSummary[] {
  return matches.filter((match) => {
    if (categoryOf(match) !== "ANY") return false
    const mode = modeOf(match)
    if (mode === "default") return true
    if (includeScout && mode === "scout_route") return true
    return false
  })
}

export function buildPace(matches: MatchSummary[], uuid: string, details: Map<number, DetailSlice>): PaceReport {
  const base = summarize(matches, uuid, details)
  const finishTimes = matches
    .map((match) => finishTime(match, uuid, details.get(match.id)))
    .filter((time): time is number => time != null)

  const runs = matches.map((match) => {
    const events = earliestEvents(details.get(match.id), uuid)
    return {
      id: match.id,
      events,
      finish: finishTime(match, uuid, details.get(match.id)),
      hasDetail: details.has(match.id),
    }
  })

  const fastestRun = runs
    .filter((run) => run.finish != null)
    .sort((a, b) => (a.finish ?? 0) - (b.finish ?? 0))[0]

  const rows: SplitRow[] = SPLITS.map((split, index) => {
    const times: { id: number; time: number; leg: number | null }[] = []
    for (const run of runs) {
      const time = run.events.get(split.event)
      if (time == null) continue
      const previous = index === 0 ? 0 : run.events.get(SPLITS[index - 1]?.event ?? "")
      const leg = previous == null ? null : time - previous
      times.push({ id: run.id, time, leg })
    }
    times.sort((a, b) => a.time - b.time)
    const legs = times.map((entry) => entry.leg).filter((leg): leg is number => leg != null && leg >= 0)
    return {
      id: split.id,
      label: split.label,
      hint: split.hint,
      average: times.length ? times.reduce((sum, entry) => sum + entry.time, 0) / times.length : null,
      fastest: times[0]?.time ?? null,
      fastestMatchId: times[0]?.id ?? null,
      onFastestRun: fastestRun?.events.get(split.event) ?? null,
      averageLeg: legs.length ? legs.reduce((sum, leg) => sum + leg, 0) / legs.length : null,
      samples: times.length,
    }
  })

  const finishLegs: number[] = []
  for (const run of runs) {
    if (run.finish == null) continue
    const enteredEnd = run.events.get("story.enter_the_end")
    if (enteredEnd != null && run.finish >= enteredEnd) finishLegs.push(run.finish - enteredEnd)
  }

  rows.push({
    id: "finish",
    label: "Finish",
    hint: "Enter the exit portal",
    average: base.average,
    fastest: base.fastest,
    fastestMatchId: base.fastestMatchId,
    onFastestRun: base.fastest,
    averageLeg: finishLegs.length ? finishLegs.reduce((sum, leg) => sum + leg, 0) / finishLegs.length : null,
    samples: base.finishes,
  })

  return {
    ...base,
    median: median(finishTimes),
    splits: rows,
    covered: runs.filter((run) => run.hasDetail).length,
    buckets: BUCKETS.map((bucket) => ({
      label: bucket.label,
      count: finishTimes.filter((time) => time >= bucket.min && time < bucket.max).length,
    })),
  }
}

export function detailOrder(matches: MatchSummary[], uuid: string, details: Map<number, DetailSlice>): number[] {
  const finishes: MatchSummary[] = []
  const rest: MatchSummary[] = []
  for (const match of matches) {
    if (finishTime(match, uuid, details.get(match.id)) != null) finishes.push(match)
    else rest.push(match)
  }
  finishes.sort((a, b) => (finishTime(a, uuid, details.get(a.id)) ?? 0) - (finishTime(b, uuid, details.get(b.id)) ?? 0))
  rest.sort((a, b) => b.date - a.date)
  return [...finishes, ...rest].map((match) => match.id)
}
