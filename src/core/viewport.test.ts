import { describe, expect, test } from "bun:test";
import { toNormalizedPointer } from "./viewport";

// Une scène de 800 × 600 à gauche d'une colonne latérale.
const SCENE = { left: 0, top: 0, width: 800, height: 600 };

describe("toNormalizedPointer", () => {
	test("le centre de la scène vaut (0, 0)", () => {
		expect(toNormalizedPointer({ clientX: 400, clientY: 300 }, SCENE)).toEqual({
			x: 0,
			y: 0,
		});
	});

	test("les coins valent ±1, avec y vers le haut", () => {
		expect(toNormalizedPointer({ clientX: 0, clientY: 0 }, SCENE)).toEqual({
			x: -1,
			y: 1,
		});
		expect(toNormalizedPointer({ clientX: 800, clientY: 600 }, SCENE)).toEqual({
			x: 1,
			y: -1,
		});
	});

	test("se mesure dans la zone de la scène, pas dans la fenêtre", () => {
		const shifted = { left: 100, top: 50, width: 800, height: 600 };

		expect(
			toNormalizedPointer({ clientX: 500, clientY: 350 }, shifted),
		).toEqual({ x: 0, y: 0 });
	});
});
