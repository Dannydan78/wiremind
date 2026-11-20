/**
 * Dessine les connexions logiques : un arc d'une extrémité à l'autre,
 * au-dessus de la scène, bien séparé des câbles posés sur le plateau.
 * Une connexion n'existe pas dans les câbles : c'est un état mémorisé par
 * ses deux extrémités. L'arc passe donc par-dessus les machines
 * intermédiaires (un pare-feu, par exemple) sans s'y arrêter.
 */

import * as THREE from "three";
import { CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";
import type { GroundPosition } from "./layout";
import { SCENE_COLORS } from "./palette";
import type { ConnectionDefinition, ConnectionState } from "./scenario";
import type { ConnectionStatus } from "./snapshot";
import { positionOf } from "./topology-view";

export type ConnectionView = {
	readonly group: THREE.Group;
	readonly render: (connections: readonly ConnectionStatus[]) => void;
};

/** Les extrémités de l'arc, au-dessus des étiquettes des machines. */
const ARC_BASE_HEIGHT = 2.6;
const ARC_RISE = 1;
const DASH_COUNT = 28;

const STATE_STYLES: Record<
	ConnectionState,
	{ readonly color: number; readonly text: string; readonly isDashed: boolean }
> = {
	opening: {
		color: SCENE_COLORS.amber,
		text: "ouverture en cours",
		isDashed: true,
	},
	established: { color: SCENE_COLORS.green, text: "établie", isDashed: false },
	closed: { color: 0x8b93b8, text: "fermée", isDashed: true },
};

export function createConnectionView(
	positions: ReadonlyMap<string, GroundPosition>,
): ConnectionView {
	const group = new THREE.Group();
	// Un arc par couple (connexion, état), construit une fois puis montré ou
	// caché : changer d'étape ne recrée rien.
	const arcsByKey = new Map<string, THREE.Group>();

	return {
		group,
		render: (connections) => {
			const visibleKeys = new Set(connections.map(keyOf));
			for (const status of connections) {
				const key = keyOf(status);
				if (arcsByKey.has(key)) continue;
				const arc = createArc(status, positions);
				arcsByKey.set(key, arc);
				group.add(arc);
			}
			for (const [key, arc] of arcsByKey) arc.visible = visibleKeys.has(key);
		},
	};
}

function keyOf({ definition, state }: ConnectionStatus): string {
	return `${definition.id}:${state}`;
}

function createArc(
	{ definition, state }: ConnectionStatus,
	positions: ReadonlyMap<string, GroundPosition>,
): THREE.Group {
	const style = STATE_STYLES[state];
	const curve = arcCurveOf(definition, positions);
	const material = new THREE.MeshStandardMaterial({
		color: style.color,
		emissive: style.color,
		emissiveIntensity: 0.8,
	});

	const arc = new THREE.Group();
	if (style.isDashed) {
		for (const dash of dashesOf(curve)) {
			arc.add(
				new THREE.Mesh(new THREE.TubeGeometry(dash, 1, 0.025, 8), material),
			);
		}
	} else {
		arc.add(
			new THREE.Mesh(new THREE.TubeGeometry(curve, 48, 0.04, 10), material),
		);
	}

	const labelElement = document.createElement("div");
	labelElement.className = `connection-label is-${state}`;
	labelElement.textContent = `${definition.label} · ${style.text}`;
	const label = new CSS2DObject(labelElement);
	label.position.copy(curve.getPoint(0.5));
	arc.add(label);
	return arc;
}

function arcCurveOf(
	{
		endpointMachineIds: [firstMachineId, secondMachineId],
	}: ConnectionDefinition,
	positions: ReadonlyMap<string, GroundPosition>,
): THREE.QuadraticBezierCurve3 {
	const first = positionOf(positions, firstMachineId);
	const second = positionOf(positions, secondMachineId);
	return new THREE.QuadraticBezierCurve3(
		new THREE.Vector3(first.x, ARC_BASE_HEIGHT, first.z),
		new THREE.Vector3(
			(first.x + second.x) / 2,
			ARC_BASE_HEIGHT + 2 * ARC_RISE,
			(first.z + second.z) / 2,
		),
		new THREE.Vector3(second.x, ARC_BASE_HEIGHT, second.z),
	);
}

/** Un tiret sur deux le long de la courbe : l'arc en pointillés. */
function dashesOf(curve: THREE.Curve<THREE.Vector3>): THREE.LineCurve3[] {
	const points = curve.getSpacedPoints(DASH_COUNT * 2);
	return points.flatMap((point, index) => {
		const next = points[index + 1];
		const isDash = index % 2 === 0;
		return isDash && next !== undefined
			? [new THREE.LineCurve3(point, next)]
			: [];
	});
}
