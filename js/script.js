"use strict"

const startButton = document.querySelector('.btn');
let flag = true;

startButton.addEventListener('click', () => {
    const game = new SeeBattle('gameArea');
    game.run();

    if (flag) {
        game.startNewGame();
    }
});


(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD: import SeeBattle from "sea-battle";
        define(['sea-battle'], factory);
    } else {
        // globals: window.SeeBattle
        root.SeeBattle = factory();
    }
}
(typeof self !== 'undefined' ? self : this, function () {

    function SeeBattle(gameAreaId) {
        this.gameFieldBorderX = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
        this.gameFieldBorderY = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
        this.gameArea = document.getElementById(gameAreaId);
        this.gameArea.innerHTML = "";
        this.shipsConfiguration = [{
                maxShips: 1,
                pointCount: 4
            },
            {
                maxShips: 2,
                pointCount: 3
            },
            {
                maxShips: 3,
                pointCount: 2
            },
            {
                maxShips: 4,
                pointCount: 1
            }
        ];
        this.userName = null;
        this.pcName = null;
        this.pcDelay = 800;

        this._hitsForWin = 0;
        for (let i = 0; i < this.shipsConfiguration.length; i++) {
            this._hitsForWin = +this._hitsForWin + (this.shipsConfiguration[i].maxShips * this.shipsConfiguration[i].pointCount);
        }

        this._pcShipsMap = null;
        this._userShipsMap = null;
        this._gameStopped = false;

        this.CELL_WITH_SHIP = 1;
        this.CELL_EMPTY = 0;

        //  * Html элементы

        this.pcInfo = null;
        this.userInfo = null;
        this.toolbar = null;
        this.startGameButton = null;
        this.pcGameField = null;
        this.userGameField = null;
    }

    SeeBattle.prototype = {

        //  Вызывает функции, которые вставляют базовую html разметку
        //  нужную для игры

        run() {
            this.createToolbar();
            this.createGameFields();
            this.createFooter();
        },
        createToolbar() {
            this.toolbar = document.createElement('div');
            this.toolbar.setAttribute('class', 'toolbar');
            this.gameArea.appendChild(this.toolbar);
        },
        createGameFields() {
            let pcGameArea = document.createElement('div');
            pcGameArea.setAttribute('class', 'pcGameArea');
            this.gameArea.appendChild(pcGameArea);

            let userGameArea = document.createElement('div');
            userGameArea.setAttribute('class', 'userGameArea');
            this.gameArea.appendChild(userGameArea);

            this.pcInfo = document.createElement('div');
            pcGameArea.appendChild(this.pcInfo);

            this.userInfo = document.createElement('div');
            userGameArea.appendChild(this.userInfo);

            this.pcGameField = document.createElement('div');
            this.pcGameField.setAttribute('class', 'gameField');
            this.userGameField = document.createElement('div');
            this.userGameField.setAttribute('class', 'gameField');
            pcGameArea.appendChild(this.pcGameField);
            userGameArea.appendChild(this.userGameField);
        },
        createFooter() {
            let footer = document.createElement('div');
            footer.setAttribute('class', 'footer');

            this.startGameButton = document.createElement('button');
            this.startGameButton.innerHTML = 'Начать игру';
            this.startGameButton.setAttribute('class', 'btn');
            this.startGameButton.onclick = function () {
                this.startNewGame();
            }.bind(this);
            footer.appendChild(this.startGameButton);

            this.gameArea.appendChild(footer);
        },
        startNewGame() {
            this.userName = this.userName || prompt('Ваше имя?', '');
            this.pcName = this.pcName || prompt('Имя противника', '');

            if (!this.userName || !this.pcName) {
                alert('Неверно указали имя');
                return;
            }

            this.startGameButton.innerHTML = 'Начать заново...';
            this.pcInfo.innerHTML = this.pcName + ' (ваш противник)';
            this.userInfo.innerHTML = this.userName + ' (ваше поле)';

            this._pcShipsMap = this.generateRandomShipMap();
            this._userShipsMap = this.generateRandomShipMap();
            this._pcShotMap = this.generateShotMap();
            this._userHits = 0;
            this._pcHits = 0;
            this._blockHeight = null;
            this._gameStopped = false;
            this._pcGoing = false;

            this.drawGamePoints();
            this.updateToolbar();
        },


        // Создание/обновление ячеей в игровых полях

        drawGamePoints() {
            for (let yPoint = 0; yPoint < this.gameFieldBorderY.length; yPoint++) {
                for (let xPoint = 0; xPoint < this.gameFieldBorderX.length; xPoint++) {
                    let pcPointBlock = this.getOrCreatePointBlock(yPoint, xPoint);
                    pcPointBlock.onclick = function (e) {
                        this.userFire(e);
                    }.bind(this);
                    // если нужно отобразить корабли компьютера
                    /*if(this._pcShipsMap[yPoint][xPoint] === this.CELL_WITH_SHIP){
                        pcPointBlock.setAttribute('class', 'ship');
                    }*/

                    let userPointBlock = this.getOrCreatePointBlock(yPoint, xPoint, 'user');
                    if (this._userShipsMap[yPoint][xPoint] === this.CELL_WITH_SHIP) {
                        userPointBlock.setAttribute('class', 'ship');
                    }
                }
            }
        },

        // Высота ячейки полученная из значения ширины

        _blockHeight: null,

        // Создает либо сбрасывает значения ячеек где размещаются корабли

        getOrCreatePointBlock(yPoint, xPoint, type) {
            let id = this.getPointBlockIdByCoords(yPoint, xPoint, type);
            let block = document.getElementById(id);
            if (block) {
                block.innerHTML = '';
                block.setAttribute('class', '');
            } else {
                block = document.createElement('div');
                block.setAttribute('id', id);
                block.setAttribute('data-x', xPoint);
                block.setAttribute('data-y', yPoint);
                if (type && type === 'user') {
                    this.userGameField.appendChild(block);
                } else {
                    this.pcGameField.appendChild(block);
                }
            }
            block.style.width = (100 / this.gameFieldBorderY.length) + '%';
            if (!this._blockHeight) {
                this._blockHeight = block.clientWidth;
            }
            block.style.height = this._blockHeight + 'px';
            block.style.lineHeight = this._blockHeight + 'px';
            block.style.fontSize = this._blockHeight + 'px';
            return block;
        },

        // Возвращает id игровой ячейки, генериремого на базе координат
        // и типа игрового поля

        getPointBlockIdByCoords(yPoint, xPoint, type) {
            if (type && type === 'user') {
                return 'user_x' + xPoint + '_y' + yPoint;
            }
            return 'pc_x' + xPoint + '_y' + yPoint;
        },

        // Создает масив с координатами полей, из которых компьютер
        // случайно выбирает координаты для обстрела

        generateShotMap() {
            let map = [];
            for (let yPoint = 0; yPoint < this.gameFieldBorderY.length; yPoint++) {
                for (let xPoint = 0; xPoint < this.gameFieldBorderX.length; xPoint++) {
                    map.push({
                        y: yPoint,
                        x: xPoint
                    });
                }
            }
            return map;
        },

        // Генерирует массив содержащий информацию о том есть или нет корабля

        generateRandomShipMap() {
            let map = [];
            // генерация карты расположения, вклчающей отрицательный координаты
            // для возможности размещения у границ
            for (let yPoint = -1; yPoint < (this.gameFieldBorderY.length + 1); yPoint++) {
                for (let xPoint = -1; xPoint < (this.gameFieldBorderX.length + 1); xPoint++) {
                    if (!map[yPoint]) {
                        map[yPoint] = [];
                    }
                    map[yPoint][xPoint] = this.CELL_EMPTY;
                }
            }

            // получение копии настроек кораблей для дальнейших манипуляций
            let shipsConfiguration = JSON.parse(JSON.stringify(this.shipsConfiguration));
            let allShipsPlaced = false;
            while (allShipsPlaced === false) {
                let xPoint = this.getRandomInt(0, this.gameFieldBorderX.length);
                let yPoint = this.getRandomInt(0, this.gameFieldBorderY.length);
                if (this.isPointFree(map, xPoint, yPoint) === true) {
                    if (this.canPutHorizontal(map, xPoint, yPoint, shipsConfiguration[0].pointCount, this.gameFieldBorderX.length)) {
                        for (let i = 0; i < shipsConfiguration[0].pointCount; i++) {
                            map[yPoint][xPoint + i] = this.CELL_WITH_SHIP;
                        }
                    } else if (this.canPutVertical(map, xPoint, yPoint, shipsConfiguration[0].pointCount, this.gameFieldBorderY.length)) {
                        for (let i = 0; i < shipsConfiguration[0].pointCount; i++) {
                            map[yPoint + i][xPoint] = this.CELL_WITH_SHIP;
                        }
                    } else {
                        continue;
                    }

                    // обоновление настроек кораблей, если цикл не был пропущен
                    // и корабль стало быть расставлен
                    shipsConfiguration[0].maxShips--;
                    if (shipsConfiguration[0].maxShips < 1) {
                        shipsConfiguration.splice(0, 1);
                    }
                    if (shipsConfiguration.length === 0) {
                        allShipsPlaced = true;
                    }
                }
            }
            return map;
        },

        getRandomInt(min, max) {
            return Math.floor(Math.random() * (max - min)) + min;
        },

        // Проверка, возможно ли разместить тут однопалубный корабль

        isPointFree(map, xPoint, yPoint) {
            // текущая и далее по часовй стрелке вокруг
            if (map[yPoint][xPoint] === this.CELL_EMPTY &&
                map[yPoint - 1][xPoint] === this.CELL_EMPTY &&
                map[yPoint - 1][xPoint + 1] === this.CELL_EMPTY &&
                map[yPoint][xPoint + 1] === this.CELL_EMPTY &&
                map[yPoint + 1][xPoint + 1] === this.CELL_EMPTY &&
                map[yPoint + 1][xPoint] === this.CELL_EMPTY &&
                map[yPoint + 1][xPoint - 1] === this.CELL_EMPTY &&
                map[yPoint][xPoint - 1] === this.CELL_EMPTY &&
                map[yPoint - 1][xPoint - 1] === this.CELL_EMPTY
            ) {
                return true;
            }
            return false;
        },

        // Возможно вставки корабля горизонтально

        canPutHorizontal(map, xPoint, yPoint, shipLength, coordLength) {
            let freePoints = 0;
            for (let x = xPoint; x < coordLength; x++) {
                // текущая и далее по часовй стрелке в гориз направл
                if (map[yPoint][x] === this.CELL_EMPTY &&
                    map[yPoint - 1][x] === this.CELL_EMPTY &&
                    map[yPoint - 1][x + 1] === this.CELL_EMPTY &&
                    map[yPoint][x + 1] === this.CELL_EMPTY &&
                    map[yPoint + 1][x + 1] === this.CELL_EMPTY &&
                    map[yPoint + 1][x] === this.CELL_EMPTY
                ) {
                    freePoints++;
                } else {
                    break;
                }
            }
            return freePoints >= shipLength;
        },

        // Возможно ли вставить корабль вертикально

        canPutVertical(map, xPoint, yPoint, shipLength, coordLength) {
            let freePoints = 0;
            for (let y = yPoint; y < coordLength; y++) {
                // текущая и далее по часовй стрелке в вертикальном направлении
                if (map[y][xPoint] === this.CELL_EMPTY &&
                    map[y + 1][xPoint] === this.CELL_EMPTY &&
                    map[y + 1][xPoint + 1] === this.CELL_EMPTY &&
                    map[y + 1][xPoint] === this.CELL_EMPTY &&
                    map[y][xPoint - 1] === this.CELL_EMPTY &&
                    map[y - 1][xPoint - 1] === this.CELL_EMPTY
                ) {
                    freePoints++;
                } else {
                    break;
                }
            }
            return freePoints >= shipLength;
        },

        // Обработчик клика по ячейке

        userFire(event) {
            if (this.isGameStopped() || this.isPCGoing()) {
                return;
            }
            let e = event || window.event;
            let firedEl = e.target || e.srcElement;
            let x = firedEl.getAttribute('data-x');
            let y = firedEl.getAttribute('data-y');
            if (this._pcShipsMap[y][x] === this.CELL_EMPTY) {
                firedEl.innerHTML = this.getFireFailTemplate();
                this.prepareToPcFire();
            } else {
                firedEl.innerHTML = this.getFireSuccessTemplate();
                firedEl.setAttribute('class', 'ship');
                this._userHits++;
                this.updateToolbar();
                if (this._userHits >= this._hitsForWin) {
                    this.stopGame();
                }
            }
            firedEl.onclick = null;
        },
        _pcGoing: false,
        isPCGoing() {
            return this._pcGoing;
        },

        // Создает задержку перед ходом компьютрера
        // необходимую, для того чтобы успеть увидеть чей ход

        prepareToPcFire() {
            this._pcGoing = true;
            this.updateToolbar();
            setTimeout(function () {
                this.pcFire();
            }.bind(this), this.pcDelay);
        },

        // Выстрел компьютера

        pcFire() {
            if (this.isGameStopped()) {
                return;
            }
            // берется случайный выстрел из сгенерированной ранее карты
            let randomShotIndex = this.getRandomInt(0, this._pcShotMap.length);
            let randomShot = JSON.parse(JSON.stringify(this._pcShotMap[randomShotIndex]));
            // удаление чтобы не было выстрелов повторных
            this._pcShotMap.splice(randomShotIndex, 1);

            let firedEl = document.getElementById(this.getPointBlockIdByCoords(randomShot.y, randomShot.x, 'user'));
            if (this._userShipsMap[randomShot.y][randomShot.x] === this.CELL_EMPTY) {
                firedEl.innerHTML = this.getFireFailTemplate();
            } else {
                firedEl.innerHTML = this.getFireSuccessTemplate();
                this._pcHits++;
                this.updateToolbar();
                if (this._pcHits >= this._hitsForWin) {
                    this.stopGame();
                } else {
                    this.prepareToPcFire();
                }
            }
            this._pcGoing = false;
            this.updateToolbar();
        },

        //Остановка игры
        
        stopGame() {
            this._gameStopped = true;
            this._pcGoing = false;
            this.startGameButton.innerHTML = 'Сыграть еще раз?';
            this.updateToolbar();
        },
        isGameStopped() {
            return this._gameStopped;
        },
        getFireSuccessTemplate() {
            return 'X';
        },
        getFireFailTemplate() {
            return '&#183;';
        },

        //Отображение текущей игровой ситуации в блоке

        updateToolbar() {
            this.toolbar.innerHTML = 'Счет - ' + this._pcHits + ':' + this._userHits;
            if (this.isGameStopped()) {
                if (this._userHits >= this._hitsForWin) {
                    this.toolbar.innerHTML += ', вы победили';
                } else {
                    this.toolbar.innerHTML += ', победил ваш противник';
                }
            } else if (this.isPCGoing()) {
                this.toolbar.innerHTML += ', ходит ваш противник';
            } else {
                this.toolbar.innerHTML += ', сейчас ваш ход';
            }
        },
    };

    return SeeBattle;
}));
