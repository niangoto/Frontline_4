// Constants
const PLAYER_COLORS = ["#FF0000", "#0000FF"];
const UNIT_RADIUS = 15;
const INITIAL_POINTS = 90;
const FRONT_LINE_COLOR = "#000000";
const BG_COLOR = "#F0F0F0";
const BUTTON_COLOR = "#64C864";
const BUTTON_TEXT_COLOR = "#FFFFFF";
const MAX_MOVE_DISTANCE = 30;
const MIN_DISTANCE_TO_FRONT = UNIT_RADIUS * 1.5;
const MOVE_SPEED = 3;
const MAX_UNITS = 50;  // New constant for maximum units
const MAX_TURNS = 15;  // New constant for maximum turns
const CAPITAL_RADIUS = UNIT_RADIUS;  // Now same size as units
const CAPITAL_COLOR = "#FFD700";
const SELECTION_COLOR = "#00FF00";
const SELECTION_LINE_WIDTH = 2;
const SELECTED_UNIT_COLOR = "#00FF00";
const SELECTED_UNIT_LINE_WIDTH = 3;
// Дължини на стрелките
const BLACK_ARROW_LENGTH = 50;
const BLUE_ARROW_LENGTH = BLACK_ARROW_LENGTH * 2;
// Пример: границата е между lat1 и lat2 (север-юг), canvas.height = 600
const LAT1 = 54.8; // северна граница (пример)
const LAT2 = 50.3; // южна граница (пример)

// DOM elements
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const gameInfo = document.getElementById('game-info');
const readyBtn = document.getElementById('ready-btn');
const settingsModal = document.getElementById('settings-modal');
const turnInput = document.getElementById('turn-input');
const confirmBtn = document.getElementById('confirm-btn');

// Game data
let gameData = {
    playerUnits: [[], []],
    frontLine: [],
    selectedUnit: null,
    phase: "placement",
    currentPlayer: 0,
    battlePhase: false,
    turnCount: 0,
    showArrows: true,
    maxTurns: 3,
    originalYPositions: [],
    initialSpacing: 0,
    capitals: [null, null], // Store capital positions for each player
    selectionStart: null,
    selectionEnd: null,
    selectedUnits: [],
    gameMode: "2players", // "2players" или "vsbot"
};

// Сега вече може:
let ARROW_LENGTH = Math.max(40, Math.floor(canvas.width / gameData.maxTurns / 2));

// Начално положение на фронтовата линия (географски координати)
function latToY(lat) {
    // Преобразува latitude към y в canvas
    return ((LAT1 - lat) / (LAT1 - LAT2)) * canvas.height;
}
function yToLat(y) {
    // Преобразува y в latitude
    return LAT1 - (y / canvas.height) * (LAT1 - LAT2);
}
function geoToCanvas([lon, lat]) {
    // longitude -> x, latitude -> y
    // Пример: x = (lon - LON1) / (LON2 - LON1) * canvas.width
    const LON1 = 14.0; // западна граница (пример)
    const LON2 = 24.0; // източна граница (пример)
    let x = ((lon - LON1) / (LON2 - LON1)) * canvas.width;
    let y = latToY(lat);
    return [x, y];
}
// Game class definition should come before any usage
class Game {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.frontLine = [];
        this.playerUnits = [[], []];
        this.currentPlayer = 0;
        this.selectedUnit = null;
        this.phase = "settings";
        this.battlePhase = false;
        this.turnCount = 0;
        this.maxTurns = 3;
        this.maxUnits = 10;
        this.gameMode = "2players"; 
    }

    draw() {
        // Clear canvas
        this.ctx.fillStyle = '#f0f0f0';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw territories
        if (this.frontLine.length > 1) {
            // Draw red territory
            this.ctx.beginPath();
            this.ctx.moveTo(0, 0);
            for (const point of this.frontLine) {
                this.ctx.lineTo(point[0], point[1]);
            }
            this.ctx.lineTo(0, this.canvas.height);
            this.ctx.closePath();
            this.ctx.fillStyle = '#ffcccc';
            this.ctx.fill();

            // Draw blue territory
            this.ctx.beginPath();
            this.ctx.moveTo(this.canvas.width, 0);
            for (const point of this.frontLine) {
                this.ctx.lineTo(point[0], point[1]);
            }
            this.ctx.lineTo(this.canvas.width, this.canvas.height);
            this.ctx.closePath();
            this.ctx.fillStyle = '#ccceff';
            this.ctx.fill();

            // Draw front line
            this.ctx.beginPath();
            this.ctx.moveTo(this.frontLine[0][0], this.frontLine[0][1]);
            for (const point of this.frontLine) {
                this.ctx.lineTo(point[0], point[1]);
            }
            this.ctx.strokeStyle = '#000000';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();

            // Draw points on front line
            for (const point of this.frontLine) {
                this.ctx.beginPath();
                this.ctx.arc(point[0], point[1], 3, 0, Math.PI * 2);
                this.ctx.fillStyle = '#000000';
                this.ctx.fill();
            }
        }

        // Draw units
        for (let player = 0; player < 2; player++) {
            // Skip drawing red units during blue's placement phase
            if (this.phase === "placement" && player === 0 && this.currentPlayer === 1) {
                continue;
            }

            for (const unit of this.playerUnits[player]) {
                unit.draw(this.ctx, unit === this.selectedUnit);
            }
        }

        // Update game info
        const gameInfo = document.getElementById('game-info');
        if (this.phase === "placement") {
            gameInfo.textContent = `Играч ${this.currentPlayer + 1}: Поставяне на единици (${this.playerUnits[this.currentPlayer].length}/${this.maxUnits})`;
        } else if (this.phase.endsWith("_arrows")) {
            gameInfo.textContent = `Играч ${this.currentPlayer + 1}: Задаване на посоки`;
        }
    }
    update() {
        // ... съществуващ код ...

        // Проверка за бот
        if (this.gameMode === "vsbot" && 
            this.currentPlayer === 1 && 
            (this.phase === "placement" || this.phase === "player2_arrows")) {
            
            if (!this.bot) {
                this.bot = new BotController(this);
            }
            
            // Изкуствено забавяне за по-естествено поведение
            setTimeout(() => {
                this.bot.makeDecision();
                
                // Автоматично маркиране като готов ако е необходимо
                if (this.phase === "placement" && 
                    this.playerUnits[1].length >= this.maxUnits) {
                    this.handleReadyClick();
                } else if (this.phase === "player2_arrows") {
                    // Даваме малко време на стрелките да се визуализират
                    setTimeout(() => this.handleReadyClick(), 500);
                }
            }, 1000);
        }
    }
}

