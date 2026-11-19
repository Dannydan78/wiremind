/**
 * Un scénario rejouable : une topologie et une suite d'étapes expliquées.
 * C'est une donnée : la scène 3D et l'interface ne font que la lire.
 */

import type { Packet } from "./packet";
import {
	assertValidTopology,
	findLinkBetween,
	type Topology,
} from "./topology";

/**
 * Une trame qui traverse un câble, d'une machine à sa voisine directe.
 * Un trajet de bout en bout est une suite de transmissions : les adresses
 * MAC changent à chaque saut, alors que les adresses IP restent les mêmes
 * (sauf NAT).
 */
export type Transmission = {
	readonly kind: "transmission";
	readonly fromMachineId: string;
	readonly toMachineId: string;
	readonly packet: Packet;
};

/** Ce qui se passe pendant une étape. D'autres événements s'ajouteront. */
export type StepEvent = Transmission;

export type Step = {
	readonly title: string;
	/** Ce qui se passe et pourquoi, affiché pendant l'étape. */
	readonly explanation: string;
	readonly events: readonly StepEvent[];
};

export type Scenario = {
	readonly id: string;
	readonly title: string;
	/** Présentation affichée avant la première étape. */
	readonly overview: string;
	readonly topology: Topology;
	readonly steps: readonly Step[];
};

/** Lance une erreur décrivant le premier défaut de structure trouvé. */
export function assertValidScenario(scenario: Scenario): void {
	assertValidTopology(scenario.topology);

	if (scenario.steps.length === 0) {
		throw new Error(`Scenario ${scenario.id} has no step`);
	}

	const transmissions = scenario.steps.flatMap((step) => step.events);
	for (const transmission of transmissions) {
		assertTransmissionFollowsALink(scenario.topology, transmission);
	}

	const packetIds = transmissions.map(({ packet }) => packet.id);
	const duplicatePacketId = packetIds.find(
		(packetId, index) => packetIds.indexOf(packetId) !== index,
	);
	if (duplicatePacketId !== undefined) {
		throw new Error(`Duplicate packet id: ${duplicatePacketId}`);
	}
}

/**
 * Seule la structure est vérifiée : on ne contrôle pas que l'IP source
 * appartient à l'émetteur, car l'usurpation d'adresse et le NAT produisent
 * justement des paquets où ce n'est pas le cas.
 */
function assertTransmissionFollowsALink(
	topology: Topology,
	{ fromMachineId, toMachineId, packet }: Transmission,
): void {
	if (fromMachineId === toMachineId) {
		throw new Error(`Packet ${packet.id} is sent to its own sender`);
	}
	const link = findLinkBetween(topology, fromMachineId, toMachineId);
	if (link === undefined) {
		throw new Error(
			`Packet ${packet.id}: no link between ${fromMachineId} and ${toMachineId}`,
		);
	}
}
