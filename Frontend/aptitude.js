document.addEventListener("DOMContentLoaded", () => {

    // --- Markdown to Beautiful HTML (Pro Mode) ---
    function convertMarkdownToProHTML(md) {
        if (!md) return "";

        md = md.replace(/^### (.*$)/gim, '<div class="ai-mini-heading">$1</div>');
        md = md.replace(/^- (.*$)/gim, '<div class="ai-bullet">• $1</div>');
        md = md.replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>');
        md = md.replace(/\n/g, '<br>');

        return md;
    }

    // --- Elements ---
    const setupScreen = document.getElementById("setup-screen");
    const practiceScreen = document.getElementById("practice-screen");
    const feedbackScreen = document.getElementById("feedback-screen");
    const loadingSpinner = document.getElementById("loading-spinner");

    const topicSelect = document.getElementById("aptitude-topic");
    const startBtn = document.getElementById("start-btn");

    const questionCounter = document.getElementById("question-counter");
    const questionTopic = document.getElementById("question-topic");
    const questionTimer = document.getElementById("question-timer");
    const questionText = document.getElementById("question-text");
    const optionsGrid = document.getElementById("options-grid");

    const solutionBox = document.getElementById("solution-box");

    const submitBtn = document.getElementById("submit-btn");
    const nextBtn = document.getElementById("next-btn");
    const solutionBtn = document.getElementById("solution-btn");
    const endBtn = document.getElementById("end-btn");

    const feedbackReport = document.getElementById("feedback-report");
    const restartBtn = document.getElementById("restart-btn");

    const initialBackBtn = document.getElementById("back-to-hub");

    // --- Hide Back button after starting ---
    startBtn.addEventListener("click", () => {
        initialBackBtn.style.display = "none";
    });

    // --- State ---
    let selectedTopic = "";
    let questionCount = 0;
    let timerInterval;
    let timeTaken = 0;

    let practiceResults = [];
    let currentQuestionData = null;
    let nextQuestionData = null;
    let selectedAnswer = null;
    let isFetching = false;

    let nextQuestionPromise = null;

    // --- Events ---
    startBtn.addEventListener("click", startPractice);
    submitBtn.addEventListener("click", submitAnswer);
    nextBtn.addEventListener("click", nextQuestion);
    solutionBtn.addEventListener("click", showSolution);
    endBtn.addEventListener("click", endPractice);
    restartBtn.addEventListener("click", restartPractice);

    initialBackBtn.addEventListener("click", () => {
        location.href = "practice.html";
    });

    // --- Logic ---
    async function startPractice() {
        selectedTopic = topicSelect.value;
        practiceResults = [];
        questionCount = 0;

        setupScreen.classList.add("hidden");
        feedbackScreen.classList.add("hidden");
        practiceScreen.classList.remove("hidden");

        loadingSpinner.style.display = "flex";

        currentQuestionData = await fetchQuestion();

        if (currentQuestionData) {
            nextQuestionPromise = fetchQuestion();
            nextQuestionPromise.then(x => nextQuestionData = x);

            questionCount = 1;
            displayQuestion(currentQuestionData);
        } else {
            restartPractice();
        }

        loadingSpinner.style.display = "none";
    }

    async function fetchQuestion() {
        if (isFetching) return null;
        isFetching = true;

        try {
            const response = await fetch("https://prepmate-backend-x77z.onrender.com/aptitude-question", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ topic: selectedTopic })
            });

            const data = await response.json();
            isFetching = false;
            return data.error ? null : data;

        } catch {
            isFetching = false;
            if (questionCount > 0) alert("⚠️ Server not responding.");
            return null;
        }
    }

    function displayQuestion(data) {
        questionText.innerText = data.question;
        questionCounter.innerText = `Question: ${questionCount}`;
        questionTopic.innerText = `Topic: ${selectedTopic}`;

        optionsGrid.innerHTML = "";
        solutionBox.innerHTML = "";
        solutionBox.classList.add("hidden");

        submitBtn.classList.remove("hidden");
        nextBtn.classList.add("hidden");
        solutionBtn.classList.add("hidden");
        submitBtn.disabled = true;
        selectedAnswer = null;

        data.options.forEach(opt => {
            const div = document.createElement("div");
            div.classList.add("option");
            div.innerText = opt;

            div.addEventListener("click", () => {
                document.querySelectorAll(".option").forEach(o => o.classList.remove("selected"));
                div.classList.add("selected");
                selectedAnswer = opt;
                submitBtn.disabled = false;
            });

            optionsGrid.appendChild(div);
        });

        startTimer();
    }

    function startTimer() {
        timeTaken = 0;
        questionTimer.innerText = "Time: 0s";

        clearInterval(timerInterval);
        timerInterval = setInterval(() => {
            timeTaken++;
            questionTimer.innerText = `Time: ${timeTaken}s`;
        }, 1000);
    }

    function submitAnswer() {
        clearInterval(timerInterval);

        const isCorrect = selectedAnswer === currentQuestionData.correct_answer;

        practiceResults.push({
            topic: selectedTopic,
            question: currentQuestionData.question,
            user_answer: selectedAnswer,
            correct_answer: currentQuestionData.correct_answer,
            is_correct: isCorrect,
            time_taken_seconds: timeTaken
        });

        document.querySelectorAll(".option").forEach(opt => {
            opt.classList.add("disabled");
            if (opt.innerText === currentQuestionData.correct_answer) opt.classList.add("correct");
            else if (opt.innerText === selectedAnswer) opt.classList.add("incorrect");
        });

        submitBtn.classList.add("hidden");
        nextBtn.classList.remove("hidden");
        solutionBtn.classList.remove("hidden");
    }

    function showSolution() {
        solutionBox.innerText = currentQuestionData.solution;
        solutionBox.classList.toggle("hidden");
    }

    async function nextQuestion() {
        if (nextQuestionData) {
            questionCount++;
            currentQuestionData = nextQuestionData;
            nextQuestionData = null;

            displayQuestion(currentQuestionData);
            nextQuestionPromise = fetchQuestion().then(x => nextQuestionData = x);

        } else {
            loadingSpinner.style.display = "flex";
            const data = await nextQuestionPromise;
            loadingSpinner.style.display = "none";

            if (!data) return endPractice();

            questionCount++;
            currentQuestionData = data;
            displayQuestion(data);

            nextQuestionPromise = fetchQuestion().then(x => nextQuestionData = x);
        }
    }

    async function endPractice() {
        clearInterval(timerInterval);

        practiceScreen.classList.add("hidden");
        feedbackScreen.classList.remove("hidden");

        initialBackBtn.style.display = "none";

        if (practiceResults.length === 0) {
            feedbackReport.innerHTML = `
                <div class="apt-report">
                    <p class="apt-empty-message">You didn’t answer any questions.</p>
                </div>`;
            return;
        }

        // --- Stats ---
        const total = practiceResults.length;
        const correct = practiceResults.filter(x => x.is_correct).length;
        const accuracy = Math.round((correct / total) * 100);

        const totalTime = practiceResults.reduce((s, x) => s + x.time_taken_seconds, 0);
        const avgTime = totalTime / total;

        let headline = accuracy >= 80 
                        ? "🔥 Great job!"
                        : accuracy >= 60 
                        ? "💡 Good attempt!"
                        : "🌱 Keep improving!";

        // --- Visual Report UI ---
        feedbackReport.innerHTML = `
            <div class="apt-report">

                <div class="apt-report-header">
                    <div>
                        <h3 class="apt-report-title">Aptitude Practice Summary</h3>
                        <p class="apt-report-subtitle">${headline}</p>
                        <p class="apt-report-topic">
                            Topic: <span>${selectedTopic}</span><br>
                            Questions: <span>${total}</span>
                        </p>
                    </div>

                    <div class="apt-score-wrapper" data-score="${accuracy}">
                        <svg class="apt-score-ring" viewBox="0 0 140 140">
                            <circle class="apt-score-bg" cx="70" cy="70" r="60"></circle>
                            <circle class="apt-score-progress" cx="70" cy="70" r="60"></circle>
                        </svg>
                        <div class="apt-score-text">
                            <span class="apt-score-number">0</span>
                            <span class="apt-score-percent">%</span>
                        </div>
                    </div>
                </div>

                <div class="apt-metrics-grid">
                    <div class="apt-metric-card"><div class="apt-metric-label">Attempted</div><div class="apt-metric-value">${total}</div></div>
                    <div class="apt-metric-card"><div class="apt-metric-label">Correct</div><div class="apt-metric-value apt-good">${correct}</div></div>
                    <div class="apt-metric-card"><div class="apt-metric-label">Accuracy</div><div class="apt-metric-value">${accuracy}%</div></div>
                    <div class="apt-metric-card"><div class="apt-metric-label">Avg Time</div><div class="apt-metric-value">${avgTime.toFixed(1)}s</div></div>
                </div>

                <div class="apt-ai-pro-report">
                    <h2 class="ai-pro-header">✨ AI Coach Insights</h2>

                    <h3><span>📘</span> Overall Summary</h3>
                    <div id="ai-summary"></div>

                    <h3><span>🟦</span> Strongest Topic</h3>
                    <div id="ai-strong"></div>

                    <h3><span>🟥</span> Weakest Topic</h3>
                    <div id="ai-weak"></div>

                    <h3><span>💡</span> Key Takeaway</h3>
                    <div id="ai-keytakeaway"></div>
                </div>
            </div>

            <button class="apt-report-button" onclick="location.href='practice.html'">
                ⬅ Back to Practice Hub
            </button>
        `;

        // --- Loading placeholders ---
        document.getElementById("ai-summary").innerHTML =
            "<div class='ai-bullet'>⏳ Generating summary...</div>";
        document.getElementById("ai-strong").innerHTML =
            "<div class='ai-bullet'>⏳ Finding strongest topic...</div>";
        document.getElementById("ai-weak").innerHTML =
            "<div class='ai-bullet'>⏳ Checking weak areas...</div>";
        document.getElementById("ai-keytakeaway").innerHTML =
            "<div class='ai-bullet'>⏳ Preparing takeaway...</div>";

        // --- Fetch AI report ---
        try {
            const res = await fetch("https://prepmate-backend-x77z.onrender.com/aptitude-feedback", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ results: practiceResults })
            });

            const data = await res.json();
            if (data.error) {
                document.getElementById("ai-summary").innerHTML =
                    `<div class='ai-bullet'>⚠️ ${data.error}</div>`;
                return;
            }

            const fb = data.feedback;

            const summaryMatch = fb.match(/### Overall Summary([\s\S]*?)### Strongest/);
            const strongMatch = fb.match(/### Strongest([\s\S]*?)### Weakest/);
            const weakMatch = fb.match(/### Weakest([\s\S]*?)### Key Takeaway/);
            const keyMatch = fb.match(/### Key Takeaway([\s\S]*)/);

            document.getElementById("ai-summary").innerHTML =
                convertMarkdownToProHTML(summaryMatch ? summaryMatch[1] : "");

            document.getElementById("ai-strong").innerHTML =
                convertMarkdownToProHTML(strongMatch ? strongMatch[1] : "");

            document.getElementById("ai-weak").innerHTML =
                convertMarkdownToProHTML(weakMatch ? weakMatch[1] : "");

            document.getElementById("ai-keytakeaway").innerHTML =
                convertMarkdownToProHTML(keyMatch ? keyMatch[1] : "");

        } catch {
            document.getElementById("ai-summary").innerHTML =
                "<div class='ai-bullet'>⚠️ Server not responding.</div>";
        }
    }

    function restartPractice() {
        feedbackScreen.classList.add("hidden");
        setupScreen.classList.remove("hidden");
        initialBackBtn.style.display = "block";
    }

});
