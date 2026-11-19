import { describe, expect, test } from "bun:test";
import type { Packet, TcpFlag } from "./packet";
import { assertValidScenario, type Scenario, type Step } from "./scenario";
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
	steps: [synStep(kaliToTarget("syn", ["SYN"], 0, 0))],
};

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
