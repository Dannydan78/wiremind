/**
 * Le menu d'accueil : une carte par concept. Une carte disponible est un
 * lien vers l'adresse du concept ; une carte à venir est grisée.
 */

import type { ConceptEntry, Unmount } from "../concept";
import { toHash } from "../route";
import { createElement } from "./dom";

export function mountConceptMenu(
	container: HTMLElement,
	entries: readonly ConceptEntry[],
): Unmount {
	const menu = createElement("div", "concept-menu");
	menu.append(
		createElement("h1", "menu-title", "WireMind"),
		createElement(
			"p",
			"menu-subtitle",
			"Des modèles mentaux en 3D pour le réseau et la cybersécurité : voir les paquets circuler et les décisions se prendre, étape par étape.",
		),
	);

	const grid = createElement("ul", "concept-grid");
	grid.append(...entries.map(createCard));
	menu.append(grid);
	container.appendChild(menu);

	return () => {
		menu.remove();
	};
}

function createCard(entry: ConceptEntry): HTMLLIElement {
	const item = createElement("li", "");
	const card =
		entry.status === "available"
			? createElement("a", "concept-card")
			: createElement("div", "concept-card is-planned");
	if (card instanceof HTMLAnchorElement) {
		card.href = toHash({ page: "concept", conceptId: entry.id });
	}
	card.append(
		createElement("h2", "concept-title", entry.title),
		createElement("p", "concept-summary", entry.summary),
	);
	if (entry.status === "planned") {
		card.append(createElement("span", "concept-badge", "À venir"));
	}
	item.append(card);
	return item;
}
