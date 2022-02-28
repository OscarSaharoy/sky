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

vec3 worldNormal( in vec3 viewPos, in vec3 viewDir ) {

    float distToWorld = intersectWorld( viewPos, viewDir ).x;

    if( distToWorld == -1. ) return vec3( 0. );

    vec3 worldPos = viewPos + distToWorld * viewDir;
    
    return normalize( worldPos );
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

vec3 worldLight( in vec3 viewPos, in vec3 viewDir ) {
    
    vec3 normal = worldNormal( viewPos, viewDir );
    float diffuse = dot( normal, uSunDir );

    return vec3( diffuse );
}

float densityAtPoint( in vec3 point ) {

    float heightAboveSurface = length( point ) - WORLD_RADIUS;
    float scaledHeight = heightAboveSurface / ( ATM_RADIUS - WORLD_RADIUS );

    float localDensity = exp( - scaledHeight * DENSITY_FALLOFF );
    
    return localDensity;
}

float opticalDepth( in vec3 rayOrigin, in vec3 rayDir, in float rayLength ) {

    float height = length( rayOrigin );
    float cos = dot( rayOrigin, rayDir ) / height;

    float scale = exp( 1.07 + 2.1 * exp( -1.9*cos ) + 0.07 / (cos+0.66) / (cos+0.66) );

    return exp( -0.35 * ( height - WORLD_RADIUS ) ) * scale;

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

vec3 calculateLight( in vec3 viewPos, in vec3 viewDir, in float viewLength ) {
    
    vec3 inScatterPoint = viewPos;
    float stepSize = viewLength / (N_STEPS - 1.);
    vec3 inScatteredLight = vec3( 0. );
    vec3 scatterCoefficients = pow( WAVELENGTHS, vec3(4.) ) * SCATTERING;

    for( int i=0; i<int(N_STEPS); ++i ) {
        
        float sunRayLength = intersectAtm( inScatterPoint, uSunDir ).y;
        float sunRayOpticalDepth = opticalDepth( inScatterPoint, uSunDir, sunRayLength );
        float viewRayOpticalDepth = opticalDepth( inScatterPoint, -viewDir, stepSize * float(i) );

        vec3 transmittance = exp( -( sunRayOpticalDepth + viewRayOpticalDepth) * scatterCoefficients );
       
        float localDensity = densityAtPoint( inScatterPoint );

        inScatteredLight += localDensity * transmittance * scatterCoefficients * stepSize;
        inScatterPoint += viewDir * stepSize;
    }

    return inScatteredLight;
}



#define StarsNum 32.    //number of stars
#define StarsSize 0.025 //size of stars
#define StarsBright 2.0 //Bright of stars

vec2 rand2(vec2 p) {
        
    p = vec2(dot(p, vec2(12.9898,78.233)), dot(p, vec2(26.65125, 83.054543))); 
    return fract(sin(p) * 43758.5453);
}

float rand(vec3 p) {

    return fract(sin(dot(p, vec3(54.90898,18.233,37.42537))) * 4337.5453);
}

float starLight( in vec3 viewDir ) {
   
    return rand( viewDir );

    float numCells = StarsNum;
    float size = 1.;
    float br = 1.;
    vec2 x = vec2(0);

    vec2 n = x * numCells;
    vec2 f = floor(n);

    float d = 1.0e10;
    for (int i = -1; i <= 1; ++i) {

        for (int j = -1; j <= 1; ++j) {
            
            //vec2 g = f + vec2(float(i), float(j));
            //g = n - g - rand2(mod(g, numCells)) + rand(g);
                                            
            // Control size
            //g *= 1. / (numCells * size);
            //d = min(d, dot(g, g));
        }
    }
                                
    return br * (smoothstep(.95, 1., (1. - sqrt(d))));
}


vec3 sunLight( in vec3 viewDir ) {
    
    float brightness = pow( dot( viewDir, uSunDir ), 25.0 ) + clamp( dot( viewDir, uSunDir )*200.0-199., 0., 1. );

    return saturate( vec3(brightness) );
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
   
    colour += worldLight( uViewPos, view ) * vec3( 0.6, 0.8, 0.9 ) * 0.2;
    //colour += starLight( view );
    //colour += sunLight( view );

    fragColor = vec4( colour, 1.0 );
}


void main() {

    mainImage( gl_FragColor, gl_FragCoord.xy );
}


// ====================================================================================

`;

