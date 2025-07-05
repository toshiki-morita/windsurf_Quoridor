const BOARD_SIZE = 9;
const boardArea = document.getElementById('board-area');
const player1Info = document.getElementById('p1-walls');
const player2Info = document.getElementById('p2-walls');
const currentTurnDisplay = document.getElementById('current-turn');
const messageArea = document.getElementById('message-area');

const menuScreen = document.getElementById('menu-screen');
const gameScreen = document.getElementById('game-screen');
const victoryScreen = document.getElementById('victory-screen');
const winnerMessage = document.getElementById('winner-message');

const startPvpButton = document.getElementById('start-pvp');
const startPvcButton = document.getElementById('start-pvc');
const gameControls = document.querySelector('.game-controls');
const resetGameButton = document.getElementById('reset-game');
const backToSelectBtn = document.getElementById('back-to-select-btn'); 
const playAgainButton = document.getElementById('play-again');
const showRulesBtn = document.getElementById('show-rules-btn');
const backToMenuBtn = document.getElementById('back-to-menu-btn');
const rulesScreen = document.getElementById('rules-screen'); 

let cells = [];
let pawns = [];
let horizontalWalls = []; // [row_groove][col_start]  (BOARD_SIZE-1) x (BOARD_SIZE-1)
let verticalWalls = [];   // [row_start][col_groove]    (BOARD_SIZE-1) x (BOARD_SIZE-1)

let currentPlayer;
let playerWallsRemaining = [10, 10]; // P1, P2
let selectedPawnElement = null;
let selectedPawnIndex = -1;
let gameMode = 'pvp'; // 'pvp' or 'pvc'
let gameOver = false;

// Sound effects
let placeWallSound, movePawnSound, errorSound, victorySound;

function initializeSounds() {
    if (typeof Tone !== 'undefined') {
        placeWallSound = new Tone.Synth({
            oscillator: { type: "square" },
            envelope: { attack: 0.005, decay: 0.05, sustain: 0.01, release: 0.1 }
        }).toDestination();
        movePawnSound = new Tone.Synth({
            oscillator: { type: "sine" },
            envelope: { attack: 0.005, decay: 0.03, sustain: 0.01, release: 0.1 }
        }).toDestination();
        errorSound = new Tone.Synth({
            oscillator: { type: "sawtooth" },
            envelope: { attack: 0.01, decay: 0.2, sustain: 0, release: 0.1 }
        }).toDestination();
        victorySound = new Tone.Synth({
            oscillator: { type: "triangle" },
            envelope: { attack: 0.01, decay: 0.5, sustain: 0.2, release: 0.5 }
        }).toDestination();
    } else {
        console.warn("Tone.js is not loaded. Sound effects will be disabled.");
        const dummySound = { triggerAttackRelease: () => {} };
        placeWallSound = movePawnSound = errorSound = victorySound = dummySound;
    }
}


function initBoard() {
    boardArea.innerHTML = '';
    cells = [];
    for (let r = 0; r < BOARD_SIZE; r++) {
        cells[r] = [];
        for (let c = 0; c < BOARD_SIZE; c++) {
            const cell = document.createElement('div');
            cell.classList.add('cell');
            cell.dataset.r = r;
            cell.dataset.c = c;
            cell.addEventListener('click', () => handleCellClick(r, c));
            boardArea.appendChild(cell);
            cells[r][c] = cell;
        }
    }
    initWallSlots();
}

