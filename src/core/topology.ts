/**
 * La topologie : les machines, leurs interfaces, et les câbles qui relient
 * deux interfaces. Données pures, sans rendu.
 */

/** Rôle d'une machine : décide de sa forme dans la scène, pas de sa logique. */
export type MachineRole = "host" | "firewall" | "router";

/** Le système installé : décide de ce qu'affiche son écran dans la scène. */
export type OperatingSystem = "kali-linux" | "ubuntu" | "opnsense" | "other";

export type NetworkInterface = {
	/** Nom tel qu'il apparaît dans le labo : "eth0", "wan", "lan"… */
	readonly name: string;
	readonly ipv4Address: string;
	/** Longueur du préfixe réseau : 24 pour un /24 (255.255.255.0). */
	readonly prefixLength: number;
	readonly macAddress: string;
};

export type Machine = {
	readonly id: string;
	readonly label: string;
	readonly role: MachineRole;
	readonly os: OperatingSystem;
	readonly interfaces: readonly NetworkInterface[];
};

export type InterfaceRef = {
	readonly machineId: string;
	readonly interfaceName: string;
};

/** Un câble : il relie exactement deux interfaces. */
export type Link = {
	readonly id: string;
	readonly ends: readonly [InterfaceRef, InterfaceRef];
};

export type Topology = {
	readonly machines: readonly Machine[];
	readonly links: readonly Link[];
};

export function findMachine(
	topology: Topology,
	machineId: string,
): Machine | undefined {
	return topology.machines.find((machine) => machine.id === machineId);
}

/** Le câble qui relie directement deux machines, dans un sens ou dans l'autre. */
export function findLinkBetween(
	topology: Topology,
	firstMachineId: string,
	secondMachineId: string,
): Link | undefined {
	return topology.links.find((link) => {
		const [firstEnd, secondEnd] = link.ends;
		return (
			(firstEnd.machineId === firstMachineId &&
				secondEnd.machineId === secondMachineId) ||
			(firstEnd.machineId === secondMachineId &&
				secondEnd.machineId === firstMachineId)
		);
	});
}

/** Lance une erreur décrivant le premier défaut de structure trouvé. */
export function assertValidTopology(topology: Topology): void {
	const duplicateMachineId = findDuplicate(
		topology.machines.map((machine) => machine.id),
	);
	if (duplicateMachineId !== undefined) {
		throw new Error(`Duplicate machine id: ${duplicateMachineId}`);
	}

	for (const machine of topology.machines) {
		const duplicateInterfaceName = findDuplicate(
			machine.interfaces.map((networkInterface) => networkInterface.name),
		);
		if (duplicateInterfaceName !== undefined) {
			throw new Error(
				`Duplicate interface ${duplicateInterfaceName} on ${machine.id}`,
			);
		}
	}

	for (const end of topology.links.flatMap((link) => link.ends)) {
		if (!hasInterface(topology, end)) {
			throw new Error(
				`Link end ${end.machineId}/${end.interfaceName} does not exist`,
			);
		}
	}

	// Une interface physique n'accepte qu'un seul câble.
	const duplicateEnd = findDuplicate(
		topology.links
			.flatMap((link) => link.ends)
			.map((end) => `${end.machineId}/${end.interfaceName}`),
	);
	if (duplicateEnd !== undefined) {
		throw new Error(`Interface ${duplicateEnd} has more than one link`);
	}
}

function hasInterface(topology: Topology, ref: InterfaceRef): boolean {
	const machine = findMachine(topology, ref.machineId);
	if (machine === undefined) return false;
	return machine.interfaces.some(
		(networkInterface) => networkInterface.name === ref.interfaceName,
	);
}

function findDuplicate(values: readonly string[]): string | undefined {
	return values.find((value, index) => values.indexOf(value) !== index);
}
