/**
 * Dessine une topologie : une boîte par machine, une étiquette avec son
 * nom et ses interfaces, une ligne par câble.
 */

import * as THREE from "three";
import { CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";
import type { GroundPosition } from "./layout";
import type { Machine, MachineRole, Topology } from "./topology";

/** Hauteur à laquelle passent les câbles, et donc les paquets. */
export const CABLE_HEIGHT = 0;

const ROLE_COLORS: Record<MachineRole, number> = {
	host: 0x3b82f6,
	firewall: 0xf97316,
	router: 0xa855f7,
};

const MACHINE_SIZE = { width: 1.2, height: 0.8, depth: 1.2 };

export function createTopologyView(
	topology: Topology,
	positions: ReadonlyMap<string, GroundPosition>,
): THREE.Group {
	const view = new THREE.Group();
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

/** Point 3D d'une machine, à la hauteur des câbles. */
export function toCablePoint(position: GroundPosition): THREE.Vector3 {
	return new THREE.Vector3(position.x, CABLE_HEIGHT, position.z);
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

function createMachine(machine: Machine, position: GroundPosition): THREE.Mesh {
	const mesh = new THREE.Mesh(
		new THREE.BoxGeometry(
			MACHINE_SIZE.width,
			MACHINE_SIZE.height,
			MACHINE_SIZE.depth,
		),
		new THREE.MeshStandardMaterial({ color: ROLE_COLORS[machine.role] }),
	);
	mesh.position.copy(toCablePoint(position));

	const label = new CSS2DObject(createLabelElement(machine));
	label.position.set(0, MACHINE_SIZE.height, 0);
	mesh.add(label);
	return mesh;
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

function createCable(from: GroundPosition, to: GroundPosition): THREE.Line {
	return new THREE.Line(
		new THREE.BufferGeometry().setFromPoints([
			toCablePoint(from),
			toCablePoint(to),
		]),
		new THREE.LineBasicMaterial({ color: 0x64748b }),
	);
}