// Create game instance
let game = new Game(canvas);

// Инициализация на играта
let botController = null;
if (gameData.gameMode === "vsbot") {
    botController = new BotController(gameData);
}

// Клас Unit
class Unit {
    constructor(player, x, y) {
        this.player = player;
        this.x = x;
        this.y = y;
        this.targetX = x;
        this.targetY = y;
        this.prevX = x;
        this.prevY = y;
        this.direction = null;
        this.assignedPoints = [];  // Инициализираме масива тук
        this.forwardMoves = 0;
        this.totalPoints = 0;
        this.partialPoints = 0;
        this.blueArrow = null;
        this.isMoving = false;
        this.moveProgress = 0;
        this.blockedByFront = false;
        this.beingPushed = false;
        this.pushTargetX = x;
        this.pushTargetY = y;
        this.pushProgress = 0;
    }

    updatePosition() {
        const scale = getUnitScale();
        // Първо обработваме избутването
        if (this.beingPushed) {
            this.x = this.prevX + (this.pushTargetX - this.prevX) * this.pushProgress;
            this.y = this.prevY + (this.pushTargetY - this.prevY) * this.pushProgress;
            this.pushProgress = Math.min(1.0, this.pushProgress + MOVE_SPEED / 10);

            // Ако центърът е напълно извън екрана — премахни единицата
            if (
                this.x < 0 ||
                this.x > canvas.width ||
                this.y < 0 ||
                this.y > canvas.height
            ) {
                gameData.playerUnits[this.player] = gameData.playerUnits[this.player].filter(u => u !== this);
                return;
            }

            // Check distance from front line after being pushed
            let tooClose = false;
            for (let point of gameData.frontLine) {
                let dist = Math.sqrt((this.x - point[0])**2 + (this.y - point[1])**2);
                if (dist < UNIT_RADIUS * scale) {
                    tooClose = true;
                    break;
                }
            }

            // Ако е твърде близо до фронта и е притисната и от ръба (центърът извън екрана) — премахни
            if (tooClose) {
                if (
                    this.x < 0 ||
                    this.x > canvas.width ||
                    this.y < 0 ||
                    this.y > canvas.height
                ) {
                    gameData.playerUnits[this.player] = gameData.playerUnits[this.player].filter(u => u !== this);
                    return;
                }
                // Ако е само твърде близо до фронта — премахни
                gameData.playerUnits[this.player] = gameData.playerUnits[this.player].filter(u => u !== this);
                return;
            }

            // Ако ще излезе извън екрана — спри движението (не премахвай)
            if (
                this.x - UNIT_RADIUS * scale < 0 ||
                this.x + UNIT_RADIUS * scale > canvas.width ||
                this.y - UNIT_RADIUS * scale < 0 ||
                this.y + UNIT_RADIUS * scale > canvas.height
            ) {
                this.beingPushed = false;
                this.isMoving = false;
                this.blockedByFront = true;
                return;
            }

            // Спри движението ако попадне в морето (WW2 карта)
            if (isInSeaZone(this.x, this.y)) {
                this.beingPushed = false;
                this.isMoving = false;
                this.blockedByFront = true;
                return;
            }

            if (this.pushProgress >= 1.0) {
                this.beingPushed = false;
                this.prevX = this.x;
                this.prevY = this.y;
                // Актуализираме и целевите позиции ако има активно движение
                if (this.isMoving) {
                    this.targetX += (this.pushTargetX - this.prevX);
                    this.targetY += (this.pushTargetY - this.prevY);
                }
            }
            return;
        }

        if (this.isMoving) {
            // Изчисляваме потенциалните нови координати
            let newX = this.prevX + (this.targetX - this.prevX) * this.moveProgress;
            let newY = this.prevY + (this.targetY - this.prevY) * this.moveProgress;

            // Ако ще излезе извън екрана — спри движението (не премахвай)
            if (
                newX - UNIT_RADIUS * scale < 0 ||
                newX + UNIT_RADIUS * scale > canvas.width ||
                newY - UNIT_RADIUS * scale < 0 ||
                newY + UNIT_RADIUS * scale > canvas.height
            ) {
                this.isMoving = false;
                this.blockedByFront = true;
                return;
            }

            // Спри движението ако влиза в морето (WW2 карта)
            if (isInSeaZone(newX, newY)) {
                this.isMoving = false;
                this.blockedByFront = true;
                return;
            }

            // Вектор на движение
            let moveDirX = this.targetX - this.prevX;
            let moveDirY = this.targetY - this.prevY;
            let moveLen = Math.sqrt(moveDirX**2 + moveDirY**2);

            if (moveLen > 0.001) {
                moveDirX /= moveLen;
                moveDirY /= moveLen;
            }

            // Проверка за разстояние до фронтовата линия
            let tooClose = false;
            let closestDist = Infinity;
            let closestPoint = null;

            // Use WW2 distance for movement checks
            let minDistanceToFront = (gameData.ww2CapitalsLocked ? 2.5 : 1.5) * UNIT_RADIUS * scale;
            for (let point of gameData.frontLine) {
                let dist = Math.sqrt((newX - point[0])**2 + (newY - point[1])**2);
                if (dist < minDistanceToFront) {
                    tooClose = true;
                    if (dist < closestDist) {
                        closestDist = dist;
                        closestPoint = point;
                    }
                }
            }

            if (!tooClose) {
                // Свободно движение
                this.x = newX;
                this.y = newY;
                this.moveProgress = Math.min(1.0, this.moveProgress + MOVE_SPEED / (moveLen + 0.1));
            } else {
                // Проверяваме дали се приближаваме или отдалечаваме от точката
                if (closestPoint) {
                    // Вектор към най-близката точка от фронта
                    let toPointX = closestPoint[0] - this.x;
                    let toPointY = closestPoint[1] - this.y;

                    // Скаларно произведение
                    let dotProduct = moveDirX * toPointX + moveDirY * toPointY;

                    if (dotProduct <= 0) {
                        // Позволяваме движение
                        this.x = newX;
                        this.y = newY;
                        this.moveProgress = Math.min(1.0, this.moveProgress + MOVE_SPEED / (moveLen + 0.1));
                    } else {
                        // Спираме движението
                        this.blockedByFront = true;
                        this.isMoving = false;
                    }
                } else {
                    this.blockedByFront = true;
                    this.isMoving = false;
                }
            }

            if (this.moveProgress >= 1.0) {
                this.isMoving = false;
            }
        }
    }

