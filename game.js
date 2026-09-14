/* ==========================================================================
   Aether Jigsaw - Core Game Engine
   ========================================================================== */

// Game Constants
const BOARD_WIDTH = 2400;
const BOARD_HEIGHT = 1600;
const SNAP_THRESHOLD = 20; // Pixels
const MAX_ZOOM = 3.0;
const MIN_ZOOM = 0.3;

// Game State
let gameState = {
    screen: 'setup',           // 'setup' or 'game'
    imageType: 'procedural',   // 'procedural' or 'custom'
    imageValue: 'aurora',      // 'aurora', 'nebula', etc., or custom image src
    difficulty: 2,             // 1 to 5
    cols: 6,
    rows: 4,
    allowRotation: true,
    soundEnabled: true,
    showGuide: true,
    originalImage: null,       // Image object
    imageWidth: 900,
    imageHeight: 600,
    
    // Multiplayer State
    isMultiplayer: false,
    role: null,                // 'host' or 'guest'
    peer: null,                // Peer instance
    conn: null,                // Connection instance
    partnerCursor: { x: 0, y: 0, active: false },
    partnerName: 'My Love',
    
    // Viewport & Pan/Zoom
    zoom: 1.0,
    panX: 0,
    panY: 0,
    
    // Gameplay data
    pieces: [],                // Array of all piece objects
    draggedGroup: null,        // Currently dragged group (array of pieces)
    dragStartBoardX: 0,
    dragStartBoardY: 0,
    lastBoardX: 0,
    lastBoardY: 0,
    
    // Navigation / Pan state
    isPanning: false,
    panStartMouseX: 0,
    panStartMouseY: 0,
    spacePressed: false,
    
    // Stats
    startTime: null,
    timerInterval: null,
    moveCount: 0,
    solvedCount: 0,
    isCompleted: false,
    
    // Particles/Confetti
    particles: []
};

