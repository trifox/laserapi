import { hslToRgb, hsvToRgb, rgbToHsl, rgbToHsv } from './color-conversion';
import gpuTools from './gpuTools';
export function componentToHex(c) {
  var hex = Math.round(c).toString(16);
  return hex.length == 1 ? '0' + hex : hex;
}
export function removeItemFromArray(arr, value) {
  // console.log('Removing from array', arr, value);
  var index = arr.indexOf(value);
  if (index > -1) {
    arr.splice(index, 1);
  }
  return arr;
}
export function drawNgon({
  ctx,
  numberOfSides = 10,
  size = 100,
  Xcenter = 25,
  lineWidth = 4,
  Ycenter = 25,
  color,
  filled = false,
  angle = 0,
}) {
  const sizeY = size;
  ctx.fillStyle = color; // hexagon
  ctx.strokeStyle = color; // hexagon

  ctx.beginPath();
  ctx.moveTo(
    Xcenter + size * Math.cos(-angle + 0),
    Ycenter + sizeY * Math.sin(-angle + 0)
  );

  for (var i = 1; i <= numberOfSides; i += 1) {
    ctx.lineTo(
      Xcenter + size * Math.cos(-angle + (i * 2 * Math.PI) / numberOfSides),
      Ycenter + sizeY * Math.sin(-angle + (i * 2 * Math.PI) / numberOfSides)
    );
  }

  // ctx.strokeStyle = "#000000";
  ctx.lineWidth = lineWidth;
  ctx.stroke();
  if (filled) {
    ctx.fill();
  }
}
export function renderTextOutline({
  ctx,
  text,
  x = 100,
  fontSize = '140px',
  lineHeight = 140,
  y = 100,
  weight = 'bold',
  font = 'Verdana',
  fillStyle = '#0088ff',
  align = 'center',
  outlineDist = 1,
  shadowStyle = '#000000',
}) {
  renderText({
    ctx,
    text,
    lineHeight,
    x: x + outlineDist,
    fontSize,
    font,
    y: y,
    weight,
    fillStyle: shadowStyle,
    align,
  });
  renderText({
    ctx,
    text,
    lineHeight,
    x: x - outlineDist,
    fontSize,
    font,
    y: y,
    weight,
    fillStyle: shadowStyle,
    align,
  });
  renderText({
    ctx,
    text,
    lineHeight,
    x: x,
    fontSize,
    font,
    y: y + outlineDist,
    weight,
    fillStyle: shadowStyle,
    align,
  });
  renderText({
    ctx,
    text,
    lineHeight,
    x: x,
    fontSize,
    font,
    y: y - outlineDist,
    weight,
    fillStyle: shadowStyle,
    align,
  });

  renderText({
    ctx,
    text,
    x,
    lineHeight,
    fontSize,
    font,
    y,
    weight,
    fillStyle,
    align,
  });
}

export function renderTextDropShadow({
  ctx,
  text,
  x = 100,
  fontSize = '140px',
  lineHeight = 140,
  y = 100,
  weight = 'bold',
  font = 'Verdana',
  fillStyle = '#0088ff',
  align = 'center',
  dropDistX = 10,
  dropDistY = 10,
  shadowStyle = '#000000',
}) {
  renderText({
    ctx,
    text,
    lineHeight,
    x: x + dropDistX,
    fontSize,
    font,
    y: y + dropDistY,
    weight,
    fillStyle: shadowStyle,
    align,
  });
  renderText({
    ctx,
    text,
    x,
    lineHeight,
    fontSize,
    font,
    y,
    weight,
    fillStyle,
    align,
  });
}
export function drawLine(ctx, x1, y1, x2, y2, color = '#ffffff') {
  ctx.strokeStyle = color;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}
