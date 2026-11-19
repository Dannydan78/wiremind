import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
	60,
	innerWidth / innerHeight,
	0.1,
	100,
);
camera.position.set(0, 4, 8);
new OrbitControls(camera, renderer.domElement);

const cube = new THREE.Mesh(
	new THREE.BoxGeometry(),
	new THREE.MeshNormalMaterial(),
);
scene.add(cube);

addEventListener("resize", () => {
	camera.aspect = innerWidth / innerHeight;
	camera.updateProjectionMatrix();
	renderer.setSize(innerWidth, innerHeight);
});

renderer.setAnimationLoop(() => {
	cube.rotation.y += 0.01;
	renderer.render(scene, camera);
});