// Procedural Image Generator (Generates offline CORS-safe beautiful backdrops)
function generateProceduralImage(type, width = 1200, height = 800) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    
    if (type === 'aurora') {
        // Sunset Aurora
        const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
        skyGrad.addColorStop(0, '#0f172a');
        skyGrad.addColorStop(0.4, '#1e1b4b');
        skyGrad.addColorStop(0.7, '#2e1065');
        skyGrad.addColorStop(1, '#ff7e5f');
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, width, height);

        // Aurora waves
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        for (let i = 0; i < 3; i++) {
            const grad = ctx.createLinearGradient(0, 0, width, 0);
            grad.addColorStop(0, 'rgba(16, 185, 129, 0)');
            grad.addColorStop(0.3 + i * 0.1, 'rgba(52, 211, 153, 0.4)');
            grad.addColorStop(0.6 + i * 0.1, 'rgba(14, 165, 233, 0.5)');
            grad.addColorStop(1, 'rgba(16, 185, 129, 0)');
            ctx.strokeStyle = grad;
            ctx.lineWidth = 60 + i * 20;
            ctx.filter = 'blur(30px)';
            
            ctx.beginPath();
            ctx.moveTo(0, height * 0.3 + i * 40);
            ctx.bezierCurveTo(
                width * 0.25, height * (0.1 + i * 0.05),
                width * 0.75, height * (0.6 - i * 0.05),
                width, height * 0.4 + i * 30
            );
            ctx.stroke();
        }
        ctx.restore();

        // Mountains silhouette
        ctx.fillStyle = '#05070f';
        ctx.beginPath();
        ctx.moveTo(0, height);
        ctx.lineTo(0, height * 0.85);
        ctx.lineTo(width * 0.2, height * 0.78);
        ctx.lineTo(width * 0.35, height * 0.84);
        ctx.lineTo(width * 0.55, height * 0.73);
        ctx.lineTo(width * 0.8, height * 0.82);
        ctx.lineTo(width, height * 0.76);
        ctx.lineTo(width, height);
        ctx.closePath();
        ctx.fill();
        
    } else if (type === 'nebula') {
        // Deep Space Nebula
        ctx.fillStyle = '#020205';
        ctx.fillRect(0, 0, width, height);
        
        // Nebula gas
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        const colors = [
            { r: 236, g: 72, b: 153, x: 0.3, y: 0.4, rad: 300 }, // Pink
            { r: 99, g: 102, b: 241, x: 0.6, y: 0.5, rad: 400 }, // Indigo
            { r: 14, g: 165, b: 233, x: 0.4, y: 0.6, rad: 250 }  // Cyan
        ];
        colors.forEach(c => {
            const radGrad = ctx.createRadialGradient(
                width * c.x, height * c.y, 0,
                width * c.x, height * c.y, c.rad
            );
            radGrad.addColorStop(0, `rgba(${c.r}, ${c.g}, ${c.b}, 0.25)`);
            radGrad.addColorStop(0.5, `rgba(${c.r}, ${c.g}, ${c.b}, 0.08)`);
            radGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = radGrad;
            ctx.filter = 'blur(40px)';
            ctx.beginPath();
            ctx.arc(width * c.x, height * c.y, c.rad, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.restore();
        
        // Stars
        ctx.fillStyle = '#ffffff';
        for (let i = 0; i < 150; i++) {
            const starX = Math.random() * width;
            const starY = Math.random() * height;
            const starRad = Math.random() * 1.5;
            const opacity = Math.random() * 0.8 + 0.2;
            
            ctx.save();
            ctx.globalAlpha = opacity;
            ctx.beginPath();
            ctx.arc(starX, starY, starRad, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
        
    } else if (type === 'cyber') {
        // Cyberpunk Theme
        const bgGrad = ctx.createRadialGradient(width/2, height/2, 50, width/2, height/2, width*0.7);
        bgGrad.addColorStop(0, '#18021e');
        bgGrad.addColorStop(1, '#05000a');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, width, height);
        
        // Cyber grid
        ctx.strokeStyle = 'rgba(236, 72, 153, 0.15)';
        ctx.lineWidth = 1;
        const gridSize = 40;
        
        // Vertical lines with perspective logic
        for (let x = 0; x < width; x += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }
        // Horizontal lines
        for (let y = 0; y < height; y += gridSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }
        
        // Glowing futuristic HUD element
        ctx.strokeStyle = '#06b6d4';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#06b6d4';
        ctx.shadowBlur = 15;
        
        ctx.beginPath();
        ctx.arc(width/2, height/2, 120, 0, Math.PI * 1.5);
        ctx.stroke();
        
        ctx.strokeStyle = '#ec4899';
        ctx.shadowColor = '#ec4899';
        ctx.beginPath();
        ctx.arc(width/2, height/2, 140, Math.PI * 0.8, Math.PI * 1.8);
        ctx.stroke();
        
        ctx.shadowBlur = 0; // reset
        
    } else if (type === 'forest') {
        // Emerald Forest Gradient
        const grad = ctx.createLinearGradient(0, 0, width, height);
        grad.addColorStop(0, '#064e3b');
        grad.addColorStop(0.5, '#022c22');
        grad.addColorStop(1, '#020617');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);
        
        // Sunlight beams
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.fillStyle = 'rgba(250, 204, 21, 0.07)';
        ctx.filter = 'blur(15px)';
        for (let i = 0; i < 5; i++) {
            ctx.beginPath();
            ctx.moveTo(width * 0.2 + i * 100, 0);
            ctx.lineTo(width * 0.4 + i * 120, height);
            ctx.lineTo(width * 0.5 + i * 120, height);
            ctx.lineTo(width * 0.3 + i * 100, 0);
            ctx.closePath();
            ctx.fill();
        }
        ctx.restore();
        
        // Organic background shapes
        ctx.fillStyle = 'rgba(16, 185, 129, 0.05)';
        for (let i = 0; i < 20; i++) {
            ctx.beginPath();
            ctx.arc(Math.random() * width, Math.random() * height, Math.random() * 150 + 50, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    
    return canvas.toDataURL('image/jpeg');
}

// Play Sound Effect using Web Audio API (completely offline synthesizers)
function playSnapSound() {
    if (!gameState.soundEnabled) return;
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        
        // High click impulse (cardboard snapping)
        const clickOsc = audioCtx.createOscillator();
        const clickGain = audioCtx.createGain();
        clickOsc.type = 'sine';
        clickOsc.frequency.setValueAtTime(900, audioCtx.currentTime);
        clickOsc.frequency.exponentialRampToValueAtTime(350, audioCtx.currentTime + 0.03);
        
        clickGain.gain.setValueAtTime(0.18, audioCtx.currentTime);
        clickGain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.03);
        
        clickOsc.connect(clickGain);
        clickGain.connect(audioCtx.destination);
        
        // Low woody knock
        const knockOsc = audioCtx.createOscillator();
        const knockGain = audioCtx.createGain();
        knockOsc.type = 'triangle';
        knockOsc.frequency.setValueAtTime(140, audioCtx.currentTime);
        knockOsc.frequency.exponentialRampToValueAtTime(50, audioCtx.currentTime + 0.08);
        
        knockGain.gain.setValueAtTime(0.35, audioCtx.currentTime);
        knockGain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.08);
        
        knockOsc.connect(knockGain);
        knockGain.connect(audioCtx.destination);
        
        // Start and stop
        clickOsc.start();
        knockOsc.start();
        clickOsc.stop(audioCtx.currentTime + 0.03);
        knockOsc.stop(audioCtx.currentTime + 0.08);
    } catch (e) {
        console.warn("Audio Context failed initialization", e);
    }
}

// Particle/Confetti explosion when completing
function triggerConfetti() {
    const canvas = document.getElementById('game-canvas');
    const width = canvas.width;
    const height = canvas.height;
    
    // Spawn particles
    for (let i = 0; i < 120; i++) {
        gameState.particles.push({
            x: width / 2,
            y: height / 2 - 100,
            vx: (Math.random() - 0.5) * 15,
            vy: (Math.random() - 0.7) * 18 - 5,
            size: Math.random() * 8 + 4,
            color: `hsl(${Math.random() * 360}, 85%, 60%)`,
            alpha: 1,
            decay: Math.random() * 0.015 + 0.008,
            gravity: 0.35
        });
    }
}

// Generate the classic jigsaw puzzle edge shape logic
function drawJigsawEdge(ctx, x1, y1, x2, y2, dir) {
    if (dir === 0) {
        ctx.lineTo(x2, y2);
        return;
    }
    
    const dx = x2 - x1;
    const dy = y2 - y1;
    const L = Math.sqrt(dx * dx + dy * dy);
    
    // Tangent vector
    const tx = dx / L;
    const ty = dy / L;
    
    // Normal vector pointing outwards (clockwise convention)
    const nx = dy / L;
    const ny = -dx / L;
    
    // Defining specific nodes along the jigsaw edge
    const p1x = x1 + 0.38 * tx * L;
    const p1y = y1 + 0.38 * ty * L;
    
    // Neck indentation point
    const cp1x = x1 + (0.35 * tx + 0.04 * nx * dir) * L;
    const cp1y = y1 + (0.35 * ty + 0.04 * ny * dir) * L;
    
    // Head left flare point
    const cp2x = x1 + (0.32 * tx + 0.18 * nx * dir) * L;
    const cp2y = y1 + (0.32 * ty + 0.18 * ny * dir) * L;
    
    // Head top-left corner
    const pmldx = x1 + (0.42 * tx + 0.20 * nx * dir) * L;
    const pmldy = y1 + (0.42 * ty + 0.20 * ny * dir) * L;
    
    // Head top-right corner
    const pmrdx = x1 + (0.58 * tx + 0.20 * nx * dir) * L;
    const pmrdy = y1 + (0.58 * ty + 0.20 * ny * dir) * L;
    
    // Head right flare point
    const cp3x = x1 + (0.68 * tx + 0.18 * nx * dir) * L;
    const cp3y = y1 + (0.68 * ty + 0.18 * ny * dir) * L;
    
    // Neck indentation point (right)
    const cp4x = x1 + (0.65 * tx + 0.04 * nx * dir) * L;
    const cp4y = y1 + (0.65 * ty + 0.04 * ny * dir) * L;
    
    const p2x = x1 + 0.62 * tx * L;
    const p2y = y1 + 0.62 * ty * L;
    
    ctx.lineTo(p1x, p1y);
    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, pmldx, pmldy);
    ctx.lineTo(pmrdx, pmrdy);
    ctx.bezierCurveTo(cp3x, cp3y, cp4x, cp4y, p2x, p2y);
    ctx.lineTo(x2, y2);
}

// Crop and clip individual jigsaw piece canvases
function createPieceCanvas(image, piece, w, h, padding) {
    const pCanvas = document.createElement('canvas');
    pCanvas.width = w + 2 * padding;
    pCanvas.height = h + 2 * padding;
    const pCtx = pCanvas.getContext('2d');
    
    const x = padding;
    const y = padding;
    
    // Create the clipping path
    pCtx.beginPath();
    pCtx.moveTo(x, y);
    drawJigsawEdge(pCtx, x, y, x + w, y, piece.top);
    drawJigsawEdge(pCtx, x + w, y, x + w, y + h, piece.right);
    drawJigsawEdge(pCtx, x + w, y + h, x, y + h, piece.bottom);
    drawJigsawEdge(pCtx, x, y + h, x, y, piece.left);
    pCtx.closePath();
    
    // Clip to jigsaw boundary
    pCtx.save();
    pCtx.clip();
    pCtx.drawImage(
        image,
        piece.col * w, piece.row * h, w, h,
        padding, padding, w, h
    );
    pCtx.restore();
    
    // Draw outer dark shadow border
    pCtx.beginPath();
    pCtx.moveTo(x, y);
    drawJigsawEdge(pCtx, x, y, x + w, y, piece.top);
    drawJigsawEdge(pCtx, x + w, y, x + w, y + h, piece.right);
    drawJigsawEdge(pCtx, x + w, y + h, x, y + h, piece.bottom);
    drawJigsawEdge(pCtx, x, y + h, x, y, piece.left);
    pCtx.closePath();
    pCtx.strokeStyle = 'rgba(0, 0, 0, 0.45)';
    pCtx.lineWidth = 1.8;
    pCtx.stroke();
    
    // Draw overlay inner glow and bevel (shading)
    pCtx.save();
    pCtx.clip();
    pCtx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
    pCtx.lineWidth = 2.0;
    pCtx.translate(-1, -1);
    pCtx.stroke();
    
    pCtx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
    pCtx.translate(2, 2);
    pCtx.stroke();
    pCtx.restore();
    
    return pCanvas;
}

// Generate all piece objects and divide image
function initPuzzlePieces() {
    const cols = gameState.cols;
    const rows = gameState.rows;
    const w = gameState.imageWidth / cols;
    const h = gameState.imageHeight / rows;
    
    // Pre-calculate random edge patterns: 0=flat, 1=tab (out), -1=blank (in)
    // hEdges contains borders between columns: cols-1 horizontal bounds for each row
    const hEdges = [];
    for (let c = 0; c < cols - 1; c++) {
        hEdges[c] = [];
        for (let r = 0; r < rows; r++) {
            hEdges[c][r] = Math.random() < 0.5 ? 1 : -1;
        }
    }
    
    // vEdges contains borders between rows: rows-1 vertical bounds for each col
    const vEdges = [];
    for (let c = 0; c < cols; c++) {
        vEdges[c] = [];
        for (let r = 0; r < rows - 1; r++) {
            vEdges[c][r] = Math.random() < 0.5 ? 1 : -1;
        }
    }
    
    gameState.pieces = [];
    const padding = Math.max(w, h) * 0.25; // tab space padding
    
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const piece = {
                id: r * cols + c,
                col: c,
                row: r,
                top: r === 0 ? 0 : -vEdges[c][r - 1],
                right: c === cols - 1 ? 0 : hEdges[c][r],
                bottom: r === rows - 1 ? 0 : vEdges[c][r],
                left: c === 0 ? 0 : -hEdges[c - 1][r],
                
                // Position properties
                x: 0,
                y: 0,
                targetX: (BOARD_WIDTH - gameState.imageWidth) / 2 + c * w,
                targetY: (BOARD_HEIGHT - gameState.imageHeight) / 2 + r * h,
                rotation: 0, // 0, 90, 180, 270 degrees
                
                padding: padding,
                w: w,
                h: h,
                isLocked: false,
                isLockedByPartner: false
            };
            
            // Render piece offscreen canvas
            piece.canvas = createPieceCanvas(gameState.originalImage, piece, w, h, padding);
            
            // Set up its initial singleton group
            piece.group = [piece];
            
            gameState.pieces.push(piece);
        }
    }
    
    scatterPieces();
}

