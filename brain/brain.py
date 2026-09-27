#!/usr/bin/env python3
"""Second brain for Ares: a small personal knowledge graph you can query and edit.

Everything lives in brain.json next to this file. This script is both the
command line and the tiny local server behind index.html. Standard library only.

    py -3.13 brain/brain.py serve                # open the UI
    py -3.13 brain/brain.py tree                 # the outline
    py -3.13 brain/brain.py find "type:goal startup"
    py -3.13 brain/brain.py show next-36
    py -3.13 brain/brain.py add --type belief --title "..." --summary "..."
    py -3.13 brain/brain.py link htn-2026 supports things-that-should-exist
    py -3.13 brain/brain.py import ~/Downloads/brain-extract.json   # merge facts from another chat
    py -3.13 brain/brain.py context "next 36"      # compact pack for an agent
    py -3.13 brain/brain.py log "Peggy offered an intro to X"   # quick note into the Inbox
    py -3.13 brain/brain.py ingest meeting.txt     # extract facts from a transcript and merge them
    py -3.13 brain/brain.py mcp                    # MCP server for Claude Code / agents
    py -3.13 brain/brain.py --help

Query syntax (shared with the UI):
    free words          match title, summary, body, tags or id
    type:goal  t:goal   node type (key or label prefix)
    tag:x  #x           has tag
    conf:high|medium|low
    is:pinned  is:orphan  is:recent
    since:2026-09-01    updated on or after a date
    rel:supports        touches an edge with this relation
    link:<id>           the node itself or anything connected to it
    in:<id>             anything inside that group, any depth
    is:group  is:root
    -term               negate any of the above
"""
from __future__ import annotations

import argparse
import hashlib
import json
import mimetypes
from contextvars import ContextVar
import os
import re
import shlex
import shutil
import subprocess
import sys
import threading
import time
import urllib.request
import webbrowser
from datetime import date, datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse, unquote

HERE = Path(__file__).resolve().parent
DATA = HERE / "brain.json"
HISTORY = HERE / "history"
INDEX = HERE / "index.html"
MAX_SNAPSHOTS = 30
INBOX = HERE / "inbox"
DONE = INBOX / "done"
INBOX_ID = "inbox"
CONFIDENCE = ("high", "medium", "low")
QUERY_KEYS = {"type", "t", "tag", "conf", "is", "since", "rel", "link", "id", "in"}
_lock = threading.RLock()
EVENTS = HERE / "events.jsonl"
TOWN = HERE.parent / "town" / "dist"
_event_source = ContextVar("event_source", default="brain")
_pending_events = threading.local()


def emit_event(kind: str, ids=(), source: str | None = None, **details) -> None:
    """One append syscall per record; never write user content or break a brain command."""
    record = {"kind": kind, "ids": list(dict.fromkeys(ids)),
              "source": source or _event_source.get(),
              "timestamp": datetime.now(timezone.utc).isoformat(), **details}
    raw = (json.dumps(record, ensure_ascii=False) + "\n").encode("utf-8")
    try:
        fd = os.open(EVENTS, os.O_WRONLY | os.O_CREAT | os.O_APPEND | getattr(os, "O_BINARY", 0), 0o600)
        try:
            os.write(fd, raw)
        finally:
            os.close(fd)
    except OSError as exc:
        print(f"event log unavailable: {exc}", file=sys.stderr)



# ----------------------------------------------------------------- storage

def today() -> str:
    return date.today().isoformat()


def dumps(doc: dict) -> str:
    return json.dumps(doc, indent=2, ensure_ascii=False) + "\n"


def rev_of(raw: bytes) -> str:
    return hashlib.sha1(raw).hexdigest()[:12]


def load(*, audit=True) -> dict:
    if not DATA.exists():
        return {"meta": {"name": "Second brain", "version": 1, "updated": today()},
                "types": {}, "rels": {}, "nodes": [], "edges": []}
    with DATA.open("r", encoding="utf-8") as f:
        doc = json.load(f)
    if audit:
        emit_event("mcp_read", [n["id"] for n in doc["nodes"]])
    return doc


