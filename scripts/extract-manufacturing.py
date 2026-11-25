"""Read the original Codex HTML export without executing its JavaScript."""
import hashlib
import json
import re
import sys
from html import unescape
from html.parser import HTMLParser
from pathlib import Path


class AtlasHTML(HTMLParser):
    def __init__(self):
        super().__init__()
        self.srcdoc = []

    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        embedded = values.get("srcdoc") or values.get("data-srcdoc")
        if tag == "iframe" and embedded:
            self.srcdoc.append(embedded)


def text(fragment):
    return unescape(re.sub(r"<[^>]*>", "", fragment)).strip()


def items(section, pattern):
    return re.findall(pattern, section, re.S)


def layer(content, key, names):
    start = re.search(fr'<div id="mfg-{key}"[^>]*>', content).end()
    section = content[start: content.index('\n  </div>', start)]
    heading = text(re.search(r"<h2>(.*?)</h2>", section, re.S)[1])
    title = text(re.search(fr'<button[^>]*id="mfg-{key}-tab"[^>]*>(.*?)</button>', content, re.S)[1])
    if key == "roles":
        entries = [
            {"label": text(label), "participant": text(role), "description": text(detail)}
            for role, label, detail in items(section, r'<li>\s*<span class="lane">(.*?)</span>\s*<div>\s*<strong>(.*?)</strong>\s*<small>(.*?)</small>')
        ]
        blocks = [{"title": names[key], "entries": entries}]
    elif key == "logic":
        entries = [
            {"label": text(label), "description": text(detail)}
            for label, detail in items(section, r'<li>\s*<strong>(.*?)</strong>\s*<span>(.*?)</span>\s*</li>')
        ]
        blocks = [{"title": names[key], "entries": entries}]
    else:
        blocks = [
            {
                "title": text(caption),
                "entries": [
                    {"label": text(label), "description": text(detail)}
                    for label, detail in items(block, r'<li>\s*<strong>(.*?)</strong>\s*<small>(.*?)</small>')
                ],
                "note": text(re.search(r"<p[^>]*>(.*?)</p>", block, re.S)[1]),
            }
            for caption, block in items(section, r'<figure>\s*<figcaption>(.*?)</figcaption>(.*?)</figure>')
        ]
    notes = [text(note) for note in items(section, r'<p class="(?:loop|text-small text-muted footnote)">(.*?)</p>')]
    return {"id": key, "title": title, "heading": heading, "sections": blocks,
            **({"note": "\n".join(notes)} if notes else {}), "source_refs": ["manufacturing-" + key]}


def extract(source):
    raw = source.read_bytes()
    html = raw.decode("utf-8")
    parser = AtlasHTML()
    parser.feed(html)
    content = next((d for d in parser.srcdoc if 'id="mfg-data"' in d), html)
    data = json.loads(re.search(r'<script\s+type="application/json"\s+id="mfg-data"\s*>(.*?)</script>', content, re.S)[1])
    map_start = content.index('<div id="mfg-overview"')
    map_end = content.index('<div id="mfg-roles"')
    map_html = content[map_start:map_end]
    return {
        "source": source.name,
        "sha256": hashlib.sha256(raw).hexdigest(),
        "description": text(re.search(r'<p class="text-muted scope">(.*?)</p>', content, re.S)[1]),
        "zones": [text(name) for name in items(map_html, r"<h2>(.*?)</h2>")],
        "note": text(re.search(r'<p class="text-small text-muted footnote">(.*?)</p>', map_html, re.S)[1]),
        "groups": data["groups"],
        "entries": data["entries"],
        "layers": [layer(content, key, {"roles": "按交接顺序", "logic": "从触发到交付"}) for key in ("roles", "logic", "objects")],
    }


if __name__ == "__main__":
    source, output = map(Path, sys.argv[1:])
    output.write_text(json.dumps(extract(source), ensure_ascii=False, indent=2) + "\n")