// Arrange/Scattered the pieces randomly outside target grid
function scatterPieces() {
    const targetX = (BOARD_WIDTH - gameState.imageWidth) / 2;
    const targetY = (BOARD_HEIGHT - gameState.imageHeight) / 2;
    const w = gameState.imageWidth;
    const h = gameState.imageHeight;
    
    gameState.pieces.forEach(p => {
        // Reset grouping
        p.group = [p];
        p.isLocked = false;
        
        // Random rotation if enabled
        if (gameState.allowRotation) {
            p.rotation = [0, 90, 180, 270][Math.floor(Math.random() * 4)];
        } else {
            p.rotation = 0;
        }
        
        // Randomly place in margins or surrounding areas to avoid overlap in center
        let scatteredX, scatteredY;
        const margin = 100;
        
        // Choose one of 4 zones around the center puzzle target
        const zone = Math.floor(Math.random() * 4);
        if (zone === 0) { // Left
            scatteredX = margin + Math.random() * (targetX - margin - p.w - 100);
            scatteredY = margin + Math.random() * (BOARD_HEIGHT - 2 * margin - p.h);
        } else if (zone === 1) { // Right
            scatteredX = (targetX + w + 100) + Math.random() * (BOARD_WIDTH - (targetX + w + 100) - margin - p.w);
            scatteredY = margin + Math.random() * (BOARD_HEIGHT - 2 * margin - p.h);
        } else if (zone === 2) { // Top
            scatteredX = margin + Math.random() * (BOARD_WIDTH - 2 * margin - p.w);
            scatteredY = margin + Math.random() * (targetY - margin - p.h - 100);
        } else { // Bottom
            scatteredX = margin + Math.random() * (BOARD_WIDTH - 2 * margin - p.w);
            scatteredY = (targetY + h + 100) + Math.random() * (BOARD_HEIGHT - (targetY + h + 100) - margin - p.h);
        }
        
        p.x = scatteredX;
        p.y = scatteredY;
    });
    
    gameState.solvedCount = 0;
    gameState.isCompleted = false;
    document.getElementById('victory-screen').classList.add('hidden');
    updateHUDProgress();
}

// Calculate the center of a group (average position)
function getGroupCenter(group) {
    let sumX = 0;
    let sumY = 0;
    group.forEach(p => {
        sumX += p.x + p.w / 2;
        sumY += p.y + p.h / 2;
    });
    return {
        x: sumX / group.length,
        y: sumY / group.length
    };
}

// Rotate a group 90 degrees around its geometric center
function rotateGroup(group, direction = 1) { // 1 = 90 deg clockwise
    const center = getGroupCenter(group);
    
    group.forEach(p => {
        // Rotate relative position vectors
        const rx = p.x + p.w / 2 - center.x;
        const ry = p.y + p.h / 2 - center.y;
        
        // 90 deg rotation formula: (x, y) -> (-y, x)
        const newRx = -ry * direction;
        const newRy = rx * direction;
        
        p.x = center.x + newRx - p.w / 2;
        p.y = center.y + newRy - p.h / 2;
        
        // Update local piece orientation angle
        p.rotation = (p.rotation + 90 * direction + 360) % 360;
    });
}

// HUD Progress bar and stats update
function updateHUDProgress() {
    const progressFill = document.getElementById('progress-fill');
    const progressText = document.getElementById('progress-text');
    
    // Count pieces that are locked/solved
    const lockedCount = gameState.pieces.filter(p => p.isLocked).length;
    gameState.solvedCount = lockedCount;
    
    const pct = Math.round((lockedCount / gameState.pieces.length) * 100);
    progressFill.style.width = `${pct}%`;
    progressText.innerText = `${pct}% solved`;
    
    if (lockedCount === gameState.pieces.length && !gameState.isCompleted) {
        handleGameVictory();
    }
}

// Game completed sequence
function handleGameVictory() {
    gameState.isCompleted = true;
    clearInterval(gameState.timerInterval);
    
    // Victory Sound
    playSnapSound();
    setTimeout(() => { playSnapSound(); }, 120);
    setTimeout(() => { playSnapSound(); }, 250);
    
    // Confetti particles
    triggerConfetti();
    
    // Format timer
    const elapsedSecs = Math.floor((new Date() - gameState.startTime) / 1000);
    const m = Math.floor(elapsedSecs / 60);
    const s = elapsedSecs % 60;
    const timeStr = `${m}:${s < 10 ? '0' : ''}${s}`;
    
    document.getElementById('victory-time').innerText = timeStr;
    document.getElementById('victory-moves').innerText = gameState.moveCount;
    
    setTimeout(() => {
        document.getElementById('victory-screen').classList.remove('hidden');
    }, 1000);
}

