// interactions.js

document.addEventListener('DOMContentLoaded', () => {
    // 1. Mouse Tracking Glow Effect on Cards
    const cards = document.querySelectorAll('.glass-card, .bg-surface-container-low, .bg-surface-container, .interactive-card');
    
    document.body.addEventListener('mousemove', (e) => {
        for(const card of cards) {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            card.style.setProperty('--mouse-x', `${x}px`);
            card.style.setProperty('--mouse-y', `${y}px`);
        }
    });

    // 2. Subtle 3D Tilt Effect on specific feature cards
    cards.forEach(card => {
        // We only tilt elements that seem to be interactive or prominent enough to warrant it.
        // We can just apply it to all cards.
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left; // x position within the element.
            const y = e.clientY - rect.top;  // y position within the element.
            
            // Calculate rotation values (max rotation 4 degrees)
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            
            const rotateX = ((y - centerY) / centerY) * -3; 
            const rotateY = ((x - centerX) / centerX) * 3;

            card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.01, 1.01, 1.01)`;
        });

        card.addEventListener('mouseleave', () => {
            // Reset transforms perfectly
            card.style.transform = `perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)`;
        });
    });
});
