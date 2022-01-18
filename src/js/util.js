function componentToHex(c) {
  var hex = c.toString(16);
  return hex.length == 1 ? "0" + hex : hex;
}

function renderTextOutline({
  ctx,
  text,
  x = 100,
  fontSize = "140px",
  lineHeight = 140,
  y = 100,
  weight = "bold",
  font = "Verdana",
  fillStyle = "#0088ff",
  align = "center",
  outlineDist = 1,
  shadowStyle = "#000000",
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

function renderTextDropShadow({
  ctx,
  text,
  x = 100,
  fontSize = "140px",
  lineHeight = 140,
  y = 100,
  weight = "bold",
  font = "Verdana",
  fillStyle = "#0088ff",
  align = "center",
  dropDistX = 10,
  dropDistY = 10,
  shadowStyle = "#000000",
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
function renderText({
  ctx,
  text,
  x = 100,
  fontSize = "140px",
  lineHeight = 140,
  y = 100,
  weight = "bold",
  font = "Verdana",
  fillStyle = "#0088ff",
  align = "center",
}) {
  ctx.font = weight + " " + fontSize + " " + font;
  ctx.fillStyle = fillStyle;
  ctx.textAlign = align;
  const res = String(text).split("\n");
  res.forEach((item, index) => ctx.fillText(item, x, y + index * lineHeight));
}
function rgbToHex(r, g, b) {
  return "#" + componentToHex(r) + componentToHex(g) + componentToHex(b);
}

function hexToRgb(hex) {
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
  renderTextDropShadow,
  renderTextOutline,
  componentToHex: componentToHex,
  rgbToHex: rgbToHex,
  hexToRgb: hexToRgb,
};