function initWallSlots() {
    const cellSize = boardArea.clientWidth / BOARD_SIZE; 

    // Horizontal wall slots
    for (let r = 0; r < BOARD_SIZE - 1; r++) { 
        for (let c = 0; c < BOARD_SIZE - 1; c++) { 
            const slot = document.createElement('div');
            slot.classList.add('wall-slot', 'horizontal');
            slot.style.top = `${(r + 1) * cellSize - 4}px`; 
            slot.style.left = `${c * cellSize + 2}px`; 
            slot.dataset.r = r; // groove row index
            slot.dataset.c = c; // starting col index
            slot.dataset.type = 'h';
            slot.addEventListener('click', () => handleWallSlotClick(r, c, 'h'));
            boardArea.appendChild(slot);
        }
    }

    // Vertical wall slots
    for (let r = 0; r < BOARD_SIZE - 1; r++) { 
        for (let c = 0; c < BOARD_SIZE - 1; c++) { 
            const slot = document.createElement('div');
            slot.classList.add('wall-slot', 'vertical');
            slot.style.top = `${r * cellSize + 2}px`;
            slot.style.left = `${(c + 1) * cellSize - 4}px`;
            slot.dataset.r = r; // starting row index
            slot.dataset.c = c; // groove col index
            slot.dataset.type = 'v';
            slot.addEventListener('click', () => handleWallSlotClick(r, c, 'v'));
            boardArea.appendChild(slot);
        }
    }
}

function resetGameState() {
    pawns = [
        { r: 0, c: Math.floor(BOARD_SIZE / 2), id: 'pawn1', player: 0, goalRow: BOARD_SIZE - 1 },
        { r: BOARD_SIZE - 1, c: Math.floor(BOARD_SIZE / 2), id: 'pawn2', player: 1, goalRow: 0 }
    ];
    horizontalWalls = Array(BOARD_SIZE - 1).fill(null).map(() => Array(BOARD_SIZE - 1).fill(false));
    verticalWalls = Array(BOARD_SIZE - 1).fill(null).map(() => Array(BOARD_SIZE - 1).fill(false));
    
    playerWallsRemaining = [10, 10];
    currentPlayer = 0;
    selectedPawnElement = null;
    selectedPawnIndex = -1;
    gameOver = false;
    messageArea.textContent = '';
    gameControls.style.display = 'flex'; 
}

function renderBoard() {
    document.querySelectorAll('.pawn, .wall').forEach(el => el.remove());
    
    pawns.forEach((pawn, index) => {
        const pawnEl = document.createElement('div');
        pawnEl.classList.add('pawn');
        pawnEl.id = pawn.id;
        
        const cellElement = cells[pawn.r][pawn.c];
        if (cellElement) {
             cellElement.appendChild(pawnEl);
             if (index === selectedPawnIndex) {
                cellElement.classList.add('selected-pawn');
             }
        } else {
            console.error("Cell element not found for pawn:", pawn);
        }
         pawnEl.addEventListener('click', (e) => {
            e.stopPropagation(); 
            handlePawnClick(index);
        });
    });

    const cellSize = boardArea.clientWidth / BOARD_SIZE;
    for (let r_wall_idx = 0; r_wall_idx < BOARD_SIZE - 1; r_wall_idx++) {
        for (let c_wall_idx = 0; c_wall_idx < BOARD_SIZE - 1; c_wall_idx++) {
            if (horizontalWalls[r_wall_idx][c_wall_idx]) { 
                const wallEl = document.createElement('div');
                wallEl.classList.add('wall', 'horizontal');
                wallEl.style.top = `${(r_wall_idx + 1) * cellSize - 4}px`;
                wallEl.style.left = `${c_wall_idx * cellSize + 2}px`;
                boardArea.appendChild(wallEl);
            }
            if (verticalWalls[r_wall_idx][c_wall_idx]) { 
                const wallEl = document.createElement('div');
                wallEl.classList.add('wall', 'vertical');
                wallEl.style.top = `${r_wall_idx * cellSize + 2}px`;
                wallEl.style.left = `${(c_wall_idx + 1) * cellSize - 4}px`;
                boardArea.appendChild(wallEl);
            }
        }
    }
    updatePlayerInfo();
}

function updatePlayerInfo() {
    player1Info.textContent = playerWallsRemaining[0];
    player2Info.textContent = playerWallsRemaining[1];
    currentTurnDisplay.textContent = `現在のターン: プレイヤー ${currentPlayer + 1}`;
    if (gameOver) {
         currentTurnDisplay.textContent = `ゲーム終了！ ${winnerMessage.textContent}`;
    }
}

