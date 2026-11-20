/**
 * La scène three.js : rendu, caméra, contrôles, étiquettes HTML et boucle
 * d'animation. Ne connaît ni topologie ni paquets.
 */

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { CSS2DRenderer } from "three/addons/renderers/CSS2DRenderer.js";

export type Stage = {
	readonly scene: THREE.Scene;
	readonly camera: THREE.PerspectiveCamera;
	readonly canvas: HTMLCanvasElement;
	/** Lance la boucle ; `onFrame` reçoit la durée de l'image précédente. */
	readonly start: (onFrame: (frameDurationInMs: number) => void) => void;
	readonly dispose: () => void;
};

export function createStage(container: HTMLElement): Stage {
	const renderer = new THREE.WebGLRenderer({ antialias: true });
	renderer.setPixelRatio(window.devicePixelRatio);
	renderer.setSize(window.innerWidth, window.innerHeight);
	container.appendChild(renderer.domElement);

	// Les étiquettes sont du HTML posé au-dessus du canvas : texte net et
	// sélectionnable, ce qu'un texte 3D ne permet pas.
	const labelRenderer = new CSS2DRenderer();
	labelRenderer.setSize(window.innerWidth, window.innerHeight);
	labelRenderer.domElement.className = "label-layer";
	container.appendChild(labelRenderer.domElement);

	const scene = new THREE.Scene();
	const camera = new THREE.PerspectiveCamera(
		50,
		window.innerWidth / window.innerHeight,
		0.1,
		100,
	);
	camera.position.set(0, 5, 9);
	const controls = new OrbitControls(camera, renderer.domElement);
	controls.enableDamping = true;

	scene.add(new THREE.AmbientLight(0xffffff, 0.6));
	const sunLight = new THREE.DirectionalLight(0xffffff, 1.5);
	sunLight.position.set(3, 6, 4);
	scene.add(sunLight);

	const resize = () => {
		camera.aspect = window.innerWidth / window.innerHeight;
		camera.updateProjectionMatrix();
		renderer.setSize(window.innerWidth, window.innerHeight);
		labelRenderer.setSize(window.innerWidth, window.innerHeight);
	};
	window.addEventListener("resize", resize);

	return {
		scene,
		camera,
		canvas: renderer.domElement,
		start: (onFrame) => {
			let previousFrameTimeInMs: number | null = null;
			renderer.setAnimationLoop((frameTimeInMs: number) => {
				const frameDurationInMs =
					previousFrameTimeInMs === null
						? 0
						: frameTimeInMs - previousFrameTimeInMs;
				previousFrameTimeInMs = frameTimeInMs;
				onFrame(frameDurationInMs);
				controls.update();
				renderer.render(scene, camera);
				labelRenderer.render(scene, camera);
			});
		},
		dispose: () => {
			renderer.setAnimationLoop(null);
			window.removeEventListener("resize", resize);
			controls.dispose();
			// renderer.dispose() ne libère pas la mémoire GPU des objets de
			// la scène : il faut le faire objet par objet.
			scene.traverse(disposeGpuResources);
			renderer.dispose();
			renderer.domElement.remove();
			labelRenderer.domElement.remove();
		},
	};
}

function disposeGpuResources(object: THREE.Object3D): void {
	if (!(object instanceof THREE.Mesh || object instanceof THREE.Line)) return;
	object.geometry.dispose();
	const materials: THREE.Material[] = Array.isArray(object.material)
		? object.material
		: [object.material];
	for (const material of materials) material.dispose();
}
