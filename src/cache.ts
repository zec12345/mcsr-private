<<<<<<< HEAD
import type { DetailSlice } from "./types"

const KEY = "mcsr-private-details-v1"
const MAX_ENTRIES = 700

export function clearDetailCache() {
  localStorage.removeItem(KEY)
}

export function loadDetailCache(): Map<number, DetailSlice> {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return new Map()
    const parsed = JSON.parse(raw) as [number, DetailSlice][]
    if (!Array.isArray(parsed)) return new Map()
    return new Map(parsed)
  } catch {
    return new Map()
  }
}

export function saveDetailCache(cache: Map<number, DetailSlice>) {
  const write = (entries: [number, DetailSlice][]) => {
    localStorage.setItem(KEY, JSON.stringify(entries))
  }
  try {
    const entries = [...cache.entries()]
    write(entries.length > MAX_ENTRIES ? entries.slice(entries.length - MAX_ENTRIES) : entries)
  } catch {
    try {
      write([...cache.entries()].slice(-200))
    } catch {
      // The pace card still works for this session if the browser refuses to store it.
    }
  }
}
=======
import type { DetailSlice } from "./types"

const KEY = "mcsr-private-details-v1"
const MAX_ENTRIES = 700

export function clearDetailCache() {
  localStorage.removeItem(KEY)
}

export function loadDetailCache(): Map<number, DetailSlice> {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return new Map()
    const parsed = JSON.parse(raw) as [number, DetailSlice][]
    if (!Array.isArray(parsed)) return new Map()
    return new Map(parsed)
  } catch {
    return new Map()
  }
}

export function saveDetailCache(cache: Map<number, DetailSlice>) {
  const write = (entries: [number, DetailSlice][]) => {
    localStorage.setItem(KEY, JSON.stringify(entries))
  }
  try {
    const entries = [...cache.entries()]
    write(entries.length > MAX_ENTRIES ? entries.slice(entries.length - MAX_ENTRIES) : entries)
  } catch {
    try {
      write([...cache.entries()].slice(-200))
    } catch {
      // The pace card still works for this session if the browser refuses to store it.
    }
  }
}
>>>>>>> 0c65a2961f7db6832bc3a2725e65c87241965e32
