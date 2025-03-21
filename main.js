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
// renderer.shadowMap.enabled = true;
// renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Optional: softer shadows
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

const vertexShader = `
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vPosition; // Pass world position for lighting and shadows
    void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        vPosition = (modelMatrix * vec4(position, 1.0)).xyz; // World position
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

const commonNoiseFunctions = `
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
`;

const commonLightingAndShadows = `
    ${THREE.ShaderChunk.lights_pars_begin}
    ${THREE.ShaderChunk.shadowmap_pars_fragment}

    vec3 applyLightingAndShadows(vec3 baseColor, vec3 normal, vec3 position) {
        vec3 lightDir = normalize(position - pointLights[0].position);
        float diffuse = max(dot(normal, -lightDir), 0.0);
        float lightIntensity = pointLights[0].intensity / pow(length(position - pointLights[0].position), 2.0);
        vec3 diffuseColor = baseColor * diffuse * lightIntensity;

        float shadow = 1.0; // Default to fully lit
        #ifdef USE_SHADOWMAP
            vec4 shadowCoord = shadowProjectionMatrix[0] * shadowModelViewMatrix[0] * vec4(position, 1.0);
            shadow = unpackRGBAToDepth(texture2D(shadowMap[0], shadowCoord.xy));
            shadow = shadowCoord.z > shadow ? 0.0 : 1.0; // Basic shadow test
        #endif
        return diffuseColor * (0.2 + 0.8 * shadow); // Ambient + shadowed diffuse
    }
