/**
 * Le panneau d'étape : le titre du scénario, sa présentation, puis l'étape
 * en cours et son explication.
 */

import type { Scenario } from "../scenario";
import type { ScenarioSnapshot } from "../snapshot";
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
	);
	const stepCounter = createElement("p", "step-counter");
	const stepTitle = createElement("h2", "step-title");
	const stepExplanation = createElement("p", "step-explanation");
	panel.append(stepCounter, stepTitle, stepExplanation);
	container.appendChild(panel);

	let renderedStepIndex: number | null = null;

	return {
		render: ({ stepIndex, step }) => {
			// Rendu à chaque image : on ne touche au DOM que si l'étape change.
			if (stepIndex === renderedStepIndex) return;
			renderedStepIndex = stepIndex;
			stepCounter.textContent = `Étape ${stepIndex + 1} sur ${scenario.steps.length}`;
			stepTitle.textContent = step.title;
			stepExplanation.textContent = step.explanation;
		},
	};
}
