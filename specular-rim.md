Absolutely! Adding **specular highlights** and **rim lighting** to your shaders can significantly enhance the realism of your planets, giving them a more polished, three-dimensional look. These effects simulate how light interacts with surfaces in different ways: specular highlights mimic shiny reflections (like sunlight glinting off water or ice), while rim lighting creates a glowing edge effect (useful for atmospheric or backlit appearances). Let’s break down how to implement these enhancements in your existing shaders.

---

### 1. Specular Highlights
Specular highlights represent the bright spots where light reflects directly toward the viewer, typical of shiny or wet surfaces. This requires the light direction, surface normal, and view direction (from the camera to the surface).

#### What We Need
- **View Direction**: The vector from the fragment’s position to the camera, computed in the vertex shader.
- **Light Direction**: Already available via `uLightDir`.
- **Normal**: Already passed as `vNormal`.
- **Shininess**: A parameter to control how tight or broad the highlight is.

#### Step 1: Update Vertex Shader
Pass the view direction to the fragment shader:

```glsl
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vViewDir; // New: View direction
void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vec3 pos = (modelViewMatrix * vec4(position, 1.0)).xyz; // Position in view space
    vViewDir = normalize(-pos); // View direction (camera at origin in view space)
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
```

#### Step 2: Update Fragment Shader (e.g., `earthLikePlanetShader`)
Add specular lighting:

```glsl
uniform vec3 uLightDir;
uniform float time;
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vViewDir;
${commonNoiseFunctions}
void main() {
    vec2 st = vUv * 10.0;
    float n = fbm(st);
    float threshold = 0.5;
    vec3 waterColor = vec3(0.0, 0.3, 0.7);
    vec3 landColor = vec3(0.1, 0.7, 0.1);
    vec3 color = mix(waterColor, landColor, step(threshold, n));

    // Diffuse lighting
    vec3 lightDir = normalize(uLightDir);
    float diffuse = max(dot(normalize(vNormal), lightDir), 0.0);
    float lightIntensity = diffuse * 0.8 + 0.2; // Diffuse + ambient
    color *= lightIntensity;

    // Specular lighting
    vec3 viewDir = normalize(vViewDir);
    vec3 halfVector = normalize(lightDir + viewDir); // Halfway vector for Blinn-Phong
    float specularStrength = 0.5; // Adjust intensity
    float shininess = 32.0; // Tightness of highlight (higher = smaller spot)
    float specular = pow(max(dot(normalize(vNormal), halfVector), 0.0), shininess);
    vec3 specularColor = vec3(1.0, 1.0, 1.0) * specularStrength * specular; // White highlight

    // Combine
    color += specularColor;

    gl_FragColor = vec4(color, 1.0);
}
```

- **Explanation**:
  - **Half Vector**: The Blinn-Phong model uses the halfway vector between light and view directions for smoother highlights than Phong’s reflection vector.
  - **Specular Term**: `pow` raises the dot product to `shininess`, controlling the highlight’s size (higher `shininess` = tighter spot).
  - **Specular Color**: Added to the base color, typically white for sunlight, but you can tweak it (e.g., bluish for ice).

#### Customization
- **Water vs. Land**: For Earth-like planets, you could increase `specularStrength` on water (e.g., `step(threshold, n) * 0.5`) and reduce it on land.
- **Shininess**: Adjust per planet (e.g., `64.0` for icy planets, `16.0` for rocky ones).

---

### 2. Rim Lighting
Rim lighting highlights the edges of an object from the viewer’s perspective, simulating light scattering around the silhouette (great for gas giants or planets with atmospheres).

#### What We Need
- **View Direction**: Already added for specular.
- **Normal**: Already available.
- **Rim Parameters**: Strength and falloff to control the effect.

#### Update Fragment Shader (e.g., `gasGiantPlanetShader`)
Add rim lighting:

