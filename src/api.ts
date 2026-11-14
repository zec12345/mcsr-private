// MCSR Ranked public API. Private rooms are match type 3.
// The API rejects fastest/slowest sort on private matches, so sorting happens in the app.

import { API_BASE } from "./constants"
import type { DetailSlice, MatchSummary, Player } from "./types"

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError"
}

async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, { signal })
  } catch (error) {
    if (isAbort(error)) throw error
    throw new ApiError("Couldn't reach the Ranked API. Check your connection and try again.", 0)
  }

  const body = (await response.json().catch(() => null)) as {
    status?: string
    data?: T | { query?: Record<string, string[]> } | null
  } | null

  if (response.status === 429) {
    throw new ApiError(
      "The Ranked API rate limit was hit (500 requests every 10 minutes). Wait a few minutes, then load the rest. Timelines already saved in this browser are kept.",
      429,
    )
  }

  if (!response.ok || !body || body.status !== "success") {
    const query = body?.data && typeof body.data === "object" && "query" in body.data ? body.data.query : undefined
    const detail = query ? Object.values(query).flat().join(" ") : ""
    throw new ApiError(detail || "The Ranked API rejected that request.", response.status)
  }

  return body.data as T
}

export async function fetchUser(nickname: string, signal: AbortSignal): Promise<Player> {
  try {
    return await getJson<Player>(`/users/${encodeURIComponent(nickname)}`, signal)
  } catch (error) {
    if (error instanceof ApiError && error.status === 400) {
      throw new ApiError(`No MCSR Ranked player is named “${nickname}”.`, 404)
    }
    throw error
  }
}

export async function fetchPrivateMatches(
  nickname: string,
  season: number,
  signal: AbortSignal,
  onProgress: (count: number) => void,
): Promise<MatchSummary[]> {
  const all: MatchSummary[] = []
  const seen = new Set<number>()
  let before: number | undefined

  for (let page = 0; page < 60; page += 1) {
    const params = new URLSearchParams({
      type: "3",
      season: String(season),
      count: "100",
    })
    if (before != null) params.set("before", String(before))

    const batch = await getJson<MatchSummary[]>(
      `/users/${encodeURIComponent(nickname)}/matches?${params}`,
      signal,
    )
    if (batch.length === 0) break

    let added = 0
    for (const match of batch) {
      if (seen.has(match.id) || match.decayed || match.type !== 3) continue
      seen.add(match.id)
      all.push(match)
      added += 1
    }
    onProgress(all.length)

    if (batch.length < 100) break
    const oldest = batch[batch.length - 1]?.id
    if (oldest == null || (before != null && oldest >= before) || added === 0) break
    before = oldest
  }

  return all
}

export async function fetchMatchSlice(id: number, signal: AbortSignal): Promise<DetailSlice> {
  const match = await getJson<{
    completions?: { uuid: string; time: number }[]
    timelines?: { uuid: string; time: number; type: string }[]
  }>(`/matches/${id}`, signal)

  return {
    completions: match.completions ?? [],
    timelines: match.timelines ?? [],
  }
}

export async function fetchMatchSlices(
  ids: number[],
  onBatch: (batch: [number, DetailSlice][]) => void,
  onProgress: (done: number, total: number) => void,
  signal: AbortSignal,
): Promise<"ok" | "rate" | "abort"> {
  let cursor = 0
  let done = 0
  let status: "ok" | "rate" | "abort" = "ok"
  const pending: [number, DetailSlice][] = []

  const flush = () => {
    if (pending.length === 0) return
    onBatch(pending.splice(0, pending.length))
  }

  const worker = async () => {
    while (status === "ok") {
      if (signal.aborted) {
        status = "abort"
        return
      }
      const index = cursor
      cursor += 1
      const id = ids[index]
      if (id == null) return

      try {
        const slice = await fetchMatchSlice(id, signal)
        pending.push([id, slice])
        if (pending.length >= 8) flush()
      } catch (error) {
        if (isAbort(error)) {
          status = "abort"
          return
        }
        if (error instanceof ApiError && error.status === 429) {
          status = "rate"
          return
        }
      }

      done += 1
      onProgress(done, ids.length)
    }
  }

  await Promise.all(Array.from({ length: Math.min(4, ids.length) }, () => worker()))
  flush()
  return status
}