    draw(selected = false, showArrows = true) {
        // Рисуване на единицата
        const scale = getUnitScale();
        ctx.beginPath();
        ctx.arc(this.x, this.y, UNIT_RADIUS * scale, 0, Math.PI * 2);
        ctx.fillStyle = PLAYER_COLORS[this.player];
        ctx.fill();
        
        // Дебел зелен контур за маркирани единици
        if (gameData.selectedUnits.includes(this)) {
            ctx.strokeStyle = SELECTED_UNIT_COLOR;
            ctx.lineWidth = SELECTED_UNIT_LINE_WIDTH * scale;
            ctx.stroke();
            ctx.lineWidth = 1;
        } else {
            ctx.strokeStyle = PLAYER_COLORS[this.player];
            ctx.stroke();
        }
        
        if (showArrows) {
            // Синя стрелка (вижда се само ако е зададена)
            if (this.blueArrow) {
                let [endX, endY] = this.blueArrow;
                let dx = endX - this.x;
                let dy = endY - this.y;
                let dist = Math.hypot(dx, dy);
                let maxLen = BLUE_ARROW_LENGTH * scale;
                if (dist > maxLen) {
                    let s = maxLen / dist;
                    endX = this.x + dx * s;
                    endY = this.y + dy * s;
                }
                ctx.beginPath();
                ctx.moveTo(this.x, this.y);
                ctx.lineTo(endX, endY);
                ctx.strokeStyle = "#0000FF";
                ctx.lineWidth = 2 * scale;
                ctx.stroke();

                let angle = Math.atan2(endY - this.y, endX - this.x);
                ctx.beginPath();
                ctx.moveTo(endX, endY);
                ctx.lineTo(
                    endX - 10 * scale * Math.cos(angle - Math.PI/6),
                    endY - 10 * scale * Math.sin(angle - Math.PI/6)
                );
                ctx.lineTo(
                    endX - 10 * scale * Math.cos(angle + Math.PI/6),
                    endY - 10 * scale * Math.sin(angle + Math.PI/6)
                );
                ctx.closePath();
                ctx.fillStyle = "#0000FF";
                ctx.fill();
                ctx.lineWidth = 1;
            }
            // Черна стрелка (вижда се винаги, ако има зададена посока)
            if (this.direction !== null && !this.isMoving) {
                let blackLen = BLACK_ARROW_LENGTH * scale;
                let endX = this.x + blackLen * Math.cos(this.direction);
                let endY = this.y + blackLen * Math.sin(this.direction);
                ctx.beginPath();
                ctx.moveTo(this.x, this.y);
                ctx.lineTo(endX, endY);
                ctx.strokeStyle = "#000000";
                ctx.lineWidth = 2 * scale;
                ctx.stroke();

                let angle = this.direction;
                ctx.beginPath();
                ctx.moveTo(endX, endY);
                ctx.lineTo(
                    endX - 10 * scale * Math.cos(angle - Math.PI/6),
                    endY - 10 * scale * Math.sin(angle - Math.PI/6)
                );
                ctx.lineTo(
                    endX - 10 * scale * Math.cos(angle + Math.PI/6),
                    endY - 10 * scale * Math.sin(angle + Math.PI/6)
                );
                ctx.closePath();
                ctx.fillStyle = "#000000";
                ctx.fill();
                ctx.lineWidth = 1;
            }
        }
    }
}

