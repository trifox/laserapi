/**
 * aimTurret – Geschütz, das auf den Schwerpunkt aller Laserpunkte in einem Scanbereich zielt.
 *
 * - Scannt nur das Rechteck scanX/scanY/scanWidth/scanHeight (Canvas-Pixel, am Rand geclampt).
 * - Schwerpunkt (getTargetX/Y) und Streuung (getSpread, Standardabweichung in Pixeln) der leuchtenden Zellen.
 * - getFocus(): 1 = alle Laser eng beieinander, 0 = Streuung >= focusSpread. Gut für Teamwork-Belohnung.
 * - Ziel und Rohrwinkel folgen weich (targetSmoothing, turnSpeed), damit Rauschen nicht zittert.
 * - Gültiges Ziel erst ab minPercent leuchtender Zellen im Scanbereich (Rauschfilter).
 * - Solange ein Ziel da ist, wird alle fireInterval Sekunden onShoot({ x, y, angle, focus, spread }) gerufen
 *   (x/y = Rohrmündung). fireInterval ist per setFireInterval() zur Laufzeit änderbar.
 * - Tastatur-Test: keyCodes { left, right, up, down } bewegen einen Ersatz-Zielpunkt (ersetzt die Laser,
 *   solange eine der Tasten gedrückt ist bzw. bis keyHoldTime Sekunden danach).
 *
 * Auflösungsunabhängig: alle Werte in Canvas-Pixeln bzw. Prozent des Scanbereichs.
 */
var MasterCanvas = require('../../MasterCanvas').default;
var laserConfig = require('../../LaserApiConfig').default;

