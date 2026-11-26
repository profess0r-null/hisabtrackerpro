(() => {
  'use strict';

  const overlay = document.getElementById('m-calculator');
  const displayBox = document.getElementById('ios-calc-display');
  const exprEl = document.getElementById('calculator-expression');
  const exprTextEl = exprEl.querySelector('.ios-expr-text');
  const resultEl = document.getElementById('calculator-result');
  const feedbackEl = document.getElementById('calculator-feedback');
  const copyBtn = document.getElementById('calculator-copy');
  const copyIconEl = document.getElementById('calculator-copy-icon');
  const clearBtn = document.getElementById('calc-clear-btn');
  const historyToggleBtn = document.getElementById('calc-history-toggle');
  const historyPanel = document.getElementById('calc-history-panel');
  const historyList = document.getElementById('calc-history-list');
  const historyCount = document.getElementById('calc-history-count');
  const historyClearBtn = document.getElementById('calc-history-clear');

  const OP_SYMBOLS = { '+': '+', '-': '−', '*': '×', '/': '÷' };
  const MESSAGES = {
    division: ['শূন্য দিয়ে ভাগ করা যায় না', 'Cannot divide by zero'],
    invalid: ['হিসাবটি সম্পূর্ণ করুন', 'Complete the expression'],
    range: ['সীমার বাইরে', 'Out of range'],
    copied: ['কপি হয়েছে', 'Copied'],
    copyFailed: ['কপি ব্যর্থ', 'Copy failed'],
    emptyHistory: ['এখনও কোনো হিসাব নেই', 'No history yet']
  };

  const COPY_SVG = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>';
  const CHECK_SVG = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';

  // Live expression state (always English digits 0-9)
  let expr = '';              // Raw ASCII expression e.g. "200+100"
  let liveResult = '';        // Live evaluated result e.g. "300"
  let solved = false;         // True right after pressing '='
  let solvedExprPretty = '';  // Saved expression shown on top when solved
  let errorState = false;
  let feedbackTimer = null;
  let copyIconTimer = null;
  const history = [];

  function getLangIndex() {
    return document.documentElement.dataset.lang === 'bn' ? 0 : 1;
  }

  function showFeedback(key) {
    clearTimeout(feedbackTimer);
    if (!key) {
      feedbackEl.textContent = '';
      return;
    }
    feedbackEl.textContent = MESSAGES[key][getLangIndex()];
    feedbackTimer = setTimeout(() => {
      feedbackEl.textContent = '';
    }, 2000);
  }

  function formatNumber(raw) {
    if (!raw) return '0';
    if (raw.includes('e') || raw.includes('E')) return raw;
    const neg = raw.startsWith('-');
    const body = neg ? raw.slice(1) : raw;
    const [intP, decP] = body.split('.');
    const grouped = intP.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    const out = decP !== undefined ? `${grouped}.${decP}` : grouped;
    return neg ? `−${out}` : out;
  }

  function formatExpression(rawExpr) {
    if (!rawExpr) return '0';
    return rawExpr
      .replace(/\d+(?:\.\d*)?/g, num => {
        const [i, d] = num.split('.');
        const g = i.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        return d !== undefined ? `${g}.${d}` : g;
      })
      .replace(/[+\-*/]/g, op => OP_SYMBOLS[op] || op);
  }

  // Safe recursive-descent evaluator (CSP-safe, supports operator precedence & %)
  function evaluate(source) {
    const cleaned = source
      .replace(/([\d.)%])\(/g, '$1*(')
      .replace(/([)%])(?=[\d.])/g, '$1*');

    const tokens = cleaned.match(/(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?|[()+\-*/%]/g) || [];
    if (!tokens.length || tokens.join('') !== cleaned) throw new Error('invalid');

    let i = 0;

    function factor() {
      const t = tokens[i++];
      if (t === '+' || t === '-') {
        const op = factor();
        if (t === '-') op.val = -op.val;
        return op;
      }
      let val;
      if (t === '(') {
        val = sum();
        if (tokens[i++] !== ')') throw new Error('invalid');
      } else if (t && /^[\d.]/.test(t)) {
        val = Number(t);
      } else {
        throw new Error('invalid');
      }
      const isPct = tokens[i] === '%';
      if (isPct) i++;
      return { val: isPct ? val / 100 : val, isPct };
    }

    function term() {
      let left = factor();
      while (tokens[i] === '*' || tokens[i] === '/') {
        const op = tokens[i++];
        const right = factor().val;
        if (op === '/' && right === 0) throw new Error('division');
        left = { val: op === '*' ? left.val * right : left.val / right, isPct: false };
      }
      return left;
    }

    function sum() {
      let total = term().val;
      while (tokens[i] === '+' || tokens[i] === '-') {
        const op = tokens[i++];
        const next = term();
        const amt = next.isPct ? total * next.val : next.val;
        total = op === '+' ? total + amt : total - amt;
      }
      return total;
    }

    const res = sum();
    if (i !== tokens.length) throw new Error('invalid');
    if (!Number.isFinite(res)) throw new Error('range');
    if (Object.is(res, -0) || res === 0) return '0';
    const abs = Math.abs(res);
    if (abs >= 1e12 || (abs > 0 && abs < 1e-7)) {
      return res.toExponential(6).replace(/\.?0+e/, 'e');
    }
    return String(Number(res.toPrecision(12)));
  }

  function applySizeClass(el, len) {
    el.classList.remove('size-md', 'size-sm', 'size-xs');
    if (len > 15) el.classList.add('size-xs');
    else if (len > 11) el.classList.add('size-sm');
    else if (len > 8) el.classList.add('size-md');
  }

  function computeLive() {
    if (!expr) {
      liveResult = '';
      return;
    }
    const trimmed = expr.replace(/[+\-*/]+$/, '');
    if (!trimmed) {
      liveResult = '';
      return;
    }
    try {
      liveResult = evaluate(trimmed);
    } catch {
      liveResult = '';
    }
  }

  function render() {
    displayBox.classList.toggle('is-solved', solved && !errorState);

    if (errorState) {
      exprTextEl.textContent = formatExpression(expr);
      resultEl.textContent = 'Error';
      applySizeClass(exprEl, exprTextEl.textContent.length);
      resultEl.classList.remove('size-md', 'size-sm', 'size-xs');
      clearBtn.textContent = 'AC';
      copyBtn.disabled = true;
      return;
    }

    if (solved) {
      exprTextEl.textContent = solvedExprPretty;
      const resStr = `= ${formatNumber(liveResult)}`;
      resultEl.textContent = resStr;
      exprEl.classList.remove('size-md', 'size-sm', 'size-xs');
      applySizeClass(resultEl, resStr.length);
      clearBtn.textContent = 'AC';
      copyBtn.disabled = !liveResult;
      return;
    }

    computeLive();
    const pretty = formatExpression(expr);
    exprTextEl.textContent = pretty;
    applySizeClass(exprEl, pretty.length);
    exprEl.scrollLeft = exprEl.scrollWidth;

    const hasOp = /[+\-*/%]/.test(expr.replace(/^-/, ''));
    if (liveResult && hasOp) {
      resultEl.textContent = `= ${formatNumber(liveResult)}`;
    } else if (expr) {
      resultEl.textContent = `= ${formatNumber(liveResult || expr)}`;
    } else {
      resultEl.textContent = '';
    }
    resultEl.classList.remove('size-md', 'size-sm', 'size-xs');

    clearBtn.textContent = expr ? 'C' : 'AC';
    copyBtn.disabled = !liveResult && (!expr || /[+\-*/]$/.test(expr));
  }

  function renderHistory() {
    if (history.length > 0) {
      historyCount.textContent = String(history.length);
      historyCount.hidden = false;
    } else {
      historyCount.hidden = true;
    }

    if (history.length === 0) {
      historyList.innerHTML = `<div class="ios-calc-history-empty">${MESSAGES.emptyHistory[getLangIndex()]}</div>`;
      return;
    }

    historyList.innerHTML = '';
    history.forEach((item, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ios-calc-hist-item';
      btn.dataset.historyIndex = String(idx);

      const exprSpan = document.createElement('span');
      exprSpan.className = 'ios-calc-hist-expr';
      exprSpan.textContent = item.expr;

      const resSpan = document.createElement('span');
      resSpan.className = 'ios-calc-hist-res';
      resSpan.textContent = `= ${item.result}`;

      btn.appendChild(exprSpan);
      btn.appendChild(resSpan);
      historyList.appendChild(btn);
    });
  }

  function toggleHistory(forceState) {
    const nextOpen = typeof forceState === 'boolean' ? forceState : historyPanel.hidden;
    historyPanel.hidden = !nextOpen;
    historyToggleBtn.setAttribute('aria-expanded', String(nextOpen));
    if (nextOpen) renderHistory();
  }

  function resetAll() {
    expr = '';
    liveResult = '';
    solved = false;
    solvedExprPretty = '';
    errorState = false;
    showFeedback('');
  }

  function handleKey(key) {
    if (key === 'clear') {
      resetAll();
      render();
      return;
    }

    if (errorState) {
      resetAll();
    }

    if (key === 'backspace') {
      if (solved) {
        // Go back to editing the result number
        expr = liveResult;
        solved = false;
        solvedExprPretty = '';
      }
      expr = expr.slice(0, -1);
      render();
      return;
    }

    if (key === '=') {
      if (!expr || solved) return;
      const candidate = expr.replace(/[+\-*/]+$/, '');
      if (!candidate) return;
      try {
        const res = evaluate(candidate);
        const pretty = formatExpression(candidate);
        solvedExprPretty = pretty;
        liveResult = res;
        expr = res;
        solved = true;

        if (/[+\-*/%]/.test(candidate.replace(/^-/, ''))) {
          history.unshift({
            expr: pretty,
            result: formatNumber(res),
            raw: res
          });
          if (history.length > 30) history.pop();
          renderHistory();
        }
      } catch (err) {
        errorState = true;
        showFeedback(err.message === 'division' ? 'division' : err.message === 'range' ? 'range' : 'invalid');
      }
      render();
      return;
    }

    if (key === 'negate') {
      if (solved) {
        expr = liveResult;
        solved = false;
        solvedExprPretty = '';
      }
      if (!expr) return;
      // Toggle sign of the last number in the expression
      const match = expr.match(/^(.*?)(\(-[\d.]+\)|-?[\d.]+)$/);
      if (match) {
        const prefix = match[1];
        const numPart = match[2];
        if (numPart.startsWith('(-') && numPart.endsWith(')')) {
          expr = prefix + numPart.slice(2, -1);
        } else if (!prefix && numPart.startsWith('-')) {
          expr = numPart.slice(1);
        } else if (!prefix) {
          expr = '-' + numPart;
        } else {
          expr = prefix + '(-' + numPart + ')';
        }
      }
      render();
      return;
    }

    if (/^[0-9]$/.test(key)) {
      if (solved) {
        expr = '';
        solved = false;
        solvedExprPretty = '';
      }
      // Avoid leading zeros like "00" on a fresh operand
      const lastSegment = expr.split(/[+\-*/()]/).pop() || '';
      if (lastSegment === '0') {
        expr = expr.slice(0, -1) + key;
      } else if (expr.length < 60) {
        expr += key;
      }
      render();
      return;
    }

    if (key === '.') {
      if (solved) {
        expr = '';
        solved = false;
        solvedExprPretty = '';
      }
      const lastSegment = expr.split(/[+\-*/()]/).pop() || '';
      if (lastSegment.includes('.')) return;
      if (!lastSegment) expr += '0.';
      else expr += '.';
      render();
      return;
    }

    if (OP_SYMBOLS[key] || key === '%') {
      if (solved) {
        expr = liveResult;
        solved = false;
        solvedExprPretty = '';
      }
      if (!expr) {
        if (key === '-') expr = '-';
        render();
        return;
      }
      if (OP_SYMBOLS[key] && /[+\-*/]$/.test(expr)) {
        expr = expr.slice(0, -1) + key;
      } else if (key === '%' && /[+\-*/%]$/.test(expr)) {
        return;
      } else if (expr.length < 60) {
        expr += key;
      }
      render();
    }
  }

  function flashCopySuccess() {
    showFeedback('copied');
    if (!copyIconEl) return;
    clearTimeout(copyIconTimer);
    copyBtn.classList.add('is-copied');
    copyIconEl.innerHTML = CHECK_SVG;
    copyIconTimer = setTimeout(() => {
      copyBtn.classList.remove('is-copied');
      copyIconEl.innerHTML = COPY_SVG;
    }, 1500);
  }

  async function copyResult() {
    if (copyBtn.disabled || errorState) return;
    const valToCopy = liveResult || expr;
    if (!valToCopy) return;
    try {
      await navigator.clipboard.writeText(valToCopy);
      flashCopySuccess();
    } catch {
      try {
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(resultEl);
        selection.removeAllRanges();
        selection.addRange(range);
        document.execCommand('copy');
        selection.removeAllRanges();
        flashCopySuccess();
      } catch {
        showFeedback('copyFailed');
      }
    }
  }

  const openBtn = document.getElementById('bnav-calculator');
  if (openBtn) {
    openBtn.addEventListener('click', event => {
      event.currentTarget.focus({ preventScroll: true });
      toggleHistory(false);
      overlay.classList.add('on');
      render();
    });
  }

  new MutationObserver(() => {
    if (!overlay.classList.contains('on')) {
      toggleHistory(false);
    }
  }).observe(overlay, { attributes: true, attributeFilter: ['class'] });

  overlay.addEventListener('click', event => {
    if (event.target === overlay || event.target.closest('[data-calculator-close]')) {
      cm(overlay.id);
      return;
    }

    const histItem = event.target.closest('[data-history-index]');
    if (histItem) {
      const entry = history[Number(histItem.dataset.historyIndex)];
      if (entry) {
        errorState = false;
        solved = false;
        solvedExprPretty = '';
        expr = entry.raw;
        toggleHistory(false);
        render();
      }
      return;
    }

    const keyBtn = event.target.closest('[data-calculator-key]');
    if (keyBtn) {
      handleKey(keyBtn.dataset.calculatorKey);
    }
  });

  copyBtn.addEventListener('click', copyResult);
  historyToggleBtn.addEventListener('click', () => toggleHistory());
  historyClearBtn.addEventListener('click', () => {
    history.length = 0;
    renderHistory();
  });

  document.addEventListener('keydown', event => {
    if (!overlay.classList.contains('on')) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;

    const k = event.key;
    let mapped = null;
    if (/^[0-9]$/.test(k)) mapped = k;
    else if (k === '.' || k === ',') mapped = '.';
    else if (k === '+' || k === '-' || k === '*' || k === '/') mapped = k;
    else if (k === 'x' || k === 'X') mapped = '*';
    else if (k === '%') mapped = '%';
    else if (k === 'Enter' || k === '=') mapped = '=';
    else if (k === 'Backspace') mapped = 'backspace';
    else if (k === 'Delete' || k === 'c' || k === 'C') mapped = 'clear';
    else if (k === 'Escape') {
      if (!historyPanel.hidden) toggleHistory(false);
      else cm(overlay.id);
      event.preventDefault();
      return;
    }

    if (mapped) {
      event.preventDefault();
      if (!historyPanel.hidden) toggleHistory(false);
      handleKey(mapped);
      const btn = overlay.querySelector(`[data-calculator-key="${CSS.escape(mapped)}"]`);
      if (btn) {
        btn.classList.add('is-pressed');
        setTimeout(() => btn.classList.remove('is-pressed'), 120);
      }
    }
  });

  render();
})();