// Инициализация на фронтовата линия
function initializeFrontLine() {
    const POINTS_COUNT = 90;
    let mapType = "classic";
    const mapSelect = document.getElementById('map-select');
    if (mapSelect) {
        mapType = mapSelect.value;
    }

    if (mapType === "WW2") {
        // WW2 карта: използваме външен файл с изкривена линия
        let shape = (typeof WW2_FRONTLINE !== 'undefined') ? WW2_FRONTLINE : [];
        // Ако няма shape, fallback към права линия
        if (!shape || shape.length === 0) {
            shape = Array.from({length: POINTS_COUNT}, (_, i) => [canvas.width/2, (i / (POINTS_COUNT-1)) * canvas.height]);
        }
        // Скалираме по текущия размер на canvas
        let scaleY = canvas.height / 600;
        let scaleX = canvas.width / 700;
        let frontLine = shape.map(([x, y]) => [x * scaleX, y * scaleY]);
        gameData.frontLine = frontLine;
        gameData.initialSpacing = canvas.height / POINTS_COUNT;
        gameData.originalYPositions = frontLine.map(([x, y]) => y);

        // --- WW2: Задаване на столиците от масива и забрана за избор ---
        if (typeof WW2_CAPITALS !== 'undefined' && Array.isArray(WW2_CAPITALS)) {
            // Скалиране на столиците по canvas
            gameData.capitals = WW2_CAPITALS.map(c =>
                c ? [c[0] * scaleX, c[1] * scaleY] : null
            );
        }
        gameData.ww2CapitalsLocked = true;
        return;
    }

    if (
        mapType === "custom" &&
        typeof INITIAL_FRONTLINE !== "undefined" &&
        Array.isArray(INITIAL_FRONTLINE)
    ) {
        // Използвай точките от INITIAL_FRONTLINE (canvas координати)
        let frontLine = interpolateFrontLine(INITIAL_FRONTLINE, POINTS_COUNT);
        fillFrontLineEnds(frontLine, canvas.height / POINTS_COUNT, canvas);
        gameData.frontLine = frontLine;

        // Изчисли новото spacing за динамична корекция
        let totalLen = 0;
        for (let i = 1; i < gameData.frontLine.length; i++) {
            let dx = gameData.frontLine[i][0] - gameData.frontLine[i-1][0];
            let dy = gameData.frontLine[i][1] - gameData.frontLine[i-1][1];
            totalLen += Math.sqrt(dx*dx + dy*dy);
        }
        gameData.initialSpacing = totalLen / (gameData.frontLine.length - 1);
        gameData.originalYPositions = gameData.frontLine.map(([x, y]) => y);
    } else {
        // Класическа права линия
        gameData.initialSpacing = canvas.height / POINTS_COUNT;
        gameData.originalYPositions = Array.from({ length: POINTS_COUNT }, (_, i) => (i + 1) * gameData.initialSpacing);
        gameData.frontLine = gameData.originalYPositions.map(y => [canvas.width / 2, y]);
        // Първата точка най-горе, последната най-долу
        gameData.frontLine[0][1] = 0;
        gameData.frontLine[gameData.frontLine.length - 1][1] = canvas.height;
    }
}

