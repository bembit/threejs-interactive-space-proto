import * as THREE from "https://esm.sh/three";

// Scene setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
	75,
	window.innerWidth / window.innerHeight,
	0.1,
	10000
);
const initialPosition = new THREE.Vector3(0, 0, 50);
camera.position.copy(initialPosition);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// Starfield
const starCount = 10000;
const starGeometry = new THREE.BufferGeometry();
const starPositions = new Float32Array(starCount * 3);
for (let i = 0; i < starCount; i++) {
	starPositions[i * 3] = (Math.random() - 0.5) * 2000;
	starPositions[i * 3 + 1] = (Math.random() - 0.5) * 2000;
	starPositions[i * 3 + 2] = (Math.random() - 0.5) * 2000;
}
starGeometry.setAttribute(
	"position",
	new THREE.BufferAttribute(starPositions, 3)
);
const starMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: 1 });
const stars = new THREE.Points(starGeometry, starMaterial);
scene.add(stars);

// CameraController (unchanged)
class CameraController {
	constructor(camera) {
		this.camera = camera;
		this.moveSpeed = 0.1;
		this.rotateSpeed = 0.001;
		this.isLocked = false;
		this.euler = new THREE.Euler(0, 0, 0, "YXZ");
		this.velocity = new THREE.Vector3();
		this.targetPosition = null;
		this.targetQuaternion = null;
		this.targetPoint = null;
		this.previousPosition = camera.position.clone();
		this.originalQuaternion = camera.quaternion.clone();
		this.zoomMessage = document.getElementById("zoomMessage");

		renderer.domElement.addEventListener("contextmenu", (e) =>
			e.preventDefault()
		);
		renderer.domElement.addEventListener(
			"mousedown",
			this.onMouseDown.bind(this)
		);
		renderer.domElement.addEventListener("mouseup", this.onMouseUp.bind(this));
		window.addEventListener("mousemove", this.onMouseMove.bind(this));
		window.addEventListener("wheel", this.onWheel.bind(this));
		window.addEventListener("keydown", (e) => this.onKeyDown(e));
		window.addEventListener("keyup", (e) => this.onKeyUp(e));
	}

	onMouseDown(event) {
		if (event.button === 2) {
			renderer.domElement.requestPointerLock();
			this.isLocked = true;
		}
	}

	onMouseUp(event) {
		if (event.button === 2) {
			document.exitPointerLock();
			this.isLocked = false;
		}
	}

	onMouseMove(event) {
		if (!this.isLocked) return;
		const movementX = event.movementX || 0;
		const movementY = event.movementY || 0;
		this.euler.y -= movementX * this.rotateSpeed;
		this.euler.x = Math.max(
			-Math.PI / 2,
			Math.min(Math.PI / 2, this.euler.x - movementY * this.rotateSpeed)
		);
		this.camera.quaternion.setFromEuler(this.euler);
	}

	onWheel(event) {
		if (this.targetPosition || this.targetQuaternion || this.targetPoint) return;
		const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(
			this.camera.quaternion
		);
		this.camera.position.add(forward.multiplyScalar(event.deltaY * -0.1));
	}

	onKeyDown(event) {
		if (event.key === "Escape" && selectedPlanet) {
			selectedPlanet.zoomOut(this);
			allPoints.forEach((p) => {
				p.marker.material.color.set(0x00ffff);
				p.marker.scale.set(0.5, 0.5, 0.5);
			});
			selectedPlanet = null;
			this.targetPoint = null;
		} else if (
			!this.targetPosition &&
			!this.targetQuaternion &&
			!this.targetPoint
		) {
			switch (event.key) {
				case "w":
					this.velocity.z = this.moveSpeed;
					break;
				case "s":
					this.velocity.z = -this.moveSpeed;
					break;
				case "a":
					this.velocity.x = -this.moveSpeed;
					break;
				case "d":
					this.velocity.x = this.moveSpeed;
					break;
				case " ":
					this.velocity.y = this.moveSpeed;
					break;
				case "Shift":
					this.velocity.y = -this.moveSpeed;
					break;
			}
		}
	}

	onKeyUp(event) {
		switch (event.key) {
			case "w":
			case "s":
				this.velocity.z = 0;
				break;
			case "a":
			case "d":
				this.velocity.x = 0;
				break;
			case " ":
			case "Shift":
				this.velocity.y = 0;
				break;
		}
	}

