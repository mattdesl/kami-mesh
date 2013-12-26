var Class = require('klasse');
var Mesh = require('kami').Mesh;
var ShaderProgram = require('kami').ShaderProgram;

var Matrix4 = require('vecmath').Matrix4;
var colorToFloat = require('number-util').colorToFloat;

/**
 * An immediate mode mesh renderer, mostly straight from LibGDX:
 * https://github.com/libgdx/libgdx/blob/master/gdx/src/com/badlogic/gdx/graphics/glutils/ImmediateModeRenderer20.java
 * 
 * This is mainly useful for prototyping.
 *
 * The options and their defaults:
 *
 * @class  MeshRenderer
 * @constructor
 * @param {WebGLContext} context the WebGLContext for management
 * @param {Object} options the optional set of options
 * @param {Boolean} options.hasNormals whether the renderer should write normals; default false
 * @param {Boolean} options.hasColors whether the renderer should write colors; default false
 * @param {Number} options.numTexCoords the number of texture coordinates to write. defaults to zero (no texcoords)
 * @param {Number} options.maxVertices the maximum number of vertices for this renderer, default 500
 */
var MeshRenderer = new Class({

    initialize: function(context, options) {
        this.context = context;
        if (!context)
            throw new Error("no WebGLContext specified to MeshRenderer");

        options = options || {};

        var hasNormals = typeof options.hasNormals !== "undefined" ? options.hasNormals : false;
        var hasColors = typeof options.hasColors !== "undefined" ? options.hasColors : false;
        this.numTexCoords = options.numTexCoords || 0;
        this.maxVertices = typeof options.maxVertices === "number" ? options.maxVertices : 500;

        var attribs = this._createVertexAttributes(hasNormals, hasColors);
        this.mesh = new Mesh(context, false, this.maxVertices, 0, attribs);

        //offset in FLOATS from start of vertex
        this.normalOffset = hasNormals ? 3 : 0;
        this.colorOffset = hasColors ? (this.normalOffset + 3) : 0;
        this.texCoordOffset = this.numTexCoords > 0 ? (this.normalOffset + this.colorOffset + 1) : 0;

        this.numSetTexCoords = 0;
        this.vertices = this.mesh.vertices;
        this.vertexSize = this.mesh.vertexStride / 4;

        this.primitiveType = context.gl.TRIANGLES;

        this.premultiplied = true;
        this.vertexIdx = 0;
        this.numVertices = 0;


        //////// TODO: use BaseBatch as a mixin ? or another mixin?

        this.projModelView = new Matrix4();
        this._shader = MeshRenderer.createDefaultShader(context, hasNormals, hasColors, this.numTexCoords);


        /**
         * This shader will be used whenever "null" is passed
         * as the renderer's shader. 
         *
         * @property {ShaderProgram} shader
         */
        this.defaultShader = this._shader;

        /**
         * By default, a MeshRenderer is created with its own ShaderProgram,
         * stored in `defaultShader`. If this flag is true, on deleting the MeshRenderer, its
         * `defaultShader` will also be deleted. If this flag is false, no shaders
         * will be deleted on destroy.
         *
         * Note that if you re-assign `defaultShader`, you will need to dispose the previous
         * default shader yoursel. 
         *
         * @property ownsShader
         * @type {Boolean}
         */
        this.ownsShader = true;
    },


    destroy: function() {
        if (this.ownsShader && this.defaultShader)
            this.defaultShader.destroy();
        if (this.mesh)
            this.mesh.destroy();

        this.defaultShader = null;
        this._shader = null;
        this.mesh = null;
        this.context = null;
    },

    /**
     * This is a setter/getter for this renderer's current ShaderProgram.
     * 
     * If `null` or a falsy value is specified, the batch's `defaultShader` will be used. 
     *
     * Note that shaders are bound on renderer.begin().
     *
     * @property shader
     * @type {ShaderProgram}
     */
    shader: {
        set: function(val) {

            this._shader = val ? val : this.defaultShader;

            if (this.drawing) {
                this._shader.bind();
                this.uploadMatrices();
            }
        },

        get: function() {
            return this._shader;
        }
    },

    _createVertexAttributes: function(hasNormals, hasColors) {
        var gl = this.context.gl;
        var attribs = [
            new Mesh.Attrib(ShaderProgram.POSITION_ATTRIBUTE, 3)
        ];

        if (hasNormals)
            attribs.push( new Mesh.Attrib(ShaderProgram.NORMAL_ATTRIBUTE, 3) );
        if (hasColors)
            attribs.push( new Mesh.Attrib(ShaderProgram.COLOR_ATTRIBUTE, 4, null, gl.UNSIGNED_BYTE, true, 1) );

        for (var i = 0; i < this.numTexCoords; i++) {
            attribs.push( new Mesh.Attrib(ShaderProgram.TEXCOORD_ATTRIBUTE+i, 2) );
        }

        return attribs;
    },

    begin: function(projModelView, primitiveType) {
        if (this.drawing) 
            throw "batch.end() must be called before begin";
        this.drawing = true;

        if (projModelView)
            this.projModelView.set(projModelView);
        this.primitiveType = typeof primitiveType === "undefined" ? this.context.gl.TRIANGLES : primitiveType;

        var shader = this._shader;
        shader.bind();
        this.uploadMatrices();
    },

    uploadMatrices: function() {
        var shader = this._shader;
        shader.setUniformMatrix4("u_projModelView", this.projModelView);
        for (var i=0; i<this.numTexCoords; i++) {
            shader.setUniformi("u_sampler"+i, i);
        }
    },

    color: function(r, g, b, a) {
        var rnum = typeof r === "number";
        if (rnum
                && typeof g === "number"
                && typeof b === "number") {
            //default alpha to one 
            a = (a || a === 0) ? a : 1.0;
        } else {
            r = g = b = a = rnum ? r : 1.0;
        }
        

        if (this.premultiplied) {
            r *= a;
            g *= a;
            b *= a;
        }
        
        var color = colorToFloat(
            ~~(r * 255),
            ~~(g * 255),
            ~~(b * 255),
            ~~(a * 255)
        );
        this.vertices[ this.vertexIdx + this.colorOffset ] = color;
    },

    texCoord: function(u, v) {
        var idx = this.vertexIdx + this.texCoordOffset;
        this.vertices[ idx + this.numSetTexCoords ] = u || 0;
        this.vertices[ idx + this.numSetTexCoords + 1 ] = v || 0;
        this.numSetTexCoords += 2;
    },

    normal: function(x, y, z) {
        var idx = this.vertexIdx + this.normalOffset;
        this.vertices[ idx ] = x || 0;
        this.vertices[ idx + 1 ] = y || 0;
        this.vertices[ idx + 2 ] = z || 0;
    },

    vertex: function(x, y, z) {
        var idx = this.vertexIdx;
        this.vertices[ idx ] = x || 0;
        this.vertices[ idx + 1 ] = y || 0;
        this.vertices[ idx + 2 ] = z || 0;

        this.numSetTexCoords = 0;
        this.vertexIdx += this.vertexSize;
        this.numVertices++;
    },

    end: function() {
        //TODO: allow flushing and check for size like SpriteBatch
        if (!this.drawing)
            throw "renderer.begin() must be called before end";

        this.drawing = false;
        
        if (this.numVertices === 0)
            return;

        var shader = this._shader,
            gl = this.context.gl;

        this.mesh.bind(shader);

        this.mesh.verticesDirty = true;
        this.mesh.draw(this.primitiveType, this.vertexIdx * 4 / this.mesh.vertexStride, 0, this.vertexIdx);

        this.mesh.unbind(shader);

        this.numSetTexCoords = 0;
        this.vertexIdx = 0;
        this.numVertices = 0;
    }
});

