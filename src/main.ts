import GUI from "lil-gui";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
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

// Démo provisoire : premier branchement de la timeline sur la scène.
// Elle partira dans src/concepts/firewall/ quand le concept sera monté.

/** Une étape du scénario : le paquet va de `from` à `to` pendant l'étape. */
type DemoStep = {
	readonly durationInMs: number;
	readonly explanation: string;
	readonly from: THREE.Vector3;
	readonly to: THREE.Vector3;
};

const KALI_POSITION = new THREE.Vector3(-4, 0, 0);
const FIREWALL_POSITION = new THREE.Vector3(0, 0, 0);
const TARGET_POSITION = new THREE.Vector3(4, 0, 0);
/** L'interface WAN est le côté du pare-feu tourné vers Kali. */
const WAN_INTERFACE_POSITION = new THREE.Vector3(-0.6, 0, 0);

const DEMO_STEPS: readonly DemoStep[] = [
	{
		durationInMs: 2000,
		explanation:
			"Kali envoie un paquet TCP SYN vers le port 22 de la cible. " +
			"La cible est derrière le pare-feu : le paquet doit d'abord " +
			"atteindre l'interface WAN d'OPNsense.",
		from: KALI_POSITION,
		to: WAN_INTERFACE_POSITION,
	},
	{
		durationInMs: 1500,
		explanation:
			"Le paquet est arrivé sur l'interface WAN. Avant toute règle, " +
			"pf consulte sa table d'état pour savoir si la connexion est " +
			"déjà connue.",
		from: WAN_INTERFACE_POSITION,
		to: WAN_INTERFACE_POSITION,
	},
];

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
	60,
	innerWidth / innerHeight,
	0.1,
	100,
);
camera.position.set(0, 4, 8);
new OrbitControls(camera, renderer.domElement);

scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const sunLight = new THREE.DirectionalLight(0xffffff, 1.5);
sunLight.position.set(3, 6, 4);
scene.add(sunLight);

scene.add(createMachine(KALI_POSITION, 0x3b82f6));
scene.add(createMachine(FIREWALL_POSITION, 0xf97316));
scene.add(createMachine(TARGET_POSITION, 0x22c55e));
scene.add(createCable(KALI_POSITION, FIREWALL_POSITION));
scene.add(createCable(FIREWALL_POSITION, TARGET_POSITION));

const packet = new THREE.Mesh(
	new THREE.SphereGeometry(0.15),
	new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0x806000 }),
);
scene.add(packet);

const explanationPanel = document.createElement("div");
explanationPanel.className = "explanation";
document.body.appendChild(explanationPanel);

let timeline: Timeline = createTimeline(
	DEMO_STEPS.map((step) => step.durationInMs),
);

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

window.addEventListener("resize", () => {
	camera.aspect = innerWidth / innerHeight;
	camera.updateProjectionMatrix();
	renderer.setSize(innerWidth, innerHeight);
});

let previousFrameTimeInMs: number | null = null;

renderer.setAnimationLoop((frameTimeInMs: number) => {
	const frameDurationInMs =
		previousFrameTimeInMs === null ? 0 : frameTimeInMs - previousFrameTimeInMs;
	previousFrameTimeInMs = frameTimeInMs;

	timeline = advance(timeline, frameDurationInMs);
	renderTimeline(timeline);
	renderer.render(scene, camera);
});

/** La scène ne décide rien : elle dessine l'état de la timeline. */
function renderTimeline(currentTimeline: Timeline): void {
	const { stepIndex, progress } = positionOf(currentTimeline);
	const step = stepAt(stepIndex);

	packet.position.lerpVectors(step.from, step.to, easeInOut(progress));

	const explanation = `Étape ${stepIndex + 1}/${DEMO_STEPS.length} — ${step.explanation}`;
	// Écrire dans le DOM à chaque image est coûteux : seulement si le texte change.
	if (explanationPanel.textContent !== explanation) {
		explanationPanel.textContent = explanation;
	}
}

function stepAt(stepIndex: number): DemoStep {
	const step = DEMO_STEPS[stepIndex];
	if (step === undefined) throw new Error(`No demo step at ${stepIndex}`);
	return step;
}

function easeInOut(progress: number): number {
	return progress < 0.5
		? 2 * progress * progress
		: 1 - (-2 * progress + 2) ** 2 / 2;
}

function createMachine(position: THREE.Vector3, color: number): THREE.Mesh {
	const machine = new THREE.Mesh(
		new THREE.BoxGeometry(1.2, 0.8, 1.2),
		new THREE.MeshStandardMaterial({ color }),
	);
	machine.position.copy(position);
	return machine;
}

function createCable(from: THREE.Vector3, to: THREE.Vector3): THREE.Line {
	return new THREE.Line(
		new THREE.BufferGeometry().setFromPoints([from, to]),
		new THREE.LineBasicMaterial({ color: 0x64748b }),
	);
}
