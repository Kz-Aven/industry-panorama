export function project([x, y, z], unit) {
  return [(x - y) * Math.sqrt(3) / 2 * unit, ((x + y) / 2 - z) * unit];
}

export function extent(points, padding = 0) {
  const x = points.map(p => p[0]);
  const y = points.map(p => p[1]);
  const left = Math.floor(Math.min(...x) - padding);
  const top = Math.floor(Math.min(...y) - padding);
  return [left, top, Math.ceil(Math.max(...x) + padding) - left, Math.ceil(Math.max(...y) + padding) - top];
}

export const round = value => Number(value.toFixed(3));

function shade(color, factor) {
  const rgb = color.slice(1).match(/../g).map(c => Math.min(255, Math.round(parseInt(c, 16) * factor)));
  return '#' + rgb.map(c => c.toString(16).padStart(2, '0')).join('');
}

export function polygon(points, fill, stroke = '', width = 0.6) {
  return `<polygon points="${points.map(p => p.map(round).join(',')).join(' ')}" fill="${fill}"${stroke ? ` stroke="${stroke}" stroke-width="${width}" stroke-linejoin="round"` : ''}/>`;
}

export function brick(x, y, z, w, d, h, color, unit, colors) {
  const points = [[x,y],[x+w,y],[x+w,y+d],[x,y+d]];
  const base = points.map(p => project([...p, z], unit));
  const top = points.map(p => project([...p, z+h], unit));
  const [light, front, side] = colors ?? [shade(color, 1.1), shade(color, .93), shade(color, .77)];
  const edge = shade(side, .72);
  return {
    points: [...base, ...top],
    svg: polygon([top[1],top[2],base[2],base[1]], side, edge) +
      polygon([top[2],top[3],base[3],base[2]], front, edge) +
      polygon(top, light, edge),
  };
}
