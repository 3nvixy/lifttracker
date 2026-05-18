// ----- Helpers -----

function getTodayISO() {
    const d = new Date();
    const off = d.getTimezoneOffset();
    const local = new Date(d.getTime() - off * 60000);
    return local.toISOString().split("T")[0];
}

// ----- State -----

let currentDate = getTodayISO();
let allWorkouts = JSON.parse(localStorage.getItem("allWorkouts")) || {};
let allPRs = JSON.parse(localStorage.getItem("allPRs")) || {};
let currentTheme = localStorage.getItem("theme") || "blue";

let volumeChart = null;
let setsChart = null;
let prChart = null;

// ----- Dark mode -----

function applyDarkModeFromStorage() {
    const mode = localStorage.getItem("darkMode");
    if (mode === "on") {
        document.body.classList.add("dark");
    }
}

function toggleDarkMode() {
    document.body.classList.toggle("dark");
    const isOn = document.body.classList.contains("dark");
    localStorage.setItem("darkMode", isOn ? "on" : "off");
}

// ----- Theme -----

function applyTheme(theme) {
    const root = document.documentElement;
    if (theme === "blue") {
        root.style.setProperty("--primary", "#1976d2");
        root.style.setProperty("--primary-light", "#00b0ff");
        root.style.setProperty("--primary-soft", "#e3f2fd");
    } else if (theme === "dark") {
        root.style.setProperty("--primary", "#111827");
        root.style.setProperty("--primary-light", "#4b5563");
        root.style.setProperty("--primary-soft", "#1f2937");
    } else if (theme === "neon") {
        root.style.setProperty("--primary", "#00e5ff");
        root.style.setProperty("--primary-light", "#00ff95");
        root.style.setProperty("--primary-soft", "#022c22");
    }
    currentTheme = theme;
    localStorage.setItem("theme", theme);

    document.querySelectorAll(".theme-btn").forEach(btn => btn.classList.remove("active"));
    const btn = document.querySelector(`.theme-btn.theme-${theme}`);
    if (btn) btn.classList.add("active");

    updateCharts();
}

function setTheme(theme) {
    applyTheme(theme);
}

// ----- Sidebar & Navigation -----

function toggleSidebar() {
    const sidebar = document.getElementById("sidebar");
    sidebar.classList.toggle("open");
}

function showPage(pageId) {
    document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
    document.getElementById(`page-${pageId}`).classList.add("active");

    document.querySelectorAll(".nav-item").forEach(btn => {
        btn.classList.toggle("active", btn.getAttribute("data-page") === pageId);
    });

    const titles = {
        dashboard: "Dashboard",
        log: "Workout Log",
        prs: "PR Records",
        settings: "Settings"
    };
    document.getElementById("pageTitle").textContent = titles[pageId] || "Workout Tracker";

    const sidebar = document.getElementById("sidebar");
    if (window.innerWidth < 900) sidebar.classList.remove("open");

    if (pageId === "dashboard") updateCharts();
}

// ----- Core data helpers -----

function ensureDay(date) {
    if (!allWorkouts[date]) {
        allWorkouts[date] = [];
    }
}

function getCurrentDaySets() {
    ensureDay(currentDate);
    return allWorkouts[currentDate];
}

function updateExerciseFilterOptions() {
    const select = document.getElementById("filterExercise");
    if (!select) return;

    const seen = new Set();
    const currentValue = select.value;
    select.innerHTML = '<option value="">All</option>';

    Object.values(allWorkouts).forEach(daySets => {
        daySets.forEach(set => {
            if (!seen.has(set.exercise)) {
                seen.add(set.exercise);
                const opt = document.createElement("option");
                opt.value = set.exercise;
                opt.textContent = set.exercise;
                select.appendChild(opt);
            }
        });
    });

    if (seen.has(currentValue)) {
        select.value = currentValue;
    }
}

// ----- PR Logic -----

function checkForPR(set) {
    const { exercise, weight, reps, sets } = set;
    const volume = weight * reps * sets;

    if (!allPRs[exercise]) {
        allPRs[exercise] = { weight, reps, sets, volume };
        localStorage.setItem("allPRs", JSON.stringify(allPRs));
        return "NEW PR!";
    }

    const old = allPRs[exercise];
    let isPR = false;

    if (weight > old.weight) isPR = true;
    if (volume > old.volume) isPR = true;

    if (isPR) {
        allPRs[exercise] = { weight, reps, sets, volume };
        localStorage.setItem("allPRs", JSON.stringify(allPRs));
        return "NEW PR!";
    }

    return "";
}

