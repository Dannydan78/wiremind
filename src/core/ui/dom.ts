/**
 * Création d'éléments DOM. Le texte passe toujours par `textContent`,
 * jamais par `innerHTML` : une capture rejouée ne peut pas injecter de HTML.
 */

export function createElement<Tag extends keyof HTMLElementTagNameMap>(
	tag: Tag,
	className: string,
	text?: string,
): HTMLElementTagNameMap[Tag] {
	const element = document.createElement(tag);
	element.className = className;
	if (text !== undefined) element.textContent = text;
	return element;
}