function handlePawnClick(pawnIndex) {
    if (gameOver || pawnIndex !== currentPlayer) return;

    // In PVC mode, player 1 is AI and cannot be controlled by click.
    if (gameMode === 'pvc' && pawnIndex === 1) return;

    if (selectedPawnIndex === pawnIndex) {
        // Deselect
        selectedPawnIndex = -1;
        clearHighlights();
    } else {
        // Select
        selectedPawnIndex = pawnIndex;
        clearHighlights();
        renderBoard(); // To apply 'selected-pawn' class
        highlightValidMoves(pawnIndex);
    }
}

function handleCellClick(r, c) {
    if (gameOver || selectedPawnIndex === -1) return;

    const pawn = pawns[selectedPawnIndex];
    const validMoves = getValidMoves(pawn.r, pawn.c);
    const isMoveValid = validMoves.some(move => move.r === r && move.c === c);

    if (isMoveValid) {
        movePawn(selectedPawnIndex, r, c);
    } else {
        showMessage("無効な移動です。");
        if (errorSound) errorSound.triggerAttackRelease("C2", "0.2s");
    }
}

function movePawn(pawnIndex, newR, newC) {
    pawns[pawnIndex].r = newR;
    pawns[pawnIndex].c = newC;
    selectedPawnIndex = -1;
    clearHighlights();
    if (movePawnSound) movePawnSound.triggerAttackRelease("C4", "0.1s");

    if (checkForWin(pawnIndex)) {
        endGame(pawnIndex);
    } else {
        switchTurn();
    }
    renderBoard();
}

function checkForWin(pawnIndex) {
    const pawn = pawns[pawnIndex];
    return pawn.r === pawn.goalRow;
}

function switchTurn() {
    currentPlayer = (currentPlayer + 1) % pawns.length;
    updatePlayerInfo();
    if (gameMode === 'pvc' && currentPlayer === 1) {
        setTimeout(makeAIMove, 500); // AI moves after a short delay
    }
}

function clearHighlights() {
    document.querySelectorAll('.cell.valid-move').forEach(cell => cell.classList.remove('valid-move'));
    document.querySelectorAll('.cell.selected-pawn').forEach(cell => cell.classList.remove('selected-pawn'));
}

function highlightValidMoves(pawnIndex) {
    const pawn = pawns[pawnIndex];
    const validMoves = getValidMoves(pawn.r, pawn.c);
    validMoves.forEach(move => {
        cells[move.r][move.c].classList.add('valid-move');
    });
}

function getValidMoves(r, c) {
    const moves = [];
    const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]]; // N, S, W, E

    for (const [dr, dc] of directions) {
        const newR = r + dr;
        const newC = c + dc;

        if (newR >= 0 && newR < BOARD_SIZE && newC >= 0 && newC < BOARD_SIZE) {
            if (!isMoveBlockedByWall(r, c, newR, newC)) {
                // Check if another pawn is in the way
                const otherPawn = pawns.find(p => p.r === newR && p.c === newC);
                if (otherPawn) {
                    // Jump over pawn
                    const jumpR = newR + dr;
                    const jumpC = newC + dc;
                    if (jumpR >= 0 && jumpR < BOARD_SIZE && jumpC >= 0 && jumpC < BOARD_SIZE && !isMoveBlockedByWall(newR, newC, jumpR, jumpC)) {
                        moves.push({ r: jumpR, c: jumpC });
                    } else {
                        // Diagonal jumps if straight jump is blocked
                        // Check wall behind opponent
                        const wallBehind = isMoveBlockedByWall(newR, newC, newR + dr, newC + dc);
                        if(wallBehind){
                            // Check left/right relative to move direction
                            if(dr === 0){ // Horizontal move
                                if(!isMoveBlockedByWall(newR, newC, newR - 1, newC)) moves.push({r: newR - 1, c: newC});
                                if(!isMoveBlockedByWall(newR, newC, newR + 1, newC)) moves.push({r: newR + 1, c: newC});
                            } else { // Vertical move
                                if(!isMoveBlockedByWall(newR, newC, newR, newC - 1)) moves.push({r: newR, c: newC - 1});
                                if(!isMoveBlockedByWall(newR, newC, newR, newC + 1)) moves.push({r: newR, c: newC + 1});
                            }
                        }
                    }
                } else {
                    moves.push({ r: newR, c: newC });
                }
            }
        }
    }
    return moves;
}

