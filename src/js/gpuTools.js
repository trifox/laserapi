export default {
  hsv2rgb: function hsv2rgb(hIn, s, v) {
    var h = hIn % 1;
    /**
     * input is 0..1 h,s,v
     */
    var r = 0,
      g = 0,
      b = 0;
    var i = Math.floor(h * 6);
    var f = h * 6 - i;
    var p = v * (1 - s);
    var q = v * (1 - f * s);
    var t = v * (1 - (1 - f) * s);
    if (i % 6 == 0) {
      r = v;
      g = t;
      b = p;
    } else if (i % 6 == 1) {
      r = q;
      g = v;
      b = p;
    } else if (i % 6 == 2) {
      r = p;
      g = v;
      b = t;
    } else if (i % 6 == 3) {
      r = p;
      g = q;
      b = v;
    } else if (i % 6 == 4) {
      r = t;
      g = p;
      b = v;
    } else if (i % 6 == 5) {
      r = v;
      g = p;
      b = q;
    }

    //   case 1:
    //
    //     break;
    //   case 2:
    //     break;
    //   case 3:
    //     break
    //     break;
    //   case 4:
    //
    //     break;
    //   case 5:
    //     (r = v), (g = p), (b = q);
    //     break;
    // }
    return [r, g, b];
  },
  rgb2hsv: function rgb2hsv(r, g, b) {
    // expects rgb in normalised 0..1 range rather than 0..255
    let rr = 0,
      gg = 0,
      bb = 0,
      h = 0,
      s = 0;
    let v = Math.max(r, g);
    v = Math.max(v, b);

    let minv = Math.min(r, g);
    minv = Math.min(minv, b);
    let diff = v - minv;

    function diffc(c, v, diff) {
      return (v - c) / 6 / diff + 1 / 2;
    }

    if (diff == 0) {
      h = s = 0;
    } else {
      s = diff / v;
      rr = diffc(r, v, diff);
      gg = diffc(g, v, diff);
      bb = diffc(b, v, diff);

      if (r === v) {
        h = bb - gg;
      } else if (g === v) {
        h = 1 / 3 + rr - bb;
      } else if (b === v) {
        h = 2 / 3 + gg - rr;
      }

      if (h < 0) {
        h += 1;
      } else if (h > 1) {
        h -= 1;
      }
    }

    return [Math.round(h * 360), Math.round(s * 100), Math.round(v * 100)];
  },
};
