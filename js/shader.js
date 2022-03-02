// Oscar Saharoy 2021


const fragmentShader = `

// ====================================================================================


uniform float uTime;
uniform vec2  uResolution;
uniform vec3  uViewPos;
uniform vec3  uViewDir;
uniform vec3  uSunDir;


#define WORLD_RADIUS 100.0
#define ATM_RADIUS 120.0
#define N_STEPS 10.
#define X vec3( 1., 0., 0. )
#define Y vec3( 0., 1., 0. )
#define Z vec3( 0., 0., 1. )
#define SCATTERING 0.2
#define DENSITY_FALLOFF 7.
#define WAVELENGTHS vec3( 400. / 700., 400. / 530., 400. / 440. ) 


vec3 saturate( in vec3 colour ) {
    
    return clamp( colour, vec3(0.), vec3(1.) );
}

mat4 rotationMatrix(vec3 axis, float angle) {

    axis = normalize(axis);
    float s = sin(angle);
    float c = cos(angle);
    float oc = 1.0 - c;
    
    return mat4(oc * axis.x * axis.x + c,           oc * axis.x * axis.y - axis.z * s,  oc * axis.z * axis.x + axis.y * s,  0.0,
                oc * axis.x * axis.y + axis.z * s,  oc * axis.y * axis.y + c,           oc * axis.y * axis.z - axis.x * s,  0.0,
                oc * axis.z * axis.x - axis.y * s,  oc * axis.y * axis.z + axis.x * s,  oc * axis.z * axis.z + c,           0.0,
                0.0,                                0.0,                                0.0,                                1.0);
}

vec3 getView( in vec2 fragCoord ) {
 
    // uv in clip space -0.5 to 0.5 in x, same in y but different limits

    float aspect = uResolution.x / uResolution.y;
    vec2 uv = fragCoord / uResolution.x - vec2( 0.5, 0.5 / aspect );
    
    // generate the view ray

    vec3 forward = normalize( uViewDir );
    //vec3 right   = cross( forward, normalize( uViewPos ) );
    vec3 right   = normalize( cross( forward, Y ) );
    vec3 up      = normalize( cross( right, forward ) );
    
    float r = 0.5;
    float tanX = mix( tan( uv.x / r ), uv.x / r, 0.9 );
    float tanY = mix( tan( uv.y / r ), uv.y / r, 0.9 );

    return normalize( r * forward + r * tanX * right + r * tanY * up );
}


vec2 intersectWorld( in vec3 viewPos, in vec3 viewDir ) {

    float b = 2. * dot( viewPos, viewDir );
    float c = dot( viewPos, viewPos ) - WORLD_RADIUS * WORLD_RADIUS;

    float d = b*b - 4.*c;

    if( d < 0. ) return vec2( -1., 0. );

    float s = sqrt( d );

    float nearHit = max( 0., -( b + s) / 2. );
    float farHit  = -( b - s) / 2.;

    if( farHit < 0. ) return vec2( -1., 0. );

    return vec2( nearHit, farHit - nearHit );
}

vec2 intersectAtm( in vec3 viewPos, in vec3 viewDir ) {

    float b = 2. * dot( viewPos, viewDir );
    float c = dot( viewPos, viewPos ) - ATM_RADIUS * ATM_RADIUS;

    float d = b*b - 4.*c;

    if( d < 0. ) return vec2( -1., 0. );

    float s = sqrt( d );

    float nearHit = max( 0., -( b + s) / 2. );
    float farHit  = -( b - s) / 2.;

    if( farHit < 0. ) return vec2( -1., 0. );

    return vec2( nearHit, farHit - nearHit );
}

float densityAtPoint( in vec3 point ) {

    float heightAboveSurface = length( point ) - WORLD_RADIUS;
    float scaledHeight = heightAboveSurface / ( ATM_RADIUS - WORLD_RADIUS );

    float localDensity = exp( - scaledHeight * DENSITY_FALLOFF );
    
    return localDensity;
}

float opticalDepth( in vec3 rayOrigin, in vec3 rayDir ) {

    float height = length( rayOrigin );
    float cos = dot( rayOrigin, rayDir ) / height;

    float scale = exp( 1.07 + 2.1 * exp( -1.9*cos ) + 0.07 / (cos+0.66) / (cos+0.66) );

    return exp( -0.35 * ( height - WORLD_RADIUS ) ) * scale;
}


vec3 calculateLight( in vec3 viewPos, in vec3 viewDir, in float viewLength ) {
    
    vec3 inScatterPoint = viewPos;
    float stepSize = viewLength / (N_STEPS - 1.);
    vec3 inScatteredLight = vec3( 0. );
    vec3 scatterCoefficients = pow( WAVELENGTHS, vec3(4.) ) * SCATTERING;
    
    bool inAtm = intersectAtm( viewPos, viewDir ).x == 0.;
    bool hitWorld = intersectWorld( viewPos, viewDir ).x != -1.;

    for( int i=0; i<int(N_STEPS); ++i ) {
        
        float sunRayOpticalDepth = opticalDepth( inScatterPoint, uSunDir );
        float viewRayOpticalDepth = inAtm && !hitWorld
            ? opticalDepth( viewPos, viewDir ) - opticalDepth( inScatterPoint, viewDir )
            : opticalDepth( inScatterPoint, -viewDir ) - opticalDepth( viewPos, -viewDir ); 
            
        vec3 transmittance = exp( -( sunRayOpticalDepth + viewRayOpticalDepth) * scatterCoefficients );
       
        float localDensity = densityAtPoint( inScatterPoint );

        inScatteredLight += localDensity * transmittance * scatterCoefficients * stepSize;
        inScatterPoint += viewDir * stepSize;
    }
    
    return inScatteredLight;
}


vec3 worldLight( in vec3 viewPos, in vec3 viewDir ) {

    float distToWorld = intersectWorld( viewPos, viewDir ).x;

    if( distToWorld == -1. ) return vec3( 0. );

    vec3 worldPos = viewPos + distToWorld * viewDir;
    vec3 normal   = normalize( worldPos );

    vec3 scatterCoefficients = pow( WAVELENGTHS, vec3(4.) ) * SCATTERING;
    float diffuse = dot( normal, uSunDir );
    float opticalDepth = opticalDepth( worldPos, -viewDir ) - opticalDepth( viewPos, -viewDir );

    return vec3( 0.15, 0.28, 0.5 ) * diffuse * exp( -opticalDepth * SCATTERING );
}


vec3 hash3( vec3 p ) {
    vec3 q = vec3( dot(p,vec3(127.1,311.7,432.2)), 
                   dot(p,vec3(269.5,183.3,847.6)), 
                   dot(p,vec3(419.2,371.9,927.0)) );
    return fract(sin(q)*43758.5453);
}


vec3 starLight( in vec3 viewPos, in vec3 viewDir, in vec3 preColour ) {

    if( length(preColour) > 0. ) return vec3( 0. );

    vec3 offset = hash3( floor(viewDir*10.) );

    return saturate( vec3( 1.02 - 20.*length( mod( viewDir, vec3(0.1) ) * 10. - offset * 0.5 ) ) );
}

void mainImage( out vec4 fragColor, in vec2 fragCoord ) {
    
    vec3 view = getView( fragCoord );

    float distToWorld = intersectWorld( uViewPos, view ).x;

    vec2 atmHit = intersectAtm( uViewPos, view );
    float distToAtm = atmHit.x;
    float distThroughAtm = distToWorld == -1. ? atmHit.y : distToWorld - distToAtm;

    vec3 colour = vec3( 0. );

    if( distThroughAtm > 0. ) {
         
        vec3 pointInAtm = uViewPos + view * (distToAtm - 1e-4);
        colour = calculateLight( pointInAtm, view, distThroughAtm + 1e-4 );
    }
   
    colour += worldLight( uViewPos, view );
    colour += starLight( uViewPos, view, colour );
    //colour += sunLight( view );

    fragColor = vec4( colour, 1.0 );
}


void main() {

    mainImage( gl_FragColor, gl_FragCoord.xy );
}


// ====================================================================================

`;

