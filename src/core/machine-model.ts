/**
 * Le modèle 3D d'une machine, choisi selon son rôle : un ordinateur
 * portable ouvert pour un poste, un boîtier en rack pour un pare-feu ou
 * un routeur. L'origine du modèle est posée sur le plateau.
 */

import * as THREE from "three";
import { SCENE_COLORS } from "./palette";
import { drawScreen } from "./screen-art";
import type { Machine } from "./topology";

/** Hauteur au-dessus du plateau où placer l'étiquette de la machine. */
export const MACHINE_LABEL_HEIGHT = 1.75;

const LAPTOP = {
	width: 1.9,
	depth: 1.3,
	baseThickness: 0.09,
	lidHeight: 1.25,
	lidThickness: 0.06,
	/** Écran ouvert à 105° : penché de 15° vers l'arrière. */
	lidTiltInRadians: -THREE.MathUtils.degToRad(15),
};

export function createMachineModel(machine: Machine): THREE.Group {
	switch (machine.role) {
		case "host":
			return createLaptop(machine);
		case "firewall":
		case "router":
			return createRackAppliance();
		default: {
			const unhandled: never = machine.role;
			throw new Error(`Unhandled machine role: ${unhandled}`);
		}
	}
}

function createLaptop(machine: Machine): THREE.Group {
	const laptop = new THREE.Group();
	const bodyMaterial = new THREE.MeshStandardMaterial({
		color: SCENE_COLORS.laptopBody,
		metalness: 0.45,
		roughness: 0.45,
	});

	const base = new THREE.Mesh(
		new THREE.BoxGeometry(LAPTOP.width, LAPTOP.baseThickness, LAPTOP.depth),
		bodyMaterial,
	);
	base.position.y = LAPTOP.baseThickness / 2;
	laptop.add(base);

	const keyboard = new THREE.Mesh(
		new THREE.BoxGeometry(LAPTOP.width * 0.86, 0.01, LAPTOP.depth * 0.5),
		new THREE.MeshStandardMaterial({
			color: SCENE_COLORS.laptopKeyboard,
			roughness: 0.8,
		}),
	);
	keyboard.position.set(0, LAPTOP.baseThickness, -LAPTOP.depth * 0.12);
	laptop.add(keyboard);

	const trackpad = new THREE.Mesh(
		new THREE.BoxGeometry(LAPTOP.width * 0.3, 0.01, LAPTOP.depth * 0.22),
		new THREE.MeshStandardMaterial({
			color: SCENE_COLORS.laptopKeyboard,
			roughness: 0.6,
		}),
	);
	trackpad.position.set(0, LAPTOP.baseThickness, LAPTOP.depth * 0.3);
	laptop.add(trackpad);

	// L'écran pivote autour de la charnière, au bord arrière du clavier.
	const hinge = new THREE.Group();
	hinge.position.set(0, LAPTOP.baseThickness, -LAPTOP.depth / 2);
	hinge.rotation.x = LAPTOP.lidTiltInRadians;
	laptop.add(hinge);

	const lid = new THREE.Mesh(
		new THREE.BoxGeometry(LAPTOP.width, LAPTOP.lidHeight, LAPTOP.lidThickness),
		bodyMaterial,
	);
	lid.position.y = LAPTOP.lidHeight / 2;
	hinge.add(lid);

	const screenTexture = new THREE.CanvasTexture(drawScreen(machine.os));
	screenTexture.colorSpace = THREE.SRGBColorSpace;
	// Un écran émet sa propre lumière : il n'est pas assombri par l'éclairage.
	const screen = new THREE.Mesh(
		new THREE.PlaneGeometry(LAPTOP.width * 0.92, LAPTOP.lidHeight * 0.88),
		new THREE.MeshBasicMaterial({ map: screenTexture, toneMapped: false }),
	);
	screen.position.set(0, LAPTOP.lidHeight / 2, LAPTOP.lidThickness / 2 + 0.002);
	hinge.add(screen);

	return laptop;
}

/** Un boîtier 1U avec ses voyants : la forme des appliances réseau. */
function createRackAppliance(): THREE.Group {
	const appliance = new THREE.Group();
	const height = 0.35;
	const body = new THREE.Mesh(
		new THREE.BoxGeometry(2.2, height, 1.2),
		new THREE.MeshStandardMaterial({
			color: SCENE_COLORS.applianceBody,
			metalness: 0.5,
			roughness: 0.4,
		}),
	);
	body.position.y = height / 2;
	appliance.add(body);

	const ledMaterial = new THREE.MeshStandardMaterial({
		color: SCENE_COLORS.cyan,
		emissive: SCENE_COLORS.cyan,
		emissiveIntensity: 1,
	});
	for (let ledIndex = 0; ledIndex < 4; ledIndex += 1) {
		const led = new THREE.Mesh(
			new THREE.BoxGeometry(0.08, 0.05, 0.02),
			ledMaterial,
		);
		led.position.set(-0.8 + ledIndex * 0.18, height / 2, 0.61);
		appliance.add(led);
	}
	return appliance;
}