def snapshot() -> None:
    """Copy the current file into history/ before overwriting it."""
    if not DATA.exists():
        return
    HISTORY.mkdir(exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    target = HISTORY / f"brain-{stamp}.json"
    if target.exists():  # two saves in the same second
        target = HISTORY / f"brain-{stamp}-{rev_of(DATA.read_bytes())}.json"
    target.write_bytes(DATA.read_bytes())
    snaps = sorted(HISTORY.glob("brain-*.json"))
    for old in snaps[:-MAX_SNAPSHOTS]:
        old.unlink()


def save(doc: dict) -> str:
    """Validate, snapshot, write atomically. Returns the new revision."""
    errors = validate(doc)
    if errors:
        raise ValueError("; ".join(errors))
    doc.setdefault("meta", {})["updated"] = today()
    raw = dumps(doc).encode("utf-8")
    with _lock:
        if DATA.exists() and DATA.read_bytes() == raw:
            emit_event("mcp_write", [], rev=rev_of(raw), unchanged=True)
            for event in getattr(_pending_events, "items", []):
                emit_event(**event)
            _pending_events.items = []
            return rev_of(raw)
        before = load(audit=False)
        snapshot()
        tmp = DATA.with_suffix(".json.tmp")
        tmp.write_bytes(raw)
        os.replace(tmp, DATA)
        old = node_index(before)
        new = node_index(doc)
        for nid, node in new.items():
            if nid not in old:
                emit_event("node_added", [nid])
                if node.get("parent") == INBOX_ID and node.get("type") == "note":
                    emit_event("note", [nid, INBOX_ID])
            elif node != old[nid]:
                emit_event("node_updated", [nid])
        edges = {e["id"] for e in before["edges"]}
        for edge in doc["edges"]:
            if edge["id"] not in edges:
                emit_event("link_added", [edge["from"], edge["to"]], edge_id=edge["id"])
        changed = [nid for nid in old.keys() | new.keys() if old.get(nid) != new.get(nid)]
        emit_event("mcp_write", changed, rev=rev_of(raw))
    for event in getattr(_pending_events, "items", []):
        emit_event(**event)
    _pending_events.items = []
    return rev_of(raw)


def validate(doc: dict) -> list[str]:
    errors: list[str] = []
    if not isinstance(doc, dict):
        return ["document must be an object"]
    for key in ("meta", "types", "rels"):
        if not isinstance(doc.get(key), dict):
            errors.append(f"'{key}' must be an object")
    for key in ("nodes", "edges"):
        if not isinstance(doc.get(key), list):
            errors.append(f"'{key}' must be a list")
    if errors:
        return errors
    types = doc["types"]
    seen: set[str] = set()
    for i, n in enumerate(doc["nodes"]):
        where = f"node #{i}"
        if not isinstance(n, dict):
            errors.append(f"{where} must be an object"); continue
        nid = n.get("id")
        if not isinstance(nid, str) or not nid.strip():
            errors.append(f"{where} has no id"); continue
        if nid in seen:
            errors.append(f"duplicate node id '{nid}'")
        seen.add(nid)
        if n.get("type") not in types:
            errors.append(f"node '{nid}' has unknown type '{n.get('type')}'")
        if not isinstance(n.get("title"), str) or not n["title"].strip():
            errors.append(f"node '{nid}' has no title")
        if "tags" in n and not (isinstance(n["tags"], list) and all(isinstance(t, str) for t in n["tags"])):
            errors.append(f"node '{nid}' tags must be a list of strings")
        if "tile" in n and (type(n["tile"]) is not int or not 0 <= n["tile"] < 1002):
            errors.append(f"node '{nid}' tile must be an integer from 0 to 1001")
        if n.get("confidence") not in (None, *CONFIDENCE):
            errors.append(f"node '{nid}' confidence must be one of {', '.join(CONFIDENCE)}")
    parents = {n["id"]: n.get("parent") for n in doc["nodes"] if isinstance(n, dict) and isinstance(n.get("id"), str)}
    for nid, par in parents.items():
        if par is None:
            continue
        if par not in seen:
            errors.append(f"node '{nid}' has unknown parent '{par}'"); continue
        if par == nid:
            errors.append(f"node '{nid}' is its own parent"); continue
        hops, cur = 0, par
        while cur is not None and hops <= len(parents):
            cur = parents.get(cur); hops += 1
            if cur == nid:
                errors.append(f"node '{nid}' has a parent cycle"); break
    eseen: set[str] = set()
    for i, e in enumerate(doc["edges"]):
        where = f"edge #{i}"
        if not isinstance(e, dict):
            errors.append(f"{where} must be an object"); continue
        eid = e.get("id")
        if not isinstance(eid, str) or not eid:
            errors.append(f"{where} has no id"); continue
        if eid in eseen:
            errors.append(f"duplicate edge id '{eid}'")
        eseen.add(eid)
        for end in ("from", "to"):
            if e.get(end) not in seen:
                errors.append(f"edge '{eid}' {end} '{e.get(end)}' is not a node")
        if not isinstance(e.get("rel"), str) or not e["rel"]:
            errors.append(f"edge '{eid}' has no rel")
    return errors


# ----------------------------------------------------------------- helpers

def slugify(text: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return s[:48].rstrip("-") or "node"


def unique_id(doc: dict, base: str) -> str:
    ids = {n["id"] for n in doc["nodes"]}
    if base not in ids:
        return base
    i = 2
    while f"{base}-{i}" in ids:
        i += 1
    return f"{base}-{i}"


def node_index(doc: dict) -> dict[str, dict]:
    return {n["id"]: n for n in doc["nodes"]}


def degrees(doc: dict) -> dict[str, int]:
    deg = {n["id"]: 0 for n in doc["nodes"]}
    for e in doc["edges"]:
        deg[e["from"]] = deg.get(e["from"], 0) + 1
        deg[e["to"]] = deg.get(e["to"], 0) + 1
    return deg


def resolve(doc: dict, ref: str) -> dict:
    """Find a node by exact id, then by case-insensitive title, then by prefix."""
    idx = node_index(doc)
    if ref in idx:
        return idx[ref]
    low = ref.lower()
    exact = [n for n in doc["nodes"] if n["title"].lower() == low]
    if len(exact) == 1:
        return exact[0]
    starts = [n for n in doc["nodes"] if n["id"].startswith(low) or n["title"].lower().startswith(low)]
    if len(starts) == 1:
        return starts[0]
    contains = [n for n in doc["nodes"] if low in n["id"] or low in n["title"].lower()]
    if len(contains) == 1:
        return contains[0]
    candidates = starts or contains
    if candidates:
        names = ", ".join(n["id"] for n in candidates[:8])
        raise SystemExit(f"'{ref}' is ambiguous: {names}")
    raise SystemExit(f"no node matches '{ref}'")


def edges_of(doc: dict, nid: str) -> list[dict]:
    return [e for e in doc["edges"] if e["from"] == nid or e["to"] == nid]


def rel_label(doc: dict, rel: str) -> str:
    return doc["rels"].get(rel) or rel.replace("_", " ")


def children_of(doc: dict, nid: str | None) -> list[dict]:
    kids = [n for n in doc["nodes"] if n.get("parent") == nid] if nid else [n for n in doc["nodes"] if not n.get("parent")]
    return sorted(kids, key=lambda n: (n.get("order") if isinstance(n.get("order"), (int, float)) else 1e9, n.get("created", ""), n["title"].lower()))


def ancestors_of(doc: dict, nid: str) -> list[str]:
    idx = node_index(doc); out = []; cur = idx.get(nid, {}).get("parent")
    while cur and cur not in out:
        out.append(cur); cur = idx.get(cur, {}).get("parent")
    return out


def descendants_of(doc: dict, nid: str) -> list[str]:
    out, stack = [], [nid]
    while stack:
        cur = stack.pop()
        for k in children_of(doc, cur):
            out.append(k["id"]); stack.append(k["id"])
    return out


# ----------------------------------------------------------------- queries

def parse_query(q: str) -> list[tuple[str, str, bool]]:
    """Return (key, value, negated) triples. Key is 'text' for free words."""
    try:
        tokens = shlex.split(q)
    except ValueError:
        tokens = q.split()
    out = []
    for tok in tokens:
        neg = tok.startswith("-") and len(tok) > 1
        if neg:
            tok = tok[1:]
        if tok.startswith("#") and len(tok) > 1:
            out.append(("tag", tok[1:], neg)); continue
        if ":" in tok:
            key, val = tok.split(":", 1)
            if key in QUERY_KEYS and val:
                out.append(("type" if key == "t" else key, val, neg)); continue
        out.append(("text", tok, neg))
    return out


def matches(doc: dict, node: dict, terms, deg: dict[str, int]) -> bool:
    types = doc["types"]
    for key, val, neg in terms:
        v = val.lower()
        if key == "text":
            hay = " ".join([node.get("title", ""), node.get("summary", ""), node.get("body", ""),
                            node["id"], " ".join(node.get("tags", []))]).lower()
            ok = v in hay
        elif key == "type":
            label = types.get(node["type"], {}).get("label", "").lower()
            ok = node["type"] == v or (bool(label) and label.startswith(v))
        elif key == "tag":
            ok = v in [t.lower() for t in node.get("tags", [])]
        elif key == "conf":
            ok = node.get("confidence", "").lower() == v
        elif key == "is":
            if v == "pinned":
                ok = bool(node.get("pinned"))
            elif v == "orphan":
                ok = deg.get(node["id"], 0) == 0
            elif v == "recent":
                ok = node.get("updated", "") >= (date.today() - timedelta(days=7)).isoformat()
            elif v == "group":
                ok = bool(children_of(doc, node["id"]))
            elif v == "root":
                ok = not node.get("parent")
            else:
                ok = False
        elif key == "since":
            ok = node.get("updated", "") >= val
        elif key == "rel":
            ok = any(e["rel"] == v for e in edges_of(doc, node["id"]))
        elif key == "link":
            ok = node["id"] == val or any(
                (e["from"] == val and e["to"] == node["id"]) or (e["to"] == val and e["from"] == node["id"])
                for e in doc["edges"])
        elif key == "id":
            ok = node["id"] == val
        elif key == "in":
            ok = val in ancestors_of(doc, node["id"])
        else:
            ok = False
        if ok == neg:
            return False
    return True


def find(doc: dict, q: str) -> list[dict]:
    terms = parse_query(q or "")
    deg = degrees(doc)
    hits = [n for n in doc["nodes"] if matches(doc, n, terms, deg)]
    return sorted(hits, key=lambda n: (0 if n.get("pinned") else 1, _desc(n.get("updated", "")), n["title"].lower()))


def _desc(s: str) -> str:
    """Invert a string's sort order so newer ISO dates come first."""
    return "".join(chr(0x10FFFF - ord(c)) for c in s)


# ----------------------------------------------------------------- printing

def table(rows: list[list[str]], headers: list[str]) -> None:
    widths = [len(h) for h in headers]
    for r in rows:
        for i, c in enumerate(r):
            widths[i] = min(max(widths[i], len(c)), 60)
    def fmt(r):
        return "  ".join((c[:57] + "…" if len(c) > 60 else c).ljust(widths[i]) for i, c in enumerate(r)).rstrip()
    print(fmt(headers))
    print("  ".join("─" * w for w in widths))
    for r in rows:
        print(fmt(r))


def print_node(doc: dict, n: dict) -> None:
    t = doc["types"].get(n["type"], {}).get("label", n["type"])
    print(f"{n['title']}")
    print(f"{t.lower()} · {n['id']}" + ("  · pinned" if n.get("pinned") else ""))
    if n.get("summary"):
        print(f"\n{n['summary']}")
    if n.get("body"):
        print(f"\n{n['body']}")
    meta = []
    if n.get("tags"):
        meta.append("tags: " + ", ".join(n["tags"]))
    if n.get("confidence"):
        meta.append("confidence: " + n["confidence"])
    if n.get("source"):
        meta.append("source: " + n["source"])
    meta.append(f"created {n.get('created', '?')} · updated {n.get('updated', '?')}")
    print("\n" + "\n".join(meta))
    idx = node_index(doc)
    anc = ancestors_of(doc, n["id"])
    if anc:
        print("part of: " + " > ".join(idx[a]["title"] for a in reversed(anc)))
    kids = children_of(doc, n["id"])
    if kids:
        print(f"\ncontains ({len(kids)})")
        for k in kids:
            print(f"  · {k['title']} ({k['id']})")
    es = edges_of(doc, n["id"])
    if es:
        print(f"\nconnections ({len(es)})")
        for e in es:
            if e["from"] == n["id"]:
                other = idx.get(e["to"], {}).get("title", e["to"])
                line = f"  → {rel_label(doc, e['rel'])} · {other} ({e['to']})"
            else:
                other = idx.get(e["from"], {}).get("title", e["from"])
                line = f"  ← {other} ({e['from']}) · {rel_label(doc, e['rel'])}"
            if e.get("note"):
                line += f"  — {e['note']}"
            print(line)


def to_markdown(doc: dict) -> str:
    idx = node_index(doc)
    out = [f"# {doc['meta'].get('name', 'Second brain')}", "",
           f"_{len(doc['nodes'])} nodes · {len(doc['edges'])} links · updated {doc['meta'].get('updated', '?')}_", ""]

    def walk(parent, depth):
        for n in children_of(doc, parent):
            out.append(f"{'#' * min(depth + 2, 6)} {n['title']}  `{n['id']}`")
            if n.get("summary"):
                out.append(n["summary"])
            if n.get("body"):
                out.append(""); out.append(n["body"])
            bits = []
            if n.get("tags"):
                bits.append("tags: " + ", ".join(n["tags"]))
            if n.get("confidence"):
                bits.append("confidence: " + n["confidence"])
            if n.get("updated"):
                bits.append("updated: " + n["updated"])
            if bits:
                out.append(""); out.append("_" + " · ".join(bits) + "_")
            links = []
            for e in edges_of(doc, n["id"]):
                if e["from"] == n["id"]:
                    links.append(f"→ {rel_label(doc, e['rel'])} {idx.get(e['to'], {}).get('title', e['to'])}")
                else:
                    links.append(f"← {idx.get(e['from'], {}).get('title', e['from'])} {rel_label(doc, e['rel'])}")
            if links:
                out.append(""); out.extend(f"- {l}" for l in links)
            out.append("")
            walk(n["id"], depth + 1)

    walk(None, 0)
    return "\n".join(out).rstrip() + "\n"


# ----------------------------------------------------------------- commands

def cmd_find(a):
    doc = load()
    hits = find(doc, " ".join(a.query))
    if not hits:
        print("no matches"); return
    rows = [[n["id"], n["type"], n["title"], n.get("updated", "")] for n in hits]
    table(rows, ["id", "type", "title", "updated"])
    print(f"\n{len(hits)} of {len(doc['nodes'])}")


def cmd_show(a):
    doc = load()
    print_node(doc, resolve(doc, a.ref))


def cmd_add(a):
    doc = load()
    if a.type not in doc["types"]:
        raise SystemExit(f"unknown type '{a.type}'. Known: {', '.join(doc['types'])}")
    body = a.body or ""
    if body == "-":
        body = sys.stdin.read().strip()
    nid = unique_id(doc, a.id or slugify(a.title))
    node = {
        "id": nid, "type": a.type, "title": a.title.strip(), "summary": (a.summary or "").strip(),
        "body": body, "tags": [t.strip() for t in (a.tags or "").split(",") if t.strip()],
        "confidence": a.conf or "high", "source": a.source or f"CLI {today()}",
        "created": today(), "updated": today(),
    }
    if a.pin:
        node["pinned"] = True
    if a.parent:
        node["parent"] = resolve(doc, a.parent)["id"]
    if a.order is not None:
        node["order"] = a.order
    doc["nodes"].append(node)
    for spec in a.link or []:
        _apply_link(doc, nid, spec)
    save(doc)
    print(nid)


def _apply_link(doc: dict, nid: str, spec: str) -> None:
    """--link 'supports:other-id' (outgoing) or --link '<supports:other-id' (incoming)."""
    incoming = spec.startswith("<")
    spec = spec.lstrip("<>")
    if ":" not in spec:
        raise SystemExit(f"--link expects rel:node, got '{spec}'")
    rel, ref = spec.split(":", 1)
    other = resolve(doc, ref)["id"]
    src, dst = (other, nid) if incoming else (nid, other)
    add_edge(doc, src, rel, dst)


def add_edge(doc: dict, src: str, rel: str, dst: str, note: str = "") -> dict:
    if src == dst:
        raise SystemExit("a node can't link to itself")
    for e in doc["edges"]:
        if e["from"] == src and e["to"] == dst and e["rel"] == rel:
            return e
    if rel not in doc["rels"]:
        doc["rels"][rel] = rel.replace("_", " ")
    eid = f"{src}--{rel}--{dst}"
    edge = {"id": eid, "from": src, "to": dst, "rel": rel}
    if note:
        edge["note"] = note
    doc["edges"].append(edge)
    return edge


def cmd_edit(a):
    doc = load()
    n = resolve(doc, a.ref)
    changed = False
    for field in ("title", "summary", "body", "source"):
        val = getattr(a, field)
        if val is not None:
            if field == "body" and val == "-":
                val = sys.stdin.read().strip()
            n[field] = val
            changed = True
    if a.type is not None:
        if a.type not in doc["types"]:
            raise SystemExit(f"unknown type '{a.type}'")
        n["type"] = a.type; changed = True
    if a.conf is not None:
        n["confidence"] = a.conf; changed = True
    if a.tags is not None:
        n["tags"] = [t.strip() for t in a.tags.split(",") if t.strip()]; changed = True
    for t in a.add_tag or []:
        if t not in n.setdefault("tags", []):
            n["tags"].append(t); changed = True
    for t in a.rm_tag or []:
        if t in n.get("tags", []):
            n["tags"].remove(t); changed = True
    if a.pin:
        n["pinned"] = True; changed = True
    if a.unpin:
        n.pop("pinned", None); changed = True
    if a.parent is not None:
        if a.parent.lower() in ("none", "root", "-"):
            n.pop("parent", None)
        else:
            p = resolve(doc, a.parent)
            if p["id"] == n["id"] or p["id"] in descendants_of(doc, n["id"]):
                raise SystemExit("that would create a cycle")
            n["parent"] = p["id"]
        changed = True
    if a.order is not None:
        n["order"] = a.order; changed = True
    if not changed:
        raise SystemExit("nothing to change")
    n["updated"] = today()
    save(doc)
    print(f"updated {n['id']}")


def cmd_rm(a):
    doc = load()
    n = resolve(doc, a.ref)
    before = len(doc["edges"])
    doc["edges"] = [e for e in doc["edges"] if e["from"] != n["id"] and e["to"] != n["id"]]
    for k in children_of(doc, n["id"]):
        if n.get("parent"):
            k["parent"] = n["parent"]
        else:
            k.pop("parent", None)
    doc["nodes"] = [x for x in doc["nodes"] if x["id"] != n["id"]]
    save(doc)
    print(f"removed {n['id']} and {before - len(doc['edges'])} link(s)")


def cmd_link(a):
    doc = load()
    src = resolve(doc, a.src)["id"]
    dst = resolve(doc, a.dst)["id"]
    e = add_edge(doc, src, a.rel, dst, a.note or "")
    save(doc)
    print(e["id"])


def cmd_unlink(a):
    doc = load()
    if a.id:
        keep = [e for e in doc["edges"] if e["id"] != a.id]
    else:
        if not (a.src and a.dst):
            raise SystemExit("give <src> <dst> or --id <edge-id>")
        src = resolve(doc, a.src)["id"]
        dst = resolve(doc, a.dst)["id"]
        keep = [e for e in doc["edges"] if not (
            {e["from"], e["to"]} == {src, dst} and (a.rel is None or e["rel"] == a.rel))]
    removed = len(doc["edges"]) - len(keep)
    if not removed:
        raise SystemExit("no matching link")
    doc["edges"] = keep
    save(doc)
    print(f"removed {removed} link(s)")


def cmd_merge(a):
    doc = load()
    src = resolve(doc, a.src)
    dst = resolve(doc, a.dst)
    if src["id"] == dst["id"]:
        raise SystemExit("src and dst are the same node")
    moved = 0
    for e in list(doc["edges"]):
        if src["id"] in (e["from"], e["to"]):
            other = e["to"] if e["from"] == src["id"] else e["from"]
            if other == dst["id"]:
                doc["edges"].remove(e); continue
            new_from = dst["id"] if e["from"] == src["id"] else e["from"]
            new_to = dst["id"] if e["to"] == src["id"] else e["to"]
            doc["edges"].remove(e)
            add_edge(doc, new_from, e["rel"], new_to, e.get("note", ""))
            moved += 1
    extra = "\n\n".join(x for x in (src.get("summary", ""), src.get("body", "")) if x)
    if extra:
        dst["body"] = (dst.get("body", "").rstrip() + f"\n\n---\nMerged from *{src['title']}*:\n{extra}").strip()
    for t in src.get("tags", []):
        if t not in dst.setdefault("tags", []):
            dst["tags"].append(t)
    for k in children_of(doc, src["id"]):
        k["parent"] = dst["id"]
    dst["updated"] = today()
    doc["nodes"] = [n for n in doc["nodes"] if n["id"] != src["id"]]
    save(doc)
    print(f"merged {src['id']} into {dst['id']} ({moved} link(s) moved)")


def cmd_tree(a):
    doc = load()
    idx = node_index(doc)
    start = resolve(doc, a.ref)["id"] if a.ref else None

    def walk(parent, depth):
        if a.depth is not None and depth > a.depth:
            return
        for n in children_of(doc, parent):
            kids = children_of(doc, n["id"])
            mark = f" ({len(kids)})" if kids else ""
            summ = f"  {n['summary'][:90]}" if a.long and n.get("summary") else ""
            print(f"{'  ' * depth}{n['title']}{mark}  [{n['id']}]{summ}")
            walk(n["id"], depth + 1)

    if start:
        print(f"{idx[start]['title']}  [{start}]")
        walk(start, 1)
    else:
        walk(None, 0)


def cmd_mv(a):
    doc = load()
    n = resolve(doc, a.ref)
    if a.parent.lower() in ("none", "root", "-"):
        n.pop("parent", None)
    else:
        p = resolve(doc, a.parent)
        if p["id"] == n["id"] or p["id"] in descendants_of(doc, n["id"]):
            raise SystemExit("that would create a cycle")
        n["parent"] = p["id"]
    if a.order is not None:
        n["order"] = a.order
    n["updated"] = today()
    save(doc)
    print(f"moved {n['id']} under {n.get('parent', 'root')}")


def cmd_types(a):
    doc = load()
    counts = {}
    for n in doc["nodes"]:
        counts[n["type"]] = counts.get(n["type"], 0) + 1
    table([[k, v.get("label", k), str(counts.get(k, 0))] for k, v in doc["types"].items()],
          ["key", "label", "nodes"])


def cmd_rels(a):
    doc = load()
    counts = {}
    for e in doc["edges"]:
        counts[e["rel"]] = counts.get(e["rel"], 0) + 1
    table([[k, v, str(counts.get(k, 0))] for k, v in doc["rels"].items()], ["key", "label", "links"])


def cmd_tags(a):
    doc = load()
    counts = {}
    for n in doc["nodes"]:
        for t in n.get("tags", []):
            counts[t] = counts.get(t, 0) + 1
    table([[t, str(c)] for t, c in sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))], ["tag", "nodes"])


