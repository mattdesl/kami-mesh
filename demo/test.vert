attribute vec4 Position;
attribute vec4 Color;
attribute vec2 TexCoord0;
attribute vec3 Normal;

uniform mat4 u_projModelView;
uniform float time;

varying vec4 v_col;
varying vec2 v_tex0;

uniform mat3 rot;

void main() {
	//animated particle on GPU !
	vec2 pos = vec2(Position.xy);
	vec2 dir = pos - Normal.xy;

	pos.x += dir.x * sin(time) * 0.25;
	pos.y -= dir.y * sin(time*0.5) * 0.25;


	vec3 rotated = rot * vec3(pos.xy, 0.0);

	gl_Position = u_projModelView * vec4(rotated.xyz, 1.0);

	v_col = Color;
	v_tex0 = TexCoord0;
}