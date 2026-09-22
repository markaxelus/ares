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
import os
import re
import shlex
import sys
import threading
import webbrowser
from datetime import date, datetime, timedelta
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

HERE = Path(__file__).resolve().parent
DATA = HERE / "brain.json"
HISTORY = HERE / "history"
INDEX = HERE / "index.html"
MAX_SNAPSHOTS = 30
CONFIDENCE = ("high", "medium", "low")
QUERY_KEYS = {"type", "t", "tag", "conf", "is", "since", "rel", "link", "id", "in"}
_lock = threading.Lock()


# ----------------------------------------------------------------- storage

def today() -> str:
    return date.today().isoformat()


def dumps(doc: dict) -> str:
    return json.dumps(doc, indent=2, ensure_ascii=False) + "\n"


def rev_of(raw: bytes) -> str:
    return hashlib.sha1(raw).hexdigest()[:12]


def load() -> dict:
    if not DATA.exists():
        return {"meta": {"name": "Second brain", "version": 1, "updated": today()},
                "types": {}, "rels": {}, "nodes": [], "edges": []}
    with DATA.open("r", encoding="utf-8") as f:
        return json.load(f)


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
            return rev_of(raw)
        snapshot()
        tmp = DATA.with_suffix(".json.tmp")
        tmp.write_bytes(raw)
        os.replace(tmp, DATA)
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


def cmd_import(a):
    """Merge nodes and edges from another JSON file. Ids that already exist are skipped unless --update."""
    doc = load()
    inc = json.loads(Path(a.file).read_text(encoding="utf-8"))
    if isinstance(inc, dict) and "doc" in inc:
        inc = inc["doc"]
    if not isinstance(inc, dict) or not isinstance(inc.get("nodes"), list):
        raise SystemExit("expected a JSON object with a 'nodes' list (and optionally 'edges', 'types', 'rels')")
    for k, v in (inc.get("types") or {}).items():
        doc["types"].setdefault(k, v if isinstance(v, dict) else {"label": str(v), "color": "#8a8fa8"})
    for k, v in (inc.get("rels") or {}).items():
        doc["rels"].setdefault(k, str(v))
    idx = node_index(doc)
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
        node = {
            "id": nid, "type": ntype, "title": n["title"].strip(), "summary": str(n.get("summary") or "").strip(),
            "body": str(n.get("body") or "").strip(), "tags": [str(t) for t in (n.get("tags") or [])],
            "confidence": n.get("confidence") if n.get("confidence") in CONFIDENCE else "medium",
            "source": str(n.get("source") or a.source or f"import {today()}"),
            "created": str(n.get("created") or today()), "updated": today(),
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
            if target and target != x["id"]:
                x["parent"] = target
    links = 0
    for e in inc.get("edges") or []:
        if not isinstance(e, dict): continue
        src, dst = endpoint(e.get("from")), endpoint(e.get("to"))
        if not src or not dst or src == dst: continue
        before = len(doc["edges"])
        add_edge(doc, src, str(e.get("rel") or "relates_to"), dst, str(e.get("note") or ""))
        links += len(doc["edges"]) - before
    save(doc)
    print(f"added {added} node(s), updated {updated}, skipped {skipped}, added {links} link(s)")


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
        elif path == "/api/brain":
            raw = DATA.read_bytes() if DATA.exists() else dumps(load()).encode("utf-8")
            body = b'{"rev":"' + rev_of(raw).encode() + b'","doc":' + raw.strip() + b"}"
            self._send(200, body, "application/json; charset=utf-8")
        elif path == "/api/markdown":
            self._send(200, to_markdown(load()).encode("utf-8"), "text/markdown; charset=utf-8")
        else:
            self._send(404, b"not found", "text/plain")

    def do_PUT(self):
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
            rev = save(doc)
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
    if not a.no_open:
        threading.Timer(0.4, webbrowser.open, args=(url,)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nstopped")
    finally:
        server.server_close()


# ----------------------------------------------------------------- argparse

def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="brain", description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)

    s = sub.add_parser("serve", help="run the local UI"); s.set_defaults(fn=cmd_serve)
    s.add_argument("--port", type=int, default=8765)
    s.add_argument("--host", default="127.0.0.1")
    s.add_argument("--no-open", action="store_true", help="don't open the browser")

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
    args.fn(args)


if __name__ == "__main__":
    main()