// Проверка за поставяне на единица
function handlePlacement(pos) {
    const scale = getUnitScale();
    // WW2 карта: не позволявай избор на столица
    if (gameData.ww2CapitalsLocked) {
        let [x, y] = pos;
        let player = gameData.currentPlayer;

        // Забрани поставане в морето
        if (isInSeaZone(x, y)) return false;

        // Проверка за премахване на съществуваща единица
        for (let i = 0; i < gameData.playerUnits[player].length; i++) {
            let unit = gameData.playerUnits[player][i];
            if (Math.sqrt((x - unit.x)**2 + (y - unit.y)**2) <= UNIT_RADIUS * scale) {
                gameData.playerUnits[player].splice(i, 1);
                return true;
            }
        }

        // Проверка за максимален брой единици
        if (gameData.playerUnits[player].length >= gameData.maxUnits) {
            return false;
        }
        
        // Проверка за разстояние от фронтова линия
        let minDistance = (gameData.ww2CapitalsLocked ? 2.5 : 1.5) * UNIT_RADIUS * scale;
        for (let point of gameData.frontLine) {
            if (Math.sqrt((x - point[0])**2 + (y - point[1])**2) < minDistance) {
                return false;
            }
        }
        
        // Проверка за разстояние от други единици
        for (let unit of gameData.playerUnits[player]) {
            if (Math.sqrt((x - unit.x)**2 + (y - unit.y)**2) < UNIT_RADIUS * 2 * scale) {
                return false;
            }
        }
        
        // Проверка за разстояние от столицата
        if (gameData.capitals[player]) {
            let capital = gameData.capitals[player];
            if (Math.sqrt((x - capital[0])**2 + (y - capital[1])**2) < UNIT_RADIUS * 2 * scale) {
                return false;
            }
        }
        
        if (!isInOwnTerritory(player, x, y)) {
            return false;
        }
        
        let newUnit = new Unit(player, x, y);
        gameData.playerUnits[player].push(newUnit);
        return true;
    }

    let [x, y] = pos;
    let player = gameData.currentPlayer;

    // Забрани поставане в морето (за всички карти, ако има дефинирана морска зона)
    if (isInSeaZone(x, y)) return false;

    // Проверка за столица
    if (!gameData.capitals[player]) {
        return handleCapitalPlacement(pos);
    }

    // Проверка за премахване на съществуваща единица
    for (let i = 0; i < gameData.playerUnits[player].length; i++) {
        let unit = gameData.playerUnits[player][i];
        if (Math.sqrt((x - unit.x)**2 + (y - unit.y)**2) <= UNIT_RADIUS * scale) {
            gameData.playerUnits[player].splice(i, 1);
            return true;
        }
    }
    
    // Проверка за максимален брой единици
    if (gameData.playerUnits[player].length >= gameData.maxUnits) {
        return false;
    }
    
    // Проверка за разстояние от фронтова линия
    let minDistance = (gameData.ww2CapitalsLocked ? 2.5 : 1.5) * UNIT_RADIUS * scale;
    for (let point of gameData.frontLine) {
        if (Math.sqrt((x - point[0])**2 + (y - point[1])**2) < minDistance) {
            return false;
        }
    }
    
    // Проверка за разстояние от други единици
    for (let unit of gameData.playerUnits[player]) {
        if (Math.sqrt((x - unit.x)**2 + (y - unit.y)**2) < UNIT_RADIUS * 2 * scale) {
            return false;
        }
    }
    
    // Проверка за разстояние от столицата
    if (gameData.capitals[player]) {
        let capital = gameData.capitals[player];
        if (Math.sqrt((x - capital[0])**2 + (y - capital[1])**2) < UNIT_RADIUS * 2 * scale) {
            return false;
        }
    }
    
    if (!isInOwnTerritory(player, x, y)) {
        return false;
    }
    
    let newUnit = new Unit(player, x, y);
    gameData.playerUnits[player].push(newUnit);
    // Ако е режим срещу бот и червения играч е готов, активирай бота
    if (gameData.gameMode === "vsbot" && 
        gameData.phase === "placement" && 
        gameData.currentPlayer === 1) {
        setTimeout(() => activateBot(), 100);
    }
    if (gameData.gameMode === "vsbot" && gameData.currentPlayer === 1) {
        setTimeout(activateBot, 100);
    }
    return true;
}
// Нова функция за активиране на бота
function activateBot() {
    if (!game.bot) {
        game.bot = new BotController(gameData);
    }
    
    if (gameData.phase === "placement") {
        // Ако ботът все още няма столица
        if (!gameData.capitals[1]) {
            game.bot.placeCapital();
            // Проверяваме дали е поставена успешно
            if (gameData.capitals[1]) {
                setTimeout(activateBot, 100);
            }
            return;
        }
        
        // Поставяме единици докато не стигнем максимума
        if (gameData.playerUnits[1].length < gameData.maxUnits) {
            game.bot.placeUnitEvenly(); // <-- ТУК!
            setTimeout(activateBot, 100);
        } else {
            // Преминаваме към фазата на стрелките
            gameData.currentPlayer = 0;
            gameData.phase = "player1_arrows";
            readyBtn.classList.remove('hidden');
        }
    } 
    else if (gameData.phase === "player2_arrows") {
        game.bot.handleArrowPhase();
        setTimeout(() => {
            gameData.phase = "battle";
            readyBtn.classList.add('hidden');
            calculateBattle();
        }, 500);
    }
}
function handleArrowSelection(pos, button) {
    let [x, y] = pos;
    
    // Проверяваме дали имаме вече избрана единица
    if (gameData.selectedUnit) {
        handleArrowDirection(pos, button);
        return true;
    }
    
    // Търсим единица под курсора
    for (let unit of gameData.playerUnits[gameData.currentPlayer]) {
        if (Math.sqrt((unit.x - x)**2 + (unit.y - y)**2) <= UNIT_RADIUS) {
            gameData.selectedUnit = unit;
            return true;
        }
    }
    return false;
}
function resetSelection() {
    gameData.selectionStart = null;
    gameData.selectionEnd = null;
    gameData.selectedUnits = [];
    gameData.selectedUnit = null;
}
// Обработка на посока на стрелка
function handleArrowDirection(pos, button) {
    if (!gameData.selectedUnit) return false;

    let [x, y] = pos;
    let dx = x - gameData.selectedUnit.x;
    let dy = y - gameData.selectedUnit.y;

    if (button === 2) {  // Десен бутон - синя стрелка (права)
        gameData.selectedUnit.blueArrow = [x, y];
        gameData.selectedUnit.direction = null;
    } else {  // Ляв бутон - черна стрелка
        gameData.selectedUnit.direction = Math.atan2(dy, dx);
        gameData.selectedUnit.blueArrow = null;
    }

    gameData.selectedUnit = null;
    return true;
}

