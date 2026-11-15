<<<<<<< HEAD
import { useEffect, useState, type FormEvent } from "react"
import { ApiError, fetchPrivateMatches, fetchUser } from "./api"
import { clearDetailCache, loadDetailCache, saveDetailCache } from "./cache"
import { CURRENT_SEASON } from "./constants"
import { headUrl, profileUrl } from "./format"
import { MatchBoard } from "./MatchBoard"
import { PacePanel } from "./PacePanel"
import { uniqueCategories, uniqueModes } from "./stats"
import type { DetailSlice, MatchSummary, Player, SortKey } from "./types"

type Query = { name: string; season: number; nonce: number }
type Tab = "matches" | "pace"

function readSearch() {
  const params = new URLSearchParams(window.location.search)
  const seasonNumber = Number(params.get("season"))
  const season =
    Number.isInteger(seasonNumber) && seasonNumber >= 1 ? Math.min(seasonNumber, CURRENT_SEASON) : CURRENT_SEASON
  const sortValue = params.get("sort")
  const sort: SortKey =
    sortValue === "slowest" || sortValue === "newest" || sortValue === "oldest" ? sortValue : "fastest"
  const tab: Tab = params.get("tab") === "pace" ? "pace" : "matches"
  return {
    input: params.get("player") ?? "",
    season,
    tab,
    category: params.get("category") || "ANY",
    mode: params.get("mode") || "default",
    sort,
    hideResets: params.get("resets") === "hide",
  }
}

