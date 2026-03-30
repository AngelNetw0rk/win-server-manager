// ==UserScript==
// @name         Universal WebGL Fly Cam (Noclip)
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Свободная камера (полет) для WebGL игр. Управление: WASD + Пробел/Shift + Мышь.
// @author       You
// @match        *://*/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // Конфигурация
    const CONFIG = {
        speed: 10,          // Базовая скорость
        boostMultiplier: 3, // Множитель скорости при зажатом Shift
        sensitivity: 0.002  // Чувствительность мыши
    };

    let isActive = false;
    let camera = null;
    let originalCameraPos = null;
    let velocity = { x: 0, y: 0, z: 0 };
    let euler = { x: 0, y: 0 }; // Углы Эйлера для вращения
    let keys = {};
    let isMouseDown = false;
    let lastMouseX = 0;
    let lastMouseY = 0;

    // Поиск камеры в сцене (поддержка Three.js и Babylon.js)
    function findCamera() {
        // Three.js
        if (window.THREE) {
            const scenes = [];
            window.THREE.Scene.prototype.traverse = function(callback) {
                // Патч для поиска сцен, если они есть в глобальной области
            };
            
            // Попытка найти сцену через глобальные переменные или рендерер
            for (let key in window) {
                try {
                    const obj = window[key];
                    if (obj && obj.isScene) {
                        obj.traverse((child) => {
                            if (child.isCamera) {
                                camera = { 
                                    type: 'three', 
                                    obj: child, 
                                    scene: obj 
                                };
                                return true;
                            }
                        });
                        if (camera) break;
                    }
                    if (obj && obj.isWebGLRenderer && obj.domElement) {
                        // Если нашли рендерер, попробуем найти камеру контекстно
                        // Часто камера хранится в переменной сцены
                    }
                } catch (e) {}
            }
            
            // Альтернативный поиск через глобальные переменные
            if (!camera) {
                const commonNames = ['camera', 'cam', 'mainCamera', 'activeCamera'];
                for (let name of commonNames) {
                    if (window[name] && window[name].isCamera) {
                        camera = { type: 'three', obj: window[name], scene: null };
                        break;
                    }
                }
            }
        }

        // Babylon.js
        if (!camera && window.BABYLON) {
            const commonNames = ['camera', 'cam', 'mainCamera', 'activeCamera'];
            for (let name of commonNames) {
                if (window[name] && window[name].getForwardRay) {
                    camera = { type: 'babylon', obj: window[name], scene: window[name].getScene() };
                    break;
                }
            }
        }

        return camera;
    }

    // Обновление позиции камеры
    function updateCamera(deltaTime) {
        if (!camera || !isActive) return;

        const moveSpeed = CONFIG.speed * (keys['ShiftLeft'] || keys['ShiftRight'] ? CONFIG.boostMultiplier : 1);
        const camObj = camera.obj;

        // Вращение мышью
        if (isMouseDown) {
            euler.y -= (lastMouseX - window.lastMouseX) * CONFIG.sensitivity;
            euler.x -= (lastMouseY - window.lastMouseY) * CONFIG.sensitivity;
            euler.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, euler.x));
            
            if (camera.type === 'three') {
                camObj.rotation.order = 'YXZ';
                camObj.rotation.y = euler.y;
                camObj.rotation.x = euler.x;
            } else if (camera.type === 'babylon') {
                camObj.alpha = euler.y;
                camObj.beta = euler.x + Math.PI / 2;
            }
        }

        // Движение
        let dx = 0, dy = 0, dz = 0;
        if (keys['KeyW']) dz = -1;
        if (keys['KeyS']) dz = 1;
        if (keys['KeyA']) dx = -1;
        if (keys['KeyD']) dx = 1;
        if (keys['Space']) dy = 1;
        if (keys['ControlLeft'] || keys['KeyC']) dy = -1;

        if (dx !== 0 || dy !== 0 || dz !== 0) {
            const direction = new Vector3(dx, dy, dz);
            
            if (camera.type === 'three') {
                // Получаем направление взгляда
                const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camObj.quaternion);
                const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camObj.quaternion);
                const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camObj.quaternion);

                const moveVec = new THREE.Vector3();
                if (dz !== 0) moveVec.add(forward.multiplyScalar(-dz));
                if (dx !== 0) moveVec.add(right.multiplyScalar(dx));
                if (dy !== 0) moveVec.add(up.multiplyScalar(dy));
                
                moveVec.normalize().multiplyScalar(moveSpeed * deltaTime);
                camObj.position.add(moveVec);
            } else if (camera.type === 'babylon') {
                // Babylon logic
                const forward = camObj.getForwardRay().direction;
                const right = camObj.getRightRay().direction;
                const up = BABYLON.Vector3.Up();

                let moveVec = BABYLON.Vector3.Zero();
                if (dz !== 0) moveVec = moveVec.add(forward.scale(-dz));
                if (dx !== 0) moveVec = moveVec.add(right.scale(dx));
                if (dy !== 0) moveVec = moveVec.add(up.scale(dy));
                
                moveVec.normalize().scaleInPlace(moveSpeed * deltaTime);
                camObj.position.addInPlace(moveVec);
            }
        }
        
        window.lastMouseX = lastMouseX;
        window.lastMouseY = lastMouseY;
    }

    // Вспомогательный класс Vector3 для универсальности
    class Vector3 {
        constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
        add(v) { this.x += v.x; this.y += v.y; this.z += v.z; return this; }
        multiplyScalar(s) { this.x *= s; this.y *= s; this.z *= s; return this; }
        normalize() {
            const len = Math.sqrt(this.x*this.x + this.y*this.y + this.z*this.z);
            if (len > 0) { this.x /= len; this.y /= len; this.z /= len; }
            return this;
        }
    }

    // Обработчики событий
    function onKeyDown(e) {
        keys[e.code] = true;
        if (e.code === 'KeyF') toggleFlyMode();
    }

    function onKeyUp(e) {
        keys[e.code] = false;
    }

    function onMouseDown(e) {
        if (isActive && e.button === 0) {
            isMouseDown = true;
            lastMouseX = e.clientX;
            lastMouseY = e.clientY;
            document.body.style.cursor = 'none';
        }
    }

    function onMouseUp() {
        isMouseDown = false;
        document.body.style.cursor = '';
    }

    function onMouseMove(e) {
        if (isMouseDown) {
            lastMouseX = e.clientX;
            lastMouseY = e.clientY;
        }
    }

    function toggleFlyMode() {
        isActive = !isActive;
        
        if (isActive) {
            if (!findCamera()) {
                alert('Камера не найдена! Убедитесь, что игра использует Three.js или Babylon.js');
                isActive = false;
                return;
            }
            
            originalCameraPos = {
                x: camera.obj.position.x,
                y: camera.obj.position.y,
                z: camera.obj.position.z
            };
            
            // Инициализация углов из текущей ориентации камеры
            if (camera.type === 'three') {
                euler.y = camera.obj.rotation.y;
                euler.x = camera.obj.rotation.x;
            }
            
            console.log('✈️ Режим полета АКТИВИРОВАН. F - выкл, ЛКМ - обзор, WASD - движение, Пробел/Ctrl - вверх/вниз');
        } else {
            if (originalCameraPos && camera) {
                camera.obj.position.set(originalCameraPos.x, originalCameraPos.y, originalCameraPos.z);
            }
            console.log('🛑 Режим полета ДЕАКТИВИРОВАН');
        }
    }

    // Запуск цикла обновления
    function init() {
        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);
        window.addEventListener('mousedown', onMouseDown);
        window.addEventListener('mouseup', onMouseUp);
        window.addEventListener('mousemove', onMouseMove);

        // Цикл анимации
        let lastTime = performance.now();
        function loop() {
            const now = performance.now();
            const deltaTime = (now - lastTime) / 1000;
            lastTime = now;
            
            updateCamera(deltaTime);
            requestAnimationFrame(loop);
        }
        loop();
        
        console.log('🚀 Скрипт полета загружен. Нажмите F для активации.');
    }

    // Ждем загрузки страницы
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
