import { describe, expect, test } from "bun:test";
import type { Packet, TcpFlag } from "./packet";
import {
	assertValidScenario,
	findPacket,
	type Scenario,
	type Step,
} from "./scenario";
import type { Topology } from "./topology";

const KALI_MAC = "08:00:27:aa:aa:aa";
const TARGET_MAC = "08:00:27:bb:bb:bb";
const KALI_IP = "10.0.0.5";
const TARGET_IP = "10.0.0.10";

const SAME_SEGMENT: Topology = {
	machines: [
		{
			id: "kali",
			label: "Kali",
			role: "host",
			os: "kali-linux",
			interfaces: [
				{
					name: "eth0",
					ipv4Address: KALI_IP,
					prefixLength: 24,
					macAddress: KALI_MAC,
				},
			],
		},
		{
			id: "target",
			label: "Cible",
			role: "host",
			os: "ubuntu",
			interfaces: [
				{
					name: "eth0",
					ipv4Address: TARGET_IP,
					prefixLength: 24,
					macAddress: TARGET_MAC,
				},
			],
		},
	],
	links: [
		{
			id: "kali-target",
			ends: [
				{ machineId: "kali", interfaceName: "eth0" },
				{ machineId: "target", interfaceName: "eth0" },
			],
		},
	],
};

/** Un segment TCP de Kali (port 54321) vers le SSH de la cible (port 22). */
function kaliToTarget(
	id: string,
	flags: readonly TcpFlag[],
	sequenceNumber: number,
	acknowledgmentNumber: number,
): Packet {
	return {
		id,
		ethernet: { sourceMac: KALI_MAC, destinationMac: TARGET_MAC },
		ipv4: {
			dscp: 0,
			ecn: 0,
			identification: 1,
			dontFragment: true,
			ttl: 64,
			sourceAddress: KALI_IP,
			destinationAddress: TARGET_IP,
		},
		transport: {
			protocol: "tcp",
			sourcePort: 54321,
			destinationPort: 22,
			sequenceNumber,
			acknowledgmentNumber,
			flags,
			windowSize: 64240,
			options: [],
		},
		payloadSizeInBytes: 0,
	};
}

function synStep(packet: Packet): Step {
	return {
		title: "SYN",
		explanation: "Kali demande l'ouverture d'une connexion.",
		events: [
			{
				kind: "transmission",
				fromMachineId: "kali",
				toMachineId: "target",
				packet,
			},
		],
	};
}

const HANDSHAKE_START: Scenario = {
	id: "tcp-handshake",
	title: "Handshake TCP",
	overview: "Kali ouvre une connexion SSH vers la cible.",
	topology: SAME_SEGMENT,
	tables: [],
	connections: [],
	steps: [synStep(kaliToTarget("syn", ["SYN"], 0, 0))],
};

describe("findPacket", () => {
	test("trouve un paquet par son id, quelle que soit son étape", () => {
		expect(findPacket(HANDSHAKE_START, "syn")?.id).toBe("syn");
	});

	test("ne trouve rien pour un id inconnu", () => {
		expect(findPacket(HANDSHAKE_START, "unknown")).toBeUndefined();
	});
});

describe("assertValidScenario", () => {
	test("accepte un scénario cohérent", () => {
		expect(() => assertValidScenario(HANDSHAKE_START)).not.toThrow();
	});

	test("refuse un scénario sans étape", () => {
		expect(() =>
			assertValidScenario({ ...HANDSHAKE_START, steps: [] }),
		).toThrow("no step");
	});

	test("vérifie aussi la topologie", () => {
		const topology: Topology = {
			...SAME_SEGMENT,
			machines: [...SAME_SEGMENT.machines, ...SAME_SEGMENT.machines],
		};

		expect(() => assertValidScenario({ ...HANDSHAKE_START, topology })).toThrow(
			"Duplicate machine id",
		);
	});

	test("refuse une transmission entre deux machines sans câble", () => {
		const scenario: Scenario = {
			...HANDSHAKE_START,
			topology: { ...SAME_SEGMENT, links: [] },
		};

		expect(() => assertValidScenario(scenario)).toThrow("no link");
	});

	test("refuse une machine qui s'envoie un paquet à elle-même", () => {
		const packet = kaliToTarget("loop", ["SYN"], 0, 0);
		const scenario: Scenario = {
			...HANDSHAKE_START,
			steps: [
				{
					title: "Boucle",
					explanation: "Impossible sur un câble.",
					events: [
						{
							kind: "transmission",
							fromMachineId: "kali",
							toMachineId: "kali",
							packet,
						},
					],
				},
			],
		};

		expect(() => assertValidScenario(scenario)).toThrow("own sender");
	});

	test("refuse deux paquets avec le même id", () => {
		const packet = kaliToTarget("syn", ["SYN"], 0, 0);
		const scenario: Scenario = {
			...HANDSHAKE_START,
			steps: [synStep(packet), synStep(packet)],
		};

		expect(() => assertValidScenario(scenario)).toThrow("Duplicate packet id");
	});

	test("accepte une IP source usurpée : le modèle doit pouvoir montrer une attaque", () => {
		const spoofed = kaliToTarget("spoofed", ["SYN"], 0, 0);
		const scenario: Scenario = {
			...HANDSHAKE_START,
			steps: [
				synStep({
					...spoofed,
					ipv4: { ...spoofed.ipv4, sourceAddress: "10.0.0.99" },
				}),
			],
		};

		expect(() => assertValidScenario(scenario)).not.toThrow();
	});
});

