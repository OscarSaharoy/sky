// Oscar Saharoy 2021


const fragmentShader = `

// ====================================================================================


uniform float iTime;
uniform vec2 iResolution;


void mainImage( out vec4 fragColor, in vec2 fragCoord ) {

    // Normalized pixel coordinates (from 0 to 1)
    float aspect = iResolution.x / iResolution.y;
    vec2 uv = fragCoord / iResolution.x - vec2( 0.5, 0.5 / aspect );
    
    vec3 colour = uv.xyx;
    fragColor = vec4( colour, 1.0 );
}


void main() {

    mainImage( gl_FragColor, gl_FragCoord.xy );
}


// ====================================================================================

`;

