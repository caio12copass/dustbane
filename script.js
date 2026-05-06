// script.js
(function() {
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    const mCanvas = document.getElementById('miniMap');
    const mCtx = mCanvas.getContext('2d');
    canvas.width = 800; canvas.height = 600;
    mCanvas.width = 140; mCanvas.height = 140;

    // ---------- Variáveis Globais ----------
    let isGameOver = false, isPaused = false;
    let specialUsageCount = 0, totalKills = 0;
    let TOTAL_ROOMS = 5 + Math.floor(Math.random() * 8);
    let currentPos = { x: 0, y: 0 };
    let visitedRooms = new Set(["0,0"]);
    let clearedRooms = new Set();
    let roomGraph = new Map();
    let allRoomPositions = [];
    let gameTime = 0, shakeTime = 0;
    const globalRoomData = {};
    let bossRoomPosition = null, bossDefeated = false, bossWarningGiven = false, bossType = null;
    let particles = [], ambientDust = [], items = [], powerUpItems = [], bossTraps = [];
    let isSuperVacuumActive = false, superVacuumTimer = 0;
    let roomsExplored = 0; // Faltava essa variável!

    // ---------- Configuração dos Bosses ----------
    const bossTypesMap = {
        'acaro': { name: "ÁCARO GIGANTE", color: "#8B4513", sizeMult: 2.2, hp: 1800, speed: 1.8, flyer: false, special: "dash" },
        'tufo': { name: "TUFO GIGANTE", color: "#bc9a6c", sizeMult: 2.0, hp: 2000, speed: 1.0, flyer: false, special: "spawnMinions" },
        'esporo': { name: "ESPORO GIGANTE", color: "#4caf50", sizeMult: 2.0, hp: 1600, speed: 2.0, flyer: false, special: "explosiveShots" },
        'polen': { name: "PÓLEN GIGANTE", color: "#FFD700", sizeMult: 2.2, hp: 1500, speed: 2.5, flyer: true, special: "spiralShots" },
        'mofo': { name: "MOFO GIGANTE", color: "#6B3E1E", sizeMult: 2.0, hp: 1800, speed: 1.0, flyer: false, special: "spawnMobs" }
    };

    const availablePowerUps = {
        'laminas': { name: "⚔️ Lâmina Rotatória", effect: "blades" },
        'estatico': { name: "⚡ Raio Estático", effect: "splash" },
        'roomba': { name: "🤖 Roomba Assistente", effect: "roomba" },
        'escudo': { name: "🛡️ Escudo de Ar", effect: "shield" },
        'dash': { name: "💨 Dash Turbo", effect: "dash" },
        'ima': { name: "🧲 Ímã de Poeira", effect: "magnet" },
        'congelamento': { name: "❄️ Congelamento", effect: "freeze" }
    };
    let inventory = [], equippedItems = [];
    const MAX_EQUIPPED = 3;
    let lastDashTime = 0, roombaActive = null, bladesTimer = 0;

    const player = {
        x: 400, y: 300, size: 28, speed: 3.0, hp: 6, maxHp: 6,
        vx: 0, vy: 0, invincible: false, lastShot: 0, shotDelay: 250,
        isVacuuming: false, isMoving: false, walkCycle: 0,
        vacuumCharge: 0, maxVacuumCharge: 100
    };

    let enemies = [], bullets = [], enemyBullets = [];
    const keys = {}, mouse = { x: 0, y: 0 };
    let doors = [], ambientObjects = [], lightPoints = [];

    for(let i=0;i<40;i++) ambientDust.push({x:Math.random()*800, y:Math.random()*600, s:Math.random()*2+1});

    // ========== SISTEMA DE INVENTÁRIO ESTILO RESIDENT EVIL ==========
    const RE_GRID_COLS = 8;
    const RE_GRID_ROWS = 6;
    const RE_CELL_SIZE = 50;
    const RE_GRID_WIDTH = RE_GRID_COLS * RE_CELL_SIZE;
    const RE_GRID_HEIGHT = RE_GRID_ROWS * RE_CELL_SIZE;

    const reItemDefinitions = {
        'laminas': { name: "⚔️ Lâmina", effect: "blades", size: [2, 2], color: "#00FFFF" },
        'estatico': { name: "⚡ Estático", effect: "splash", size: [1, 2], color: "#FFFF00" },
        'roomba': { name: "🤖 Roomba", effect: "roomba", size: [2, 1], color: "#C0C0C0" },
        'escudo': { name: "🛡️ Escudo", effect: "shield", size: [2, 2], color: "#4488FF" },
        'dash': { name: "💨 Dash", effect: "dash", size: [1, 1], color: "#00FFAA" },
        'ima': { name: "🧲 Ímã", effect: "magnet", size: [1, 1], color: "#FF8888" },
        'congelamento': { name: "❄️ Gelo", effect: "freeze", size: [2, 2], color: "#88CCFF" }
    };

    let reGrid = Array(RE_GRID_ROWS).fill().map(() => Array(RE_GRID_COLS).fill(0));
    let rePlacedItems = [];
    let reDragging = null;
    let reMouseGridPos = { row: -1, col: -1 };
    let reLastClick = null;

    function initializeREInventory() {
        reGrid = Array(RE_GRID_ROWS).fill().map(() => Array(RE_GRID_COLS).fill(0));
        rePlacedItems = [];
        
        inventory.forEach((itemId) => {
            const def = reItemDefinitions[itemId];
            if (!def) return;
            
            let placed = false;
            for (let row = 0; row <= RE_GRID_ROWS - def.size[1] && !placed; row++) {
                for (let col = 0; col <= RE_GRID_COLS - def.size[0] && !placed; col++) {
                    if (canPlaceItem(row, col, def.size[0], def.size[1])) {
                        placeItem(itemId, row, col);
                        placed = true;
                    }
                }
            }
        });
    }

    function canPlaceItem(row, col, w, h, excludeId = null) {
        for (let r = row; r < row + h; r++) {
            for (let c = col; c < col + w; c++) {
                if (r >= RE_GRID_ROWS || c >= RE_GRID_COLS) return false;
                const cell = reGrid[r][c];
                if (cell !== 0 && cell !== excludeId) return false;
            }
        }
        return true;
    }

    function placeItem(itemId, row, col) {
        const def = reItemDefinitions[itemId];
        if (!def) return;
        
        rePlacedItems = rePlacedItems.filter(item => item.id !== itemId);
        reGrid = reGrid.map(row => row.map(cell => cell === itemId ? 0 : cell));
        
        for (let r = row; r < row + def.size[1]; r++) {
            for (let c = col; c < col + def.size[0]; c++) {
                reGrid[r][c] = itemId;
            }
        }
        
        rePlacedItems.push({ id: itemId, row, col });
    }

    function drawREInventory() {
        const reCanvas = document.getElementById('reInventoryCanvas');
        if (!reCanvas) return;
        reCanvas.width = RE_GRID_WIDTH;
        reCanvas.height = RE_GRID_HEIGHT;
        const ctxRE = reCanvas.getContext('2d');
        
        ctxRE.fillStyle = '#111';
        ctxRE.fillRect(0, 0, RE_GRID_WIDTH, RE_GRID_HEIGHT);
        
        ctxRE.strokeStyle = '#333';
        ctxRE.lineWidth = 1;
        for (let i = 0; i <= RE_GRID_COLS; i++) {
            ctxRE.beginPath();
            ctxRE.moveTo(i * RE_CELL_SIZE, 0);
            ctxRE.lineTo(i * RE_CELL_SIZE, RE_GRID_HEIGHT);
            ctxRE.stroke();
        }
        for (let i = 0; i <= RE_GRID_ROWS; i++) {
            ctxRE.beginPath();
            ctxRE.moveTo(0, i * RE_CELL_SIZE);
            ctxRE.lineTo(RE_GRID_WIDTH, i * RE_CELL_SIZE);
            ctxRE.stroke();
        }
        
        rePlacedItems.forEach(item => {
            const def = reItemDefinitions[item.id];
            if (!def) return;
            
            const x = item.col * RE_CELL_SIZE;
            const y = item.row * RE_CELL_SIZE;
            const w = def.size[0] * RE_CELL_SIZE;
            const h = def.size[1] * RE_CELL_SIZE;
            
            ctxRE.fillStyle = equippedItems.includes(item.id) ? '#2a2a1a' : '#1a1a1a';
            ctxRE.fillRect(x + 2, y + 2, w - 4, h - 4);
            
            ctxRE.strokeStyle = equippedItems.includes(item.id) ? '#FFD700' : def.color;
            ctxRE.lineWidth = equippedItems.includes(item.id) ? 3 : 2;
            ctxRE.strokeRect(x + 2, y + 2, w - 4, h - 4);
            
            if (equippedItems.includes(item.id)) {
                ctxRE.shadowColor = '#FFD700';
                ctxRE.shadowBlur = 15;
                ctxRE.strokeStyle = '#FFD700';
                ctxRE.strokeRect(x + 2, y + 2, w - 4, h - 4);
                ctxRE.shadowBlur = 0;
            }
            
            ctxRE.fillStyle = '#FFF';
            ctxRE.font = 'bold 11px Arial';
            ctxRE.textAlign = 'center';
            ctxRE.fillText(def.name, x + w/2, y + h/2 + 4);
            
            if (equippedItems.includes(item.id)) {
                ctxRE.fillStyle = '#FFD700';
                ctxRE.font = '10px Arial';
                ctxRE.fillText('✓', x + w - 12, y + 14);
            }
        });
        
        if (reDragging && reMouseGridPos.row >= 0 && reMouseGridPos.col >= 0) {
            const def = reItemDefinitions[reDragging.id];
            const w = def.size[0] * RE_CELL_SIZE;
            const h = def.size[1] * RE_CELL_SIZE;
            const x = reMouseGridPos.col * RE_CELL_SIZE;
            const y = reMouseGridPos.row * RE_CELL_SIZE;
            
            ctxRE.fillStyle = canPlaceItem(reMouseGridPos.row, reMouseGridPos.col, def.size[0], def.size[1], reDragging.id) 
                ? 'rgba(0, 255, 255, 0.3)' 
                : 'rgba(255, 0, 0, 0.3)';
            ctxRE.fillRect(x, y, w, h);
            ctxRE.strokeStyle = '#FFF';
            ctxRE.lineWidth = 2;
            ctxRE.strokeRect(x, y, w, h);
        }
    }

    function toggleREInventory() {
        const overlay = document.getElementById('re-inventory');
        if (!overlay) return;
        
        if (overlay.style.display === 'flex') {
            overlay.style.display = 'none';
            isPaused = false;
        } else {
            if (isGameOver) return;
            initializeREInventory();
            drawREInventory();
            updateREEquippedInfo();
            overlay.style.display = 'flex';
            isPaused = true;
        }
    }

    function updateREEquippedInfo() {
        const info = document.getElementById('re-equipped-info');
        if (info) {
            info.textContent = `⚔️ Equipados: ${equippedItems.length}/${MAX_EQUIPPED}`;
        }
    }

    // Setup dos eventos do canvas RE
    function setupREInventoryEvents() {
        const reCanvas = document.getElementById('reInventoryCanvas');
        if (!reCanvas) return;
        
        reCanvas.addEventListener('mousedown', (e) => {
            const rect = reCanvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const col = Math.floor(x / RE_CELL_SIZE);
            const row = Math.floor(y / RE_CELL_SIZE);
            
            if (row < 0 || row >= RE_GRID_ROWS || col < 0 || col >= RE_GRID_COLS) return;
            
            const cellId = reGrid[row][col];
            if (cellId !== 0) {
                const item = rePlacedItems.find(i => i.id === cellId);
                if (item) {
                    const now = Date.now();
                    if (reLastClick && reLastClick.id === cellId && now - reLastClick.time < 300) {
                        equipItem(cellId);
                        drawREInventory();
                        updateREEquippedInfo();
                    } else {
                        reDragging = {
                            id: cellId,
                            startRow: item.row,
                            startCol: item.col,
                            size: reItemDefinitions[cellId].size,
                            offsetX: x - item.col * RE_CELL_SIZE,
                            offsetY: y - item.row * RE_CELL_SIZE
                        };
                    }
                    reLastClick = { id: cellId, time: now };
                }
            }
        });
        
        reCanvas.addEventListener('mousemove', (e) => {
            if (!reDragging) return;
            
            const rect = reCanvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const col = Math.floor((x - reDragging.offsetX) / RE_CELL_SIZE);
            const row = Math.floor((y - reDragging.offsetY) / RE_CELL_SIZE);
            
            const newPos = {
                row: Math.max(0, Math.min(RE_GRID_ROWS - reDragging.size[1], row)),
                col: Math.max(0, Math.min(RE_GRID_COLS - reDragging.size[0], col))
            };
            
            if (newPos.row !== reMouseGridPos.row || newPos.col !== reMouseGridPos.col) {
                reMouseGridPos = newPos;
                drawREInventory();
            }
        });
        
        reCanvas.addEventListener('mouseup', () => {
            if (reDragging && reMouseGridPos.row >= 0 && reMouseGridPos.col >= 0) {
                if (canPlaceItem(reMouseGridPos.row, reMouseGridPos.col, reDragging.size[0], reDragging.size[1], reDragging.id)) {
                    placeItem(reDragging.id, reMouseGridPos.row, reMouseGridPos.col);
                }
            }
            reDragging = null;
            reMouseGridPos = { row: -1, col: -1 };
            drawREInventory();
        });
        
        reCanvas.addEventListener('mouseleave', () => {
            reDragging = null;
            reMouseGridPos = { row: -1, col: -1 };
            drawREInventory();
        });
    }

    // ---------- Funções Auxiliares (original) ----------
    function generateRoomLayout() {
        roomGraph.clear(); allRoomPositions = [];
        allRoomPositions.push({x:0,y:0});
        roomGraph.set("0,0", { neighbors: [], isBossRoom: false });
        const dirs = [[0,-1],[0,1],[-1,0],[1,0]];
        let attempts = 0;
        while(allRoomPositions.length < TOTAL_ROOMS && attempts < 200) {
            const idx = Math.floor(Math.random() * allRoomPositions.length);
            const cur = allRoomPositions[idx];
            const shuffled = [...dirs];
            for(let i=shuffled.length-1;i>0;i--) { let j=Math.floor(Math.random()*(i+1)); [shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]]; }
            let added = false;
            for(let d of shuffled) {
                let nx = cur.x + d[0], ny = cur.y + d[1];
                let key = `${nx},${ny}`;
                if(!roomGraph.has(key) && allRoomPositions.length < TOTAL_ROOMS) {
                    let tooFar = false;
                    for(let r of allRoomPositions) if(Math.abs(r.x-nx)>3 || Math.abs(r.y-ny)>3) { tooFar=true; break; }
                    if(!tooFar) {
                        roomGraph.set(key, { neighbors: [], isBossRoom: false });
                        roomGraph.get(`${cur.x},${cur.y}`).neighbors.push(key);
                        roomGraph.get(key).neighbors.push(`${cur.x},${cur.y}`);
                        allRoomPositions.push({x:nx,y:ny});
                        added = true;
                        break;
                    }
                }
            }
            attempts++;
        }
        const nonStart = allRoomPositions.filter(p => !(p.x===0 && p.y===0));
        const bossRoom = nonStart[Math.floor(Math.random() * nonStart.length)];
        bossRoomPosition = { x: bossRoom.x, y: bossRoom.y };
        roomGraph.get(`${bossRoom.x},${bossRoom.y}`).isBossRoom = true;
    }

    function shouldHaveDoor(direction) {
        let tx = currentPos.x, ty = currentPos.y;
        if(direction==='top') ty--; else if(direction==='bottom') ty++; else if(direction==='left') tx--; else if(direction==='right') tx++;
        const targetKey = `${tx},${ty}`;
        const curInfo = roomGraph.get(`${currentPos.x},${currentPos.y}`);
        return curInfo && curInfo.neighbors.includes(targetKey);
    }

    function showNotification(text) {
        let div = document.createElement('div');
        div.className = 'item-notification';
        div.textContent = text;
        document.body.appendChild(div);
        setTimeout(()=>div.remove(),2000);
    }

    function spawnPowerUpItem(x,y,id) { powerUpItems.push({x,y,type:'powerup',powerUpId:id,size:20}); }
    function collectPowerUp(item) {
        if(!inventory.includes(item.powerUpId)) {
            inventory.push(item.powerUpId);
            showNotification(`📦 ${availablePowerUps[item.powerUpId].name} ADICIONADO!`);
            updateInventoryUI();
        } else showNotification(`⚠️ Você já possui este item!`);
    }

    function equipItem(id) {
        if(equippedItems.includes(id)) {
            let idx = equippedItems.indexOf(id);
            equippedItems.splice(idx,1);
            showNotification(`❌ ${availablePowerUps[id].name} REMOVIDO!`);
            if(id==='roomba') roombaActive = null;
        } else if(equippedItems.length < MAX_EQUIPPED) {
            equippedItems.push(id);
            showNotification(`🔧 EQUIPADO: ${availablePowerUps[id].name} (${equippedItems.length}/${MAX_EQUIPPED})`);
            if(id==='roomba' && !roombaActive) spawnRoomba();
        } else showNotification(`⚠️ Máximo de ${MAX_EQUIPPED} itens equipados!`);
        updateInventoryUI(); updateUI(); updateBuildCounter();
        updateREEquippedInfo();
    }

    function isItemEquipped(effect) { return equippedItems.some(i=>availablePowerUps[i]?.effect===effect); }
    function openInventory() { if(!isGameOver && !isPaused){ isPaused=true; updateInventoryUI(); document.getElementById('inventory-menu').style.display='flex';} }
    function closeInventory() { isPaused=false; document.getElementById('inventory-menu').style.display='none'; }
    function updateInventoryUI() {
        let container = document.getElementById('inventory-slots');
        if(!container) return;
        container.innerHTML = '';
        if(inventory.length===0) container.innerHTML='<p style="color:#888;">Nenhum item. Explore as salas!</p>';
        else inventory.forEach(id=>{
            let item = availablePowerUps[id];
            let slot = document.createElement('div');
            slot.className = 'inventory-slot';
            if(equippedItems.includes(id)) slot.classList.add('equipped');
            slot.innerHTML = `<b>${item.name}</b><br><small>${item.desc||''}</small>`;
            slot.onclick = ()=>equipItem(id);
            container.appendChild(slot);
        });
    }

    function spawnRoomba() {
        if(roombaActive) return;
        roombaActive = { x:player.x, y:player.y, size:20, hp:30, maxHp:30, vx:0, vy:0, lastShot:0 };
    }
    function updateRoomba() {
        if(!roombaActive) return;
        let closest=null, closestDist=Infinity;
        for(let en of enemies){
            if(en.isBoss) continue;
            let dx = roombaActive.x - (en.x+en.size/2);
            let dy = roombaActive.y - (en.y+en.size/2);
            let d = dx*dx+dy*dy;
            if(d < closestDist){ closestDist=d; closest=en; }
        }
        if(closest) {
            let dx = closest.x+closest.size/2 - roombaActive.x;
            let dy = closest.y+closest.size/2 - roombaActive.y;
            let len = Math.sqrt(dx*dx+dy*dy);
            if(len>0.01){
                roombaActive.vx += (dx/len)*0.5;
                roombaActive.vy += (dy/len)*0.5;
            }
        }
        roombaActive.vx*=0.9; roombaActive.vy*=0.9;
        roombaActive.x+=roombaActive.vx; roombaActive.y+=roombaActive.vy;
        roombaActive.x=Math.max(10,Math.min(790,roombaActive.x)); roombaActive.y=Math.max(10,Math.min(590,roombaActive.y));
        for(let en of enemies){
            let dx = roombaActive.x - (en.x+en.size/2);
            let dy = roombaActive.y - (en.y+en.size/2);
            if(dx*dx+dy*dy < 900 && Date.now()-roombaActive.lastShot>500){
                en.hp-=5; roombaActive.lastShot=Date.now(); createParticles(roombaActive.x,roombaActive.y,"#0FF",5);
            }
        }
        if(roombaActive.hp<=0) roombaActive=null;
    }
    function drawRoomba() {
        if(!roombaActive) return;
        ctx.save(); ctx.translate(roombaActive.x,roombaActive.y);
        ctx.fillStyle="#C0C0C0"; ctx.beginPath(); ctx.arc(0,0,12,0,Math.PI*2); ctx.fill();
        ctx.fillStyle="#333"; ctx.beginPath(); ctx.arc(-4,-3,2,0,Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(4,-3,2,0,Math.PI*2); ctx.fill();
        ctx.fillStyle="#0FF"; ctx.font="10px Arial"; ctx.fillText("🤖",-6,5);
        ctx.fillStyle="red"; ctx.fillRect(-10,-12,20,3); ctx.fillStyle="#0f0"; ctx.fillRect(-10,-12,20*(roombaActive.hp/roombaActive.maxHp),3);
        ctx.restore();
    }

    function updateKillCounter() { document.getElementById('kill-counter').innerHTML = `💀 INIMIGOS: ${totalKills}`; }
    function escolherBossAleatorio() { return ['acaro','tufo','esporo','polen','mofo'][Math.floor(Math.random()*5)]; }
    function checkBossProximity() {
        if(bossDefeated || !bossRoomPosition) return false;
        if(currentPos.x===bossRoomPosition.x && currentPos.y===bossRoomPosition.y){ return true; }
        const adj = [[1,0],[-1,0],[0,1],[0,-1]];
        const isNear = adj.some(([dx,dy])=> (currentPos.x+dx===bossRoomPosition.x && currentPos.y+dy===bossRoomPosition.y));
        if(isNear && !bossWarningGiven){ document.getElementById('boss-warning').style.display='block'; bossWarningGiven=true; setTimeout(()=>{ if(!bossDefeated) document.getElementById('boss-warning').style.display='none'; },3000); }
        else if(!isNear){ document.getElementById('boss-warning').style.display='none'; bossWarningGiven=false; }
        return false;
    }
    function togglePause() { if(!isGameOver){ isPaused=!isPaused; document.getElementById('pause-menu').style.display=isPaused?'flex':'none'; } }
    function createParticles(x,y,color,count=8,speed=4){ for(let i=0;i<count;i++) particles.push({x,y, vx:(Math.random()-0.5)*speed, vy:(Math.random()-0.5)*speed, life:1, color, size:Math.random()*4+2}); }
    function spawnItem(x,y,isMimic){ if(Math.random()<0.25 && !isMimic) items.push({x,y,type:'heal',size:15}); }
    function getRoomData(key) {
        if(globalRoomData[key]) return globalRoomData[key];
        let obs=[], isCarpet=false, ambientObj=[], lights=[];
        const isBoss = bossRoomPosition && parseInt(key.split(',')[0])===bossRoomPosition.x && parseInt(key.split(',')[1])===bossRoomPosition.y;
        if(key!=="0,0"){
            isCarpet = Math.random()<0.3;
            let numObs = isBoss?4:5+Math.floor(Math.random()*3);
            for(let i=0;i<numObs;i++){
                let ox = Math.floor(2+Math.random()*16)*40, oy = Math.floor(2+Math.random()*10)*40;
                if(!((ox>300&&ox<500)||(oy>200&&oy<400))) obs.push({x:ox,y:oy,w:40,h:40});
            }
            if(Math.random()<0.2 && !isBoss){
                let fanX=100+Math.random()*600, fanY=100+Math.random()*400, fanDir=['up','down','left','right'][Math.floor(Math.random()*4)];
                ambientObj.push({x:fanX,y:fanY,type:'fan',direction:fanDir,active:false,cooldown:0,radius:120});
            }
            let numLights = isBoss?5:2+Math.floor(Math.random()*3);
            for(let i=0;i<numLights;i++) lights.push({x:50+Math.random()*700,y:50+Math.random()*500,radius:isBoss?100:60+Math.random()*40,intensity:isBoss?0.3:0.15+Math.random()*0.15,color:isBoss?"rgba(255,50,50,0.35)":`rgba(255,200,100,${0.15+Math.random()*0.15})`});
        } else {
            lights.push({x:400,y:300,radius:120,intensity:0.3,color:"rgba(255,215,0,0.3)"});
            lights.push({x:200,y:200,radius:80,intensity:0.25,color:"rgba(255,165,0,0.25)"},{x:600,y:400,radius:80,intensity:0.25,color:"rgba(255,165,0,0.25)"});
        }
        globalRoomData[key] = { obstacles:obs, isCarpet, ambientObjects:ambientObj, lightPoints:lights, isBossRoom:isBoss };
        return globalRoomData[key];
    }
    function checkCollision(x,y,s,obs){ for(let o of obs) if(x < o.x+o.w && x+s > o.x && y < o.y+o.h && y+s > o.y) return true; return false; }

    function spawnEnemy(x, y, type, isBoss=false) {
        if(isBoss && bossType) {
            const b = bossTypesMap[bossType];
            const size = Math.floor(70 * b.sizeMult);
            enemies.push({
                type:'boss', baseType:bossType, color:b.color, size:size, speed:b.speed,
                hp:b.hp, maxHp:b.hp, isBoss:true, flyer:b.flyer, special:b.special,
                vx:0, vy:0, flash:0, slow:0, trapCooldown:0, attackTimer:0,
                x:x, y:y
            });
            return;
        }
        const types = {
            'acaro':{color:"#5d4037",size:30,speed:2.2,hp:40,flyer:false,spawner:false,mimic:false},
            'tufo':{color:"#9e9e9e",size:45,speed:1.0,hp:80,flyer:false,spawner:false,mimic:false},
            'esporo':{color:"#81c784",size:25,speed:2.8,hp:30,explode:true,flyer:false,spawner:false,mimic:false},
            'esporo_mini': {color:"#81c784",size:18,speed:3.0,hp:15,explode:false,flyer:false,spawner:false,mimic:false},
            'polen':{color:"#FFD700",size:22,speed:3.5,hp:35,flyer:true,flyHeight:0,flySpeed:0.05,flyerOffset:0},
            'mofo':{color:"#8B4513",size:40,speed:0,hp:60,spawner:true,spawnTimer:0,spawnDelay:300},
            'mimic':{color:"#ff4444",size:28,speed:4,hp:50,mimic:true,revealed:false}
        };
        let t = types[type];
        let extra = {};
        if(type==='polen') extra={flyHeight:0,flyerOffset:Math.random()*Math.PI*2};
        if(type==='mofo') extra={spawnTimer:0,spawnDelay:300};
        if(type==='mimic') extra={revealed:false};
        enemies.push({...t,...extra, type, x, y, vx:0, vy:0, flash:0, slow:0});
    }

    function generateRoom(direction) {
        const posKey = `${currentPos.x},${currentPos.y}`;
        enemies = []; bullets = []; enemyBullets = []; items = []; particles = []; powerUpItems = []; bossTraps = [];
        const roomData = getRoomData(posKey);
        ambientObjects = roomData.ambientObjects ? [...roomData.ambientObjects] : [];
        lightPoints = roomData.lightPoints ? [...roomData.lightPoints] : [];
        if(direction==='top') player.y=520; if(direction==='bottom') player.y=60; if(direction==='left') player.x=720; if(direction==='right') player.x=60;
        const isBossRoom = roomData.isBossRoom;
        if(isBossRoom && !bossDefeated && !clearedRooms.has(posKey)) {
            const b = bossTypesMap[bossType];
            const size = Math.floor(70 * b.sizeMult);
            const startX = canvas.width/2 - size/2;
            const startY = canvas.height/2 - size/2;
            spawnEnemy(startX, startY, 'boss', true);
            document.getElementById('room-info').innerHTML = `⚠️ ${bossTypesMap[bossType].name} ⚠️`;
            document.getElementById('room-info').style.color = "#f44";
            createParticles(canvas.width/2,canvas.height/2,"#f00",50,10);
        }
        else if(posKey!=="0,0" && !clearedRooms.has(posKey) && !isBossRoom) {
            let num = 2 + Math.floor(roomsExplored/5) + Math.floor(specialUsageCount*0.5);
            num = Math.min(num,6);
            for(let i=0;i<num;i++) {
                let ex, ey, tries=0;
                do { ex=100+Math.random()*600; ey=100+Math.random()*400; tries++; } while(tries<50 && (Math.hypot(ex-player.x,ey-player.y)<150 || checkCollision(ex,ey,30,roomData.obstacles)));
                let typesList = ['acaro','tufo','esporo','polen','mofo'];
                let eType = typesList[Math.floor(Math.random()*typesList.length)];
                spawnEnemy(ex, ey, eType, false);
            }
            if(Math.random()<0.3 && powerUpItems.length===0){
                let ids = Object.keys(availablePowerUps);
                let rnd = ids[Math.floor(Math.random()*ids.length)];
                if(!inventory.includes(rnd)) spawnPowerUpItem(canvas.width/2,canvas.height/2,rnd);
            }
        }
        updateUI(); updateDoors();
    }

    function updateDoors() {
        doors = [];
        if(shouldHaveDoor('top')) doors.push({dir:'top', x:350, y:0, w:100, h:20});
        if(shouldHaveDoor('bottom')) doors.push({dir:'bottom', x:350, y:580, w:100, h:20});
        if(shouldHaveDoor('left')) doors.push({dir:'left', x:0, y:250, w:20, h:100});
        if(shouldHaveDoor('right')) doors.push({dir:'right', x:780, y:250, w:20, h:100});
    }

    function updateUI() {
        let hearts = "";
        let tmp = player.hp;
        for(let i=0;i<player.maxHp/2;i++){
            if(tmp>=2) hearts+="❤️";
            else if(tmp===1) hearts+="💔";
            else hearts+="🖤";
            tmp-=2;
        }
        document.getElementById('hearts').innerHTML = hearts || "💀";
        if(bossRoomPosition && currentPos.x===bossRoomPosition.x && currentPos.y===bossRoomPosition.y && !bossDefeated)
            document.getElementById('room-info').innerHTML = `⚠️ ${bossTypesMap[bossType].name} ⚠️`;
        else document.getElementById('room-info').innerHTML = `SALA ATUAL`;
        document.getElementById('room-counter').innerHTML = `🚪 SALAS: ${visitedRooms.size}/${TOTAL_ROOMS}`;
        let fill = document.getElementById('special-fill');
        fill.style.width = (player.vacuumCharge/player.maxVacuumCharge)*100 + "%";
        fill.style.background = player.vacuumCharge>=player.maxVacuumCharge?"#F0F":"#0FF";
        if(equippedItems.length){
            let txt = equippedItems.map(id=>availablePowerUps[id].name.split(' ')[0]).join(' | ');
            document.getElementById('equipped-item').innerHTML = `🔧 EQUIPADOS: ${txt}`;
        } else document.getElementById('equipped-item').innerHTML = `🔧 NENHUM ITEM EQUIPADO`;

        // Minimapa
        mCtx.clearRect(0,0,140,140); mCtx.fillStyle="#0a0a0a"; mCtx.fillRect(0,0,140,140);
        let minX=0,maxX=0,minY=0,maxY=0;
        allRoomPositions.forEach(p=>{ minX=Math.min(minX,p.x); maxX=Math.max(maxX,p.x); minY=Math.min(minY,p.y); maxY=Math.max(maxY,p.y); });
        let rangeX = Math.max(1,maxX-minX), rangeY = Math.max(1,maxY-minY);
        let cellSize = Math.min(140/(rangeX+2), 140/(rangeY+2));
        let offX = (140-(rangeX+2)*cellSize)/2, offY = (140-(rangeY+2)*cellSize)/2;
        mCtx.strokeStyle="rgba(0,255,255,0.3)"; mCtx.strokeRect(0,0,140,140);
        allRoomPositions.forEach(p=>{
            let cx = offX + (p.x-minX+0.5)*cellSize, cy = offY + (p.y-minY+0.5)*cellSize;
            let hc = cellSize/2;
            if(bossRoomPosition && p.x===bossRoomPosition.x && p.y===bossRoomPosition.y && !bossDefeated){
                mCtx.fillStyle="#F00"; mCtx.fillRect(cx-hc+1, cy-hc+1, cellSize-2, cellSize-2);
                mCtx.fillStyle="#FFF"; mCtx.font=`${Math.max(8,Math.floor(cellSize*0.7))}px Arial`;
                mCtx.fillText("💀", cx-hc+3, cy+hc-3);
            } else if(p.x===currentPos.x && p.y===currentPos.y){
                mCtx.fillStyle="#0FF"; mCtx.fillRect(cx-hc+1, cy-hc+1, cellSize-2, cellSize-2);
            } else if(clearedRooms.has(`${p.x},${p.y}`)){
                mCtx.fillStyle="#2a2a2a"; mCtx.fillRect(cx-hc+1, cy-hc+1, cellSize-2, cellSize-2);
            } else if(visitedRooms.has(`${p.x},${p.y}`)){
                mCtx.fillStyle="#444"; mCtx.fillRect(cx-hc+1, cy-hc+1, cellSize-2, cellSize-2);
            }
            let neigh = roomGraph.get(`${p.x},${p.y}`)?.neighbors || [];
            for(let nk of neigh){
                let [nx,ny]=nk.split(',').map(Number);
                let np = allRoomPositions.find(r=>r.x===nx && r.y===ny);
                if(np && (nx>p.x || (nx===p.x && ny>p.y))){
                    let nx2 = offX + (np.x-minX+0.5)*cellSize, ny2 = offY + (np.y-minY+0.5)*cellSize;
                    mCtx.beginPath(); mCtx.moveTo(cx,cy); mCtx.lineTo(nx2,ny2); mCtx.strokeStyle="rgba(0,255,255,0.3)"; mCtx.lineWidth=1.5; mCtx.stroke();
                }
            }
        });
    }

    function victory(){
        if(isGameOver) return;
        isGameOver=true; isPaused=true;
        ctx.fillStyle="rgba(0,0,0,0.9)"; ctx.fillRect(0,0,800,600);
        ctx.fillStyle="gold"; ctx.textAlign="center"; ctx.font="36px Courier New";
        ctx.fillText("VITÓRIA!",400,250);
        ctx.font="18px Courier New";
        ctx.fillText(`Você derrotou o ${bossTypesMap[bossType].name}!`,400,310);
        ctx.fillText(`Salas exploradas: ${visitedRooms.size}/${TOTAL_ROOMS}`,400,350);
        ctx.fillText("Clique para jogar novamente",400,420);
    }

    function checkAllRoomsCleared(){
        let all= true;
        for(let p of allRoomPositions){
            let key = `${p.x},${p.y}`;
            if(bossRoomPosition && p.x===bossRoomPosition.x && p.y===bossRoomPosition.y && !bossDefeated) continue;
            if(!clearedRooms.has(key)){ all=false; break; }
        }
        if(all && !bossDefeated){
            let div=document.createElement('div'); div.className='item-notification'; div.style.color="#f44";
            div.innerHTML="💀 VÁ PARA A SALA COM A CAVEIRA! 💀"; document.body.appendChild(div); setTimeout(()=>div.remove(),3000);
        }
    }

    // ---------- Desenhos (drawBoss, drawCommonEnemy) ----------
    function drawBoss(en){
        const half = en.size/2;
        ctx.save();
        ctx.translate(en.x+half, en.y+half);
        if(en.flash>0) ctx.filter="brightness(5)";
        if(en.slow>0) { ctx.shadowBlur=5; ctx.shadowColor="#0FF"; }
        switch(en.baseType){
            case 'acaro':
                ctx.strokeStyle = en.color; ctx.lineWidth = half*0.15;
                for(let i=0;i<8;i++){
                    let a = (i*Math.PI/4) + Math.sin(gameTime*5+i)*0.4;
                    let legLen = half*1.2;
                    ctx.beginPath(); ctx.moveTo(0,0);
                    ctx.lineTo(Math.cos(a)*(legLen*0.6), Math.sin(a)*(legLen*0.6));
                    ctx.lineTo(Math.cos(a+0.3)*legLen, Math.sin(a+0.3)*legLen);
                    ctx.stroke();
                }
                ctx.fillStyle = en.color;
                ctx.beginPath(); ctx.ellipse(0,0, half*0.8, half*0.6, 0, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = "#F00";
                ctx.beginPath(); ctx.arc(-half*0.3, -half*0.2, half*0.15, 0, 2*Math.PI); ctx.fill();
                ctx.beginPath(); ctx.arc(half*0.3, -half*0.2, half*0.15, 0, 2*Math.PI); ctx.fill();
                ctx.fillStyle = "#FFF";
                ctx.beginPath(); ctx.arc(-half*0.35, -half*0.25, half*0.05, 0, 2*Math.PI); ctx.fill();
                ctx.beginPath(); ctx.arc(half*0.25, -half*0.25, half*0.05, 0, 2*Math.PI); ctx.fill();
                break;
            case 'tufo':
                ctx.fillStyle = en.color;
                let breath = Math.sin(gameTime*3)*0.1;
                for(let i=0;i<6;i++){
                    let angle = i*Math.PI*2/6;
                    let dist = half*0.5*(1+breath);
                    let rad = half*0.6;
                    ctx.beginPath(); ctx.arc(Math.cos(angle)*dist, Math.sin(angle)*dist, rad, 0, 2*Math.PI); ctx.fill();
                }
                ctx.beginPath(); ctx.arc(0,0, half*0.7, 0, 2*Math.PI); ctx.fill();
                ctx.fillStyle = "#654321";
                for(let i=0;i<3;i++){ ctx.beginPath(); ctx.arc(-half*0.4 + i*half*0.4, half*0.2, half*0.1, 0, 2*Math.PI); ctx.fill(); }
                break;
            case 'esporo':
                ctx.fillStyle = en.color; ctx.strokeStyle = en.color; ctx.lineWidth = half*0.1;
                let spike = Math.sin(gameTime*8)*0.2;
                for(let i=0;i<12;i++){
                    let angle = i*Math.PI*2/12 + gameTime*0.5;
                    let len = half*(0.8+spike);
                    ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(Math.cos(angle)*len, Math.sin(angle)*len); ctx.stroke();
                    ctx.beginPath(); ctx.arc(Math.cos(angle)*len, Math.sin(angle)*len, half*0.1, 0, 2*Math.PI); ctx.fill();
                }
                ctx.beginPath(); ctx.arc(0,0, half*0.6, 0, 2*Math.PI); ctx.fill();
                break;
            case 'polen':
                ctx.fillStyle = en.color; ctx.shadowBlur=8; ctx.shadowColor="#FFD700";
                for(let i=0;i<12;i++){
                    let ang = i*Math.PI*2/12 + gameTime*2;
                    let rad = half*0.6;
                    ctx.beginPath(); ctx.arc(Math.cos(ang)*rad, Math.sin(ang)*rad, half*0.2, 0, 2*Math.PI); ctx.fill();
                }
                ctx.beginPath(); ctx.arc(0,0, half*0.7, 0, 2*Math.PI); ctx.fill();
                ctx.fillStyle = "rgba(255,255,200,0.3)";
                ctx.beginPath(); ctx.ellipse(-half*0.8, -half*0.3, half*0.5, half*0.3, -0.5, 0, 2*Math.PI); ctx.fill();
                ctx.beginPath(); ctx.ellipse(half*0.8, -half*0.3, half*0.5, half*0.3, 0.5, 0, 2*Math.PI); ctx.fill();
                break;
            case 'mofo':
                ctx.fillStyle = en.color; ctx.fillRect(-half, -half, en.size, en.size);
                ctx.fillStyle = "#654321";
                for(let i=0;i<12;i++){
                    let x = -half + (i%4)*(half*0.6);
                    let y = -half + Math.floor(i/4)*(half*0.6);
                    ctx.beginPath(); ctx.arc(x, y, half*0.15, 0, 2*Math.PI); ctx.fill();
                }
                ctx.strokeStyle = "rgba(139,69,19,0.5)"; ctx.lineWidth = half*0.1;
                ctx.beginPath(); ctx.arc(0,0, half+5+Math.sin(gameTime*10)*2, 0, 2*Math.PI); ctx.stroke();
                break;
        }
        ctx.restore();
    }

    function drawCommonEnemy(en){
        const half = en.size/2;
        ctx.save(); ctx.translate(en.x+half, en.y+half);
        if(en.flash>0) ctx.filter="brightness(5)";
        if(en.type==='polen'){
            ctx.fillStyle = en.color; ctx.shadowBlur=8; ctx.shadowColor="#FFD700";
            for(let i=0;i<12;i++){ let a = i*Math.PI*2/12+gameTime*2; let r=half*0.6; ctx.beginPath(); ctx.arc(Math.cos(a)*r,Math.sin(a)*r, half*0.2,0,2*Math.PI); ctx.fill(); }
            ctx.beginPath(); ctx.arc(0,0, half*0.7,0,2*Math.PI); ctx.fill();
            ctx.fillStyle="rgba(255,255,200,0.3)";
            ctx.beginPath(); ctx.ellipse(-half*0.8,-half*0.3, half*0.5,half*0.3,-0.5,0,2*Math.PI); ctx.fill();
            ctx.beginPath(); ctx.ellipse(half*0.8,-half*0.3, half*0.5,half*0.3,0.5,0,2*Math.PI); ctx.fill();
        } else if(en.type==='mofo'){
            ctx.fillStyle=en.color; ctx.fillRect(-half,-half,en.size,en.size);
            ctx.fillStyle="#654321";
            for(let i=0;i<8;i++){ let x=-half+(i%4)*(half*0.8), y=-half+Math.floor(i/4)*(half*0.8); ctx.beginPath(); ctx.arc(x,y, half*0.2,0,2*Math.PI); ctx.fill(); }
            ctx.strokeStyle="rgba(139,69,19,0.5)"; ctx.lineWidth=3; ctx.beginPath(); ctx.arc(0,0, half+5+Math.sin(gameTime*10)*2,0,2*Math.PI); ctx.stroke();
        } else if(en.type==='mimic'){
            ctx.fillStyle="#8B0000"; ctx.beginPath(); ctx.ellipse(0,0, half, half,0,0,2*Math.PI); ctx.fill();
            ctx.fillStyle="#F00"; ctx.beginPath(); ctx.ellipse(-half*0.3,-half*0.2, half*0.2,half*0.3,0,0,2*Math.PI); ctx.fill();
            ctx.beginPath(); ctx.ellipse(half*0.3,-half*0.2, half*0.2,half*0.3,0,0,2*Math.PI); ctx.fill();
            ctx.fillStyle="#FFF"; ctx.beginPath(); ctx.arc(-half*0.3,-half*0.25,2,0,2*Math.PI); ctx.fill(); ctx.beginPath(); ctx.arc(half*0.3,-half*0.25,2,0,2*Math.PI); ctx.fill();
            for(let i=-1;i<=1;i++){ ctx.beginPath(); ctx.moveTo(i*8,5); ctx.lineTo(i*8+4,12); ctx.lineTo(i*8-4,12); ctx.fill(); }
        } else if(en.type==='acaro'){
            ctx.strokeStyle=en.color; ctx.lineWidth=Math.max(2,en.size*0.1);
            for(let i=0;i<8;i++){ let a=i*Math.PI/4+Math.sin(gameTime*5+i)*0.4; let legLen=half*1.2; ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(Math.cos(a)*(legLen*0.6),Math.sin(a)*(legLen*0.6)); ctx.lineTo(Math.cos(a+0.3)*legLen,Math.sin(a+0.3)*legLen); ctx.stroke(); }
            ctx.fillStyle=en.color; ctx.beginPath(); ctx.ellipse(0,0, half*0.8, half*0.6,0,0,2*Math.PI); ctx.fill();
        } else if(en.type==='tufo'){
            ctx.fillStyle=en.color; let breath=Math.sin(gameTime*3)*0.1;
            for(let i=0;i<6;i++){ let a=i*Math.PI*2/6; let d=half*0.5*(1+breath); let r=half*0.6; ctx.beginPath(); ctx.arc(Math.cos(a)*d,Math.sin(a)*d, r,0,2*Math.PI); ctx.fill(); }
            ctx.beginPath(); ctx.arc(0,0, half*0.7,0,2*Math.PI); ctx.fill();
        } else if(en.type==='esporo' || en.type==='esporo_mini'){
            ctx.fillStyle=en.color; ctx.strokeStyle=en.color; ctx.lineWidth=2;
            let spike=Math.sin(gameTime*8)*0.2;
            for(let i=0;i<8;i++){ let a=i*Math.PI*2/8+gameTime*0.5; let len=half*(0.8+spike); ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(Math.cos(a)*len,Math.sin(a)*len); ctx.stroke(); ctx.beginPath(); ctx.arc(Math.cos(a)*len,Math.sin(a)*len, half*0.15,0,2*Math.PI); ctx.fill(); }
            ctx.beginPath(); ctx.arc(0,0, half*0.5,0,2*Math.PI); ctx.fill();
        }
        ctx.restore();
    }

    // ---------- LOOP PRINCIPAL OTIMIZADO (update) ----------
    function update() {
        if(isGameOver || isPaused) return;
        gameTime+=0.05; if(shakeTime>0) shakeTime--;

        player.isMoving = keys['KeyW']||keys['KeyS']||keys['KeyA']||keys['KeyD'];
        player.walkCycle = player.isMoving ? player.walkCycle+0.25 : player.walkCycle*0.8;
        for(let d of ambientDust){ d.y+=0.2; d.x+=Math.sin(gameTime+d.y*0.01)*0.2; if(d.y>600) d.y=-10; }
        if(superVacuumTimer>0){ superVacuumTimer--; player.isVacuuming=true; if(superVacuumTimer===0) isSuperVacuumActive=false; }
        else player.isVacuuming=false;

        const roomData = getRoomData(`${currentPos.x},${currentPos.y}`);
        let mx=0,my=0;
        if(keys['KeyW']) my-=player.speed;
        if(keys['KeyS']) my+=player.speed;
        if(keys['KeyA']) mx-=player.speed;
        if(keys['KeyD']) mx+=player.speed;
        player.vx*=0.85; player.vy*=0.85;
        let fx=player.x+mx+player.vx, fy=player.y+my+player.vy;
        if(!checkCollision(player.x, fy, player.size, roomData.obstacles)) player.y = Math.max(0,Math.min(600-player.size,fy));
        if(!checkCollision(fx, player.y, player.size, roomData.obstacles)) player.x = Math.max(0,Math.min(800-player.size,fx));

        for(let i=0;i<powerUpItems.length;i++){
            let pu=powerUpItems[i];
            let dx=player.x+14-pu.x, dy=player.y+14-pu.y;
            if(dx*dx+dy*dy<900){
                collectPowerUp(pu); createParticles(pu.x,pu.y,"#FFD700",15,4);
                powerUpItems.splice(i,1); i--;
            }
        }
        for(let i=0;i<items.length;i++){
            let it=items[i];
            let dx=player.x+14-it.x, dy=player.y+14-it.y;
            if(dx*dx+dy*dy<900){
                if(it.isMimic && !it.revealed){ createParticles(it.x,it.y,"#f00",20,5); spawnEnemy(it.x,it.y,'mimic',false); items.splice(i,1); i--; }
                else if(!it.isMimic){ player.hp=Math.min(player.maxHp,player.hp+2); updateUI(); createParticles(it.x,it.y,"#f44",10); items.splice(i,1); i--; }
            }
        }
        for(let i=0;i<particles.length;i++){ let p=particles[i]; p.x+=p.vx; p.y+=p.vy; p.life-=0.02; if(p.life<=0){ particles.splice(i,1); i--; } }
        if(isItemEquipped('magnet') && Math.random()<0.02) player.vacuumCharge = Math.min(player.maxVacuumCharge, player.vacuumCharge+1);

        for(let obj of ambientObjects){
            if(obj.type==='fan'){
                if(obj.cooldown>0) obj.cooldown--;
                if(obj.active && obj.cooldown>0){
                    let dx=0,dy=0, force=8;
                    if(obj.direction==='up') dy=-force; else if(obj.direction==='down') dy=force; else if(obj.direction==='left') dx=-force; else if(obj.direction==='right') dx=force;
                    let pdx=player.x+14-obj.x, pdy=player.y+14-obj.y;
                    if(pdx*pdx+pdy*pdy<obj.radius*obj.radius){ player.vx+=dx*0.5; player.vy+=dy*0.5; }
                    for(let en of enemies){
                        let edx=en.x+en.size/2-obj.x, edy=en.y+en.size/2-obj.y;
                        if(edx*edx+edy*edy<obj.radius*obj.radius){ en.vx+=dx; en.vy+=dy; }
                    }
                }
            }
        }

        if(isItemEquipped('blades')){
            bladesTimer++;
            if(bladesTimer>10){
                bladesTimer=0;
                for(let en of enemies){
                    let dx=player.x+14-(en.x+en.size/2), dy=player.y+14-(en.y+en.size/2);
                    if(dx*dx+dy*dy<4900){
                        en.hp-=3; en.flash=2; createParticles(en.x+en.size/2, en.y+en.size/2,"#0FF",2);
                    }
                }
            }
        }

        for(let i=0;i<bossTraps.length;i++){
            let t=bossTraps[i];
            t.life--;
            if(t.life<=0){ bossTraps.splice(i,1); i--; continue; }
            let dx=player.x+14-t.x, dy=player.y+14-t.y;
            if(dx*dx+dy*dy<625 && !player.invincible){
                player.hp--; updateUI(); player.invincible=true; shakeTime=10;
                setTimeout(()=>player.invincible=false,500);
                createParticles(t.x,t.y,"#f60",10);
            }
        }

        for(let en of enemies){
            const enCX = en.x+en.size/2, enCY = en.y+en.size/2;
            let dxp = player.x+14-enCX, dyp = player.y+14-enCY;
            const distSq = dxp*dxp + dyp*dyp;
            if(en.flash>0) en.flash--;
            if(en.slow>0) en.slow--;
            let eSpeed = en.slow>0 ? en.speed*0.3 : en.speed;

            if(en.isBoss){
                let ang = Math.atan2(dyp, dxp);
                let newX = en.x + Math.cos(ang)*eSpeed;
                let newY = en.y + Math.sin(ang)*eSpeed;
                newX = Math.max(10, Math.min(canvas.width-en.size-10, newX));
                newY = Math.max(10, Math.min(canvas.height-en.size-10, newY));
                en.x = newX; en.y = newY;
                if(en.attackTimer<=0){
                    en.attackTimer = 120;
                    switch(en.special){
                        case 'dash':
                            let a2 = Math.atan2(dyp, dxp);
                            let dashX = en.x + Math.cos(a2)*150;
                            let dashY = en.y + Math.sin(a2)*150;
                            dashX = Math.max(10, Math.min(canvas.width-en.size-10, dashX));
                            dashY = Math.max(10, Math.min(canvas.height-en.size-10, dashY));
                            en.x = dashX; en.y = dashY;
                            createParticles(enCX,enCY,"#fa0",20,8);
                            shakeTime=10;
                            break;
                        case 'spawnMinions':
                            for(let i=0;i<3;i++){
                                let ang = Math.random()*2*Math.PI;
                                let sx = enCX+Math.cos(ang)*60, sy = enCY+Math.sin(ang)*60;
                                spawnEnemy(sx-15, sy-15, 'tufo', false);
                            }
                            break;
                        case 'explosiveShots':
                            for(let i=0;i<5;i++){
                                let ang = Math.random()*2*Math.PI;
                                enemyBullets.push({x:enCX, y:enCY, vx:Math.cos(ang)*6, vy:Math.sin(ang)*6, explosive:true});
                            }
                            break;
                        case 'spiralShots':
                            for(let i=0;i<12;i++){
                                let ang = i*Math.PI*2/12 + gameTime*2;
                                let sp = 5;
                                enemyBullets.push({x:enCX, y:enCY, vx:Math.cos(ang)*sp, vy:Math.sin(ang)*sp});
                            }
                            break;
                        case 'spawnMobs':
                            for(let i=0;i<4;i++){
                                let ang = Math.random()*2*Math.PI;
                                let sx = enCX+Math.cos(ang)*50, sy = enCY+Math.sin(ang)*50;
                                spawnEnemy(sx-12, sy-12, 'esporo', false);
                            }
                            break;
                    }
                } else en.attackTimer--;
                en.trapCooldown--;
                if(en.trapCooldown<=0 && Math.random()<0.02){
                    en.trapCooldown=180;
                    for(let i=0;i<3;i++){
                        let ang = Math.random()*2*Math.PI, rad = 80+Math.random()*60;
                        bossTraps.push({x:enCX+Math.cos(ang)*rad, y:enCY+Math.sin(ang)*rad, life:90, radius:20});
                    }
                    createParticles(enCX,enCY,"#f60",20,5); shakeTime=15;
                }
            } else {
                if(en.flyer){
                    let ang = Math.atan2(dyp, dxp);
                    en.x += Math.cos(ang)*eSpeed; en.y += Math.sin(ang)*eSpeed;
                } else if(en.spawner){
                    en.spawnTimer++;
                    if(en.spawnTimer>=en.spawnDelay){
                        en.spawnTimer=0;
                        for(let i=0;i<3;i++){
                            let a = i*Math.PI*2/3;
                            let sx = en.x+en.size/2+Math.cos(a)*40, sy = en.y+en.size/2+Math.sin(a)*40;
                            spawnEnemy(sx-9, sy-9, 'esporo_mini', false);
                        }
                        createParticles(en.x+en.size/2, en.y+en.size/2, "#8B4513",15);
                    }
                } else if(!en.mimic){
                    let ang = Math.atan2(dyp, dxp);
                    let newX = en.x + Math.cos(ang)*eSpeed;
                    let newY = en.y + Math.sin(ang)*eSpeed;
                    if(!checkCollision(newX, en.y, en.size, roomData.obstacles)) en.x = newX;
                    if(!checkCollision(en.x, newY, en.size, roomData.obstacles)) en.y = newY;
                }
            }
            if(player.isVacuuming && distSq<40000){
                let ang = Math.atan2(enCY-(player.y+14), enCX-(player.x+14));
                if(isSuperVacuumActive){
                    en.vx -= Math.cos(ang)*12; en.vy -= Math.sin(ang)*12;
                    if(distSq < (50+en.size/2)*(50+en.size/2)) en.hp-=5;
                } else {
                    en.vx -= Math.cos(ang)*3; en.vy -= Math.sin(ang)*3;
                }
            }
            if(distSq < (en.size/2+12)*(en.size/2+12) && !player.invincible){
                player.hp -= en.isBoss?2:1; updateUI(); player.invincible=true; shakeTime=20;
                let knock = Math.atan2(dyp, dxp);
                player.vx = Math.cos(knock)*25; player.vy = Math.sin(knock)*25;
                if(player.hp<=0){ isGameOver=true; isPaused=true; }
                setTimeout(()=>player.invincible=false,800);
            }
        }

        if(keys['MouseDown'] && Date.now()-player.lastShot > player.shotDelay){
            let a = Math.atan2(mouse.y-(player.y+14), mouse.x-(player.x+14));
            bullets.push({x:player.x+14, y:player.y+14, vx:Math.cos(a)*12, vy:Math.sin(a)*12, hitEnemy:false});
            player.lastShot = Date.now();
        }
        for(let i=0;i<bullets.length;i++){
            let b=bullets[i];
            b.x+=b.vx; b.y+=b.vy;
            let hit = checkCollision(b.x,b.y,4,roomData.obstacles);
            for(let obj of ambientObjects){
                if(obj.type==='fan' && obj.cooldown===0 && (b.x-obj.x)*(b.x-obj.x)+(b.y-obj.y)*(b.y-obj.y)<225){
                    obj.active=true; obj.cooldown=180; createParticles(obj.x,obj.y,"#0FF",10); hit=true;
                }
            }
            for(let en of enemies){
                let dx=b.x-(en.x+en.size/2), dy=b.y-(en.y+en.size/2);
                if(dx*dx+dy*dy < (en.size/2)*(en.size/2)){
                    en.hp-=10; en.flash=2; hit=true; b.hitEnemy=true;
                    if(isItemEquipped('freeze')) en.slow=60;
                    createParticles(b.x,b.y,en.color,3,2);
                    if(isItemEquipped('splash')){
                        for(let other of enemies){
                            if(other===en) continue;
                            let odx=b.x-(other.x+other.size/2), ody=b.y-(other.y+other.size/2);
                            if(odx*odx+ody*ody<3600){
                                other.hp-=5; other.flash=2; createParticles(b.x,b.y,"#ff0",5,3);
                            }
                        }
                    }
                    break;
                }
            }
            if(b.hitEnemy){ player.vacuumCharge = Math.min(player.maxVacuumCharge, player.vacuumCharge+5); updateUI(); }
            if(hit || b.x<0 || b.x>800 || b.y<0 || b.y>600){ bullets.splice(i,1); i--; }
        }
        updateRoomba();

        for(let i=0;i<enemyBullets.length;i++){
            let eb=enemyBullets[i];
            eb.x+=eb.vx; eb.y+=eb.vy;
            if(isItemEquipped('shield') && (eb.x-(player.x+14))*(eb.x-(player.x+14))+(eb.y-(player.y+14))*(eb.y-(player.y+14))<625){
                let ang = Math.atan2(eb.y-(player.y+14), eb.x-(player.x+14));
                enemyBullets.push({x:player.x+14, y:player.y+14, vx:Math.cos(ang+Math.PI)*8, vy:Math.sin(ang+Math.PI)*8});
                createParticles(eb.x,eb.y,"#0FF",5);
                enemyBullets.splice(i,1); i--;
                continue;
            }
            if((eb.x-(player.x+14))*(eb.x-(player.x+14))+(eb.y-(player.y+14))*(eb.y-(player.y+14))<225 && !player.invincible){
                player.hp--; updateUI(); player.invincible=true; shakeTime=15;
                let ka = Math.atan2(player.y+14-eb.y, player.x+14-eb.x);
                player.vx=Math.cos(ka)*10; player.vy=Math.sin(ka)*10;
                if(player.hp<=0){ isGameOver=true; isPaused=true; }
                setTimeout(()=>player.invincible=false,1000);
                if(eb.explosive){
                    for(let e of enemies){
                        let dx=e.x+e.size/2-eb.x, dy=e.y+e.size/2-eb.y;
                        if(dx*dx+dy*dy<3600){ e.hp-=20; e.flash=2; }
                    }
                    createParticles(eb.x,eb.y,"#f80",20,6);
                }
                enemyBullets.splice(i,1); i--;
            } else if(eb.x<0 || eb.x>800 || eb.y<0 || eb.y>600){
                enemyBullets.splice(i,1); i--;
            }
        }

        for(let i=0;i<enemies.length;i++){
            let en=enemies[i];
            if(en.hp<=0){
                createParticles(en.x+en.size/2, en.y+en.size/2, en.color, en.isBoss?80:15, en.isBoss?10:5);
                if(en.explode) for(let j=0;j<4;j++) enemyBullets.push({x:en.x+en.size/2,y:en.y+en.size/2,vx:Math.cos(j*Math.PI/2)*4,vy:Math.sin(j*Math.PI/2)*4});
                spawnItem(en.x+en.size/2, en.y+en.size/2, en.mimic);
                totalKills++; updateKillCounter(); updateUI();
                if(en.isBoss){
                    bossDefeated=true; clearedRooms.add(`${currentPos.x},${currentPos.y}`);
                    document.getElementById('boss-warning').style.display='none';
                    createParticles(canvas.width/2,canvas.height/2,"#fa0",100,15);
                    victory();
                }
                enemies.splice(i,1); i--;
            }
        }

        if(enemies.length===0 && !clearedRooms.has(`${currentPos.x},${currentPos.y}`)){
            clearedRooms.add(`${currentPos.x},${currentPos.y}`);
            roomsExplored++;
            updateUI(); checkAllRoomsCleared();
        }

        if(enemies.length===0){
            for(let d of doors){
                if(player.x < d.x+d.w && player.x+player.size > d.x && player.y < d.y+d.h && player.y+player.size > d.y){
                    if(d.dir==='top') currentPos.y--;
                    if(d.dir==='bottom') currentPos.y++;
                    if(d.dir==='left') currentPos.x--;
                    if(d.dir==='right') currentPos.x++;
                    let nk = `${currentPos.x},${currentPos.y}`;
                    if(!visitedRooms.has(nk)) visitedRooms.add(nk);
                    generateRoom(d.dir);
                    break;
                }
            }
        }
    }

    // ---------- Draw principal ----------
    function draw() {
        ctx.clearRect(0,0,800,600);
        ctx.save();
        if(shakeTime>0) ctx.translate((Math.random()-0.5)*shakeTime, (Math.random()-0.5)*shakeTime);
        const roomData = getRoomData(`${currentPos.x},${currentPos.y}`);
        ctx.fillStyle = roomData.isCarpet?"#2a1a10":"#111"; ctx.fillRect(0,0,800,600);
        if(roomData.isCarpet) for(let i=0;i<800;i+=20){ ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i,600); ctx.stroke(); }
        ctx.fillStyle="#222"; roomData.obstacles.forEach(o=>{ ctx.fillRect(o.x,o.y,o.w,o.h); ctx.strokeStyle="#333"; ctx.strokeRect(o.x,o.y,o.w,o.h); });
        if(lightPoints) lightPoints.forEach(l=>{
            let g=ctx.createRadialGradient(l.x,l.y,5,l.x,l.y,l.radius);
            g.addColorStop(0,l.color);
            g.addColorStop(0.5,`rgba(255,150,50,${l.intensity*0.5})`);
            g.addColorStop(1,"rgba(0,0,0,0)");
            ctx.globalCompositeOperation='lighter'; ctx.fillStyle=g; ctx.fillRect(0,0,800,600); ctx.globalCompositeOperation='source-over';
        });
        ambientObjects.forEach(obj=>{
            if(obj.type==='fan'){
                ctx.save(); ctx.translate(obj.x,obj.y);
                ctx.fillStyle=obj.active?"#0FF":"#888"; ctx.fillRect(-15,-15,30,30);
                ctx.fillStyle="#333"; ctx.font="20px Arial"; ctx.fillText("🌀",-8,8);
                ctx.fillStyle="white"; ctx.font="12px Arial";
                if(obj.direction==='up') ctx.fillText("↑",-3,-18); if(obj.direction==='down') ctx.fillText("↓",-3,22);
                if(obj.direction==='left') ctx.fillText("←",-22,5); if(obj.direction==='right') ctx.fillText("→",14,5);
                ctx.restore();
            }
        });
        if(enemies.length===0) doors.forEach(d=>{ ctx.fillStyle="#0FF"; ctx.fillRect(d.x,d.y,d.w,d.h); });
        bossTraps.forEach(t=>{
            ctx.fillStyle=`rgba(255,102,0,${0.3+Math.sin(gameTime*20)*0.2})`; ctx.beginPath(); ctx.arc(t.x,t.y,t.radius,0,2*Math.PI); ctx.fill();
            ctx.fillStyle="#f60"; ctx.beginPath(); ctx.arc(t.x,t.y,t.radius-5,0,2*Math.PI); ctx.fill();
            ctx.fillStyle="#fff"; ctx.font="12px Arial"; ctx.fillText("⚠️",t.x-6,t.y+5);
        });
        powerUpItems.forEach(pu=>{
            let p=availablePowerUps[pu.powerUpId]; ctx.fillStyle="#FFD700"; ctx.beginPath(); ctx.arc(pu.x,pu.y,12,0,2*Math.PI); ctx.fill();
            ctx.fillStyle="#000"; ctx.font="16px Arial"; ctx.fillText(p.name.charAt(0),pu.x-6,pu.y+6);
            ctx.fillStyle="#FFF"; ctx.font="10px Arial"; ctx.fillText("?",pu.x-2,pu.y+4);
        });
        items.forEach(it=>{
            if(it.isMimic && !it.revealed){ ctx.fillStyle="#f44"; ctx.font="20px Arial"; ctx.fillText("❤️",it.x-10,it.y+10);
            ctx.fillStyle=`rgba(255,0,0,${0.2+Math.sin(gameTime*10)*0.1})`; ctx.beginPath(); ctx.arc(it.x,it.y,15,0,2*Math.PI); ctx.fill(); }
            else if(!it.isMimic){ ctx.fillStyle="#f44"; ctx.font="20px Arial"; ctx.fillText("❤️",it.x-10,it.y+10); }
        });
        particles.forEach(p=>{ ctx.globalAlpha=p.life; ctx.fillStyle=p.color; ctx.fillRect(p.x,p.y,p.size,p.size); }); ctx.globalAlpha=1;
        ctx.fillStyle="rgba(255,255,200,0.1)"; ambientDust.forEach(d=>{ ctx.fillRect(d.x,d.y,d.s,d.s); });
        enemies.forEach(en=>{ if(en.isBoss) drawBoss(en); else drawCommonEnemy(en); });
        drawRoomba();

        // Jogador
        if(!player.invincible || Math.floor(gameTime*10)%2===0){
            ctx.save(); let bob=Math.sin(player.walkCycle)*4, tilt=Math.cos(player.walkCycle)*0.08;
            ctx.translate(player.x+player.size/2, player.y+player.size/2); ctx.rotate(tilt);
            if(player.isMoving){ ctx.fillStyle="#555"; ctx.fillRect(-12,10+Math.sin(player.walkCycle)*8,8,6); ctx.fillRect(4,10+Math.sin(player.walkCycle+Math.PI)*8,8,6); }
            ctx.fillStyle="white"; ctx.fillRect(-player.size/2,-player.size/2+bob,player.size,player.size);
            ctx.fillStyle="black"; ctx.fillRect(-9,-6+bob,5,5); ctx.fillRect(4,-6+bob,5,5);
            let ang = Math.atan2(mouse.y-(player.y+14), mouse.x-(player.x+14))-tilt;
            ctx.save(); ctx.rotate(ang); ctx.translate(0,bob+(player.isMoving?Math.random()*2:0));
            ctx.fillStyle="#666"; ctx.fillRect(15,-4,22,8);
            if(player.isVacuuming){ ctx.fillStyle=isSuperVacuumActive?"rgba(255,0,255,0.4)":"rgba(0,255,255,0.2)"; ctx.beginPath(); ctx.moveTo(35,0); ctx.lineTo(200,-70); ctx.lineTo(200,70); ctx.fill(); }
            if(isItemEquipped('blades')){
                ctx.fillStyle="rgba(0,255,255,0.2)"; ctx.beginPath(); ctx.arc(0,0,70,0,2*Math.PI); ctx.fill();
                for(let i=0;i<4;i++){ let a=gameTime*10+i*Math.PI/2; ctx.fillStyle="#0FF"; ctx.beginPath(); ctx.moveTo(Math.cos(a)*30,Math.sin(a)*30); ctx.lineTo(Math.cos(a+0.4)*55,Math.sin(a+0.4)*55); ctx.lineTo(Math.cos(a-0.4)*55,Math.sin(a-0.4)*55); ctx.fill(); }
            }
            if(isItemEquipped('shield')){ ctx.fillStyle="rgba(0,255,255,0.15)"; ctx.beginPath(); ctx.arc(0,0,30,0,2*Math.PI); ctx.fill(); ctx.strokeStyle="#0FF"; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(0,0,30,0,2*Math.PI); ctx.stroke(); }
            ctx.restore(); ctx.restore();
        }
        ctx.fillStyle="#FF0"; bullets.forEach(b=>ctx.fillRect(b.x-2,b.y-2,4,4));
        ctx.fillStyle="magenta"; enemyBullets.forEach(eb=>{ ctx.beginPath(); ctx.arc(eb.x,eb.y,5,0,2*Math.PI); ctx.fill(); });
        if(enemies.length>0 && enemies[0].isBoss){
            ctx.fillStyle="#300"; ctx.fillRect(100,20,600,20);
            let perc = enemies[0].hp/enemies[0].maxHp;
            ctx.fillStyle="red"; ctx.fillRect(100,20,perc*600,20);
            ctx.fillStyle="white"; ctx.font="bold 14px Courier New"; ctx.fillText(`${bossTypesMap[enemies[0].baseType].name} - ${Math.floor(enemies[0].hp)}/${enemies[0].maxHp}`,350,18);
            ctx.font="10px Courier New"; ctx.fillStyle="#FFD700"; ctx.fillText("⚠️ CUIDADO COM AS ARMADILHAS NO CHÃO ⚠️",300,55);
        }
        let grad = ctx.createRadialGradient(player.x+14,player.y+14,50,player.x+14,player.y+14,300);
        grad.addColorStop(0,"rgba(0,0,0,0)"); grad.addColorStop(0.5,"rgba(0,0,0,0.15)"); grad.addColorStop(1,"rgba(0,0,0,0.5)");
        ctx.fillStyle=grad; ctx.fillRect(0,0,800,600);
        if(isGameOver){
            ctx.fillStyle="rgba(0,0,0,0.9)"; ctx.fillRect(0,0,800,600);
            ctx.fillStyle=bossDefeated?"gold":"white"; ctx.textAlign="center";
            if(bossDefeated){
                ctx.font="40px Courier New"; ctx.fillText("VITÓRIA!",400,250);
                ctx.font="20px Courier New"; ctx.fillText(`Você derrotou o ${bossTypesMap[bossType].name}!`,400,310);
                ctx.fillText(`Salas exploradas: ${visitedRooms.size}/${TOTAL_ROOMS}`,400,350);
            } else {
                ctx.font="40px Courier New"; ctx.fillText("DERROTA!",400,280);
                ctx.font="20px Courier New"; ctx.fillText("O pó te venceu...",400,340);
            }
            ctx.font="16px Courier New"; ctx.fillText("CLIQUE PARA RECOMEÇAR",400,430);
        }
        ctx.restore();
    }

    function updateBuildCounter() { document.getElementById('build-counter').innerHTML = `⚔️ ITENS EQUIPADOS: ${equippedItems.length}/${MAX_EQUIPPED}`; }

    function loop(){ update(); draw(); requestAnimationFrame(loop); }

    // Inicialização
    generateRoomLayout();
    bossType = escolherBossAleatorio();
    generateRoom();
    setupREInventoryEvents();
    loop();

    // Eventos
    window.onkeydown = (e)=>{
        keys[e.code]=true;
        if(e.code==='Escape') togglePause();
        if(e.code==='KeyI'){ e.preventDefault(); if(isPaused && document.getElementById('inventory-menu').style.display==='flex') closeInventory(); else if(!isPaused && !isGameOver) openInventory(); }
        if(e.code==='Tab'){ e.preventDefault(); toggleREInventory(); }
        if(e.code==='Space' && player.vacuumCharge>=player.maxVacuumCharge && !isSuperVacuumActive && !isGameOver && !isPaused){
            e.preventDefault(); isSuperVacuumActive=true; player.vacuumCharge=0; specialUsageCount++; superVacuumTimer=180; shakeTime=20; updateUI(); createParticles(player.x+14,player.y+14,"#F0F",30,8);
        }
        if(e.code==='ShiftLeft' && isItemEquipped('dash') && Date.now()-lastDashTime>1000 && !isPaused && !isGameOver){
            e.preventDefault(); lastDashTime=Date.now(); let dd=100;
            if(keys['KeyW']) player.y-=dd; if(keys['KeyS']) player.y+=dd; if(keys['KeyA']) player.x-=dd; if(keys['KeyD']) player.x+=dd;
            player.x=Math.max(0,Math.min(800-player.size,player.x)); player.y=Math.max(0,Math.min(600-player.size,player.y));
            createParticles(player.x+14,player.y+14,"#0FF",20,5); player.invincible=true; setTimeout(()=>player.invincible=false,300);
        }
    };
    window.onkeyup = (e)=>keys[e.code]=false;
    window.onmousemove = (e)=>{ let r=canvas.getBoundingClientRect(); mouse.x=e.clientX-r.left; mouse.y=e.clientY-r.top; };
    window.onmousedown = (e)=>{ if(isGameOver) location.reload(); if(e.button===0) keys['MouseDown']=true; };
    window.onmouseup = (e)=>keys['MouseDown']=false;

    // Expor funções globais necessárias no HTML
    window.togglePause = togglePause;
    window.closeInventory = closeInventory;
    window.toggleREInventory = toggleREInventory;

})();