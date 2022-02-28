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


vec3 getView( in vec2 fragCoord ) {
 
    // uv in clip space -0.5 to 0.5 in x, same in y but different limits

    float aspect = uResolution.x / uResolution.y;
    vec2 uv = fragCoord / uResolution.x - vec2( 0.5, 0.5 / aspect );
    
    // generate the view ray

    vec3 forward = normalize( uViewDir );
    vec3 right   = cross( forward, Y );
    vec3 up      = cross( right, forward );

    return normalize( forward*0.5 + uv.x * right + uv.y * up );
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

    float densityFalloff = 7.;

    float heightAboveSurface = length( point ) - WORLD_RADIUS;
    float scaledHeight = heightAboveSurface / ( ATM_RADIUS - WORLD_RADIUS );

    float localDensity = exp( - scaledHeight * densityFalloff ) * ( 1. - scaledHeight );
    
    return localDensity;
}

float opticalDepth( in vec3 rayOrigin, in vec3 rayDir, in float rayLength ) {

    vec3 densitySamplePoint = rayOrigin;
    float stepSize = rayLength / (N_STEPS - 1.);
    float opticalDepth = 0.;

    for( int i=0; i<int(N_STEPS); ++i ) {

        float localDensity = densityAtPoint( densitySamplePoint );
        opticalDepth += localDensity * stepSize;
        densitySamplePoint += rayDir * stepSize;
    }

    return opticalDepth;
}

float calculateLight( in vec3 viewPos, in vec3 viewDir, in float viewLength ) {
    
    vec3 inScatterPoint = viewPos;
    float stepSize = viewLength / (N_STEPS - 1.);
    float inScatteredLight = 0.;

    for( int i=0; i<int(N_STEPS); ++i ) {
        
        float sunRayLength = intersectAtm( inScatterPoint, uSunDir ).y;
        float sunRayOpticalDepth = opticalDepth( inScatterPoint, uSunDir, sunRayLength );
        float viewRayOpticalDepth = opticalDepth( inScatterPoint, -viewDir, stepSize * float(i) );

        float transmittance = exp( -sunRayOpticalDepth - viewRayOpticalDepth );
       
        float localDensity = densityAtPoint( inScatterPoint );

        inScatteredLight += localDensity * transmittance * stepSize;
        inScatterPoint += viewDir * stepSize;
    }

    return inScatteredLight;
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
        float light = calculateLight( pointInAtm, view, distThroughAtm + 1e-4 );

        colour = vec3( light );
    }
    
    fragColor = vec4( colour, 1.0 );
}


void main() {

    mainImage( gl_FragColor, gl_FragCoord.xy );
}


// ====================================================================================

`;

