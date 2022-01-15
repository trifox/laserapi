var shell = require("gl-now")();
var laserApi = require("./LaserApi").default;
var laserApiConfig = require("./laserApiConfig").default;
var createTexture = require("gl-texture2d");
var createShader = require("gl-shader");
var shader, buffer, textureCoordBuffer;
var tex;
var initialised = false;
const init = function () {
  //  console.log('Initialising shader')
  if (initialised) {
    return;
  }
  var gl = shell.gl;

  //Create shader
  shader = createShader(
    gl,
    "\
        attribute vec4 position;\
        varying vec2 uv;\
        void main() {\
          gl_Position = vec4(position.xy,0, 1.0);\
          uv = position.zw;\
        }",
    "precision highp float;\
        uniform float t;\
        uniform sampler2D texture; \
        varying vec2 uv;\
        void main() {\
        \
          gl_FragColor = vec4(uv.x*t,uv.y,0,1);\
          gl_FragColor = texture2D(texture,mod(uv,1.0)); \
        }"
  );

  console.log("Shader is ", shader);
  console.log("laserApiConfig is ", laserApiConfig);

  //Create vertex buffer
  buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([
      // use 2 triangles to render a quad
      -1,
      0,
      laserApiConfig.transform.topleft.x,
      laserApiConfig.transform.topleft.y,
      1,
      0,
      laserApiConfig.transform.topright.x,
      laserApiConfig.transform.topright.y,
      -1,
      1,
      laserApiConfig.transform.bottomleft.x,
      laserApiConfig.transform.bottomleft.y,

      1,
      1,
      laserApiConfig.transform.bottomright.x,
      laserApiConfig.transform.bottomright.y,
      1,
      0,
      laserApiConfig.transform.topright.x,
      laserApiConfig.transform.topright.y,
      -1,
      1,
      laserApiConfig.transform.bottomleft.x,
      laserApiConfig.transform.bottomleft.y,
    ]),
    gl.STATIC_DRAW
  );
  tex = createTexture(gl, document.getElementById("video"));

  console.log("texture is ", tex);

  initialised = true;
};
shell.on("gl-render", function (t) {
  if (!initialised) {
    return;
  }
  var gl = shell.gl;

  //Bind shader
  shader.bind();

  //Set attributes
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  shader.attributes.position.pointer();

  //Set uniforms
  shader.uniforms.t += 0.01;
  shader.uniforms.texture = tex.bind();

  //Draw
  gl.drawArrays(gl.TRIANGLES, 0, 6);
});

export default {
  start: init,
};
