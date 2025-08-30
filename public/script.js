// Digital Signature Canvas
class SignatureCanvas {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.isDrawing = false;
        this.hasSignature = false;
        
        this.setupCanvas();
        this.bindEvents();
    }
    
    setupCanvas() {
        // Set up canvas for high DPI displays
        const rect = this.canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        
        this.ctx.scale(dpr, dpr);
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        this.ctx.strokeStyle = '#000';
        this.ctx.lineWidth = 2;
        
        // Set canvas style size
        this.canvas.style.width = rect.width + 'px';
        this.canvas.style.height = rect.height + 'px';
    }
    
    bindEvents() {
        // Mouse events
        this.canvas.addEventListener('mousedown', this.startDrawing.bind(this));
        this.canvas.addEventListener('mousemove', this.draw.bind(this));
        this.canvas.addEventListener('mouseup', this.stopDrawing.bind(this));
        this.canvas.addEventListener('mouseout', this.stopDrawing.bind(this));
        
        // Touch events for mobile
        this.canvas.addEventListener('touchstart', this.handleTouch.bind(this));
        this.canvas.addEventListener('touchmove', this.handleTouch.bind(this));
        this.canvas.addEventListener('touchend', this.stopDrawing.bind(this));
    }
    
    getEventPos(e) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        
        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY
        };
    }
    
    startDrawing(e) {
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
        this.hasSignature = true;
    }
    
    stopDrawing() {
        this.isDrawing = false;
    }
    
    handleTouch(e) {
        e.preventDefault();
        const touch = e.touches[0];
        const mouseEvent = new MouseEvent(e.type === 'touchstart' ? 'mousedown' : 
                                        e.type === 'touchmove' ? 'mousemove' : 'mouseup', {
            clientX: touch.clientX,
            clientY: touch.clientY
        });
        this.canvas.dispatchEvent(mouseEvent);
    }
    
    clear() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.hasSignature = false;
    }
    
    getDataURL() {
        return this.canvas.toDataURL('image/png');
    }
}

// Form Handler
class GutachtenForm {
    constructor() {
        this.form = document.getElementById('gutachten-form');
        this.signatureCanvas = null;
        this.messageDiv = document.getElementById('message');
        
        this.init();
    }
    
    init() {
        this.setupSignature();
        this.bindEvents();
        this.setupFormValidation();
    }
    
    setupSignature() {
        const canvas = document.getElementById('signature-canvas');
        const clearBtn = document.getElementById('clear-signature');
        
        if (canvas) {
            this.signatureCanvas = new SignatureCanvas(canvas);
            
            if (clearBtn) {
                clearBtn.addEventListener('click', () => {
                    this.signatureCanvas.clear();
                });
            }
        }
    }
    
