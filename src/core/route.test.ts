import { describe, expect, test } from "bun:test";
import { parseRoute, toHash } from "./route";

const AVAILABLE = ["tcp-handshake"];

describe("parseRoute", () => {
	test("une adresse vide ouvre le menu", () => {
		expect(parseRoute("", AVAILABLE)).toEqual({ page: "menu" });
		expect(parseRoute("#", AVAILABLE)).toEqual({ page: "menu" });
	});

	test("l'id d'un concept disponible ouvre ce concept", () => {
		expect(parseRoute("#tcp-handshake", AVAILABLE)).toEqual({
			page: "concept",
			conceptId: "tcp-handshake",
		});
	});

	test("un concept inconnu ou pas encore disponible ramène au menu", () => {
		expect(parseRoute("#firewall", AVAILABLE)).toEqual({ page: "menu" });
		expect(parseRoute("#n-importe-quoi", AVAILABLE)).toEqual({ page: "menu" });
	});

	test("une adresse malformée ramène au menu au lieu de planter", () => {
		expect(parseRoute("#%E0", AVAILABLE)).toEqual({ page: "menu" });
	});
});

describe("toHash", () => {
	test("redonne l'adresse d'une page", () => {
		expect(toHash({ page: "menu" })).toBe("#");
		expect(toHash({ page: "concept", conceptId: "tcp-handshake" })).toBe(
			"#tcp-handshake",
		);
	});

	test("aller-retour : l'adresse d'un concept le rouvre", () => {
		const route = { page: "concept", conceptId: "tcp-handshake" } as const;

		expect(parseRoute(toHash(route), AVAILABLE)).toEqual(route);
	});
});
