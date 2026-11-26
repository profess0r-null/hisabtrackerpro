(() => {
  'use strict';

  const overlay = document.getElementById('m-calculator');
  const editor = document.getElementById('calculator-expression');
  const resultLine = document.getElementById('calculator-result');
  const feedback = document.getElementById('calculator-feedback');
  const copyButton = document.getElementById('calculator-copy');
  const banglaDigits = '০১২৩৪৫৬৭৮৯';
  const symbols = { '+': '+', '-': '−', '*': '×', '/': '÷' };
  const messages = {
    invalid: ['হিসাবটি সম্পূর্ণ করুন', 'Complete the expression'],
    division: ['শূন্য দিয়ে ভাগ করা যায় না', 'Cannot divide by zero'],
    range: ['ফলাফল দেখানোর সীমা ছাড়িয়েছে', 'Result is outside the supported range'],
    copied: ['ফলাফল কপি হয়েছে', 'Result copied'],
    copyFailed: ['ফলাফল নির্বাচন করে কপি করুন', 'Select the result to copy it']
  };

  let result = '0';
  let solved = false;

  function evaluate(expression) {
    const tokens = expression.match(/(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?|[()+\-*/%]/g) || [];
    if (tokens.join('') !== expression) throw new Error('invalid');
    let index = 0;

    function factor() {
      const token = tokens[index++];
      if (token === '-' || token === '+') {
        const operand = factor();
        if (token === '-') operand.value = -operand.value;
        return operand;
      }

      let value;
      if (token === '(') {
        value = sum();
        if (tokens[index++] !== ')') throw new Error('invalid');
      } else if (token && /^[\d.]/.test(token)) {
        value = Number(token);
      } else {
        throw new Error('invalid');
      }

      const percent = tokens[index] === '%';
      if (percent) index++;
      return { value: percent ? value / 100 : value, percent };
    }

    function product() {
      let term = factor();
      while (tokens[index] === '*' || tokens[index] === '/') {
        const operator = tokens[index++];
        const next = factor().value;
        if (operator === '/' && next === 0) throw new Error('division');
        term = { value: operator === '*' ? term.value * next : term.value / next, percent: false };
      }
      return term;
    }

    function sum() {
      let total = product().value;
      while (tokens[index] === '+' || tokens[index] === '-') {
        const operator = tokens[index++];
        const next = product();
        // An additive percentage is relative to the subtotal it modifies.
        const amount = next.percent ? total * next.value : next.value;
        total = operator === '+' ? total + amount : total - amount;
      }
      return total;
    }

    const value = sum();
    if (index !== tokens.length) throw new Error('invalid');
    if (!Number.isFinite(value)) throw new Error('range');
    // Trim floating-point noise before displaying or reusing the result.
    const rounded = Number(value.toPrecision(14));
    return String(Number.isFinite(rounded) ? rounded : value);
  }

  function localize(text) {
    return document.documentElement.dataset.lang === 'bn'
      ? text.replace(/\d/g, digit => banglaDigits[Number(digit)])
      : text;
  }

  function normalize(text) {
    return text.replace(/[০-৯]/g, digit => banglaDigits.indexOf(digit))
      .replace(/−/g, '-').replace(/×/g, '*').replace(/÷/g, '/').trim()
      .replace(/([\d.)%])\s*\(/g, '$1*(').replace(/([)%])\s*(?=[\d.])/g, '$1*')
      .replace(/\s+/g, '');
  }

  function render(message = '') {
    const display = result.replace(/^-?\d+(?=\.|$)/, digits => digits.replace(/\B(?=(\d{3})+(?!\d))/g, ','));
    resultLine.textContent = result ? localize(display.replace(/^-/, '−')) : '—';
    copyButton.disabled = !result || !editor.value.trim();
    const lang = document.documentElement.dataset.lang === 'bn' ? 0 : 1;
    feedback.textContent = message ? messages[message][lang] : '';
  }

  function calculate(confirm = false) {
    const expression = normalize(editor.value);
    result = expression ? '' : '0';
    let errorMessage = '';
    if (expression) {
      try {
        result = evaluate(expression);
        solved = confirm;
        if (confirm) editor.select();
      } catch (error) {
        solved = false;
        if (confirm) errorMessage = error.message;
      }
    } else {
      solved = false;
    }
    render(errorMessage);
  }

  function press(key) {
    if (key === 'clear') {
      editor.value = '';
      calculate();
      return;
    }
    if (key === '=') {
      calculate(true);
      return;
    }

    let start = editor.selectionStart;
    const end = editor.selectionEnd;
    const replacement = symbols[key] || localize(key);

    if (key === 'backspace') {
      if (start === end) start = Math.max(0, start - 1);
      editor.setRangeText('', start, end, 'end');
    } else {
      const selectedAll = start === 0 && end === editor.value.length;
      if (solved && selectedAll && /^[+\-*/%]$/.test(key)) {
        editor.value = localize(result.replace(/^-/, '−')) + replacement;
      } else if (editor.value.length - (end - start) + replacement.length <= editor.maxLength) {
        editor.setRangeText(replacement, start, end, 'end');
      }
    }
    calculate();
  }

  async function copyResult() {
    if (copyButton.disabled) return;
    const value = result;
    let copied = false;
    try {
      await navigator.clipboard.writeText(value);
      copied = true;
    } catch {
      if (!overlay.classList.contains('on')) return;
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(resultLine);
      selection.removeAllRanges();
      selection.addRange(range);
    }
    if (!overlay.classList.contains('on') || result !== value) return;
    render(copied ? 'copied' : 'copyFailed');
  }

  document.getElementById('bnav-calculator').addEventListener('click', event => {
    event.currentTarget.focus({ preventScroll: true });
    overlay.classList.add('on');
    render();
    queueMicrotask(() => editor.focus({ preventScroll: true }));
  });

  new MutationObserver(() => {
    if (!overlay.classList.contains('on')) press('clear');
  }).observe(overlay, { attributes: true, attributeFilter: ['class'] });

  overlay.addEventListener('click', event => {
    if (event.target === overlay || event.target.closest('[data-calculator-close]')) {
      cm(overlay.id);
      return;
    }
    const button = event.target.closest('[data-calculator-key]');
    if (!button) return;
    editor.focus({ preventScroll: true });
    press(button.dataset.calculatorKey);
  });

  copyButton.addEventListener('click', copyResult);
  editor.addEventListener('input', () => calculate());
  editor.addEventListener('keydown', event => {
    if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return;
    const { key } = event;
    if (key === 'Enter' || key === '=') {
      event.preventDefault();
      calculate(true);
      return;
    }
    const operator = { '−': '-', '×': '*', '÷': '/' }[key] || key;
    if (solved && editor.selectionStart === 0 && editor.selectionEnd === editor.value.length && /^[+\-*/%]$/.test(operator)) {
      event.preventDefault();
      press(operator);
    }
  });
})();
