// Simple Signature Canvas Implementation
document.addEventListener('DOMContentLoaded', function() {
    const canvas = document.getElementById('signatureCanvas');
    const clearBtn = document.getElementById('clearSignature');
    
    if (!canvas) {
        console.error('Canvas element not found!');
        return;
    }
    
    const ctx = canvas.getContext('2d');
    let isDrawing = false;
    let lastX = 0;
    let lastY = 0;
    
    // Set up canvas styling
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    // Get mouse/touch position relative to canvas
    function getPosition(e) {
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX || e.touches[0].clientX) - rect.left;
        const y = (e.clientY || e.touches[0].clientY) - rect.top;
        
        // Scale coordinates to canvas size
        return {
            x: x * (canvas.width / rect.width),
            y: y * (canvas.height / rect.height)
        };
    }
    
    // Start drawing
    function startDrawing(e) {
        isDrawing = true;
        const pos = getPosition(e);
        lastX = pos.x;
        lastY = pos.y;
        
        ctx.beginPath();
        ctx.moveTo(lastX, lastY);
        
        console.log('Started drawing at', lastX, lastY);
    }
    
    // Draw
    function draw(e) {
        if (!isDrawing) return;
        
        e.preventDefault();
        const pos = getPosition(e);
        
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
        
        lastX = pos.x;
        lastY = pos.y;
    }
    
    // Stop drawing
    function stopDrawing() {
        if (!isDrawing) return;
        isDrawing = false;
        console.log('Stopped drawing');
    }
    
    // Clear canvas
    function clearCanvas() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        console.log('Canvas cleared');
    }
    
    // Mouse events
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', stopDrawing);
    
    // Touch events
    canvas.addEventListener('touchstart', function(e) {
        e.preventDefault();
        const touch = e.touches[0];
        const mouseEvent = new MouseEvent('mousedown', {
            clientX: touch.clientX,
            clientY: touch.clientY
        });
        canvas.dispatchEvent(mouseEvent);
    });
    
    canvas.addEventListener('touchmove', function(e) {
        e.preventDefault();
        const touch = e.touches[0];
        const mouseEvent = new MouseEvent('mousemove', {
            clientX: touch.clientX,
            clientY: touch.clientY
        });
        canvas.dispatchEvent(mouseEvent);
    });
    
    canvas.addEventListener('touchend', function(e) {
        e.preventDefault();
        const mouseEvent = new MouseEvent('mouseup', {});
        canvas.dispatchEvent(mouseEvent);
    });
    
    // Clear button
    if (clearBtn) {
        clearBtn.addEventListener('click', clearCanvas);
    }
    
    // Make canvas data available globally
    window.getSignatureData = function() {
        return canvas.toDataURL();
    };
    
    window.hasSignature = function() {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        return imageData.data.some(channel => channel !== 0 && channel !== 255);
    };
    
    console.log('Signature canvas initialized successfully!');
});