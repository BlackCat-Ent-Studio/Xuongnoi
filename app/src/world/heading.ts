/**
 * The one place that turns "which way does this thing face" into a unit direction on the ground plane.
 * Heading convention shared by robots and vehicles: 0 = +x, growing clockwise seen from above, so the direction is
 * (cos heading, sin heading) over (x, z) and 90 degrees points to +z (the way the top-down view draws "down").
 * Works on entities and on their views alike: only the three fields below are read.
 */
export interface HeadingSource {
  /** A character's facing (unit direction on the ground plane). */
  facing?: { x: number; z: number };
  vehicle?: { heading: number };
  robot?: { heading: number };
}

export interface Dir2 {
  x: number;
  z: number;
}

/** Unit direction of a heading angle in radians. */
export function directionOfHeading(heading: number): Dir2 {
  return { x: Math.cos(heading), z: Math.sin(heading) };
}

/** Rotates a direction clockwise seen from above (toward +z when it points along +x) by `rad`. */
export function turnDirection(d: Dir2, rad: number): Dir2 {
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return { x: d.x * cos - d.z * sin, z: d.x * sin + d.z * cos };
}

/** Unit direction the thing faces: a robot chassis's or vehicle's nose, else a character's facing, else along +x. */
export function groundHeading(src: HeadingSource): Dir2 {
  if (src.robot && Number.isFinite(src.robot.heading)) return directionOfHeading(src.robot.heading);
  if (src.vehicle && Number.isFinite(src.vehicle.heading)) return directionOfHeading(src.vehicle.heading);
  const f = src.facing;
  if (f) {
    const len = Math.hypot(f.x, f.z);
    if (len > 1e-6) return { x: f.x / len, z: f.z / len };
  }
  return { x: 1, z: 0 };
}