	animateCamera() {
		const positionStep = 0.02;
		const rotationStep = 0.05;

		if (this.targetPosition || this.targetQuaternion) {
			this.zoomMessage.style.display = "block";
			if (this.targetPosition) {
				this.camera.position.lerp(this.targetPosition, positionStep);
				if (this.camera.position.distanceTo(this.targetPosition) < 0.05) {
					this.camera.position.copy(this.targetPosition);
					this.targetPosition = null;
				}
			}
			if (this.targetQuaternion) {
				this.camera.quaternion.slerp(this.targetQuaternion, rotationStep);
				if (this.camera.quaternion.angleTo(this.targetQuaternion) < 0.001) {
					this.camera.quaternion.copy(this.targetQuaternion);
					this.targetQuaternion = null;
				}
			}
			if (!this.targetPosition && !this.targetQuaternion) {
				this.zoomMessage.style.display = this.targetPoint ? "block" : "none";
			}
		}
	}

	update() {
		if (this.targetPosition || this.targetQuaternion) {
			this.animateCamera();
		} else if (this.targetPoint) {
			const worldPosition = this.targetPoint.marker.getWorldPosition(
				new THREE.Vector3()
			);
			const planetCenter = this.targetPoint.marker.parent.position;
			const normal = worldPosition.clone().sub(planetCenter).normalize();
			const distanceAbove = 5;
			const targetPosition = worldPosition
				.clone()
				.add(normal.multiplyScalar(distanceAbove));
			this.camera.position.lerp(targetPosition, 0.01);
			this.camera.lookAt(worldPosition);
			this.zoomMessage.style.display = "block";
		} else {
			const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(
				this.camera.quaternion
			);
			const right = new THREE.Vector3(1, 0, 0).applyQuaternion(
				this.camera.quaternion
			);
			this.camera.position.add(forward.multiplyScalar(this.velocity.z));
			this.camera.position.add(right.multiplyScalar(this.velocity.x));
			this.camera.position.add(
				new THREE.Vector3(0, 1, 0).multiplyScalar(this.velocity.y)
			);
			this.zoomMessage.style.display = "none";
		}
	}

	resetZoom() {
		if (this.previousPosition && this.originalQuaternion) {
			this.targetPosition = this.previousPosition.clone();
			this.targetQuaternion = this.originalQuaternion.clone();
			this.targetPoint = null;
		}
	}
}

// Planet class
class Planet {
	constructor(
		radius,
		centerPosition,
		numPoints,
		color,
		rotationSpeed = 0.001,
		rotationAxis = new THREE.Vector3(0, 1, 0),
		orbitalRadius = 0,
		orbitalSpeed = 0
	) {
		this.radius = radius;
		this.mesh = new THREE.Mesh(
			new THREE.SphereGeometry(radius, 64, 64),
			new THREE.MeshStandardMaterial({ color: color })
		);
		this.mesh.position.copy(centerPosition);
		this.mesh.castShadow = true;
		this.mesh.receiveShadow = true;
		this.points = [];
		this.rotationSpeed = Math.random() * 0.0001 + 0.001;
		this.rotationAxis = new THREE.Vector3(
			Math.random() * 0.4 - 0.2,
			1,
			Math.random() * 0.4 - 0.2
		).normalize();
		this.orbitalRadius = orbitalRadius;
		this.orbitalSpeed = orbitalSpeed;
		this.orbitalAngle = Math.random() * Math.PI * 2;

		for (let i = 0; i < numPoints; i++) {
			const theta = Math.random() * Math.PI * 2;
			const phi = Math.acos(2 * Math.random() - 1);
			const x = radius * Math.sin(phi) * Math.cos(theta);
			const y = radius * Math.sin(phi) * Math.sin(theta);
			const z = radius * Math.cos(phi);
			const localPosition = new THREE.Vector3(x, y, z);
			const normal = localPosition.clone().normalize();

			const marker = new THREE.Sprite(
				new THREE.SpriteMaterial({ color: 0x00ffff })
			);
			marker.position.copy(localPosition).add(normal.multiplyScalar(0.1));
			marker.scale.set(0.5, 0.5, 0.5);
			this.mesh.add(marker);
			this.points.push({ marker, localPosition });
		}
	}

	addToScene(scene) {
		scene.add(this.mesh);
	}

	getPoints() {
		return this.points.map((p) => ({
			marker: p.marker,
			position: p.marker.getWorldPosition(new THREE.Vector3())
		}));
	}

	zoomToPoint(point, controller) {
		const distanceAbove = 5;
		controller.previousPosition = controller.camera.position.clone();
		controller.originalQuaternion = controller.camera.quaternion.clone();
		controller.targetPoint = point;
	}

	zoomOut(controller) {
		controller.resetZoom();
	}

	update() {
		this.mesh.rotateOnAxis(this.rotationAxis, this.rotationSpeed);
		if (this.orbitalRadius > 0) {
			this.orbitalAngle += this.orbitalSpeed;
			this.mesh.position.x = Math.cos(this.orbitalAngle) * this.orbitalRadius;
			this.mesh.position.z = Math.sin(this.orbitalAngle) * this.orbitalRadius;
		}
	}
}

