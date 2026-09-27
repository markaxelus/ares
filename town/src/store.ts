// Shared town state, brain polling with SSE reconnects, and placement saves.
import { create } from "zustand";
import type { PlanetName } from "./planet";
import type { Brain, BrainEvent } from "./types";
const LOOK_KEY = "ares-town.pixelSize";
/** Pixel size remembered in this browser. Zero means full resolution. */
function savedPixelSize() {
  try {
    const value = Number(localStorage.getItem(LOOK_KEY));
    return [0, 2, 4].includes(value) ? value : 0;
  } catch {
    return 0;
  }
}
/** A tile the camera lands on, on either planet. */
export type Focus = { planet: PlanetName; tile: number };
/** Where the camera goes when nothing is focused. */
export type View = "system" | PlanetName;
type State = {
  activity: string;
  builds: Record<string, number>;
  illuminated: Record<string, number>;
  pixelSize: number;
  fps: number;
  loadMs: number;
  focus: Focus | null;
  view: View;
  jump: number;
  selected: string | null;
  brain: Brain | null;
  rev: string;
  status: string;
  error: string;
  dragging: string | null;
  events: BrainEvent[];
  hover: string | null;
  setPixelSize: (pixelSize: number) => void;
  look: (to: {
    focus?: Focus | null;
    view?: View;
    selected?: string | null;
  }) => void;
  set: (v: Partial<Omit<State, "set">>) => void;
};
export const useTown = create<State>((set) => ({
  activity: "Robots are charging at the factory",
  builds: {},
  illuminated: {},
  pixelSize: savedPixelSize(),
  fps: 0,
  loadMs: 0,
  focus: null,
  view: "system",
  jump: 0,
  selected: null,
  brain: null,
  rev: "",
  status: "Connecting",
  error: "",
  dragging: null,
  events: [],
  hover: null,
  setPixelSize: (pixelSize) => {
    set({ pixelSize });
    try {
      localStorage.setItem(LOOK_KEY, String(pixelSize));
    } catch {
      /* Private windows may refuse storage; the setting still applies now. */
    }
  },
  // Every navigation bumps jump so the camera moves even to the same place again.
  look: (to) => set((s) => ({ ...to, jump: s.jump + 1 })),
  set,
}));
let request: Promise<void> | null = null;
export function refreshBrain() {
  if (request) return request;
  request = (async () => {
    try {
      const r = await fetch("/api/brain");
      if (!r.ok) throw new Error(`Brain returned ${r.status}`);
      const { doc, rev } = await r.json();
      if (rev !== useTown.getState().rev) useTown.setState({ brain: doc, rev });
      useTown.setState({ error: "" });
    } catch (e) {
      useTown.setState({ error: String(e) });
    } finally {
      request = null;
    }
  })();
  return request;
}
export function connectBrain() {
  let stopped = false;
  void refreshBrain();
  const timer = setInterval(() => {
    if (!document.hidden) void refreshBrain();
  }, 3000);
  const source = new EventSource("/api/events");
  source.onopen = () => useTown.setState({ status: "Connected" });
  source.onerror = () => useTown.setState({ status: "Reconnecting" });
  source.onmessage = (e) => {
    try {
      const event = {
        ...JSON.parse(e.data),
        sequence: e.lastEventId,
      } as BrainEvent;
      // Poll reads are audited, but only agent reads call Scout into action.
      if (event.source === "http:brain") return;
      useTown.setState((s) => ({ events: [...s.events.slice(-511), event] }));
      if (!stopped) void refreshBrain();
    } catch {
      /* A partially written or unrelated record must not close the stream. */
    }
  };
  return () => {
    stopped = true;
    source.close();
    clearInterval(timer);
  };
}
export async function moveBuilding(id: string, tile: number) {
  const state = useTown.getState();
  if (!state.brain) return;
  const doc = {
    ...state.brain,
    nodes: state.brain.nodes.map((n) => (n.id === id ? { ...n, tile } : n)),
  };
  try {
    const r = await fetch("/api/brain", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ baseRev: state.rev, doc }),
    });
    if (r.status === 409) {
      await refreshBrain();
      throw new Error("The brain changed. Please drag the building again.");
    }
    if (!r.ok) throw new Error(`Could not save placement (${r.status})`);
    const result = await r.json();
    useTown.setState({ brain: doc, rev: result.rev, error: "" });
  } catch (e) {
    useTown.setState({ error: String(e) });
  }
}
