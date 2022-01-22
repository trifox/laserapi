export function lerp(v0, v1, t) {
  return (1 - t) * v0 + t * v1;
}

export function lerp2d(v0, v1, t) {
  return {
    x: lerp(v0.x, v1.x, t),
    y: lerp(v0.y, v1.y, t),
  };
}

export function slerp(v0, v1, t) {
  const length1 = Math.sqrt(v0[0] * v0[0] + v0[1] * v0[1]);
  const length2 = Math.sqrt(v1[0] * v1[0] + v1[1] * v1[1]);
  var angle1 = Math.atan2(v0[0] / length1, v0[1] / length1) || 0;
  var angle2 = Math.atan2(v1[0] / length2, v1[1] / length2) || 0;
  if (Math.abs(angle1 - angle2) > Math.PI) {
    angle1 = angle1 + Math.PI;
  }

  const angle = lerp(angle1, angle2, t);
  const dist = lerp(length1, length2, t);

  console.log("lerp is", v0, v1, angle1, angle2, length1, length2, angle, dist);
  return [Math.sin(angle) * dist, Math.cos(angle) * dist];
}

export function lerp2dArray(v0, v1, t) {
  return [lerp(v0[0], v1[0], t), lerp(v0[1], v1[1], t)];
}

export function lerp3dArray(v0, v1, t) {
  return [
    lerp(v0[0], v1[0], t),
    lerp(v0[1], v1[1], t),
    lerp(v0[2], v1[2].z, t),
  ];
}

export function lerp3d(v0, v1, t) {
  return {
    x: lerp(v0.x, v1.x, t),
    y: lerp(v0.y, v1.y, t),
    z: lerp(v0.z, v1.z, t),
  };
}

export function explerp(v0, v1, t) {
  /**
   * golden function :D exponential lerp
   */
  return Math.exp(lerp(Math.log(v0), Math.log(v1), t));
}