`;

const earthLikePlanetShader = {
	uniforms: {
		time: { value: 0 },
		...THREE.UniformsLib.lights,
		...THREE.UniformsLib.shadowmap
	},
	vertexShader,
	fragmentShader: `
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vPosition;
        ${commonNoiseFunctions}
        ${commonLightingAndShadows}
        void main() {
            vec2 st = vUv * 10.0;
            float n = fbm(st);
            float threshold = 0.5;
            vec3 waterColor = vec3(0.0, 0.3, 0.7);
            vec3 landColor = vec3(0.1, 0.7, 0.1);
            vec3 baseColor = mix(waterColor, landColor, step(threshold, n));
            vec3 finalColor = applyLightingAndShadows(baseColor, normalize(vNormal), vPosition);
            gl_FragColor = vec4(finalColor, 1.0);
        }
    `
};

const marsLikePlanetShader = {
	uniforms: {
		time: { value: 0 },
		...THREE.UniformsLib.lights,
		...THREE.UniformsLib.shadowmap
	},
	vertexShader,
	fragmentShader: `
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vPosition;
        ${commonNoiseFunctions}
        ${commonLightingAndShadows}
        void main() {
            vec2 st = vUv * 10.0;
            float n = fbm(st);
            float threshold = 0.4;
            vec3 marsDark = vec3(0.5, 0.2, 0.1);
            vec3 marsLight = vec3(0.8, 0.4, 0.3);
            vec3 baseColor = mix(marsDark, marsLight, step(threshold, n));
            vec3 finalColor = applyLightingAndShadows(baseColor, normalize(vNormal), vPosition);
            gl_FragColor = vec4(finalColor, 1.0);
        }
    `
};

const saturnLikePlanetShader = {
	uniforms: {
		time: { value: 0 },
		...THREE.UniformsLib.lights,
		...THREE.UniformsLib.shadowmap
	},
	vertexShader,
	fragmentShader: `
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vPosition;
        ${commonLightingAndShadows}
        const float PI = 3.14159265359;
        void main() {
            float bands = abs(sin(vUv.y * PI * 10.0));
            vec3 saturnBase = vec3(0.9, 0.8, 0.6);
            vec3 saturnBand = vec3(0.8, 0.7, 0.5);
            vec3 baseColor = mix(saturnBase, saturnBand, bands);
            vec3 finalColor = applyLightingAndShadows(baseColor, normalize(vNormal), vPosition);
            gl_FragColor = vec4(finalColor, 1.0);
        }
    `
};

const icyPlanetShader = {
	uniforms: {
		time: { value: 0 },
		...THREE.UniformsLib.lights,
		...THREE.UniformsLib.shadowmap
	},
	vertexShader,
	fragmentShader: `
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vPosition;
        ${commonNoiseFunctions}
        ${commonLightingAndShadows}
        void main() {
            vec2 st = vUv * 15.0;
            float n = fbm(st);
            float threshold = 0.45;
            vec3 iceBase = vec3(0.7, 0.8, 0.9);
            vec3 iceHighlight = vec3(0.9, 0.9, 1.0);
            vec3 baseColor = mix(iceBase, iceHighlight, step(threshold, n));
            vec3 finalColor = applyLightingAndShadows(baseColor, normalize(vNormal), vPosition);
            gl_FragColor = vec4(finalColor, 1.0);
        }
    `
};

const gasGiantPlanetShader = {
	uniforms: {
		time: { value: 0 },
		...THREE.UniformsLib.lights,
		...THREE.UniformsLib.shadowmap
	},
	vertexShader,
	fragmentShader: `
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vPosition;
        ${commonNoiseFunctions}
        ${commonLightingAndShadows}
        const float PI = 3.14159265359;
        void main() {
            vec2 st = vUv * 20.0;
            float n = fbm(st);
            float swirl = abs(sin(vUv.x * PI * 20.0));
            vec3 baseColor = vec3(0.9, 0.6, 0.4);
            vec3 stormColor = vec3(0.7, 0.4, 0.2);
            vec3 color = mix(baseColor, stormColor, swirl * n); // Fixed typo: 'swirl n' -> 'swirl * n'
            vec3 finalColor = applyLightingAndShadows(color, normalize(vNormal), vPosition);
            gl_FragColor = vec4(finalColor, 1.0);
        }
    `
};

const volcanicPlanetShader = {
	uniforms: {
		time: { value: 0 },
		...THREE.UniformsLib.lights,
		...THREE.UniformsLib.shadowmap
	},
	vertexShader,
	fragmentShader: `
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vPosition;
        ${commonNoiseFunctions}
        ${commonLightingAndShadows}
        void main() {
            vec2 st = vUv * 10.0;
            float n = fbm(st);
            float threshold = 0.55;
            vec3 baseRock = vec3(0.2, 0.2, 0.2);
            vec3 lava = vec3(0.9, 0.3, 0.1);
            vec3 baseColor = mix(baseRock, lava, smoothstep(threshold - 0.1, threshold + 0.1, n));
            vec3 finalColor = applyLightingAndShadows(baseColor, normalize(vNormal), vPosition);
            gl_FragColor = vec4(finalColor, 1.0);
        }
    `
};

const cityPlanetShader = {
	uniforms: {
		time: { value: 0 },
		...THREE.UniformsLib.lights,
		...THREE.UniformsLib.shadowmap
	},
	vertexShader: `
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vViewDir;
        varying vec3 vPosition;
        void main() {
            vUv = uv;
            vNormal = normalize(normalMatrix * normal);
            vec3 pos = (modelViewMatrix * vec4(position, 1.0)).xyz;
            vViewDir = normalize(-pos);
            vPosition = (modelMatrix * vec4(position, 1.0)).xyz;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
	fragmentShader: `
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vViewDir;
        varying vec3 vPosition;
        ${commonLightingAndShadows}
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
            vec3 finalColor = applyLightingAndShadows(color, normalize(vNormal), vPosition);
            gl_FragColor = vec4(finalColor, 1.0);
        }
    `
};

const gasPlanetShader = {
	uniforms: {
		time: { value: 0 },
		...THREE.UniformsLib.lights,
		...THREE.UniformsLib.shadowmap
	},
	vertexShader,
	fragmentShader: `
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vPosition;
        ${commonLightingAndShadows}
        float noise(vec2 p) {
            return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }
        void main() {
            float bands = sin(vUv.y * 10.0 + noise(vUv * 5.0));
            vec3 baseColor = mix(vec3(0.8, 0.4, 0.2), vec3(0.6, 0.2, 0.1), smoothstep(0.4, 0.6, bands));
            vec3 finalColor = applyLightingAndShadows(baseColor, normalize(vNormal), vPosition);
            gl_FragColor = vec4(finalColor, 1.0);
        }
    `
};

