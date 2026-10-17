"""
Reliable alternative to fetch.ts: read every public-transport route from a
Geofabrik extract of the Philippines instead of the (often overloaded)
Overpass servers.

  curl -L -o philippines.osm.pbf https://download.geofabrik.de/asia/philippines-latest.osm.pbf
  python3 -m pip install osmium
  python3 scripts/osm-transit/fetch_pbf.py philippines.osm.pbf
  node scripts/osm-transit/build.ts

Writes scripts/osm-transit/.cache/pbf-*.json in the same shape as Overpass
output, so build.ts works with either source.
Data © OpenStreetMap contributors, ODbL.
"""
import json
import os
import re
import sys

import osmium

ROUTE_TYPES = re.compile(r"^(share_taxi|bus|minibus|coach|train|subway|light_rail|monorail|tram|ferry|trolleybus)$")
CACHE = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".cache")
CHUNK = 100


class Relations(osmium.SimpleHandler):
    def __init__(self):
        super().__init__()
        self.rels = []
        self.way_ids = set()
        self.node_ids = set()

    def relation(self, r):
        if r.tags.get("type") != "route" or not ROUTE_TYPES.match(r.tags.get("route", "")):
            return
        members = []
        for m in r.members:
            kind = {"n": "node", "w": "way", "r": "relation"}[m.type]
            members.append({"type": kind, "ref": m.ref, "role": m.role})
            if kind == "way":
                self.way_ids.add(m.ref)
            elif kind == "node":
                self.node_ids.add(m.ref)
        self.rels.append({
            "type": "relation", "id": r.id, "tags": dict(r.tags), "members": members,
            "timestamp": r.timestamp.strftime("%Y-%m-%dT%H:%M:%SZ") if r.timestamp else None,
        })


class Members(osmium.SimpleHandler):
    def __init__(self, way_ids, node_ids):
        super().__init__()
        self.way_ids = way_ids
        self.node_ids = node_ids
        self.ways = {}
        self.nodes = {}

    def node(self, n):
        if n.id in self.node_ids and n.location.valid():
            self.nodes[n.id] = {"type": "node", "id": n.id, "lat": n.location.lat, "lon": n.location.lon, "tags": dict(n.tags)}

    def way(self, w):
        if w.id not in self.way_ids:
            return
        geom = [{"lat": nd.location.lat, "lon": nd.location.lon} for nd in w.nodes if nd.location.valid()]
        tags = {k: v for k, v in dict(w.tags).items() if k in ("highway", "name", "toll", "railway", "route")}
        self.ways[w.id] = {"type": "way", "id": w.id, "tags": tags, "geometry": geom}


def main(pbf):
    os.makedirs(CACHE, exist_ok=True)
    print("Pass 1/2: finding transit routes…")
    rh = Relations()
    rh.apply_file(pbf)
    print(f"  {len(rh.rels)} routes, {len(rh.way_ids)} ways, {len(rh.node_ids)} stop nodes")
    print("Pass 2/2: reading their geometry…")
    mh = Members(rh.way_ids, rh.node_ids)
    mh.apply_file(pbf, locations=True, idx="flex_mem")
    for f in os.listdir(CACHE):
        if f.startswith("pbf-"):
            os.remove(os.path.join(CACHE, f))
    for i in range(0, len(rh.rels), CHUNK):
        chunk = rh.rels[i:i + CHUNK]
        elements = list(chunk)
        seen_w, seen_n = set(), set()
        for r in chunk:
            for m in r["members"]:
                if m["type"] == "way" and m["ref"] in mh.ways and m["ref"] not in seen_w:
                    seen_w.add(m["ref"])
                    elements.append(mh.ways[m["ref"]])
                elif m["type"] == "node" and m["ref"] in mh.nodes and m["ref"] not in seen_n:
                    seen_n.add(m["ref"])
                    elements.append(mh.nodes[m["ref"]])
        with open(os.path.join(CACHE, f"pbf-{i // CHUNK:04d}.json"), "w") as fh:
            json.dump({"elements": elements}, fh)
    print("Done. Now run: node scripts/osm-transit/build.ts")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit("usage: python3 scripts/osm-transit/fetch_pbf.py philippines-latest.osm.pbf")
    main(sys.argv[1])