    bindEvents() {
        this.form.addEventListener('submit', this.handleSubmit.bind(this));
        
        // Auto-generate Gutachten number if empty
        const gutachtenNrField = document.getElementById('gutachten-nr');
        if (gutachtenNrField && !gutachtenNrField.value) {
            gutachtenNrField.value = this.generateGutachtenNumber();
        }
        
        // Format Kennzeichen fields automatically
        const kennzeichenFields = document.querySelectorAll('input[name*="kennzeichen"]');
        kennzeichenFields.forEach(field => {
            field.addEventListener('input', this.formatKennzeichen.bind(this));
        });
        
        // Email/Phone validation
        const kontaktField = document.getElementById('email-telefon');
        if (kontaktField) {
            kontaktField.addEventListener('blur', this.validateKontakt.bind(this));
        }
        
        // Only allow one checkbox in Vorsteuerabzug group
        const vorsteuerCheckboxes = document.querySelectorAll('input[name="vorsteuerabzug"]');
        vorsteuerCheckboxes.forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                if (e.target.checked) {
                    vorsteuerCheckboxes.forEach(cb => {
                        if (cb !== e.target) cb.checked = false;
                    });
                }
            });
        });
    }
    
    setupFormValidation() {
        // Add real-time validation
        const requiredFields = this.form.querySelectorAll('input[required]');
        requiredFields.forEach(field => {
            field.addEventListener('blur', this.validateField.bind(this));
        });
    }
    
    generateGutachtenNumber() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const time = String(now.getHours()).padStart(2, '0') + String(now.getMinutes()).padStart(2, '0');
        
        return `DS${year}${month}${day}-${time}`;
    }
    
    formatKennzeichen(e) {
        let value = e.target.value.toUpperCase().replace(/[^A-Z0-9\s-]/g, '');
        e.target.value = value;
    }
    
    validateKontakt(e) {
        const value = e.target.value;
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const phonePattern = /^[\d\s\-\+\(\)]+$/;
        
        if (value && !emailPattern.test(value) && !phonePattern.test(value)) {
            this.showFieldError(e.target, 'Bitte geben Sie eine gültige E-Mail oder Telefonnummer ein');
        } else {
            this.clearFieldError(e.target);
        }
    }
    
    validateField(e) {
        const field = e.target;
        if (field.hasAttribute('required') && !field.value.trim()) {
            this.showFieldError(field, 'Dieses Feld ist erforderlich');
        } else {
            this.clearFieldError(field);
        }
    }
    
    showFieldError(field, message) {
        field.style.borderBottomColor = '#dc3545';
        field.title = message;
    }
    
    clearFieldError(field) {
        field.style.borderBottomColor = '#ffd700';
        field.title = '';
    }
    
    async handleSubmit(e) {
        e.preventDefault();
        
        if (!this.validateForm()) {
            return;
        }
        
        const submitBtn = this.form.querySelector('button[type="submit"]') || this.form.querySelector('.submit-button') || this.form.querySelector('button');
        const originalText = submitBtn ? submitBtn.textContent : 'Submit';
        
        try {
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Wird übertragen...';
            }
            
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
                this.showMessage('Gutachtenauftrag erfolgreich übertragen! Sie erhalten in Kürze eine Bestätigung.', 'success');
                this.form.reset();
                if (this.signatureCanvas) {
                    this.signatureCanvas.clear();
                }
                
                // Redirect nach 3 Sekunden
                setTimeout(() => {
                    window.location.reload();
                }, 3000);
            } else {
                throw new Error(result.error || 'Unbekannter Fehler');
            }
            
        } catch (error) {
            console.error('Form submission error:', error);
            this.showMessage('Fehler beim Übertragen: ' + error.message, 'error');
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
            }
        }
    }
    
    validateForm() {
        const requiredFields = this.form.querySelectorAll('input[required]');
        let isValid = true;
        
        requiredFields.forEach(field => {
            if (!field.value.trim()) {
                this.showFieldError(field, 'Dieses Feld ist erforderlich');
                isValid = false;
            }
        });
        
        // Check signature
        const canvas = document.querySelector('#signature-canvas');
        if (canvas) {
            const ctx = canvas.getContext('2d');
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            let hasData = false;
            for (let i = 0; i < imageData.data.length; i += 4) {
                if (imageData.data[i + 3] > 0) { // Check alpha channel
                    hasData = true;
                    break;
                }
            }
            if (!hasData) {
                this.showMessage('Bitte fügen Sie Ihre Unterschrift hinzu', 'error');
                isValid = false;
            }
        }
        
        return isValid;
    }
    
    collectFormData() {
        const formData = new FormData(this.form);
        const data = {};
        
        // Convert FormData to nested object
        for (let [key, value] of formData.entries()) {
            this.setNestedValue(data, key, value);
        }
        
        // Explicitly get Gutachten number and Abtretung
        const gutachtenNrField = document.getElementById('gutachten-nr');
        if (gutachtenNrField && gutachtenNrField.value) {
            data.gutachtenNr = gutachtenNrField.value;
        }
        
        const abtretungField = document.getElementById('abtretung');
        if (abtretungField && abtretungField.checked) {
            data.abtretung = true;
        }
        
        // Add signature
        if (this.signatureCanvas && this.signatureCanvas.hasSignature) {
            data.signature = this.signatureCanvas.getDataURL();
        }
        
        // Add timestamp
        data.timestamp = new Date().toISOString();
        
        // Add Gutachten number if not present
        if (!data.gutachtenNr) {
            data.gutachtenNr = this.generateGutachtenNumber();
        }
        
        console.log('🚀 Form data being sent:', data);
        
        return data;
    }
    
    setNestedValue(obj, path, value) {
        const keys = path.split('.');
        let current = obj;
        
        for (let i = 0; i < keys.length - 1; i++) {
            if (!current[keys[i]]) {
                current[keys[i]] = {};
            }
            current = current[keys[i]];
        }
        
        current[keys[keys.length - 1]] = value;
    }
    
    showMessage(text, type) {
        this.messageDiv.textContent = text;
        this.messageDiv.className = `message ${type}`;
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            this.messageDiv.classList.add('hidden');
        }, 5000);
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new GutachtenForm();
});

// Service Worker Registration (for offline capability)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('SW registered: ', registration);
            })
            .catch(registrationError => {
                console.log('SW registration failed: ', registrationError);
            });
    });
}