def cmd_stats(a):
    doc = load()
    deg = degrees(doc)
    orphans = [n["id"] for n in doc["nodes"] if deg.get(n["id"], 0) == 0]
    top = sorted(doc["nodes"], key=lambda n: -deg.get(n["id"], 0))[:5]
    print(f"{len(doc['nodes'])} nodes · {len(doc['edges'])} links · {len(doc['types'])} types · updated {doc['meta'].get('updated')}")
    print("most connected: " + ", ".join(f"{n['title']} ({deg[n['id']]})" for n in top))
    print("orphans: " + (", ".join(orphans) if orphans else "none"))
    print("open questions: " + str(sum(1 for n in doc["nodes"] if n["type"] == "question")))


def cmd_validate(a):
    errors = validate(load())
    if errors:
        print("\n".join(errors)); raise SystemExit(1)
    print("ok")


def cmd_export(a):
    doc = load()
    if a.json:
        sys.stdout.write(dumps(doc))
    else:
        sys.stdout.write(to_markdown(doc))


def cmd_history(a):
    snaps = sorted(HISTORY.glob("brain-*.json")) if HISTORY.exists() else []
    if not snaps:
        print("no snapshots yet"); return
    for s in snaps:
        print(f"{s.name}  {s.stat().st_size:>7} bytes")


