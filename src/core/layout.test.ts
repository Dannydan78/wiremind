import { describe, expect, test } from "bun:test";
import { layOutMachines, MACHINE_SPACING } from "./layout";
import type { Machine, Topology } from "./topology";

function machine(id: string): Machine {
	return { id, label: id, role: "host", interfaces: [] };
}

function topologyOf(...machineIds: string[]): Topology {
	return { machines: machineIds.map(machine), links: [] };
}

describe("layOutMachines", () => {
	test("aligne les machines dans l'ordre, centrées sur l'origine", () => {
		const positions = layOutMachines(topologyOf("kali", "firewall", "target"));

		expect(positions.get("kali")).toEqual({ x: -MACHINE_SPACING, z: 0 });
		expect(positions.get("firewall")).toEqual({ x: 0, z: 0 });
		expect(positions.get("target")).toEqual({ x: MACHINE_SPACING, z: 0 });
	});

	test("centre aussi un nombre pair de machines", () => {
		const positions = layOutMachines(topologyOf("kali", "target"));

		expect(positions.get("kali")).toEqual({ x: -MACHINE_SPACING / 2, z: 0 });
		expect(positions.get("target")).toEqual({ x: MACHINE_SPACING / 2, z: 0 });
	});
});