// Instantiate objects
const cameraController = new CameraController(camera);

const planets = [
	(function () {
		const sunPlanet = new Planet(
			15,
			new THREE.Vector3(0, 0, 0),
			0,
			0xffff00,
			0.001,
			new THREE.Vector3(0, 1, 0),
			0,
			0
		);
		const sunLight = new THREE.DirectionalLight(0xffffff, 3);
		sunLight.position.set(0, 0, -50);
		sunLight.target.position.set(0, 0, 1); // Direction toward positive z
		sunLight.castShadow = true;
		sunLight.shadow.mapSize.width = 1024;
		sunLight.shadow.mapSize.height = 1024;
		sunLight.shadow.camera.near = 0.1;
		sunLight.shadow.camera.far = 400;
		sunLight.shadow.camera.left = -400;
		sunLight.shadow.camera.right = 400;
		sunLight.shadow.camera.top = 100;
		sunLight.shadow.camera.bottom = -100;
		scene.add(sunLight);
		scene.add(sunLight.target);

		const helper = new THREE.CameraHelper(sunLight.shadow.camera);
		scene.add(helper);
		return sunPlanet;
	})(),
	new Planet(
		8,
		new THREE.Vector3(25, 0, 0),
		3,
		0x00ff00,
		0.002,
		new THREE.Vector3(0, 1, 0),
		55,
		0.0001
	),
	new Planet(
		10,
		new THREE.Vector3(35, 0, 0),
		5,
		0x0000ff,
		0.00015,
		new THREE.Vector3(0, 1, 0.1),
		135,
		0.0008
	),
	new Planet(
		8,
		new THREE.Vector3(45, 0, 0),
		4,
		0xff0000,
		0.0008,
		new THREE.Vector3(0.1, 1, 0),
		85,
		0.0006
	),
	new Planet(
		12,
		new THREE.Vector3(55, 0, 0),
		6,
		0xffa500,
		0.0012,
		new THREE.Vector3(0, 1, 0),
		165,
		0.0005
	),
	new Planet(
		7,
		new THREE.Vector3(65, 0, 0),
		3,
		0x800080,
		0.0025,
		new THREE.Vector3(0, 1, -0.1),
		225,
		0.0004
	),
	new Planet(
		15,
		new THREE.Vector3(75, 0, 0),
		7,
		0x00ffff,
		0.001,
		new THREE.Vector3(0.2, 1, 0),
		300,
		0.0003
	),
	new Planet(
		9,
		new THREE.Vector3(85, 0, 0),
		4,
		0xff00ff,
		0.0018,
		new THREE.Vector3(0, 1, 0.2),
		400,
		0.0001
	)
];

planets.forEach((planet) => planet.addToScene(scene));
const allPoints = planets.flatMap((planet) => planet.getPoints());

// Raycasting
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let selectedPlanet = null;

function onMouseClick(event) {
	if (event.button !== 0 || cameraController.isLocked) return;
	mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
	mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
	raycaster.setFromCamera(mouse, camera);

	const intersects = raycaster.intersectObjects(allPoints.map((p) => p.marker));
	if (intersects.length > 0) {
		const selectedPoint = allPoints.find(
			(p) => p.marker === intersects[0].object
		);
		selectedPlanet = planets.find((planet) =>
			planet.points.some((p) => p.marker === selectedPoint.marker)
		);

		if (!selectedPlanet) {
			console.error("No planet found for selected point:", selectedPoint);
			return;
		}

		allPoints.forEach((p) => {
			p.marker.material.color.set(0x00ffff);
			p.marker.scale.set(0.5, 0.5, 0.5);
		});

		selectedPoint.marker.material.color.set(0xffff00);
		selectedPoint.marker.scale.set(0.7, 0.7, 0.7);

		const planetPoint = selectedPlanet.points.find(
			(p) => p.marker === selectedPoint.marker
		);
		selectedPlanet.zoomToPoint(planetPoint, cameraController);
	}
}

window.addEventListener("mousedown", onMouseClick);

// Lighting
const ambientLight = new THREE.AmbientLight(0x404040, 1);
scene.add(ambientLight);

// Animation loop
function animate() {
	requestAnimationFrame(animate);
	planets.forEach((planet) => planet.update());
	cameraController.update();
	renderer.render(scene, camera);
	stars.rotation.y += 0.0001;
}
animate();

// Resize handler
window.addEventListener("resize", () => {
	renderer.setSize(window.innerWidth, window.innerHeight);
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
});