def cmd_restore(a):
    path = Path(a.name) if os.path.sep in a.name else HISTORY / a.name
    if not path.exists():
        raise SystemExit(f"no snapshot {a.name}")
    doc = json.loads(path.read_text(encoding="utf-8"))
    save(doc)
    print(f"restored {path.name}")


DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def clean_conf(v) -> str:
    if isinstance(v, str) and v.lower() in CONFIDENCE:
        return v.lower()
    if isinstance(v, (int, float)):
        return "high" if v >= 0.85 else "medium" if v >= 0.5 else "low"
    return "medium"


def merge_doc(doc: dict, inc: dict, update: bool = False, source: str | None = None, append: bool = False) -> dict:
    """Merge a proposal ({nodes, edges}) into doc in place. Returns counts.

    append=True is the safe mode for machine extractions: existing nodes never lose or change
    a field; new information is appended to their body as dated lines, new tags are added,
    the root identity node is protected, and links touching the root are dropped."""
    if isinstance(inc, dict) and "doc" in inc:
        inc = inc["doc"]
    if not isinstance(inc, dict) or not isinstance(inc.get("nodes"), list):
        raise ValueError("expected a JSON object with a 'nodes' list (and optionally 'edges', 'types', 'rels')")
    a = argparse.Namespace(update=update and not append, source=source)
    roots = [n["id"] for n in doc["nodes"] if not n.get("parent")]
    root_id = roots[0] if len(roots) == 1 else None
    for k, v in (inc.get("types") or {}).items():
        doc["types"].setdefault(k, v if isinstance(v, dict) else {"label": str(v), "color": "#8a8fa8"})
    for k, v in (inc.get("rels") or {}).items():
        doc["rels"].setdefault(k, str(v))
    idx = node_index(doc)
    existing_ids = set(idx)
    alias: dict[str, str] = {}
    added = updated = skipped = 0
    for n in inc["nodes"]:
        if not isinstance(n, dict) or not str(n.get("title", "")).strip():
            skipped += 1; continue
        nid = str(n.get("id") or slugify(n["title"]))
        ntype = n.get("type") or "belief"
        if ntype not in doc["types"]:
            doc["types"][ntype] = {"label": ntype.capitalize(), "color": "#8a8fa8"}
        # match an existing node by id, then by exact title
        existing = idx.get(nid) or next((x for x in doc["nodes"] if x["title"].lower() == n["title"].strip().lower()), None)
        if existing:
            alias[str(n.get("id") or "")] = existing["id"]; alias[n["title"]] = existing["id"]
            if append:
                if existing["id"] == root_id:
                    skipped += 1; continue
                have = (existing.get("summary", "") + "\n" + existing.get("body", "")).lower()
                new_bits = []
                for field in ("summary", "body"):
                    txt = str(n.get(field) or "").strip()
                    for line in txt.split("\n"):
                        line = line.strip().lstrip("-• ").strip()
                        if len(line) > 12 and line.lower() not in have and line.lower()[:60] not in have:
                            new_bits.append(line)
                for t in n.get("tags") or []:
                    if isinstance(t, str) and t not in existing.setdefault("tags", []):
                        existing["tags"].append(t)
                if new_bits:
                    stamp = f" ({source})" if source else ""
                    existing["body"] = (existing.get("body", "").rstrip() + "\n" + "\n".join(f"- {b}{stamp}" for b in new_bits)).strip()
                    existing["updated"] = today(); updated += 1
                else:
                    skipped += 1
                continue
            if a.update:
                for f in ("type", "title", "summary", "body", "tags", "confidence", "source"):
                    if f in n and n[f] not in (None, ""):
                        existing[f] = n[f]
                if n.get("pinned"): existing["pinned"] = True
                existing["updated"] = today(); updated += 1
            else:
                skipped += 1
            continue
        nid = unique_id(doc, nid)
        alias[str(n.get("id") or "")] = nid; alias[n["title"]] = nid
        created = str(n.get("created") or "")
        node = {
            "id": nid, "type": ntype, "title": n["title"].strip(), "summary": str(n.get("summary") or "").strip(),
            "body": str(n.get("body") or "").strip(), "tags": [str(t) for t in (n.get("tags") or []) if isinstance(t, str)],
            "confidence": clean_conf(n.get("confidence")),
            "source": str(n.get("source") or a.source or f"import {today()}"),
            "created": created if DATE_RE.match(created) else today(), "updated": today(),
        }
        if n.get("pinned"): node["pinned"] = True
        if isinstance(n.get("order"), (int, float)): node["order"] = n["order"]
        if n.get("parent"): node["_parent_ref"] = str(n["parent"])
        doc["nodes"].append(node); idx[nid] = node; added += 1
    by_title = {x["title"].lower(): x["id"] for x in doc["nodes"]}

    def endpoint(ref) -> str | None:
        ref = str(ref or "")
        return alias.get(ref) or (ref if ref in idx else None) or by_title.get(ref.lower())

    for x in doc["nodes"]:
        ref = x.pop("_parent_ref", None)
        if ref:
            target = endpoint(ref)
            if target and target != x["id"] and target not in ancestors_of(doc, x["id"]) and x["id"] not in ancestors_of(doc, target):
                x["parent"] = target
        if append and x["id"] not in existing_ids and (not x.get("parent") or x.get("parent") == root_id):
            x["parent"] = ensure_inbox(doc)["id"]
    links = 0
    for e in inc.get("edges") or []:
        if not isinstance(e, dict): continue
        src, dst = endpoint(e.get("from")), endpoint(e.get("to"))
        if not src or not dst or src == dst: continue
        if append and (src == root_id or dst == root_id or str(e.get("rel") or "") not in doc["rels"]): continue
        before = len(doc["edges"])
        add_edge(doc, src, str(e.get("rel") or "relates_to"), dst, str(e.get("note") or ""))
        links += len(doc["edges"]) - before
    return {"added": added, "updated": updated, "skipped": skipped, "links": links}


def cmd_import(a):
    """Merge nodes and edges from another JSON file. Ids that already exist are skipped unless --update."""
    doc = load()
    inc = json.loads(Path(a.file).read_text(encoding="utf-8"))
    try:
        r = merge_doc(doc, inc, update=a.update, source=a.source)
    except ValueError as exc:
        raise SystemExit(str(exc))
    save(doc)
    print(f"added {r['added']} node(s), updated {r['updated']}, skipped {r['skipped']}, added {r['links']} link(s)")


# ----------------------------------------------------------------- agents: context pack

def node_path(doc: dict, nid: str) -> str:
    idx = node_index(doc)
    return " › ".join(idx[a]["title"] for a in reversed(ancestors_of(doc, nid)))


def node_md(doc: dict, n: dict, links: bool = True, body: bool = True) -> str:
    idx = node_index(doc)
    path = node_path(doc, n["id"])
    out = [f"### {n['title']}  `{n['id']}`" + (f"  ({path})" if path else "")]
    if n.get("summary"):
        out.append(n["summary"])
    if body and n.get("body"):
        out.append(n["body"])
    kids = children_of(doc, n["id"])
    if kids:
        out.append("contains: " + "; ".join(f"{k['title']} `{k['id']}`" for k in kids))
    if links:
        ls = []
        for e in edges_of(doc, n["id"]):
            if e["from"] == n["id"]:
                ls.append(f"→ {rel_label(doc, e['rel'])} {idx.get(e['to'], {}).get('title', e['to'])} `{e['to']}`" + (f" ({e['note']})" if e.get("note") else ""))
            else:
                ls.append(f"← {idx.get(e['from'], {}).get('title', e['from'])} `{e['from']}` {rel_label(doc, e['rel'])}" + (f" ({e['note']})" if e.get("note") else ""))
        if ls:
            out.append("links: " + "; ".join(ls))
    bits = []
    if n.get("confidence") and n["confidence"] != "high":
        bits.append(f"confidence {n['confidence']}")
    if n.get("updated"):
        bits.append(f"updated {n['updated']}")
    if bits:
        out.append("_" + " · ".join(bits) + "_")
    return "\n".join(out)