// Check snaps between dragged group and the rest of the board
function checkGroupSnaps(draggedGroup) {
    let hasSnapped = false;
    const w = draggedGroup[0].w;
    const h = draggedGroup[0].h;
    
    // 1. Check snap to background guide board (Solved targets)
    // Snaps to grid if any piece in the group aligns with its targetsolved coordinates
    // Snapping requires the group to be at rotation === 0
    if (draggedGroup[0].rotation === 0) {
        for (let i = 0; i < draggedGroup.length; i++) {
            const p = draggedGroup[i];
            const dist = Math.hypot(p.x - p.targetX, p.y - p.targetY);
            
            if (dist < SNAP_THRESHOLD) {
                // Perfect translation delta to lock it into place
                const dx = p.targetX - p.x;
                const dy = p.targetY - p.y;
                
                // Translate the entire group
                draggedGroup.forEach(item => {
                    item.x += dx;
                    item.y += dy;
                    item.isLocked = true;
                });
                
                // Join this group with all other already locked pieces
                const lockedPieces = gameState.pieces.filter(item => item.isLocked && !draggedGroup.includes(item));
                if (lockedPieces.length > 0) {
                    const masterLockedGroup = lockedPieces[0].group;
                    draggedGroup.forEach(item => {
                        if (!masterLockedGroup.includes(item)) {
                            masterLockedGroup.push(item);
                            item.group = masterLockedGroup;
                        }
                    });
                }
                
                playSnapSound();
                hasSnapped = true;
                break;
            }
        }
    }
    
    if (hasSnapped) {
        updateHUDProgress();
        return;
    }
    
    // 2. Check snap to other groups
    for (let i = 0; i < draggedGroup.length; i++) {
        const p = draggedGroup[i];
        
        // Find adjacent indices in original puzzle layout
        const neighbors = [
            { col: p.col,     row: p.row - 1 }, // Up
            { col: p.col + 1, row: p.row },     // Right
            { col: p.col,     row: p.row + 1 }, // Down
            { col: p.col - 1, row: p.row }      // Left
        ];
        
        for (let nIdx = 0; nIdx < neighbors.length; nIdx++) {
            const n = neighbors[nIdx];
            if (n.col < 0 || n.col >= gameState.cols || n.row < 0 || n.row >= gameState.rows) continue;
            
            // Find neighbor piece object
            const nbr = gameState.pieces.find(item => item.col === n.col && item.row === n.row);
            
            // Only snap if neighbor is NOT in our group, and is NOT locked (or we are both locked, but locked is handled above),
            // and we share the same rotation orientation
            if (nbr && nbr.group !== p.group && nbr.rotation === p.rotation) {
                
                // Expected solved relative distance
                const relSolvedX = nbr.targetX - p.targetX;
                const relSolvedY = nbr.targetY - p.targetY;
                
                // Rotate the expected distance vector by current rotation
                let rx = relSolvedX;
                let ry = relSolvedY;
                const theta = p.rotation;
                if (theta === 90) {
                    rx = -relSolvedY;
                    ry = relSolvedX;
                } else if (theta === 180) {
                    rx = -relSolvedX;
                    ry = -relSolvedY;
                } else if (theta === 270) {
                    rx = relSolvedY;
                    ry = -relSolvedX;
                }
                
                // Actual current distance
                const actualDx = nbr.x - p.x;
                const actualDy = nbr.y - p.y;
                
                // Error vector
                const errX = actualDx - rx;
                const errY = actualDy - ry;
                const distErr = Math.hypot(errX, errY);
                
                if (distErr < SNAP_THRESHOLD) {
                    // Snap the dragged group by shifting it to match neighbor
                    draggedGroup.forEach(item => {
                        item.x += errX;
                        item.y += errY;
                    });
                    
                    // Merge groups
                    const targetGroup = nbr.group;
                    draggedGroup.forEach(item => {
                        targetGroup.push(item);
                        item.group = targetGroup;
                    });
                    
                    // If neighbor group was locked, lock all merged pieces
                    if (nbr.isLocked) {
                        targetGroup.forEach(item => item.isLocked = true);
                    }
                    
                    playSnapSound();
                    hasSnapped = true;
                    
                    // Recursive snap check in case we snap into multiple adjacent groups simultaneously
                    checkGroupSnaps(targetGroup);
                    break;
                }
            }
        }
        if (hasSnapped) break;
    }
    
    updateHUDProgress();
}

// Convert coordinates: Screen viewport to Board coordinates
function screenToBoard(sx, sy) {
    return {
        x: (sx - gameState.panX) / gameState.zoom,
        y: (sy - gameState.panY) / gameState.zoom
    };
}

// Check which piece is clicked (returns top-most piece)
function getPieceAtBoardPos(bx, by) {
    // Go backwards to select the top-most drawn piece first (layers)
    for (let i = gameState.pieces.length - 1; i >= 0; i--) {
        const p = gameState.pieces[i];
        
        // Bounding box with rotation transforms applied
        // Check simple bounding radius/box for drag starts
        // If piece is rotated, we need to adapt width/height bounds
        let isWithin = false;
        const halfW = p.w / 2;
        const halfH = p.h / 2;
        const cx = p.x + halfW;
        const cy = p.y + halfH;
        
        // Relative coordinate to piece center
        const rx = bx - cx;
        const ry = by - cy;
        
        // Unrotate coords to align check with flat box
        let checkX = rx;
        let checkY = ry;
        const theta = (p.rotation * Math.PI) / 180;
        if (theta !== 0) {
            checkX = rx * Math.cos(-theta) - ry * Math.sin(-theta);
            checkY = rx * Math.sin(-theta) + ry * Math.cos(-theta);
        }
        
        if (checkX >= -halfW && checkX <= halfW && checkY >= -halfH && checkY <= halfH) {
            return p;
        }
    }
    return null;
}

// Solve cheat (moves everything to target solved coordinates)
function cheatSolve() {
    gameState.pieces.forEach(p => {
        p.x = p.targetX;
        p.y = p.targetY;
        p.rotation = 0;
        p.isLocked = true;
        p.group = gameState.pieces; // All merged into single main group
    });
    updateHUDProgress();
}

// Setup Game HUD / Viewport auto fit
function fitPuzzleToViewport() {
    const container = document.getElementById('gameboard-container');
    const cw = container.clientWidth;
    const ch = container.clientHeight;
    
    // Fit the active board bounds containing scattered pieces
    const w = BOARD_WIDTH;
    const h = BOARD_HEIGHT;
    
    const margin = 40;
    const scaleX = (cw - margin) / w;
    const scaleY = (ch - margin) / h;
    const bestZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.min(scaleX, scaleY)));
    
    gameState.zoom = bestZoom;
    
    // Center it on board
    const boardCenter = { x: BOARD_WIDTH / 2, y: BOARD_HEIGHT / 2 };
    gameState.panX = cw / 2 - boardCenter.x * bestZoom;
    gameState.panY = ch / 2 - boardCenter.y * bestZoom;
    
    updateZoomDisplay();
}

function updateZoomDisplay() {
    document.getElementById('zoom-level').innerText = `${Math.round(gameState.zoom * 100)}%`;
}

