import * as THREE from "https://unpkg.com/three@0.149.0/build/three.module.js";

// Initialize scene, camera, and renderer
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
	75,
	window.innerWidth / window.innerHeight,
	0.1,
	10000
);
camera.position.set(0, 0, 50);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Create starfield
const starCount = 10000;
const starGeometry = new THREE.BufferGeometry();
const starPositions = new Float32Array(starCount * 3);
for (let i = 0; i < starCount; i++) {
	starPositions[i * 3] = (Math.random() - 0.5) * 2000; // X
	starPositions[i * 3 + 1] = (Math.random() - 0.5) * 2000; // Y
	starPositions[i * 3 + 2] = (Math.random() - 0.5) * 2000; // Z
}
starGeometry.setAttribute(
	"position",
	new THREE.BufferAttribute(starPositions, 3)
);
const starMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: 1 });
const stars = new THREE.Points(starGeometry, starMaterial);
scene.add(stars);

// Planet shaders (unchanged)
const cityPlanetShader = {
	uniforms: { time: { value: 0 } },
	vertexShader: `
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vViewDir;
        void main() {
            vUv = uv;
            vNormal = normalize(normalMatrix * normal);
            vec3 pos = (modelViewMatrix * vec4(position, 1.0)).xyz;
            vViewDir = normalize(-pos);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
	fragmentShader: `
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vViewDir;
        float noise(vec2 p) {
            return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }
        void main() {
            float largeScale = noise(vUv * 2.0);
            float smallScale = noise(vUv * 20.0);
            float intensity = largeScale * smallScale;
            vec3 baseColor = vec3(1.0, 1.0, 0.8); // Yellowish city lights
            vec3 color = baseColor * step(0.5, intensity);
            float fresnel = pow(1.0 - max(dot(vNormal, vViewDir), 0.0), 3.0);
            color += vec3(0.1, 0.1, 0.2) * fresnel; // Bluish atmosphere
            gl_FragColor = vec4(color, 1.0);
        }
    `
};

const gasPlanetShader = {
	uniforms: { time: { value: 0 } },
	vertexShader: `
        varying vec2 vUv;
        varying vec3 vNormal;
        void main() {
            vUv = uv;
            vNormal = normalize(normalMatrix * normal);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
	fragmentShader: `
        varying vec2 vUv;
        varying vec3 vNormal;
        float noise(vec2 p) {
            return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }
        void main() {
            float bands = sin(vUv.y * 10.0 + noise(vUv * 5.0));
            vec3 color = mix(vec3(0.8, 0.4, 0.2), vec3(0.6, 0.2, 0.1), smoothstep(0.4, 0.6, bands));
            gl_FragColor = vec4(color, 1.0);
        }
    `
};

// Updated CameraController
class CameraController {
	constructor(camera) {
		this.camera = camera;
		this.moveSpeed = 0.1; // Movement speed for WASD
		this.rotateSpeed = 0.001; // Mouse rotation sensitivity
		this.isLocked = false; // Right mouse held down state
		this.euler = new THREE.Euler(0, 0, 0, "YXZ"); // Rotation order: yaw then pitch
		this.velocity = new THREE.Vector3(); // Movement velocity

		// Disable default right-click context menu
		renderer.domElement.addEventListener("contextmenu", (e) =>
			e.preventDefault()
		);

		// Event listeners
		renderer.domElement.addEventListener(
			"mousedown",
			this.onMouseDown.bind(this)
		);
		renderer.domElement.addEventListener("mouseup", this.onMouseUp.bind(this));
		window.addEventListener("mousemove", this.onMouseMove.bind(this));
		window.addEventListener("wheel", this.onWheel.bind(this));
		window.addEventListener("keydown", this.onKeyDown.bind(this));
		window.addEventListener("keyup", this.onKeyUp.bind(this));
	}

	onMouseDown(event) {
		if (event.button === 2) {
			// Right mouse button
			renderer.domElement.requestPointerLock();
			this.isLocked = true;
		}
	}

	onMouseUp(event) {
		if (event.button === 2) {
			// Right mouse button
			document.exitPointerLock();
			this.isLocked = false;
		}
	}

	onMouseMove(event) {
		if (!this.isLocked) return;
		const movementX = event.movementX || 0;
		const movementY = event.movementY || 0;
		this.euler.y -= movementX * this.rotateSpeed; // Yaw
		this.euler.x = Math.max(
			-Math.PI / 2,
			Math.min(Math.PI / 2, this.euler.x - movementY * this.rotateSpeed)
		); // Pitch, clamped
		this.camera.quaternion.setFromEuler(this.euler);
	}

	onWheel(event) {
		// Zoom by moving along forward vector
		const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(
			this.camera.quaternion
		);
		this.camera.position.add(forward.multiplyScalar(event.deltaY * -0.1));
	}

	onKeyDown(event) {
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
		}
	}

	update() {
		// Move camera based on velocity and orientation
		const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(
			this.camera.quaternion
		);
		const right = new THREE.Vector3(1, 0, 0).applyQuaternion(
			this.camera.quaternion
		);
		this.camera.position.add(forward.multiplyScalar(this.velocity.z));
		this.camera.position.add(right.multiplyScalar(this.velocity.x));
	}
}