def context_pack(doc: dict, topic: str | None = None, budget: int = 2500) -> str:
    """Compact markdown for an agent: who I am, the map one level deep, pinned nodes, and matches for a topic."""
    limit = budget * 4
    roots = children_of(doc, None)
    root = roots[0] if len(roots) == 1 else None
    out = [f"# {doc['meta'].get('name', 'Second brain')} · {doc['meta'].get('owner', '')} · updated {doc['meta'].get('updated', '?')}"]
    if root:
        out.append(root["summary"])
        if root.get("body"):
            out.append(root["body"])
    out.append("\n## Map")
    for g in children_of(doc, root["id"] if root else None):
        out.append(f"- **{g['title']}** `{g['id']}`: {g['summary'][:160]}")
        for k in children_of(doc, g["id"]):
            mark = f" (+{len(children_of(doc, k['id']))})" if children_of(doc, k["id"]) else ""
            out.append(f"  - {k['title']} `{k['id']}`{mark}: {k['summary'][:120]}")
    pinned = [n for n in doc["nodes"] if n.get("pinned") and n is not root]
    if pinned:
        out.append("\n## Pinned")
        for n in pinned:
            out.append(f"- {n['title']} `{n['id']}`: {n['summary'][:200]}")
    if topic:
        hits = find(doc, topic)
        words = [t[1].lower() for t in parse_query(topic) if t[0] == "text" and not t[2]]
        if words:
            hits.sort(key=lambda n: min((0 if n["title"].lower().startswith(w) else 1 if w in n["title"].lower() else 2 if w in " ".join(n.get("tags", [])).lower() else 3) for w in words))
        out.append(f"\n## On: {topic}")
        if not hits:
            out.append("(nothing matches; try broader words or a group id with in:)")
        for n in hits[:12]:
            block = node_md(doc, n)
            if sum(len(x) for x in out) + len(block) > limit:
                out.append(f"(+{len(hits) - hits.index(n)} more; narrow the topic)")
                break
            out.append(block)
    text = "\n".join(out)
    return text[:limit] + ("\n…(truncated; raise budget)" if len(text) > limit else "")


def cmd_context(a):
    print(context_pack(load(), " ".join(a.topic) if a.topic else None, a.budget))


# ----------------------------------------------------------------- inbox: notes, ingest, sort, watch

def ensure_inbox(doc: dict) -> dict:
    idx = node_index(doc)
    if INBOX_ID in idx:
        return idx[INBOX_ID]
    roots = children_of(doc, None)
    doc["types"].setdefault("note", {"label": "Notes", "color": "#9a9ea6"})
    node = {"id": INBOX_ID, "type": "note", "title": "Inbox", "summary": "Quick notes and unsorted captures. Sorted into groups by `brain.py sort`.",
            "body": "", "tags": ["inbox"], "confidence": "high", "source": "system", "created": today(), "updated": today(), "order": 99}
    if len(roots) == 1:
        node["parent"] = roots[0]["id"]
    doc["nodes"].append(node)
    return node


def add_note(doc: dict, text: str, source: str = "") -> dict:
    inbox = ensure_inbox(doc)
    doc["types"].setdefault("note", {"label": "Notes", "color": "#9a9ea6"})
    text = text.strip()
    title = text.split("\n", 1)[0][:80].rstrip(" .")
    node = {"id": unique_id(doc, slugify(title) or "note"), "type": "note", "title": title, "summary": text, "body": "",
            "tags": ["inbox"], "confidence": "high", "source": source or f"note {today()}", "created": today(), "updated": today(),
            "parent": inbox["id"]}
    doc["nodes"].append(node)
    return node


def cmd_log(a):
    doc = load()
    text = " ".join(a.text).strip() or sys.stdin.read().strip()
    if not text:
        raise SystemExit("nothing to log")
    n = add_note(doc, text)
    save(doc)
    print(n["id"])


def read_text_any(path: Path) -> str:
    """Plain text from txt/md/vtt/srt, or the user side of a Claude Code .jsonl transcript."""
    suf = path.suffix.lower()
    raw = path.read_text(encoding="utf-8", errors="replace")
    if suf == ".jsonl":
        lines = []
        for line in raw.splitlines():
            try:
                j = json.loads(line)
            except ValueError:
                continue
            if j.get("type") != "user":
                continue
            c = (j.get("message") or {}).get("content")
            texts = [c] if isinstance(c, str) else [b.get("text", "") for b in (c or []) if isinstance(b, dict) and b.get("type") == "text"]
            t = "\n".join(x for x in texts if x).strip()
            if t and not t.startswith("<"):
                lines.append(f"[{str(j.get('timestamp', ''))[:10]}] {t}")
        return "\n".join(lines)
    if suf in (".vtt", ".srt"):
        keep = []
        for line in raw.splitlines():
            if re.match(r"^\s*\d+\s*$", line) or "-->" in line or line.strip().upper() == "WEBVTT":
                continue
            keep.append(line)
        return "\n".join(keep)
    if suf == ".json":
        try:
            return json.dumps(json.loads(raw), ensure_ascii=False, indent=1)
        except ValueError:
            return raw
    return raw


def chunk_text(text: str, max_chars: int = 36000) -> list[str]:
    if len(text) <= max_chars:
        return [text]
    chunks, cur = [], []
    size = 0
    for para in text.split("\n"):
        if size + len(para) > max_chars and cur:
            chunks.append("\n".join(cur)); cur, size = [], 0
        cur.append(para); size += len(para) + 1
    if cur:
        chunks.append("\n".join(cur))
    return chunks


EXTRACT_RULES = """You extract facts about ME (the owner of this knowledge graph) from a text and return JSON for import.

INCLUDE: facts about me and my life: who I am, what I want, believe, decided, wonder about; things that happened; people I work with or know; places and organizations I am part of; skills; tools; projects. Only what the text supports.
LEAVE OUT: anything about an AI assistant or how it should behave, formatting or tone preferences, tooling trivia, generic advice, anything not about me. Nothing trivial.
VOICE: write summaries and bodies as my own terse notes, first person where a pronoun is needed. Never "the user" or "you". Never "not X but Y". No em dashes. Confidence goes in the field, never in the prose.
PLACEMENT: every node gets a "parent": an existing group id from the outline below, or the id of another node in your output. Nest parts inside the thing they are part of. Reuse existing node ids instead of creating near-duplicates; to add to an existing node, output it with the same id and put ONLY the new information in body (existing text is never overwritten; new lines get appended). Cross-links go in "edges" using the relations listed. Containment is never an edge.
SHAPE: return only one JSON object: {"nodes":[{"id","type","title","summary","body","tags","confidence","source","created","parent","order"}],"edges":[{"from","rel","to","note"}]}
TYPES: identity, goal, project, belief, decision, question, event, person, environment, skill, tool.
RELATIONS: leads_to, supports, informs, tension_with, constrains, about, asks_about, said, runs, uses, preceded, relates_to, works_with, located_in, met_at, made_at, teaches.
Dates YYYY-MM-DD. Prefer fewer, denser nodes. If the text holds nothing about me, return {"nodes":[],"edges":[]}."""


def outline_text(doc: dict, depth: int = 2) -> str:
    lines = []

    def walk(parent, d):
        if d > depth:
            return
        for n in children_of(doc, parent):
            lines.append(f"{'  ' * d}{n['title']} [{n['id']}]" + (f" ({n['type']})" if d else ""))
            walk(n["id"], d + 1)
    walk(None, 0)
    return "\n".join(lines)


def build_extract_prompt(doc: dict, text: str, source: str) -> str:
    ids = ", ".join(n["id"] for n in doc["nodes"])
    return (EXTRACT_RULES + "\n\nEXISTING OUTLINE (group ids in brackets):\n" + outline_text(doc)
            + "\n\nEXISTING NODE IDS: " + ids
            + f"\n\nSOURCE LABEL for the source field: {source}"
            + "\n\nTEXT:\n\"\"\"\n" + text + "\n\"\"\"\n\nReturn the JSON object now.")


def claude_exe() -> str | None:
    for cand in (shutil.which("claude"), os.path.expanduser("~/.local/bin/claude.exe"), os.path.expanduser("~/.local/bin/claude")):
        if cand and Path(cand).exists():
            return cand
    return None


def run_claude(prompt: str, model: str | None) -> str:
    exe = claude_exe()
    if not exe:
        raise RuntimeError("claude CLI not found; install Claude Code or use --local")
    env = {k: v for k, v in os.environ.items() if k not in ("CLAUDECODE", "CLAUDE_CODE_ENTRYPOINT")}
    cmd = [exe, "-p", "--output-format", "json"]
    if model:
        cmd += ["--model", model]
    r = subprocess.run(cmd, input=prompt, capture_output=True, text=True, encoding="utf-8", env=env, timeout=600)
    out = r.stdout.strip()
    try:
        j = json.loads(out)
    except ValueError:
        raise RuntimeError(f"claude returned no JSON: {(out or r.stderr)[:300]}")
    if j.get("is_error"):
        raise RuntimeError(f"claude error: {j.get('result', '')[:300]}  (run `claude login` once if the session expired)")
    return j.get("result", "")


def run_ollama(prompt: str, model: str) -> str:
    body = json.dumps({"model": model, "prompt": prompt, "stream": False, "format": "json", "options": {"temperature": 0.1, "num_ctx": 32768}}).encode("utf-8")
    req = urllib.request.Request("http://127.0.0.1:11434/api/generate", data=body, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=900) as resp:
            return json.loads(resp.read().decode("utf-8")).get("response", "")
    except Exception as exc:  # noqa: BLE001
        raise RuntimeError(f"ollama failed ({exc}); is it running and is '{model}' pulled?")


def parse_proposal(text: str) -> dict:
    text = text.strip()
    m = re.search(r"\{.*\}", text, re.S)
    if not m:
        raise RuntimeError("no JSON object in the model output")
    prop = json.loads(m.group(0))
    prop.setdefault("nodes", []); prop.setdefault("edges", [])
    return prop