// Проверка дали движението е към собствената територия
function isMovementTowardOwnTerritory(player, newX, newY) {
    // Проверяваме дали новата позиция е в територията на играча
    return isInOwnTerritory(player, newX, newY);
}
// Изчисляване на средна посока между две единици
function calculateAverageDirection(unit1, unit2) {
    if (unit1.direction === null && unit2.direction === null) {
        return null;
    }
    
    if (unit1.direction === null) return unit2.direction;
    if (unit2.direction === null) return unit1.direction;
    
    let x1 = Math.cos(unit1.direction);
    let y1 = Math.sin(unit1.direction);
    let x2 = Math.cos(unit2.direction);
    let y2 = Math.sin(unit2.direction);
    
    let avgX = (x1 + x2) / 2;
    let avgY = (y1 + y2) / 2;
    
    let length = Math.sqrt(avgX**2 + avgY**2);
    if (length > 0.001) {
        avgX /= length;
        avgY /= length;
    }
    
    return Math.atan2(avgY, avgX);
}

// Проверка и избутване на единици твърде близо до фронта
function checkUnitsDistanceFromFront() {
    const scale = getUnitScale();
    let minDistance = (gameData.ww2CapitalsLocked ? 2.5 : 1.5) * UNIT_RADIUS * scale;
    for (let player of [0, 1]) {
        for (let unit of gameData.playerUnits[player]) {
            // Не избутвай, ако вече е избутван или се движи
            if (unit.beingPushed || unit.isMoving) continue;

            let closestPoint = null;
            let closestDist = Infinity;
            for (let point of gameData.frontLine) {
                let dist = Math.sqrt((unit.x - point[0])**2 + (unit.y - point[1])**2);
                if (dist < closestDist) {
                    closestDist = dist;
                    closestPoint = point;
                }
            }
            // Ако е твърде близо, избутай така че да е точно на minDistance
            if (closestDist < minDistance && closestPoint) {
                let pushDirX = unit.x - closestPoint[0];
                let pushDirY = unit.y - closestPoint[1];
                let pushLen = Math.sqrt(pushDirX**2 + pushDirY**2);
                if (pushLen > 0.001) {
                    pushDirX /= pushLen;
                    pushDirY /= pushLen;
                } else {
                    // Ако е точно върху фронта, избутай надясно/наляво според играча
                    pushDirX = player === 0 ? -1 : 1;
                    pushDirY = 0;
                }
                // Use special push distance for WW2 map
                let pushDistance = minDistance - closestDist + 1; // +1 за сигурност
                unit.beingPushed = true;
                unit.prevX = unit.x;
                unit.pushTargetX = unit.x + pushDirX * pushDistance;
                unit.pushTargetY = unit.y + pushDirY * pushDistance;
                unit.pushProgress = 0;
            }
        }
    }
}

function checkAndPushUnits(pointIdx, newPoint, direction, pushingPlayer) {
    const scale = getUnitScale();
    let [px, py] = gameData.frontLine[pointIdx];
    let [newPx, newPy] = newPoint;
    let opponent = 1 - pushingPlayer;
    // Use special distance for WW2 map
    let minPushDistance = (gameData.ww2CapitalsLocked ? 2.5 : 1.5) * UNIT_RADIUS * scale;
    for (let unit of gameData.playerUnits[opponent]) {
        let dist = Math.sqrt((unit.x - newPx)**2 + (unit.y - newPy)**2);
        if (dist < minPushDistance) {
            let pushDistance = minPushDistance - dist;
            let pushDirX = Math.cos(direction);
            let pushDirY = Math.sin(direction);
            unit.beingPushed = true;
            unit.prevX = unit.x;
            unit.pushTargetX = unit.x + pushDirX * pushDistance;
            unit.pushTargetY = unit.y + pushDirY * pushDistance;
            unit.pushProgress = 0;
        }
    }
}

