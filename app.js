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
// PR format: { exercise: { weight, reps, sets, volume } }

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

// ----- Core -----

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

    if ([...seen].includes(currentValue)) {
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

// ----- Display -----

function updateDisplay() {
    ensureDay(currentDate);
    const sets = getCurrentDaySets();
    const list = document.getElementById("setList");
    const dateLabel = document.getElementById("dateLabel");
    const summaryText = document.getElementById("summaryText");
    const filterExercise = document.getElementById("filterExercise").value;

    list.innerHTML = "";
    dateLabel.textContent = currentDate;

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

        const li = document.createElement("li");
        li.innerHTML = `
            <span style="color:${isPR ? '#ff9800' : 'inherit'}">
                <strong>${set.exercise}</strong> —
                ${set.weight} lbs × ${set.reps} reps × ${set.sets} sets
                ${isPR ? "🔥 PR" : ""}
            </span>
            <button class="delete-btn" onclick="deleteSet(${index})">X</button>
        `;
        list.appendChild(li);

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
    summaryText.textContent = summary || "No sets logged yet.";

    updateExerciseFilterOptions();
    updatePRDisplay();
}

function updatePRDisplay() {
    const prList = document.getElementById("prList");
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

// ----- Date -----

function changeDate() {
    const input = document.getElementById("dateInput").value;
    if (!input) return;
    currentDate = input;
    updateDisplay();
}

// ----- Actions -----

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

    const dateInput = document.getElementById("dateInput");
    dateInput.value = currentDate;

    updateDisplay();
};