describe("assertValidScenario · tables", () => {
	const KALI_TABLE = {
		id: "kali-tcp",
		title: "Kali · connexions TCP",
		machineId: "kali",
		columns: ["État", "Locale", "Distante"],
		initialRows: [],
	};

	function updateStep(tableId: string, rows: string[][]): Step {
		return {
			title: "Mise à jour",
			explanation: "",
			events: [{ kind: "table-update", tableId, rows }],
		};
	}

	test("accepte une table cohérente et ses mises à jour", () => {
		const scenario: Scenario = {
			...HANDSHAKE_START,
			tables: [KALI_TABLE],
			steps: [updateStep("kali-tcp", [["SYN-SENT", "a:1", "b:22"]])],
		};

		expect(() => assertValidScenario(scenario)).not.toThrow();
	});

	test("refuse une table rattachée à une machine inconnue", () => {
		const scenario: Scenario = {
			...HANDSHAKE_START,
			tables: [{ ...KALI_TABLE, machineId: "router" }],
		};

		expect(() => assertValidScenario(scenario)).toThrow("unknown machine");
	});

	test("refuse une mise à jour d'une table inconnue", () => {
		const scenario: Scenario = {
			...HANDSHAKE_START,
			steps: [updateStep("ghost", [])],
		};

		expect(() => assertValidScenario(scenario)).toThrow("unknown table ghost");
	});

	test("refuse une ligne qui n'a pas autant de cases que de colonnes", () => {
		const scenario: Scenario = {
			...HANDSHAKE_START,
			tables: [KALI_TABLE],
			steps: [updateStep("kali-tcp", [["SYN-SENT", "a:1"]])],
		};

		expect(() => assertValidScenario(scenario)).toThrow("has 3 columns");
	});

	test("refuse deux mises à jour de la même table dans une étape", () => {
		const twice: Step = {
			title: "Deux fois",
			explanation: "",
			events: [
				{ kind: "table-update", tableId: "kali-tcp", rows: [] },
				{ kind: "table-update", tableId: "kali-tcp", rows: [] },
			],
		};
		const scenario: Scenario = {
			...HANDSHAKE_START,
			tables: [KALI_TABLE],
			steps: [twice],
		};

		expect(() => assertValidScenario(scenario)).toThrow("updated twice");
	});
});

describe("assertValidScenario · connexions", () => {
	const SSH = {
		id: "ssh",
		endpointMachineIds: ["kali", "target"] as const,
		label: "TCP 10.0.0.5:54321 ⇄ 10.0.0.10:22",
	};

	function openingStep(connectionId: string): Step {
		return {
			title: "Ouverture",
			explanation: "",
			events: [{ kind: "connection-update", connectionId, state: "opening" }],
		};
	}

	test("accepte une connexion entre deux machines connues", () => {
		const scenario: Scenario = {
			...HANDSHAKE_START,
			connections: [SSH],
			steps: [openingStep("ssh")],
		};

		expect(() => assertValidScenario(scenario)).not.toThrow();
	});

	test("refuse une connexion vers une machine inconnue", () => {
		const scenario: Scenario = {
			...HANDSHAKE_START,
			connections: [{ ...SSH, endpointMachineIds: ["kali", "router"] }],
		};

		expect(() => assertValidScenario(scenario)).toThrow(
			"unknown machine router",
		);
	});

	test("refuse une connexion d'une machine vers elle-même", () => {
		const scenario: Scenario = {
			...HANDSHAKE_START,
			connections: [{ ...SSH, endpointMachineIds: ["kali", "kali"] }],
		};

		expect(() => assertValidScenario(scenario)).toThrow("to itself");
	});

	test("refuse la mise à jour d'une connexion inconnue", () => {
		const scenario: Scenario = {
			...HANDSHAKE_START,
			steps: [openingStep("ghost")],
		};

		expect(() => assertValidScenario(scenario)).toThrow(
			"unknown connection ghost",
		);
	});
});
