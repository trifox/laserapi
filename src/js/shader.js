var shell = require('gl-now')()
var laserApi = require('./LaserApi').default
var createShader = require('gl-shader')
var shader, buffer

shell.on('gl-init', function () {
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
})

shell.on('gl-render', function (t) {
    var gl = shell.gl

    //Bind shader
    shader.bind()

    //Set attributes
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    shader.attributes.position.pointer()

    //Set uniforms
    shader.uniforms.t += 0.01

    //Draw
    gl.drawArrays(gl.TRIANGLES, 0, 6)
})