export function renderTextStroke({
  ctx,
  text,
  x = 100,
  fontSize = '140px',
  lineHeight = 25,
  y = 100,
  weight = 'bold',
  font = 'Arvo',
  fillStyle = '#0088ff',
  align = 'center',

  strokeStyle = 'black', strokeWidth = 12
}) {
  ctx.strokeStyle = strokeStyle;
  ctx.lineWidth = strokeWidth;
  ctx.font = weight + ' ' + fontSize + ' ' + font;
  ctx.fillStyle = fillStyle;
  ctx.textAlign = align;
  const res = String(text).split('\n');
  res.forEach((item, index) => ctx.strokeText(item, x, y + index * lineHeight));
}
export function renderText({
  ctx,
  text,
  x = 100,
  fontSize = '140px',
  lineHeight = 25,
  y = 100,
  weight = 'bold',
  font = 'Arvo',
  fillStyle = '#0088ff',
  align = 'center',
}) {
  ctx.font = weight + ' ' + fontSize + ' ' + font;
  ctx.fillStyle = fillStyle;
  ctx.textAlign = align;
  const res = String(text).split('\n');
  res.forEach((item, index) => ctx.fillText(item, x, y + index * lineHeight));
}
export function rgbToHex(r = 0, g = 255, b = 0, a) {
  // console.log('rgb to hex of', r, g, b);
  //
  return (
    '#' +
    componentToHex(r) +
    componentToHex(g) +
    componentToHex(b) +
    (a !== undefined ? componentToHex(a) : '')
  );
}

export function getRgbSpreadRandomHex(colorasArrayBytes) {
  return getRgbSpreadHex(
    colorasArrayBytes,
    Math.random() * 0.5 + 0.25,
    Math.random() * 0.25 + 0.5,
    Math.random() * 0.25 + 0.5
  );
}
export function getRgbSpreadRandomHexTriplet(colorasArrayBytes) {
  const randih = Math.random() * 0.3 + 0.35;
  const randis = Math.random() * 0.5 + 0.5;
  const randiv = Math.random() * 0.5 + 0.5;

  return [
    getRgbSpreadHex(colorasArrayBytes, randih, randis, randiv),
    getRgbSpreadHex(colorasArrayBytes, randih, randis, randiv * 0.75),
    getRgbSpreadHex(colorasArrayBytes, randih, randis, randiv * 0.5),
  ];
}
export function getRgbSpreadTriplet(colorasArrayBytes) {

  return [
    getRgbSpreadHex(colorasArrayBytes, 0.4, .5, .5),
    getRgbSpreadHex(colorasArrayBytes, 0.5, .5, 0.5),
    getRgbSpreadHex(colorasArrayBytes, 0.6, .5, 0.5),
  ];
}
export function getRgbSpreadHex(colorasArrayBytes, spread = 0.5, sat, value) {
  var col = getRgbSpread(colorasArrayBytes, spread, sat, value);
  return rgbToHex(col[0], col[1], col[2]);
}
export function getRgbSpread(colorasArrayBytes, spread = 0.5, sat, value) {
  var col = rgbToHsv(
    colorasArrayBytes[0],
    colorasArrayBytes[1],
    colorasArrayBytes[2]
  );
  //console.log(col);
  var result = hsvToRgb(
    (col[0] + spread) % 1,
    sat === undefined ? col[1] : sat,
    //1 - col[1],
    value === undefined ? col[2] : value
    // 1-col[1], 1-col
    // 1 - col[1],
    // 1 - col[2]
  );

  // console.log('rgb spread is', colorasArrayBytes, col, result);

  return result;
}
export function getRgbSaturation(colorasArrayBytes, sat) {
  var col = gpuTools.rgb2hsv(
    colorasArrayBytes[0],
    colorasArrayBytes[1],
    colorasArrayBytes[2]
  );
  return gpuTools.hsv2rgb(col[0], col[1], sat);
}
export function getRgbValue(colorasArrayBytes, sat) {
  var col = gpuTools.rgb2hsv(
    colorasArrayBytes[0],
    colorasArrayBytes[1],
    colorasArrayBytes[2]
  );
  return gpuTools.hsv2rgb(col[0], sat, col[2]);
}
export function hexToRgb(hex) {
  var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16),
    }
    : null;
}
export default {
  renderText,
  drawNgon,
  renderTextDropShadow,
  renderTextOutline,
  componentToHex: componentToHex,
  rgbToHex: rgbToHex,
  hexToRgb: hexToRgb,
  drawLine,
};
