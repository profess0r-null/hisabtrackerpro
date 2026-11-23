(() => {
  'use strict';

  const overlay = document.getElementById('m-calculator');
  const expressionLine = document.getElementById('calculator-expression');
  const resultLine = document.getElementById('calculator-result');
  const feedback = document.getElementById('calculator-feedback');
  const copyButton = document.getElementById('calculator-copy');
  const banglaDigits = '০১২৩৪৫৬৭৮৯';
  const symbols = { '+': '+', '-': '−', '*': '×', '/': '÷' };
  const keys = { Enter: '=', Backspace: 'backspace', Delete: 'clear', '−': '-', '×': '*', '÷': '/' };
  const messages = {
    invalid: ['হিসাবটি সম্পূর্ণ করুন', 'Complete the expression'],
    division: ['শূন্য দিয়ে ভাগ করা যায় না', 'Cannot divide by zero'],
    range: ['ফলাফল দেখানোর সীমা ছাড়িয়েছে', 'Result is outside the supported range'],
    copied: ['ফলাফল কপি হয়েছে', 'Result copied'],
    copyFailed: ['ফলাফল নির্বাচন করে কপি করুন', 'Select the result to copy it']
  };

  let expression = '';
  let completedExpression = '';
  let result = '0';
  let message = '';

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

  function render() {
    const isBangla = document.documentElement.dataset.lang === 'bn';
    const localize = text => isBangla ? text.replace(/\d/g, digit => banglaDigits[Number(digit)]) : text;
    const formula = (completedExpression || expression).replace(/[+\-*/]/g, operator => symbols[operator]);
    const display = result.replace(/^(\d+|-\d+)(?=\.|$)/, digits => digits.replace(/\B(?=(\d{3})+(?!\d))/g, ','));
    expressionLine.textContent = localize(formula ? formula + (completedExpression ? ' =' : '') : ' ');
    expressionLine.scrollTop = expressionLine.scrollHeight;
    resultLine.textContent = result ? localize(display.replace(/^-/, '−')) : '—';
    copyButton.disabled = !result || !expression;
    feedback.textContent = message ? messages[message][isBangla ? 0 : 1] : '';
  }

  function preview() {
    if (!expression) {
      result = '0';
      return;
    }
    try {
      result = evaluate(expression);
    } catch {
      result = '';
    }
  }

  function input(key) {
    message = '';
    if (key === 'clear') {
      expression = '';
      completedExpression = '';
    } else if (key === 'backspace') {
      if (completedExpression && expression.includes('e')) expression = '';
      else expression = expression.slice(0, -1);
      completedExpression = '';
    } else if (key === '=') {
      if (!expression || completedExpression) return;
      try {
        result = evaluate(expression);
        completedExpression = expression;
        expression = result;
      } catch (error) {
        result = '';
        message = error.message;
      }
      render();
      return;
    } else {
      if (completedExpression && /^[0-9.(]$/.test(key)) expression = '';
      completedExpression = '';

      const last = expression.at(-1);
      const endsValue = /[0-9.)%]/.test(last || '');
      if (key === ')') {
        const open = expression.split('(').length - expression.split(')').length;
        if (!endsValue || open <= 0) return;
      }
      if (key === '%' && (!endsValue || last === '%')) return;
      if (key === '.' && /(?:^|[()+\-*/])\d*\.\d*$/.test(expression)) return;

      let next = key;
      const implicitProduct = (key === '(' && endsValue) || (/^[0-9.]$/.test(key) && /[)%]/.test(last || ''));
      if (implicitProduct) next = '*' + key;
      if (key === '.' && !/\d$/.test(expression)) next = next === '*.' ? '*0.' : '0.';
      if (/^[+*/]$/.test(key) && !endsValue) {
        if (!/[+\-*/]$/.test(expression)) return;
        const prefix = expression.replace(/[+\-*/]+$/, '');
        if (!/[0-9.)%]$/.test(prefix)) return;
        expression = prefix;
      }
      if (expression.length + next.length > 160) return;
      expression += next;
    }
    preview();
    render();
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
    message = copied ? 'copied' : 'copyFailed';
    render();
  }

  document.getElementById('bnav-calculator').addEventListener('click', event => {
    event.currentTarget.focus({ preventScroll: true });
    overlay.classList.add('on');
    render();
    queueMicrotask(() => resultLine.focus());
  });

  new MutationObserver(() => {
    if (overlay.classList.contains('on')) return;
    input('clear');
  }).observe(overlay, { attributes: true, attributeFilter: ['class'] });

  overlay.addEventListener('click', event => {
    if (event.target === overlay || event.target.closest('[data-calculator-close]')) {
      cm(overlay.id);
      return;
    }
    const button = event.target.closest('[data-calculator-key]');
    if (!button) return;
    input(button.dataset.calculatorKey);
    if (event.detail > 0) resultLine.focus({ preventScroll: true });
  });

  copyButton.addEventListener('click', copyResult);
  overlay.addEventListener('keydown', event => {
    if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return;
    if (event.key === 'Enter' && event.target.closest('button')) return;
    const digit = banglaDigits.indexOf(event.key);
    const key = digit >= 0 && event.key.length === 1 ? String(digit) : (keys[event.key] || event.key);
    if (!/^[0-9.+\-*/%()=]$/.test(key) && key !== 'backspace' && key !== 'clear') return;
    event.preventDefault();
    input(key);
    if (event.target.closest('button')) resultLine.focus({ preventScroll: true });
  });
})();