// Render loop for canvas
function render(canvas, ctx) {
    // If game screen is not active or image is not loaded yet, skip rendering to prevent crashes
    if (gameState.screen !== 'game' || !gameState.originalImage) {
        ctx.fillStyle = '#0a0c12';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        requestAnimationFrame(() => render(canvas, ctx));
        return;
    }

    // Clear screen
    ctx.fillStyle = '#0a0c12';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.save();
    // Viewport transform
    ctx.translate(gameState.panX, gameState.panY);
    ctx.scale(gameState.zoom, gameState.zoom);
    
    // Draw board boundaries / background guide area
    const tx = (BOARD_WIDTH - gameState.imageWidth) / 2;
    const ty = (BOARD_HEIGHT - gameState.imageHeight) / 2;
    
    // Subtle background guidelines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);
    
    // Draw solved guide background outline
    if (gameState.showGuide) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.fillRect(tx, ty, gameState.imageWidth, gameState.imageHeight);
        
        ctx.strokeStyle = 'rgba(99, 102, 241, 0.25)';
        ctx.lineWidth = 3;
        ctx.setLineDash([8, 8]);
        ctx.strokeRect(tx, ty, gameState.imageWidth, gameState.imageHeight);
        ctx.setLineDash([]);
        
        // Draw very faint reference image under the board
        ctx.save();
        ctx.globalAlpha = 0.08;
        ctx.drawImage(gameState.originalImage, tx, ty, gameState.imageWidth, gameState.imageHeight);
        ctx.restore();
    }
    
    // DRAW PIECES
    // Draw locked/solved pieces first so they stay in background
    // Draw dragged pieces last so they render on top
    const lockedPieces = gameState.pieces.filter(p => p.isLocked);
    const freePieces = gameState.pieces.filter(p => !p.isLocked && (!gameState.draggedGroup || !gameState.draggedGroup.includes(p)));
    const draggedPieces = gameState.draggedGroup ? gameState.draggedGroup : [];
    
    const drawPieceList = (list) => {
        list.forEach(p => {
            ctx.save();
            
            // Translate to piece center to apply rotation cleanly
            const halfW = p.w / 2;
            const halfH = p.h / 2;
            const cx = p.x + halfW;
            const cy = p.y + halfH;
            
            ctx.translate(cx, cy);
            ctx.rotate((p.rotation * Math.PI) / 180);
            
            // Draw piece offscreen canvas shifted by padding
            ctx.drawImage(
                p.canvas, 
                -halfW - p.padding, 
                -halfH - p.padding
            );
            
            ctx.restore();
        });
    };
    
    drawPieceList(lockedPieces);
    drawPieceList(freePieces);
    drawPieceList(draggedPieces);
    
    // DRAW PARTNER CURSOR
    if (gameState.isMultiplayer && gameState.partnerCursor.active) {
        ctx.save();
        ctx.translate(gameState.partnerCursor.x, gameState.partnerCursor.y);
        
        ctx.shadowColor = '#f43f5e';
        ctx.shadowBlur = 15;
        
        ctx.font = '24px "Plus Jakarta Sans"';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        ctx.fillText('ðŸ’–', 0, 0);
        
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.font = 'bold 11px "Plus Jakarta Sans"';
        ctx.fillText(gameState.partnerName, 0, 22);
        
        ctx.restore();
    }
    
    ctx.restore();
    
    // Draw particles explosion overlay (directly in screen coordinates)
    if (gameState.particles.length > 0) {
        gameState.particles.forEach((p, idx) => {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += p.gravity;
            p.alpha -= p.decay;
            
            if (p.alpha <= 0) {
                gameState.particles.splice(idx, 1);
            } else {
                ctx.save();
                ctx.globalAlpha = p.alpha;
                ctx.fillStyle = p.color;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }
        });
    }
    
    // Continue loop
    requestAnimationFrame(() => render(canvas, ctx));
}

// Start Game loop and UI transition
function startGame() {
    gameState.screen = 'game';
    gameState.moveCount = 0;
    gameState.startTime = new Date();
    
    // Setup HUD Details
    document.getElementById('hud-puzzle-title').innerText = 
        gameState.imageType === 'procedural' ? 
        document.querySelector('.gallery-item.active span').innerText : 
        "Custom Uploaded Image";
        
    document.getElementById('hud-pieces-count').innerText = `${gameState.pieces.length} pieces`;
    
    // Screen toggle
    document.getElementById('setup-screen').classList.remove('active');
    document.getElementById('game-screen').classList.add('active');
    
    // Run resizing
    const canvas = document.getElementById('game-canvas');
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight;
    
    fitPuzzleToViewport();
    
    // Setup background timer tick
    if (gameState.timerInterval) clearInterval(gameState.timerInterval);
    gameState.timerInterval = setInterval(() => {
        if (gameState.isCompleted) return;
        const elapsed = Math.floor((new Date() - gameState.startTime) / 1000);
        const m = Math.floor(elapsed / 60);
        const s = elapsed % 60;
        // Output title page timing or HUD time updates here if needed
    }, 1000);
}

// Helper to send message to connected Peer
function sendPeerMessage(msg) {
    if (gameState.conn && gameState.conn.open) {
        gameState.conn.send(msg);
    }
}

// Throttle cursor updates to reduce bandwidth usage
let lastCursorSendTime = 0;
function syncCursorPosition(bx, by) {
    if (!gameState.isMultiplayer) return;
    const now = Date.now();
    if (now - lastCursorSendTime > 40) { // 25 updates per second
        sendPeerMessage({ type: 'cursor', x: bx, y: by });
        lastCursorSendTime = now;
    }
}

// Initialize PeerJS Host Connection
function initMultiplayerHost() {
    gameState.isMultiplayer = true;
    gameState.role = 'host';
    
    // Show waiting modal
    const coopModal = document.getElementById('coop-modal');
    const coopUrlBox = document.getElementById('coop-share-url');
    const loaderText = document.getElementById('coop-loader-text');
    
    coopModal.classList.remove('hidden');
    loaderText.innerText = "Creating secure WebRTC connection room...";
    coopUrlBox.value = "";
    
    // Construct PeerJS connection
    const peer = new Peer(null, {
        debug: 1
    });
    gameState.peer = peer;
    
    peer.on('open', (id) => {
        // Construct share link (force rotation to false)
        const shareUrl = window.location.origin + window.location.pathname + 
            '?room=' + id + 
            '&image=' + encodeURIComponent(gameState.imageValue) + 
            '&diff=' + gameState.difficulty + 
            '&rot=0' + 
            '&guide=' + (gameState.showGuide ? '1' : '0');
        
        coopUrlBox.value = shareUrl;
        loaderText.innerText = "Waiting for your partner to join...";
    });
    
    peer.on('connection', (conn) => {
        gameState.conn = conn;
        setupNetworkConnection(conn);
    });
    
    peer.on('error', (err) => {
        console.error("PeerJS Host Error:", err);
        alert("Connection room error: " + err.message);
        cancelMultiplayerSession();
    });
}

// Initialize PeerJS Guest Connection
function initMultiplayerGuest(roomId) {
    gameState.isMultiplayer = true;
    gameState.role = 'guest';
    
    const joiningOverlay = document.getElementById('joining-overlay');
    const statusText = document.getElementById('joining-overlay-status');
    
    joiningOverlay.classList.remove('hidden');
    statusText.innerText = "Connecting to partner's host server...";
    
    const peer = new Peer(null, {
        debug: 1
    });
    gameState.peer = peer;
    
    peer.on('open', () => {
        statusText.innerText = "Connecting to room: " + roomId + "...";
        const conn = peer.connect(roomId);
        gameState.conn = conn;
        setupNetworkConnection(conn);
    });
    
    peer.on('error', (err) => {
        console.error("PeerJS Guest Error:", err);
        alert("Failed to join room: " + err.message);
        window.location.search = ""; // Reload without query params to return to setup
    });
}

// Setup events for open data connection
function setupNetworkConnection(conn) {
    conn.on('open', () => {
        console.log("P2P WebRTC Connection opened successfully!");
        
        // Hide modals/overlays
        document.getElementById('coop-modal').classList.add('hidden');
        document.getElementById('joining-overlay').classList.add('hidden');
        
        // Show status tag in game
        const coopStatus = document.getElementById('coop-status');
        const statusText = document.getElementById('coop-status-text');
        const coopDividers = document.querySelectorAll('.coop-only');
        
        coopStatus.classList.remove('hidden');
        statusText.innerText = "Connected to partner";
        coopDividers.forEach(el => el.classList.remove('hidden'));
        
        if (gameState.role === 'host') {
            // Host sends the initial puzzle state
            startPuzzleWithSettings();
            
            setTimeout(() => {
                const piecesData = gameState.pieces.map(p => ({
                    id: p.id,
                    x: p.x,
                    y: p.y,
                    rotation: p.rotation,
                    isLocked: p.isLocked
                }));
                sendPeerMessage({
                    type: 'init_board',
                    pieces: piecesData
                });
            }, 1000);
        }
    });
    
    conn.on('data', (data) => {
        handleNetworkMessage(data);
    });
    
    conn.on('close', () => {
        console.log("P2P Connection closed by partner.");
        alert("Your partner has disconnected.");
        cancelMultiplayerSession();
    });
}

