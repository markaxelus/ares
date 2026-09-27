// Town app shell: canvas, header, explore and quest panels, details, search and footer.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { World } from "./Scene";
import { BrainWorld } from "./BrainWorld";
import { FactoryWorld } from "./Factory";
import { Tunnel } from "./Tunnel";
import { Workers } from "./Robots";
import { useTown, connectBrain, type View } from "./store";
import { breadcrumb, layoutBrain } from "./layout";
import { ASKS, DONE, brief, progress, streakLine, type Progress } from "./game";
import { factoryTiles, tiles } from "./planet";
import type { BrainNode } from "./types";
import "./style.css";
const tileCount = (tiles.length + factoryTiles.length).toLocaleString("en-US");
const QUESTS_SHOWN = 12;
function App() {
  const [search, setSearch] = useState(false),
    [query, setQuery] = useState(""),
    [allLinks, setAllLinks] = useState(false),
    [places, setPlaces] = useState(false),
    [quests, setQuests] = useState(false),
    [allQuests, setAllQuests] = useState(false),
    [toasts, setToasts] = useState<{ id: number; text: string }[]>([]);
  const {
    brain,
    fps,
    status,
    error,
    selected,
    hover,
    pixelSize,
    setPixelSize,
    activity,
    loadMs,
  } = useTown();
  const input = useRef<HTMLInputElement>(null);
  const open = useRef({ search, places, quests });
  open.current = { search, places, quests };
  const layout = useMemo(() => (brain ? layoutBrain(brain) : null), [brain]);
  const game = useMemo(() => (brain ? progress(brain) : null), [brain]);
  const previous = useRef<Progress | null>(null);
  useEffect(connectBrain, []);
  // Ares briefs you on the first load; afterwards every tended quest is celebrated.
  useEffect(() => {
    if (!game) return;
    const before = previous.current;
    previous.current = game;
    if (!before) {
      useTown.setState({ activity: brief(game) });
      return;
    }
    const lines = before.quests
      .filter(
        (q) => !game.quests.some((n) => n.id === q.id && n.kind === q.kind),
      )
      .slice(0, 3)
      .map((q) => `${DONE[q.kind]}: ${q.title}`);
    if (game.level > before.level)
      lines.push(`Level ${game.level}. The planet grew.`);
    if (game.streak > before.streak && game.streak > 1)
      lines.push(`${game.streak}-day streak`);
    if (!lines.length) return;
    const ids = lines.map(() => Math.random());
    setToasts((t) => [...t, ...lines.map((text, i) => ({ id: ids[i], text }))]);
    setTimeout(
      () => setToasts((t) => t.filter((x) => !ids.includes(x.id))),
      7000,
    );
  }, [game]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearch((v) => !v);
      }
      // Escape steps back: close what is open, then the place, then the planet.
      if (e.key === "Escape") {
        const s = useTown.getState();
        if (open.current.search || open.current.places || open.current.quests) {
          setSearch(false);
          setPlaces(false);
          setQuests(false);
        } else if (s.selected) useTown.setState({ selected: null });
        else if (s.focus) s.look({ focus: null, view: s.focus.planet });
        else s.look({ view: "system" });
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  useEffect(() => {
    if (search) input.current?.focus();
  }, [search]);
  const select = (n: BrainNode) => {
    const tile = layout?.positions.get(n.id);
    if (tile !== undefined && tile >= 0)
      useTown
        .getState()
        .look({ selected: n.id, focus: { planet: "brain", tile } });
    setSearch(false);
    setPlaces(false);
    setQuests(false);
  };
  const go = (view: View) => {
    useTown.getState().look({ view, focus: null, selected: null });
    setPlaces(false);
  };
  const shownQuests = game
    ? allQuests
      ? game.quests
      : game.quests.slice(0, QUESTS_SHOWN)
    : [];
  const node = brain?.nodes.find((n) => n.id === selected),
    hits =
      brain?.nodes
        .filter((n) => n.title.toLowerCase().includes(query.toLowerCase()))
        .slice(0, 12) || [];
  return (
    <main data-pixels={pixelSize ? "" : undefined}>
      <World>
        <BrainWorld layout={layout} allLinks={allLinks} />
        <FactoryWorld layout={layout} brain={brain} />
        {layout && <Tunnel layout={layout} />}
        {layout && <Workers layout={layout} />}
      </World>
      <header>
        <a href="/" title="Back to graph">
          Ares <span>/ town</span>
        </a>
        <nav>
          <button
            onClick={() => {
              setQuery("");
              setSearch(true);
            }}
          >
            Find a place <kbd>Ctrl K</kbd>
          </button>
          <button
            aria-expanded={quests}
            onClick={() => {
              setQuests(!quests);
              setPlaces(false);
            }}
          >
            Quests{game && <em>{game.quests.length}</em>}
          </button>
          <button
            aria-expanded={places}
            onClick={() => {
              setPlaces(!places);
              setQuests(false);
            }}
          >
            Explore
          </button>
        </nav>
      </header>
      {quests && game && brain && (
        <section className="places quests" aria-label="Quests">
          <h2>Level {game.level}</h2>
          <div
            className="bar"
            role="progressbar"
            aria-valuemin={game.levelStart}
            aria-valuemax={game.levelEnd}
            aria-valuenow={game.points}
          >
            <span
              style={{
                width: `${Math.min(
                  100,
                  ((game.points - game.levelStart) /
                    (game.levelEnd - game.levelStart)) *
                    100,
                )}%`,
              }}
            />
          </div>
          <p className="meter">
            {game.points} points · {game.levelEnd - game.points} to level{" "}
            {game.level + 1}
          </p>
          <p className="meter">{streakLine(game)}</p>
          <h3>Quests</h3>
          {shownQuests.map((q) => (
            <button
              key={`${q.kind}:${q.id}`}
              onClick={() => {
                const n = brain.nodes.find((x) => x.id === q.id);
                if (n) select(n);
              }}
            >
              {q.title}
              <span>{ASKS[q.kind]}</span>
            </button>
          ))}
          {game.quests.length > shownQuests.length && (
            <button onClick={() => setAllQuests(true)}>
              And {game.quests.length - shownQuests.length} more
            </button>
          )}
          {!game.quests.length && (
            <p className="meter">Nothing to tend. Well kept.</p>
          )}
          <p className="meter">
            Points come from how mature each place is: details written,
            confidence high, linked to others. Tend a place in the graph or the
            CLI and watch it grow here.
          </p>
        </section>
      )}
      {places && (
        <section className="places">
          <h2>Your system</h2>
          <button onClick={() => go("system")}>Everything</button>
          <button onClick={() => go("brain")}>
            Knowledge planet<span>{brain?.nodes.length || 0} places</span>
          </button>
          <button onClick={() => go("factory")}>
            Factory<span>Ares HQ</span>
          </button>
          <h3>Regions</h3>
          {layout?.groups.map((g) => (
            <button key={g.id} onClick={() => select(g)}>
              {g.title}
              <span>
                {
                  brain?.nodes.filter((n) => layout.groupOf.get(n.id) === g.id)
                    .length
                }
              </span>
            </button>
          ))}
          <label>
            Look
            <select
              value={pixelSize}
              onChange={(e) => setPixelSize(Number(e.target.value))}
            >
              <option value="0">Full resolution</option>
              <option value="2">Fine pixels</option>
              <option value="4">Classic pixels</option>
            </select>
          </label>
          <label>
            <input
              type="checkbox"
              checked={allLinks}
              onChange={(e) => setAllLinks(e.target.checked)}
            />{" "}
            Show every rail
          </label>
          <p className="performance">
            {fps} fps
            {loadMs > 0
              ? ` · Ready in ${(loadMs / 1000).toFixed(2)} s`
              : " · Loading models"}
          </p>
        </section>
      )}
      {node && brain && (
        <aside className="panel" aria-label={node.title}>
          <button
            className="close"
            onClick={() => useTown.setState({ selected: null })}
            aria-label="Close details"
          >
            ×
          </button>
          <div className="breadcrumb">
            {breadcrumb(node, brain).map((n, i) => (
              <React.Fragment key={n.id}>
                {i > 0 && " / "}
                <button onClick={() => select(n)}>{n.title}</button>
              </React.Fragment>
            ))}
          </div>
          <p className="type">
            {brain.types[node.type]?.label || node.type}
            {node.pinned ? " · Pinned" : ""}
          </p>
          <h1>{node.title}</h1>
          <p className="summary">{node.summary}</p>
          {node.body && <div className="body">{node.body}</div>}
          <div className="tags">
            {node.tags?.map((t) => (
              <span key={t}>{t}</span>
            ))}
          </div>
          <dl>
            <dt>Confidence</dt>
            <dd>{node.confidence || "Not set"}</dd>
            <dt>Source</dt>
            <dd>{node.source || "Not set"}</dd>
            <dt>Updated</dt>
            <dd>{node.updated || node.created || "Not set"}</dd>
          </dl>
          <h2>Connections</h2>
          <div className="connections">
            {brain.edges
              .filter((e) => e.from === node.id || e.to === node.id)
              .map((e) => {
                const other = brain.nodes.find(
                  (n) => n.id === (e.from === node.id ? e.to : e.from),
                );
                return other ? (
                  <button key={e.id} onClick={() => select(other)}>
                    <small>
                      {e.from === node.id ? "→" : "←"}{" "}
                      {brain.rels[e.rel] || e.rel}
                    </small>
                    <span>{other.title}</span>
                    {e.note && <small>{e.note}</small>}
                  </button>
                ) : null;
              })}
          </div>
          <a className="graph-link" href={`/#${encodeURIComponent(node.id)}`}>
            Open in graph
          </a>
        </aside>
      )}
      {search && (
        <div
          className="scrim"
          onPointerDown={(e) => {
            if (e.target === e.currentTarget) setSearch(false);
          }}
        >
          <section
            className="search"
            role="dialog"
            aria-modal="true"
            aria-label="Find a place"
          >
            <div className="search-top">
              <input
                ref={input}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Find a place on your planet…"
                aria-label="Search titles"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && hits[0]) select(hits[0]);
                }}
              />
              <button
                onClick={() => setSearch(false)}
                aria-label="Close search"
              >
                Esc
              </button>
            </div>
            <div className="results">
              {hits.map((n) => (
                <button key={n.id} onClick={() => select(n)}>
                  <span>{n.title}</span>
                  <small>
                    {brain &&
                      breadcrumb(n, brain)
                        .slice(0, -1)
                        .map((p) => p.title)
                        .join(" / ")}
                  </small>
                </button>
              ))}
              {!hits.length && <p>No places match “{query}”.</p>}
            </div>
          </section>
        </div>
      )}
      {hover && !search && <div className="hover-label">{hover}</div>}
      {toasts.length > 0 && (
        <div className="toasts" aria-live="polite">
          {toasts.map((t) => (
            <div key={t.id} className="toast">
              {t.text}
            </div>
          ))}
        </div>
      )}
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      <div className="activity" aria-live="polite">
        {activity}
      </div>
      <footer>
        <span>
          {status === "Connected"
            ? `${brain?.nodes.length || 0} places${
                game
                  ? ` · Level ${game.level}${
                      game.streak ? ` · ${game.streak}-day streak` : ""
                    }`
                  : ""
              }`
            : status}
          <span className="hint">
            {" "}
            · Drag to orbit. Scroll to zoom. Click a tile to land. Esc backs
            out.
          </span>
        </span>
        <span>
          {fps} fps <span className="hint">· {tileCount} tiles</span>
        </span>
      </footer>
    </main>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