function isMoveBlockedByWallWithState(r1, c1, r2, c2, hWalls, vWalls) {
    if (r1 === r2) { // Horizontal move
        const c = Math.min(c1, c2);
        if (r1 < BOARD_SIZE - 1 && vWalls[r1] && vWalls[r1][c]) return true;
        if (r1 > 0 && vWalls[r1 - 1] && vWalls[r1 - 1][c]) return true;
    } else { // Vertical move
        const r = Math.min(r1, r2);
        if (c1 < BOARD_SIZE - 1 && hWalls[r] && hWalls[r][c1]) return true;
        if (c1 > 0 && hWalls[r] && hWalls[r][c1 - 1]) return true;
    }
    return false;
}

function isMoveBlockedByWall(r1, c1, r2, c2) {
    return isMoveBlockedByWallWithState(r1, c1, r2, c2, horizontalWalls, verticalWalls);
}

function handleWallSlotClick(r_slot, c_slot, type) {
    // Block human wall placement during AI's turn
    if (gameMode === 'pvc' && currentPlayer === 1) {
        showMessage("CPUの思考中です...");
        return;
    }
    if (gameOver || selectedPawnIndex !== -1) { 
        if(selectedPawnIndex !== -1) showMessage("コマを移動するか、選択を解除してください。");
        return;
    }
    if (playerWallsRemaining[currentPlayer] <= 0) {
        showMessage("壁が残っていません。");
        if (errorSound) errorSound.triggerAttackRelease("C2", "0.2s");
        return;
    }

    if (isValidWallPlacement(r_slot, c_slot, type)) {
        placeWall(r_slot, c_slot, type);
        playerWallsRemaining[currentPlayer]--;
        if (placeWallSound) placeWallSound.triggerAttackRelease("G2", "0.1s");
        switchTurn();
        renderBoard();
    } else {
        showMessage("壁をそこには置けません。");
        if (errorSound) errorSound.triggerAttackRelease("C2", "0.2s");
    }
}

function placeWall(r_slot, c_slot, type) {
    if (type === 'h') {
        horizontalWalls[r_slot][c_slot] = true;
    } else {
        verticalWalls[r_slot][c_slot] = true;
    }
}

function isValidWallPlacement(r_slot, c_slot, type) {
    // 1. Check for overlap
    if (type === 'h') {
        if (horizontalWalls[r_slot][c_slot]) return false; // Direct overlap
        if (c_slot > 0 && horizontalWalls[r_slot][c_slot - 1]) return false; // Overlap left
        if (c_slot < BOARD_SIZE - 2 && horizontalWalls[r_slot][c_slot + 1]) return false; // Overlap right
        if (verticalWalls[r_slot] && verticalWalls[r_slot][c_slot]) return false; // Crossing overlap
    } else { // type === 'v'
        if (verticalWalls[r_slot][c_slot]) return false; // Direct overlap
        if (r_slot > 0 && verticalWalls[r_slot - 1][c_slot]) return false; // Overlap up
        if (r_slot < BOARD_SIZE - 2 && verticalWalls[r_slot + 1][c_slot]) return false; // Overlap down
        if (horizontalWalls[r_slot] && horizontalWalls[r_slot][c_slot]) return false; // Crossing overlap
    }

    // 2. Check if it blocks the last path for any player
    const tempH = horizontalWalls.map(row => [...row]);
    const tempV = verticalWalls.map(row => [...row]);
    if (type === 'h') tempH[r_slot][c_slot] = true;
    else tempV[r_slot][c_slot] = true;

    let pathsValid = true;
    for (const pawn of pawns) {
        if (!canPawnReachGoal(pawn, tempH, tempV)) {
            pathsValid = false;
            break;
        }
    }
    return pathsValid;
}