// Clean up multiplayer session and go back to menu
function cancelMultiplayerSession() {
    if (gameState.conn) gameState.conn.close();
    if (gameState.peer) gameState.peer.destroy();
    
    gameState.isMultiplayer = false;
    gameState.role = null;
    gameState.peer = null;
    gameState.conn = null;
    gameState.partnerCursor.active = false;
    
    // Hide UI elements
    document.getElementById('coop-modal').classList.add('hidden');
    document.getElementById('joining-overlay').classList.add('hidden');
    document.getElementById('coop-status').classList.add('hidden');
    document.querySelectorAll('.coop-only').forEach(el => el.classList.add('hidden'));
    
    // Exit game back to menu if active
    clearInterval(gameState.timerInterval);
    gameState.screen = 'setup';
    document.getElementById('game-screen').classList.remove('active');
    document.getElementById('setup-screen').classList.add('active');
}

// Handler for all network co-op packages
function handleNetworkMessage(data) {
    if (!data || !data.type) return;
    
    switch (data.type) {
        case 'init_board':
            // Guest receives board pieces initialization from Host
            startPuzzleWithSettings();
            
            setTimeout(() => {
                data.pieces.forEach(pData => {
                    const p = gameState.pieces.find(item => item.id === pData.id);
                    if (p) {
                        p.x = pData.x;
                        p.y = pData.y;
                        p.rotation = pData.rotation;
                        p.isLocked = pData.isLocked;
                    }
                });
                reconstructGroups();
                updateHUDProgress();
            }, 1000);
            break;
            
        case 'cursor':
            gameState.partnerCursor.x = data.x;
            gameState.partnerCursor.y = data.y;
            gameState.partnerCursor.active = true;
            break;
            
        case 'lock':
            const lockPiece = gameState.pieces.find(item => item.id === data.pieceId);
            if (lockPiece) {
                lockPiece.group.forEach(item => {
                    item.isLockedByPartner = true;
                });
            }
            break;
            
        case 'release':
            const releasePiece = gameState.pieces.find(item => item.id === data.pieceId);
            if (releasePiece) {
                releasePiece.group.forEach(item => {
                    item.isLockedByPartner = false;
                });
            }
            break;
            
        case 'sync_pieces':
            data.pieces.forEach(pData => {
                const p = gameState.pieces.find(item => item.id === pData.id);
                if (p) {
                    p.x = pData.x;
                    p.y = pData.y;
                    p.rotation = pData.rotation;
                    p.isLocked = pData.isLocked;
                }
            });
            reconstructGroups();
            updateHUDProgress();
            break;
            
        case 'play_sound':
            playSnapSound();
            break;
    }
}

// Helper to reconstruct piece groupings from scratch
function reconstructGroups() {
    gameState.pieces.forEach(p => {
        p.group = [p];
    });
    
    if (gameState.pieces.length === 0) return;
    const w = gameState.pieces[0].w;
    const h = gameState.pieces[0].h;
    
    for (let i = 0; i < gameState.pieces.length; i++) {
        const p1 = gameState.pieces[i];
        
        if (p1.isLocked) {
            const masterLocked = gameState.pieces.filter(item => item.isLocked && item !== p1);
            if (masterLocked.length > 0) {
                const lockedGroup = masterLocked[0].group;
                if (!lockedGroup.includes(p1)) {
                    lockedGroup.push(p1);
                    p1.group = lockedGroup;
                }
            }
            continue;
        }
        
        const neighbors = [
            { col: p1.col + 1, row: p1.row }, // Right
            { col: p1.col,     row: p1.row + 1 }  // Down
        ];
        
        neighbors.forEach(n => {
            if (n.col >= gameState.cols || n.row >= gameState.rows) return;
            const p2 = gameState.pieces.find(item => item.col === n.col && item.row === n.row);
            
            if (!p2 || p1.group === p2.group) return;
            
            const relSolvedX = p2.targetX - p1.targetX;
            const relSolvedY = p2.targetY - p1.targetY;
            
            let rx = relSolvedX;
            let ry = relSolvedY;
            const theta = p1.rotation;
            if (theta === 90) {
                rx = -relSolvedY;
                ry = relSolvedX;
            } else if (theta === 180) {
                rx = -relSolvedX;
                ry = -relSolvedY;
            } else if (theta === 270) {
                rx = relSolvedY;
                ry = -relSolvedX;
            }
            
            const actualDx = p2.x - p1.x;
            const actualDy = p2.y - p1.y;
            
            if (Math.abs(actualDx - rx) < 1.5 && Math.abs(actualDy - ry) < 1.5 && p1.rotation === p2.rotation) {
                const group1 = p1.group;
                const group2 = p2.group;
                
                group2.forEach(item => {
                    if (!group1.includes(item)) {
                        group1.push(item);
                        item.group = group1;
                    }
                });
            }
        });
    }
}

// Start the puzzle assembly with current gameState configurations
function startPuzzleWithSettings() {
    gameState.allowRotation = false; // Disable piece rotation entirely!
    
    const difficultyGrids = {
        1: { cols: 4, rows: 3 },  // 12
        2: { cols: 6, rows: 4 },  // 24
        3: { cols: 8, rows: 6 },  // 48
        4: { cols: 12, rows: 8 }, // 96
        5: { cols: 15, rows: 10 } // 150
    };
    
    gameState.cols = difficultyGrids[gameState.difficulty].cols;
    gameState.rows = difficultyGrids[gameState.difficulty].rows;
    
    const img = new Image();
    img.onload = () => {
        gameState.originalImage = img;
        
        const maxW = 1000;
        const maxH = 680;
        let finalW = img.width;
        let finalH = img.height;
        
        const ratio = img.width / img.height;
        if (finalW > maxW) {
            finalW = maxW;
            finalH = finalW / ratio;
        }
        if (finalH > maxH) {
            finalH = maxH;
            finalW = finalH * ratio;
        }
        
        gameState.imageWidth = finalW;
        gameState.imageHeight = finalH;
        
        document.getElementById('preview-img').src = img.src;
        
        initPuzzlePieces();
        startGame();
    };
    
    if (gameState.imageType === 'procedural') {
        img.src = generateProceduralImage(gameState.imageValue, 1200, 800);
    } else if (gameState.imageType === 'picsum') {
        img.crossOrigin = "anonymous";
        if (gameState.imageValue === 'lake') {
            img.src = "https://picsum.photos/id/1015/1200/800";
        } else if (gameState.imageValue.startsWith('http')) {
            img.src = gameState.imageValue;
        } else {
            img.src = "https://picsum.photos/1200/800?sig=" + Math.floor(Math.random() * 1000000);
        }
    } else {
        img.src = gameState.imageValue;
    }
}

