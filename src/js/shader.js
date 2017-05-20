var shell = require('gl-now')()
var laserApi = require('./LaserApi').default
var createTexture = require("gl-texture2d")
var createShader = require('gl-shader')
var shader, buffer
var tex
var initialised = false
const init = function () {
    console.log('Initialising shader')
    initialised = true
    var gl = shell.gl

    //Create shader
    shader = createShader(gl,
        'attribute vec3 position;\
        varying vec2 uv;\
        void main() {\
          gl_Position = vec4(position, 1.0);\
          uv = position.xy;\
        }',
        'precision highp float;\
        uniform float t;\
        uniform sampler2D texture; \
        varying vec2 uv;\
        void main() {\
        \
          gl_FragColor = vec4(uv.x*t,uv.y,0,1);\
          gl_FragColor = texture2D(texture, vec2(uv.x,uv.y)); \
        }')

    //Create vertex buffer
    buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        // use 2 triangles to render a quad
        -1, 0, 0,
        1, 0, 0,
        -1, 1, 0,

        1, 1, 0,
        1, 0, 0,
        -1, 1, 0,

    ]), gl.STATIC_DRAW)

    tex = createTexture(gl, document.getElementById('video'))
    console.log('texture is ', tex)
}
shell.on('gl-render', function (t) {
    if (!initialised) {
        return
    }
    var gl = shell.gl

    //Bind shader
    shader.bind()

    //Set attributes
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    shader.attributes.position.pointer()

    //Set uniforms
    shader.uniforms.t += 0.01
    shader.uniforms.texture = tex.bind()

    //Draw
    gl.drawArrays(gl.TRIANGLES, 0, 6)
})

export default{

    start: init

}