// ----- Display (Log + PR list + stats) -----

function updateDisplay() {
    ensureDay(currentDate);
    const sets = getCurrentDaySets();
    const list = document.getElementById("setList");
    const dateLabel = document.getElementById("dateLabel");
    const summaryText = document.getElementById("summaryText");
    const filterExercise = document.getElementById("filterExercise")?.value || "";

    if (dateLabel) dateLabel.textContent = currentDate;
    if (list) list.innerHTML = "";

    let totalSets = 0;
    let totalVolume = 0;
    let perExercise = {};

    sets.forEach((set, index) => {
        if (filterExercise && set.exercise !== filterExercise) return;

        const isPR =
            allPRs[set.exercise] &&
            set.weight === allPRs[set.exercise].weight &&
            set.reps === allPRs[set.exercise].reps &&
            set.sets === allPRs[set.exercise].sets;

        if (list) {
            const li = document.createElement("li");
            li.innerHTML = `
                <span style="color:${isPR ? '#00e5ff' : 'inherit'}">
                    <strong>${set.exercise}</strong> —
                    ${set.weight} lbs × ${set.reps} reps × ${set.sets} sets
                    ${isPR ? "🔥 PR" : ""}
                </span>
                <button class="delete-btn" onclick="deleteSet(${index})">X</button>
            `;
            list.appendChild(li);
        }

        const volume = set.weight * set.reps * set.sets;
        totalSets += set.sets;
        totalVolume += volume;

        if (!perExercise[set.exercise]) {
            perExercise[set.exercise] = { volume: 0, sets: 0 };
        }
        perExercise[set.exercise].volume += volume;
        perExercise[set.exercise].sets += set.sets;
    });

    let summary = `Total sets: ${totalSets}, total volume: ${totalVolume} lbs·reps.`;
    const parts = [];
    for (const [name, info] of Object.entries(perExercise)) {
        parts.push(`${name}: ${info.sets} sets, ${info.volume} volume`);
    }
    if (parts.length) summary += " | " + parts.join(" • ");
    if (summaryText) summaryText.textContent = summary || "No sets logged yet.";

    updateExerciseFilterOptions();
    updatePRDisplay();
    updateStats();
    updateCharts();
}

function updatePRDisplay() {
    const prList = document.getElementById("prList");
    if (!prList) return;
    prList.innerHTML = "";

    for (const [exercise, pr] of Object.entries(allPRs)) {
        const li = document.createElement("li");
        li.innerHTML = `
            <strong>${exercise}</strong> —
            ${pr.weight} lbs × ${pr.reps} reps × ${pr.sets} sets
            (Volume: ${pr.volume})
        `;
        prList.appendChild(li);
    }
}

function updateStats() {
    let totalVolume = 0;
    let totalSets = 0;
    const exercises = new Set();

    Object.entries(allWorkouts).forEach(([date, sets]) => {
        sets.forEach(set => {
            const volume = set.weight * set.reps * set.sets;
            totalVolume += volume;
            totalSets += set.sets;
            exercises.add(set.exercise);
        });
    });

    const tv = document.getElementById("statTotalVolume");
    const ts = document.getElementById("statTotalSets");
    const ex = document.getElementById("statExercises");

    if (tv) tv.textContent = totalVolume;
    if (ts) ts.textContent = totalSets;
    if (ex) ex.textContent = exercises.size;
}

// ----- Charts -----

function buildVolumeData() {
    const map = {};
    Object.entries(allWorkouts).forEach(([date, sets]) => {
        let vol = 0;
        sets.forEach(s => {
            vol += s.weight * s.reps * s.sets;
        });
        map[date] = (map[date] || 0) + vol;
    });
    const dates = Object.keys(map).sort();
    return {
        labels: dates,
        data: dates.map(d => map[d])
    };
}

function buildSetsPerExerciseData() {
    const map = {};
    Object.values(allWorkouts).forEach(sets => {
        sets.forEach(s => {
            map[s.exercise] = (map[s.exercise] || 0) + s.sets;
        });
    });
    const names = Object.keys(map);
    return {
        labels: names,
        data: names.map(n => map[n])
    };
}

function buildDailyBestWeightData() {
    const map = {};
    Object.entries(allWorkouts).forEach(([date, sets]) => {
        let best = 0;
        sets.forEach(s => {
            if (s.weight > best) best = s.weight;
        });
        map[date] = best;
    });
    const dates = Object.keys(map).sort();
    return {
        labels: dates,
        data: dates.map(d => map[d])
    };
}