// Откриване и премахване на примки във фронтовата линия
function detectAndRemoveLoops() {
    if (gameData.frontLine.length < 3) return;
    
    const TOLERANCE = 10; // Пиксели за идентифициране на затворени примки
    let foundLoop = true;
    
    // Повтаряме докато не премахнем всички примки
    while (foundLoop) {
        foundLoop = false;
        const n = gameData.frontLine.length;
        
        // 1. Проверка за пресичащи се сегменти
        for (let i = 0; i < n - 1; i++) {
            for (let j = i + 2; j < n - 1; j++) {
                const A = gameData.frontLine[i];
                const B = gameData.frontLine[i + 1];
                const C = gameData.frontLine[j];
                const D = gameData.frontLine[j + 1];
                
                if (doSegmentsIntersect(A, B, C, D)) {
                    // Премахваме точките между пресичащите се сегменти
                    const pointsToRemove = gameData.frontLine.slice(i + 1, j + 1);
                    gameData.frontLine = [
                        ...gameData.frontLine.slice(0, i + 1),
                        ...gameData.frontLine.slice(j + 1)
                    ];
                    removeUnitsInLoop([A, ...pointsToRemove, D]);
                    foundLoop = true;
                    break;
                }
            }
            if (foundLoop) break;
        }
        if (foundLoop) continue;
        
        // 2. Проверка за затворени примки (точки на малко разстояние)
        for (let i = 0; i < n - 2; i++) {
            for (let j = i + 2; j < n; j++) {
                const p1 = gameData.frontLine[i];
                const p2 = gameData.frontLine[j];
                const dx = p1[0] - p2[0];
                const dy = p1[1] - p2[1];
                const dist = Math.sqrt(dx * dx + dy * dy);
                
                if (dist < TOLERANCE) {
                    // Премахваме точките между затворената примка
                    const pointsToRemove = gameData.frontLine.slice(i + 1, j);
                    gameData.frontLine = [
                        ...gameData.frontLine.slice(0, i + 1),
                        ...gameData.frontLine.slice(j)
                    ];
                    removeUnitsInLoop([p1, ...pointsToRemove, p2]);
                    foundLoop = true;
                    break;
                }
            }
            if (foundLoop) break;
        }
        if (foundLoop) continue;
        
        // 3. Проверка за извивки със сменена посока
        for (let i = 1; i < n - 2; i++) {
            const p0 = gameData.frontLine[i - 1];
            const p1 = gameData.frontLine[i];
            const p2 = gameData.frontLine[i + 1];
            const p3 = gameData.frontLine[i + 2];
            
            // Изчисляваме ъгъла на завъртане
            const angle1 = Math.atan2(p1[1] - p0[1], p1[0] - p0[0]);
            const angle2 = Math.atan2(p2[1] - p1[1], p2[0] - p1[0]);
            const angle3 = Math.atan2(p3[1] - p2[1], p3[0] - p2[0]);
            
            // Разлика в ъглите показва рязко изменение
            const diff1 = Math.abs(angle1 - angle2);
            const diff2 = Math.abs(angle2 - angle3);
            
            if (diff1 > Math.PI/2 && diff2 > Math.PI/2) {
                // Премахваме средните точки на извивката
                gameData.frontLine.splice(i, 2);
                removeUnitsInLoop([p0, p1, p2, p3]);
                foundLoop = true;
                break;
            }
        }
    }
}

// Помощна функция за проверка на пресичане на сегменти
function doSegmentsIntersect(A, B, C, D) {
    function ccw(p1, p2, p3) {
        return (p3[1]-p1[1])*(p2[0]-p1[0]) > (p2[1]-p1[1])*(p3[0]-p1[0]);
    }
    return ccw(A, C, D) !== ccw(B, C, D) && ccw(A, B, C) !== ccw(A, B, D);
}
function drawSelectedUnits() {
    if (gameData.selectedUnits.length === 0) return;
    
    // Рисуване на свързващи линии към центъра на селекцията
    if (gameData.selectionStart && gameData.selectionEnd) {
        const minX = Math.min(gameData.selectionStart[0], gameData.selectionEnd[0]);
        const maxX = Math.max(gameData.selectionStart[0], gameData.selectionEnd[0]);
        const minY = Math.min(gameData.selectionStart[1], gameData.selectionEnd[1]);
        const maxY = Math.max(gameData.selectionStart[1], gameData.selectionEnd[1]);
        
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        
        ctx.beginPath();
        for (const unit of gameData.selectedUnits) {
            ctx.moveTo(unit.x, unit.y);
            ctx.lineTo(centerX, centerY);
        }
        ctx.strokeStyle = "rgba(0, 255, 0, 0.3)";
        ctx.lineWidth = 1;
        ctx.stroke();
    }
}
// Премахване на единици вътре в примка
function removeUnitsInLoop(loopPoints) {
    if (loopPoints.length < 3) return;
    
    // Създаваме затворен полигон
    const polygon = [...loopPoints, loopPoints[0]];
    
    for (let player of [0, 1]) {
        gameData.playerUnits[player] = gameData.playerUnits[player].filter(unit => {
            // Проверяваме дали единицата е в примката
            const inside = pointInPolygon([unit.x, unit.y], polygon);
            
            // Ако единицата е в примката, премахваме я
            return !inside;
        });
    }
}
// Проверка дали точка е вътре в полигон
function pointInPolygon(point, polygon) {
    let [x, y] = point;
    let n = polygon.length;
    let inside = false;
    let xinters;
    
    let [p1x, p1y] = polygon[0];
    for (let i = 1; i <= n; i++) {
        let [p2x, p2y] = polygon[i % n];
        if (y > Math.min(p1y, p2y)) {
            if (y <= Math.max(p1y, p2y)) {
                if (x <= Math.max(p1x, p2x)) {
                    if (p1y !== p2y) {
                        xinters = (y-p1y)*(p2x-p1x)/(p2y-p1y)+p1x;
                    }
                    if (p1x === p2x || x <= xinters) {
                        inside = !inside;
                    }
                }
            }
        }
        [p1x, p1y] = [p2x, p2y];
    }
    
    return inside;
}