// // Common shader components
// const vertexShader = `
//     varying vec2 vUv;
//     varying vec3 vNormal;
//     void main() {
//         vUv = uv;
//         vNormal = normalize(normalMatrix * normal);
//         gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
//     }
// `;

// const commonNoiseFunctions = `
//     float hash(vec2 p) {
//         return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
//     }
//     float pnoise(vec2 p, vec2 period) {
//         vec2 i = mod(floor(p), period);
//         vec2 f = fract(p);
//         float a = hash(i);
//         float b = hash(mod(i + vec2(1.0, 0.0), period));
//         float c = hash(mod(i + vec2(0.0, 1.0), period));
//         float d = hash(mod(i + vec2(1.0, 1.0), period));
//         vec2 u = f * f * (3.0 - 2.0 * f);
//         return mix(a, b, u.x) + (c - a)*u.y*(1.0 - u.x) + (d - b)*u.x*u.y;
//     }
//     float fbm(vec2 st) {
//         float value = 0.0;
//         float amplitude = 0.5;
//         float frequency = 1.0;
//         vec2 period = vec2(10.0, 10.0);
//         for (int i = 0; i < 5; i++) {
//             value += amplitude * pnoise(st * frequency, period);
//             frequency *= 2.0;
//             amplitude *= 0.5;
//         }
//         return value;
//     }
// `;

// // Planet shaders
// const earthLikePlanetShader = {
// 	uniforms: {
// 		time: { value: 0 },
// 		// Add light-related uniforms (automatically provided by Three.js)
// 		...THREE.UniformsLib.lights,
// 		...THREE.UniformsLib.shadowmap
// 	},
// 	vertexShader: `
//         varying vec2 vUv;
//         varying vec3 vNormal;
//         varying vec3 vPosition; // Pass world position to fragment shader

//         void main() {
//             vUv = uv;
//             vNormal = normalize(normalMatrix * normal);
//             vPosition = (modelMatrix * vec4(position, 1.0)).xyz; // World position
//             gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
//         }
//     `,
// 	fragmentShader: `
//         varying vec2 vUv;
//         varying vec3 vNormal;
//         varying vec3 vPosition;

//         ${commonNoiseFunctions} // Your noise functions

//         // Include Three.js shadow and light utilities
//         ${THREE.ShaderChunk.lights_pars_begin}
//         ${THREE.ShaderChunk.shadowmap_pars_fragment}

//         void main() {
//             vec2 st = vUv * 10.0;
//             float n = fbm(st);
//             float threshold = 0.5;
//             vec3 waterColor = vec3(0.0, 0.3, 0.7);
//             vec3 landColor = vec3(0.1, 0.7, 0.1);
//             vec3 baseColor = mix(waterColor, landColor, step(threshold, n));

//             // Calculate lighting
//             vec3 normal = normalize(vNormal);
//             vec3 lightDir = normalize(vPosition - pointLights[0].position); // Direction to PointLight
//             float diffuse = max(dot(normal, -lightDir), 0.0);
//             float lightIntensity = pointLights[0].intensity / pow(length(vPosition - pointLights[0].position), 2.0); // Simple attenuation
//             vec3 diffuseColor = baseColor * diffuse * lightIntensity;

//             // Apply shadow
//             float shadow = 0.0;
//             #ifdef USE_SHADOWMAP
//                 shadow = getShadow(
//                     shadowMap[0],           // Shadow map from PointLight
//                     vPosition,              // World position
//                     normal,                 // Surface normal
//                     pointLights[0].position // Light position
//                 );
//             #endif
//             vec3 finalColor = diffuseColor * (0.2 + 0.8 * shadow); // Ambient + shadowed diffuse

//             gl_FragColor = vec4(finalColor, 1.0);
//         }
//     `
// };

// const marsLikePlanetShader = {
// 	uniforms: { time: { value: 0 } },
// 	vertexShader,
// 	fragmentShader: `
//         varying vec2 vUv;
//         varying vec3 vNormal;
//         ${commonNoiseFunctions}
//         void main() {
//             vec2 st = vUv * 10.0;
//             float n = fbm(st);
//             float threshold = 0.4;
//             vec3 marsDark = vec3(0.5, 0.2, 0.1);
//             vec3 marsLight = vec3(0.8, 0.4, 0.3);
//             vec3 color = mix(marsDark, marsLight, step(threshold, n));
//             gl_FragColor = vec4(color, 1.0);
//         }
//     `
// };