export function App() {
  const [input, setInput] = useState(() => readSearch().input)
  const [season, setSeason] = useState(() => readSearch().season)
  const [pastOpen, setPastOpen] = useState(() => readSearch().season !== CURRENT_SEASON)
  const [tab, setTab] = useState<Tab>(() => readSearch().tab)
  const [category, setCategory] = useState(() => readSearch().category)
  const [mode, setMode] = useState(() => readSearch().mode)
  const [sort, setSort] = useState<SortKey>(() => readSearch().sort)
  const [hideResets, setHideResets] = useState(() => readSearch().hideResets)
  const [query, setQuery] = useState<Query | null>(() => {
    const initial = readSearch()
    const name = initial.input.trim()
    return name ? { name, season: initial.season, nonce: 1 } : null
  })
  const [profile, setProfile] = useState<Player | null>(null)
  const [matches, setMatches] = useState<MatchSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [loadedCount, setLoadedCount] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [details, setDetails] = useState<Map<number, DetailSlice>>(() => loadDetailCache())

  useEffect(() => {
    if (!query) return
    const controller = new AbortController()
    let active = true
    setLoading(true)
    setError(null)
    setLoadedCount(0)
    setMatches([])
    setProfile(null)

    const run = async () => {
      try {
        const user = await fetchUser(query.name, controller.signal)
        if (!active) return
        setProfile(user)
        const list = await fetchPrivateMatches(query.name, query.season, controller.signal, (count) => {
          if (active) setLoadedCount(count)
        })
        if (!active) return
        setMatches(list)
      } catch (caught) {
        if (!active || (caught instanceof DOMException && caught.name === "AbortError")) return
        if (caught instanceof ApiError) setError(caught.message)
        else setError("Couldn't load private matches.")
      } finally {
        if (active) setLoading(false)
      }
    }

    void run()
    return () => {
      active = false
      controller.abort()
    }
  }, [query])

  useEffect(() => {
    if (!profile) return
    setInput(profile.nickname)
    document.title = `${profile.nickname} · Pace Rooms`
    return () => {
      document.title = "Pace Rooms · MCSR Ranked"
    }
  }, [profile])

  useEffect(() => {
    if (matches.length === 0) return
    const categories = uniqueCategories(matches)
    if (category !== "all" && !categories.includes(category)) {
      setCategory(categories.includes("ANY") ? "ANY" : (categories[0] ?? "ANY"))
    }
    const modes = uniqueModes(matches)
    if (mode !== "all" && !modes.includes(mode)) {
      setMode(modes.includes("default") ? "default" : "all")
    }
  }, [matches, category, mode])

  useEffect(() => {
    const params = new URLSearchParams()
    if (query?.name) params.set("player", query.name)
    params.set("season", String(season))
    if (tab === "pace") params.set("tab", "pace")
    if (category !== "ANY") params.set("category", category)
    if (mode !== "default") params.set("mode", mode)
    if (sort !== "fastest") params.set("sort", sort)
    if (hideResets) params.set("resets", "hide")
    const qs = params.toString()
    window.history.replaceState(null, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`)
  }, [query, season, tab, category, mode, sort, hideResets])

  function search(event: FormEvent) {
    event.preventDefault()
    const name = input.trim()
    if (!name) return
    setQuery({ name, season, nonce: Date.now() })
  }

  function selectSeason(next: number) {
    setSeason(next)
    if (next !== CURRENT_SEASON) setPastOpen(true)
    setQuery((current) => (current ? { name: current.name, season: next, nonce: Date.now() } : current))
  }

  function remember(batch: [number, DetailSlice][]) {
    setDetails((current) => {
      const next = new Map(current)
      for (const [id, slice] of batch) next.set(id, slice)
      saveDetailCache(next)
      return next
    })
  }

  function forgetTimelines() {
    clearDetailCache()
    setDetails(new Map())
  }

  const pastSeasons = Array.from({ length: CURRENT_SEASON - 1 }, (_, index) => CURRENT_SEASON - 1 - index)

  return (
    <>
      <header className="top">
        <div className="brand">
          <span className="mark" aria-hidden="true">
            <svg viewBox="0 0 32 32" width="30" height="30" fill="none">
              <rect x="4" y="5" width="5.5" height="22" rx="2.75" fill="#17200c" />
              <rect x="12.5" y="10" width="5.5" height="17" rx="2.75" fill="#17200c" opacity="0.7" />
              <rect x="21" y="15" width="5.5" height="12" rx="2.75" fill="#17200c" opacity="0.42" />
              <rect x="28" y="20" width="3" height="7" rx="1.5" fill="#9a6d00" />
            </svg>
          </span>
          <div>
            <h1>Pace Rooms</h1>
            <p>MCSR Ranked private rooms, sorted by the player&apos;s own pace.</p>
          </div>
        </div>
        <form className="search" onSubmit={search}>
          <label>
            <span className="sr">Minecraft name</span>
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Minecraft name"
              spellCheck={false}
              autoCapitalize="off"
              maxLength={32}
            />
          </label>
          <button type="submit" className="primary" disabled={loading || input.trim().length === 0}>
            {loading ? "Loading…" : "Search"}
          </button>
        </form>
      </header>

      <section className="intro">
        <p>
          Ranked records a fastest time for ranked matches. Private rooms do not, so the only built-in way to find a
          private pace is opening runs one by one. This lists a player&apos;s private matches for season {CURRENT_SEASON},
          keeps categories like Any%, All Advancements, and Kill Wither apart, and can read split timelines for Any%.
        </p>
        <div className="seasons">
          <button
            type="button"
            className={season === CURRENT_SEASON ? "on" : ""}
            onClick={() => selectSeason(CURRENT_SEASON)}
          >
            Season {CURRENT_SEASON}
          </button>
          <button type="button" aria-expanded={pastOpen} onClick={() => setPastOpen((open) => !open)}>
            Past seasons
          </button>
          {pastOpen && (
            <div className="season-grid">
              {pastSeasons.map((past) => (
                <button
                  key={past}
                  type="button"
                  className={season === past ? "on" : ""}
                  onClick={() => selectSeason(past)}
                >
                  S{past}
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {!profile && !loading && !error && (
        <section className="panel empty-hero">
          <h2>Search a player</h2>
          <p>Use the name they play on. Season {season} loads first. Past seasons are the row above.</p>
        </section>
      )}

      {error && <p className="banner bad">{error}</p>}
      {loading && (
        <p className="banner">
          Loading season {season} private matches{loadedCount > 0 ? `… ${loadedCount}` : "…"}
        </p>
      )}

      {profile && (
        <div className="playerbar">
          <img src={headUrl(profile.uuid)} alt="" width={40} height={40} />
          <div>
            <a href={profileUrl(profile.nickname)} target="_blank" rel="noreferrer">
              {profile.nickname}
            </a>
            <span>
              {profile.eloRate == null ? "Unranked" : `${profile.eloRate} Elo`}
              {profile.eloRank != null ? ` · #${profile.eloRank}` : ""} · Season {season}
            </span>
          </div>
          <div className="tabs" role="tablist">
            <button type="button" role="tab" aria-selected={tab === "matches"} className={tab === "matches" ? "on" : ""} onClick={() => setTab("matches")}>
              Matches
            </button>
            <button type="button" role="tab" aria-selected={tab === "pace"} className={tab === "pace" ? "on" : ""} onClick={() => setTab("pace")}>
              Analysis
            </button>
          </div>
        </div>
      )}

      {profile && !loading && matches.length === 0 && !error && (
        <p className="banner">
          {profile.nickname} has no private-room matches in season {season}.
        </p>
      )}

      {profile && matches.length > 0 && tab === "matches" && (
        <MatchBoard
          matches={matches}
          uuid={profile.uuid}
          nickname={profile.nickname}
          listKey={`${profile.uuid}:${season}:${matches[0]?.id ?? 0}:${matches.length}`}
          details={details}
          category={category}
          mode={mode}
          sort={sort}
          hideResets={hideResets}
          onCategory={setCategory}
          onMode={setMode}
          onSort={setSort}
          onHideResets={setHideResets}
        />
      )}

      {profile && tab === "pace" && loading && <p className="banner">The match list is still loading.</p>}
      {profile && tab === "pace" && !loading && (
        <PacePanel
          matches={matches}
          uuid={profile.uuid}
          nickname={profile.nickname}
          season={season}
          details={details}
          onBatch={remember}
          onClear={forgetTimelines}
        />
      )}

      <footer>
        Times come from the public MCSR Ranked API. This site is not part of MCSR Ranked. Match links open the ranked
        stats page.
      </footer>
    </>
  )
}
=======
import { useEffect, useState, type FormEvent } from "react"
import { ApiError, fetchPrivateMatches, fetchUser } from "./api"
import { clearDetailCache, loadDetailCache, saveDetailCache } from "./cache"
import { CURRENT_SEASON } from "./constants"
import { headUrl, profileUrl } from "./format"
import { MatchBoard } from "./MatchBoard"
import { PacePanel } from "./PacePanel"
import { uniqueCategories, uniqueModes } from "./stats"
import type { DetailSlice, MatchSummary, Player, SortKey } from "./types"

