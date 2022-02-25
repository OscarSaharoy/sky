// Oscar Saharoy 2022

const canvas   = document.querySelector('#c');
const renderer = new THREE.WebGLRenderer({canvas: canvas, preserveDrawingBuffer: true });
renderer.autoClearColor = false;

const camera = new THREE.OrthographicCamera(
    -1, // left
     1, // right
     1, // top
    -1, // bottom
    -1, // near,
     1, // far
);

const scene = new THREE.Scene();
const plane = new THREE.PlaneGeometry(2, 2);
const dpr   = window.devicePixelRatio;

const uniforms = {
    iTime:          { value: 0 },
    iResolution:    { value: new THREE.Vector2() },
};

const material = new THREE.ShaderMaterial({
    fragmentShader: fragmentShader,
    uniforms: uniforms,
    transparent: true,
    precision: "highp",
});

scene.add(new THREE.Mesh(plane, material));


new ResizeObserver( () => resizeRendererToDisplaySize(renderer) ).observe( canvas );

function resizeRendererToDisplaySize( renderer ) {

    const width   = canvas.clientWidth;
    const height  = canvas.clientHeight;

    renderer.setSize( width*dpr, height*dpr, false );
    uniforms.iResolution.value.set( width * dpr, height * dpr );
}

function render( time ) {

    time *= 0.001;  // convert to seconds

    renderer.render(scene, camera);
    // console.log("render");

    uniforms.iTime.value = time;

    requestAnimationFrame(render);
}


function download() {

    const link = document.createElement("a");
    
    link.href = renderer.domElement.toDataURL( "image/jpeg", 0.92 );
    link.download = "image.jpg";
    link.click();
}

document.addEventListener( "keydown", e => e.key == "d" ? download() : 0 );


requestAnimationFrame(render);
