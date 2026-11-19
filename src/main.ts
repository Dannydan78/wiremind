import GUI from "lil-gui";
import * as THREE from "three";
import { SSH_HANDSHAKE } from "./concepts/tcp-handshake/scenarios";
import { layOutMachines } from "./core/layout";
import { summarizePacket } from "./core/packet";
import { createPacketView } from "./core/packet-view";
import { assertValidScenario } from "./core/scenario";
import { createStage } from "./core/scene";
import { snapshotAt, stepDurationsOf } from "./core/snapshot";
import {
	advance,
	createTimeline,
	pause,
	play,
	positionOf,
	restart,
	setSpeed,
	stepBackward,
	stepForward,
	type Timeline,
} from "./core/timeline";
import { createTopologyView } from "./core/topology-view";

// Point d'entrée provisoire : charge directement le scénario de validation.
// Le menu des concepts (étape 6) le remplacera.

const scenario = SSH_HANDSHAKE;
assertValidScenario(scenario);

const stage = createStage(document.body);
const positions = layOutMachines(scenario.topology);
stage.scene.add(createTopologyView(scenario.topology, positions));
const packetView = createPacketView(positions);
stage.scene.add(packetView.group);

const explanationPanel = document.createElement("div");
explanationPanel.className = "explanation";
document.body.appendChild(explanationPanel);

let timeline: Timeline = createTimeline(stepDurationsOf(scenario));
let selectedPacketId: string | null = null;
let selectedPacketSummary = "";

const playbackControls = {
	togglePlayback: () => {
		timeline =
			timeline.playback === "playing" ? pause(timeline) : play(timeline);
	},
	stepBackward: () => {
		timeline = stepBackward(timeline);
	},
	stepForward: () => {
		timeline = stepForward(timeline);
	},
	restart: () => {
		timeline = restart(timeline);
	},
	speed: timeline.speed,
};

const gui = new GUI({ title: "Lecture" });
gui.add(playbackControls, "togglePlayback").name("Lecture / pause (espace)");
gui.add(playbackControls, "stepBackward").name("Étape précédente (←)");
gui.add(playbackControls, "stepForward").name("Étape suivante (→)");
gui.add(playbackControls, "restart").name("Recommencer");
gui
	.add(playbackControls, "speed", 0.25, 4, 0.25)
	.name("Vitesse")
	.onChange((speed: number) => {
		timeline = setSpeed(timeline, speed);
	});

const KEY_TO_ACTION: Record<string, () => void> = {
	Space: playbackControls.togglePlayback,
	ArrowLeft: playbackControls.stepBackward,
	ArrowRight: playbackControls.stepForward,
};

window.addEventListener("keydown", (event) => {
	const action = KEY_TO_ACTION[event.code];
	if (action === undefined) return;
	event.preventDefault();
	action();
});

// Un glisser de la souris fait tourner la caméra : seul un clic presque
// immobile sélectionne un paquet.
const MAX_CLICK_DRIFT_IN_PX = 4;
let pointerDownAt: { x: number; y: number } | null = null;

stage.canvas.addEventListener("pointerdown", (event) => {
	pointerDownAt = { x: event.clientX, y: event.clientY };
});

stage.canvas.addEventListener("pointerup", (event) => {
	if (pointerDownAt === null) return;
	const drift = Math.hypot(
		event.clientX - pointerDownAt.x,
		event.clientY - pointerDownAt.y,
	);
	pointerDownAt = null;
	if (drift > MAX_CLICK_DRIFT_IN_PX) return;

	const pointer = new THREE.Vector2(
		(event.clientX / window.innerWidth) * 2 - 1,
		-(event.clientY / window.innerHeight) * 2 + 1,
	);
	const packet = packetView.findPacketAt(pointer, stage.camera);
	selectedPacketId = packet?.id ?? null;
	selectedPacketSummary = packet === undefined ? "" : summarizePacket(packet);
	// L'inspecteur (étape 5) s'ouvrira ici. En attendant, le paquet
	// sélectionné grossit et son résumé s'affiche sous l'explication.
});

stage.start((frameDurationInMs) => {
	timeline = advance(timeline, frameDurationInMs);
	const snapshot = snapshotAt(scenario, positionOf(timeline));
	packetView.render(snapshot, selectedPacketId);

	const stepCount = scenario.steps.length;
	const selection =
		selectedPacketSummary === ""
			? ""
			: `\nPaquet sélectionné : ${selectedPacketSummary}`;
	const explanation = `Étape ${snapshot.stepIndex + 1}/${stepCount} · ${snapshot.step.title} — ${snapshot.step.explanation}${selection}`;
	// Écrire dans le DOM à chaque image est coûteux : seulement si le texte change.
	if (explanationPanel.textContent !== explanation) {
		explanationPanel.textContent = explanation;
	}
});
