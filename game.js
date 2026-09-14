/**
 * ==========================================================================
 * Co-op Jigsaw: Serverless P2P Jigsaw Puzzle Game
 * Built for GitHub Pages using Vanilla JS, HTML5 Canvas, and PeerJS.
 * ==========================================================================
 */

(function () {
    'use strict';

    // --------------------------------------------------------------------------
    // State & Constants
    // --------------------------------------------------------------------------
    const SNAP_THRESHOLD = 32; // Pixels distance to snap to target
    const TAB_RATIO = 0.22;    // Size ratio of interlocking jigsaw tabs
    let targetPieceCount = 24;  // Default piece count (12, 24, 36, 48)

    // Role and PeerJS variables
    let isHost = true;
    let peer = null;
    let myPeerId = null;
    let conn = null; // Active WebRTC data channel
    let remotePeerId = null;

    // Game Board & Canvas
    const canvas = document.getElementById('puzzle-canvas');
    const ctx = canvas.getContext('2d');
    let canvasWidth = 0;
    let canvasHeight = 0;
    let dpr = window.devicePixelRatio || 1;

    // Puzzle & Image State
    let currentImage = null;       // Active HTMLImageElement
    let currentImageSrc = null;    // DataURL or URL of current image
    let gridCols = 0;
    let gridRows = 0;
    let pieceWidth = 0;
    let pieceHeight = 0;
    let boardX = 0;
    let boardY = 0;
    let boardWidth = 0;
    let boardHeight = 0;

    let pieces = [];               // Unified piece array
    let activePiece = null;        // Currently dragged piece by local player
    let dragOffsetX = 0;
    let dragOffsetY = 0;
    let isDragging = false;
    let moveBroadcastPending = false;
    let showHintGuide = false;

    // Photo Library in RAM
    let photoPool = [];            // List of image sources (local files / URLs)

    // Ping & Stats
    let pingInterval = null;
    let lastPingTime = 0;
    let gameStartTime = null;
    let timerInterval = null;

    // P2P Reconnection State
    let targetRemotePeerId = null; // Stored remote partner ID for automatic reconnection
    let reconnectInterval = null;
    let reconnectAttempts = 0;
    let missedPings = 0;

    // UI Elements
    const myPeerIdEl = document.getElementById('my-peer-id');
    const remotePeerInput = document.getElementById('remote-peer-input');
    const btnConnect = document.getElementById('btn-connect');
    const btnCopyId = document.getElementById('btn-copy-id');
    const btnCopyLink = document.getElementById('btn-copy-link');
    const btnHamburger = document.getElementById('btn-hamburger');
    const btnCloseDrawer = document.getElementById('btn-close-drawer');
    const drawerBackdrop = document.getElementById('drawer-backdrop');
    const peerDrawer = document.getElementById('peer-drawer');
    const btnToggleRef = document.getElementById('btn-toggle-ref');
    const btnNextPuzzle = document.getElementById('btn-next-puzzle');
    const connectionPill = document.getElementById('connection-pill');
    const pingText = document.getElementById('ping-text');
    const progressText = document.getElementById('progress-text');
    const myRoleDisplay = document.getElementById('my-role-display');
    const myIdShort = document.getElementById('my-id-short');
    const partnerChip = document.getElementById('partner-chip');
    const partnerIdShort = document.getElementById('partner-id-short');
    const peerCountBadge = document.getElementById('peer-count');
    const statusToast = document.getElementById('status-toast');
    const victoryModal = document.getElementById('victory-modal');
    const btnPlayAgain = document.getElementById('btn-play-again');
    const fileUploader = document.getElementById('file-uploader');
    const photoPoolInfo = document.getElementById('photo-pool-info');
    const diffButtons = document.querySelectorAll('.btn-diff');

    // --------------------------------------------------------------------------
    // Web Audio Synthesizer (Zero External Dependencies)
    // --------------------------------------------------------------------------
    const Sound = {
        ctx: null,
        init() {
            if (!this.ctx) {
                const AudioContext = window.AudioContext || window.webkitAudioContext;
                if (AudioContext) this.ctx = new AudioContext();
            }
            if (this.ctx && this.ctx.state === 'suspended') {
                this.ctx.resume();
            }
        },
        pickup() {
            this.init();
            if (!this.ctx) return;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            const now = this.ctx.currentTime;
            osc.frequency.setValueAtTime(320, now);
            osc.frequency.exponentialRampToValueAtTime(480, now + 0.05);
            gain.gain.setValueAtTime(0.12, now);
            gain.gain.linearRampToValueAtTime(0.01, now + 0.05);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(now);
            osc.stop(now + 0.05);
        },
        snap() {
            this.init();
            if (!this.ctx) return;
            const now = this.ctx.currentTime;
            // Crisp high-frequency pop
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(800, now);
            osc.frequency.exponentialRampToValueAtTime(1400, now + 0.04);
            gain.gain.setValueAtTime(0.22, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(now);
            osc.stop(now + 0.08);
        },
        win() {
            this.init();
            if (!this.ctx) return;
            const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
            notes.forEach((freq, i) => {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                const now = this.ctx.currentTime + i * 0.1;
                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, now);
                gain.gain.setValueAtTime(0.15, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
                osc.connect(gain);
                gain.connect(this.ctx.destination);
                osc.start(now);
                osc.stop(now + 0.4);
            });
        }
    };

    // --------------------------------------------------------------------------
    // Toast Messages
    // --------------------------------------------------------------------------
    let toastTimeout = null;
    function showToast(message, duration = 2800) {
        statusToast.textContent = message;
        statusToast.classList.remove('hidden');
        clearTimeout(toastTimeout);
        toastTimeout = setTimeout(() => {
            statusToast.classList.add('hidden');
        }, duration);
    }


    // --------------------------------------------------------------------------
    // Drawer Management (Unobtrusive Menu)
    // --------------------------------------------------------------------------
    function openDrawer() {
        document.body.classList.add('drawer-open');
    }

    function closeDrawer() {
        document.body.classList.remove('drawer-open');
    }

    function toggleDrawer() {
        document.body.classList.toggle('drawer-open');
    }

    // --------------------------------------------------------------------------
    // Session Initialization & Repetitive Auto-Reconnection
    // --------------------------------------------------------------------------
    function initPeerJS() {
        const urlParams = new URLSearchParams(window.location.search);
        const hostParam = urlParams.get('join') || urlParams.get('host');

        // Check if user is joining as guest via URL
        if (hostParam) {
            isHost = false;
            document.body.classList.add('is-guest');
            myRoleDisplay.textContent = 'Guest';
            targetRemotePeerId = hostParam;
        }

        // Initialize Peer with random human-friendly ID
        peer = new Peer();

        peer.on('open', (id) => {
            myPeerId = id;
            myPeerIdEl.textContent = id;
            myIdShort.textContent = id.slice(0, 8) + '...';

            if (hostParam) {
                // Auto-connect as guest
                remotePeerInput.value = hostParam;
                connectToPeer(hostParam);
            } else {
                // Host starts the initial puzzle
                loadInitialPuzzle();
                // Open drawer initially for host so they see the Peer ID & Invite link
                openDrawer();
            }
        });

        // Incoming connection (Host receives connection from Guest)
        peer.on('connection', (incomingConn) => {
            // Close any stale existing connection and accept the new/reconnecting one
            if (conn) {
                try { conn.close(); } catch (e) {}
            }
            conn = incomingConn;
            targetRemotePeerId = incomingConn.peer;
            setupDataChannel();
        });

        peer.on('error', (err) => {
            console.warn('PeerJS signaling notice:', err.type);
            // Reconnect signaling automatically on network drops
            if (err.type === 'disconnected' || err.type === 'network') {
                if (peer && !peer.destroyed) peer.reconnect();
            }
        });

        peer.on('disconnected', () => {
            console.log('[P2P] PeerJS signaling disconnected. Reconnecting...');
            if (peer && !peer.destroyed) {
                peer.reconnect();
            }
        });
    }

    function connectToPeer(targetId) {
        if (!targetId || targetId === myPeerId) return;
        targetRemotePeerId = targetId;
        setConnectionStatus('connecting');

        isHost = false;
        document.body.classList.add('is-guest');
        myRoleDisplay.textContent = 'Guest';

        if (conn) {
            try { conn.close(); } catch (e) {}
        }
        conn = peer.connect(targetId, { reliable: true });
        setupDataChannel();
    }

    function setupDataChannel() {
        if (!conn) return;

        conn.on('open', () => {
            remotePeerId = conn.peer;
            targetRemotePeerId = conn.peer;
            missedPings = 0;

            // Clear any active repetitive reconnection loop
            if (reconnectInterval) {
                clearInterval(reconnectInterval);
                reconnectInterval = null;
                reconnectAttempts = 0;
            }

            setConnectionStatus('connected');
            showToast('🟢 Connected to partner!');

            // Automatically close drawer when connection succeeds to show full puzzle view!
            closeDrawer();

            // Start heartbeat ping
            startPingInterval();

            if (isHost) {
                // Broadcast current game state (preserving all piece coordinates & solved state!)
                broadcastInitGame();
            }
        });

        conn.on('data', (data) => {
            missedPings = 0;
            handleRemoteData(data);
        });

        conn.on('close', () => {
            handlePartnerDisconnected();
        });

        conn.on('error', (err) => {
            console.warn('Data channel error:', err);
            handlePartnerDisconnected();
        });
    }

    function setConnectionStatus(status, attempt = 0) {
        if (status === 'connected') {
            connectionPill.className = 'badge badge-connected clickable';
            connectionPill.textContent = '● Connected';
            partnerChip.className = 'peer-chip remote connected';
            partnerChip.querySelector('.peer-name').textContent = isHost ? 'Guest' : 'Host';
            partnerIdShort.textContent = remotePeerId ? remotePeerId.slice(0, 8) + '...' : 'active';
            peerCountBadge.textContent = '2 Players';
        } else if (status === 'connecting') {
            connectionPill.className = 'badge badge-connecting clickable';
            connectionPill.textContent = '● Connecting...';
            peerCountBadge.textContent = 'Connecting...';
        } else if (status === 'reconnecting') {
            connectionPill.className = 'badge badge-reconnecting clickable';
            connectionPill.textContent = attempt > 0 ? `● Reconnecting (${attempt})...` : '● Reconnecting...';
            partnerChip.className = 'peer-chip remote disconnected';
            partnerChip.querySelector('.peer-name').textContent = 'Reconnecting...';
            peerCountBadge.textContent = 'Reconnecting';
            pingText.textContent = '-- ms';
        } else if (status === 'waiting-reconnect') {
            connectionPill.className = 'badge badge-connecting clickable';
            connectionPill.textContent = '● Waiting for partner...';
            partnerChip.className = 'peer-chip remote disconnected';
            partnerChip.querySelector('.peer-name').textContent = 'Partner (Disconnected)';
            peerCountBadge.textContent = '1 Player';
            pingText.textContent = '-- ms';
        } else {
            connectionPill.className = 'badge badge-disconnected clickable';
            connectionPill.textContent = '● Disconnected';
            partnerChip.className = 'peer-chip remote disconnected';
            partnerChip.querySelector('.peer-name').textContent = 'Partner (Waiting...)';
            partnerIdShort.textContent = 'none';
            peerCountBadge.textContent = '1 Player';
            pingText.textContent = '-- ms';
        }
    }

    function handlePartnerDisconnected() {
        conn = null;
        remotePeerId = null;
        clearInterval(pingInterval);

        // Release any remote locks locally
        pieces.forEach(p => {
            if (p.isLocked && p.lockedBy !== myPeerId) {
                p.isLocked = false;
                p.lockedBy = null;
            }
        });
        requestRender();

        // Repetitive reconnection logic!
        if (!isHost && targetRemotePeerId) {
            startAutoReconnect();
        } else if (isHost) {
            setConnectionStatus('waiting-reconnect');
            showToast('⚠️ Partner disconnected. Waiting to reconnect...', 4000);
            if (peer && peer.disconnected) {
                peer.reconnect();
            }
        } else {
            setConnectionStatus('disconnected');
            showToast('⚠️ Disconnected');
        }
    }

    function startAutoReconnect() {
        if (reconnectInterval) return;
        reconnectAttempts = 0;
        setConnectionStatus('reconnecting', 0);
        showToast('🔄 Connection dropped. Automatically reconnecting...', 3500);

        reconnectInterval = setInterval(() => {
            if (conn && conn.open) {
                clearInterval(reconnectInterval);
                reconnectInterval = null;
                return;
            }

            reconnectAttempts++;
            setConnectionStatus('reconnecting', reconnectAttempts);

            // Re-establish signaling if needed
            if (peer && peer.disconnected) {
                peer.reconnect();
            }

            if (!conn || !conn.open) {
                console.log(`[P2P] Auto-reconnect attempt #${reconnectAttempts} to ${targetRemotePeerId}...`);
                try {
                    if (conn) conn.close();
                } catch (e) {}

                conn = peer.connect(targetRemotePeerId, { reliable: true });
                setupDataChannel();
            }
        }, 3000);
    }

    function startPingInterval() {
        clearInterval(pingInterval);
        missedPings = 0;
        pingInterval = setInterval(() => {
            if (conn && conn.open) {
                missedPings++;
                if (missedPings >= 3) {
                    // Missed 3 consecutive pings (9s): connection likely dropped
                    console.warn('[P2P] Missed pings. Triggering reconnection check...');
                    handlePartnerDisconnected();
                    return;
                }
                lastPingTime = performance.now();
                sendPayload({ type: 'PING', time: lastPingTime });
            }
        }, 3000);
    }

    function sendPayload(obj) {
        if (conn && conn.open) {
            conn.send(obj);
        }
    }

    // --------------------------------------------------------------------------
    // WebRTC Data Channel Sync & Event Handling
    // Schema:
    // - {"type": "LOCK", "id": pieceId}
    // - {"type": "MOVE", "id": pieceId, "x": val, "y": val}
    // - {"type": "DROP", "id": pieceId, "x": val, "y": val}
    // - {"type": "INIT_GAME", ...}
    // - {"type": "PING"} / {"type": "PONG"}
    // --------------------------------------------------------------------------
    function handleRemoteData(data) {
        if (!data || !data.type) return;

        switch (data.type) {
            case 'LOCK': {
                const piece = pieces.find(p => p.id === data.id);
                if (piece) {
                    piece.isLocked = true;
                    piece.lockedBy = remotePeerId;
                    // Bring to top of rendering stack
                    moveToTop(piece);
                    requestRender();
                }
                break;
            }

            case 'MOVE': {
                const piece = pieces.find(p => p.id === data.id);
                if (piece) {
                    piece.x = data.x;
                    piece.y = data.y;
                    requestRender();
                }
                break;
            }

            case 'DROP': {
                const piece = pieces.find(p => p.id === data.id);
                if (piece) {
                    piece.x = data.x;
                    piece.y = data.y;
                    piece.isLocked = false;
                    piece.lockedBy = null;

                    // Remote trigger local snap-to-grid coordinate check
                    checkPieceSnap(piece);
                    requestRender();
                    updateProgress();
                }
                break;
            }

            case 'INIT_GAME': {
                // Guest receives puzzle from Host
                applyInitGame(data);
                break;
            }

            case 'PING': {
                sendPayload({ type: 'PONG', time: data.time });
                break;
            }

            case 'PONG': {
                const now = performance.now();
                const latency = Math.round(now - data.time);
                pingText.textContent = latency + ' ms';
                break;
            }
        }
    }

    // --------------------------------------------------------------------------
    // Photo Library & File API Processing
    // --------------------------------------------------------------------------
    async function loadInitialPuzzle() {
        // Pre-populate with all 59 optimized photos from jigsawimg
        photoPool = Array.from({ length: 59 }, (_, i) => 
            'images/photo_' + String(i + 1).padStart(3, '0') + '.jpg'
        );
        photoPoolInfo.textContent = `${photoPool.length} Photos`;

        // Optional check for external images.json
        try {
            const res = await fetch('images.json');
            if (res.ok) {
                const list = await res.json();
                if (Array.isArray(list) && list.length > 0) {
                    photoPool = list;
                    photoPoolInfo.textContent = `${photoPool.length} Photos`;
                }
            }
        } catch (e) {
            // Already initialized with pre-populated photo pool
        }

        // Pick one randomly and start puzzle
        pickRandomPhotoAndStart();
    }

    function generateProceduralPhoto() {
        const off = document.createElement('canvas');
        off.width = 1200;
        off.height = 800;
        const gctx = off.getContext('2d');
        const grad = gctx.createLinearGradient(0, 0, 1200, 800);
        grad.addColorStop(0, '#4f46e5');
        grad.addColorStop(0.5, '#ec4899');
        grad.addColorStop(1, '#f59e0b');
        gctx.fillStyle = grad;
        gctx.fillRect(0, 0, 1200, 800);
        return off.toDataURL('image/jpeg', 0.85);
    }

    // File API: Read multiple uploaded images into RAM
    fileUploader.addEventListener('change', (e) => {
        const files = Array.from(e.target.files);
        if (!files || files.length === 0) return;

        let loadedCount = 0;
        files.forEach(file => {
            if (!file.type.startsWith('image/')) return;
            const reader = new FileReader();
            reader.onload = (event) => {
                photoPool.push(event.target.result);
                loadedCount++;
                if (loadedCount === files.length) {
                    photoPoolInfo.textContent = `${photoPool.length} Photos`;
                    showToast(`📁 Added ${loadedCount} photos into RAM!`);
                    if (isHost) pickRandomPhotoAndStart();
                }
            };
            reader.readAsDataURL(file);
        });
    });

    function pickRandomPhotoAndStart() {
        if (photoPool.length === 0) return;
        const randomIndex = Math.floor(Math.random() * photoPool.length);
        const selectedSrc = photoPool[randomIndex];
        loadAndBuildPuzzle(selectedSrc);
    }

    function loadAndBuildPuzzle(imgSrc) {
        const img = new Image();
        img.onload = () => {
            currentImage = img;
            currentImageSrc = imgSrc;
            generatePuzzleBoard();
            if (isHost && conn && conn.open) {
                broadcastInitGame();
            }
        };
        img.src = imgSrc;
    }

    // --------------------------------------------------------------------------
    // Canvas Image Processing & Grid Slicing
    // --------------------------------------------------------------------------
    function generatePuzzleBoard() {
        if (!currentImage) return;

        // Calculate optimal grid dimensions based on aspect ratio
        const imgWidth = currentImage.naturalWidth || currentImage.width;
        const imgHeight = currentImage.naturalHeight || currentImage.height;
        const aspect = imgWidth / imgHeight;

        // Calculate cols and rows matching targetPieceCount
        gridRows = Math.max(2, Math.round(Math.sqrt(targetPieceCount / aspect)));
        gridCols = Math.max(2, Math.round(targetPieceCount / gridRows));
        const totalPieces = gridCols * gridRows;

        // Target Board Dimensions inside workspace
        resizeCanvas();
        const padding = 50;
        const availableW = Math.max(300, canvasWidth - padding * 2);
        const availableH = Math.max(300, canvasHeight - padding * 2);

        // Keep 40% margin around board for scattering pieces
        const maxBoardW = availableW * 0.72;
        const maxBoardH = availableH * 0.72;

        if (maxBoardW / maxBoardH > aspect) {
            boardHeight = Math.floor(maxBoardH);
            boardWidth = Math.floor(boardHeight * aspect);
        } else {
            boardWidth = Math.floor(maxBoardW);
            boardHeight = Math.floor(boardWidth / aspect);
        }

        boardX = Math.floor((canvasWidth - boardWidth) / 2);
        boardY = Math.floor((canvasHeight - boardHeight) / 2);

        pieceWidth = boardWidth / gridCols;
        pieceHeight = boardHeight / gridRows;

        // Generate interlocking jigsaw edge tabs:
        // Horizontal edges: [rows - 1][cols]
        // Vertical edges: [rows][cols - 1]
        // +1 = tab pointing right/down, -1 = blank pointing left/up, 0 = flat boundary
        const hEdges = [];
        for (let r = 0; r < gridRows - 1; r++) {
            hEdges[r] = [];
            for (let c = 0; c < gridCols; c++) {
                hEdges[r][c] = Math.random() < 0.5 ? 1 : -1;
            }
        }

        const vEdges = [];
        for (let r = 0; r < gridRows; r++) {
            vEdges[r] = [];
            for (let c = 0; c < gridCols - 1; c++) {
                vEdges[r][c] = Math.random() < 0.5 ? 1 : -1;
            }
        }

        // Generate Piece Objects
        pieces = [];
        for (let r = 0; r < gridRows; r++) {
            for (let c = 0; c < gridCols; c++) {
                const id = r * gridCols + c;
                const targetX = boardX + c * pieceWidth;
                const targetY = boardY + r * pieceHeight;

                const edges = {
                    top: r === 0 ? 0 : -hEdges[r - 1][c],
                    right: c === gridCols - 1 ? 0 : vEdges[r][c],
                    bottom: r === gridRows - 1 ? 0 : hEdges[r][c],
                    left: c === 0 ? 0 : -vEdges[r][c - 1]
                };

                // Scatter pieces initially into surrounding trays (avoiding center board)
                const scatter = getScatteredPosition(pieceWidth, pieceHeight);

                pieces.push({
                    id,
                    gridX: c,
                    gridY: r,
                    x: scatter.x,
                    y: scatter.y,
                    targetX,
                    targetY,
                    edges,
                    isLocked: false,
                    lockedBy: null,
                    isSolved: false,
                    offscreenCanvas: null // Rendered below
                });
            }
        }

        // Shuffle z-order
        shuffleArray(pieces);

        // Slice each piece onto its off-screen canvas with drawImage()
        renderPieceCanvases();

        // Reset victory modal and stats
        victoryModal.classList.add('hidden');
        gameStartTime = Date.now();
        updateProgress();
        requestRender();
    }

    function getScatteredPosition(pw, ph) {
        // Distribute pieces along top, bottom, left, and right trays
        const zone = Math.floor(Math.random() * 4);
        let x, y;
        const margin = 20;

        switch (zone) {
            case 0: // Left tray
                x = margin + Math.random() * Math.max(20, boardX - pw - margin * 2);
                y = margin + Math.random() * (canvasHeight - ph - margin * 2);
                break;
            case 1: // Right tray
                x = boardX + boardWidth + margin + Math.random() * Math.max(20, canvasWidth - (boardX + boardWidth) - pw - margin * 2);
                y = margin + Math.random() * (canvasHeight - ph - margin * 2);
                break;
            case 2: // Top tray
                x = margin + Math.random() * (canvasWidth - pw - margin * 2);
                y = margin + Math.random() * Math.max(20, boardY - ph - margin * 2);
                break;
            case 3: // Bottom tray
            default:
                x = margin + Math.random() * (canvasWidth - pw - margin * 2);
                y = boardY + boardHeight + margin + Math.random() * Math.max(20, canvasHeight - (boardY + boardHeight) - ph - margin * 2);
                break;
        }

        return {
            x: Math.min(Math.max(margin, x), canvasWidth - pw - margin),
            y: Math.min(Math.max(margin, y), canvasHeight - ph - margin)
        };
    }

    function shuffleArray(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
    }

    // --------------------------------------------------------------------------
    // Off-Screen Canvas Slicing with Jigsaw Tabs
    // --------------------------------------------------------------------------
    function renderPieceCanvases() {
        const tabSizeX = pieceWidth * TAB_RATIO;
        const tabSizeY = pieceHeight * TAB_RATIO;

        pieces.forEach(p => {
            const offW = pieceWidth + tabSizeX * 2;
            const offH = pieceHeight + tabSizeY * 2;

            const offCanvas = document.createElement('canvas');
            offCanvas.width = offW * dpr;
            offCanvas.height = offH * dpr;
            const offCtx = offCanvas.getContext('2d');
            offCtx.scale(dpr, dpr);

            // Origin of the piece body inside the offscreen canvas
            const ox = tabSizeX;
            const oy = tabSizeY;

            // Define clipping path
            offCtx.save();
            createPiecePath(offCtx, ox, oy, pieceWidth, pieceHeight, p.edges, tabSizeX, tabSizeY);
            offCtx.clip();

            // Draw image slice using drawImage()
            // Map the piece coordinates to the source image's natural dimensions
            const sx = (p.gridX / gridCols) * currentImage.naturalWidth;
            const sy = (p.gridY / gridRows) * currentImage.naturalHeight;
            const sw = currentImage.naturalWidth / gridCols;
            const sh = currentImage.naturalHeight / gridRows;

            // Extra image area to cover tabs
            const tabFractionX = TAB_RATIO / gridCols * currentImage.naturalWidth;
            const tabFractionY = TAB_RATIO / gridRows * currentImage.naturalHeight;

            offCtx.drawImage(
                currentImage,
                sx - tabFractionX, sy - tabFractionY,
                sw + tabFractionX * 2, sh + tabFractionY * 2,
                0, 0, offW, offH
            );

            // Subtle 3D Bevel / Border overlay
            offCtx.restore();
            offCtx.save();
            createPiecePath(offCtx, ox, oy, pieceWidth, pieceHeight, p.edges, tabSizeX, tabSizeY);
            offCtx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
            offCtx.lineWidth = 1.5;
            offCtx.stroke();

            offCtx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
            offCtx.lineWidth = 1;
            offCtx.stroke();
            offCtx.restore();

            p.offscreenCanvas = offCanvas;
            p.tabOffsetX = tabSizeX;
            p.tabOffsetY = tabSizeY;
        });
    }

    /**
     * Draw classic interlocking jigsaw piece boundary with cubic Bezier curves
     */
    function createPiecePath(c, ox, oy, w, h, edges, tx, ty) {
        c.beginPath();
        c.moveTo(ox, oy);

        // TOP EDGE
        if (edges.top === 0) {
            c.lineTo(ox + w, oy);
        } else {
            drawTabEdge(c, ox, oy, ox + w, oy, edges.top, ty, false);
        }

        // RIGHT EDGE
        if (edges.right === 0) {
            c.lineTo(ox + w, oy + h);
        } else {
            drawTabEdge(c, ox + w, oy, ox + w, oy + h, edges.right, tx, true);
        }

        // BOTTOM EDGE
        if (edges.bottom === 0) {
            c.lineTo(ox, oy + h);
        } else {
            drawTabEdge(c, ox + w, oy + h, ox, oy + h, edges.bottom, ty, false);
        }

        // LEFT EDGE
        if (edges.left === 0) {
            c.closePath();
        } else {
            drawTabEdge(c, ox, oy + h, ox, oy, edges.left, tx, true);
            c.closePath();
        }
    }

    function drawTabEdge(c, x1, y1, x2, y2, dir, tabSize, isVertical) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const len = Math.hypot(dx, dy);
        const angle = Math.atan2(dy, dx);

        c.save();
        c.translate(x1, y1);
        c.rotate(angle);

        // Normalized along local X axis [0, len]
        const neckWidth = len * 0.18;
        const headWidth = len * 0.32;
        const tabHeight = tabSize * (dir > 0 ? -1 : 1);

        const mid = len / 2;
        const p1 = mid - headWidth / 2;
        const p2 = mid - neckWidth / 2;
        const p3 = mid + neckWidth / 2;
        const p4 = mid + headWidth / 2;

        c.lineTo(p1, 0);
        c.bezierCurveTo(p1, tabHeight * 0.2, p2, tabHeight * 0.8, p2, tabHeight);
        c.bezierCurveTo(p2, tabHeight * 1.3, p3, tabHeight * 1.3, p3, tabHeight);
        c.bezierCurveTo(p3, tabHeight * 0.8, p4, tabHeight * 0.2, p4, 0);
        c.lineTo(len, 0);

        c.restore();
    }

    // --------------------------------------------------------------------------
    // Host -> Guest Broadcast
    // --------------------------------------------------------------------------
    function broadcastInitGame() {
        if (!currentImage || !conn || !conn.open) return;

        // Compress image data to WebRTC transfer size
        const compCanvas = document.createElement('canvas');
        const maxDim = 1200;
        let w = currentImage.naturalWidth;
        let h = currentImage.naturalHeight;
        if (w > maxDim || h > maxDim) {
            if (w > h) { h = Math.round(h * (maxDim / w)); w = maxDim; }
            else { w = Math.round(w * (maxDim / h)); h = maxDim; }
        }
        compCanvas.width = w;
        compCanvas.height = h;
        const cctx = compCanvas.getContext('2d');
        cctx.drawImage(currentImage, 0, 0, w, h);
        const compDataUrl = compCanvas.toDataURL('image/jpeg', 0.82);

        const initPayload = {
            type: 'INIT_GAME',
            imageSrc: compDataUrl,
            grid: {
                cols: gridCols,
                rows: gridRows,
                pieceWidth,
                pieceHeight,
                boardX,
                boardY,
                boardWidth,
                boardHeight
            },
            pieces: pieces.map(p => ({
                id: p.id,
                gridX: p.gridX,
                gridY: p.gridY,
                x: p.x,
                y: p.y,
                targetX: p.targetX,
                targetY: p.targetY,
                edges: p.edges,
                isLocked: p.isLocked,
                lockedBy: p.lockedBy,
                isSolved: p.isSolved
            }))
        };

        sendPayload(initPayload);
    }

    function applyInitGame(data) {
        const img = new Image();
        img.onload = () => {
            currentImage = img;
            gridCols = data.grid.cols;
            gridRows = data.grid.rows;
            boardWidth = data.grid.boardWidth;
            boardHeight = data.grid.boardHeight;
            boardX = data.grid.boardX;
            boardY = data.grid.boardY;
            pieceWidth = data.grid.pieceWidth;
            pieceHeight = data.grid.pieceHeight;

            pieces = data.pieces.map(p => ({
                ...p,
                offscreenCanvas: null
            }));

            renderPieceCanvases();
            victoryModal.classList.add('hidden');
            updateProgress();
            requestRender();
            showToast('🧩 New puzzle loaded from Host!');
        };
        img.src = data.imageSrc;
    }

    // --------------------------------------------------------------------------
    // Pointer Events & Mutex Locking
    // --------------------------------------------------------------------------
    canvas.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);

    function getCanvasCoords(e) {
        const rect = canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    }

    function onPointerDown(e) {
        if (!currentImage) return;
        const { x, y } = getCanvasCoords(e);

        // Find top-most piece at cursor (search in reverse order)
        for (let i = pieces.length - 1; i >= 0; i--) {
            const p = pieces[i];
            // Check bounding box
            if (x >= p.x && x <= p.x + pieceWidth && y >= p.y && y <= p.y + pieceHeight) {
                // Mutex lock check: cannot pick up locked or solved piece
                if (p.isSolved || p.isLocked) {
                    if (p.isLocked && p.lockedBy !== myPeerId) {
                        showToast('🔒 Piece is locked by partner');
                    }
                    return;
                }

                // Acquire local lock
                activePiece = p;
                p.isLocked = true;
                p.lockedBy = myPeerId;
                isDragging = true;
                dragOffsetX = x - p.x;
                dragOffsetY = y - p.y;

                // Move to top of z-order
                moveToTop(p);

                // Broadcast LOCK
                sendPayload({ type: 'LOCK', id: p.id });

                Sound.pickup();
                requestRender();
                break;
            }
        }
    }

    function onPointerMove(e) {
        if (!isDragging || !activePiece) return;
        const { x, y } = getCanvasCoords(e);

        activePiece.x = x - dragOffsetX;
        activePiece.y = y - dragOffsetY;

        requestRender();

        // Broadcast MOVE throttled to ~30fps via requestAnimationFrame
        if (!moveBroadcastPending) {
            moveBroadcastPending = true;
            requestAnimationFrame(() => {
                if (activePiece && isDragging) {
                    sendPayload({
                        type: 'MOVE',
                        id: activePiece.id,
                        x: Math.round(activePiece.x),
                        y: Math.round(activePiece.y)
                    });
                }
                moveBroadcastPending = false;
            });
        }
    }

    function onPointerUp(e) {
        if (!isDragging || !activePiece) return;

        const p = activePiece;
        isDragging = false;
        activePiece = null;

        // Local snap-to-grid coordinate check
        checkPieceSnap(p);

        // Unlock piece
        p.isLocked = false;
        p.lockedBy = null;

        // Broadcast DROP
        sendPayload({
            type: 'DROP',
            id: p.id,
            x: Math.round(p.x),
            y: Math.round(p.y)
        });

        requestRender();
        updateProgress();
    }

    function checkPieceSnap(p) {
        const dist = Math.hypot(p.x - p.targetX, p.y - p.targetY);
        if (dist <= SNAP_THRESHOLD) {
            p.x = p.targetX;
            p.y = p.targetY;
            if (!p.isSolved) {
                p.isSolved = true;
                Sound.snap();
                showToast('✨ Piece Snapped!', 1200);
            }
        }
    }

    function moveToTop(p) {
        const idx = pieces.indexOf(p);
        if (idx > -1 && idx !== pieces.length - 1) {
            pieces.splice(idx, 1);
            pieces.push(p);
        }
    }

    function updateProgress() {
        const total = pieces.length;
        const solved = pieces.filter(p => p.isSolved).length;
        progressText.textContent = `${solved} / ${total}`;

        if (total > 0 && solved === total) {
            triggerVictory();
        }
    }

    function triggerVictory() {
        Sound.win();
        const durationSec = Math.max(1, Math.round((Date.now() - gameStartTime) / 1000));
        const mins = String(Math.floor(durationSec / 60)).padStart(2, '0');
        const secs = String(durationSec % 60).padStart(2, '0');

        document.getElementById('vic-pieces').textContent = pieces.length;
        document.getElementById('vic-time').textContent = `${mins}:${secs}`;
        victoryModal.classList.remove('hidden');
    }

    // --------------------------------------------------------------------------
    // Render Loop
    // --------------------------------------------------------------------------
    let renderRequested = false;

    function requestRender() {
        if (!renderRequested) {
            renderRequested = true;
            requestAnimationFrame(render);
        }
    }

    function render() {
        renderRequested = false;

        // Clear canvas
        ctx.clearRect(0, 0, canvasWidth, canvasHeight);

        // 1. Draw Target Puzzle Board Outline
        if (currentImage && boardWidth > 0) {
            ctx.save();
            ctx.fillStyle = 'rgba(15, 23, 42, 0.45)';
            ctx.strokeStyle = 'rgba(99, 102, 241, 0.35)';
            ctx.lineWidth = 2;
            ctx.setLineDash([8, 8]);
            ctx.strokeRect(boardX, boardY, boardWidth, boardHeight);
            ctx.fillRect(boardX, boardY, boardWidth, boardHeight);
            ctx.restore();

            // Grid guide lines
            ctx.save();
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
            ctx.lineWidth = 1;
            for (let c = 1; c < gridCols; c++) {
                ctx.beginPath();
                ctx.moveTo(boardX + c * pieceWidth, boardY);
                ctx.lineTo(boardX + c * pieceWidth, boardY + boardHeight);
                ctx.stroke();
            }
            for (let r = 1; r < gridRows; r++) {
                ctx.beginPath();
                ctx.moveTo(boardX, boardY + r * pieceHeight);
                ctx.lineTo(boardX + boardWidth, boardY + r * pieceHeight);
                ctx.stroke();
            }
            ctx.restore();

            // Optional Ghost / Reference Image Hint
            if (showHintGuide) {
                ctx.save();
                ctx.globalAlpha = 0.22;
                ctx.drawImage(currentImage, boardX, boardY, boardWidth, boardHeight);
                ctx.restore();
            }
        }

        // 2. Draw Solved Pieces First (Base Layer)
        pieces.forEach(p => {
            if (p.isSolved && p.offscreenCanvas) {
                drawPieceOnCanvas(p);
            }
        });

        // 3. Draw Unsolved & Free Pieces
        pieces.forEach(p => {
            if (!p.isSolved && !p.isLocked && p.offscreenCanvas) {
                drawPieceOnCanvas(p);
            }
        });

        // 4. Draw Locked Pieces (Held by Local or Remote Player)
        pieces.forEach(p => {
            if (!p.isSolved && p.isLocked && p.offscreenCanvas) {
                drawPieceOnCanvas(p);
            }
        });
    }

    function drawPieceOnCanvas(p) {
        const drawX = p.x - (p.tabOffsetX || 0);
        const drawY = p.y - (p.tabOffsetY || 0);
        const offW = p.offscreenCanvas.width / dpr;
        const offH = p.offscreenCanvas.height / dpr;

        // Shadow under lifted pieces
        if (p.isLocked) {
            ctx.save();
            ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
            ctx.shadowBlur = 18;
            ctx.shadowOffsetX = 6;
            ctx.shadowOffsetY = 10;
            ctx.drawImage(p.offscreenCanvas, drawX, drawY, offW, offH);
            ctx.restore();
        } else {
            ctx.drawImage(p.offscreenCanvas, drawX, drawY, offW, offH);
        }

        // Visual Indicator for remote locked piece
        if (p.isLocked && p.lockedBy !== myPeerId) {
            ctx.save();
            ctx.strokeStyle = '#ec4899';
            ctx.lineWidth = 3;
            ctx.strokeRect(p.x, p.y, pieceWidth, pieceHeight);
            ctx.fillStyle = '#ec4899';
            ctx.font = 'bold 11px sans-serif';
            ctx.fillText('Partner Moving', p.x + 4, p.y - 6);
            ctx.restore();
        }
    }

    // --------------------------------------------------------------------------
    // Resize & Window Management
    // --------------------------------------------------------------------------
    function resizeCanvas() {
        const container = document.getElementById('canvas-container');
        canvasWidth = container.clientWidth;
        canvasHeight = container.clientHeight;
        dpr = window.devicePixelRatio || 1;

        canvas.width = canvasWidth * dpr;
        canvas.height = canvasHeight * dpr;
        ctx.scale(dpr, dpr);

        requestRender();
    }

    window.addEventListener('resize', () => {
        resizeCanvas();
    });

    // --------------------------------------------------------------------------
    // UI Event Listeners
    // --------------------------------------------------------------------------
    btnConnect.addEventListener('click', () => {
        const targetId = remotePeerInput.value.trim();
        if (targetId) connectToPeer(targetId);
    });

    remotePeerInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const targetId = remotePeerInput.value.trim();
            if (targetId) connectToPeer(targetId);
        }
    });

    btnCopyId.addEventListener('click', () => {
        if (!myPeerId) return;
        navigator.clipboard.writeText(myPeerId);
        showToast('📋 Peer ID copied to clipboard!');
    });

    btnCopyLink.addEventListener('click', () => {
        if (!myPeerId) return;
        const link = `${window.location.origin}${window.location.pathname}?join=${encodeURIComponent(myPeerId)}`;
        navigator.clipboard.writeText(link);
        showToast('🔗 1-Click Invite Link copied!');
    });

    btnHamburger.addEventListener('click', toggleDrawer);
    btnCloseDrawer.addEventListener('click', closeDrawer);
    drawerBackdrop.addEventListener('click', closeDrawer);
    connectionPill.addEventListener('click', toggleDrawer);

    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeDrawer();
        }
    });

    btnToggleRef.addEventListener('click', () => {
        showHintGuide = !showHintGuide;
        btnToggleRef.classList.toggle('btn-primary', showHintGuide);
        btnToggleRef.classList.toggle('btn-secondary', !showHintGuide);
        requestRender();
    });

    btnNextPuzzle.addEventListener('click', () => {
        if (isHost) {
            pickRandomPhotoAndStart();
            showToast('🎲 Loading next random photo...');
        }
    });

    btnPlayAgain.addEventListener('click', () => {
        if (isHost) {
            pickRandomPhotoAndStart();
        }
    });

    diffButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            diffButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            targetPieceCount = parseInt(btn.getAttribute('data-count'), 10) || 24;
            if (isHost && currentImage) {
                generatePuzzleBoard();
                if (conn && conn.open) broadcastInitGame();
                showToast(`🧩 Difficulty set to ${targetPieceCount} pieces`);
            }
        });
    });

    // --------------------------------------------------------------------------
    // Bootstrap
    // --------------------------------------------------------------------------
    resizeCanvas();
    initPeerJS();

})();
