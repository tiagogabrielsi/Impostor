// --- BANCO DE DADOS ---
const wordPacks = {
    "Animais": [
        { real: "Lobo", fake: "Cachorro" }, { real: "Tubarão", fake: "Golfinho" },
        { real: "Águia", fake: "Papagaio" }, { real: "Gato", fake: "Leão" },
        { real: "Cavalo", fake: "Zebra" }, { real: "Urso", fake: "Panda" }
    ],
    "Cozinha": [
        { real: "Garfo", fake: "Colher" }, { real: "Geladeira", fake: "Freezer" },
        { real: "Microondas", fake: "Forno" }, { real: "Copo", fake: "Xícara" },
        { real: "Liquidificador", fake: "Batedeira" }
    ],
    "Lugares": [
        { real: "Praia", fake: "Piscina" }, { real: "Escola", fake: "Faculdade" },
        { real: "Cinema", fake: "Teatro" }, { real: "Hospital", fake: "Farmácia" },
        { real: "Padaria", fake: "Mercado" }
    ],
    "Profissoes": [
        { real: "Médico", fake: "Enfermeiro" }, { real: "Policial", fake: "Segurança" },
        { real: "Professor", fake: "Diretor" }, { real: "Piloto", fake: "Motorista" },
        { real: "Chef", fake: "Cozinheiro" }
    ]
};

// --- ESTADO DO JOGO ---
let players = ["Jogador 1", "Jogador 2", "Jogador 3"];
let gameData = [];
let currentPlayerIndex = 0;
let secretWord = ""; 
let impostorsAndInspectors = []; 
let timerInterval;
let currentInspectorEliminated = null;

// --- INICIALIZAÇÃO ---
document.addEventListener('DOMContentLoaded', () => {
    renderPlayerList();
    updateGameModeUI(); 
});

// --- UI & BALANCEAMENTO ---

function updateGameModeUI() {
    const mode = document.getElementById('game-mode').value;
    const hintDiv = document.getElementById('div-hint-toggle');
    const inspectorDiv = document.getElementById('div-inspector-count');
    const inspectorSelect = document.getElementById('inspector-count');
    
    if (mode === 'mystery') {
        hintDiv.style.display = 'none';
        inspectorDiv.style.display = 'block';
    } else {
        hintDiv.style.display = 'flex';
        inspectorDiv.style.display = 'none';
        inspectorSelect.value = 0; // Zera inspetor no clássico
    }
    updateRoleLimits();
}

function updateRoleLimits() {
    const impostorSelect = document.getElementById('impostor-count');
    const inspectorSelect = document.getElementById('inspector-count');
    const gameMode = document.getElementById('game-mode').value;

    // MÁXIMO DE VILÕES PERMITIDOS (Jogadores - 2 civis)
    const maxVillains = Math.max(1, players.length - 2);

    // Salva valores atuais
    const oldImp = parseInt(impostorSelect.value) || 0;
    const oldInsp = parseInt(inspectorSelect.value) || 0;

    // 1. Renderiza Opções de Impostores
    impostorSelect.innerHTML = "";
    const minImpostors = (gameMode === 'mystery') ? 0 : 1;
    for (let i = minImpostors; i <= maxVillains; i++) {
        impostorSelect.innerHTML += `<option value="${i}">${i}</option>`;
    }
    
    // 2. Renderiza Opções de Inspetores
    inspectorSelect.innerHTML = "";
    // Limite max de inspetores (2) ou Max Villains
    const limitInsp = Math.min(maxVillains, 2);
    for (let i = 0; i <= limitInsp; i++) {
        inspectorSelect.innerHTML += `<option value="${i}">${i}</option>`;
    }

    // 3. Restaura valores (se possível) e valida soma
    if (oldImp >= minImpostors && oldImp <= maxVillains) impostorSelect.value = oldImp;
    else impostorSelect.value = minImpostors;

    if (oldInsp <= limitInsp) inspectorSelect.value = oldInsp;
    else inspectorSelect.value = 0;

    validateRoles('system');
}

function validateRoles(source) {
    const impostorSelect = document.getElementById('impostor-count');
    const inspectorSelect = document.getElementById('inspector-count');
    
    let imp = parseInt(impostorSelect.value) || 0;
    let insp = parseInt(inspectorSelect.value) || 0;
    
    // Limite total de vilões
    const maxVillains = Math.max(1, players.length - 2);
    
    // Se a soma estourar o limite, reduz o OUTRO papel
    if (imp + insp > maxVillains) {
        if (source === 'impostor') {
            insp = Math.max(0, maxVillains - imp);
            inspectorSelect.value = insp;
        } else if (source === 'inspector') {
            imp = Math.max(0, maxVillains - insp);
            impostorSelect.value = imp;
        } else {
            // Se for sistema, prioriza Impostor
            if (imp > maxVillains) imp = maxVillains;
            insp = Math.max(0, maxVillains - imp);
            impostorSelect.value = imp;
            inspectorSelect.value = insp;
        }
    }
}

function addPlayer() {
    players.push(`Jogador ${players.length + 1}`);
    renderPlayerList();
    updateRoleLimits();
}

