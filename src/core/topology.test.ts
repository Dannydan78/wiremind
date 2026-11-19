import { describe, expect, test } from "bun:test";
import {
	assertValidTopology,
	findLinkBetween,
	findMachine,
	type Machine,
	type Topology,
} from "./topology";

const KALI: Machine = {
	id: "kali",
	label: "Kali",
	role: "host",
	interfaces: [
		{
			name: "eth0",
			ipv4Address: "10.0.0.5",
			prefixLength: 24,
			macAddress: "08:00:27:aa:aa:aa",
		},
	],
};

const TARGET: Machine = {
	id: "target",
	label: "Cible",
	role: "host",
	interfaces: [
		{
			name: "eth0",
			ipv4Address: "10.0.0.10",
			prefixLength: 24,
			macAddress: "08:00:27:bb:bb:bb",
		},
	],
};

const SAME_SEGMENT: Topology = {
	machines: [KALI, TARGET],
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

describe("findMachine", () => {
	test("trouve une machine par son id", () => {
		expect(findMachine(SAME_SEGMENT, "target")).toBe(TARGET);
	});

	test("ne trouve rien pour un id inconnu", () => {
		expect(findMachine(SAME_SEGMENT, "router")).toBeUndefined();
	});
});

describe("findLinkBetween", () => {
	test("trouve le câble dans les deux sens", () => {
		expect(findLinkBetween(SAME_SEGMENT, "kali", "target")?.id).toBe(
			"kali-target",
		);
		expect(findLinkBetween(SAME_SEGMENT, "target", "kali")?.id).toBe(
			"kali-target",
		);
	});

	test("ne trouve rien entre deux machines non reliées", () => {
		const withoutLink: Topology = { ...SAME_SEGMENT, links: [] };

		expect(findLinkBetween(withoutLink, "kali", "target")).toBeUndefined();
	});
});

describe("assertValidTopology", () => {
	test("accepte une topologie cohérente", () => {
		expect(() => assertValidTopology(SAME_SEGMENT)).not.toThrow();
	});

	test("refuse deux machines avec le même id", () => {
		const topology: Topology = { machines: [KALI, KALI], links: [] };

		expect(() => assertValidTopology(topology)).toThrow("kali");
	});

	test("refuse deux interfaces du même nom sur une machine", () => {
		const [eth0] = KALI.interfaces;
		if (eth0 === undefined) throw new Error("fixture without interface");
		const kaliWithTwoEth0: Machine = { ...KALI, interfaces: [eth0, eth0] };

		expect(() =>
			assertValidTopology({ machines: [kaliWithTwoEth0], links: [] }),
		).toThrow("eth0");
	});

	test("refuse un câble branché sur une interface qui n'existe pas", () => {
		const topology: Topology = {
			machines: [KALI, TARGET],
			links: [
				{
					id: "broken",
					ends: [
						{ machineId: "kali", interfaceName: "eth1" },
						{ machineId: "target", interfaceName: "eth0" },
					],
				},
			],
		};

		expect(() => assertValidTopology(topology)).toThrow("kali/eth1");
	});

	test("refuse deux câbles sur la même interface", () => {
		const [link] = SAME_SEGMENT.links;
		if (link === undefined) throw new Error("fixture without link");
		const topology: Topology = {
			...SAME_SEGMENT,
			links: [link, { ...link, id: "second-cable" }],
		};

		expect(() => assertValidTopology(topology)).toThrow("more than one link");
	});
});
