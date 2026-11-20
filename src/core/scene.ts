/**
 * La scène three.js : rendu, caméra, contrôles, étiquettes HTML et boucle
 * d'animation. Ne connaît ni topologie ni paquets.
 */

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { CSS2DRenderer } from "three/addons/renderers/CSS2DRenderer.js";
import { SCENE_COLORS } from "./palette";

export type Stage = {
	readonly scene: THREE.Scene;
	readonly camera: THREE.PerspectiveCamera;
	readonly canvas: HTMLCanvasElement;
	/** Lance la boucle ; `onFrame` reçoit la durée de l'image précédente. */
	readonly start: (onFrame: (frameDurationInMs: number) => void) => void;
	readonly dispose: () => void;
};

/**
 * La scène occupe toute la zone `viewport`, et seulement elle : le rendu,
 * la caméra et les étiquettes se dimensionnent sur cette zone, pas sur la
 * fenêtre. Le centre de la caméra tombe ainsi au centre de ce qu'on voit.
 */
export function createStage(viewport: HTMLElement): Stage {
	const renderer = new THREE.WebGLRenderer({ antialias: true });
	// Au-delà de 2, la netteté ne se voit plus mais le coût de rendu, si.
	renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
	viewport.appendChild(renderer.domElement);

	// Les étiquettes sont du HTML posé au-dessus du canvas : texte net et
	// sélectionnable, ce qu'un texte 3D ne permet pas.
	const labelRenderer = new CSS2DRenderer();
	labelRenderer.domElement.className = "label-layer";
	viewport.appendChild(labelRenderer.domElement);

	const scene = new THREE.Scene();
	scene.background = new THREE.Color(SCENE_COLORS.background);
	// Le brouillard fond les bords du plateau dans le fond : de la profondeur.
	scene.fog = new THREE.Fog(SCENE_COLORS.background, 14, 32);

	const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
	camera.position.set(0, 4.5, 8.5);
	const controls = new OrbitControls(camera, renderer.domElement);
	controls.target.set(0, 0.7, 0);
	controls.enableDamping = true;
	controls.dampingFactor = 0.08;
	// Ne pas passer sous le plateau, ni trop près ou trop loin.
	controls.maxPolarAngle = Math.PI * 0.47;
	controls.minDistance = 4;
	controls.maxDistance = 22;
	controls.update();

	// Lumière du ciel bleutée et reflet du sol bleu nuit, comme memory-explorer.
	// Les intensités sont × π : three.js utilise des unités physiques.
	scene.add(
		new THREE.HemisphereLight(
			0xbfd7ff,
			SCENE_COLORS.background,
			0.75 * Math.PI,
		),
	);
	const sunLight = new THREE.DirectionalLight(0xffffff, 0.7 * Math.PI);
	sunLight.position.set(6, 12, 8);
	scene.add(sunLight);

	const resize = () => {
		const { clientWidth: width, clientHeight: height } = viewport;
		// Zone masquée ou pas encore mise en page : rien à dimensionner.
		if (width === 0 || height === 0) return;
		camera.aspect = width / height;
		camera.updateProjectionMatrix();
		renderer.setSize(width, height);
		labelRenderer.setSize(width, height);
	};
	resize();
	// La zone change de taille avec la fenêtre, mais aussi si la colonne
	// latérale change de largeur : on observe la zone elle-même.
	const resizeObserver = new ResizeObserver(resize);
	resizeObserver.observe(viewport);

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
			resizeObserver.disconnect();
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
	for (const material of materials) {
		// material.dispose() ne libère pas ses textures (l'écran des portables).
		if ("map" in material && material.map instanceof THREE.Texture) {
			material.map.dispose();
		}
		material.dispose();
	}
}
