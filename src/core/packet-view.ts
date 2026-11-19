/**
 * Dessine les paquets en vol d'un snapshot, et retrouve le paquet cliqué.
 */

import * as THREE from "three";
import type { GroundPosition } from "./layout";
import type { Packet, TransportLayer } from "./packet";
import type { ScenarioSnapshot } from "./snapshot";
import { positionOf, toCablePoint } from "./topology-view";

export type PacketView = {
	readonly group: THREE.Group;
	readonly render: (
		snapshot: ScenarioSnapshot,
		selectedPacketId: string | null,
	) => void;
	/** Le paquet sous le pointeur, en coordonnées normalisées (−1 à 1). */
	readonly findPacketAt: (
		pointer: THREE.Vector2,
		camera: THREE.Camera,
	) => Packet | undefined;
};

const PROTOCOL_COLORS: Record<TransportLayer["protocol"], number> = {
	tcp: 0xfacc15,
	udp: 0x22d3ee,
	icmp: 0xf472b6,
};

const PACKET_RADIUS = 0.18;
const SELECTED_SCALE = 1.6;

export function createPacketView(
	positions: ReadonlyMap<string, GroundPosition>,
): PacketView {
	const group = new THREE.Group();
	// Un mesh par paquet, créé à sa première apparition puis réutilisé.
	const meshesByPacketId = new Map<string, THREE.Mesh>();
	const raycaster = new THREE.Raycaster();

	const meshFor = (packet: Packet): THREE.Mesh => {
		const existing = meshesByPacketId.get(packet.id);
		if (existing !== undefined) return existing;
		const mesh = createPacketMesh(packet);
		meshesByPacketId.set(packet.id, mesh);
		group.add(mesh);
		return mesh;
	};

	return {
		group,
		render: (snapshot, selectedPacketId) => {
			for (const mesh of meshesByPacketId.values()) mesh.visible = false;
			for (const { transmission, progress } of snapshot.packetsInFlight) {
				const mesh = meshFor(transmission.packet);
				mesh.visible = true;
				mesh.position.lerpVectors(
					toCablePoint(positionOf(positions, transmission.fromMachineId)),
					toCablePoint(positionOf(positions, transmission.toMachineId)),
					easeInOut(progress),
				);
				const isSelected = transmission.packet.id === selectedPacketId;
				mesh.scale.setScalar(isSelected ? SELECTED_SCALE : 1);
			}
		},
		findPacketAt: (pointer, camera) => {
			raycaster.setFromCamera(pointer, camera);
			const visibleMeshes = [...meshesByPacketId.values()].filter(
				(mesh) => mesh.visible,
			);
			const [closestHit] = raycaster.intersectObjects(visibleMeshes);
			if (closestHit === undefined) return undefined;
			return packetOf(closestHit.object);
		},
	};
}

function createPacketMesh(packet: Packet): THREE.Mesh {
	const color = PROTOCOL_COLORS[packet.transport.protocol];
	const mesh = new THREE.Mesh(
		new THREE.SphereGeometry(PACKET_RADIUS),
		new THREE.MeshStandardMaterial({
			color,
			emissive: color,
			emissiveIntensity: 0.4,
		}),
	);
	mesh.userData = { packet };
	return mesh;
}

function packetOf(object: THREE.Object3D): Packet | undefined {
	const { packet } = object.userData;
	return isPacket(packet) ? packet : undefined;
}

/** `userData` est typé `any` par three.js : on vérifie avant d'utiliser. */
function isPacket(value: unknown): value is Packet {
	return (
		typeof value === "object" &&
		value !== null &&
		"id" in value &&
		"transport" in value
	);
}

function easeInOut(progress: number): number {
	return progress < 0.5
		? 2 * progress * progress
		: 1 - (-2 * progress + 2) ** 2 / 2;
}