// const saturnLikePlanetShader = {
// 	uniforms: { time: { value: 0 } },
// 	vertexShader,
// 	fragmentShader: `
//         varying vec2 vUv;
//         varying vec3 vNormal;
//         const float PI = 3.14159265359;
//         void main() {
//             float bands = abs(sin(vUv.y * PI * 10.0));
//             vec3 saturnBase = vec3(0.9, 0.8, 0.6);
//             vec3 saturnBand = vec3(0.8, 0.7, 0.5);
//             vec3 color = mix(saturnBase, saturnBand, bands);
//             gl_FragColor = vec4(color, 1.0);
//         }
//     `
// };

// const icyPlanetShader = {
// 	uniforms: { time: { value: 0 } },
// 	vertexShader,
// 	fragmentShader: `
//         varying vec2 vUv;
//         varying vec3 vNormal;
//         ${commonNoiseFunctions}
//         void main() {
//             vec2 st = vUv * 15.0;
//             float n = fbm(st);
//             float threshold = 0.45;
//             vec3 iceBase = vec3(0.7, 0.8, 0.9);
//             vec3 iceHighlight = vec3(0.9, 0.9, 1.0);
//             vec3 color = mix(iceBase, iceHighlight, step(threshold, n));
//             gl_FragColor = vec4(color, 1.0);
//         }
//     `
// };

// const gasGiantPlanetShader = {
// 	uniforms: { time: { value: 0 } },
// 	vertexShader,
// 	fragmentShader: `
//         varying vec2 vUv;
//         varying vec3 vNormal;
//         const float PI = 3.14159265359;
//         ${commonNoiseFunctions}
//         void main() {
//             vec2 st = vUv * 20.0;
//             float n = fbm(st);
//             float swirl = abs(sin(vUv.x * PI * 20.0));
//             vec3 baseColor = vec3(0.9, 0.6, 0.4);
//             vec3 stormColor = vec3(0.7, 0.4, 0.2);
//             vec3 color = mix(baseColor, stormColor, swirl * n);
//             gl_FragColor = vec4(color, 1.0);
//         }
//     `
// };

// const volcanicPlanetShader = {
// 	uniforms: { time: { value: 0 } },
// 	vertexShader,
// 	fragmentShader: `
//         varying vec2 vUv;
//         varying vec3 vNormal;
//         ${commonNoiseFunctions}
//         void main() {
//             vec2 st = vUv * 10.0;
//             float n = fbm(st);
//             float threshold = 0.55;
//             vec3 baseRock = vec3(0.2, 0.2, 0.2);
//             vec3 lava = vec3(0.9, 0.3, 0.1);
//             vec3 color = mix(baseRock, lava, smoothstep(threshold - 0.1, threshold + 0.1, n));
//             gl_FragColor = vec4(color, 1.0);
//         }
//     `
// };

// const cityPlanetShader = {
// 	uniforms: { time: { value: 0 } },
// 	vertexShader: `
//         varying vec2 vUv;
//         varying vec3 vNormal;
//         varying vec3 vViewDir;
//         void main() {
//             vUv = uv;
//             vNormal = normalize(normalMatrix * normal);
//             vec3 pos = (modelViewMatrix * vec4(position, 1.0)).xyz;
//             vViewDir = normalize(-pos);
//             gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
//         }
//     `,
// 	fragmentShader: `
//         varying vec2 vUv;
//         varying vec3 vNormal;
//         varying vec3 vViewDir;
//         float noise(vec2 p) {
//             return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
//         }
//         void main() {
//             float largeScale = noise(vUv * 2.0);
//             float smallScale = noise(vUv * 20.0);
//             float intensity = largeScale * smallScale;
//             vec3 baseColor = vec3(1.0, 1.0, 0.8);
//             vec3 color = baseColor * step(0.5, intensity);
//             float fresnel = pow(1.0 - max(dot(vNormal, vViewDir), 0.0), 3.0);
//             color += vec3(0.1, 0.1, 0.2) * fresnel;
//             gl_FragColor = vec4(color, 1.0);
//         }
//     `
// };