function removePlayer() {
    if (players.length > 3) {
        players.pop();
        renderPlayerList();
        updateRoleLimits();
    } else {
        alert("Mínimo de 3 jogadores necessário!");
    }
}

function renderPlayerList() {
    const list = document.getElementById('player-list');
    if (!list) return;
    list.innerHTML = '';
    players.forEach((p, index) => {
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'player-input';
        input.value = p;
        input.placeholder = `Nome do Jogador ${index + 1}`;
        input.oninput = function(e) { players[index] = e.target.value; };
        list.appendChild(input);
    });
}

// --- START GAME ---

function startGame() {
    const category = document.getElementById('category-select').value;
    const impostorCount = parseInt(document.getElementById('impostor-count').value);
    const inspectorCount = parseInt(document.getElementById('inspector-count').value);
    const gameMode = document.getElementById('game-mode').value;
    const tipEnabled = document.getElementById('impostor-tip').checked;

    // 1. Palavras
    const pack = wordPacks[category];
    const selectedPair = pack[Math.floor(Math.random() * pack.length)];
    secretWord = selectedPair.real;
    const fakeWord = selectedPair.fake;

    // 2. Papéis
    // Se for clássico, ignora o input do inspetor
    const actualInspectors = (gameMode === 'mystery') ? inspectorCount : 0;
    const civisCount = players.length - impostorCount - actualInspectors;

    let roles = Array(impostorCount).fill('Impostor')
                .concat(Array(actualInspectors).fill('Inspetor'))
                .concat(Array(civisCount).fill('Civil'));
    
    roles = roles.sort(() => Math.random() - 0.5);

    // 3. Distribuição
    gameData = players.map((player, index) => {
        let assignedWord = "";
        let role = roles[index];

        if (role === 'Civil') {
            assignedWord = secretWord;
        } 
        else if (role === 'Impostor') {
            if (gameMode === 'classic') {
                assignedWord = tipEnabled ? fakeWord : "???";
            } else {
                assignedWord = fakeWord; // Mistério: vê fake achando que é real
            }
        } 
        else if (role === 'Inspetor') {
            assignedWord = "???"; 
        }

        return {
            name: player,
            role: role,
            word: assignedWord,
            mode: gameMode,
            hasTip: (role === 'Impostor' && tipEnabled && gameMode === 'classic'),
            isAlive: true
        };
    });

    impostorsAndInspectors = gameData.filter(p => p.role !== 'Civil').map(p => p.name);
    currentPlayerIndex = 0;
    switchScreen('screen-reveal');
    prepareRevealScreen();
}

// --- TELAS ---

function prepareRevealScreen() {
    const player = gameData[currentPlayerIndex];
    document.getElementById('current-player-name').innerText = player.name;
    const card = document.getElementById('game-card');
    if(card) card.classList.remove('flipped'); 
    
    const nextBtn = document.getElementById('next-player-btn');
    nextBtn.disabled = true;
    nextBtn.style.opacity = "0.5";
    nextBtn.innerText = (currentPlayerIndex < players.length - 1) ? "Próximo" : "Debate";
}

function revealRole() {
    const player = gameData[currentPlayerIndex];
    const card = document.getElementById('game-card');
    
    if (!card.classList.contains('flipped')) {
        card.classList.add('flipped');
        const roleDiv = document.getElementById('player-role');
        const wordDiv = document.getElementById('player-word');

        if (player.role === 'Inspetor') {
            roleDiv.innerText = "🕵️ INSPETOR";
            roleDiv.style.color = "#8b5cf6";
            wordDiv.innerText = "Você não tem palavra! Finja e adivinhe para ganhar.";
            wordDiv.style.fontSize = "1.2rem";
        }
        else if (player.mode === 'mystery') {
            roleDiv.innerText = "SUA PALAVRA";
            roleDiv.style.color = "#f2c94c";
            wordDiv.innerText = player.word;
            wordDiv.style.fontSize = "2rem";
        } 
        else {
            if (player.role === 'Impostor') {
                roleDiv.innerText = "🤫 IMPOSTOR";
                roleDiv.style.color = "#ff416c";
                if (player.hasTip) {
                    wordDiv.innerText = `Dica: ${player.word}`;
                    wordDiv.style.fontSize = "1.5rem";
                } else {
                    wordDiv.innerText = "Engane a todos!";
                }
            } else {
                roleDiv.innerText = "😇 CIVIL"; 
                roleDiv.style.color = "#00d2ff";
                wordDiv.innerText = player.word;
            }
        }

        const btn = document.getElementById('next-player-btn');
        btn.disabled = false;
        btn.style.opacity = "1";
    } else {
        card.classList.remove('flipped');
    }
}

function nextPlayer() {
    currentPlayerIndex++;
    if (currentPlayerIndex < players.length) {
        prepareRevealScreen();
    } else {
        startTimer();
    }
}

