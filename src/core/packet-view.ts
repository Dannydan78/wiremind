/**
 * Dessine les paquets en vol d'un snapshot, et retrouve le paquet cliqué.
 *
 * Un paquet est un colis à couches emboîtées, qui montre l'encapsulation :
 * le cœur plein est le segment de transport (TCP, UDP, ICMP), entouré
 * d'une enveloppe IPv4, elle-même dans une enveloppe Ethernet. Les
 * couleurs sont celles des couches dans l'inspecteur.
 */

import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";
import type { GroundPosition } from "./layout";
import { type Packet, packetBadgeOf } from "./packet";
import { LAYER_COLORS } from "./palette";
import type { ScenarioSnapshot } from "./snapshot";
import { positionOf, toPacketPathPoint } from "./topology-view";

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

/** Taille de chaque couche, de l'intérieur vers l'extérieur. */
const CORE_SIZE = 0.2;
const IPV4_ENVELOPE_SIZE = 0.32;
const ETHERNET_ENVELOPE_SIZE = 0.44;
const BADGE_HEIGHT = 0.45;
const SELECTED_SCALE = 1.4;
/** Tours effectués pendant une traversée de câble. */
const TURNS_PER_CROSSING = 0.5;

export function createPacketView(
	positions: ReadonlyMap<string, GroundPosition>,
): PacketView {
	const group = new THREE.Group();
	// Un modèle par paquet, créé à sa première apparition puis réutilisé.
	const modelsByPacketId = new Map<string, THREE.Group>();
	const raycaster = new THREE.Raycaster();

	const modelFor = (packet: Packet): THREE.Group => {
		const existing = modelsByPacketId.get(packet.id);
		if (existing !== undefined) return existing;
		const model = createPacketModel(packet);
		modelsByPacketId.set(packet.id, model);
		group.add(model);
		return model;
	};

	return {
		group,
		render: (snapshot, selectedPacketId) => {
			for (const model of modelsByPacketId.values()) model.visible = false;
			for (const { transmission, progress } of snapshot.packetsInFlight) {
				const model = modelFor(transmission.packet);
				model.visible = true;
				model.position.lerpVectors(
					toPacketPathPoint(positionOf(positions, transmission.fromMachineId)),
					toPacketPathPoint(positionOf(positions, transmission.toMachineId)),
					easeInOut(progress),
				);
				// La rotation suit la progression, pas l'horloge : en revenant en
				// arrière, le colis tourne à l'envers, en accord avec la timeline.
				model.rotation.y = progress * TURNS_PER_CROSSING * 2 * Math.PI;
				const isSelected = transmission.packet.id === selectedPacketId;
				model.scale.setScalar(isSelected ? SELECTED_SCALE : 1);
			}
		},
		findPacketAt: (pointer, camera) => {
			raycaster.setFromCamera(pointer, camera);
			const visibleModels = [...modelsByPacketId.values()].filter(
				(model) => model.visible,
			);
			const [closestHit] = raycaster.intersectObjects(visibleModels);
			if (closestHit === undefined) return undefined;
			return packetOf(closestHit.object);
		},
	};
}

function createPacketModel(packet: Packet): THREE.Group {
	const model = new THREE.Group();
	model.userData = { packet };
	const transportColor = LAYER_COLORS[packet.transport.protocol];

	const core = new THREE.Mesh(
		new RoundedBoxGeometry(CORE_SIZE, CORE_SIZE, CORE_SIZE, 2, 0.03),
		new THREE.MeshStandardMaterial({
			color: transportColor,
			emissive: transportColor,
			emissiveIntensity: 1,
		}),
	);
	model.add(
		core,
		createEnvelope(IPV4_ENVELOPE_SIZE, LAYER_COLORS.ipv4, 0.3),
		createEnvelope(ETHERNET_ENVELOPE_SIZE, LAYER_COLORS.ethernet, 0.2),
	);

	// Le paquet éclaire ce qu'il survole : on suit mieux son trajet.
	model.add(new THREE.PointLight(transportColor, 1.4 * Math.PI, 4, 1));

	const badgeElement = document.createElement("div");
	badgeElement.className = "packet-badge";
	badgeElement.textContent = packetBadgeOf(packet);
	const badge = new CSS2DObject(badgeElement);
	badge.position.y = BADGE_HEIGHT;
	model.add(badge);
	return model;
}

/** Une enveloppe translucide : on voit la couche qu'elle contient. */
function createEnvelope(size: number, color: number, opacity: number) {
	return new THREE.Mesh(
		new RoundedBoxGeometry(size, size, size, 2, 0.05),
		new THREE.MeshStandardMaterial({
			color,
			emissive: color,
			emissiveIntensity: 0.35,
			transparent: true,
			opacity,
			// Sans cela, l'enveloppe masquerait le cœur dans le tampon de profondeur.
			depthWrite: false,
		}),
	);
}

/** Le paquet porté par l'objet touché ou par l'un de ses parents. */
function packetOf(object: THREE.Object3D): Packet | undefined {
	const { packet } = object.userData;
	if (isPacket(packet)) return packet;
	return object.parent === null ? undefined : packetOf(object.parent);
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