// const gasPlanetShader = {
// 	uniforms: { time: { value: 0 } },
// 	vertexShader,
// 	fragmentShader: `
//         varying vec2 vUv;
//         varying vec3 vNormal;
//         float noise(vec2 p) {
//             return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
//         }
//         void main() {
//             float bands = sin(vUv.y * 10.0 + noise(vUv * 5.0));
//             vec3 color = mix(vec3(0.8, 0.4, 0.2), vec3(0.6, 0.2, 0.1), smoothstep(0.4, 0.6, bands));
//             gl_FragColor = vec4(color, 1.0);
//         }
//     `
// };

// since we store the prev position, we could store them all in an array and we could jump back and forward infinitely
// CameraController
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
		this.targetPoint = null; // Track the POI to follow
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
		if (this.targetPosition || this.targetQuaternion || this.targetPoint) return; // Lock during animations or tracking
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

	// Skip first animation version
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
			this.camera.position.lerp(targetPosition, 0.01); // Adjust this for speed (was 0.05)
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

	// 	update() {
	// 		if (this.targetPosition || this.targetQuaternion) {
	// 			this.animateCamera();
	// 		} else if (this.targetPoint) {
	// 			// Follow the POI from a top-down view
	// 			const worldPosition = this.targetPoint.marker.getWorldPosition(
	// 				new THREE.Vector3()
	// 			);
	// 			const planetCenter = this.targetPoint.marker.parent.position; // Planet's center
	// 			const normal = worldPosition.clone().sub(planetCenter).normalize(); // Surface normal

	// 			// Position camera above the POI along the normal
	// 			const distanceAbove = 5; // Adjust this for height above the surface
	// 			const targetPosition = worldPosition
	// 				.clone()
	// 				.add(normal.multiplyScalar(distanceAbove));
	// 			this.camera.position.lerp(targetPosition, 0.05); // Smoothly follow
	// 			this.camera.lookAt(worldPosition); // Look down at the POI
	// 			this.zoomMessage.style.display = "block";
	// 		} else {
	// 			const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(
	// 				this.camera.quaternion
	// 			);
	// 			const right = new THREE.Vector3(1, 0, 0).applyQuaternion(
	// 				this.camera.quaternion
	// 			);
	// 			this.camera.position.add(forward.multiplyScalar(this.velocity.z));
	// 			this.camera.position.add(right.multiplyScalar(this.velocity.x));
	// 			this.camera.position.add(
	// 				new THREE.Vector3(0, 1, 0).multiplyScalar(this.velocity.y)
	// 			);
	// 			this.zoomMessage.style.display = "none";
	// 		}
	// 	}

	resetZoom() {
		if (this.previousPosition && this.originalQuaternion) {
			this.targetPosition = this.previousPosition.clone();
			this.targetQuaternion = this.originalQuaternion.clone();
			this.targetPoint = null;
		}
	}
}

