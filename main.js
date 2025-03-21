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

const vertexShader = `
    varying vec2 vUv;
    varying vec3 vNormal;

    void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

const earthLikePlanetShader = {
	uniforms: { time: { value: 0 } },
	vertexShader,
	fragmentShader: `
        varying vec2 vUv;
        varying vec3 vNormal;

        float hash(vec2 p) {
            return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
        }

        float pnoise(vec2 p, vec2 period) {
            vec2 i = mod(floor(p), period);
            vec2 f = fract(p);
            float a = hash(i);
            float b = hash(mod(i + vec2(1.0, 0.0), period));
            float c = hash(mod(i + vec2(0.0, 1.0), period));
            float d = hash(mod(i + vec2(1.0, 1.0), period));
            vec2 u = f * f * (3.0 - 2.0 * f);
            return mix(a, b, u.x) + (c - a)*u.y*(1.0 - u.x) + (d - b)*u.x*u.y;
        }

        float fbm(vec2 st) {
            float value = 0.0;
            float amplitude = 0.5;
            float frequency = 1.0;
            vec2 period = vec2(10.0, 10.0);
            for (int i = 0; i < 5; i++) {
                value += amplitude * pnoise(st * frequency, period);
                frequency *= 2.0;
                amplitude *= 0.5;
            }
            return value;
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

const marsLikePlanetShader = {
	uniforms: { time: { value: 0 } },
	vertexShader,
	fragmentShader: `
        varying vec2 vUv;
        varying vec3 vNormal;

        float hash(vec2 p) {
            return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
        }

        float pnoise(vec2 p, vec2 period) {
            vec2 i = mod(floor(p), period);
            vec2 f = fract(p);
            float a = hash(i);
            float b = hash(mod(i + vec2(1.0, 0.0), period));
            float c = hash(mod(i + vec2(0.0, 1.0), period));
            float d = hash(mod(i + vec2(1.0, 1.0), period));
            vec2 u = f * f * (3.0 - 2.0 * f);
            return mix(a, b, u.x) + (c - a)*u.y*(1.0 - u.x) + (d - b)*u.x*u.y;
        }

        float fbm(vec2 st) {
            float value = 0.0;
            float amplitude = 0.5;
            float frequency = 1.0;
            vec2 period = vec2(10.0, 10.0);
            for (int i = 0; i < 5; i++) {
                value += amplitude * pnoise(st * frequency, period);
                frequency *= 2.0;
                amplitude *= 0.5;
            }
            return value;
        }

        void main() {
            vec2 st = vUv * 10.0;
            float n = fbm(st);
            float threshold = 0.4;
            vec3 marsDark = vec3(0.5, 0.2, 0.1);
            vec3 marsLight = vec3(0.8, 0.4, 0.3);
            vec3 color = mix(marsDark, marsLight, step(threshold, n));
            gl_FragColor = vec4(color, 1.0);
        }
    `
};

const saturnLikePlanetShader = {
	uniforms: { time: { value: 0 } },
	vertexShader,
	fragmentShader: `
        varying vec2 vUv;
        varying vec3 vNormal;
        const float PI = 3.14159265359;

        void main() {
            float bands = abs(sin(vUv.y * PI * 10.0));
            vec3 saturnBase = vec3(0.9, 0.8, 0.6);
            vec3 saturnBand = vec3(0.8, 0.7, 0.5);
            vec3 color = mix(saturnBase, saturnBand, bands);
            gl_FragColor = vec4(color, 1.0);
        }
    `
};

const icyPlanetShader = {
	uniforms: { time: { value: 0 } },
	vertexShader,
	fragmentShader: `
        varying vec2 vUv;
        varying vec3 vNormal;

        float hash(vec2 p) {
            return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
        }

        float pnoise(vec2 p, vec2 period) {
            vec2 i = mod(floor(p), period);
            vec2 f = fract(p);
            float a = hash(i);
            float b = hash(mod(i + vec2(1.0, 0.0), period));
            float c = hash(mod(i + vec2(0.0, 1.0), period));
            float d = hash(mod(i + vec2(1.0, 1.0), period));
            vec2 u = f * f * (3.0 - 2.0 * f);
            return mix(a, b, u.x) + (c - a)*u.y*(1.0 - u.x) + (d - b)*u.x*u.y;
        }

        float fbm(vec2 st) {
            float value = 0.0;
            float amplitude = 0.5;
            float frequency = 1.0;
            vec2 period = vec2(10.0, 10.0);
            for (int i = 0; i < 5; i++) {
                value += amplitude * pnoise(st * frequency, period);
                frequency *= 2.0;
                amplitude *= 0.5;
            }
            return value;
        }

        void main() {
            vec2 st = vUv * 15.0;
            float n = fbm(st);
            float threshold = 0.45;
            vec3 iceBase = vec3(0.7, 0.8, 0.9);
            vec3 iceHighlight = vec3(0.9, 0.9, 1.0);
            vec3 color = mix(iceBase, iceHighlight, step(threshold, n));
            gl_FragColor = vec4(color, 1.0);
        }
    `
};

const gasGiantPlanetShader = {
	uniforms: { time: { value: 0 } },
	vertexShader,
	fragmentShader: `
        varying vec2 vUv;
        varying vec3 vNormal;
        const float PI = 3.14159265359;

        float hash(vec2 p) {
            return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
        }

        float pnoise(vec2 p, vec2 period) {
            vec2 i = mod(floor(p), period);
            vec2 f = fract(p);
            float a = hash(i);
            float b = hash(mod(i + vec2(1.0, 0.0), period));
            float c = hash(mod(i + vec2(0.0, 1.0), period));
            float d = hash(mod(i + vec2(1.0, 1.0), period));
            vec2 u = f * f * (3.0 - 2.0 * f);
            return mix(a, b, u.x) + (c - a)*u.y*(1.0 - u.x) + (d - b)*u.x*u.y;
        }

        float fbm(vec2 st) {
            float value = 0.0;
            float amplitude = 0.5;
            float frequency = 1.0;
            vec2 period = vec2(10.0, 10.0);
            for (int i = 0; i < 5; i++) {
                value += amplitude * pnoise(st * frequency, period);
                frequency *= 2.0;
                amplitude *= 0.5;
            }
            return value;
        }

        void main() {
            vec2 st = vUv * 20.0;
            float n = fbm(st);
            float swirl = abs(sin(vUv.x * PI * 20.0));
            vec3 baseColor = vec3(0.9, 0.6, 0.4);
            vec3 stormColor = vec3(0.7, 0.4, 0.2);
            vec3 color = mix(baseColor, stormColor, swirl * n);
            gl_FragColor = vec4(color, 1.0);
        }
    `
};

const volcanicPlanetShader = {
	uniforms: { time: { value: 0 } },
	vertexShader,
	fragmentShader: `
        varying vec2 vUv;
        varying vec3 vNormal;

        float hash(vec2 p) {
            return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
        }

        float pnoise(vec2 p, vec2 period) {
            vec2 i = mod(floor(p), period);
            vec2 f = fract(p);
            float a = hash(i);
            float b = hash(mod(i + vec2(1.0, 0.0), period));
            float c = hash(mod(i + vec2(0.0, 1.0), period));
            float d = hash(mod(i + vec2(1.0, 1.0), period));
            vec2 u = f * f * (3.0 - 2.0 * f);
            return mix(a, b, u.x) + (c - a)*u.y*(1.0 - u.x) + (d - b)*u.x*u.y;
        }

        float fbm(vec2 st) {
            float value = 0.0;
            float amplitude = 0.5;
            float frequency = 1.0;
            vec2 period = vec2(10.0, 10.0);
            for (int i = 0; i < 5; i++) {
                value += amplitude * pnoise(st * frequency, period);
                frequency *= 2.0;
                amplitude *= 0.5;
            }
            return value;
        }

        void main() {
            vec2 st = vUv * 10.0;
            float n = fbm(st);
            float threshold = 0.55;
            vec3 baseRock = vec3(0.2, 0.2, 0.2);
            vec3 lava = vec3(0.9, 0.3, 0.1);
            vec3 color = mix(baseRock, lava, smoothstep(threshold - 0.1, threshold + 0.1, n));
            gl_FragColor = vec4(color, 1.0);
        }
    `
};

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
	constructor(
		radius,
		centerPosition,
		numPoints,
		shader,
		rotationSpeed = 0.001,
		rotationAxis = new THREE.Vector3(0, 1, 0)
	) {
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
		// this.rotationSpeed = rotationSpeed; // Speed of rotation (radians per frame)
		// this.rotationAxis = rotationAxis.normalize(); // Axis of rotation (default Y-axis)

		this.rotationSpeed = Math.random() * 0.002 + 0.0005; // Random between 0.0005 and 0.0025
		this.rotationAxis = new THREE.Vector3(
			Math.random() * 0.4 - 0.2, // Slight X tilt
			1, // Dominant Y
			Math.random() * 0.4 - 0.2 // Slight Z tilt
		).normalize();

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

	// New method to update rotation
	update() {
		// Rotate the mesh around its specified axis
		this.mesh.rotateOnAxis(this.rotationAxis, this.rotationSpeed);

		// Update point markers to follow the planet's rotation
		this.points.forEach((point) => {
			// Transform the point's local position relative to the planet's center
			const localPos = point.position.clone().sub(this.mesh.position);
			localPos.applyAxisAngle(this.rotationAxis, this.rotationSpeed);
			point.marker.position.copy(this.mesh.position).add(localPos);
		});
	}
}

// Create camera controller
const cameraController = new CameraController(camera);

// create planets
const cityPlanet = new Planet(
	10,
	new THREE.Vector3(0, 0, 0),
	5,
	cityPlanetShader,
	0.001,
	new THREE.Vector3(0, 1, 0)
);
const gasPlanet = new Planet(
	8,
	new THREE.Vector3(25, 15, 0),
	3,
	gasPlanetShader,
	0.002,
	new THREE.Vector3(0, 1, 0)
);
const earthPlanet = new Planet(
	10,
	new THREE.Vector3(-30, -20, 0),
	5,
	earthLikePlanetShader,
	0.0015,
	new THREE.Vector3(0, 1, 0.1)
);
const marsPlanet = new Planet(
	8,
	new THREE.Vector3(-15, 20, 0),
	4,
	marsLikePlanetShader,
	0.0008,
	new THREE.Vector3(0.1, 1, 0)
);
const saturnPlanet = new Planet(
	12,
	new THREE.Vector3(40, 0, 0),
	6,
	saturnLikePlanetShader,
	0.0012,
	new THREE.Vector3(0, 1, 0)
);
const icyPlanet = new Planet(
	7,
	new THREE.Vector3(55, -15, -15),
	3,
	icyPlanetShader,
	0.0025,
	new THREE.Vector3(0, 1, -0.1)
);
const gasGiantPlanet = new Planet(
	15,
	new THREE.Vector3(70, 0, 35),
	7,
	gasGiantPlanetShader,
	0.001,
	new THREE.Vector3(0.2, 1, 0)
);
const volcanicPlanet = new Planet(
	9,
	new THREE.Vector3(85, 15, 15),
	4,
	volcanicPlanetShader,
	0.0018,
	new THREE.Vector3(0, 1, 0.2)
);

cityPlanet.addToScene(scene);
gasPlanet.addToScene(scene);
earthPlanet.addToScene(scene);
marsPlanet.addToScene(scene);
saturnPlanet.addToScene(scene);
icyPlanet.addToScene(scene);
gasGiantPlanet.addToScene(scene);
volcanicPlanet.addToScene(scene);

// Update allPoints
const allPoints = [
	...cityPlanet.getPoints(),
	...gasPlanet.getPoints(),
	...earthPlanet.getPoints(),
	...marsPlanet.getPoints(),
	...saturnPlanet.getPoints(),
	...icyPlanet.getPoints(),
	...gasGiantPlanet.getPoints(),
	...volcanicPlanet.getPoints()
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

// Temporary
const planets = [
	cityPlanet,
	gasPlanet,
	earthPlanet,
	marsPlanet,
	saturnPlanet,
	icyPlanet,
	gasGiantPlanet,
	volcanicPlanet
];

// Animation loop
function animate() {
	requestAnimationFrame(animate);

	planets.forEach((planet) => planet.update());

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
