import type { Unmount } from "../../core/concept";
import { mountScenarioPlayer } from "../../core/scenario-player";
import { SSH_HANDSHAKE } from "./scenarios";

export function mount(container: HTMLElement): Unmount {
	return mountScenarioPlayer(container, SSH_HANDSHAKE);
}