function initCharts() {
    const volCtx = document.getElementById("volumeChart")?.getContext("2d");
    const setsCtx = document.getElementById("setsChart")?.getContext("2d");
    const prCtx = document.getElementById("prChart")?.getContext("2d");

    if (volCtx && !volumeChart) {
        volumeChart = new Chart(volCtx, {
            type: "line",
            data: { labels: [], datasets: [{ label: "Volume", data: [], borderWidth: 2, fill: true }] },
            options: {
                responsive: true,
                plugins: { legend: { display: false } },
                scales: { x: { ticks: { color: "#6b7280" } }, y: { ticks: { color: "#6b7280" } } }
            }
        });
    }

    if (setsCtx && !setsChart) {
        setsChart = new Chart(setsCtx, {
            type: "bar",
            data: { labels: [], datasets: [{ label: "Sets", data: [], borderWidth: 1 }] },
            options: {
                responsive: true,
                plugins: { legend: { display: false } },
                scales: { x: { ticks: { color: "#6b7280" } }, y: { ticks: { color: "#6b7280" } } }
            }
        });
    }

    if (prCtx && !prChart) {
        prChart = new Chart(prCtx, {
            type: "line",
            data: { labels: [], datasets: [{ label: "Best Weight", data: [], borderWidth: 2, fill: false }] },
            options: {
                responsive: true,
                plugins: { legend: { display: false } },
                scales: { x: { ticks: { color: "#6b7280" } }, y: { ticks: { color: "#6b7280" } } }
            }
        });
    }

    updateCharts();
}

function updateCharts() {
    if (!volumeChart || !setsChart || !prChart) return;

    const vol = buildVolumeData();
    const sets = buildSetsPerExerciseData();
    const pr = buildDailyBestWeightData();

    const primary = getComputedStyle(document.documentElement).getPropertyValue("--primary").trim();
    const primaryLight = getComputedStyle(document.documentElement).getPropertyValue("--primary-light").trim();

    volumeChart.data.labels = vol.labels;
    volumeChart.data.datasets[0].data = vol.data;
    volumeChart.data.datasets[0].borderColor = primary;
    volumeChart.data.datasets[0].backgroundColor = primaryLight + "33";
    volumeChart.update();

    setsChart.data.labels = sets.labels;
    setsChart.data.datasets[0].data = sets.data;
    setsChart.data.datasets[0].backgroundColor = primary;
    setsChart.update();

    prChart.data.labels = pr.labels;
    prChart.data.datasets[0].data = pr.data;
    prChart.data.datasets[0].borderColor = primaryLight;
    prChart.update();
}

// ----- Date & Actions -----

function changeDate() {
    const input = document.getElementById("dateInput").value;
    if (!input) return;
    currentDate = input;
    updateDisplay();
}

function addSet() {
    const exercise = document.getElementById("exerciseName").value.trim();
    const weightVal = document.getElementById("weightInput").value;
    const repsVal = document.getElementById("repsInput").value;
    const setsVal = document.getElementById("setsInput").value;

    if (!exercise || !weightVal || !repsVal || !setsVal) {
        alert("Enter exercise, weight, reps, and sets");
        return;
    }

    const weight = parseFloat(weightVal);
    const reps = parseInt(repsVal);
    const sets = parseInt(setsVal);

    ensureDay(currentDate);

    const newSet = { exercise, weight, reps, sets };
    const prMessage = checkForPR(newSet);

    allWorkouts[currentDate].push(newSet);
    localStorage.setItem("allWorkouts", JSON.stringify(allWorkouts));

    document.getElementById("exerciseName").value = "";
    document.getElementById("weightInput").value = "";
    document.getElementById("repsInput").value = "";
    document.getElementById("setsInput").value = "";

    updateDisplay();

    if (prMessage) {
        alert(`🔥 ${prMessage} on ${exercise}!`);
    }
}

function deleteSet(index) {
    ensureDay(currentDate);
    allWorkouts[currentDate].splice(index, 1);
    localStorage.setItem("allWorkouts", JSON.stringify(allWorkouts));
    updateDisplay();
}

// ----- Init -----

window.onload = function () {
    applyDarkModeFromStorage();
    applyTheme(currentTheme);

    const dateInput = document.getElementById("dateInput");
    if (dateInput) dateInput.value = currentDate;

    updateDisplay();
    initCharts();
    showPage("dashboard");
};
