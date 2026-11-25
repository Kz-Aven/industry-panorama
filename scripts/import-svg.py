"""Prepare a local, normalized external SVG as a draft asset."""
import hashlib
import json
import re
import sys
from subprocess import run
from pathlib import Path
from urllib.parse import urlsplit
from xml.etree import ElementTree as ET


SVG = "http://www.w3.org/2000/svg"
ALLOWED = {"svg", "g", "defs", "title", "desc", "path", "polygon", "polyline", "line", "rect", "circle",
           "ellipse", "linearGradient", "radialGradient", "stop", "clipPath", "mask", "symbol", "use"}
ET.register_namespace("", SVG)
ET.register_namespace("xlink", "http://www.w3.org/1999/xlink")


def normalized_variant(path):
    root = ET.parse(path).getroot()
    if root.tag != f"{{{SVG}}}svg":
        raise ValueError(f"需要独立 SVG 文件：{path}")
    view_box = [float(n) for n in re.split(r"[\s,]+", root.attrib["viewBox"].strip())]
    left, top, width, height = view_box
    if width <= 0 or height <= 0 or not (left <= 0 <= left + width and top <= 0 <= top + height):
        raise ValueError("viewBox 应包含地面锚点 (0,0)，宽高为正")
    for element in root.iter():
        if not element.tag.startswith(f"{{{SVG}}}") or element.tag.split("}")[-1] not in ALLOWED:
            raise ValueError(f"SVG 含不支持的元素：{element.tag}")
        for key, value in element.attrib.items():
            key = key.split("}")[-1].lower()
            references = re.findall(r"url\s*\(([^)]*)\)", value, re.I)
            if (key.startswith("on") or key in {"style", "base"} or
                    (key == "href" and not value.startswith("#")) or
                    any(not ref.strip("'\" ").startswith("#") for ref in references)):
                raise ValueError(f"SVG 含不支持的属性或外部引用：{key}")
    root.set("viewBox", " ".join(f"{n:g}" for n in view_box))
    data = ET.tostring(root, encoding="utf-8") + b"\n"
    return data, {"sha256": hashlib.sha256(data).hexdigest(), "anchor": [-left, -top], "view_box": view_box}


def prepare(manifest_path, current_project):
    metadata = json.loads(manifest_path.read_text())
    identifier = metadata["id"]
    directions = metadata.pop("directions")
    if not re.fullmatch(r"[a-z0-9][a-z0-9._-]*", identifier):
        raise ValueError("素材 ID 必须是小写命名空间 ID")
    if not directions or set(directions) - {"0", "90", "180", "270"} or "0" not in directions:
        raise ValueError("directions 需要 0°，可追加 90°、180°、270°")
    if urlsplit(metadata["source_url"]).scheme not in {"http", "https"}:
        raise ValueError("外部素材需要 http(s) 来源")
    if not metadata["license"].strip() or not metadata["attribution"].strip():
        raise ValueError("外部素材需要许可和署名")
    relative = f"assets/imported/{identifier}"
    variants = {}
    files = []
    for direction in sorted(directions, key=int):
        file = f"{direction}.svg"
        data, variant = normalized_variant(manifest_path.parent / directions[direction])
        variants[direction] = {**variant, "file": f"{relative}/{file}"}
        files.append((file, data))
    asset = {
        **metadata, "file": variants["0"]["file"], "anchor": variants["0"]["anchor"],
        "supported_directions": list(map(int, variants)), "source_type": "external", "status": "draft", "variants": variants,
    }
    module_url = (Path(__file__).resolve().parents[1] / "src" / "workspace.mjs").as_uri()
    check = run(["node", "--input-type=module", "-e",
                 "import {readFileSync} from 'node:fs';"
                 "const {validateSchema}=await import(process.argv[1]);"
                 "try {validateSchema('asset',JSON.parse(readFileSync(0,'utf8')))} "
                 "catch(error){console.error(error.message);process.exitCode=1}",
                 module_url], input=json.dumps([asset]), text=True, capture_output=True)
    if check.returncode:
        raise ValueError(check.stderr.strip())
    output = current_project / relative
    output.parent.mkdir(parents=True, exist_ok=True)
    output.mkdir(exist_ok=False)
    for file, data in files:
        (output / file).write_bytes(data)
    (output / "asset.json").write_text(json.dumps(asset, ensure_ascii=False, indent=2) + "\n")
    return output


if __name__ == "__main__":
    if len(sys.argv) not in (2, 3):
        sys.exit("用法：python3 scripts/import-svg.py <manifest.json> [项目目录]")
    try:
        print(prepare(Path(sys.argv[1]), Path(sys.argv[2]) if len(sys.argv) == 3 else Path(__file__).resolve().parents[1]))
    except (OSError, ValueError, KeyError, ET.ParseError) as error:
        sys.exit(str(error))
