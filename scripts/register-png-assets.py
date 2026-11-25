"""Unpack approved single-asset sprite sheets and register directional PNG files."""
import argparse
import hashlib
import io
import json
import math
from pathlib import Path
from subprocess import run

from PIL import Image, ImageChops, ImageFilter

PROJECT = Path(__file__).resolve().parents[1]
DIRECTIONS = (0, 90, 180, 270)
UNIT = float(next(line.split(":", 1)[1] for line in
                  (PROJECT / "config/rendering.yaml").read_text().splitlines()
                  if line.startswith("pixels_per_unit:")))
DEFAULT_TILES = dict(zip(map(str, DIRECTIONS), (
    (0, 0, .5, .5), (.5, 0, 1, .5), (0, .5, .5, 1), (.5, .5, 1, 1),
)))


def clean_alpha(tile):
    alpha = tile.getchannel("A")
    core = alpha.point(lambda value: 255 if value >= 24 else 0)
    width, height = tile.size
    connected = bytearray(core.filter(ImageFilter.MaxFilter(5)).tobytes())
    components = []
    for index, value in enumerate(connected):
        if not value:
            continue
        connected[index] = 0
        points = [index]
        for point in points:
            neighbors = []
            if point % width:
                neighbors.append(point - 1)
            if point % width < width - 1:
                neighbors.append(point + 1)
            if point >= width:
                neighbors.append(point - width)
            if point < width * (height - 1):
                neighbors.append(point + width)
            for neighbor in neighbors:
                if connected[neighbor]:
                    connected[neighbor] = 0
                    points.append(neighbor)
        components.append(points)
    mask = bytearray(width * height)
    # Keep small real parts such as a mouse, while dropping stray alpha flecks.
    min_area = max(24, max(map(len, components), default=0) * .008)
    for points in components:
        if len(points) >= min_area:
            for point in points:
                mask[point] = 255
    tile.putalpha(ImageChops.darker(alpha, Image.frombytes("L", tile.size, bytes(mask))))
    return tile


def extract(image, raw_box):
    x0, y0, x1, y1 = raw_box
    tile = image.crop((round(x0 * image.width), round(y0 * image.height),
                       round(x1 * image.width), round(y1 * image.height)))
    tile = clean_alpha(tile)
    core = tile.getchannel("A").point(lambda value: 255 if value >= 24 else 0)
    box = core.getbbox()
    if not box:
        raise ValueError("方向区域没有可见物体")
    x0, y0, x1, y1 = box
    if min(x0, y0, tile.width - x1, tile.height - y1) <= 1:
        raise ValueError("物体触及分格边缘，请检查有无遮挡或指定裁切坐标")
    tile = tile.crop(box)
    tile.thumbnail((384, 384), Image.Resampling.LANCZOS)
    result = io.BytesIO()
    tile.save(result, "PNG", optimize=True)
    return result.getvalue()


def projected_box(asset):
    width, depth = asset["footprint"]
    height = asset["height"]
    # Composer units. The image is aligned to the front-most ground contact.
    half_x = math.ceil((width + depth) * math.sqrt(3) / 4 * UNIT) + 2
    half_y = math.ceil((width + depth) / 4 * UNIT) + 2
    top = math.ceil(height * UNIT) + half_y
    return {"anchor": [half_x, top], "view_box": [-half_x, -top, half_x * 2, top + half_y]}


def prepare(entry, current, manifest_dir):
    identifier = entry["id"]
    asset = {**(current or {}), **entry.get("metadata", {}), "id": identifier}
    namespace = "universal" if asset["industry"] == "universal" else f'industry/{asset["industry"]}'
    basename = identifier.rsplit(".", 1)[-1]
    image_path = manifest_dir / entry["source"]
    with Image.open(image_path) as source:
        image = source.convert("RGBA")
    if image.getchannel("A").getextrema() == (255, 255):
        raise ValueError("素材需要带真透明背景")
    tiles = {**DEFAULT_TILES, **entry.get("tiles", {})}
    variants = {}
    files = {}
    for angle in DIRECTIONS:
        direction = str(angle)
        path = f'assets/{namespace}/{asset["category"]}/{basename}-{angle}.png'
        try:
            data = extract(image, tiles[direction])
        except ValueError as error:
            raise ValueError(f"{identifier} {angle}° · {error}") from error
        box = asset.get("variants", {}).get(direction) or projected_box(asset)
        variants[direction] = {**box, "file": path, "sha256": hashlib.sha256(data).hexdigest()}
        files[path] = data
    asset.update(version=entry.get("version", "2.0.0" if current else "1.0.0"),
                 source_type="imagegen", source_url=None,
                 attribution="OpenAI ImageGen / Isometric Scene Composer",
                 license="LicenseRef-Project-Original", source_prompt=entry["prompt"],
                 status=entry.get("status", "draft"), supported_directions=list(DIRECTIONS),
                 variants=variants, file=variants["0"]["file"], anchor=variants["0"]["anchor"])
    return asset, files


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("manifest", type=Path)
    options = parser.parse_args()
    registry_path = PROJECT / "assets" / "registry.json"
    registry = {asset["id"]: asset for asset in json.loads(registry_path.read_text())}
    entries = json.loads(options.manifest.read_text())
    prepared = [prepare(entry, registry.get(entry["id"]), options.manifest.resolve().parent)
                for entry in entries]
    payload = json.dumps([asset for asset, _ in prepared], ensure_ascii=False)
    run(["node", "--input-type=module", "-e",
         "import {readFileSync} from 'node:fs';"
         "import {validateSchema} from './src/workspace.mjs';"
         "validateSchema('asset',JSON.parse(readFileSync(0,'utf8')));"],
        input=payload, text=True, check=True, cwd=PROJECT)

    files = {}
    for asset, images in prepared:
        if asset["status"] == "draft":
            target = PROJECT / "assets" / "drafts" / asset["id"]
            target.mkdir(parents=True, exist_ok=True)
            for path, data in images.items():
                (target / Path(path).name).write_bytes(data)
        else:
            registry[asset["id"]] = asset
            files.update(images)
    if files:
        for path, data in files.items():
            image_path = PROJECT / path
            image_path.parent.mkdir(parents=True, exist_ok=True)
            image_path.write_bytes(data)
        registry_path.write_text(json.dumps(list(registry.values()), ensure_ascii=False, indent=2) + "\n")
    print(f"{len(entries)} 个素材已处理，{len(files)} 个已批准方向已登记。")


if __name__ == "__main__":
    main()
