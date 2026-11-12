(() => {
  const expressionDisplay = document.getElementById("expressionDisplay");
  const resultDisplay = document.getElementById("resultDisplay");
  const angleModeBtn = document.getElementById("angleModeBtn");
  const secondBtn = document.getElementById("secondBtn");
  const secondBadge = document.getElementById("secondBadge");
  const memoryBadge = document.getElementById("memoryBadge");
  const copyBtn = document.getElementById("copyBtn");
  const themeToggleBtn = document.getElementById("themeToggleBtn");
  const themeSvgSun = document.getElementById("themeSvgSun");
  const themeSvgMoon = document.getElementById("themeSvgMoon");
  const themeLabel = document.getElementById("themeLabel");
  const historyPanel = document.getElementById("historyPanel");
  const historyToggleBtn = document.getElementById("historyToggleBtn");
  const historyList = document.getElementById("historyList");
  const clearHistoryBtn = document.getElementById("clearHistoryBtn");

  const STORAGE_KEYS = {
    THEME: "scicalc_theme",
    HISTORY: "scicalc_history",
  };

  let expression = "";
  let lastAnswer = 0;
  let memory = 0;
  let angleMode = "DEG"; // "DEG" | "RAD"
  let isSecond = false;
  let justEvaluated = false;
  let history = loadHistory();

  // Initialize UI
  applySavedTheme();
  renderHistory();
  updateDisplay();

  // --- Theme Handling ---
  function applySavedTheme() {
    const saved = localStorage.getItem(STORAGE_KEYS.THEME) || "light";
    setTheme(saved);
  }

  function setTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(STORAGE_KEYS.THEME, theme);
    if (theme === "light") {
      themeSvgSun.classList.add("hidden");
      themeSvgMoon.classList.remove("hidden");
      themeLabel.textContent = "Dark";
    } else {
      themeSvgSun.classList.remove("hidden");
      themeSvgMoon.classList.add("hidden");
      themeLabel.textContent = "Light";
    }
  }

  themeToggleBtn.addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme");
    setTheme(current === "dark" ? "light" : "dark");
  });

  // --- Mobile History Drawer ---
  historyToggleBtn.addEventListener("click", () => {
    historyPanel.classList.toggle("open");
  });

  // --- Angle Mode & 2nd Mode ---
  angleModeBtn.addEventListener("click", () => {
    angleMode = angleMode === "DEG" ? "RAD" : "DEG";
    angleModeBtn.textContent = angleMode;
    updateLivePreview();
  });

  function toggleSecondMode(forceState) {
    isSecond = typeof forceState === "boolean" ? forceState : !isSecond;
    secondBtn.classList.toggle("is-active", isSecond);
    secondBadge.classList.toggle("hidden", !isSecond);

    document.querySelectorAll(".key[data-alt-fn], .key[data-alt-op]").forEach((btn) => {
      if (btn.dataset.altFn) {
        if (!btn.dataset.primaryLabel) btn.dataset.primaryLabel = btn.textContent;
        btn.textContent = isSecond ? formatFnLabel(btn.dataset.altFn) : btn.dataset.primaryLabel;
      } else if (btn.dataset.altOp) {
        if (!btn.dataset.primaryLabel) btn.dataset.primaryLabel = btn.textContent;
        btn.textContent = isSecond ? formatOpLabel(btn.dataset.altOp) : btn.dataset.primaryLabel;
      }
    });
  }

  function formatFnLabel(fn) {
    const labels = {
      asin: "sin⁻¹",
      acos: "cos⁻¹",
      atan: "tan⁻¹",
      cbrt: "∛x",
    };
    return labels[fn] || fn;
  }

  function formatOpLabel(op) {
    const labels = {
      "10^": "10ˣ",
      "e^": "eˣ",
      "^3": "x³",
    };
    return labels[op] || op;
  }

  // --- Copy Result ---
  copyBtn.addEventListener("click", async () => {
    const text = resultDisplay.textContent;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      copyBtn.textContent = "Copied!";
      setTimeout(() => {
        copyBtn.textContent = "Copy";
      }, 1200);
    } catch {
      copyBtn.textContent = "Failed";
      setTimeout(() => {
        copyBtn.textContent = "Copy";
      }, 1200);
    }
  });

  // --- Keypad Events ---
  document.querySelector(".keypad").addEventListener("click", (e) => {
    const btn = e.target.closest("button.key");
    if (!btn) return;

    const { value, fn, altFn, op, altOp, action } = btn.dataset;

    if (action) {
      handleAction(action);
      return;
    }

    if (isSecond && altFn) {
      appendFunction(altFn);
      return;
    }

    if (isSecond && altOp) {
      appendOperatorOrPrefix(altOp);
      return;
    }

    if (fn) {
      appendFunction(fn);
      return;
    }

    if (op) {
      appendOperatorOrPrefix(op);
      return;
    }

    if (value !== undefined) {
      appendValue(value);
    }
  });

  // --- Memory Events ---
  document.querySelector(".memory-row").addEventListener("click", (e) => {
    const btn = e.target.closest("button.mem-btn");
    if (!btn) return;

    const action = btn.dataset.action;
    const currentVal = getCurrentNumericValue();

    if (action === "mc") {
      memory = 0;
    } else if (action === "mr") {
      appendValue(formatNumber(memory));
      return;
    } else if (action === "m-plus" && currentVal !== null) {
      memory += currentVal;
    } else if (action === "m-minus" && currentVal !== null) {
      memory -= currentVal;
    } else if (action === "ans") {
      appendValue("ANS");
      return;
    }

    memoryBadge.classList.toggle("hidden", memory === 0);
  });

  function getCurrentNumericValue() {
    const parsed = Number(resultDisplay.textContent);
    if (!Number.isNaN(parsed) && Number.isFinite(parsed)) {
      return parsed;
    }
    return null;
  }

  // --- Input Helpers ---
  function appendValue(val) {
    const isBinaryOp = ["+", "-", "*", "/", "%"].includes(val);

    if (justEvaluated) {
      if (isBinaryOp) {
        expression = formatNumber(lastAnswer);
      } else {
        expression = "";
      }
      justEvaluated = false;
    }

    if (val === "E") {
      if (!expression || !/\d$/.test(expression)) {
        expression += "1E";
      } else {
        expression += "E";
      }
      updateDisplay();
      return;
    }

    expression += val;
    updateDisplay();
  }

  function appendFunction(fnName) {
    if (justEvaluated) {
      expression = "";
      justEvaluated = false;
    }
    expression += `${fnName}(`;
    updateDisplay();
  }

  function appendOperatorOrPrefix(op) {
    if (op === "inv") {
      if (justEvaluated) {
        expression = `${formatNumber(lastAnswer)}^(-1)`;
        justEvaluated = false;
      } else if (!expression || /[+\-*/%(^]$/.test(expression)) {
        expression += "1/(";
      } else {
        expression += "^(-1)";
      }
      updateDisplay();
      return;
    }

    if (op === "10^" || op === "e^") {
      if (justEvaluated) {
        expression = "";
        justEvaluated = false;
      }
      expression += `${op}(`;
      updateDisplay();
      return;
    }

    if (justEvaluated) {
      expression = formatNumber(lastAnswer);
      justEvaluated = false;
    }

    if (!expression && op !== "-") {
      expression = "0";
    }

    expression += op;
    updateDisplay();
  }

  function handleAction(action) {
    switch (action) {
      case "second":
        toggleSecondMode();
        break;
      case "clear":
        expression = "";
        justEvaluated = false;
        resultDisplay.textContent = "0";
        expressionDisplay.textContent = "";
        break;
      case "delete":
        if (justEvaluated) {
          expression = "";
          justEvaluated = false;
          updateDisplay();
          return;
        }
        expression = removeLastToken(expression);
        updateDisplay();
        break;
      case "negate":
        toggleSign();
        break;
      case "equals":
        evaluateFinal();
        break;
    }
  }

  function removeLastToken(expr) {
    if (!expr) return "";
    const fnMatch = expr.match(/(asin|acos|atan|sqrt|cbrt|sin|cos|tan|log|abs|ln)\($/);
    if (fnMatch) {
      return expr.slice(0, -fnMatch[0].length);
    }
    if (expr.endsWith("ANS")) {
      return expr.slice(0, -3);
    }
    return expr.slice(0, -1);
  }

  function toggleSign() {
    if (justEvaluated) {
      lastAnswer = -lastAnswer;
      expression = formatNumber(lastAnswer);
      justEvaluated = false;
      updateDisplay();
      return;
    }
    if (!expression) {
      expression = "-";
      updateDisplay();
      return;
    }
    const match = expression.match(/(.*?)(-?\d*\.?\d+)$/);
    if (match) {
      const prefix = match[1];
      const num = match[2];
      if (num.startsWith("-")) {
        expression = prefix + num.slice(1);
      } else {
        expression = prefix + "(-" + num + ")";
      }
    } else if (expression.startsWith("-(") && expression.endsWith(")")) {
      expression = expression.slice(2, -1);
    } else {
      expression = `-(${expression})`;
    }
    updateDisplay();
  }

  // --- Display & Evaluation ---
  function updateDisplay() {
    expressionDisplay.textContent = formatDisplayExpression(expression);
    updateLivePreview();
  }

  function formatDisplayExpression(expr) {
    return expr.replace(/\*/g, "×").replace(/\//g, "÷");
  }

  function updateLivePreview() {
    if (!expression) {
      resultDisplay.textContent = "0";
      return;
    }
    try {
      const balanced = autoCloseParens(expression);
      const val = evaluateExpression(balanced);
      resultDisplay.textContent = formatNumber(val);
    } catch {
      // Keep previous/incomplete display calm while user is typing
      if (justEvaluated) {
        resultDisplay.textContent = "Error";
      }
    }
  }

  function evaluateFinal() {
    if (!expression) return;
    const balanced = autoCloseParens(expression);
    try {
      const val = evaluateExpression(balanced);
      const formatted = formatNumber(val);
      addToHistory(formatDisplayExpression(balanced), formatted);
      lastAnswer = val;
      expressionDisplay.textContent = `${formatDisplayExpression(balanced)} =`;
      resultDisplay.textContent = formatted;
      expression = formatted;
      justEvaluated = true;
    } catch (err) {
      expressionDisplay.textContent = formatDisplayExpression(expression);
      resultDisplay.textContent = err.message || "Error";
      justEvaluated = true;
    }
  }

  function autoCloseParens(expr) {
    let open = 0;
    for (const ch of expr) {
      if (ch === "(") open++;
      else if (ch === ")" && open > 0) open--;
    }
    return expr + ")".repeat(open);
  }

  function formatNumber(num) {
    if (Object.is(num, -0)) num = 0;
    if (!Number.isFinite(num)) throw new Error("Math Error");
    const rounded = Number(num.toPrecision(12));
    if (Math.abs(rounded) >= 1e12 || (rounded !== 0 && Math.abs(rounded) < 1e-8)) {
      return rounded.toExponential(6).replace(/\.?0+e/, "e");
    }
    return String(rounded);
  }

  // --- Tokenizer & Recursive Descent Parser ---
  function tokenize(input) {
    const tokens = [];
    let i = 0;

    while (i < input.length) {
      const ch = input[i];

      if (/\s/.test(ch)) {
        i++;
        continue;
      }

      // Number (including scientific notation like 2E5 or 1.5E-3)
      if (/\d/.test(ch) || (ch === "." && /\d/.test(input[i + 1] || ""))) {
        let numStr = "";
        while (i < input.length && /[\d.]/.test(input[i])) {
          numStr += input[i++];
        }
        const nextChar = input[i];
        const afterExp = input[i + 1] || "";
        const isSciExp =
          nextChar === "E" ||
          (nextChar === "e" && (/[+-]/.test(afterExp) || /\d/.test(afterExp)));

        if (isSciExp) {
          numStr += "e";
          i++;
          if (input[i] === "+" || input[i] === "-") {
            numStr += input[i++];
          }
          if (!/\d/.test(input[i] || "")) {
            throw new Error("Syntax Error");
          }
          while (i < input.length && /\d/.test(input[i])) {
            numStr += input[i++];
          }
        }
        const val = Number(numStr);
        if (Number.isNaN(val)) throw new Error("Syntax Error");
        tokens.push({ type: "number", value: val });
        continue;
      }

      // Identifiers (functions & constants)
      if (/[a-zA-Zπ]/.test(ch)) {
        let id = "";
        while (i < input.length && /[a-zA-Zπ]/.test(input[i])) {
          id += input[i++];
        }
        tokens.push({ type: "ident", value: id });
        continue;
      }

      if ("+-*/%^!".includes(ch)) {
        tokens.push({ type: "op", value: ch });
        i++;
        continue;
      }

      if (ch === "(") {
        tokens.push({ type: "lparen" });
        i++;
        continue;
      }

      if (ch === ")") {
        tokens.push({ type: "rparen" });
        i++;
        continue;
      }

      throw new Error("Syntax Error");
    }

    return insertImplicitMultiplication(tokens);
  }

  function isValueEnd(tok) {
    if (!tok) return false;
    if (tok.type === "number" || tok.type === "rparen") return true;
    if (tok.type === "op" && tok.value === "!") return true;
    if (tok.type === "ident" && ["π", "e", "ANS"].includes(tok.value)) return true;
    return false;
  }

  function isValueStart(tok) {
    if (!tok) return false;
    return tok.type === "number" || tok.type === "lparen" || tok.type === "ident";
  }

  function insertImplicitMultiplication(tokens) {
    const out = [];
    for (let i = 0; i < tokens.length; i++) {
      const prev = tokens[i - 1];
      const curr = tokens[i];
      if (isValueEnd(prev) && isValueStart(curr)) {
        out.push({ type: "op", value: "*" });
      }
      out.push(curr);
    }
    return out;
  }

  function evaluateExpression(expr) {
    const tokens = tokenize(expr);
    if (tokens.length === 0) return 0;

    let pos = 0;
    const peek = () => tokens[pos];
    const consume = () => tokens[pos++];

    function parseExpr() {
      let left = parseTerm();
      while (peek()?.type === "op" && (peek().value === "+" || peek().value === "-")) {
        const op = consume().value;
        const right = parseTerm();
        left = op === "+" ? left + right : left - right;
      }
      return left;
    }

    function parseTerm() {
      let left = parseUnary();
      while (peek()?.type === "op" && ["*", "/", "%"].includes(peek().value)) {
        const op = consume().value;
        const right = parseUnary();
        if (op === "*") left *= right;
        else if (op === "/") {
          if (right === 0) throw new Error("Divide by 0");
          left /= right;
        } else {
          if (right === 0) throw new Error("Divide by 0");
          left %= right;
        }
      }
      return left;
    }

    function parseUnary() {
      if (peek()?.type === "op" && (peek().value === "+" || peek().value === "-")) {
        const op = consume().value;
        const val = parseUnary();
        return op === "-" ? -val : val;
      }
      return parsePower();
    }

    function parsePower() {
      const base = parsePostfix();
      if (peek()?.type === "op" && peek().value === "^") {
        consume();
        const exp = parseUnary();
        const res = Math.pow(base, exp);
        if (Number.isNaN(res)) throw new Error("Math Error");
        return res;
      }
      return base;
    }

    function parsePostfix() {
      let val = parsePrimary();
      while (peek()?.type === "op" && peek().value === "!") {
        consume();
        val = factorial(val);
      }
      return val;
    }

    function parsePrimary() {
      const tok = peek();
      if (!tok) throw new Error("Syntax Error");

      if (tok.type === "number") {
        consume();
        return tok.value;
      }

      if (tok.type === "lparen") {
        consume();
        const val = parseExpr();
        if (peek()?.type !== "rparen") throw new Error("Syntax Error");
        consume();
        return val;
      }

      if (tok.type === "ident") {
        consume();
        if (tok.value === "π") return Math.PI;
        if (tok.value === "e") return Math.E;
        if (tok.value === "ANS") return lastAnswer;

        if (peek()?.type !== "lparen") throw new Error("Syntax Error");
        consume();
        const arg = parseExpr();
        if (peek()?.type !== "rparen") throw new Error("Syntax Error");
        consume();
        return applyFunction(tok.value, arg);
      }

      throw new Error("Syntax Error");
    }

    const result = parseExpr();
    if (pos < tokens.length) throw new Error("Syntax Error");
    return result;
  }

  function applyFunction(name, x) {
    const toRad = (deg) => (deg * Math.PI) / 180;
    const toDeg = (rad) => (rad * 180) / Math.PI;

    switch (name) {
      case "sin": {
        const rad = angleMode === "DEG" ? toRad(x) : x;
        const val = Math.sin(rad);
        return Math.abs(val) < 1e-12 ? 0 : val;
      }
      case "cos": {
        const rad = angleMode === "DEG" ? toRad(x) : x;
        const val = Math.cos(rad);
        return Math.abs(val) < 1e-12 ? 0 : val;
      }
      case "tan": {
        const rad = angleMode === "DEG" ? toRad(x) : x;
        if (Math.abs(Math.cos(rad)) < 1e-12) throw new Error("Math Error");
        const val = Math.tan(rad);
        return Math.abs(val) < 1e-12 ? 0 : val;
      }
      case "asin": {
        if (x < -1 || x > 1) throw new Error("Math Error");
        const val = Math.asin(x);
        return angleMode === "DEG" ? toDeg(val) : val;
      }
      case "acos": {
        if (x < -1 || x > 1) throw new Error("Math Error");
        const val = Math.acos(x);
        return angleMode === "DEG" ? toDeg(val) : val;
      }
      case "atan": {
        const val = Math.atan(x);
        return angleMode === "DEG" ? toDeg(val) : val;
      }
      case "log":
        if (x <= 0) throw new Error("Math Error");
        return Math.log10(x);
      case "ln":
        if (x <= 0) throw new Error("Math Error");
        return Math.log(x);
      case "sqrt":
        if (x < 0) throw new Error("Math Error");
        return Math.sqrt(x);
      case "cbrt":
        return Math.cbrt(x);
      case "abs":
        return Math.abs(x);
      default:
        throw new Error("Syntax Error");
    }
  }

  function factorial(n) {
    if (!Number.isInteger(n) || n < 0 || n > 170) {
      throw new Error("Math Error");
    }
    let res = 1;
    for (let i = 2; i <= n; i++) {
      res *= i;
    }
    return res;
  }

  // --- History Management ---
  function loadHistory() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.HISTORY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function saveHistory() {
    localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history));
  }

  function addToHistory(expr, res) {
    history.unshift({ expr, res });
    if (history.length > 30) history.pop();
    saveHistory();
    renderHistory();
  }

  function renderHistory() {
    if (history.length === 0) {
      historyList.innerHTML = `<p class="history-empty">No calculations yet.</p>`;
      return;
    }

    historyList.innerHTML = "";
    history.forEach((item) => {
      const div = document.createElement("div");
      div.className = "history-item";
      div.innerHTML = `
        <div class="history-expr">${escapeHtml(item.expr)}</div>
        <div class="history-res">= ${escapeHtml(item.res)}</div>
      `;
      div.addEventListener("click", () => {
        expression = item.res;
        justEvaluated = false;
        updateDisplay();
        historyPanel.classList.remove("open");
      });
      historyList.appendChild(div);
    });
  }

  clearHistoryBtn.addEventListener("click", () => {
    history = [];
    saveHistory();
    renderHistory();
  });

  function escapeHtml(str) {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  // --- Keyboard Support ---
  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    const key = e.key;
    if (/^[0-9.]$/.test(key) || ["+", "-", "*", "/", "%", "(", ")", "^"].includes(key)) {
      e.preventDefault();
      appendValue(key);
    } else if (key === "Enter" || key === "=") {
      e.preventDefault();
      evaluateFinal();
    } else if (key === "Backspace") {
      e.preventDefault();
      handleAction("delete");
    } else if (key === "Escape") {
      e.preventDefault();
      handleAction("clear");
    } else if (key === "!") {
      e.preventDefault();
      appendOperatorOrPrefix("!");
    }
  });
})();