function canPawnReachGoal(pawn, currentHWalls, currentVWalls) {
    const q = [{ r: pawn.r, c: pawn.c }];
    const visited = new Set([`${pawn.r},${pawn.c}`]);
    const goalRow = pawn.goalRow;

    while (q.length > 0) {
        const { r, c } = q.shift();
        if (r === goalRow) return true;

        const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
        for (const [dr, dc] of directions) {
            const newR = r + dr;
            const newC = c + dc;

            if (newR >= 0 && newR < BOARD_SIZE && newC >= 0 && newC < BOARD_SIZE && !visited.has(`${newR},${newC}`)) {
                if (!isMoveBlockedByWallWithState(r, c, newR, newC, currentHWalls, currentVWalls)) {
                    visited.add(`${newR},${newC}`);
                    q.push({ r: newR, c: newC });
                }
            }
        }
    }
    return false;
}




function getPathLength(startR, startC, goalRow, currentHWalls, currentVWalls) {
    const q = [{ r: startR, c: startC, dist: 0 }];
    const visited = new Set([`${startR},${startC}`]);

    while (q.length > 0) {
        const { r, c, dist } = q.shift();
        if (r === goalRow) return dist;

        const validMoves = getValidMovesForPathfinding(r, c, currentHWalls, currentVWalls);

        for (const move of validMoves) {
            if (!visited.has(`${move.r},${move.c}`)) {
                visited.add(`${move.r},${move.c}`);
                q.push({ r: move.r, c: move.c, dist: dist + 1 });
            }
        }
    }
    return Infinity; // No path found
}

function getValidMovesForPathfinding(r, c, currentHWalls, currentVWalls) {
    const moves = [];
    const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];

    for (const [dr, dc] of directions) {
        const newR = r + dr;
        const newC = c + dc;

        if (newR >= 0 && newR < BOARD_SIZE && newC >= 0 && newC < BOARD_SIZE) {
            let blocked = false;
            if (r === newR) { // Horizontal move
                const groove_col = Math.min(c, newC);
                if ((currentVWalls[r - 1] && currentVWalls[r - 1][groove_col]) || (currentVWalls[r] && currentVWalls[r][groove_col])) {
                    blocked = true;
                }
            } else { // Vertical move
                const groove_row = Math.min(r, newR);
                if ((currentHWalls[groove_row][c - 1]) || (currentHWalls[groove_row][c])) {
                    blocked = true;
                }
            }
            if (!blocked) {
                moves.push({ r: newR, c: newC });
            }
        }
    }
    return moves;
}


