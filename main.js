import * as THREE from "https://esm.sh/three";

// Initialize scene, camera, and renderer
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
            vec3 baseColor = vec3(1.0, 1.0, 0.8);
            vec3 color = baseColor * step(0.5, intensity);
            float fresnel = pow(1.0 - max(dot(vNormal, vViewDir), 0.0), 3.0);
            color += vec3(0.1, 0.1, 0.2) * fresnel;
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

const earthLikePlanetShader = {
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

        float fbm(vec2 p) {
            float v = 0.0;
            float a = 0.5;
            vec2 shift = vec2(100.0);
            for (int i = 0; i < 6; ++i) {
                v += a * noise(p);
                p = p * 2.0 + shift;
                a *= 0.5;
            }
            return v;
        }

        void main() {
            vec2 st = vUv * 10.0;
            float n = fbm(st);
            float threshold = 0.5;
            vec3 waterColor = vec3(0.0, 0.3, 0.7);
            vec3 landColor = vec3(0.1, 0.7, 0.1);
            vec3 color = mix(waterColor, landColor, step(threshold, n));
            gl_FragColor = vec4(color, 1.0);
        }
    `
};

// CameraController with shift/escape reset support
class CameraController {
	constructor(camera) {
		this.camera = camera;
		this.moveSpeed = 0.1;
		this.rotateSpeed = 0.001;
		this.isLocked = false;
		this.euler = new THREE.Euler(0, 0, 0, "YXZ");
		this.velocity = new THREE.Vector3();

		// For zoom animations:
		this.targetPosition = null;
		this.targetQuaternion = null; // New: target rotation for zoom animations

		// Store the camera’s original state:
		this.previousPosition = camera.position.clone();
		this.originalQuaternion = camera.quaternion.clone();

		this.zoomMessage = document.getElementById("zoomMessage"); // Get overlay element
		// Event listeners...
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
		window.addEventListener("keydown", (e) => this.handleMovementKeys(e));
		window.addEventListener("keyup", (e) => this.handleMovementKeys(e));
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
		const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(
			this.camera.quaternion
		);
		this.camera.position.add(forward.multiplyScalar(event.deltaY * -0.1));
	}

	// We can break out with Shift and Space, but the return point will still be the before zoom snapshot.
	// this is both a bug and a cool feature

	// Separate method for movement keys (WASD) only.
	handleMovementKeys(event) {
		if (this.targetPosition) return; // Disable WASD while animating zoom

		if (event.type === "keydown") {
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
				// Adding Q and E for up and down.
				case " ":
					this.velocity.y = this.moveSpeed;
					break;
				case "Shift":
					this.velocity.y = -this.moveSpeed;
					break;
			}
		} else if (event.type === "keyup") {
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
	}

	// Called in the global keydown for zoom-out (ESC or Shift)
	resetZoom() {
		if (this.previousPosition) {
			this.targetPosition = this.previousPosition.clone();
		}
	}

	// animateCamera() {
	// 	const step = 0.02;
	// 	if (this.targetPosition) {
	// 		this.camera.position.lerp(this.targetPosition, step);
	// 		if (this.camera.position.distanceTo(this.targetPosition) < 0.1) {
	// 			this.camera.position.copy(this.targetPosition);
	// 			this.targetPosition = null;
	// 		}
	// 	}
	// 	if (this.targetQuaternion) {
	// 		this.camera.quaternion.slerp(this.targetQuaternion, step);
	// 		// Check if the rotation is close enough:
	// 		if (this.camera.quaternion.angleTo(this.targetQuaternion) < 0.01) {
	// 			this.camera.quaternion.copy(this.targetQuaternion);
	// 			this.targetQuaternion = null;
	// 		}
	// 	}
	// }

	animateCamera() {
		// Use separate step values for position and rotation if needed.
		const positionStep = 0.02; // You might try increasing this to 0.03-0.05 for a snappier finish.
		const rotationStep = 0.05; // Increase this value so rotation converges faster.

		if (this.targetPosition || this.targetQuaternion) {
			this.zoomMessage.style.display = "block"; // Show message
		}

		if (this.targetPosition) {
			this.camera.position.lerp(this.targetPosition, positionStep);
			if (this.camera.position.distanceTo(this.targetPosition) < 0.05) {
				// Increased threshold
				this.camera.position.copy(this.targetPosition);
				this.targetPosition = null;
			}
		}
		if (this.targetQuaternion) {
			this.camera.quaternion.slerp(this.targetQuaternion, rotationStep);
			if (this.camera.quaternion.angleTo(this.targetQuaternion) < 0.001) {
				// Increased threshold
				this.camera.quaternion.copy(this.targetQuaternion);
				this.targetQuaternion = null;
			}
		}

		// Hide message when zooming finishes
		if (!this.targetPosition && !this.targetQuaternion) {
			this.zoomMessage.style.display = "none";
		}
	}

	update() {
		// Allow movement only when not animating zoom
		if (!this.targetPosition && !this.targetQuaternion) {
			const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(
				this.camera.quaternion
			);
			const right = new THREE.Vector3(1, 0, 0).applyQuaternion(
				this.camera.quaternion
			);
			// const vertical = new THREE.Vector3(0, 1, 0);

			this.camera.position.add(forward.multiplyScalar(this.velocity.z));
			this.camera.position.add(right.multiplyScalar(this.velocity.x));
			// this.camera.position.add(vertical.multiplyScalar(this.velocity.y));
			this.camera.position.add(
				new THREE.Vector3(0, 1, 0).multiplyScalar(this.velocity.y)
			);
		}
		this.animateCamera();
	}

	// Called from global keydown for reset zoom (ESC/Shift)
	resetZoom() {
		// Set the target position and rotation back to the stored original values:
		if (this.previousPosition && this.originalQuaternion) {
			this.targetPosition = this.previousPosition.clone();
			this.targetQuaternion = this.originalQuaternion.clone();
		}
	}
}

// Planet class with updated zoom functions
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

		for (let i = 0; i < numPoints; i++) {
			const theta = Math.random() * Math.PI * 2;
			const phi = Math.acos(2 * Math.random() - 1);
			const x = radius * Math.sin(phi) * Math.cos(theta);
			const y = radius * Math.sin(phi) * Math.sin(theta);
			const z = radius * Math.cos(phi);
			const pointPosition = new THREE.Vector3(x, y, z).add(centerPosition);
			const normal = pointPosition.clone().sub(this.mesh.position).normalize();

			const marker = new THREE.Sprite(
				new THREE.SpriteMaterial({ color: 0x00ffff })
			);
			// Place marker slightly off the surface
			marker.position.copy(pointPosition).add(normal.multiplyScalar(0.1));
			marker.scale.set(0.5, 0.5, 0.5);
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

	// Before zooming, store the current camera position as the "origin"
	// zoomToPoint(point, controller) {
	// 	// Before zooming in, save the current state.
	// 	controller.previousPosition = controller.camera.position.clone();
	// 	controller.originalQuaternion = controller.camera.quaternion.clone();
	// 	// Zoom in by setting the target position (using the point’s position)
	// 	controller.targetPosition = point.position.clone();
	// 	// Optionally, set a targetQuaternion that makes the camera look at the point.
	// 	// For example, you can compute a quaternion from lookAt:
	// 	const tempCam = new THREE.PerspectiveCamera();
	// 	tempCam.position.copy(controller.camera.position);
	// 	tempCam.lookAt(point.position);
	// 	controller.targetQuaternion = tempCam.quaternion.clone();
	// }

	zoomToPoint(point, controller) {
		const minDistance = 3; // Adjust this value as needed
		controller.previousPosition = controller.camera.position.clone();
		controller.originalQuaternion = controller.camera.quaternion.clone();

		// Direction from the point to the camera
		const direction = new THREE.Vector3()
			.subVectors(controller.camera.position, point.position)
			.normalize();

		// Set target position at minDistance away from the point
		controller.targetPosition = point.position
			.clone()
			.add(direction.multiplyScalar(minDistance));

		// Make camera look at the point
		const tempCam = new THREE.PerspectiveCamera();
		tempCam.position.copy(controller.targetPosition);
		tempCam.lookAt(point.position);
		controller.targetQuaternion = tempCam.quaternion.clone();
	}

	zoomOut(controller) {
		// On zoom out, reset the camera back to its stored state.
		controller.resetZoom();
	}
}

// Create camera controller
const cameraController = new CameraController(camera);

// Create three planets
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
const testPlanet = new Planet(
	6,
	new THREE.Vector3(25, 44, 33),
	9,
	earthLikePlanetShader
);
cityPlanet.addToScene(scene);
gasPlanet.addToScene(scene);
testPlanet.addToScene(scene);

const allPoints = [
	...cityPlanet.getPoints(),
	...gasPlanet.getPoints(),
	...testPlanet.getPoints()
];

// Raycasting setup
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let selectedPlanet = null;

function onMouseClick(event) {
	// Only react to left-click and when not in pointer lock mode.
	if (event.button !== 0 || cameraController.isLocked) return;

	mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
	mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
	raycaster.setFromCamera(mouse, camera);

	const intersects = raycaster.intersectObjects(allPoints.map((p) => p.marker));
	if (intersects.length > 0) {
		const selectedPoint = allPoints.find(
			(p) => p.marker === intersects[0].object
		);
		// Determine which planet was clicked based on point membership
		selectedPlanet = cityPlanet.getPoints().includes(selectedPoint)
			? cityPlanet
			: gasPlanet;

		// Reset previous highlights
		allPoints.forEach((p) => {
			// 0x00ffff ?
			p.marker.material.color.set(0x00ffff);
			p.marker.scale.set(0.5, 0.5, 0.5);
		});

		// Highlight the clicked marker
		selectedPoint.marker.material.color.set(0xffff00);
		selectedPoint.marker.scale.set(0.7, 0.7, 0.7);

		// Zoom to the point; the planet method now stores the origin.
		selectedPlanet.zoomToPoint(selectedPoint, cameraController);
	}
}

function onKeyDown(event) {
	// If ESC or Shift is pressed and a planet is selected, zoom out.
	// if ((event.key === "Escape" || event.key === "Shift") && selectedPlanet) {
	if (event.key === "Escape" && selectedPlanet) {
		selectedPlanet.zoomOut(cameraController);
		// Reset marker highlights
		allPoints.forEach((p) => {
			// 0x00ffff ?
			p.marker.material.color.set(0x00ffff);
			p.marker.scale.set(0.5, 0.5, 0.5);
		});
		selectedPlanet = null;
	}
	// Note: movement keys are handled inside CameraController
}

window.addEventListener("mousedown", onMouseClick);
window.addEventListener("keydown", onKeyDown);

// Animation loop
function animate() {
	requestAnimationFrame(animate);
	cameraController.update();
	renderer.render(scene, camera);
	stars.rotation.y += 0.0001;
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
