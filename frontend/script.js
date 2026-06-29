// ============================================================
//  1. НАСТРОЙКИ
// ============================================================
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreSpan = document.getElementById('scoreValue');
const bestSpan = document.getElementById('bestScoreValue');
const gameOverMsg = document.getElementById('gameOverMessage');
const levelLabel = document.getElementById('levelLabel');
const playerNameInput = document.getElementById('playerName');
const applyNameBtn = document.getElementById('applyNameBtn');

// Статистика
const statsGames = document.getElementById('statsGames');
const statsAvgScore = document.getElementById('statsAvgScore');
const statsBestScore = document.getElementById('statsBestScore');
const statsMaxLevel = document.getElementById('statsMaxLevel');

// Рекорды
const recordsList = document.getElementById('recordsList');

const BOARD_SIZE = 400;
const CELL_SIZE = 20;
const CELL_COUNT = BOARD_SIZE / CELL_SIZE;

// API URL (для локальной разработки)
const API_URL = '/api';

// Уровни: [мс между тиками]
const LEVELS = {
    1: 180,
    2: 130,
    3: 80,
    4: 50,
};
let currentLevel = 1;
let tickInterval = LEVELS[currentLevel];

// ============================================================
//  2. ПЕРЕМЕННЫЕ СОСТОЯНИЯ
// ============================================================
let snake = [];
let dx = CELL_SIZE;
let dy = 0;
let foodX = 0;
let foodY = 0;
let score = 0;
let bestScore = 0;
let changingDirection = false;
let gameRunning = false;
let gameOver = false;
let timerId = null;
let currentPlayer = 'Buldabs';

// Время игры для статистики
let gameStartTime = 0;
let foodEaten = 0;

// ============================================================
//  3. РАБОТА С API
// ============================================================
async function loadRecords() {
    try {
        const response = await fetch(`${API_URL}/records`);
        const records = await response.json();
        renderRecords(records);
        
        if (records.length > 0) {
            bestScore = records[0].score;
            bestSpan.textContent = bestScore;
        }
    } catch (e) {
        console.warn('Не удалось загрузить рекорды:', e);
        recordsList.innerHTML = '<div class="loading">⚠️ Не удалось загрузить рекорды</div>';
    }
}

async function loadPlayerStats(username) {
    try {
        const response = await fetch(`${API_URL}/stats/${encodeURIComponent(username)}`);
        if (!response.ok) {
            statsGames.textContent = '0';
            statsAvgScore.textContent = '0';
            statsBestScore.textContent = '0';
            statsMaxLevel.textContent = '1';
            return;
        }
        const stats = await response.json();
        statsGames.textContent = stats.games_played || 0;
        statsAvgScore.textContent = stats.avg_score || 0;
        statsBestScore.textContent = stats.best_score || 0;
        statsMaxLevel.textContent = stats.max_level || 1;
    } catch (e) {
        console.warn('Не удалось загрузить статистику:', e);
    }
}

async function saveGameResult(username, score, level, foodEaten, duration, result) {
    try {
        const response = await fetch(`${API_URL}/game`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: username,
                score: score,
                level: level,
                food_eaten: foodEaten,
                duration: duration,
                result: result
            })
        });
        const data = await response.json();
        if (data.status === 'ok') {
            await loadRecords();
            await loadPlayerStats(username);
        }
    } catch (e) {
        console.warn('Не удалось сохранить результат:', e);
    }
}