// Planet class (unchanged)
class Planet {
	constructor(
		radius,
		centerPosition,
		numPoints,
		shader,
		rotationSpeed = 0.001,
		rotationAxis = new THREE.Vector3(0, 1, 0),
		orbitalRadius = 0, // New: Distance from the sun
		orbitalSpeed = 0 // New: Speed of orbit around the sun
	) {
		this.radius = radius;
		// this.mesh = new THREE.Mesh(
		// 	new THREE.SphereGeometry(radius, 64, 64),
		// 	new THREE.ShaderMaterial({
		// 		uniforms: shader.uniforms,
		// 		vertexShader: shader.vertexShader,
		// 		fragmentShader: shader.fragmentShader
		// 	})
		// );
		this.mesh = new THREE.Mesh(
			new THREE.SphereGeometry(radius, 64, 64),
			new THREE.ShaderMaterial({
				uniforms: shader.uniforms,
				vertexShader: shader.vertexShader,
				fragmentShader: shader.fragmentShader,
				lights: true, // Enable lighting support
				extensions: { derivatives: true } // Required for some shadow calculations
			})
		);
		this.mesh.position.copy(centerPosition);
		this.points = [];
		this.rotationSpeed = Math.random() * 0.0001 + 0.001;
		this.rotationAxis = new THREE.Vector3(
			Math.random() * 0.4 - 0.2,
			1,
			Math.random() * 0.4 - 0.2
		).normalize();
		// Orbital properties
		this.orbitalRadius = orbitalRadius; // Distance from sun
		this.orbitalSpeed = orbitalSpeed; // Angular speed in radians per frame
		this.orbitalAngle = Math.random() * Math.PI * 2; // Random starting angle

		this.mesh.castShadow = true;
		this.mesh.receiveShadow = true;

		// Generate POIs and attach as children
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
			marker.position.copy(localPosition).add(normal.multiplyScalar(0.1)); // Local offset
			marker.scale.set(0.5, 0.5, 0.5);
			this.mesh.add(marker); // Attach to mesh
			this.points.push({ marker, localPosition });
		}
	}

	addToScene(scene) {
		scene.add(this.mesh); // Adding mesh automatically adds child POIs
	}

	getPoints() {
		return this.points.map((p) => ({
			marker: p.marker,
			position: p.marker.getWorldPosition(new THREE.Vector3()) // World position for zooming
		}));
	}

	// Skip first animation version
	zoomToPoint(point, controller) {
		const distanceAbove = 5;
		controller.previousPosition = controller.camera.position.clone();
		controller.originalQuaternion = controller.camera.quaternion.clone();

		// Skip initial animation, set targetPoint directly
		controller.targetPoint = point;
	}

	// 	zoomToPoint(point, controller) {
	// 		const minDistance = 3;
	// 		controller.previousPosition = controller.camera.position.clone();
	// 		controller.originalQuaternion = controller.camera.quaternion.clone();

	// 		const worldPosition = point.marker.getWorldPosition(new THREE.Vector3());
	// 		const direction = new THREE.Vector3()
	// 			.subVectors(controller.camera.position, worldPosition)
	// 			.normalize();
	// 		controller.targetPosition = worldPosition
	// 			.clone()
	// 			.add(direction.multiplyScalar(minDistance));
	// 		const tempCam = new THREE.PerspectiveCamera();
	// 		tempCam.position.copy(controller.targetPosition);
	// 		tempCam.lookAt(worldPosition);
	// 		controller.targetQuaternion = tempCam.quaternion.clone();

	// 		// Set the POI to follow after animation completes
	// 		controller.targetPoint = point;
	// 	}

	zoomOut(controller) {
		controller.resetZoom();
	}

	update() {
		// Self-rotation
		this.mesh.rotateOnAxis(this.rotationAxis, this.rotationSpeed);

		// Orbital motion around (0, 0, 0)
		if (this.orbitalRadius > 0) {
			// Only orbit if not the sun
			this.orbitalAngle += this.orbitalSpeed;
			this.mesh.position.x = Math.cos(this.orbitalAngle) * this.orbitalRadius;
			this.mesh.position.z = Math.sin(this.orbitalAngle) * this.orbitalRadius;
			// Keep y = 0 for simplicity (2D orbits); adjust if you want 3D orbits
		}
	}
}

// Instantiate objects
const cameraController = new CameraController(camera);