def extract(doc: dict, text: str, source: str, engine: str = "claude", model: str | None = None) -> dict:
    prompt = build_extract_prompt(doc, text, source)
    raw = run_ollama(prompt, model or "qwen3.5:9b") if engine == "ollama" else run_claude(prompt, model)
    return parse_proposal(raw)


def ingest_path(doc: dict, path: Path, engine: str, model: str | None, dry: bool = False, log=print) -> dict:
    emit_event("ingest_start", [], source=f"ingest:{path.name}", dry_run=dry)
    before = {n["id"]: dict(n) for n in doc["nodes"]}
    text = read_text_any(path).strip()
    if not text:
        log(f"skip {path.name}: empty"); return {"added": 0, "updated": 0, "skipped": 0, "links": 0}
    source = f"{path.name} ({today()})"
    total = {"added": 0, "updated": 0, "skipped": 0, "links": 0}
    chunks = chunk_text(text)
    for i, chunk in enumerate(chunks, 1):
        log(f"{path.name}: extracting part {i}/{len(chunks)} with {engine}{' ' + model if model else ''}…")
        prop = extract(doc, chunk, source, engine, model)
        if dry:
            log(json.dumps(prop, ensure_ascii=False, indent=2)); continue
        r = merge_doc(doc, prop, source=source, append=True)
        for k in total:
            total[k] += r[k]
        log(f"  part {i}: +{r['added']} nodes, {r['updated']} updated, +{r['links']} links")
    if not dry:
        ids = [n["id"] for n in doc["nodes"] if before.get(n["id"]) != n]
        _pending_events.items = getattr(_pending_events, "items", []) + [
            {"kind": "ingest_done", "ids": ids, "source": f"ingest:{path.name}"}]
    return total


def cmd_ingest(a):
    paths = []
    for raw in a.paths:
        pth = Path(raw)
        if pth.is_dir():
            paths += sorted(x for x in pth.iterdir() if x.is_file() and not x.name.startswith("."))
        elif pth.exists():
            paths.append(pth)
        else:
            raise SystemExit(f"no such file: {raw}")
    if not paths:
        raise SystemExit("nothing to ingest")
    doc = load()
    engine = "ollama" if a.local else "claude"
    model = a.model or (a.local if isinstance(a.local, str) and a.local != "yes" else None)
    grand = {"added": 0, "updated": 0, "skipped": 0, "links": 0}
    for pth in paths:
        try:
            r = ingest_path(doc, pth, engine, model, dry=a.dry_run)
        except RuntimeError as exc:
            raise SystemExit(str(exc))
        for k in grand:
            grand[k] += r[k]
        if a.move and not a.dry_run:
            DONE.mkdir(parents=True, exist_ok=True)
            shutil.move(str(pth), str(DONE / pth.name))
    if not a.dry_run:
        save(doc)
        print(f"done: +{grand['added']} nodes, {grand['updated']} updated, +{grand['links']} links")


def cmd_sort(a):
    """Turn Inbox notes into proper nodes in the right groups."""
    doc = load()
    notes = [n for n in doc["nodes"] if n.get("parent") == INBOX_ID and n["id"] != INBOX_ID]
    if not notes:
        print("inbox is empty"); return
    text = "Quick notes I wrote, newest last:\n" + "\n".join(f"- [{n.get('created', '')}] {n['summary']}" for n in notes)
    engine = "ollama" if a.local else "claude"
    model = a.model or (a.local if isinstance(a.local, str) and a.local != "yes" else None)
    try:
        prop = extract(doc, text, f"inbox notes ({today()})", engine, model)
    except RuntimeError as exc:
        raise SystemExit(str(exc))
    if a.dry_run:
        print(json.dumps(prop, ensure_ascii=False, indent=2)); return
    before = {n["id"]: dict(n) for n in doc["nodes"]}
    r = merge_doc(doc, prop, append=True)
    if r["added"] or r["updated"]:
        keep = {n["id"] for n in notes} if a.keep else set()
        doc["nodes"] = [n for n in doc["nodes"] if n["id"] not in {x["id"] for x in notes} or n["id"] in keep]
    save(doc)
    emit_event("sort", [n["id"] for n in doc["nodes"] if before.get(n["id"]) != n], source="sort")
    print(f"sorted {len(notes)} note(s): +{r['added']} nodes, {r['updated']} updated, +{r['links']} links")


def watch_inbox(interval: float, engine: str, model: str | None, log=print, stop=None) -> None:
    INBOX.mkdir(exist_ok=True); DONE.mkdir(exist_ok=True)
    seen: dict[str, float] = {}
    while stop is None or not stop.is_set():
        for pth in sorted(x for x in INBOX.iterdir() if x.is_file() and not x.name.startswith(".")):
            try:
                mtime = pth.stat().st_mtime
            except OSError:
                continue
            if time.time() - mtime < 3:      # still being written
                continue
            if seen.get(pth.name) == mtime:
                continue
            seen[pth.name] = mtime
            emit_event("note", [INBOX_ID], source=f"watcher:{pth.name}")
            token = _event_source.set(f"watcher:{pth.name}")
            try:
                doc = load()
                r = ingest_path(doc, pth, engine, model, log=log)
                save(doc)
                shutil.move(str(pth), str(DONE / pth.name))
                log(f"ingested {pth.name}: +{r['added']} nodes, {r['updated']} updated, +{r['links']} links")
            except Exception as exc:  # noqa: BLE001
                _pending_events.items = []
                log(f"ingest failed for {pth.name}: {exc}")
            finally:
                _event_source.reset(token)
        if stop is None:
            time.sleep(interval)
        elif stop.wait(interval):
            break


def cmd_watch(a):
    engine = "ollama" if a.local else "claude"
    model = a.model or (a.local if isinstance(a.local, str) and a.local != "yes" else None)
    print(f"watching {INBOX} every {a.interval:.0f}s with {engine} (Ctrl+C to stop)")
    try:
        watch_inbox(a.interval, engine, model)
    except KeyboardInterrupt:
        print("\nstopped")


# ----------------------------------------------------------------- agents: MCP server (stdio)

MCP_TOOLS = [
    {"name": "brain_context", "description": "Compact overview of Mark for an agent: who he is, the map of groups, pinned nodes, and the nodes matching a topic with their paths and cross-links. Call this first.",
     "inputSchema": {"type": "object", "properties": {"topic": {"type": "string", "description": "Optional. Free words or query syntax (type:goal, in:oceanaid, #tag)."}, "budget": {"type": "integer", "description": "Approximate token budget, default 2500."}}}},
    {"name": "brain_search", "description": "Search nodes. Query syntax: free words, type:goal, #tag, in:<group-id>, is:pinned|group|recent, since:YYYY-MM-DD, link:<id>, -negate.",
     "inputSchema": {"type": "object", "properties": {"query": {"type": "string"}, "limit": {"type": "integer", "description": "Default 20."}}, "required": ["query"]}},
    {"name": "brain_get", "description": "Full node by id or title: summary, details, path, what it contains, cross-links.",
     "inputSchema": {"type": "object", "properties": {"id": {"type": "string"}}, "required": ["id"]}},
    {"name": "brain_tree", "description": "The outline (hierarchy) from a node down, or the whole tree.",
     "inputSchema": {"type": "object", "properties": {"id": {"type": "string"}, "depth": {"type": "integer", "description": "Default 2."}}}},
    {"name": "brain_add", "description": "Add a node about Mark. Write summary/body as his own terse notes. Always give a parent group id. Optional links: [{rel, to, incoming?}].",
     "inputSchema": {"type": "object", "properties": {"type": {"type": "string"}, "title": {"type": "string"}, "summary": {"type": "string"}, "body": {"type": "string"}, "parent": {"type": "string"}, "tags": {"type": "array", "items": {"type": "string"}}, "confidence": {"type": "string", "enum": ["high", "medium", "low"]}, "source": {"type": "string"}, "links": {"type": "array", "items": {"type": "object", "properties": {"rel": {"type": "string"}, "to": {"type": "string"}, "incoming": {"type": "boolean"}}, "required": ["rel", "to"]}}}, "required": ["type", "title", "summary"]}},
    {"name": "brain_update", "description": "Change fields on an existing node (title, summary, body, tags, confidence, source, parent, order, type, pinned).",
     "inputSchema": {"type": "object", "properties": {"id": {"type": "string"}, "fields": {"type": "object"}}, "required": ["id", "fields"]}},
    {"name": "brain_link", "description": "Connect two nodes: from --rel--> to. Relations: leads_to, supports, informs, tension_with, constrains, about, asks_about, said, runs, uses, preceded, relates_to, works_with, located_in, met_at, made_at, teaches.",
     "inputSchema": {"type": "object", "properties": {"from": {"type": "string"}, "rel": {"type": "string"}, "to": {"type": "string"}, "note": {"type": "string"}}, "required": ["from", "rel", "to"]}},
    {"name": "brain_note", "description": "Drop a quick note into the Inbox to be sorted later.",
     "inputSchema": {"type": "object", "properties": {"text": {"type": "string"}}, "required": ["text"]}},
    {"name": "brain_ingest", "description": "Extract facts about Mark from a text file or transcript on disk and merge them into the brain (slow; uses the configured model).",
     "inputSchema": {"type": "object", "properties": {"path": {"type": "string"}, "local": {"type": "boolean", "description": "Use the local Ollama model instead of claude."}}, "required": ["path"]}},
]