// --- MOBILE FRIENDLY: Add viewport meta if not present ---
(function ensureMobileViewport() {
    if (!document.querySelector('meta[name="viewport"]')) {
        const meta = document.createElement('meta');
        meta.name = "viewport";
        meta.content = "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no";
        document.head.appendChild(meta);
    }
})();

// --- MOBILE FRIENDLY: Add basic responsive CSS ---
(function ensureMobileCSS() {
    const style = document.createElement('style');
    style.textContent = `
        html, body {
            touch-action: none;
            overscroll-behavior: contain;
            margin: 0; padding: 0; height: 100%; width: 100vw; box-sizing: border-box;
        }
        #game-canvas {
            width: 100vw !important;
            height: 60vw !important;
            max-width: 100vw;
            max-height: 80vh;
            display: block;
            touch-action: none;
            background: #f0f0f0;
        }
        #game-info, #ready-btn, #settings-modal {
            font-size: 1.1em;
            max-width: 100vw;
            word-break: break-word;
        }
        #settings-modal {
            width: 95vw;
            left: 2vw;
            right: 2vw;
        }
        button, input, select {
            font-size: 1.1em;
        }
    `;
    document.head.appendChild(style);
})();

// --- MOBILE FRIENDLY: Touch support for canvas ---
// Tap = left click, long tap = right click, drag = pan, pinch = zoom
(function enableMobileCanvas() {
    let lastTouch = null;
    let touchStartTime = 0;
    let longTapTimeout = null;
    let pinchStartDist = null;
    let pinchStartScale = null;
    let pinchStartOffset = null;

    function getTouchPos(e) {
        const rect = canvas.getBoundingClientRect();
        if (e.touches && e.touches.length > 0) {
            return [
                (e.touches[0].clientX - rect.left),
                (e.touches[0].clientY - rect.top)
            ];
        }
        return [0, 0];
    }

    canvas.addEventListener('touchstart', function(e) {
        if (e.touches.length === 1) {
            lastTouch = getTouchPos(e);
            touchStartTime = Date.now();
            // Long tap for right click
            longTapTimeout = setTimeout(() => {
                const evt = new MouseEvent('mousedown', {
                    clientX: e.touches[0].clientX,
                    clientY: e.touches[0].clientY,
                    button: 2
                });
                canvas.dispatchEvent(evt);
                longTapTimeout = null;
            }, 500);
        } else if (e.touches.length === 2) {
            // Pinch start
            pinchStartDist = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            pinchStartScale = window.view ? window.view.scale : 1;
            pinchStartOffset = window.view ? [window.view.offsetX, window.view.offsetY] : [0, 0];
            if (longTapTimeout) clearTimeout(longTapTimeout);
        }
    }, { passive: false });

    canvas.addEventListener('touchmove', function(e) {
        if (e.touches.length === 1 && lastTouch) {
            // Drag to pan
            if (window.view) {
                let dx = e.touches[0].clientX - (lastTouch[0] + canvas.getBoundingClientRect().left);
                let dy = e.touches[0].clientY - (lastTouch[1] + canvas.getBoundingClientRect().top);
                window.view.offsetX += dx;
                window.view.offsetY += dy;
                lastTouch = getTouchPos(e);
            }
            if (longTapTimeout) clearTimeout(longTapTimeout);
            e.preventDefault();
        } else if (e.touches.length === 2 && pinchStartDist && window.view) {
            // Pinch to zoom
            let dist = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            let scale = pinchStartScale * (dist / pinchStartDist);
            scale = Math.max(window.view.minScale || 1, Math.min(window.view.maxScale || 4, scale));
            window.view.scale = scale;
            // Optionally, keep center under fingers
            window.view.offsetX = pinchStartOffset[0];
            window.view.offsetY = pinchStartOffset[1];
            e.preventDefault();
        }
    }, { passive: false });

    canvas.addEventListener('touchend', function(e) {
        if (longTapTimeout) {
            clearTimeout(longTapTimeout);
            longTapTimeout = null;
        }
        if (e.touches.length === 0 && lastTouch) {
            // Tap = left click
            if (Date.now() - touchStartTime < 400) {
                const evt = new MouseEvent('mousedown', {
                    clientX: lastTouch[0] + canvas.getBoundingClientRect().left,
                    clientY: lastTouch[1] + canvas.getBoundingClientRect().top,
                    button: 0
                });
                canvas.dispatchEvent(evt);
                setTimeout(() => {
                    const upEvt = new MouseEvent('mouseup', {
                        clientX: lastTouch[0] + canvas.getBoundingClientRect().left,
                        clientY: lastTouch[1] + canvas.getBoundingClientRect().top,
                        button: 0
                    });
                    canvas.dispatchEvent(upEvt);
                }, 10);
            }
            lastTouch = null;
        }
        pinchStartDist = null;
        pinchStartScale = null;
        pinchStartOffset = null;
    }, { passive: false });
})();

window.gameData = gameData;
window.game = game;
window.canvas = canvas;
window.ctx = ctx;