// DS Gutachten Formular - Client-side JavaScript
// Modern ES6+ implementation with signature canvas and form handling

class DSGutachtenForm {
    constructor() {
        this.form = document.getElementById('gutachtenForm');
        this.canvas = document.getElementById('signatureCanvas');
        this.ctx = null;
        this.isDrawing = false;
        this.signatureData = '';
        
        this.initializeForm();
        this.initializeSignature();
        this.setupEventListeners();
    }

    initializeForm() {
        // Auto-generate Gutachten number
        const today = new Date();
        const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
        const timeStr = today.getHours().toString().padStart(2, '0') + 
                       today.getMinutes().toString().padStart(2, '0');
        document.getElementById('gutachten_nr').value = `DS${dateStr}${timeStr}`;

        // Set default date to today
        document.getElementById('unfalltag').value = today.toISOString().slice(0, 10);
    }

    initializeSignature() {
        if (!this.canvas) {
            console.error('Signature canvas not found');
            return;
        }

        // Get context first
        this.ctx = this.canvas.getContext('2d');
        if (!this.ctx) {
            console.error('Could not get canvas context');
            return;
        }

        // Use the width and height attributes from HTML
        // Canvas already has width="400" height="100" in HTML
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        this.ctx.strokeStyle = '#000';
        this.ctx.lineWidth = 2;
        
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        console.log('Signature canvas initialized successfully');
    }