// const planets = [
// 	new Planet(
// 		10,
// 		new THREE.Vector3(0, 0, 0),
// 		5,
// 		icyPlanetShader,
// 		0.001,
// 		new THREE.Vector3(0, 1, 0)
// 	),
// 	new Planet(
// 		8,
// 		new THREE.Vector3(25, 15, 0),
// 		3,
// 		gasPlanetShader,
// 		0.002,
// 		new THREE.Vector3(0, 1, 0)
// 	),
// 	new Planet(
// 		10,
// 		new THREE.Vector3(-30, -20, 0),
// 		5,
// 		earthLikePlanetShader,
// 		0.0015,
// 		new THREE.Vector3(0, 1, 0.1)
// 	),
// 	new Planet(
// 		8,
// 		new THREE.Vector3(-15, 20, 0),
// 		4,
// 		marsLikePlanetShader,
// 		0.0008,
// 		new THREE.Vector3(0.1, 1, 0)
// 	),
// 	new Planet(
// 		12,
// 		new THREE.Vector3(40, 0, 0),
// 		6,
// 		saturnLikePlanetShader,
// 		0.0012,
// 		new THREE.Vector3(0, 1, 0)
// 	),
// 	new Planet(
// 		7,
// 		new THREE.Vector3(55, -15, -15),
// 		3,
// 		icyPlanetShader,
// 		0.0025,
// 		new THREE.Vector3(0, 1, -0.1)
// 	),
// 	new Planet(
// 		15,
// 		new THREE.Vector3(70, 0, 35),
// 		7,
// 		gasGiantPlanetShader,
// 		0.001,
// 		new THREE.Vector3(0.2, 1, 0)
// 	),
// 	new Planet(
// 		9,
// 		new THREE.Vector3(85, 15, 15),
// 		4,
// 		volcanicPlanetShader,
// 		0.0018,
// 		new THREE.Vector3(0, 1, 0.2)
// 	)
// ];

const planets = [
	// Sun (no orbit, at center)
	(function () {
		const sunPlanet = new Planet(
			15, // Larger radius for sun
			new THREE.Vector3(0, 0, 0), // Center of system
			0, // No POIs for simplicity
			gasGiantPlanetShader, // Bright, sun-like shader
			0.001,
			new THREE.Vector3(0, 1, 0),
			0, // Orbital radius = 0 (stationary)
			0 // Orbital speed = 0
		);
		const sunLight = new THREE.PointLight(0xffffff, 3, 2000); // Color, intensity, distance
		sunLight.position.set(0, 0, 0); // Position at sun's center
		sunLight.castShadow = true;
		sunLight.shadow.mapSize.width = 1024; // Shadow map quality
		sunLight.shadow.mapSize.height = 1024;
		sunLight.shadow.camera.near = 0.1;
		sunLight.shadow.camera.far = 400; // Match distance
		sunPlanet.mesh.add(sunLight); // Attach light to sun's mesh
		sunPlanet.mesh.castShadow = true; // Sun casts shadows
		sunPlanet.mesh.receiveShadow = true; // Sun receives shadows (optional)
		return sunPlanet;
	})(),
	// Orbiting planets
	new Planet(
		8,
		new THREE.Vector3(25, 0, 0), // Initial position (will be overridden by orbit)
		3,
		gasPlanetShader,
		0.002,
		new THREE.Vector3(0, 1, 0),
		55, // Orbital radius
		0.0001 // Orbital speed
	),
	new Planet(
		10,
		new THREE.Vector3(35, 0, 0),
		5,
		earthLikePlanetShader,
		0.00015,
		new THREE.Vector3(0, 1, 0.1),
		135,
		0.0008
	),
	new Planet(
		8,
		new THREE.Vector3(45, 0, 0),
		4,
		marsLikePlanetShader,
		0.0008,
		new THREE.Vector3(0.1, 1, 0),
		85,
		0.0006
	),
	new Planet(
		12,
		new THREE.Vector3(55, 0, 0),
		6,
		saturnLikePlanetShader,
		0.0012,
		new THREE.Vector3(0, 1, 0),
		165,
		0.0005
	),
	new Planet(
		7,
		new THREE.Vector3(65, 0, 0),
		3,
		icyPlanetShader,
		0.0025,
		new THREE.Vector3(0, 1, -0.1),
		225,
		0.0004
	),
	new Planet(
		15,
		new THREE.Vector3(75, 0, 0),
		7,
		gasGiantPlanetShader,
		0.001,
		new THREE.Vector3(0.2, 1, 0),
		300,
		0.0003
	),
	new Planet(
		9,
		new THREE.Vector3(85, 0, 0),
		4,
		volcanicPlanetShader,
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

// Animation loop
function animate() {
	requestAnimationFrame(animate);
	planets.forEach((planet) => planet.update());
	cameraController.update();
	renderer.render(scene, camera);
	stars.rotation.y += 0.0001;
}
animate();

// Lighting
const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(10, 10, 10);
scene.add(directionalLight);

// Resize handler
window.addEventListener("resize", () => {
	renderer.setSize(window.innerWidth, window.innerHeight);
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
});
