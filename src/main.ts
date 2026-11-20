/**
 * Point d'entrée : affiche le menu ou le concept désigné par l'adresse,
 * et passe de l'un à l'autre en démontant proprement la page précédente.
 */

import { CONCEPTS } from "./catalog";
import type { Unmount } from "./core/concept";
import { parseRoute, type Route, toHash } from "./core/route";
import { mountConceptMenu } from "./core/ui/concept-menu";
import { createElement } from "./core/ui/dom";

const APP_TITLE = "WireMind";

const AVAILABLE_CONCEPT_IDS = CONCEPTS.filter(
	(entry) => entry.status === "available",
).map((entry) => entry.id);

let unmountCurrentPage: Unmount = () => {};
// Chaque navigation reçoit un numéro : si l'utilisateur change de page
// pendant le chargement d'un concept, ce chargement est abandonné.
let latestNavigation = 0;

async function showRoute(route: Route): Promise<void> {
	latestNavigation += 1;
	const navigation = latestNavigation;
	unmountCurrentPage();
	unmountCurrentPage = () => {};

	const page = createElement("main", "page");
	document.body.appendChild(page);

	if (route.page === "menu") {
		document.title = APP_TITLE;
		const unmountMenu = mountConceptMenu(page, CONCEPTS);
		unmountCurrentPage = () => {
			unmountMenu();
			page.remove();
		};
		return;
	}

	const entry = CONCEPTS.find((candidate) => candidate.id === route.conceptId);
	if (entry === undefined || entry.status !== "available") {
		throw new Error(`Concept ${route.conceptId} is not available`);
	}
	document.title = `${APP_TITLE} · ${entry.title}`;
	unmountCurrentPage = () => page.remove();

	try {
		const conceptModule = await entry.load();
		if (navigation !== latestNavigation) return;
		const unmountConcept = conceptModule.mount(page);
		page.append(createBackLink());
		unmountCurrentPage = () => {
			unmountConcept();
			page.remove();
		};
	} catch (error) {
		// Échouer visiblement plutôt que laisser une page vide.
		page.append(
			createElement(
				"p",
				"load-error",
				`Impossible de charger « ${entry.title} » : ${String(error)}`,
			),
			createBackLink(),
		);
	}
}

function createBackLink(): HTMLAnchorElement {
	const link = createElement("a", "back-link", "← Concepts");
	link.href = toHash({ page: "menu" });
	return link;
}

function showCurrentRoute(): void {
	void showRoute(parseRoute(window.location.hash, AVAILABLE_CONCEPT_IDS));
}

window.addEventListener("hashchange", showCurrentRoute);
showCurrentRoute();
