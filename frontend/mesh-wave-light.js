// mesh-wave-light.js (light theme)

(function meshWaveLight() {
    const container = document.getElementById('canvas-container');

    // 1. Scene, Camera, Renderer setup
    const scene = new THREE.Scene();
    
    // Light grayish white background
    const bgColor = new THREE.Color(0xf8f9fa); 
    scene.background = bgColor;
    // Fog to fade layers into the distance smoothly
    scene.fog = new THREE.FogExp2(bgColor, 0.008); 

    const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 1, 1000);
    // Position camera to look down slightly at the terrain valley
    camera.position.set(0, 15, 80);
    camera.lookAt(0, 20, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // 2. Geometry for the Digital Ocean Mesh
    const geometry = new THREE.PlaneGeometry(350, 250, 160, 100);
    geometry.rotateX(-Math.PI / 2); // Lay flat on XZ plane

    const positionAttribute = geometry.attributes.position;
    const vertexArray = positionAttribute.array;
    const originalPositions = new Float32Array(vertexArray.length);
    for (let i = 0; i < vertexArray.length; i++) {
        originalPositions[i] = vertexArray[i];
    }

    // 3. Premium Gradient Shader (Light theme: crisp blues)
    const vertexShader = `
        varying vec3 vPosition;
        varying float vHeight;
        
        void main() {
            vec3 pos = position;
            vHeight = pos.y;
            vPosition = pos;
            
            vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
            gl_PointSize = (4.0) * ( 80.0 / -mvPosition.z ); 
            gl_Position = projectionMatrix * mvPosition;
        }
    `;

    const fragmentShader = `
        uniform float uOpacity;
        uniform float uIsPoint;
        
        varying vec3 vPosition;
        varying float vHeight;
        
        void main() {
            if (uIsPoint > 0.5) {
                vec2 coord = gl_PointCoord - vec2(0.5);
                if (length(coord) > 0.5) discard;
            }
            
            // Ocean to AI Network colors (Light Theme Edition)
            vec3 colorDeep = vec3(0.9, 0.94, 0.98); // Very light blue for valleys
            vec3 colorMid = vec3(0.5, 0.7, 0.95);   // Soft calm blue
            vec3 colorPeak = vec3(0.1, 0.4, 0.9);   // Primary Blue
            vec3 colorGlow = vec3(0.0, 0.9, 1.0);   // Neon Cyan
            
            // Slight Neon RGB Texture (Red, Green, Blue mapping)
            float texR = sin(vPosition.x * 0.02 + vPosition.z * 0.01) * 0.5 + 0.5;
            float texG = cos(vPosition.x * 0.015 - vPosition.z * 0.025) * 0.5 + 0.5;
            float texB = sin(vPosition.x * 0.03 + vPosition.z * 0.03) * 0.5 + 0.5;
            
            vec3 neonR = vec3(1.0, 0.1, 0.3);   // Neon Red
            vec3 neonG = vec3(0.1, 1.0, 0.3);   // Neon Green
            vec3 neonB = vec3(0.1, 0.4, 1.0);   // Neon Blue
            
            // Mix the RGB neons into the overall gradient to create the slight texture
            colorDeep = mix(colorDeep, neonB, texB * 0.3);     // Deep neon blue texture
            colorMid = mix(colorMid, neonG, texG * 0.3);       // Slight green sweeps
            colorPeak = mix(colorPeak, neonR, texR * 0.4);     // Red/magenta peaks
            
            // Normalize height (assuming wave height from -5 to 15)
            float h = clamp((vHeight + 5.0) / 15.0, 0.0, 1.0);
            
            vec3 finalColor;
            if (h < 0.5) {
                finalColor = mix(colorDeep, colorMid, h * 2.0);
            } else if (h < 0.85) {
                finalColor = mix(colorMid, colorPeak, (h - 0.5) * 2.85);
            } else {
                finalColor = mix(colorPeak, colorGlow, (h - 0.85) * 6.66);
            }
            
            if (uIsPoint > 0.5) {
                // Dim nodes significantly to make the dots much darker
                finalColor *= mix(0.1, 0.35, h); 
            }
            
            // Fade into the background far away
            float distanceFade = smoothstep(180.0, 10.0, length(vPosition.xz));
            
            gl_FragColor = vec4(finalColor, uOpacity * distanceFade);
        }
    `;

    // Glowing Nodes
    const pointsMaterial = new THREE.ShaderMaterial({
        vertexShader: vertexShader,
        fragmentShader: fragmentShader,
        uniforms: {
            uOpacity: { value: 0.95 },
            uIsPoint: { value: 1.0 }
        },
        transparent: true,
        depthWrite: false,
        // Used NormalBlending for light theme instead of Additive to prevent blowing out to white
        blending: THREE.NormalBlending 
    });

    // Connecting Lines
    const lineMaterial = new THREE.ShaderMaterial({
        vertexShader: vertexShader,
        fragmentShader: fragmentShader,
        uniforms: {
            uOpacity: { value: 0.15 }, 
            uIsPoint: { value: 0.0 }
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.NormalBlending,
        wireframe: true
    });

    const meshPoints = new THREE.Points(geometry, pointsMaterial);
    const meshLines = new THREE.Mesh(geometry, lineMaterial);
    
    scene.add(meshPoints);
    scene.add(meshLines);

    // Subtle Floating Particles Background/Foreground
    const pGeometry = new THREE.BufferGeometry();
    const pPosArray = new Float32Array(500 * 3);
    for(let i=0; i<500*3; i+=3) {
        pPosArray[i] = (Math.random() - 0.5) * 350;
        pPosArray[i+1] = Math.random() * 60 - 15;
        pPosArray[i+2] = (Math.random() - 0.5) * 350;
    }
    pGeometry.setAttribute('position', new THREE.BufferAttribute(pPosArray, 3));
    const pMaterial = new THREE.PointsMaterial({
        color: 0x050f24, // Very dark, almost black-blue for floating dots
        size: 0.45, // Slightly larger to sit against light bg
        transparent: true,
        opacity: 0.25,
        blending: THREE.NormalBlending,
        depthWrite: false
    });
    const floatingParticles = new THREE.Points(pGeometry, pMaterial);
    scene.add(floatingParticles);

    // 4. Interaction variables (Cursor)
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2(-9999, -9999);
    const targetMouse = new THREE.Vector2(-9999, -9999);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    let mouseIntersect = new THREE.Vector3(-9999, -9999, -9999);

    window.addEventListener('mousemove', (event) => {
        targetMouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        targetMouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    });
    window.addEventListener('mouseleave', () => {
        targetMouse.set(-9999, -9999);
    });
    window.addEventListener('touchmove', (event) => {
        if(event.touches.length > 0) {
            targetMouse.x = (event.touches[0].clientX / window.innerWidth) * 2 - 1;
            targetMouse.y = -(event.touches[0].clientY / window.innerHeight) * 2 + 1;
        }
    }, {passive: true});

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // 5. Render Loop
    const clock = new THREE.Clock();

    const animate = () => {
        requestAnimationFrame(animate);

        const time = clock.getElapsedTime() * 0.6;

        // Smoothed interpolation for fluid gliding, slightly increased for better responsiveness
        mouse.x += (targetMouse.x - mouse.x) * 0.035;
        mouse.y += (targetMouse.y - mouse.y) * 0.035;

        raycaster.setFromCamera(mouse, camera);
        raycaster.ray.intersectPlane(plane, mouseIntersect);
        
        if (!mouseIntersect || mouse.x < -2) {
             mouseIntersect = new THREE.Vector3(-9999, -9999, -9999);
        }

        // Deform Mesh Wave
        const positions = geometry.attributes.position.array;
        for (let i = 0; i < positions.length; i += 3) {
            const x = originalPositions[i];
            const z = originalPositions[i + 2];
            
            // Create a valley in the center, high walls on the sides
            const structuralValley = Math.pow(Math.abs(x * 0.05), 1.6) * 1.5;
            
            // Passive fluid wave animations (directional ocean swells)
            const dirX1 = 0.8; const dirZ1 = 0.6;
            const passiveWave1 = Math.sin((x * dirX1 + z * dirZ1) * 0.035 + time * 1.8) * 3.0; // Fast main swell
            
            const dirX2 = -0.5; const dirZ2 = 0.8;
            const passiveWave2 = Math.sin((x * dirX2 + z * dirZ2) * 0.02 + time * 1.0) * 2.0; // Slow cross swell
            
            let y = structuralValley + passiveWave1 + passiveWave2;

            // Active Cursor interaction (smooth, wavy liquid rings)
            const dx = x - mouseIntersect.x;
            const dz = z - mouseIntersect.z;
            const distFromCursor = Math.sqrt(dx * dx + dz * dz);
            
            const effectRadius = 120; // Massive radius for non-bouncy wide waves
            
            if (distFromCursor < effectRadius) {
                // Smooth ease out curve (slightly tightened for more impact)
                const influence = Math.pow(1 - (distFromCursor / effectRadius), 2.1); 
                
                // Continuous, broad traveling waves propagating outward from the cursor
                // Increased amplitude from 7.0 to 11.0 to intensify the reaction
                const wavyRipple = Math.cos(distFromCursor * 0.08 - time * 5.0) * influence * 11.0;

                y += wavyRipple;
            }

            positions[i + 1] = y;
        }
        geometry.attributes.position.needsUpdate = true;

        // Animate Floating Particles
        const pPositions = pGeometry.attributes.position.array;
        for(let i=1; i<pPositions.length; i+=3) {
            pPositions[i] += Math.sin(time * 0.8 + pPositions[i-1]*0.01) * 0.02;
            if(pPositions[i] > 60) pPositions[i] = -20;
        }
        pGeometry.attributes.position.needsUpdate = true;
        floatingParticles.rotation.y = time * 0.03;

        renderer.render(scene, camera);
    };

    animate();
})();
