// Wandelt ein Spiel samt aller (relativen) Abhängigkeiten in Browser-ES-Module um.
// Aufruf: node build.mjs <repoRoot> <spieldatei> <ausgabeOrdner>
// Ausgabe (stdout): URL-Pfad des umgewandelten Spielmoduls, z. B. /src/setups/game-044-x.js
//
// - import/require relativer Dateien  -> ES-Import mit .js-Endung (rekursiv umgewandelt)
// - Medien (Bilder, Sounds, ...)      -> URL-String unter /__repo/... (Symlink auf das Repo)
// - npm-Pakete (gpu.js, p2, tone ...) -> window.__stub (tiefer No-op-Proxy)
// - MasterCanvas.js                   -> Stub mit dem Canvas der Testseite
import fs from 'fs';
import path from 'path';

const [repo, gameFile, outDir] = process.argv.slice(2).map((p) => path.resolve(p));
const SRC = path.join(repo, 'src', 'js');
const MEDIA = /\.(png|jpe?g|gif|svg|webp|bmp|wav|ogg|mp3|m4a|webm|mp4|ttf|otf|woff2?|txt|mid|midi)$/i;
const done = new Map();

function outPathFor(abs) {
  const rel = path.relative(SRC, abs).replace(/\.js$/, '') + '.js';
  return path.join(outDir, 'src', rel);
}

function resolveSpec(fromFile, spec) {
  if (!spec.startsWith('.')) return { bare: true };
  const base = path.resolve(path.dirname(fromFile), spec);
  if (MEDIA.test(spec)) return { media: base };
  if (/\.json$/i.test(spec) && fs.existsSync(base)) return { json: base };
  for (const c of [base, base + '.js', path.join(base, 'index.js')]) {
    if (fs.existsSync(c) && fs.statSync(c).isFile()) return { file: c };
  }
  return { missing: base };
}

function relSpec(fromOut, toOut) {
  let r = path.relative(path.dirname(fromOut), toOut).split(path.sep).join('/');
  if (!r.startsWith('.')) r = './' + r;
  return r;
}

function mediaUrl(abs) {
  return '/__repo/' + path.relative(repo, abs).split(path.sep).join('/');
}

/** "X" | "{ a, b as c }" | "X, { a }" | "* as X"  ->  const-Deklarationen mit Wert expr */
function declare(clause, expr) {
  const c = clause.trim();
  const ns = c.match(/^\*\s+as\s+([\w$]+)$/);
  if (ns) return `var ${ns[1]} = ${expr};`;
  const braces = c.match(/\{([\s\S]*)\}/);
  const def = c.replace(/\{[\s\S]*\}/, '').replace(/,/g, '').trim();
  const parts = [];
  // var statt const: alte Spiele importieren manches doppelt (Webpack verzeiht das)
  if (def) parts.push(`var ${def} = ${expr};`);
  if (braces) parts.push(`var { ${braces[1].replace(/\s+as\s+/g, ': ')} } = ${expr};`);
  return parts.join(' ');
}

function writeOut(out, code) {
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, code);
}

function convert(abs) {
  if (done.has(abs)) return done.get(abs);
  const out = outPathFor(abs);
  done.set(abs, out);

  if (path.resolve(abs) === path.join(SRC, 'MasterCanvas.js')) {
    writeOut(
      out,
      `const c = document.getElementById('c');
const base = { getCanvas: () => c, get2dContext: () => c.getContext('2d'), init() {}, clear() {}, showC64() {} };
export default new Proxy(base, { get: (t, k) => (k in t ? t[k] : () => {}) });
`
    );
    return out;
  }

  let code = fs.readFileSync(abs, 'utf8');
  const header = [];
  let n = 0;

  // import <clause> from 'spec';
  code = code.replace(/^[ \t]*import\s+([\w$*{][\s\S]*?)\s+from\s+['"]([^'"]+)['"];?/gm, (m, clause, spec) => {
    const r = resolveSpec(abs, spec);
    if (r.media) return declare(clause, JSON.stringify(mediaUrl(r.media)));
    if (r.json) return declare(clause, fs.readFileSync(r.json, 'utf8').trim());
    if (r.file) {
      const target = relSpec(out, convert(r.file));
      // Default-Import aus einer Datei ohne Default-Export: wie Webpack den Namensraum liefern
      const hasDefault = /export\s+default|module\.exports/.test(fs.readFileSync(r.file, 'utf8'));
      const def = clause.replace(/\{[\s\S]*\}/, '').replace(/,/g, '').trim();
      if (!hasDefault && def && !def.startsWith('*')) {
        const id = `__ns${n++}`;
        header.push(`import * as ${id} from '${target}';`);
        return declare(clause, id);
      }
      return `import ${clause} from '${target}';`;
    }
    if (r.missing) console.error(`WARNUNG: ${spec} aus ${path.relative(repo, abs)} nicht gefunden – Stub`);
    return declare(clause, 'window.__stub');
  });

  // import 'spec';
  code = code.replace(/^[ \t]*import\s+['"]([^'"]+)['"];?/gm, (m, spec) => {
    const r = resolveSpec(abs, spec);
    return r.file ? `import '${relSpec(out, convert(r.file))}';` : '';
  });

  // require('spec')(.default)
  code = code.replace(/require\(\s*['"]([^'"]+)['"]\s*\)(\.default)?/g, (m, spec, dflt) => {
    const r = resolveSpec(abs, spec);
    if (r.media) return JSON.stringify(mediaUrl(r.media));
    if (r.json) return `(${fs.readFileSync(r.json, 'utf8').trim()})`;
    if (!r.file) {
      if (r.missing) console.error(`WARNUNG: ${spec} aus ${path.relative(repo, abs)} nicht gefunden – Stub`);
      return 'window.__stub';
    }
    const id = `__req${n++}`;
    header.push(`import * as ${id} from '${relSpec(out, convert(r.file))}';`);
    return dflt ? `${id}.default` : `(${id}.default !== undefined ? ${id}.default : ${id})`;
  });

  // CommonJS-Reste neutralisieren
  if (/module\.exports/.test(code) && !/export\s+default/.test(code)) {
    code = 'const module = { exports: {} };\n' + code + '\nexport default module.exports;\n';
  }

  writeOut(out, header.join('\n') + '\n' + code);
  return out;
}

const gameOut = convert(path.resolve(gameFile));
process.stdout.write('/' + path.relative(outDir, gameOut).split(path.sep).join('/') + '\n');