def mcp_call(name: str, args: dict) -> str:
    token = _event_source.set(f"mcp:{name}")
    try:
        result = _mcp_call(name, args)
        if name in ("brain_context", "brain_search", "brain_get", "brain_tree"):
            doc = load(audit=False)
            mentioned = set(re.findall(r"`([^`\n]+)`", result))
            ids = [n["id"] for n in doc["nodes"] if n["id"] in mentioned]
            if name == "brain_context":
                roots = children_of(doc, None)
                if len(roots) == 1:
                    ids.insert(0, roots[0]["id"])
            emit_event("mcp_read", ids)
        return result
    except Exception:
        _pending_events.items = []
        raise
    finally:
        _event_source.reset(token)


def _mcp_call(name: str, args: dict) -> str:
    doc = load(audit=False)
    if name == "brain_context":
        return context_pack(doc, args.get("topic") or None, int(args.get("budget") or 2500))
    if name == "brain_search":
        hits = find(doc, args["query"])[: int(args.get("limit") or 20)]
        if not hits:
            return "no matches"
        return "\n".join(f"- {n['title']} `{n['id']}` ({n['type']}; {node_path(doc, n['id'])}): {n['summary'][:160]}" for n in hits)
    if name == "brain_get":
        try:
            n = resolve(doc, args["id"])
        except SystemExit as exc:
            return str(exc)
        return node_md(doc, n)
    if name == "brain_tree":
        start = resolve(doc, args["id"])["id"] if args.get("id") else None
        depth = int(args.get("depth") or 2)
        lines = []

        def walk(parent, d):
            if d > depth:
                return
            for n in children_of(doc, parent):
                lines.append(f"{'  ' * d}- {n['title']} `{n['id']}`: {n['summary'][:110]}")
                walk(n["id"], d + 1)
        if start:
            n0 = node_index(doc)[start]; lines.append(f"{n0['title']} `{start}`: {n0['summary'][:140]}")
        walk(start, 1 if start else 0)
        return "\n".join(lines) or "(empty)"
    if name == "brain_add":
        if args["type"] not in doc["types"]:
            return f"unknown type; use one of {', '.join(doc['types'])}"
        nid = unique_id(doc, slugify(args["title"]))
        node = {"id": nid, "type": args["type"], "title": args["title"].strip(), "summary": str(args.get("summary") or "").strip(),
                "body": str(args.get("body") or "").strip(), "tags": [str(t) for t in (args.get("tags") or [])],
                "confidence": args.get("confidence") if args.get("confidence") in CONFIDENCE else "medium",
                "source": str(args.get("source") or f"agent {today()}"), "created": today(), "updated": today()}
        if args.get("parent"):
            try:
                node["parent"] = resolve(doc, args["parent"])["id"]
            except SystemExit as exc:
                return str(exc)
        doc["nodes"].append(node)
        for l in args.get("links") or []:
            try:
                other = resolve(doc, l["to"])["id"]
            except SystemExit as exc:
                return str(exc)
            src, dst = (other, nid) if l.get("incoming") else (nid, other)
            add_edge(doc, src, l["rel"], dst, str(l.get("note") or ""))
        save(doc)
        return f"added {nid}" + (f" inside {node['parent']}" if node.get("parent") else " at top level (give it a parent)")
    if name == "brain_update":
        try:
            n = resolve(doc, args["id"])
        except SystemExit as exc:
            return str(exc)
        fields = args.get("fields") or {}
        for k, v in fields.items():
            if k == "parent":
                if v in (None, "", "root"):
                    n.pop("parent", None)
                else:
                    pid = resolve(doc, v)["id"]
                    if pid == n["id"] or pid in descendants_of(doc, n["id"]):
                        return "that parent would create a cycle"
                    n["parent"] = pid
            elif k == "pinned":
                if v:
                    n["pinned"] = True
                else:
                    n.pop("pinned", None)
            elif k in ("title", "summary", "body", "source", "type", "confidence", "order", "tags"):
                n[k] = v
        n["updated"] = today()
        save(doc)
        return f"updated {n['id']}"
    if name == "brain_link":
        try:
            src = resolve(doc, args["from"])["id"]; dst = resolve(doc, args["to"])["id"]
        except SystemExit as exc:
            return str(exc)
        e = add_edge(doc, src, args["rel"], dst, str(args.get("note") or ""))
        save(doc)
        return f"linked {e['id']}"
    if name == "brain_note":
        n = add_note(doc, args["text"], source=f"agent note {today()}")
        save(doc)
        return f"noted as {n['id']} in Inbox"
    if name == "brain_ingest":
        pth = Path(args["path"])
        if not pth.exists():
            return f"no such file: {pth}"
        engine = "ollama" if args.get("local") else "claude"
        msgs = []
        r = ingest_path(doc, pth, engine, None, log=msgs.append)
        save(doc)
        return "\n".join(msgs) + f"\ndone: +{r['added']} nodes, {r['updated']} updated, +{r['links']} links"
    raise KeyError(name)


def cmd_mcp(a):
    """Model Context Protocol server over stdio, for Claude Code / Ares / any MCP client."""
    sys.stdin.reconfigure(encoding="utf-8")
    sys.stdout.reconfigure(encoding="utf-8", newline="\n")

    def send(obj):
        sys.stdout.write(json.dumps(obj, ensure_ascii=False) + "\n"); sys.stdout.flush()

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            msg = json.loads(line)
        except ValueError:
            continue
        mid, method, params = msg.get("id"), msg.get("method"), msg.get("params") or {}
        if method == "initialize":
            send({"jsonrpc": "2.0", "id": mid, "result": {"protocolVersion": params.get("protocolVersion") or "2025-06-18",
                  "capabilities": {"tools": {}}, "serverInfo": {"name": "brain", "version": "1"}}})
        elif method == "tools/list":
            send({"jsonrpc": "2.0", "id": mid, "result": {"tools": MCP_TOOLS}})
        elif method == "tools/call":
            name = params.get("name"); args = params.get("arguments") or {}
            try:
                text = mcp_call(name, args); err = False
            except KeyError:
                text, err = f"unknown tool {name}", True
            except Exception as exc:  # noqa: BLE001
                text, err = f"error: {exc}", True
            send({"jsonrpc": "2.0", "id": mid, "result": {"content": [{"type": "text", "text": text}], "isError": err}})
        elif method == "ping":
            send({"jsonrpc": "2.0", "id": mid, "result": {}})
        elif mid is not None:
            send({"jsonrpc": "2.0", "id": mid, "error": {"code": -32601, "message": f"unknown method {method}"}})


# ----------------------------------------------------------------- server

class Handler(BaseHTTPRequestHandler):
    server_version = "brain/1"

    def log_message(self, fmt, *args):  # keep the terminal quiet
        if self.command != "GET":
            sys.stderr.write(f"{self.command} {self.path} {args[1] if len(args) > 1 else ''}\n")

    def _send(self, code: int, body: bytes, ctype: str) -> None:
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _json(self, code: int, obj) -> None:
        self._send(code, json.dumps(obj, ensure_ascii=False).encode("utf-8"), "application/json; charset=utf-8")

    def do_GET(self):
        path = urlparse(self.path).path
        if path in ("/", "/index.html"):
            if not INDEX.exists():
                self._send(404, b"index.html is missing", "text/plain"); return
            self._send(200, INDEX.read_bytes(), "text/html; charset=utf-8")
        elif path == "/api/events":
            self._events()
        elif path == "/town" or path.startswith("/town/"):
            relative = unquote(path.removeprefix("/town")).lstrip("/") or "index.html"
            target = (TOWN / relative).resolve()
            if not target.is_relative_to(TOWN.resolve()):
                self._send(403, b"forbidden", "text/plain"); return
            if not target.is_file():
                self._send(404, b"Town is not built. Run npm install and npm run build in town/.", "text/plain"); return
            ctype = {".js": "text/javascript", ".glb": "model/gltf-binary"}.get(target.suffix) or mimetypes.guess_type(target.name)[0] or "application/octet-stream"
            self._send(200, target.read_bytes(), ctype)
        elif path == "/api/brain":
            raw = DATA.read_bytes() if DATA.exists() else dumps(load()).encode("utf-8")
            emit_event("mcp_read", [n["id"] for n in json.loads(raw)["nodes"]], source="http:brain")
            body = b'{"rev":"' + rev_of(raw).encode() + b'","doc":' + raw.strip() + b"}"
            self._send(200, body, "application/json; charset=utf-8")
        elif path == "/api/markdown":
            self._send(200, to_markdown(load()).encode("utf-8"), "text/markdown; charset=utf-8")
        else:
            self._send(404, b"not found", "text/plain")

    def _events(self):
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Connection", "keep-alive")
        self.end_headers()
        try:
            EVENTS.touch(exist_ok=True)
            with EVENTS.open("rb") as stream:
                end = stream.seek(0, 2)
                try:
                    offset = int(self.headers.get("Last-Event-ID", end))
                except ValueError:
                    offset = end
                stream.seek(offset if 0 <= offset <= end else end)
                self.wfile.write(b": connected\n\n"); self.wfile.flush()
                last_ping = time.monotonic()
                while not (getattr(self.server, "stop_event", None) and self.server.stop_event.is_set()):
                    pos = stream.tell()
                    line = stream.readline()
                    if line.endswith(b"\n"):
                        self.wfile.write(f"id: {stream.tell()}\ndata: ".encode() + line + b"\n")
                        self.wfile.flush()
                    else:
                        stream.seek(pos)
                        if time.monotonic() - last_ping >= 10:
                            self.wfile.write(b": heartbeat\n\n"); self.wfile.flush()
                            last_ping = time.monotonic()
                        time.sleep(0.15)
        except (OSError, ConnectionError):
            pass

    def do_PUT(self):
        with _lock:
            self._put_brain()

    def _put_brain(self):
        if urlparse(self.path).path != "/api/brain":
            self._send(404, b"not found", "text/plain"); return
        length = int(self.headers.get("Content-Length") or 0)
        try:
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
        except (ValueError, UnicodeDecodeError):
            self._json(400, {"errors": ["body is not valid JSON"]}); return
        doc = payload.get("doc") if isinstance(payload, dict) else None
        base = payload.get("baseRev") if isinstance(payload, dict) else None
        current_raw = DATA.read_bytes() if DATA.exists() else b""
        if base and current_raw and base != rev_of(current_raw):
            self._json(409, {"rev": rev_of(current_raw), "doc": json.loads(current_raw)}); return
        errors = validate(doc)
        if errors:
            self._json(400, {"errors": errors}); return
        try:
            token = _event_source.set("http:brain")
            try:
                rev = save(doc)
            finally:
                _event_source.reset(token)
        except OSError as exc:
            self._json(500, {"errors": [str(exc)]}); return
        self._json(200, {"rev": rev})

    do_POST = do_PUT