type Query = { name: string; season: number; nonce: number }
type Tab = "matches" | "pace"

function readSearch() {
  const params = new URLSearchParams(window.location.search)
  const seasonNumber = Number(params.get("season"))
  const season =
    Number.isInteger(seasonNumber) && seasonNumber >= 1 ? Math.min(seasonNumber, CURRENT_SEASON) : CURRENT_SEASON
  const sortValue = params.get("sort")
  const sort: SortKey =
    sortValue === "slowest" || sortValue === "newest" || sortValue === "oldest" ? sortValue : "fastest"
  const tab: Tab = params.get("tab") === "pace" ? "pace" : "matches"
  return {
    input: params.get("player") ?? "",
    season,
    tab,
    category: params.get("category") || "ANY",
    mode: params.get("mode") || "default",
    sort,
    hideResets: params.get("resets") === "hide",
  }
}

export function App() {
  const [input, setInput] = useState(() => readSearch().input)
  const [season, setSeason] = useState(() => readSearch().season)
  const [pastOpen, setPastOpen] = useState(() => readSearch().season !== CURRENT_SEASON)
  const [tab, setTab] = useState<Tab>(() => readSearch().tab)
  const [category, setCategory] = useState(() => readSearch().category)
  const [mode, setMode] = useState(() => readSearch().mode)
  const [sort, setSort] = useState<SortKey>(() => readSearch().sort)
  const [hideResets, setHideResets] = useState(() => readSearch().hideResets)
  const [query, setQuery] = useState<Query | null>(() => {
    const initial = readSearch()
    const name = initial.input.trim()
    return name ? { name, season: initial.season, nonce: 1 } : null
  })
  const [profile, setProfile] = useState<Player | null>(null)
  const [matches, setMatches] = useState<MatchSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [loadedCount, setLoadedCount] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [details, setDetails] = useState<Map<number, DetailSlice>>(() => loadDetailCache())

  useEffect(() => {
    if (!query) return
    const controller = new AbortController()
    let active = true
    setLoading(true)
    setError(null)
    setLoadedCount(0)
    setMatches([])
    setProfile(null)

    const run = async () => {
      try {
        const user = await fetchUser(query.name, controller.signal)
        if (!active) return
        setProfile(user)
        const list = await fetchPrivateMatches(query.name, query.season, controller.signal, (count) => {
          if (active) setLoadedCount(count)
        })
        if (!active) return
        setMatches(list)
      } catch (caught) {
        if (!active || (caught instanceof DOMException && caught.name === "AbortError")) return
        if (caught instanceof ApiError) setError(caught.message)
        else setError("Couldn't load private matches.")
      } finally {
        if (active) setLoading(false)
      }
    }

    void run()
    return () => {
      active = false
      controller.abort()
    }
  }, [query])

  useEffect(() => {
    if (!profile) return
    setInput(profile.nickname)
    document.title = `${profile.nickname} · Private Runs`
    return () => {
      document.title = "Private Runs · MCSR Ranked"
    }
  }, [profile])

  useEffect(() => {
    if (matches.length === 0) return
    const categories = uniqueCategories(matches)
    if (category !== "all" && !categories.includes(category)) {
      setCategory(categories.includes("ANY") ? "ANY" : (categories[0] ?? "ANY"))
    }
    const modes = uniqueModes(matches)
    if (mode !== "all" && !modes.includes(mode)) {
      setMode(modes.includes("default") ? "default" : "all")
    }
  }, [matches, category, mode])

  useEffect(() => {
    const params = new URLSearchParams()
    if (query?.name) params.set("player", query.name)
    params.set("season", String(season))
    if (tab === "pace") params.set("tab", "pace")
    if (category !== "ANY") params.set("category", category)
    if (mode !== "default") params.set("mode", mode)
    if (sort !== "fastest") params.set("sort", sort)
    if (hideResets) params.set("resets", "hide")
    const qs = params.toString()
    window.history.replaceState(null, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`)
  }, [query, season, tab, category, mode, sort, hideResets])

  function search(event: FormEvent) {
    event.preventDefault()
    const name = input.trim()
    if (!name) return
    setQuery({ name, season, nonce: Date.now() })
  }

  function selectSeason(next: number) {
    setSeason(next)
    if (next !== CURRENT_SEASON) setPastOpen(true)
    setQuery((current) => (current ? { name: current.name, season: next, nonce: Date.now() } : current))
  }

  function remember(batch: [number, DetailSlice][]) {
    setDetails((current) => {
      const next = new Map(current)
      for (const [id, slice] of batch) next.set(id, slice)
      saveDetailCache(next)
      return next
    })
  }

  function forgetTimelines() {
    clearDetailCache()
    setDetails(new Map())
  }

  const pastSeasons = Array.from({ length: CURRENT_SEASON - 1 }, (_, index) => CURRENT_SEASON - 1 - index)

  return (
    <>
      <header className="top">
        <div className="brand">
          <span className="mark" aria-hidden="true">
            P
          </span>
          <div>
            <h1>Private Runs</h1>
            <p>MCSR Ranked private rooms, sorted by the player&apos;s own pace.</p>
          </div>
        </div>
        <form className="search" onSubmit={search}>
          <label>
            <span className="sr">Minecraft name</span>
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Minecraft name"
              spellCheck={false}
              autoCapitalize="off"
              maxLength={32}
            />
          </label>
          <button type="submit" className="primary" disabled={loading || input.trim().length === 0}>
            {loading ? "Loading…" : "Search"}
          </button>
        </form>
      </header>

      <section className="intro">
        <p>
          Ranked records a fastest time for ranked matches. Private rooms do not, so the only built-in way to find a
          private pace is opening runs one by one. This lists a player&apos;s private matches for season {CURRENT_SEASON},
          keeps categories like Any%, All Advancements, and Kill Wither apart, and can read split timelines for Any%.
        </p>
        <div className="seasons">
          <button
            type="button"
            className={season === CURRENT_SEASON ? "on" : ""}
            onClick={() => selectSeason(CURRENT_SEASON)}
          >
            Season {CURRENT_SEASON}
          </button>
          <button type="button" aria-expanded={pastOpen} onClick={() => setPastOpen((open) => !open)}>
            Past seasons
          </button>
          {pastOpen && (
            <div className="season-grid">
              {pastSeasons.map((past) => (
                <button
                  key={past}
                  type="button"
                  className={season === past ? "on" : ""}
                  onClick={() => selectSeason(past)}
                >
                  S{past}
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {!profile && !loading && !error && (
        <section className="panel empty-hero">
          <h2>Search a player</h2>
          <p>Use the name they play on. Season {season} loads first. Past seasons are the row above.</p>
        </section>
      )}

      {error && <p className="banner bad">{error}</p>}
      {loading && (
        <p className="banner">
          Loading season {season} private matches{loadedCount > 0 ? `… ${loadedCount}` : "…"}
        </p>
      )}

      {profile && (
        <div className="playerbar">
          <img src={headUrl(profile.uuid)} alt="" width={40} height={40} />
          <div>
            <a href={profileUrl(profile.nickname)} target="_blank" rel="noreferrer">
              {profile.nickname}
            </a>
            <span>
              {profile.eloRate == null ? "Unranked" : `${profile.eloRate} Elo`}
              {profile.eloRank != null ? ` · #${profile.eloRank}` : ""} · Season {season}
            </span>
          </div>
          <div className="tabs" role="tablist">
            <button type="button" role="tab" aria-selected={tab === "matches"} className={tab === "matches" ? "on" : ""} onClick={() => setTab("matches")}>
              Matches
            </button>
            <button type="button" role="tab" aria-selected={tab === "pace"} className={tab === "pace" ? "on" : ""} onClick={() => setTab("pace")}>
              Analysis
            </button>
          </div>
        </div>
      )}

      {profile && !loading && matches.length === 0 && !error && (
        <p className="banner">
          {profile.nickname} has no private-room matches in season {season}.
        </p>
      )}

      {profile && matches.length > 0 && tab === "matches" && (
        <MatchBoard
          matches={matches}
          uuid={profile.uuid}
          nickname={profile.nickname}
          listKey={`${profile.uuid}:${season}:${matches[0]?.id ?? 0}:${matches.length}`}
          details={details}
          category={category}
          mode={mode}
          sort={sort}
          hideResets={hideResets}
          onCategory={setCategory}
          onMode={setMode}
          onSort={setSort}
          onHideResets={setHideResets}
        />
      )}

      {profile && tab === "pace" && loading && <p className="banner">The match list is still loading.</p>}
      {profile && tab === "pace" && !loading && (
        <PacePanel
          matches={matches}
          uuid={profile.uuid}
          nickname={profile.nickname}
          season={season}
          details={details}
          onBatch={remember}
          onClear={forgetTimelines}
        />
      )}

      <footer>
        Times come from the public MCSR Ranked API. This site is not part of MCSR Ranked. Match links open the ranked
        stats page.
      </footer>
    </>
  )
}
>>>>>>> 0c65a2961f7db6832bc3a2725e65c87241965e32