    setupEventListeners() {
        // Form submission
        if (this.form) {
            this.form.addEventListener('submit', (e) => this.handleSubmit(e));
        }

        // Signature canvas events
        if (this.canvas) {
            // Mouse events
            this.canvas.addEventListener('mousedown', (e) => this.startDrawing(e));
            this.canvas.addEventListener('mousemove', (e) => this.draw(e));
            this.canvas.addEventListener('mouseup', () => this.stopDrawing());
            this.canvas.addEventListener('mouseout', () => this.stopDrawing());

            // Touch events for mobile
            this.canvas.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this.startDrawing(e.touches[0]);
            });
            this.canvas.addEventListener('touchmove', (e) => {
                e.preventDefault();
                this.draw(e.touches[0]);
            });
            this.canvas.addEventListener('touchend', (e) => {
                e.preventDefault();
                this.stopDrawing();
            });
        }

        // Clear signature button
        const clearBtn = document.getElementById('clearSignature');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => this.clearSignature());
        }

        // Form validation on input change
        this.setupFormValidation();
    }

    getEventPos(e) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left) * (this.canvas.width / rect.width),
            y: (e.clientY - rect.top) * (this.canvas.height / rect.height)
        };
    }

    startDrawing(e) {
        console.log('Start drawing');
        this.isDrawing = true;
        const pos = this.getEventPos(e);
        this.ctx.beginPath();
        this.ctx.moveTo(pos.x, pos.y);
    }

    draw(e) {
        if (!this.isDrawing) return;
        
        const pos = this.getEventPos(e);
        this.ctx.lineTo(pos.x, pos.y);
        this.ctx.stroke();
        this.ctx.beginPath();
        this.ctx.moveTo(pos.x, pos.y);
    }

    stopDrawing() {
        if (!this.isDrawing) return;
        this.isDrawing = false;
        this.signatureData = this.canvas.toDataURL();
    }

    clearSignature() {
        if (this.ctx && this.canvas) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            this.signatureData = '';
            console.log('Signature cleared');
        }
    }

    setupFormValidation() {
        const requiredFields = [
            'auftraggeber_name',
            'auftraggeber_strasse',
            'auftraggeber_plz',
            'auftraggeber_ort',
            'auftraggeber_email',
            'auftraggeber_telefon',
            'kennzeichen',
            'unfalltag',
            'unfallort'
        ];

        requiredFields.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (field) {
                field.addEventListener('blur', () => this.validateField(field));
                field.addEventListener('input', () => this.clearFieldError(field));
            }
        });
    }

    validateField(field) {
        const value = field.value.trim();
        const fieldContainer = field.closest('.mb-4');
        
        if (!value && field.hasAttribute('required')) {
            this.showFieldError(field, 'Dieses Feld ist erforderlich');
            return false;
        }

        // Email validation
        if (field.type === 'email' && value) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(value)) {
                this.showFieldError(field, 'Bitte geben Sie eine gültige E-Mail-Adresse ein');
                return false;
            }
        }

        // Phone validation
        if (field.id === 'auftraggeber_telefon' && value) {
            const phoneRegex = /^[\d\s\-\+\(\)\/]+$/;
            if (!phoneRegex.test(value) || value.length < 6) {
                this.showFieldError(field, 'Bitte geben Sie eine gültige Telefonnummer ein');
                return false;
            }
        }

        this.clearFieldError(field);
        return true;
    }

    showFieldError(field, message) {
        this.clearFieldError(field);
        field.classList.add('border-red-500', 'bg-red-50');
        
        const errorDiv = document.createElement('div');
        errorDiv.className = 'text-red-600 text-sm mt-1';
        errorDiv.textContent = message;
        errorDiv.setAttribute('data-error', 'true');
        
        field.parentNode.appendChild(errorDiv);
    }

    clearFieldError(field) {
        field.classList.remove('border-red-500', 'bg-red-50');
        const errorDiv = field.parentNode.querySelector('[data-error="true"]');
        if (errorDiv) {
            errorDiv.remove();
        }
    }

    validateForm() {
        let isValid = true;
        const requiredFields = this.form.querySelectorAll('[required]');
        
        requiredFields.forEach(field => {
            if (!this.validateField(field)) {
                isValid = false;
            }
        });

        // Validate signature
        if (!this.signatureData) {
            const signatureContainer = document.getElementById('signatureCanvas').closest('.mb-6');
            const existingError = signatureContainer.querySelector('[data-error="true"]');
            if (!existingError) {
                const errorDiv = document.createElement('div');
                errorDiv.className = 'text-red-600 text-sm mt-2';
                errorDiv.textContent = 'Unterschrift ist erforderlich';
                errorDiv.setAttribute('data-error', 'true');
                signatureContainer.appendChild(errorDiv);
            }
            isValid = false;
        }

        return isValid;
    }

    async handleSubmit(e) {
        e.preventDefault();
        
        if (!this.validateForm()) {
            this.showMessage('Bitte überprüfen Sie Ihre Eingaben', 'error');
            return;
        }

        // Show loading state
        const submitBtn = this.form.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.innerHTML = `
            <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Wird verarbeitet...
        `;

        try {
            const formData = this.collectFormData();
            
            const response = await fetch('/api/submit-gutachten', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData)
            });

            const result = await response.json();

            if (response.ok) {
                this.showMessage('Gutachten erfolgreich übermittelt!', 'success');
                this.resetForm();
            } else {
                throw new Error(result.message || 'Ein Fehler ist aufgetreten');
            }
        } catch (error) {
            console.error('Submit error:', error);
            this.showMessage(error.message || 'Ein unerwarteter Fehler ist aufgetreten', 'error');
        } finally {
            // Restore button state
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
        }
    }

    collectFormData() {
        const formData = new FormData(this.form);
        const data = {};
        
        // Convert FormData to regular object
        for (let [key, value] of formData.entries()) {
            data[key] = value;
        }

        // Add signature data
        data.signature = this.signatureData;
        
        // Add timestamp
        data.submitted_at = new Date().toISOString();

        return data;
    }

    showMessage(message, type = 'info') {
        // Remove existing messages
        const existingMessages = document.querySelectorAll('.ds-message');
        existingMessages.forEach(msg => msg.remove());

        const messageDiv = document.createElement('div');
        messageDiv.className = `ds-message fixed top-4 right-4 px-6 py-4 rounded-lg shadow-lg z-50 ${
            type === 'success' ? 'bg-green-500 text-white' : 
            type === 'error' ? 'bg-red-500 text-white' : 
            'bg-blue-500 text-white'
        }`;
        messageDiv.textContent = message;
        
        document.body.appendChild(messageDiv);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            messageDiv.remove();
        }, 5000);
    }

    resetForm() {
        this.form.reset();
        this.clearSignature();
        this.initializeForm();
        
        // Clear any error states
        const errorFields = document.querySelectorAll('.border-red-500');
        errorFields.forEach(field => {
            this.clearFieldError(field);
        });
        
        // Remove signature error if exists
        const signatureErrors = document.querySelectorAll('[data-error="true"]');
        signatureErrors.forEach(error => error.remove());
    }
}

// Initialize the form when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.dsGutachtenForm = new DSGutachtenForm();
    console.log('DS Gutachten Form initialized');
});

// Handle window resize for signature canvas
window.addEventListener('resize', () => {
    const canvas = document.getElementById('signatureCanvas');
    if (canvas) {
        // Reinitialize canvas on resize
        setTimeout(() => {
            const form = window.dsGutachtenForm;
            if (form) {
                form.initializeSignature();
            }
        }, 100);
    }
});