// --- TIMER ---
function startTimer() {
    const durationInput = document.getElementById('game-timer');
    const duration = durationInput ? parseInt(durationInput.value) : 180;
    switchScreen('screen-timer');
    const display = document.getElementById('timer-display');
    if (timerInterval) clearInterval(timerInterval);

    if (duration === 0) {
        display.innerText = "∞";
        display.style.color = "#22c55e";
        return;
    }

    display.style.color = "white";
    let timeHead = duration;
    updateTimerDisplay(timeHead, display);

    timerInterval = setInterval(() => {
        timeHead--;
        updateTimerDisplay(timeHead, display);
        if (timeHead <= 0) {
            clearInterval(timerInterval);
            finishVoting();
        }
    }, 1000);
}

function updateTimerDisplay(time, element) {
    const minutes = Math.floor(time / 60);
    const seconds = time % 60;
    element.innerText = `${minutes}:${seconds < 10 ? '0'+seconds : seconds}`;
}

function finishVoting() {
    if (timerInterval) clearInterval(timerInterval);
    switchScreen('screen-vote');
    renderVotingButtons();
}

// --- VOTAÇÃO E FIM ---

function renderVotingButtons() {
    const container = document.getElementById('voting-buttons');
    container.innerHTML = '';
    gameData.forEach(p => {
        if (p.isAlive) {
            const btn = document.createElement('button');
            btn.innerText = p.name;
            btn.className = "secondary";
            btn.onclick = () => processVote(p.name);
            container.appendChild(btn);
        }
    });
}

function processVote(votedPlayerName) {
    const votedPlayer = gameData.find(p => p.name === votedPlayerName);
    votedPlayer.isAlive = false;

    if (votedPlayer.role === 'Inspetor') {
        currentInspectorEliminated = votedPlayer;
        switchScreen('screen-guess');
        document.getElementById('inspector-guess-input').value = "";
        return;
    }
    checkWinCondition(votedPlayer);
}

function checkInspectorGuess() {
    const guessInput = document.getElementById('inspector-guess-input').value;
    const normalize = (str) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
    
    if (normalize(guessInput) === normalize(secretWord)) {
        showFinalResult("Impostores", `O Inspetor Bugiganga (${currentInspectorEliminated.name}) acertou a palavra secreta!`);
    } else {
        checkWinCondition(currentInspectorEliminated);
    }
}

function checkWinCondition(eliminatedPlayer) {
    const impostorsAlive = gameData.filter(p => p.role === 'Impostor' && p.isAlive).length;
    const inspectorsAlive = gameData.filter(p => p.role === 'Inspetor' && p.isAlive).length;
    const civiliansAlive = gameData.filter(p => p.role === 'Civil' && p.isAlive).length;
    const totalVillainsAlive = impostorsAlive + inspectorsAlive;

    if (eliminatedPlayer.role === 'Civil') {
        if (civiliansAlive <= 1) {
            showFinalResult("Impostores", `Fim de jogo! Restou apenas 1 Civil.`);
        } else {
            showRoundContinue(
                "PALPITE ERRADO!", "#ef4444", 
                `${eliminatedPlayer.name} era INOCENTE (Civil).`, 
                "Cuidado! Os impostores continuam entre vocês."
            );
        }
    } 
    else {
        let msgTitle = eliminatedPlayer.role === 'Inspetor' ? "INSPETOR FALHOU!" : "IMPOSTOR PEGO!";
        let msgMain = eliminatedPlayer.role === 'Inspetor' 
            ? `${eliminatedPlayer.name} errou o chute e foi eliminado.` 
            : `${eliminatedPlayer.name} era um Impostor!`;

        if (totalVillainsAlive === 0) {
            showFinalResult("Civis", `Vitória! Todos os vilões foram eliminados.`);
        } else {
            showRoundContinue(
                msgTitle, "#f59e0b", 
                msgMain, 
                `Ainda resta(m) ${totalVillainsAlive} Inimigo(s) (Impostores ou Inspetores).`
            );
        }
    }
}

function showRoundContinue(titleText, bgColor, mainMsg, infoMsg) {
    switchScreen('screen-round-end');
    const box = document.getElementById('round-box');
    document.getElementById('round-title').innerText = titleText;
    document.getElementById('round-message').innerText = mainMsg;
    document.getElementById('remaining-info').innerText = infoMsg;
    if(box) box.style.background = bgColor;
}

function startNextRound() {
    startTimer();
}

function showFinalResult(winnerTeam, message) {
    const resultTitle = document.getElementById('result-title');
    const resultMsg = document.getElementById('result-message');

    if (winnerTeam === "Civis") {
        resultTitle.innerText = "VITÓRIA DOS CIVIS!";
        resultTitle.style.color = "#22c55e";
    } else {
        resultTitle.innerText = "VILÕES VENCERAM!";
        resultTitle.style.color = "#ef4444";
    }
    resultMsg.innerText = message;
    document.getElementById('final-word').innerText = secretWord;
    document.getElementById('final-impostor').innerText = impostorsAndInspectors.join(", ");
    switchScreen('screen-result');
}

function resetGame() {
    switchScreen('screen-setup');
}

function switchScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const screen = document.getElementById(screenId);
    if(screen) screen.classList.add('active');
}