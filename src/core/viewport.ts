/**
 * La zone où la scène 3D est dessinée, et la conversion d'une position de
 * souris vers les coordonnées qu'attend three.js.
 */

export type ViewportRect = {
	readonly left: number;
	readonly top: number;
	readonly width: number;
	readonly height: number;
};

/**
 * Coordonnées normalisées : −1 à gauche et en bas, +1 à droite et en haut,
 * mesurées dans la zone de la scène et non dans la fenêtre. Sinon, dès que
 * la scène ne remplit pas la fenêtre, le clic vise à côté.
 */
export function toNormalizedPointer(
	{ clientX, clientY }: { readonly clientX: number; readonly clientY: number },
	rect: ViewportRect,
): { readonly x: number; readonly y: number } {
	return {
		x: ((clientX - rect.left) / rect.width) * 2 - 1,
		y: -((clientY - rect.top) / rect.height) * 2 + 1,
	};
}
