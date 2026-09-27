// Town app shell: canvas, header, explore panel, details panel, search and footer.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { World } from "./Scene";
import { BrainWorld } from "./BrainWorld";
import { FactoryWorld } from "./Factory";
import { Tunnel } from "./Tunnel";
import { Workers } from "./Robots";
import { useTown, connectBrain, type View } from "./store";
import { breadcrumb, layoutBrain } from "./layout";
import { factoryTiles, tiles } from "./planet";
import type { BrainNode } from "./types";
import "./style.css";
const tileCount = (tiles.length + factoryTiles.length).toLocaleString("en-US");
function App() {
  const [search, setSearch] = useState(false),
    [query, setQuery] = useState(""),
    [allLinks, setAllLinks] = useState(false),
    [places, setPlaces] = useState(false);
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
  const open = useRef({ search, places });
  open.current = { search, places };
  const layout = useMemo(() => (brain ? layoutBrain(brain) : null), [brain]);
  useEffect(connectBrain, []);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearch((v) => !v);
      }
      // Escape steps back: close what is open, then the place, then the planet.
      if (e.key === "Escape") {
        const s = useTown.getState();
        if (open.current.search || open.current.places) {
          setSearch(false);
          setPlaces(false);
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
  };
  const go = (view: View) => {
    useTown.getState().look({ view, focus: null, selected: null });
    setPlaces(false);
  };
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
          <button aria-expanded={places} onClick={() => setPlaces(!places)}>
            Explore
          </button>
        </nav>
      </header>
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
            ? `${brain?.nodes.length || 0} places`
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