function renderRecords(records) {
    if (!records || records.length === 0) {
        recordsList.innerHTML = '<div class="loading">😅 Пока нет рекордов. Сыграйте!</div>';
        return;
    }
    
    let html = '';
    records.forEach((record, index) => {
        const rank = index + 1;
        const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}.`;
        html += `
            <div class="record-item">
                <span class="rank">${medal}</span>
                <span class="name">${escapeHtml(record.player_name)}</span>
                <span class="score">${record.score}</span>
            </div>
        `;
    });
    recordsList.innerHTML = html;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================================
//  4. ИНИЦИАЛИЗАЦИЯ ЗМЕИ
// ============================================================
function initSnake() {
    const startX = Math.floor(CELL_COUNT / 2) * CELL_SIZE;
    const startY = Math.floor(CELL_COUNT / 2) * CELL_SIZE;
    snake = [];
    for (let i = 0; i < 4; i++) {
        snake.push({ x: startX - i * CELL_SIZE, y: startY });
    }
    dx = CELL_SIZE;
    dy = 0;
}

// ============================================================
//  5. ЕДА
// ============================================================
function randomCell() {
    return Math.floor(Math.random() * CELL_COUNT) * CELL_SIZE;
}

function createFood() {
    let newFoodX, newFoodY;
    let onSnake;
    let attempts = 0;
    do {
        newFoodX = randomCell();
        newFoodY = randomCell();
        onSnake = snake.some(part => part.x === newFoodX && part.y === newFoodY);
        attempts++;
        if (attempts > 1000) break;
    } while (onSnake);
    foodX = newFoodX;
    foodY = newFoodY;
}

// ============================================================
//  6. ОТРИСОВКА
// ============================================================
function clearCanvas() {
    ctx.fillStyle = '#0f0f1a';
    ctx.fillRect(0, 0, BOARD_SIZE, BOARD_SIZE);

    ctx.strokeStyle = '#1a1a30';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= CELL_COUNT; i++) {
        ctx.beginPath();
        ctx.moveTo(i * CELL_SIZE, 0);
        ctx.lineTo(i * CELL_SIZE, BOARD_SIZE);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i * CELL_SIZE);
        ctx.lineTo(BOARD_SIZE, i * CELL_SIZE);
        ctx.stroke();
    }
}

function drawSnakePart(part, index) {
    const isHead = index === 0;
    const radius = 4;

    ctx.shadowColor = isHead ? '#8f8' : '#4a4';
    ctx.shadowBlur = isHead ? 12 : 4;

    ctx.fillStyle = isHead ? '#66dd66' : '#44bb44';
    ctx.strokeStyle = '#226622';
    ctx.lineWidth = 1.5;

    const x = part.x, y = part.y, s = CELL_SIZE;
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + s - radius, y);
    ctx.quadraticCurveTo(x + s, y, x + s, y + radius);
    ctx.lineTo(x + s, y + s - radius);
    ctx.quadraticCurveTo(x + s, y + s, x + s - radius, y + s);
    ctx.lineTo(x + radius, y + s);
    ctx.quadraticCurveTo(x, y + s, x, y + s - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    if (isHead) {
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(x + 5, y + 5, 3, 0, 2 * Math.PI);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x + 15, y + 5, 3, 0, 2 * Math.PI);
        ctx.fill();
        ctx.fillStyle = '#222';
        ctx.beginPath();
        ctx.arc(x + 5, y + 5, 1.5, 0, 2 * Math.PI);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x + 15, y + 5, 1.5, 0, 2 * Math.PI);
        ctx.fill();
    }

    ctx.shadowBlur = 0;
}

function drawSnake() {
    snake.forEach((part, i) => drawSnakePart(part, i));
}

function drawFood() {
    ctx.shadowColor = '#ff4444';
    ctx.shadowBlur = 25;

    const x = foodX, y = foodY, s = CELL_SIZE;
    const gradient = ctx.createRadialGradient(
        x + s/2, y + s/2, 2,
        x + s/2, y + s/2, s/1.5
    );
    gradient.addColorStop(0, '#ff6b6b');
    gradient.addColorStop(1, '#cc2222');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x + s/2, y + s/2, s/2 - 1, 0, 2 * Math.PI);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.beginPath();
    ctx.arc(x + 6, y + 6, 3, 0, 2 * Math.PI);
    ctx.fill();
}

// ============================================================
//  7. ЛОГИКА ДВИЖЕНИЯ
// ============================================================
function advanceSnake() {
    const head = {
        x: snake[0].x + dx,
        y: snake[0].y + dy
    };
    snake.unshift(head);

    const didEat = (snake[0].x === foodX && snake[0].y === foodY);
    if (didEat) {
        score += 10;
        scoreSpan.textContent = score;
        foodEaten++;
        
        createFood();
        if (score % 50 === 0 && currentLevel < 4) {
            increaseLevel();
        }
    } else {
        snake.pop();
    }

    changingDirection = false;
}

// ============================================================
//  8. ПРОВЕРКА КОНЦА ИГРЫ
// ============================================================
function didGameEnd() {
    const head = snake[0];

    if (head.x < 0 || head.x >= BOARD_SIZE || head.y < 0 || head.y >= BOARD_SIZE) {
        return true;
    }

    for (let i = 4; i < snake.length; i++) {
        if (snake[i].x === head.x && snake[i].y === head.y) {
            return true;
        }
    }
    return false;
}

// ============================================================
//  9. УРОВНИ
// ============================================================
function increaseLevel() {
    if (currentLevel < 4) {
        currentLevel++;
        tickInterval = LEVELS[currentLevel];
        levelLabel.textContent = currentLevel;
        if (gameRunning) {
            clearTimeout(timerId);
            gameLoop();
        }
    }
}

// ============================================================
//  10. УПРАВЛЕНИЕ
// ============================================================
function changeDirection(event) {
    if (!gameRunning || gameOver) return;

    const key = event.key;
    const goingUp = dy === -CELL_SIZE;
    const goingDown = dy === CELL_SIZE;
    const goingLeft = dx === -CELL_SIZE;
    const goingRight = dx === CELL_SIZE;

    let newDx = dx, newDy = dy;

    if (key === 'ArrowLeft' && !goingRight) { newDx = -CELL_SIZE; newDy = 0; }
    else if (key === 'ArrowUp' && !goingDown) { newDx = 0; newDy = -CELL_SIZE; }
    else if (key === 'ArrowRight' && !goingLeft) { newDx = CELL_SIZE; newDy = 0; }
    else if (key === 'ArrowDown' && !goingUp) { newDx = 0; newDy = CELL_SIZE; }
    else return;

    if (changingDirection) return;
    changingDirection = true;
    dx = newDx;
    dy = newDy;
}

// ============================================================
//  11. ИГРОВОЙ ЦИКЛ
// ============================================================
function gameLoop() {
    if (!gameRunning) return;

    timerId = setTimeout(() => {
        if (didGameEnd()) {
            endGame();
            return;
        }

        clearCanvas();
        drawFood();
        advanceSnake();
        drawSnake();
        gameLoop();
    }, tickInterval);
}

// ============================================================
//  12. СТАРТ / РЕСТАРТ / КОНЕЦ
// ============================================================
function startGame() {
    if (timerId) clearTimeout(timerId);
    gameOver = false;
    gameRunning = true;
    gameOverMsg.textContent = '';
    score = 0;
    scoreSpan.textContent = score;
    foodEaten = 0;
    gameStartTime = Date.now();
    currentLevel = 1;
    levelLabel.textContent = currentLevel;
    tickInterval = LEVELS[currentLevel];
    initSnake();
    createFood();
    clearCanvas();
    drawFood();
    drawSnake();
    gameLoop();
}

function endGame() {
    gameRunning = false;
    gameOver = true;
    if (timerId) clearTimeout(timerId);
    
    const duration = Math.floor((Date.now() - gameStartTime) / 1000);
    const result = 'lose';
    
    // Сохраняем результат в БД
    saveGameResult(currentPlayer, score, currentLevel, foodEaten, duration, result);
    
    gameOverMsg.textContent = '💀 Игра окончена! Нажмите "Новая игра" или Пробел';
    clearCanvas();
    drawFood();
    drawSnake();
    ctx.strokeStyle = '#ff3333';
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, BOARD_SIZE - 4, BOARD_SIZE - 4);
}

function restartGame() {
    startGame();
}

// ============================================================
//  13. СОБЫТИЯ
// ============================================================
document.addEventListener('keydown', (e) => {
    if (e.key.startsWith('Arrow')) {
        e.preventDefault();
        changeDirection(e);
    }
    if (e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        if (gameOver || !gameRunning) {
            restartGame();
        }
    }
});

document.getElementById('restartBtn').addEventListener('click', restartGame);

document.getElementById('levelBtn').addEventListener('click', () => {
    if (currentLevel < 4) {
        increaseLevel();
    } else {
        gameOverMsg.textContent = '🔥 Максимальный уровень!';
        setTimeout(() => {
            if (!gameOver) gameOverMsg.textContent = '';
        }, 1500);
    }
});

applyNameBtn.addEventListener('click', () => {
    const name = playerNameInput.value.trim();
    if (name) {
        currentPlayer = name;
        loadPlayerStats(currentPlayer);
    }
});

playerNameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        applyNameBtn.click();
    }
});

// ============================================================
//  14. АДАПТАЦИЯ CANVAS
// ============================================================
function resizeCanvas() {
    const container = canvas.parentElement;
    const maxWidth = container.clientWidth - 20;
    if (maxWidth < 400) {
        canvas.style.width = maxWidth + 'px';
        canvas.style.height = maxWidth + 'px';
    } else {
        canvas.style.width = '';
        canvas.style.height = '';
    }
}

window.addEventListener('resize', resizeCanvas);

// ============================================================
//  15. ЗАПУСК
// ============================================================
loadRecords();
loadPlayerStats(currentPlayer);
startGame();
resizeCanvas();

console.log('🐍 Змейка запущена! API:', API_URL);