```glsl
uniform vec3 uLightDir;
uniform float time;
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vViewDir;
const float PI = 3.14159265359;
${commonNoiseFunctions}
void main() {
    vec2 st = vUv * 20.0;
    float n = fbm(st);
    float swirl = abs(sin(vUv.x * PI * 20.0));
    vec3 baseColor = vec3(0.9, 0.6, 0.4);
    vec3 stormColor = vec3(0.7, 0.4, 0.2);
    vec3 color = mix(baseColor, stormColor, swirl * n);

    // Diffuse lighting
    vec3 lightDir = normalize(uLightDir);
    float diffuse = max(dot(normalize(vNormal), lightDir), 0.0);
    float lightIntensity = diffuse * 0.8 + 0.2;
    color *= lightIntensity;

    // Specular lighting
    vec3 viewDir = normalize(vViewDir);
    vec3 halfVector = normalize(lightDir + viewDir);
    float specularStrength = 0.3;
    float shininess = 16.0;
    float specular = pow(max(dot(normalize(vNormal), halfVector), 0.0), shininess);
    vec3 specularColor = vec3(1.0, 1.0, 1.0) * specularStrength * specular;
    color += specularColor;

    // Rim lighting
    float rimStrength = 0.5; // Intensity of rim effect
    float rimPower = 3.0; // How sharp the rim is
    float rim = 1.0 - max(dot(normalize(vNormal), viewDir), 0.0); // Edge-facing factor
    rim = pow(rim, rimPower); // Sharpen the rim
    vec3 rimColor = vec3(0.8, 0.6, 0.4) * rimStrength * rim; // Warm rim for gas giant

    // Combine
    color += rimColor;

    gl_FragColor = vec4(color, 1.0);
}
```

- **Explanation**:
  - **Rim Factor**: `1.0 - dot(normal, viewDir)` is 1 at the edges (normal perpendicular to view) and 0 at the center (normal facing view).
  - **Power**: `pow(rim, rimPower)` sharpens the effect; higher `rimPower` narrows the rim.
  - **Rim Color**: Added to the base color, customizable per planet (e.g., bluish for icy planets, reddish for volcanic ones).

---

### Applying to All Shaders
Here’s how you’d integrate both effects across your shaders:

#### Example: `icyPlanetShader`
```javascript
const icyPlanetShader = {
    uniforms: { 
        time: { value: 0 },
        uLightDir: { value: new THREE.Vector3(1, 1, 1).normalize() }
    },
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
        uniform vec3 uLightDir;
        uniform float time;
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vViewDir;
        ${commonNoiseFunctions}
        void main() {
            vec2 st = vUv * 15.0;
            float n = fbm(st);
            float threshold = 0.45;
            vec3 iceBase = vec3(0.7, 0.8, 0.9);
            vec3 iceHighlight = vec3(0.9, 0.9, 1.0);
            vec3 color = mix(iceBase, iceHighlight, step(threshold, n));

            // Diffuse
            vec3 lightDir = normalize(uLightDir);
            float diffuse = max(dot(normalize(vNormal), lightDir), 0.0);
            float lightIntensity = diffuse * 0.8 + 0.2;
            color *= lightIntensity;

            // Specular
            vec3 viewDir = normalize(vViewDir);
            vec3 halfVector = normalize(lightDir + viewDir);
            float specularStrength = 0.7; // Stronger for icy surface
            float shininess = 64.0; // Tight highlight
            float specular = pow(max(dot(normalize(vNormal), halfVector), 0.0), shininess);
            vec3 specularColor = vec3(1.0, 1.0, 1.0) * specularStrength * specular;
            color += specularColor;

            // Rim
            float rimStrength = 0.4;
            float rimPower = 2.0;
            float rim = 1.0 - max(dot(normalize(vNormal), viewDir), 0.0);
            rim = pow(rim, rimPower);
            vec3 rimColor = vec3(0.8, 0.9, 1.0) * rimStrength * rim; // Cool blue rim
            color += rimColor;

            gl_FragColor = vec4(color, 1.0);
        }
    `
};
```

#### Customization Per Planet
- **Sun**: Skip specular and rim or use minimal specular to suggest surface flares.
- **Gas Giants**: Strong rim lighting (`rimStrength = 0.6`), low specular (`specularStrength = 0.2`).
- **Rocky Planets**: Moderate specular (`specularStrength = 0.4`), subtle rim (`rimStrength = 0.3`).
- **City Planet**: High specular (`specularStrength = 0.8`) for metallic sheen, subtle rim.

---

### Integration with Rotations
Since your planets rotate and orbit:
- **Light Direction**: Already updates in `Planet.update()` to point toward the sun, so specular and rim will naturally follow.
- **Future Enhancement**: Add a `uCameraPosition` uniform to make `vViewDir` more precise if the camera moves significantly relative to the planet’s local space, though the current view-space approach works well for now.

---

### Final Touches
Update all shader objects with the new vertex shader and add `uLightDir` to their uniforms. Test the scene and tweak:
- `specularStrength` (0.0 to 1.0)
- `shininess` (8.0 to 128.0)
- `rimStrength` (0.0 to 1.0)
- `rimPower` (1.0 to 5.0)

These enhancements will make your planets pop with realistic lighting effects, building on the shader-based shadows you’ve already added. Let me know if you want a full shader example for another planet or help adjusting the values!