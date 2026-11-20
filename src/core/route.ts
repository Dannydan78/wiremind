/**
 * Une adresse par page : `#tcp-handshake` ouvre ce concept, une adresse
 * vide ou inconnue ouvre le menu. Le bouton Retour du navigateur marche
 * donc sans code supplémentaire.
 */

export type Route =
	| { readonly page: "menu" }
	| { readonly page: "concept"; readonly conceptId: string };

export function parseRoute(
	hash: string,
	availableConceptIds: readonly string[],
): Route {
	const conceptId = decodeHash(hash.replace(/^#/, ""));
	if (conceptId === undefined) return { page: "menu" };
	if (!availableConceptIds.includes(conceptId)) return { page: "menu" };
	return { page: "concept", conceptId };
}

/** `undefined` si l'adresse est malformée (`#%E0` fait lever une erreur). */
function decodeHash(encoded: string): string | undefined {
	try {
		return decodeURIComponent(encoded);
	} catch {
		return undefined;
	}
}

export function toHash(route: Route): string {
	return route.page === "menu"
		? "#"
		: `#${encodeURIComponent(route.conceptId)}`;
}