function makeAIMove() {
    if (gameOver) return;

    const aiPawnIndex = 1;
    const playerPawnIndex = 0;
    const aiPawn = pawns[aiPawnIndex];
    const playerPawn = pawns[playerPawnIndex];

    // --- 1. Evaluate best pawn move --- (Finds the 'least bad' move)
    let bestMove = null;
    let bestMoveValue = Infinity;
    const possibleMoves = getValidMoves(aiPawn.r, aiPawn.c);

    if (possibleMoves.length === 0) {
        console.log("AI has no moves! Passing turn.");
        switchTurn(); // No possible moves, pass turn.
        return;
    }

    const myCurrentPath = getPathLength(aiPawn.r, aiPawn.c, aiPawn.goalRow, horizontalWalls, verticalWalls);

    for (const move of possibleMoves) {
        const path = getPathLength(move.r, move.c, aiPawn.goalRow, horizontalWalls, verticalWalls);
        if (path < bestMoveValue) {
            bestMoveValue = path;
            bestMove = move;
        }
    }

    // --- 2. Evaluate best wall placement ---
    let bestWall = null;
    let maxPlayerPathIncrease = 0;
    if (playerWallsRemaining[aiPawnIndex] > 0) {
        const playerCurrentPath = getPathLength(playerPawn.r, playerPawn.c, playerPawn.goalRow, horizontalWalls, verticalWalls);
        if (playerCurrentPath !== Infinity) { // Only check for walls if player has a path
            for (let r_slot = 0; r_slot < BOARD_SIZE - 1; r_slot++) {
                for (let c_slot = 0; c_slot < BOARD_SIZE - 1; c_slot++) {
                    // Check horizontal and vertical wall placements
                    ['h', 'v'].forEach(type => {
                        if (isValidWallPlacement(r_slot, c_slot, type)) {
                            const tempH = horizontalWalls.map(row => [...row]);
                            const tempV = verticalWalls.map(row => [...row]);
                            if (type === 'h') tempH[r_slot][c_slot] = true;
                            else tempV[r_slot][c_slot] = true;

                            const newPlayerPath = getPathLength(playerPawn.r, playerPawn.c, playerPawn.goalRow, tempH, tempV);
                            if (newPlayerPath > playerCurrentPath && newPlayerPath !== Infinity) {
                                const increase = newPlayerPath - playerCurrentPath;
                                if (increase > maxPlayerPathIncrease) {
                                    maxPlayerPathIncrease = increase;
                                    bestWall = { r: r_slot, c: c_slot, type };
                                }
                            }
                        }
                    });
                }
            }
        }
    }

    // --- 3. Decide and act ---
    const myPathImprovement = myCurrentPath - bestMoveValue;

    // Place a wall if its impact on the player is greater than the benefit of our best move.
    if (bestWall && maxPlayerPathIncrease > myPathImprovement) {
        placeWall(bestWall.r, bestWall.c, bestWall.type);
        playerWallsRemaining[aiPawnIndex]--;
        if (placeWallSound) placeWallSound.triggerAttackRelease("G2", "0.1s");
        switchTurn();
    } else {
        // Otherwise, make the best move available.
        // bestMove is guaranteed to be non-null here because we checked for possibleMoves.length > 0
        movePawn(aiPawnIndex, bestMove.r, bestMove.c);
    }
}

function showMessage(msg) {
    messageArea.textContent = msg;
    setTimeout(() => { if (messageArea.textContent === msg) messageArea.textContent = ''; }, 3000);
}

function endGame(winnerIndex) {
    gameOver = true;
    winnerMessage.textContent = `プレイヤー ${winnerIndex + 1} の勝利!`;
    if (victorySound) victorySound.triggerAttackRelease("C5", "0.5s");
    gameScreen.style.display = 'none';
    victoryScreen.style.display = 'block';
    resetGameButton.style.display = 'none';
}

function startGame(mode) {
    gameMode = mode;
    menuScreen.style.display = 'none';
    victoryScreen.style.display = 'none';
    gameScreen.style.display = 'flex';
    initializeSounds();
    initBoard();
    resetGameState();
    renderBoard();
}

// Event Listeners
startPvpButton.addEventListener('click', () => startGame('pvp'));
startPvcButton.addEventListener('click', () => startGame('pvc'));
resetGameButton.addEventListener('click', () => {
    // Starts a new game with the same mode
    startGame(gameMode);
});

backToSelectBtn.addEventListener('click', () => {
    gameScreen.style.display = 'none';
    menuScreen.style.display = 'flex';
    // Hide game controls when going back to menu
    gameControls.style.display = 'none';
});

playAgainButton.addEventListener('click', () => {
    victoryScreen.style.display = 'none';
    menuScreen.style.display = 'block';
});
resetGameButton.addEventListener('click', () => {
    startGame(gameMode);
});

showRulesBtn.addEventListener('click', () => {
    menuScreen.style.display = 'none';
    rulesScreen.style.display = 'block';
});

backToMenuBtn.addEventListener('click', () => {
    rulesScreen.style.display = 'none';
    menuScreen.style.display = 'block';
});

document.addEventListener('DOMContentLoaded', () => {
    // The game starts from the menu, so no need to call startGame here.
});