// Parse URL query parameters to load shared puzzles
function parseURLParameters() {
    const params = new URLSearchParams(window.location.search);
    if (params.has('image') || params.has('img')) {
        const imgVal = params.get('image') || params.get('img');
        
        if (['aurora', 'nebula', 'cyber', 'forest'].includes(imgVal)) {
            gameState.imageType = 'procedural';
            gameState.imageValue = imgVal;
        } else if (['lake', 'random'].includes(imgVal)) {
            gameState.imageType = 'picsum';
            gameState.imageValue = imgVal;
        } else if (imgVal.startsWith('http')) {
            gameState.imageType = 'picsum';
            gameState.imageValue = imgVal;
        }
        
        if (params.has('diff')) {
            const d = parseInt(params.get('diff'));
            if (d >= 1 && d <= 5) gameState.difficulty = d;
        }
        if (params.has('rot')) {
            // Keep rotation false as requested
            gameState.allowRotation = false;
        }
        if (params.has('guide')) {
            gameState.showGuide = params.get('guide') === '1' || params.get('guide') === 'true';
        }
        
        const diffSlider = document.getElementById('difficulty-slider');
        if (diffSlider) {
            diffSlider.value = gameState.difficulty;
            const diffLabels = document.querySelectorAll('.difficulty-labels .label');
            diffLabels.forEach(l => {
                if (l.dataset.val == gameState.difficulty) l.classList.add('active');
                else l.classList.remove('active');
            });
        }
        const rotToggle = document.getElementById('rotation-toggle');
        if (rotToggle) rotToggle.checked = false;
        const guideToggle = document.getElementById('guide-toggle');
        if (guideToggle) guideToggle.checked = gameState.showGuide;
        
        // Check if room guest auto join
        if (params.has('room')) {
            initMultiplayerGuest(params.get('room'));
        } else {
            startPuzzleWithSettings();
        }
    }
}

/* ==========================================================================
   UI Event Bindings & Initialization
   ========================================================================== */
