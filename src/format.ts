export function formatTime(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms)) return "—"
  const rounded = Math.max(0, Math.round(ms))
  const hours = Math.floor(rounded / 3_600_000)
  const mins = Math.floor((rounded % 3_600_000) / 60_000)
  const secs = Math.floor((rounded % 60_000) / 1000)
  const millis = rounded % 1000
  const clock = `${secs.toString().padStart(2, "0")}.${millis.toString().padStart(3, "0")}`
  if (hours > 0) return `${hours}:${mins.toString().padStart(2, "0")}:${clock}`
  return `${mins}:${clock}`
}

export function formatDate(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

export function structureLabel(value: string | null | undefined): string {
  if (!value) return ""
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

export function seedLabel(match: {
  seed: { overworld: string | null; nether: string | null } | null
  seedType?: string | null
  bastionType?: string | null
}): string {
  const overworld = structureLabel(match.seed?.overworld ?? match.seedType)
  const nether = structureLabel(match.seed?.nether ?? match.bastionType)
  if (!overworld && !nether) return "Unfiltered seed"
  if (overworld && nether) return `${overworld} · ${nether}`
  return overworld || nether
}

export function matchUrl(id: number): string {
  return `https://mcsrranked.com/stats/match/${id}`
}

export function profileUrl(nickname: string): string {
  return `https://mcsrranked.com/profile/${encodeURIComponent(nickname)}`
}

export function headUrl(uuid: string): string {
  return `https://mc-heads.net/avatar/${uuid}/64`
}

const CATEGORY_LABELS: Record<string, string> = {
  ANY: "Any%",
  ALL_ADVANCEMENTS: "All Advancements",
  HALF: "Half%",
  HALF_ADVANCEMENTS: "Half%",
  QUARTER: "Quarter%",
  QUARTER_ADVANCEMENTS: "Quarter%",
  ALL_PORTALS: "All Portals",
  ALL_BLOCKS: "All Blocks",
  ALL_BOSSES: "All Bosses",
  KILL_WITHER: "Kill Wither",
  KILL_ELDER_GUARDIAN: "Kill Elder Guardian",
  HOW_DID_WE_GET_HERE: "How Did We Get Here?",
  HERO_OF_THE_VILLAGE: "Hero of the Village",
  ARBALISTIC: "Arbalistic",
  COVER_ME_IN_DEBRIS: "Cover Me in Debris",
  COVER_ME_WITH_DEBRIS: "Cover Me in Debris",
  ENTER_NETHER: "Enter Nether",
  ENTER_END: "Enter End",
  MINE_A_CHUNK: "Mine a Chunk",
  HIGH: "High%",
  ALL_SWORDS: "All Swords",
  ALL_MINERALS: "All Minerals",
  FULL_IA_15_LVL: "Full IA, 15 LVL",
  ALL_WORKSTATIONS: "All Workstations",
  FULL_INVENTORY: "Full Inventory",
  STACK_OF_LIME_WOOL: "Stack of Lime Wool",
}

const MODE_LABELS: Record<string, string> = {
  default: "Standard",
  scout_route: "Scout",
  most_percent: "Most%",
}

export function categoryLabel(id: string): string {
  return CATEGORY_LABELS[id] ?? structureLabel(id)
}

export function modeLabel(id: string): string {
  return MODE_LABELS[id] ?? structureLabel(id)
}

export function percent(part: number, whole: number): string {
  if (!whole) return "0%"
  return `${((part / whole) * 100).toFixed(1)}%`
}
