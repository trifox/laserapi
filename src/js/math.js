export function lerp(v0, v1, t) {
  return (1 - t) * v0 + t * v1;
}

export function lerp2d(v0, v1, t) {
  return {
    x: lerp(v0.x, v1.x, t),
    y: lerp(v0.y, v1.y, t),
  };
}
export function vecAdd2d(a, b) {
  return [a[0] + b[0], a[1] + b[1]];
}
export function vecSub2d(a, b) {
  return [a[0] - b[0], a[1] - b[1]];
}
export function length(a) {
  return Math.sqrt(a[0] * a[0] + a[1] * a[1]);
}
function cartesian2Polar(arr) {
  const x = arr[0];
  const y = arr[1];
  var distance = Math.sqrt(x * x + y * y);
  var radians = Math.atan2(y, x); //This takes y first
  var polarCoor = [distance, radians];
  return polarCoor;
}
function polar2Cartesian(arr) {
  const angleRadians = arr[1];
  const dist = arr[0];
  return [Math.cos(angleRadians) * dist, Math.sin(angleRadians) * dist];
}
export function slerp(v0, v1, t) {
  var t1 = cartesian2Polar(v0);
  var t2 = cartesian2Polar(v1);
  const dist = lerp(t1[0], t2[0], t);
  const angle = lerp(t1[1], t2[1], t);

  var res = polar2Cartesian([dist, angle]);
  // console.log('input', t, v0, v1);
  // console.log('input polar', t1, t2);
  // console.log('output', res);
  return res;
}

export function lerp2dArray(v0, v1, t) {
  return [lerp(v0[0], v1[0], t), lerp(v0[1], v1[1], t)];
}

export function sin3(x) {
  return (
    (Math.sin(x) +
      Math.sin(x / 2) +
      Math.sin(x / 4) +
      Math.sin(x * 2) +
      Math.sin(x * 4)) /
    5
  );
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
