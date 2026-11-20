/**
 * Dessine une topologie : un plateau, un modèle 3D par machine avec une
 * étiquette (nom et interfaces), un câble posé sur le plateau par lien.
 */

import * as THREE from "three";
import { CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";
import type { GroundPosition } from "./layout";
import { createMachineModel, MACHINE_LABEL_HEIGHT } from "./machine-model";
import { SCENE_COLORS } from "./palette";
import type { Machine, Topology } from "./topology";

/** Hauteur à laquelle voyagent les paquets, au-dessus des câbles. */
export const PACKET_PATH_HEIGHT = 0.4;

const CABLE_RADIUS = 0.04;
/** Marge du plateau autour des machines. */
const BOARD_MARGIN = 3;
const BOARD_DEPTH = 6;

export function createTopologyView(
	topology: Topology,
	positions: ReadonlyMap<string, GroundPosition>,
): THREE.Group {
	const view = new THREE.Group();
	view.add(createBoard([...positions.values()]));
	for (const machine of topology.machines) {
		view.add(createMachine(machine, positionOf(positions, machine.id)));
	}
	for (const link of topology.links) {
		const [firstEnd, secondEnd] = link.ends;
		view.add(
			createCable(
				positionOf(positions, firstEnd.machineId),
				positionOf(positions, secondEnd.machineId),
			),
		);
	}
	return view;
}

/** Point de passage des paquets au-dessus d'une machine. */
export function toPacketPathPoint(position: GroundPosition): THREE.Vector3 {
	return new THREE.Vector3(position.x, PACKET_PATH_HEIGHT, position.z);
}

export function positionOf(
	positions: ReadonlyMap<string, GroundPosition>,
	machineId: string,
): GroundPosition {
	const position = positions.get(machineId);
	if (position === undefined) {
		throw new Error(`No position for machine ${machineId}`);
	}
	return position;
}

/** Le plateau et sa grille, à la taille de la topologie. */
function createBoard(positions: readonly GroundPosition[]): THREE.Group {
	const xs = positions.map(({ x }) => x);
	const minX = Math.min(...xs, 0);
	const maxX = Math.max(...xs, 0);
	const width = maxX - minX + 2 * BOARD_MARGIN;
	const centerX = (minX + maxX) / 2;

	const board = new THREE.Group();
	const plate = new THREE.Mesh(
		new THREE.BoxGeometry(width, 0.2, BOARD_DEPTH),
		new THREE.MeshStandardMaterial({
			color: SCENE_COLORS.board,
			roughness: 0.9,
		}),
	);
	plate.position.set(centerX, -0.1, 0);
	board.add(plate);

	const gridSize = Math.max(width, BOARD_DEPTH);
	const grid = new THREE.GridHelper(
		gridSize,
		Math.round(gridSize * 2),
		SCENE_COLORS.gridMajor,
		SCENE_COLORS.gridMinor,
	);
	grid.position.set(centerX, 0.005, 0);
	// La grille carrée déborde du plateau en profondeur : on la coupe.
	grid.scale.z = BOARD_DEPTH / gridSize;
	board.add(grid);
	return board;
}

function createMachine(
	machine: Machine,
	position: GroundPosition,
): THREE.Group {
	const model = createMachineModel(machine);
	model.position.set(position.x, 0, position.z);

	const label = new CSS2DObject(createLabelElement(machine));
	label.position.set(0, MACHINE_LABEL_HEIGHT, 0);
	model.add(label);
	return model;
}

function createLabelElement(machine: Machine): HTMLElement {
	const element = document.createElement("div");
	element.className = "machine-label";

	const name = document.createElement("strong");
	name.textContent = machine.label;
	element.appendChild(name);

	for (const networkInterface of machine.interfaces) {
		const line = document.createElement("span");
		line.textContent = `${networkInterface.name} · ${networkInterface.ipv4Address}/${networkInterface.prefixLength}`;
		element.appendChild(line);
	}
	return element;
}

/** Un câble posé sur le plateau, d'une machine à l'autre. */
function createCable(from: GroundPosition, to: GroundPosition): THREE.Mesh {
	const path = new THREE.LineCurve3(
		new THREE.Vector3(from.x, CABLE_RADIUS, from.z),
		new THREE.Vector3(to.x, CABLE_RADIUS, to.z),
	);
	return new THREE.Mesh(
		new THREE.TubeGeometry(path, 1, CABLE_RADIUS, 12, false),
		new THREE.MeshStandardMaterial({
			color: SCENE_COLORS.cable,
			roughness: 0.5,
			emissive: SCENE_COLORS.cable,
			emissiveIntensity: 0.25,
		}),
	);
}
