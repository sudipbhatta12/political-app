/**
 * Premium Particle Network Background Animation
 * Based on the user's request for a visual enhancement similar to a network constellation.
 * Features:
 * - Floating particles
 * - Connection lines when particles are close (constellation effect)
 * - Mouse interaction (repel/attract)
 * - Teal/Cyan color scheme to match the reference image
 */

const canvas = document.getElementById('bg-canvas');
const ctx = canvas.getContext('2d');

let particlesArray;

// Configure settings
const settings = {
    particleColor: 'rgba(64, 224, 208, 0.5)', // Turquoise/Cyan
    lineColor: 'rgba(64, 224, 208, 0.15)',
    particleCount: window.innerWidth < 768 ? 50 : 100, // Responsive count
    maxDistance: 150, // Max distance for connection
    mouseRadius: 150, // Mouse interaction radius
    moveSpeed: 0.5
};

// Handle resize
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    settings.particleCount = window.innerWidth < 768 ? 50 : 100;
    init();
});

// Mouse interaction
const mouse = {
    x: null,
    y: null,
    radius: settings.mouseRadius
}

window.addEventListener('mousemove', (event) => {
    mouse.x = event.x;
    mouse.y = event.y;
});

window.addEventListener('mouseout', () => {
    mouse.x = undefined;
    mouse.y = undefined;
});

// Particle Class
class Particle {
    constructor() {
        this.x = Math.random() * (canvas.width - 20) + 10;
        this.y = Math.random() * (canvas.height - 20) + 10;
        this.directionX = (Math.random() * 2) - 1; // -1 to 1
        this.directionY = (Math.random() * 2) - 1; // -1 to 1
        this.size = (Math.random() * 2) + 1; // 1 to 3
        this.color = settings.particleColor;
    }

    // Draw particle
    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2, false);
        ctx.fillStyle = this.color;
        ctx.fill();
    }

    // Update particle position
    update() {
        // Boundary check
        if (this.x > canvas.width || this.x < 0) {
            this.directionX = -this.directionX;
        }
        if (this.y > canvas.height || this.y < 0) {
            this.directionY = -this.directionY;
        }

        // Mouse collision
        let dx = mouse.x - this.x;
        let dy = mouse.y - this.y;
        let distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < mouse.radius + this.size) {
            if (mouse.x < this.x && this.x < canvas.width - this.size * 10) {
                this.x += 2;
            }
            if (mouse.x > this.x && this.x > this.size * 10) {
                this.x -= 2;
            }
            if (mouse.y < this.y && this.y < canvas.height - this.size * 10) {
                this.y += 2;
            }
            if (mouse.y > this.y && this.y > this.size * 10) {
                this.y -= 2;
            }
        }

        // Move particle
        this.x += this.directionX * settings.moveSpeed;
        this.y += this.directionY * settings.moveSpeed;

        this.draw();
    }
}

// Create particle array
function init() {
    particlesArray = [];
    for (let i = 0; i < settings.particleCount; i++) {
        particlesArray.push(new Particle());
    }
}

// Connect particles with lines
function connect() {
    for (let a = 0; a < particlesArray.length; a++) {
        for (let b = a; b < particlesArray.length; b++) {
            let distance = ((particlesArray[a].x - particlesArray[b].x) * (particlesArray[a].x - particlesArray[b].x))
                + ((particlesArray[a].y - particlesArray[b].y) * (particlesArray[a].y - particlesArray[b].y));

            if (distance < (settings.maxDistance * settings.maxDistance)) {
                let opacityValue = 1 - (distance / (settings.maxDistance * settings.maxDistance));
                ctx.strokeStyle = settings.lineColor.replace('0.15)', opacityValue * 0.2 + ')'); // Dynamic opacity based on base color
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(particlesArray[a].x, particlesArray[a].y);
                ctx.lineTo(particlesArray[b].x, particlesArray[b].y);
                ctx.stroke();
            }
        }
    }
}

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < particlesArray.length; i++) {
        particlesArray[i].update();
    }
    connect();
}

// Start
init();
animate();