// Planet class (unchanged except for zoom methods)
class Planet {
	constructor(radius, centerPosition, numPoints, shader) {
		this.radius = radius;
		this.mesh = new THREE.Mesh(
			new THREE.SphereGeometry(radius, 64, 64),
			new THREE.ShaderMaterial({
				uniforms: shader.uniforms,
				vertexShader: shader.vertexShader,
				fragmentShader: shader.fragmentShader
			})
		);
		this.mesh.position.copy(centerPosition);
		this.points = [];
		this.zoomState = { active: false, target: null, progress: 0, speed: 0.05 };

		for (let i = 0; i < numPoints; i++) {
			const theta = Math.random() * Math.PI * 2;
			const phi = Math.acos(2 * Math.random() - 1);
			const x = radius * Math.sin(phi) * Math.cos(theta);
			const y = radius * Math.sin(phi) * Math.sin(theta);
			const z = radius * Math.cos(phi);
			const pointPosition = new THREE.Vector3(x, y, z).add(centerPosition);
			const normal = pointPosition.clone().sub(this.mesh.position).normalize();

			const marker = new THREE.Sprite(
				new THREE.SpriteMaterial({ color: 0xff0000 })
			);
			marker.position.copy(pointPosition).add(normal.multiplyScalar(0.1));
			marker.scale.set(0.2, 0.2, 0.2);
			this.points.push({ marker, position: pointPosition });
		}
	}

	addToScene(scene) {
		scene.add(this.mesh);
		this.points.forEach((p) => scene.add(p.marker));
	}

	getPoints() {
		return this.points;
	}

	zoomToPoint(point) {
		this.zoomState.active = true;
		this.zoomState.target = point.position;
		this.zoomState.progress = 0;
	}

	zoomOut() {
		this.zoomState.active = true;
		this.zoomState.target = null;
		this.zoomState.progress = 0;
	}

	updateZoom() {
		if (!this.zoomState.active) return;

		this.zoomState.progress += this.zoomState.speed;
		if (this.zoomState.progress >= 1) {
			this.zoomState.progress = 1;
			this.zoomState.active = false;
		}

		const t = this.zoomState.progress;
		const easeT = 1 - Math.pow(1 - t, 4); // Ease-in-out effect

		if (this.zoomState.target) {
			const startPos = camera.position.clone();
			const direction = this.zoomState.target.clone().sub(startPos).normalize();
			const targetPos = this.zoomState.target
				.clone()
				.sub(direction.multiplyScalar(2));
			camera.position.lerpVectors(startPos, targetPos, easeT);
		} else {
			const startPos = camera.position.clone();
			const targetPos = new THREE.Vector3(12.5, 0, 50);
			camera.position.lerpVectors(startPos, targetPos, easeT);
		}
	}
}

// Create camera controller
const cameraController = new CameraController(camera);

// Create two planets
const cityPlanet = new Planet(
	10,
	new THREE.Vector3(0, 0, 0),
	5,
	cityPlanetShader
);
const gasPlanet = new Planet(
	8,
	new THREE.Vector3(25, 0, 0),
	3,
	gasPlanetShader
);
cityPlanet.addToScene(scene);
gasPlanet.addToScene(scene);

const allPoints = [...cityPlanet.getPoints(), ...gasPlanet.getPoints()];

// Raycasting setup
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let selectedPlanet = null;

function onMouseClick(event) {
	if (event.button !== 0 || cameraController.isLocked) return; // Only left click, ignore when locked

	mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
	mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
	raycaster.setFromCamera(mouse, camera);

	const intersects = raycaster.intersectObjects(allPoints.map((p) => p.marker));
	if (intersects.length > 0) {
		const selectedPoint = allPoints.find(
			(p) => p.marker === intersects[0].object
		);
		selectedPlanet = cityPlanet.getPoints().includes(selectedPoint)
			? cityPlanet
			: gasPlanet;

		// Reset previous highlights
		allPoints.forEach((p) => {
			p.marker.material.color.set(0xff0000);
			p.marker.scale.set(0.2, 0.2, 0.2);
		});

		// Highlight the marker
		selectedPoint.marker.material.color.set(0xffff00);
		selectedPoint.marker.scale.set(0.3, 0.3, 0.3);

		// Zoom to the point
		selectedPlanet.zoomToPoint(selectedPoint);
	}
}

function onKeyDown(event) {
	if (event.key === "Escape" && selectedPlanet) {
		selectedPlanet.zoomOut();
		allPoints.forEach((p) => {
			p.marker.material.color.set(0xff0000);
			p.marker.scale.set(0.2, 0.2, 0.2);
		});
		selectedPlanet = null;
	}
	cameraController.onKeyDown(event);
}

function onKeyUp(event) {
	cameraController.onKeyUp(event);
}

window.addEventListener("mousedown", onMouseClick); // Changed to mousedown for button check
window.addEventListener("keydown", onKeyDown);
window.addEventListener("keyup", onKeyUp);

// Animation loop
function animate() {
	requestAnimationFrame(animate);
	cityPlanet.updateZoom();
	gasPlanet.updateZoom();
	cameraController.update();
	renderer.render(scene, camera);
	stars.rotation.y += 0.0001; // Slow starfield rotation
}
animate();

// Add basic lighting
const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(10, 10, 10);
scene.add(directionalLight);

// Handle window resize
window.addEventListener("resize", () => {
	renderer.setSize(window.innerWidth, window.innerHeight);
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
});
