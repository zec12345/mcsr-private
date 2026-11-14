export type Player = {
  uuid: string
  nickname: string
  eloRate?: number | null
  eloRank?: number | null
  country?: string | null
}

export type MatchSummary = {
  id: number
  type: number
  season: number
  category: string | null
  gameMode: string | null
  date: number
  players: Player[]
  result: { uuid: string | null; time: number }
  forfeited: boolean
  decayed: boolean
  beginner?: boolean
  seed: {
    id: string | null
    overworld: string | null
    nether: string | null
  } | null
  seedType?: string | null
  bastionType?: string | null
  vod?: { uuid: string; url: string }[]
  tag?: string | null
}

export type DetailSlice = {
  completions: { uuid: string; time: number }[]
  timelines: { uuid: string; time: number; type: string }[]
}

export type SortKey = "fastest" | "slowest" | "newest" | "oldest"

export type Outcome =
  | { kind: "finish"; time: number }
  | { kind: "reset"; time: number }
  | { kind: "dnf"; winnerTime: number; winnerUuid: string }
