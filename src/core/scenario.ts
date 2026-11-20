/**
 * Un scénario rejouable : une topologie, des tables et une suite d'étapes
 * expliquées. C'est une donnée : la scène 3D et l'interface ne font que la
 * lire.
 */

import type { Packet } from "./packet";
import {
	assertValidTopology,
	findLinkBetween,
	findMachine,
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

export type TableRow = readonly string[];

/**
 * Une table tenue par une machine, affichée à côté de la scène : états des
 * connexions TCP, règles ou table d'état d'un pare-feu, cache ARP…
 */
export type TableDefinition = {
	readonly id: string;
	readonly title: string;
	readonly machineId: string;
	readonly columns: readonly string[];
	readonly initialRows: readonly TableRow[];
};

/** Le contenu d'une table à partir de cette étape. */
export type TableUpdate = {
	readonly kind: "table-update";
	readonly tableId: string;
	readonly rows: readonly TableRow[];
};

/**
 * Une connexion logique entre deux extrémités (une connexion TCP, par
 * exemple). Elle n'existe pas sur les câbles : c'est un état que les deux
 * extrémités mémorisent. Elle est donc dessinée à part, d'une extrémité à
 * l'autre, par-dessus les machines intermédiaires.
 */
export type ConnectionDefinition = {
	readonly id: string;
	readonly endpointMachineIds: readonly [string, string];
	/** Ce qui identifie la connexion : « TCP 10.0.0.5:40000 ⇄ 10.0.0.10:22 ». */
	readonly label: string;
};

export type ConnectionState = "opening" | "established" | "closed";

/** L'état d'une connexion à partir de cette étape. */
export type ConnectionUpdate = {
	readonly kind: "connection-update";
	readonly connectionId: string;
	readonly state: ConnectionState;
};

/** Ce qui se passe pendant une étape. */
export type StepEvent = Transmission | TableUpdate | ConnectionUpdate;

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
	readonly tables: readonly TableDefinition[];
	readonly connections: readonly ConnectionDefinition[];
	readonly steps: readonly Step[];
};

export function transmissionsOf(step: Step): Transmission[] {
	return step.events.filter(
		(event): event is Transmission => event.kind === "transmission",
	);
}

export function tableUpdatesOf(step: Step): TableUpdate[] {
	return step.events.filter(
		(event): event is TableUpdate => event.kind === "table-update",
	);
}

export function connectionUpdatesOf(step: Step): ConnectionUpdate[] {
	return step.events.filter(
		(event): event is ConnectionUpdate => event.kind === "connection-update",
	);
}

export function findPacket(
	scenario: Scenario,
	packetId: string,
): Packet | undefined {
	return scenario.steps
		.flatMap(transmissionsOf)
		.map((transmission) => transmission.packet)
		.find((packet) => packet.id === packetId);
}

/** Lance une erreur décrivant le premier défaut de structure trouvé. */
export function assertValidScenario(scenario: Scenario): void {
	assertValidTopology(scenario.topology);

	if (scenario.steps.length === 0) {
		throw new Error(`Scenario ${scenario.id} has no step`);
	}

	const transmissions = scenario.steps.flatMap(transmissionsOf);
	for (const transmission of transmissions) {
		assertTransmissionFollowsALink(scenario.topology, transmission);
	}
	const duplicatePacketId = findDuplicate(
		transmissions.map(({ packet }) => packet.id),
	);
	if (duplicatePacketId !== undefined) {
		throw new Error(`Duplicate packet id: ${duplicatePacketId}`);
	}

	assertValidTables(scenario);
	assertValidConnections(scenario);
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

function assertValidTables(scenario: Scenario): void {
	const duplicateTableId = findDuplicate(
		scenario.tables.map((table) => table.id),
	);
	if (duplicateTableId !== undefined) {
		throw new Error(`Duplicate table id: ${duplicateTableId}`);
	}

	for (const table of scenario.tables) {
		if (findMachine(scenario.topology, table.machineId) === undefined) {
			throw new Error(
				`Table ${table.id} belongs to unknown machine ${table.machineId}`,
			);
		}
		assertRowsFitColumns(table, table.initialRows);
	}

	scenario.steps.forEach((step, stepIndex) => {
		const updates = tableUpdatesOf(step);
		// Deux mises à jour de la même table dans une étape : laquelle vaut ?
		const tableUpdatedTwice = findDuplicate(
			updates.map((update) => update.tableId),
		);
		if (tableUpdatedTwice !== undefined) {
			throw new Error(
				`Table ${tableUpdatedTwice} is updated twice in step ${stepIndex}`,
			);
		}
		for (const update of updates) {
			const table = scenario.tables.find(({ id }) => id === update.tableId);
			if (table === undefined) {
				throw new Error(
					`Step ${stepIndex} updates unknown table ${update.tableId}`,
				);
			}
			assertRowsFitColumns(table, update.rows);
		}
	});
}

function assertValidConnections(scenario: Scenario): void {
	const duplicateConnectionId = findDuplicate(
		scenario.connections.map((connection) => connection.id),
	);
	if (duplicateConnectionId !== undefined) {
		throw new Error(`Duplicate connection id: ${duplicateConnectionId}`);
	}

	for (const { id, endpointMachineIds } of scenario.connections) {
		const [firstEndpoint, secondEndpoint] = endpointMachineIds;
		if (firstEndpoint === secondEndpoint) {
			throw new Error(`Connection ${id} links ${firstEndpoint} to itself`);
		}
		const unknownEndpoint = endpointMachineIds.find(
			(machineId) => findMachine(scenario.topology, machineId) === undefined,
		);
		if (unknownEndpoint !== undefined) {
			throw new Error(
				`Connection ${id} ends at unknown machine ${unknownEndpoint}`,
			);
		}
	}

	scenario.steps.forEach((step, stepIndex) => {
		const updates = connectionUpdatesOf(step);
		const connectionUpdatedTwice = findDuplicate(
			updates.map((update) => update.connectionId),
		);
		if (connectionUpdatedTwice !== undefined) {
			throw new Error(
				`Connection ${connectionUpdatedTwice} is updated twice in step ${stepIndex}`,
			);
		}
		const unknownUpdate = updates.find(
			({ connectionId }) =>
				!scenario.connections.some(({ id }) => id === connectionId),
		);
		if (unknownUpdate !== undefined) {
			throw new Error(
				`Step ${stepIndex} updates unknown connection ${unknownUpdate.connectionId}`,
			);
		}
	});
}

function assertRowsFitColumns(
	table: TableDefinition,
	rows: readonly TableRow[],
): void {
	const misshapenRow = rows.find((row) => row.length !== table.columns.length);
	if (misshapenRow !== undefined) {
		throw new Error(
			`Table ${table.id} has ${table.columns.length} columns, row [${misshapenRow.join(", ")}] has ${misshapenRow.length}`,
		);
	}
}

function findDuplicate(values: readonly string[]): string | undefined {
	return values.find((value, index) => values.indexOf(value) !== index);
}