//little shader builder from LibGDX..
MeshRenderer.createDefaultShader = function(context, hasNormals, hasColors, numTexCoords) {
    var vertSrc = MeshRenderer.createVertexShader(hasNormals, hasColors, numTexCoords);
    var fragSrc = MeshRenderer.createFragmentShader(hasColors, numTexCoords);
    return new ShaderProgram(context, vertSrc, fragSrc);
};

MeshRenderer.createVertexShader = function(hasNormals, hasColors, numTexCoords) {
    numTexCoords = numTexCoords || 0;
    var shader = "";
    shader += "attribute vec4 "+ShaderProgram.POSITION_ATTRIBUTE+";\n"
         + (hasNormals ? "attribute vec3 " + ShaderProgram.NORMAL_ATTRIBUTE + ";\n" : "")
         + (hasColors ? "attribute vec4 " + ShaderProgram.COLOR_ATTRIBUTE + ";\n" : "");

    var i;

    for (i = 0; i < numTexCoords; i++) {
        shader += "attribute vec2 " + ShaderProgram.TEXCOORD_ATTRIBUTE + i + ";\n";
    }

    shader += "uniform mat4 u_projModelView;\n";
    
    shader += (hasColors ? "varying vec4 v_col;\n" : "");

    for (i = 0; i < numTexCoords; i++) {
        shader += "varying vec2 v_tex" + i + ";\n";
    }

    shader += "void main() {\n" + "   gl_Position = u_projModelView * " + ShaderProgram.POSITION_ATTRIBUTE + ";\n"
            + (hasColors ? "   v_col = " + ShaderProgram.COLOR_ATTRIBUTE + ";\n" : "");

    for (i = 0; i < numTexCoords; i++) {
        shader += "   v_tex" + i + " = " + ShaderProgram.TEXCOORD_ATTRIBUTE + i + ";\n";
    }
    shader += "   gl_PointSize = 1.0;\n";
    shader += "}\n";

    return shader;
};

MeshRenderer.createFragmentShader = function(hasColors, numTexCoords) {
    numTexCoords = numTexCoords || 0;
    var shader = "#ifdef GL_ES\n" + "precision mediump float;\n" + "#endif\n";
 
    if (hasColors) 
        shader += "varying vec4 v_col;\n";

    var i;
    for (i = 0; i < numTexCoords; i++) {
            shader += "varying vec2 v_tex" + i + ";\n";
            shader += "uniform sampler2D u_sampler" + i + ";\n";
    }

    shader += "void main() {\n" + "   gl_FragColor = " + (hasColors ? "v_col" : "vec4(1, 1, 1, 1)");

    if (numTexCoords > 0) shader += " * ";

    for (i = 0; i < numTexCoords; i++) {
            if (i == numTexCoords - 1) {
                    shader += " texture2D(u_sampler" + i + ",  v_tex" + i + ")";
            } else {
                    shader += " texture2D(u_sampler" + i + ",  v_tex" + i + ") *";
            }
    }

    shader += ";\n}";
    return shader;
};

module.exports = MeshRenderer;