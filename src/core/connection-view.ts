/**
 * Signale les connexions établies : une étiquette verte avec leurs
 * adresses, au-dessus du milieu des deux extrémités.
 *
 * Une connexion n'existe pas dans les câbles : c'est un état mémorisé par
 * ses deux extrémités. L'étiquette flotte donc au-dessus de la scène, et
 * non sur un câble. Rien n'est affiché tant que la connexion s'ouvre.
 */

import * as THREE from "three";
import { CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";
import type { GroundPosition } from "./layout";
import type { ConnectionDefinition } from "./scenario";
import type { ConnectionStatus } from "./snapshot";
import { positionOf } from "./topology-view";

export type ConnectionView = {
	readonly group: THREE.Group;
	readonly render: (connections: readonly ConnectionStatus[]) => void;
};

/** Au-dessus des étiquettes des machines. */
const LABEL_HEIGHT = 2.6;

export function createConnectionView(
	positions: ReadonlyMap<string, GroundPosition>,
): ConnectionView {
	const group = new THREE.Group();
	// Une étiquette par connexion, créée une fois puis montrée ou cachée.
	const labelsByConnectionId = new Map<string, CSS2DObject>();

	return {
		group,
		render: (connections) => {
			const establishedIds = new Set(
				connections
					.filter(({ state }) => state === "established")
					.map(({ definition }) => definition.id),
			);
			for (const { definition } of connections) {
				if (labelsByConnectionId.has(definition.id)) continue;
				const label = createEstablishedLabel(definition, positions);
				labelsByConnectionId.set(definition.id, label);
				group.add(label);
			}
			for (const [connectionId, label] of labelsByConnectionId) {
				label.visible = establishedIds.has(connectionId);
			}
		},
	};
}

function createEstablishedLabel(
	{
		label,
		endpointMachineIds: [firstMachineId, secondMachineId],
	}: ConnectionDefinition,
	positions: ReadonlyMap<string, GroundPosition>,
): CSS2DObject {
	const first = positionOf(positions, firstMachineId);
	const second = positionOf(positions, secondMachineId);

	const element = document.createElement("div");
	element.className = "connection-label";
	element.textContent = `${label} · établie`;
	const labelObject = new CSS2DObject(element);
	labelObject.position.set(
		(first.x + second.x) / 2,
		LABEL_HEIGHT,
		(first.z + second.z) / 2,
	);
	return labelObject;
}
