/* ==================================
   Animations and UI Interactions
=================================== */

// Sidebar Icon Animations
const navLinks = document.querySelectorAll('.nav li a');
navLinks.forEach(link => {
    link.addEventListener('mouseenter', (e) => {
        const icon = link.querySelector('i');
        if(icon) {
            icon.classList.add('fa-bounce');
        }
    });
    link.addEventListener('mouseleave', (e) => {
        const icon = link.querySelector('i');
        if(icon) {
            icon.classList.remove('fa-bounce');
        }
    });
});

// Form Button glowing click feedback
const btnPrimary = document.querySelectorAll('.btn-primary');
btnPrimary.forEach(btn => {
    btn.addEventListener('mousedown', function() {
        this.style.boxShadow = '0 0 15px rgba(59, 130, 246, 0.8), 0 0 30px rgba(59, 130, 246, 0.4)';
    });
    btn.addEventListener('mouseup', function() {
        this.style.boxShadow = '0 0 30px rgba(59, 130, 246, 1)';
        setTimeout(() => {
            this.style.boxShadow = '0 8px 25px rgba(59, 130, 246, 0.5)';
        }, 150);
    });
});

