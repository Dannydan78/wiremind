/**
 * Le panneau d'étape : le titre du scénario, sa présentation et la
 * commande qui le reproduit dans le labo, puis l'étape en cours et son
 * explication. À la dernière étape, le résumé de ce qu'il faut retenir.
 */

import type { Scenario } from "../scenario";
import type { ScenarioSnapshot } from "../snapshot";
import { findMachine } from "../topology";
import { createElement } from "./dom";

export type StepPanel = {
	readonly render: (snapshot: ScenarioSnapshot) => void;
};

export function createStepPanel(
	container: HTMLElement,
	scenario: Scenario,
): StepPanel {
	const panel = createElement("section", "panel step-panel");
	panel.append(
		createElement("h1", "scenario-title", scenario.title),
		createElement("p", "scenario-overview", scenario.overview),
		createTriggerElement(scenario),
	);
	const stepCounter = createElement("p", "step-counter");
	const stepTitle = createElement("h2", "step-title");
	const stepExplanation = createElement("p", "step-explanation");
	const summary = createSummaryElement(scenario.summary);
	panel.append(stepCounter, stepTitle, stepExplanation, summary);
	container.appendChild(panel);

	const lastStepIndex = scenario.steps.length - 1;
	let renderedStepIndex: number | null = null;

	return {
		render: ({ stepIndex, step }) => {
			// Rendu à chaque image : on ne touche au DOM que si l'étape change.
			if (stepIndex === renderedStepIndex) return;
			renderedStepIndex = stepIndex;
			stepCounter.textContent = `Étape ${stepIndex + 1} sur ${scenario.steps.length}`;
			stepTitle.textContent = step.title;
			stepExplanation.textContent = step.explanation;
			// Le résumé conclut : il n'apparaît qu'à la dernière étape.
			summary.hidden = stepIndex !== lastStepIndex;
		},
	};
}

/** « Sur Kali : ssh <utilisateur>@192.168.64.3 », façon terminal. */
function createTriggerElement({ trigger, topology }: Scenario): HTMLElement {
	const machine = findMachine(topology, trigger.machineId);
	const machineLabel = machine?.label ?? trigger.machineId;

	const element = createElement("div", "scenario-trigger");
	element.append(
		createElement(
			"span",
			"trigger-machine",
			`Dans le labo, sur ${machineLabel}`,
		),
		createElement("code", "trigger-command", `$ ${trigger.command}`),
	);
	return element;
}

function createSummaryElement(paragraphs: readonly string[]): HTMLElement {
	const element = createElement("div", "scenario-summary");
	element.hidden = true;
	element.append(createElement("h3", "summary-title", "À retenir"));
	for (const paragraph of paragraphs) {
		element.append(createElement("p", "", paragraph));
	}
	return element;
}
