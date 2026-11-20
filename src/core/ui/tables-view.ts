/**
 * Les tables du scénario (états TCP, règles, table d'état…), une par
 * panneau. Les lignes apparues ou modifiées à l'étape en cours sont mises
 * en évidence.
 */

import type { TableState } from "../snapshot";
import { createElement } from "./dom";

export type TablesView = {
	readonly render: (stepIndex: number, tables: readonly TableState[]) => void;
};

export function createTablesView(container: HTMLElement): TablesView {
	const section = createElement("div", "tables");
	container.appendChild(section);
	let renderedStepIndex: number | null = null;

	return {
		render: (stepIndex, tables) => {
			// Les tables ne changent qu'en changeant d'étape.
			if (stepIndex === renderedStepIndex) return;
			renderedStepIndex = stepIndex;
			section.replaceChildren(...tables.map(createTablePanel));
		},
	};
}

function createTablePanel({
	definition,
	rows,
	changedRowIndexes,
}: TableState): HTMLElement {
	const panel = createElement("section", "panel table-panel");
	panel.append(createElement("h2", "panel-title", definition.title));

	const table = createElement("table", "state-table");
	const header = createElement("thead", "");
	const headerRow = createElement("tr", "");
	for (const column of definition.columns) {
		headerRow.append(createElement("th", "", column));
	}
	header.append(headerRow);

	const body = createElement("tbody", "");
	rows.forEach((row, rowIndex) => {
		const isChanged = changedRowIndexes.includes(rowIndex);
		const tableRow = createElement("tr", isChanged ? "is-changed" : "");
		for (const cell of row) tableRow.append(createElement("td", "", cell));
		body.append(tableRow);
	});
	table.append(header, body);
	panel.append(table);

	if (rows.length === 0) {
		panel.append(createElement("p", "empty-hint", "Aucune entrée."));
	}
	return panel;
}