window.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('game-canvas');
    const ctx = canvas.getContext('2d');
    
    // Set up canvas frame updates
    requestAnimationFrame(() => render(canvas, ctx));
    
    // Window Resize event
    window.addEventListener('resize', () => {
        if (gameState.screen === 'game') {
            canvas.width = canvas.parentElement.clientWidth;
            canvas.height = canvas.parentElement.clientHeight;
            updateZoomDisplay();
        }
    });
    
    // Gallery selection click
    const galleryItems = document.querySelectorAll('.gallery-item:not(.upload-item)');
    galleryItems.forEach(item => {
        item.addEventListener('click', () => {
            galleryItems.forEach(i => i.classList.remove('active'));
            document.getElementById('upload-btn').classList.remove('active');
            item.classList.add('active');
            
            gameState.imageType = item.dataset.type;
            gameState.imageValue = item.dataset.value;
            
            // Hide custom preview
            document.getElementById('custom-preview-container').classList.add('hidden');
        });
    });
    
    // Custom Upload image click
    const uploadBtn = document.getElementById('upload-btn');
    const fileInput = document.getElementById('image-input');
    
    uploadBtn.addEventListener('click', () => {
        fileInput.click();
    });
    
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (event) => {
            // Display upload preview card
            const previewContainer = document.getElementById('custom-preview-container');
            const previewImg = document.getElementById('custom-preview-img');
            
            previewImg.src = event.target.result;
            previewContainer.classList.remove('hidden');
            
            galleryItems.forEach(i => i.classList.remove('active'));
            uploadBtn.classList.add('active');
            
            gameState.imageType = 'custom';
            gameState.imageValue = event.target.result; // Data URL string
        };
        reader.readAsDataURL(file);
    });
    
    // Remove custom image preview
    document.getElementById('remove-custom-btn').addEventListener('click', () => {
        document.getElementById('custom-preview-container').classList.add('hidden');
        uploadBtn.classList.remove('active');
        fileInput.value = '';
        
        // Fallback default Aurora active
        const auroraItem = document.querySelector('.gallery-item[data-value="aurora"]');
        auroraItem.click();
    });
    
    // Difficulty labels toggle logic
    const difficultySlider = document.getElementById('difficulty-slider');
    const diffLabels = document.querySelectorAll('.difficulty-labels .label');
    difficultySlider.addEventListener('input', (e) => {
        const val = e.target.value;
        diffLabels.forEach(l => {
            if (l.dataset.val === val) {
                l.classList.add('active');
            } else {
                l.classList.remove('active');
            }
        });
    });
    
    // Assemble/Start Puzzle click (Solo)
    document.getElementById('start-game-btn').addEventListener('click', () => {
        const diffVal = parseInt(difficultySlider.value);
        gameState.difficulty = diffVal;
        gameState.allowRotation = false; // force disable rotation
        gameState.soundEnabled = document.getElementById('sound-toggle').checked;
        gameState.showGuide = document.getElementById('guide-toggle').checked;
        
        startPuzzleWithSettings();
    });

    // Start Co-Op Room click
    const startCoopBtn = document.getElementById('start-coop-btn');
    if (startCoopBtn) {
        startCoopBtn.addEventListener('click', () => {
            const diffVal = parseInt(difficultySlider.value);
            gameState.difficulty = diffVal;
            gameState.allowRotation = false; // force disable rotation
            gameState.soundEnabled = document.getElementById('sound-toggle').checked;
            gameState.showGuide = document.getElementById('guide-toggle').checked;
            
            initMultiplayerHost();
        });
    }
    
    // Copy Co-Op shareable link
    const copyCoopUrlBtn = document.getElementById('copy-coop-url-btn');
    if (copyCoopUrlBtn) {
        copyCoopUrlBtn.addEventListener('click', () => {
            const urlInput = document.getElementById('coop-share-url');
            urlInput.select();
            urlInput.setSelectionRange(0, 99999);
            navigator.clipboard.writeText(urlInput.value).then(() => {
                const originalText = copyCoopUrlBtn.innerText;
                copyCoopUrlBtn.innerText = "Copied! ðŸ’–";
                copyCoopUrlBtn.style.backgroundColor = "#10b981";
                copyCoopUrlBtn.style.borderColor = "#10b981";
                
                setTimeout(() => {
                    copyCoopUrlBtn.innerText = originalText;
                    copyCoopUrlBtn.style.backgroundColor = "";
                    copyCoopUrlBtn.style.borderColor = "";
                }, 2000);
            });
        });
    }
    
    // Cancel Co-Op room creation
    const cancelCoopBtn = document.getElementById('cancel-coop-btn');
    if (cancelCoopBtn) {
        cancelCoopBtn.addEventListener('click', () => {
            cancelMultiplayerSession();
        });
    }
    
    // Viewport mouse interactions (Dragging, rotating, panning)
    canvas.addEventListener('mousedown', (e) => {
        const mx = e.clientX - canvas.getBoundingClientRect().left;
        const my = e.clientY - canvas.getBoundingClientRect().top;
        
        // Right click OR spacebar rotation triggers (or drag panning)
        const isRightClick = e.button === 2;
        const isMiddleClick = e.button === 1;
        
        if (isMiddleClick || (gameState.spacePressed && e.button === 0)) {
            // Start panning viewport
            gameState.isPanning = true;
            gameState.panStartMouseX = e.clientX;
            gameState.panStartMouseY = e.clientY;
            canvas.style.cursor = 'move';
            return;
        }
        
        const boardCoords = screenToBoard(mx, my);
        const clickedPiece = getPieceAtBoardPos(boardCoords.x, boardCoords.y);
        
        if (clickedPiece) {
            if (clickedPiece.isLocked || clickedPiece.isLockedByPartner) {
                // Ignore if locked or dragged by partner
                return;
            }
            
            if (isRightClick) {
                // Rotate whole group (disabled as requested)
                if (gameState.allowRotation) {
                    rotateGroup(clickedPiece.group, 1);
                    gameState.moveCount++;
                    checkGroupSnaps(clickedPiece.group);
                }
            } else if (e.button === 0) {
                // Left click -> Start Dragging Group
                gameState.draggedGroup = clickedPiece.group;
                gameState.lastBoardX = boardCoords.x;
                gameState.lastBoardY = boardCoords.y;
                
                // Lift pieces to top of rendering order
                const otherPieces = gameState.pieces.filter(p => !gameState.draggedGroup.includes(p));
                gameState.pieces = [...otherPieces, ...gameState.draggedGroup];
                
                // Lock piece for partner
                if (gameState.isMultiplayer) {
                    sendPeerMessage({ type: 'lock', pieceId: clickedPiece.id });
                }
            }
        } else {
            // Clicked background -> Pan background
            if (e.button === 0 || isRightClick) {
                gameState.isPanning = true;
                gameState.panStartMouseX = e.clientX;
                gameState.panStartMouseY = e.clientY;
            }
        }
    });
    
    canvas.addEventListener('mousemove', (e) => {
        const mx = e.clientX - canvas.getBoundingClientRect().left;
        const my = e.clientY - canvas.getBoundingClientRect().top;
        
        const boardCoords = screenToBoard(mx, my);
        syncCursorPosition(boardCoords.x, boardCoords.y);
        
        if (gameState.isPanning) {
            const dx = e.clientX - gameState.panStartMouseX;
            const dy = e.clientY - gameState.panStartMouseY;
            gameState.panX += dx;
            gameState.panY += dy;
            gameState.panStartMouseX = e.clientX;
            gameState.panStartMouseY = e.clientY;
            return;
        }
        
        if (gameState.draggedGroup) {
            const dx = boardCoords.x - gameState.lastBoardX;
            const dy = boardCoords.y - gameState.lastBoardY;
            
            // Shift all pieces in group
            gameState.draggedGroup.forEach(p => {
                p.x += dx;
                p.y += dy;
            });
            
            gameState.lastBoardX = boardCoords.x;
            gameState.lastBoardY = boardCoords.y;
        }
    });
    
    const handleMouseRelease = (e) => {
        if (gameState.isPanning) {
            gameState.isPanning = false;
            canvas.style.cursor = 'grab';
        }
        
        if (gameState.draggedGroup) {
            const groupToSync = gameState.draggedGroup;
            const repPiece = groupToSync[0];
            
            // Drop pieces -> trigger snap checking
            gameState.moveCount++;
            checkGroupSnaps(groupToSync);
            
            // Sync final coordinates and release lock
            if (gameState.isMultiplayer) {
                sendPeerMessage({ type: 'release', pieceId: repPiece.id });
                sendPeerMessage({
                    type: 'sync_pieces',
                    pieces: groupToSync.map(p => ({
                        id: p.id,
                        x: p.x,
                        y: p.y,
                        rotation: p.rotation,
                        isLocked: p.isLocked
                    }))
                });
            }
            
            gameState.draggedGroup = null;
        }
    };
    
    canvas.addEventListener('mouseup', handleMouseRelease);
    canvas.addEventListener('mouseleave', handleMouseRelease);
    
    // Disable default browser context menu for canvas
    canvas.addEventListener('contextmenu', (e) => {
        e.preventDefault();
    });
    
    // Canvas Zooming scroll wheel
    canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        
        const mx = e.clientX - canvas.getBoundingClientRect().left;
        const my = e.clientY - canvas.getBoundingClientRect().top;
        
        const zoomFactor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
        const oldZoom = gameState.zoom;
        const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, oldZoom * zoomFactor));
        
        if (newZoom !== oldZoom) {
            // Zoom centered on cursor position
            const boardPos = screenToBoard(mx, my);
            gameState.zoom = newZoom;
            gameState.panX = mx - boardPos.x * newZoom;
            gameState.panY = my - boardPos.y * newZoom;
            
            updateZoomDisplay();
        }
    });
    
    // Keyboard listener for Spacebar rotating/panning
    window.addEventListener('keydown', (e) => {
        if (e.code === 'Space') {
            e.preventDefault(); // stop scrolling page
            gameState.spacePressed = true;
            
            // If dragging, space rotates the group
            if (gameState.draggedGroup && gameState.allowRotation) {
                rotateGroup(gameState.draggedGroup, 1);
                gameState.moveCount++;
                checkGroupSnaps(gameState.draggedGroup);
            }
        }
    });
    
    window.addEventListener('keyup', (e) => {
        if (e.code === 'Space') {
            gameState.spacePressed = false;
        }
    });
    
    // HUD HUD Action buttons bindings
    document.getElementById('back-to-menu-btn').addEventListener('click', () => {
        if (gameState.isMultiplayer) {
            cancelMultiplayerSession();
            return;
        }
        clearInterval(gameState.timerInterval);
        gameState.screen = 'setup';
        document.getElementById('game-screen').classList.remove('active');
        document.getElementById('setup-screen').classList.add('active');
    });
    
    document.getElementById('victory-menu-btn').addEventListener('click', () => {
        document.getElementById('victory-screen').classList.add('hidden');
        document.getElementById('back-to-menu-btn').click();
    });
    
    // HUD Preview panel toggle
    const previewPanel = document.getElementById('preview-panel');
    document.getElementById('toggle-preview-btn').addEventListener('click', () => {
        previewPanel.classList.toggle('hidden');
    });
    
    document.getElementById('close-preview-panel-btn').addEventListener('click', () => {
        previewPanel.classList.add('hidden');
    });
    
    // Zoom Buttons
    document.getElementById('zoom-in-btn').addEventListener('click', () => {
        const container = document.getElementById('gameboard-container');
        const cx = container.clientWidth / 2;
        const cy = container.clientHeight / 2;
        
        const boardPos = screenToBoard(cx, cy);
        gameState.zoom = Math.min(MAX_ZOOM, gameState.zoom * 1.25);
        gameState.panX = cx - boardPos.x * gameState.zoom;
        gameState.panY = cy - boardPos.y * gameState.zoom;
        updateZoomDisplay();
    });
    
    document.getElementById('zoom-out-btn').addEventListener('click', () => {
        const container = document.getElementById('gameboard-container');
        const cx = container.clientWidth / 2;
        const cy = container.clientHeight / 2;
        
        const boardPos = screenToBoard(cx, cy);
        gameState.zoom = Math.max(MIN_ZOOM, gameState.zoom / 1.25);
        gameState.panX = cx - boardPos.x * gameState.zoom;
        gameState.panY = cy - boardPos.y * gameState.zoom;
        updateZoomDisplay();
    });
    
    // Scattered button clicked
    document.getElementById('arrange-btn').addEventListener('click', () => {
        scatterPieces();
    });
    
    // Solve Cheat click
    document.getElementById('solve-cheat-btn').addEventListener('click', () => {
        cheatSolve();
    });
    
    // HUD Share Link Copy
    const shareBtn = document.getElementById('share-btn');
    if (shareBtn) {
        shareBtn.addEventListener('click', () => {
            const shareUrl = window.location.origin + window.location.pathname + 
                '?image=' + encodeURIComponent(gameState.imageValue) + 
                '&diff=' + gameState.difficulty + 
                '&rot=' + (gameState.allowRotation ? '1' : '0') + 
                '&guide=' + (gameState.showGuide ? '1' : '0');
            
            navigator.clipboard.writeText(shareUrl).then(() => {
                const span = shareBtn.querySelector('span');
                const originalText = span.innerText;
                span.innerText = 'Copied!';
                shareBtn.style.backgroundColor = 'rgba(16, 185, 129, 0.4)';
                shareBtn.style.borderColor = '#10b981';
                
                setTimeout(() => {
                    span.innerText = originalText;
                    shareBtn.style.backgroundColor = '';
                    shareBtn.style.borderColor = '';
                }, 2000);
            }).catch(err => {
                alert("Failed to copy link: " + err);
            });
        });
    }

    // Auto-parse URL parameters on load
    const loadParams = new URLSearchParams(window.location.search);
    if (loadParams.has('room')) {
        parseURLParameters();
    } else {
        // Solo url check
        parseURLParameters();
    }
});