export default ({
  label = '',
  posX,
  posY,
  scanX = 0,
  scanY = 0,
  scanWidth,
  scanHeight,
  minPercent = 0,
  focusSpread = 400,
  targetSmoothing = 10, // je höher, desto schneller folgt das Ziel dem Schwerpunkt (1/s)
  turnSpeed = 10, // Rohr-Drehgeschwindigkeit (1/s)
  barrelLength = 80,
  lineWidth = 10,
  radius = 50, // Fadenkreuz-Radius
  fireInterval = 0.2,
  onShoot,
  onTargetFound,
  onTargetLost,
  normalColor = '#0088ff',
  crosshairColor = '#00bbff',
  keyCodes = undefined,
  keySpeed = 900,
  keyHoldTime = 0.5,
  visible = true,
  angle = 0,
}) => {
  var currentX = posX;
  var currentY = posY;
  var currentRadius = radius;
  var currentColor = normalColor;
  var currentCrosshairColor = crosshairColor;
  var currentLabel = label;
  var currentFireInterval = fireInterval;
  var currentAngle = angle;
  var targetX = posX;
  var targetY = posY - 300;
  var rawX = targetX;
  var rawY = targetY;
  var spread = 0;
  var litPercent = 0;
  var hasTarget = false;
  var fireTimer = 0;
  var keyX = undefined;
  var keyY = undefined;
  var keyTimer = 0;

  function scan(grid) {
    const canvas = MasterCanvas.getCanvas();
    const w = scanWidth === undefined ? canvas.width : scanWidth;
    const h = scanHeight === undefined ? canvas.height : scanHeight;
    const gridSize = Math.floor(Math.sqrt(grid.length));
    if (gridSize === 0) return { count: 0, total: 1 };
    const factx = canvas.width / gridSize;
    const facty = canvas.height / gridSize;
    const x0 = Math.max(0, Math.floor(scanX / factx));
    const x1 = Math.min(gridSize - 1, Math.floor((scanX + w) / factx));
    const y0 = Math.max(0, Math.floor(scanY / facty));
    const y1 = Math.min(gridSize - 1, Math.floor((scanY + h) / facty));
    let count = 0;
    let sx = 0;
    let sy = 0;
    let sxx = 0;
    let syy = 0;
    for (let gy = y0; gy <= y1; gy++) {
      const row = gy * gridSize;
      const cy = (gy + 0.5) * facty;
      for (let gx = x0; gx <= x1; gx++) {
        if (grid[gx + row] > 0) {
          const cx = (gx + 0.5) * factx;
          count++;
          sx += cx;
          sy += cy;
          sxx += cx * cx;
          syy += cy * cy;
        }
      }
    }
    const total = Math.max(1, (x1 - x0 + 1) * (y1 - y0 + 1));
    if (count === 0) return { count, total };
    const mx = sx / count;
    const my = sy / count;
    const variance = Math.max(0, sxx / count - mx * mx + syy / count - my * my);
    return { count, total, mx, my, spread: Math.sqrt(variance) };
  }

  function handleKeys(elapsed) {
    if (!keyCodes) return false;
    const k = laserConfig.pressedKeys;
    let dx = 0;
    let dy = 0;
    if (k[keyCodes.left]) dx -= 1;
    if (k[keyCodes.right]) dx += 1;
    if (k[keyCodes.up]) dy -= 1;
    if (k[keyCodes.down]) dy += 1;
    if (dx !== 0 || dy !== 0) {
      if (keyX === undefined) {
        keyX = targetX;
        keyY = targetY;
      }
      const canvas = MasterCanvas.getCanvas();
      keyX = Math.max(0, Math.min(canvas.width, keyX + dx * keySpeed * elapsed));
      keyY = Math.max(0, Math.min(canvas.height, keyY + dy * keySpeed * elapsed));
      keyTimer = keyHoldTime;
    } else {
      keyTimer = Math.max(0, keyTimer - elapsed);
    }
    return keyTimer > 0 && keyX !== undefined;
  }

  function drawTurret(ctx) {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = currentColor;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.moveTo(currentX, currentY);
    ctx.lineTo(currentX + Math.cos(currentAngle) * barrelLength, currentY + Math.sin(currentAngle) * barrelLength);
    ctx.stroke();
    if (hasTarget) {
      // gestrichelte Ziellinie + Fadenkreuz
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = 2;
      ctx.setLineDash([12, 12]);
      ctx.strokeStyle = currentCrosshairColor;
      ctx.beginPath();
      ctx.moveTo(currentX, currentY);
      ctx.lineTo(targetX, targetY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(targetX, targetY, currentRadius, 0, Math.PI * 2);
      ctx.moveTo(targetX - currentRadius * 1.4, targetY);
      ctx.lineTo(targetX - currentRadius * 0.5, targetY);
      ctx.moveTo(targetX + currentRadius * 0.5, targetY);
      ctx.lineTo(targetX + currentRadius * 1.4, targetY);
      ctx.moveTo(targetX, targetY - currentRadius * 1.4);
      ctx.lineTo(targetX, targetY - currentRadius * 0.5);
      ctx.moveTo(targetX, targetY + currentRadius * 0.5);
      ctx.lineTo(targetX, targetY + currentRadius * 1.4);
      ctx.stroke();
    }
    if (currentLabel) {
      ctx.fillStyle = currentColor;
      ctx.font = 'bold 25px Arvo';
      ctx.textAlign = 'center';
      ctx.fillText(currentLabel, currentX, currentY + 40);
    }
    ctx.restore();
  }

  var result = {
    name: 'GUI aimTurret',
    init: function () {},
    getX() {
      return currentX;
    },
    setX(v) {
      currentX = v;
    },
    getY() {
      return currentY;
    },
    setY(v) {
      currentY = v;
    },
    getRadius() {
      return currentRadius;
    },
    setRadius(v) {
      currentRadius = v;
    },
    getColor() {
      return currentColor;
    },
    setColor(v) {
      currentColor = v;
    },
    getCrosshairColor() {
      return currentCrosshairColor;
    },
    setCrosshairColor(v) {
      currentCrosshairColor = v;
    },
    getLabel() {
      return currentLabel;
    },
    setLabel(v) {
      currentLabel = v;
    },
    getAngle() {
      return currentAngle;
    },
    setAngle(v) {
      currentAngle = v;
    },
    getFireInterval() {
      return currentFireInterval;
    },
    setFireInterval(v) {
      currentFireInterval = v;
    },
    getTargetX() {
      return targetX;
    },
    getTargetY() {
      return targetY;
    },
    /** ungeglätteter Schwerpunkt des letzten Frames */
    getRawTargetX() {
      return rawX;
    },
    getRawTargetY() {
      return rawY;
    },
    hasTarget() {
      return hasTarget;
    },
    getLitPercent() {
      return litPercent;
    },
    getSpread() {
      return spread;
    },
    getFocus() {
      return hasTarget ? Math.max(0, Math.min(1, 1 - spread / focusSpread)) : 0;
    },
    getMuzzleX() {
      return currentX + Math.cos(currentAngle) * barrelLength;
    },
    getMuzzleY() {
      return currentY + Math.sin(currentAngle) * barrelLength;
    },
    handle: function (grid, elapsed) {
      const ctx = MasterCanvas.get2dContext();
      const hadTarget = hasTarget;
      const s = scan(grid);
      litPercent = (s.count / s.total) * 100;
      const keyActive = handleKeys(elapsed);

      if (keyActive) {
        rawX = keyX;
        rawY = keyY;
        spread = 0;
        hasTarget = true;
      } else if (s.count > 0 && litPercent >= minPercent) {
        rawX = s.mx;
        rawY = s.my;
        spread = s.spread;
        hasTarget = true;
      } else {
        hasTarget = false;
      }

      if (hasTarget) {
        if (!hadTarget) {
          // neues Ziel: direkt springen statt quer über den Bildschirm zu gleiten
          targetX = rawX;
          targetY = rawY;
          if (onTargetFound) onTargetFound(result);
        } else {
          const f = Math.min(1, targetSmoothing * elapsed);
          targetX += (rawX - targetX) * f;
          targetY += (rawY - targetY) * f;
        }
        const wanted = Math.atan2(targetY - currentY, targetX - currentX);
        let diff = wanted - currentAngle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        currentAngle += diff * Math.min(1, turnSpeed * elapsed);

        fireTimer += elapsed;
        if (fireTimer >= currentFireInterval) {
          fireTimer = 0;
          if (onShoot) {
            onShoot({
              x: result.getMuzzleX(),
              y: result.getMuzzleY(),
              angle: currentAngle,
              focus: result.getFocus(),
              spread,
            });
          }
        }
      } else {
        fireTimer = Math.min(fireTimer, currentFireInterval);
        if (hadTarget && onTargetLost) onTargetLost(result);
      }

      if (visible) drawTurret(ctx);
    },
  };
  return result;
};
