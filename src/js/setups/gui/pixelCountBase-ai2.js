/**
 * pixelCountBase-ai2 – gemeinsamer Unterbau für pixelCount1D-ai2, pixelCount2D-ai2, pixelCount4D-ai2 und
 * pixelCountButton-ai2 (überarbeitete Fassungen der gleichnamigen Original-Komponenten ohne "-ai2").
 *
 * Liefert ein Objekt mit allen Gettern/Settern, die die Originale gemeinsam haben (X, Y, Radius, Color,
 * Label, Angle, Speed, InnerRadiusFactor …), plus der Messung measure(grid, left, top, width, height).
 * Nicht direkt in Spielen benutzen – dafür sind die vier Komponenten da.
 *
 * Messung (behebt die Fehler der Originale):
 * - Kein "Phantompunkt": Die Originale starteten mit pixelCount = totalCount = 1. Der Schwerpunkt wurde
 *   dadurch durch einen Punkt bei 0 mitgeteilt und zur linken/oberen Ecke gezogen (ein einzelner Laser am
 *   rechten Rand wurde als Mitte gemeldet), und getFillPercent() wurde nie 0.
 * - Geclampter Scan über gridScan.scanRect: kein Lesen von Zellen der Nachbarzeile am Bildrand.
 * - getFillPercent() liefert 0 statt NaN, solange noch nicht gemessen wurde.
 */
import { scanRect } from './gridScan.js';

export function createPixelCountBase(o) {
  var s = {
    x: o.posX,
    y: o.posY,
    radius: o.radius,
    speedX: o.speedX || 0,
    speedY: o.speedY || 0,
    angle: o.angle || 0,
    color: o.normalColor,
    innerRadiusFactor: o.innerRadiusFactor,
    scanRadiusFactor: o.scanRadiusFactor,
    label1: o.label1,
    label2: o.label2,
    // Messwerte
    count: 0,
    total: 0,
    meanX: 0,
    meanY: 0,
    hasLaser: false,
  };

  var api = {
    init: function () {},
    data: {
      fillState: 0,
    },
    /** Anteil leuchtender Zellen im Messbereich in Prozent (gerundet) */
    getFillPercent() {
      return s.total > 0 ? Math.round((s.count / s.total) * 100) : 0;
    },
    /** true, wenn im letzten Frame mindestens ein Laser im Messbereich war */
    hasInput() {
      return s.hasLaser;
    },
    getLabel() {
      return s.label1;
    },
    setLabel(v) {
      s.label1 = v;
    },
    getLabel2() {
      return s.label2;
    },
    setLabel2(v) {
      s.label2 = v;
    },
    setX(v) {
      s.x = v;
    },
    getX() {
      return s.x;
    },
    setY(v) {
      s.y = v;
    },
    getY() {
      return s.y;
    },
    setRadius(v) {
      s.radius = v;
    },
    getRadius() {
      return s.radius;
    },
    setInnerRadiusFactor(v) {
      s.innerRadiusFactor = v;
    },
    getInnerRadiusFactor() {
      return s.innerRadiusFactor;
    },
    getAngle() {
      return s.angle;
    },
    setAngle(v) {
      s.angle = v;
    },
    setColor(v) {
      s.color = v;
    },
    getColor() {
      return s.color;
    },
    setSpeedY(v) {
      s.speedY = v;
    },
    getSpeedY() {
      return s.speedY;
    },
    setSpeedX(v) {
      s.speedX = v;
    },
    getSpeedX() {
      return s.speedX;
    },
  };

  /**
   * Misst das Rechteck (left/top = linke obere Ecke, Canvas-Pixel).
   * meanX/meanY = Schwerpunkt RELATIV zur linken oberen Ecke in Pixeln (wie im Original); ohne Laser 0.
   */
  function measure(grid, left, top, width, height) {
    const r = scanRect(grid, left, top, width, height);
    s.count = r.count;
    s.total = r.total;
    s.hasLaser = r.hasLaser;
    s.meanX = r.hasLaser ? r.x - left : 0;
    s.meanY = r.hasLaser ? r.y - top : 0;
    api.data.fillState = api.getFillPercent();
  }

  /** Anteil 0..1 für Balkenanzeigen */
  function fraction() {
    return s.total > 0 ? s.count / s.total : 0;
  }

  return { state: s, api: api, measure: measure, fraction: fraction };
}

/** Eigenschaften von src nach dst kopieren (Ersatz für Object-Spread, webpack2) */
export function assign(dst, src) {
  Object.keys(src).forEach((k) => {
    dst[k] = src[k];
  });
  return dst;
}