def cmd_serve(a):
    if not DATA.exists():
        save(load())
    server = ThreadingHTTPServer((a.host, a.port), Handler)
    url = f"http://{a.host}:{a.port}/"
    print(f"Second brain · {url}   (Ctrl+C to stop)")
    stop = threading.Event()
    server.stop_event = stop
    if not a.no_watch:
        engine = "ollama" if a.local else "claude"
        model = a.model or (a.local if isinstance(a.local, str) and a.local != "yes" else None)
        INBOX.mkdir(exist_ok=True)
        print(f"watching {INBOX} for transcripts and notes ({engine})")
        threading.Thread(target=watch_inbox, args=(20.0, engine, model, print, stop), daemon=True).start()
    if not a.no_open:
        threading.Timer(0.4, webbrowser.open, args=(url,)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nstopped")
    finally:
        stop.set()
        server.server_close()


# ----------------------------------------------------------------- argparse

def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="brain", description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)

    s = sub.add_parser("serve", help="run the local UI"); s.set_defaults(fn=cmd_serve)
    s.add_argument("--port", type=int, default=8765)
    s.add_argument("--host", default="127.0.0.1")
    s.add_argument("--no-open", action="store_true", help="don't open the browser")
    s.add_argument("--no-watch", action="store_true", help="don't auto-ingest files dropped in brain/inbox")
    s.add_argument("--local", nargs="?", const="yes", metavar="MODEL", help="extract with local Ollama (default qwen3.5:9b) instead of claude")
    s.add_argument("--model", help="model name for the extractor")

    s = sub.add_parser("context", help="compact context pack for an agent, optionally about a topic"); s.set_defaults(fn=cmd_context)
    s.add_argument("topic", nargs="*"); s.add_argument("--budget", type=int, default=2500, help="approximate tokens")

    s = sub.add_parser("log", help="drop a quick note into the Inbox"); s.set_defaults(fn=cmd_log)
    s.add_argument("text", nargs="*")

    s = sub.add_parser("ingest", help="extract facts from transcripts/notes and merge them"); s.set_defaults(fn=cmd_ingest)
    s.add_argument("paths", nargs="+", help="files or folders (.txt .md .vtt .srt .json .jsonl)")
    s.add_argument("--local", nargs="?", const="yes", metavar="MODEL", help="use local Ollama instead of claude")
    s.add_argument("--model"); s.add_argument("--dry-run", action="store_true", help="print the proposal, change nothing")
    s.add_argument("--move", action="store_true", help="move processed files to inbox/done")

    s = sub.add_parser("sort", help="file Inbox notes into the right groups"); s.set_defaults(fn=cmd_sort)
    s.add_argument("--local", nargs="?", const="yes", metavar="MODEL"); s.add_argument("--model")
    s.add_argument("--dry-run", action="store_true"); s.add_argument("--keep", action="store_true", help="keep the raw notes too")

    s = sub.add_parser("watch", help="auto-ingest anything dropped into brain/inbox"); s.set_defaults(fn=cmd_watch)
    s.add_argument("--interval", type=float, default=20)
    s.add_argument("--local", nargs="?", const="yes", metavar="MODEL"); s.add_argument("--model")

    sub.add_parser("mcp", help="run as an MCP server over stdio (for Claude Code and agents)").set_defaults(fn=cmd_mcp)

    s = sub.add_parser("find", help="search nodes (see query syntax)"); s.set_defaults(fn=cmd_find)
    s.add_argument("query", nargs="*")
    sub.add_parser("list", help="alias for find with no query").set_defaults(fn=cmd_find, query=[])

    s = sub.add_parser("show", help="print one node with its connections"); s.set_defaults(fn=cmd_show)
    s.add_argument("ref", help="node id or title")

    s = sub.add_parser("tree", help="print the hierarchy"); s.set_defaults(fn=cmd_tree)
    s.add_argument("ref", nargs="?", help="start at this node")
    s.add_argument("--depth", type=int)
    s.add_argument("--long", action="store_true", help="show summaries")

    s = sub.add_parser("mv", help="move a node under another: mv <node> <parent|root>"); s.set_defaults(fn=cmd_mv)
    s.add_argument("ref"); s.add_argument("parent"); s.add_argument("--order", type=int)

    s = sub.add_parser("add", help="add a node"); s.set_defaults(fn=cmd_add)
    s.add_argument("--type", required=True)
    s.add_argument("--parent", help="group this node belongs to")
    s.add_argument("--order", type=int, help="position among siblings")
    s.add_argument("--title", required=True)
    s.add_argument("--summary")
    s.add_argument("--body", help="text, or '-' to read stdin")
    s.add_argument("--tags", help="comma separated")
    s.add_argument("--conf", choices=CONFIDENCE)
    s.add_argument("--source")
    s.add_argument("--id", help="custom id (default: slug of the title)")
    s.add_argument("--pin", action="store_true")
    s.add_argument("--link", action="append", metavar="REL:NODE", help="outgoing link; prefix with < for incoming. Repeatable.")

    s = sub.add_parser("edit", help="change fields on a node"); s.set_defaults(fn=cmd_edit)
    s.add_argument("ref")
    for f in ("title", "summary", "body", "source", "type", "tags"):
        s.add_argument(f"--{f}")
    s.add_argument("--conf", choices=CONFIDENCE)
    s.add_argument("--parent", help="new group, or 'root'")
    s.add_argument("--order", type=int)
    s.add_argument("--add-tag", action="append")
    s.add_argument("--rm-tag", action="append")
    s.add_argument("--pin", action="store_true")
    s.add_argument("--unpin", action="store_true")

    s = sub.add_parser("rm", help="delete a node and its links"); s.set_defaults(fn=cmd_rm)
    s.add_argument("ref")

    s = sub.add_parser("link", help="connect two nodes: link <src> <rel> <dst>"); s.set_defaults(fn=cmd_link)
    s.add_argument("src"); s.add_argument("rel"); s.add_argument("dst")
    s.add_argument("--note")

    s = sub.add_parser("unlink", help="remove a link"); s.set_defaults(fn=cmd_unlink)
    s.add_argument("src", nargs="?"); s.add_argument("dst", nargs="?")
    s.add_argument("--rel"); s.add_argument("--id")

    s = sub.add_parser("merge", help="fold <src> into <dst>, moving its links"); s.set_defaults(fn=cmd_merge)
    s.add_argument("src"); s.add_argument("dst")

    sub.add_parser("types", help="list node types").set_defaults(fn=cmd_types)
    sub.add_parser("rels", help="list relation kinds").set_defaults(fn=cmd_rels)
    sub.add_parser("tags", help="list tags with counts").set_defaults(fn=cmd_tags)
    sub.add_parser("stats", help="quick overview").set_defaults(fn=cmd_stats)
    sub.add_parser("validate", help="check brain.json").set_defaults(fn=cmd_validate)

    s = sub.add_parser("export", help="dump as markdown (default) or JSON"); s.set_defaults(fn=cmd_export)
    s.add_argument("--json", action="store_true")

    s = sub.add_parser("import", help="merge nodes/edges from a JSON file (see EXTRACT_PROMPT.md)"); s.set_defaults(fn=cmd_import)
    s.add_argument("file")
    s.add_argument("--update", action="store_true", help="overwrite fields of nodes that already exist")
    s.add_argument("--source", help="source label for nodes that don't carry one")

    sub.add_parser("history", help="list snapshots").set_defaults(fn=cmd_history)
    s = sub.add_parser("restore", help="restore a snapshot by name"); s.set_defaults(fn=cmd_restore)
    s.add_argument("name")
    return p


def main(argv=None):
    if sys.platform == "win32":
        try:
            sys.stdout.reconfigure(encoding="utf-8")
        except Exception:
            pass
    args = build_parser().parse_args(argv)
    token = _event_source.set(f"cli:{args.cmd}")
    try:
        args.fn(args)
    finally:
        _event_source.reset(token)


if __name__ == "__main__":
    main()
