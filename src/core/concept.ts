/**
 * Ce qu'un concept expose au menu. Le menu ne connaît que ce contrat :
 * il charge le concept à la demande (import dynamique) et l'installe
 * dans la page.
 */

/** Retire tout ce que le concept a installé : DOM, écouteurs, scène 3D. */
export type Unmount = () => void;

export type ConceptModule = {
	readonly mount: (container: HTMLElement) => Unmount;
};

export type ConceptEntry =
	| {
			readonly status: "available";
			readonly id: string;
			readonly title: string;
			readonly summary: string;
			readonly load: () => Promise<ConceptModule>;
	  }
	| {
			readonly status: "planned";
			readonly id: string;
			readonly title: string;
			readonly summary: string;
	  };
