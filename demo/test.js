var MeshRenderer = require('kami-mesh').MeshRenderer;
var domready = require('domready');

var WebGLContext = require('kami').WebGLContext;
var ShaderProgram = require('kami').ShaderProgram;

var SpriteBatch = require('kami').SpriteBatch;
var Texture = require('kami').Texture;

var Matrix4 = require('vecmath').Matrix4;
var OrthographicCamera = require('cam3d').OrthographicCamera;
var PerspectiveCamera = require('cam3d').PerspectiveCamera;

var Vector3 = require('vecmath').Vector3;
var Matrix3 = require('vecmath').Matrix3;

var fs = require('fs');

var vert = fs.readFileSync( __dirname + '/test.vert' );
var frag = fs.readFileSync( __dirname + '/test.frag' );


domready(function() {
    var context = new WebGLContext(500, 500);
    document.body.appendChild(context.view);
    
    var r = new MeshRenderer(context, {
        hasColors: true,
        maxVertices: 250,
        hasNormals: true,
        numTexCoords: 1
    });

    var cam = new OrthographicCamera(context.width, context.height);
    // cam.setToOrtho(false, context.width, context.height);

    var tex = new Texture(context, "img/grass.png");
    tex.setWrap(Texture.Wrap.REPEAT);

    requestAnimationFrame(render);
    
    var time = 0;

    var shader = new ShaderProgram(context, vert, frag);
    if (shader.log)
        console.warn(shader.log)

    var rot = new Matrix3();


    function render() {
        requestAnimationFrame(render);
        var gl = context.gl;

        time += 0.1;

        gl.clearColor(0.5,0.5,0.5,1);
        gl.clear(gl.COLOR_BUFFER_BIT);

        r.shader = shader;
        r.begin(cam.combined, gl.TRIANGLES);

        rot.rotate( 0.01 );
        shader.setUniformMatrix3("rot", rot);
        shader.setUniformf("time", time);
        
        r.color(0.0,0.0,1,0.5);
        r.normal(0, 0, 0);
        r.texCoord(1, 1);
        r.vertex(0.0, 0.0, 0);

        r.color(1,0,0,1);
        r.normal(0, 0, 0);
        r.texCoord(1, 0);
        r.vertex(0.0, 32, 0);

        r.color(0,1,0,1);
        r.normal(0, 0, 0);
        r.texCoord(0, 0);
        r.vertex(32, 32, 0);

        r.end();
    }
        
});