const urlInput = document.getElementById('urlInput');
const goBtn = document.getElementById('goBtn');
const backBtn = document.getElementById('backBtn');
const forwardBtn = document.getElementById('forwardBtn');
const reloadBtn = document.getElementById('reloadBtn');
const loadingIndicator = document.getElementById('loadingIndicator');
const inspectorSidebar = document.getElementById('inspectorSidebar');
const closeInspector = document.getElementById('closeInspector');
const inspectorContent = document.getElementById('inspectorContent');
const consoleContent = document.getElementById('consoleContent');
const clearConsole = document.getElementById('clearConsole');
const webview = document.getElementById('browserWebview');
const elementInspectorBtn = document.getElementById('elementInspectorBtn');
const hoverHighlightBtn = document.getElementById('hoverHighlightBtn');
const toggleConsoleBtn = document.getElementById('toggleConsoleBtn');
const rulerBtn = document.getElementById('rulerBtn');
const rulerPanel = document.getElementById('rulerPanel');
const rulerPanelBody = document.getElementById('rulerPanelBody');
const closeRulerPanel = document.getElementById('closeRulerPanel');

// Cache do último resultado de "todos os elementos" para o botão salvar TXT
let lastAllElementsResult = null;

// Estado do highlight no hover
let hoverHighlightActive = false;

// Estado da régua
let rulerActive = false;
let rulerFirstElement = null;

// Aguardar webview carregar
webview.addEventListener('dom-ready', () => {
  logToConsole('Webview pronto', 'info');
  updateNavigationButtons();

  // Se o usuário deixou o destaque mágico ligado, reinjeta em páginas novas/reload.
  if (hoverHighlightActive) {
    setTimeout(() => enableHoverHighlightOnPage({ silent: true }), 150);
  }
});

// Navegação
function navigate(url) {
  if (!url || url.trim() === '') return;
  
  url = url.trim();
  
  if (!url.match(/^https?:\/\//i)) {
    if (url.includes(' ') || !url.includes('.')) {
      url = `https://www.google.com/search?q=${encodeURIComponent(url)}`;
    } else {
      url = 'https://' + url;
    }
  }
  
  logToConsole('Navegando para: ' + url, 'info');
  webview.loadURL(url);
  urlInput.value = url;
}

goBtn.addEventListener('click', () => {
  navigate(urlInput.value);
});

urlInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    navigate(urlInput.value);
  }
});

backBtn.addEventListener('click', () => {
  if (webview.canGoBack()) {
    webview.goBack();
  }
});

forwardBtn.addEventListener('click', () => {
  if (webview.canGoForward()) {
    webview.goForward();
  }
});

reloadBtn.addEventListener('click', () => {
  webview.reload();
  logToConsole('Página recarregada', 'info');
});

// Loading
webview.addEventListener('did-start-loading', () => {
  loadingIndicator.classList.add('active');
});

webview.addEventListener('did-stop-loading', () => {
  loadingIndicator.classList.remove('active');
  urlInput.value = webview.getURL();
  updateNavigationButtons();
});

webview.addEventListener('did-finish-load', () => {
  logToConsole(`Página carregada: ${webview.getTitle()}`, 'info');
  document.title = `${webview.getTitle()} - Inspector Ninja`;
});

webview.addEventListener('did-fail-load', (event) => {
  logToConsole(`Erro ao carregar: ${event.errorDescription}`, 'error');
});

// Context menu (botão direito) - CAPTURA TUDO
webview.addEventListener('context-menu', async (e) => {
  e.preventDefault();
  
  // Se a régua estiver ativa, o handler dela cuida do clique (declarado mais abaixo)
  if (rulerActive) return;
  
  const result = await webview.executeJavaScript(`
    (function() {
      const element = document.elementFromPoint(${e.params.x}, ${e.params.y});
      if (!element) return null;
      
      function getAbsoluteXPath(element) {
        if (!element || element.nodeType !== Node.ELEMENT_NODE) return '';
        const path = [];
        while (element && element.nodeType === Node.ELEMENT_NODE) {
          let index = 0;
          for (let sibling = element.previousSibling; sibling; sibling = sibling.previousSibling) {
            if (sibling.nodeType === Node.ELEMENT_NODE && sibling.nodeName === element.nodeName) {
              index++;
            }
          }
          const tagName = element.nodeName.toLowerCase();
          const pathIndex = index > 0 ? '[' + (index + 1) + ']' : '';
          path.unshift(tagName + pathIndex);
          element = element.parentNode;
        }
        return path.length ? '/' + path.join('/') : '';
      }
      
      function getRelativeXPath(element) {
        if (element.id) return '//*[@id="' + element.id + '"]';
        if (element === document.body) return '//body';
        let ix = 0;
        const siblings = element.parentNode ? element.parentNode.childNodes : [];
        for (let i = 0; i < siblings.length; i++) {
          const sibling = siblings[i];
          if (sibling === element) {
            const parentPath = element.parentNode && element.parentNode !== document.body 
              ? getRelativeXPath(element.parentNode) 
              : '';
            return parentPath + '/' + element.tagName.toLowerCase() + '[' + (ix + 1) + ']';
          }
          if (sibling.nodeType === 1 && sibling.tagName === element.tagName) {
            ix++;
          }
        }
        return '';
      }
      
      function getCssSelector(element) {
        if (element.id) return '#' + element.id;
        const path = [];
        while (element && element.nodeType === Node.ELEMENT_NODE) {
          let selector = element.nodeName.toLowerCase();
          if (element.id) {
            path.unshift('#' + element.id);
            break;
          }
          if (element.className) {
            const classes = element.className.trim().split(/\\s+/).filter(c => c);
            if (classes.length > 0) {
              selector += '.' + classes.join('.');
            }
          }
          let sibling = element;
          let nth = 1;
          while (sibling.previousElementSibling) {
            sibling = sibling.previousElementSibling;
            if (sibling.nodeName.toLowerCase() === element.nodeName.toLowerCase()) nth++;
          }
          if (nth > 1 || element.nextElementSibling) {
            selector += ':nth-of-type(' + nth + ')';
          }
          path.unshift(selector);
          element = element.parentElement;
        }
        return path.join(' > ');
      }
      
      function getCssPath(element) {
        const path = [];
        while (element && element.nodeType === Node.ELEMENT_NODE) {
          let selector = element.nodeName.toLowerCase();
          if (element.id) {
            selector += '#' + element.id;
            path.unshift(selector);
            break;
          }
          if (element.className) {
            const classes = element.className.trim().split(/\\s+/).filter(c => c);
            if (classes.length > 0) {
              selector += '.' + classes.join('.');
            }
          }
          path.unshift(selector);
          element = element.parentElement;
        }
        return path.join(' > ');
      }
      
      function getClasses(element) {
        if (!element.className) return '';
        const classes = element.className.trim().split(/\\s+/).filter(c => c);
        return classes.join(' ');
      }
      
      function getAllAttributes(element) {
        const attrs = {};
        for (let i = 0; i < element.attributes.length; i++) {
          const attr = element.attributes[i];
          attrs[attr.name] = attr.value;
        }
        return attrs;
      }
      
      function findParentLink(element) {
        let current = element;
        while (current && current !== document.body) {
          if (current.tagName && current.tagName.toLowerCase() === 'a' && current.href) {
            return current.href;
          }
          current = current.parentElement;
        }
        return null;
      }
      
      function getElementType(element) {
        const tag = element.tagName.toLowerCase();
        if (tag === 'a') return 'Link';
        if (tag === 'img') return 'Imagem';
        if (tag === 'button') return 'Botão';
        if (tag === 'input') return 'Campo de Entrada';
        if (tag === 'textarea') return 'Área de Texto';
        if (tag === 'select') return 'Seleção';
        if (['h1','h2','h3','h4','h5','h6'].includes(tag)) return 'Título';
        if (['p', 'span', 'div'].includes(tag)) return 'Texto/Container';
        return 'Elemento';
      }

      function cleanText(value, maxLen) {
        if (!value) return '';
        return String(value).replace(/\\s+/g, ' ').trim().substring(0, maxLen || 120);
      }

      function getDirectText(element) {
        const ownText = [];
        for (let i = 0; i < element.childNodes.length; i++) {
          const node = element.childNodes[i];
          if (node.nodeType === Node.TEXT_NODE) {
            const text = cleanText(node.textContent, 120);
            if (text) ownText.push(text);
          }
        }
        return cleanText(ownText.join(' '), 120);
      }

      function getElementName(element) {
        const candidates = [
          ['aria-label', element.getAttribute('aria-label')],
          ['data-testid', element.getAttribute('data-testid')],
          ['data-test', element.getAttribute('data-test')],
          ['data-cy', element.getAttribute('data-cy')],
          ['title', element.getAttribute('title')],
          ['alt', element.getAttribute('alt')],
          ['placeholder', element.getAttribute('placeholder')],
          ['name', element.getAttribute('name')]
        ];
        for (let i = 0; i < candidates.length; i++) {
          const source = candidates[i][0];
          const value = cleanText(candidates[i][1], 120);
          if (value) return { value: value, source: source };
        }

        const directText = getDirectText(element);
        if (directText) return { value: directText, source: 'texto direto' };

        const tag = element.tagName.toLowerCase();
        if (['button', 'a', 'label', 'summary', 'option', 'th', 'td', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span'].includes(tag)) {
          const visibleText = cleanText(element.innerText || element.textContent, 120);
          if (visibleText) return { value: visibleText, source: 'texto visível' };
        }

        const shortVisibleText = cleanText(element.innerText || element.textContent, 120);
        if (shortVisibleText && shortVisibleText.length <= 120) return { value: shortVisibleText, source: 'texto visível' };

        if (element.id) return { value: '#' + element.id, source: 'id' };
        const classes = getClasses(element);
        if (classes) return { value: '.' + classes.split(/\\s+/).filter(Boolean).slice(0, 4).join('.'), source: 'classe' };
        return { value: 'Sem nome detectável', source: 'fallback' };
      }
      
      const innerText = element.innerText ? element.innerText.trim() : '';
      const textContent = element.textContent ? element.textContent.trim() : '';
      const allAttrs = getAllAttributes(element);
      const directHref = element.href || allAttrs.href || '';
      const parentLinkHref = findParentLink(element);
      const friendlyName = getElementName(element);
      const rect = element.getBoundingClientRect();
      const elementSummaryText = '<' + element.tagName.toLowerCase() + '>' +
        ' | Nome: ' + friendlyName.value +
        (element.id ? ' | ID: ' + element.id : '') +
        (getClasses(element) ? ' | Classes: ' + getClasses(element) : '') +
        ' | CSS: ' + getCssSelector(element) +
        ' | Tamanho: ' + Math.round(rect.width) + 'x' + Math.round(rect.height) + 'px';
      
      return {
        html: element.outerHTML,
        xpathRelative: getRelativeXPath(element),
        xpathAbsolute: getAbsoluteXPath(element),
        cssSelector: getCssSelector(element),
        cssPath: getCssPath(element),
        tagName: element.tagName.toLowerCase(),
        classes: getClasses(element),
        id: element.id || '',
        elementType: getElementType(element),
        elementName: friendlyName.value,
        elementNameSource: friendlyName.source,
        elementSummaryText: elementSummaryText,
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        innerText: innerText.substring(0, 500),
        textContent: textContent.substring(0, 500),
        attributes: allAttrs,
        href: directHref,
        parentLink: parentLinkHref,
        src: element.src || allAttrs.src || '',
        alt: element.alt || allAttrs.alt || '',
        title: element.title || allAttrs.title || '',
        value: element.value || allAttrs.value || '',
        placeholder: element.placeholder || allAttrs.placeholder || '',
        name: element.name || allAttrs.name || ''
      };
    })();
  `);
  
  if (result) {
    displayInspectorSidebar(result);
    logToConsole(`Elemento inspecionado: <${result.tagName}> - ${result.elementType} - ${result.elementName || 'sem nome'}`, 'info');
  }
});

function updateNavigationButtons() {
  backBtn.disabled = !webview.canGoBack();
  forwardBtn.disabled = !webview.canGoForward();
}

closeInspector.addEventListener('click', () => {
  inspectorSidebar.classList.remove('open');
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && inspectorSidebar.classList.contains('open')) {
    inspectorSidebar.classList.remove('open');
  }
  if (e.key === 'Escape' && hoverHighlightActive) {
    deactivateHoverHighlight();
  }
});

function displayInspectorSidebar(data) {
  const copyIcon = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
  </svg>`;
  
  const elementDisplay = `&lt;${data.tagName}&gt;${data.id ? ' #' + escapeHtml(data.id) : ''}${data.classes ? ' .' + escapeHtml(data.classes.split(' ').join(' .')) : ''}`;
  const elementName = data.elementName || data.title || data.alt || data.placeholder || data.name || data.id || 'Sem nome detectável';
  const elementNameSource = data.elementNameSource ? `Fonte: ${data.elementNameSource}` : 'Fonte: heurística';
  const summaryText = data.elementSummaryText || `<${data.tagName}> | Nome: ${elementName} | CSS: ${data.cssSelector || data.cssPath || ''}`;
  
  let content = `
    <div class="copy-option" style="background: var(--bg-tertiary); border: 2px solid var(--accent-neon); margin-bottom: 16px;">
      <div class="copy-option-header">
        <span class="copy-option-label" style="font-size: 13px; color: var(--accent-neon);">📌 ${data.elementType.toUpperCase()}</span>
        <button class="copy-btn" onclick="copyToClipboard('${escapeQuotes(summaryText)}', this)">
          ${copyIcon} COPIAR RESUMO
        </button>
      </div>
      <div class="copy-option-value" style="color: var(--accent-neon); font-size: 13px; font-weight: 600;">
        ${elementDisplay}
      </div>
      <div class="copy-option-value" style="margin-top: 8px; color: var(--text-primary); font-size: 13px; font-weight: 700;">
        📛 Nome: ${escapeHtml(elementName)}
      </div>
      <div style="margin-top: 4px; color: var(--text-muted); font-size: 11px;">
        ${escapeHtml(elementNameSource)}${data.width && data.height ? ` · ${data.width}×${data.height}px` : ''}
      </div>
    </div>

    <div class="copy-option">
      <div class="copy-option-header">
        <span class="copy-option-label">📛 Nome do Elemento</span>
        <button class="copy-btn" onclick="copyToClipboard('${escapeQuotes(elementName)}', this)">
          ${copyIcon} COPIAR
        </button>
      </div>
      <div class="copy-option-value">${escapeHtml(elementName)}</div>
    </div>

    <div class="copy-option">
      <div class="copy-option-header">
        <span class="copy-option-label">🧾 Resumo Copiável</span>
        <button class="copy-btn" onclick="copyToClipboard('${escapeQuotes(summaryText)}', this)">
          ${copyIcon} COPIAR
        </button>
      </div>
      <div class="copy-option-value">${escapeHtml(summaryText)}</div>
    </div>
  `;
  
  if (data.innerText) {
    content += `
    <div class="copy-option">
      <div class="copy-option-header">
        <span class="copy-option-label">📝 Texto Visível</span>
        <button class="copy-btn" onclick="copyToClipboard('${escapeQuotes(data.innerText)}', this)">
          ${copyIcon} COPIAR
        </button>
      </div>
      <div class="copy-option-value">${escapeHtml(data.innerText)}</div>
    </div>
    `;
  }
  
  if (data.href || data.parentLink) {
    const linkToShow = data.href || data.parentLink;
    const linkLabel = data.href ? '🔗 Link (href)' : '🔗 Link do Elemento Pai';
    
    content += `
    <div class="copy-option">
      <div class="copy-option-header">
        <span class="copy-option-label">${linkLabel}</span>
        <button class="copy-btn" onclick="copyToClipboard('${escapeQuotes(linkToShow)}', this)">
          ${copyIcon} COPIAR
        </button>
      </div>
      <div class="copy-option-value" style="color: var(--accent-purple-light);">${escapeHtml(linkToShow)}</div>
    </div>
    `;
  }
  
  if (data.src) {
    content += `
    <div class="copy-option">
      <div class="copy-option-header">
        <span class="copy-option-label">🖼️ Source (src)</span>
        <button class="copy-btn" onclick="copyToClipboard('${escapeQuotes(data.src)}', this)">
          ${copyIcon} COPIAR
        </button>
      </div>
      <div class="copy-option-value">${escapeHtml(data.src)}</div>
    </div>
    `;
  }
  
  if (data.alt) {
    content += `
    <div class="copy-option">
      <div class="copy-option-header">
        <span class="copy-option-label">🏷️ Alt Text</span>
        <button class="copy-btn" onclick="copyToClipboard('${escapeQuotes(data.alt)}', this)">
          ${copyIcon} COPIAR
        </button>
      </div>
      <div class="copy-option-value">${escapeHtml(data.alt)}</div>
    </div>
    `;
  }
  
  if (data.title) {
    content += `
    <div class="copy-option">
      <div class="copy-option-header">
        <span class="copy-option-label">💬 Título</span>
        <button class="copy-btn" onclick="copyToClipboard('${escapeQuotes(data.title)}', this)">
          ${copyIcon} COPIAR
        </button>
      </div>
      <div class="copy-option-value">${escapeHtml(data.title)}</div>
    </div>
    `;
  }
  
  if (data.value) {
    content += `
    <div class="copy-option">
      <div class="copy-option-header">
        <span class="copy-option-label">✏️ Valor</span>
        <button class="copy-btn" onclick="copyToClipboard('${escapeQuotes(data.value)}', this)">
          ${copyIcon} COPIAR
        </button>
      </div>
      <div class="copy-option-value">${escapeHtml(data.value)}</div>
    </div>
    `;
  }
  
  if (data.placeholder) {
    content += `
    <div class="copy-option">
      <div class="copy-option-header">
        <span class="copy-option-label">💭 Placeholder</span>
        <button class="copy-btn" onclick="copyToClipboard('${escapeQuotes(data.placeholder)}', this)">
          ${copyIcon} COPIAR
        </button>
      </div>
      <div class="copy-option-value">${escapeHtml(data.placeholder)}</div>
    </div>
    `;
  }
  
  content += `<div style="height: 1px; background: var(--border-color); margin: 16px 0;"></div>`;
  
  content += `
    <div class="copy-option">
      <div class="copy-option-header">
        <span class="copy-option-label">🎯 XPath (Relativo)</span>
        <button class="copy-btn" onclick="copyToClipboard('${escapeQuotes(data.xpathRelative)}', this)">
          ${copyIcon} COPIAR
        </button>
      </div>
      <div class="copy-option-value">${escapeHtml(data.xpathRelative)}</div>
    </div>
    
    <div class="copy-option">
      <div class="copy-option-header">
        <span class="copy-option-label">📍 XPath Completo</span>
        <button class="copy-btn" onclick="copyToClipboard('${escapeQuotes(data.xpathAbsolute)}', this)">
          ${copyIcon} COPIAR
        </button>
      </div>
      <div class="copy-option-value">${escapeHtml(data.xpathAbsolute)}</div>
    </div>
    
    <div class="copy-option">
      <div class="copy-option-header">
        <span class="copy-option-label">🎨 CSS Selector</span>
        <button class="copy-btn" onclick="copyToClipboard('${escapeQuotes(data.cssSelector)}', this)">
          ${copyIcon} COPIAR
        </button>
      </div>
      <div class="copy-option-value">${escapeHtml(data.cssSelector)}</div>
    </div>
    
    <div class="copy-option">
      <div class="copy-option-header">
        <span class="copy-option-label">🛤️ CSS Path</span>
        <button class="copy-btn" onclick="copyToClipboard('${escapeQuotes(data.cssPath)}', this)">
          ${copyIcon} COPIAR
        </button>
      </div>
      <div class="copy-option-value">${escapeHtml(data.cssPath)}</div>
    </div>
    
    <div class="copy-option">
      <div class="copy-option-header">
        <span class="copy-option-label">🏷️ Tag Name</span>
        <button class="copy-btn" onclick="copyToClipboard('${escapeQuotes(data.tagName)}', this)">
          ${copyIcon} COPIAR
        </button>
      </div>
      <div class="copy-option-value">${escapeHtml(data.tagName)}</div>
    </div>
  `;
  
  if (data.classes) {
    content += `
    <div class="copy-option">
      <div class="copy-option-header">
        <span class="copy-option-label">✨ Classes</span>
        <button class="copy-btn" onclick="copyToClipboard('${escapeQuotes(data.classes)}', this)">
          ${copyIcon} COPIAR
        </button>
      </div>
      <div class="copy-option-value">${escapeHtml(data.classes)}</div>
    </div>
    `;
  }
  
  if (data.id) {
    content += `
    <div class="copy-option">
      <div class="copy-option-header">
        <span class="copy-option-label">🆔 ID</span>
        <button class="copy-btn" onclick="copyToClipboard('${escapeQuotes(data.id)}', this)">
          ${copyIcon} COPIAR
        </button>
      </div>
      <div class="copy-option-value">${escapeHtml(data.id)}</div>
    </div>
    `;
  }
  
  content += `
    <div class="copy-option">
      <div class="copy-option-header">
        <span class="copy-option-label">📝 HTML</span>
        <button class="copy-btn" onclick="copyToClipboard(\`${escapeQuotes(data.html)}\`, this)">
          ${copyIcon} COPIAR
        </button>
      </div>
      <div class="copy-option-value html-code">${escapeHtml(data.html)}</div>
    </div>
  `;
  
  inspectorContent.innerHTML = content;
  inspectorSidebar.classList.add('open');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function escapeQuotes(text) {
  return text.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"').replace(/`/g, '\\`').replace(/\n/g, '\\n').replace(/\r/g, '\\r');
}

async function writeClipboardText(text) {
  const safeText = text === undefined || text === null ? '' : String(text);

  if (window.electronAPI && typeof window.electronAPI.copyToClipboard === 'function') {
    const result = await window.electronAPI.copyToClipboard(safeText);
    if (result && result.success === false) {
      throw new Error(result.error || 'Falha ao copiar pelo Electron');
    }
    return true;
  }

  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    await navigator.clipboard.writeText(safeText);
    return true;
  }

  const textarea = document.createElement('textarea');
  textarea.value = safeText;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  textarea.style.top = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  document.body.removeChild(textarea);
  if (!copied) throw new Error('Clipboard indisponível');
  return true;
}

function flashCopyError(buttonElement) {
  if (!buttonElement) return;
  const originalHTML = buttonElement.innerHTML;
  buttonElement.innerHTML = 'ERRO';
  buttonElement.classList.add('copy-error');
  setTimeout(() => {
    buttonElement.innerHTML = originalHTML;
    buttonElement.classList.remove('copy-error');
  }, 1800);
}

window.copyToClipboard = async function(text, buttonElement) {
  try {
    await writeClipboardText(text);

    const originalHTML = buttonElement.innerHTML;
    buttonElement.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polyline points="20 6 9 17 4 12"></polyline>
    </svg> ✓`;
    buttonElement.classList.add('copied');

    setTimeout(() => {
      buttonElement.innerHTML = originalHTML;
      buttonElement.classList.remove('copied');
    }, 2000);

    logToConsole(`✓ Copiado para clipboard`, 'info');
  } catch (err) {
    flashCopyError(buttonElement);
    logToConsole('Erro ao copiar: ' + (err && err.message ? err.message : err), 'error');
  }
};

function logToConsole(message, level = 'log') {
  const messageEl = document.createElement('div');
  messageEl.className = `console-message console-${level}`;
  
  const timestamp = new Date().toLocaleTimeString();
  messageEl.innerHTML = `
    <span class="console-timestamp">[${timestamp}]</span>
    <span class="console-text">${escapeHtml(message)}</span>
  `;
  
  consoleContent.appendChild(messageEl);
  consoleContent.scrollTop = consoleContent.scrollHeight;
}

clearConsole.addEventListener('click', () => {
  consoleContent.innerHTML = '';
  logToConsole('Console limpo', 'info');
});


// ===== HIGHLIGHT MÁGICO NO HOVER =====
// Ativa/desativa um overlay dentro da página carregada no webview.
// Ele não clica, não captura formulário e não altera o DOM do site além do overlay temporário.
const HOVER_HIGHLIGHT_ENABLE_SCRIPT = `
  (function() {
    const STYLE_ID = '__inspectorNinjaHoverMagicStyle';
    const OVERLAY_ID = '__inspectorNinjaHoverMagicOverlay';
    const LABEL_ID = '__inspectorNinjaHoverMagicLabel';
    const ACTIVE_CLASS = '__inspector-ninja-hover-active';

    function ensureStyle() {
      let style = document.getElementById(STYLE_ID);
      if (!style) {
        style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = '' +
          'html.' + ACTIVE_CLASS + ' * { cursor: crosshair !important; }' +
          '#' + OVERLAY_ID + ' {' +
          '  position: fixed !important;' +
          '  pointer-events: none !important;' +
          '  z-index: 2147483646 !important;' +
          '  display: none;' +
          '  border: 2px solid #a855f7 !important;' +
          '  background: rgba(168, 85, 247, 0.12) !important;' +
          '  box-shadow: 0 0 0 1px rgba(232,121,249,.75), 0 0 22px rgba(168,85,247,.45) !important;' +
          '  border-radius: 6px !important;' +
          '  box-sizing: border-box !important;' +
          '  transition: top .055s linear, left .055s linear, width .055s linear, height .055s linear !important;' +
          '}' +
          '#' + LABEL_ID + ' {' +
          '  position: fixed !important;' +
          '  pointer-events: none !important;' +
          '  z-index: 2147483647 !important;' +
          '  display: none;' +
          '  max-width: 460px !important;' +
          '  padding: 6px 9px !important;' +
          '  border-radius: 8px !important;' +
          '  border: 1px solid #e879f9 !important;' +
          '  background: linear-gradient(135deg, rgba(10,10,15,.96), rgba(26,26,39,.96)) !important;' +
          '  color: #f5d0fe !important;' +
          '  font: 700 12px/1.2 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace !important;' +
          '  text-shadow: 0 0 8px rgba(232,121,249,.7) !important;' +
          '  box-shadow: 0 8px 24px rgba(0,0,0,.32), 0 0 18px rgba(168,85,247,.45) !important;' +
          '  white-space: nowrap !important;' +
          '  overflow: hidden !important;' +
          '  text-overflow: ellipsis !important;' +
          '}';
        (document.head || document.documentElement).appendChild(style);
      }
    }

    function ensureBox(id) {
      let box = document.getElementById(id);
      if (!box) {
        box = document.createElement('div');
        box.id = id;
        box.setAttribute('data-inspector-ninja-ui', 'true');
        document.documentElement.appendChild(box);
      }
      return box;
    }

    function safeClasses(el) {
      if (!el || !el.className || typeof el.className !== 'string') return '';
      return el.className.trim().split(/\\s+/).filter(Boolean).slice(0, 4).join('.');
    }

    function cleanText(value, maxLen) {
      if (!value) return '';
      return String(value).replace(/\\s+/g, ' ').trim().substring(0, maxLen || 72);
    }

    function getDirectText(el) {
      if (!el) return '';
      const ownText = [];
      for (let i = 0; i < el.childNodes.length; i++) {
        const node = el.childNodes[i];
        if (node.nodeType === Node.TEXT_NODE) {
          const text = cleanText(node.textContent, 90);
          if (text) ownText.push(text);
        }
      }
      return cleanText(ownText.join(' '), 90);
    }

    function getElementName(el) {
      if (!el) return '';
      const attrCandidates = [
        ['aria-label', el.getAttribute && el.getAttribute('aria-label')],
        ['data-testid', el.getAttribute && el.getAttribute('data-testid')],
        ['data-test', el.getAttribute && el.getAttribute('data-test')],
        ['data-cy', el.getAttribute && el.getAttribute('data-cy')],
        ['title', el.getAttribute && el.getAttribute('title')],
        ['alt', el.getAttribute && el.getAttribute('alt')],
        ['placeholder', el.getAttribute && el.getAttribute('placeholder')],
        ['name', el.getAttribute && el.getAttribute('name')]
      ];
      for (let i = 0; i < attrCandidates.length; i++) {
        const source = attrCandidates[i][0];
        const value = cleanText(attrCandidates[i][1], 90);
        if (value) return { value: value, source: source };
      }

      const directText = getDirectText(el);
      if (directText) return { value: directText, source: 'texto direto' };

      const tag = el.tagName ? el.tagName.toLowerCase() : '';
      if (['button', 'a', 'label', 'summary', 'option', 'th', 'td', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span'].includes(tag)) {
        const text = cleanText(el.innerText || el.textContent, 90);
        if (text) return { value: text, source: 'texto visível' };
      }

      const shortText = cleanText(el.innerText || el.textContent, 90);
      if (shortText && shortText.length <= 90) return { value: shortText, source: 'texto visível' };

      if (el.id) return { value: '#' + el.id, source: 'id' };
      const classes = safeClasses(el);
      if (classes) return { value: '.' + classes, source: 'classe' };
      return { value: 'Sem nome detectável', source: 'fallback' };
    }

    function summarizeElement(el) {
      const rect = el.getBoundingClientRect();
      const tag = el.tagName ? el.tagName.toLowerCase() : 'element';
      const name = getElementName(el);
      const size = Math.round(rect.width) + '×' + Math.round(rect.height) + 'px';
      return '<' + tag + '> Nome: ' + name.value + ' · ' + size;
    }

    function clamp(value, min, max) {
      return Math.max(min, Math.min(value, max));
    }

    function isNinjaUi(el) {
      return !!(el && (el.id === OVERLAY_ID || el.id === LABEL_ID || el.closest && el.closest('[data-inspector-ninja-ui="true"]')));
    }

    function createController() {
      let overlay = null;
      let label = null;
      let currentElement = null;
      let active = false;

      function ensureUi() {
        ensureStyle();
        overlay = ensureBox(OVERLAY_ID);
        label = ensureBox(LABEL_ID);
      }

      function hide() {
        if (overlay) overlay.style.display = 'none';
        if (label) label.style.display = 'none';
      }

      function update(el) {
        if (!el || !document.documentElement.contains(el) || isNinjaUi(el)) {
          hide();
          return;
        }

        ensureUi();
        const rect = el.getBoundingClientRect();
        if (rect.width <= 0 && rect.height <= 0) {
          hide();
          return;
        }

        overlay.style.display = 'block';
        overlay.style.left = rect.left + 'px';
        overlay.style.top = rect.top + 'px';
        overlay.style.width = rect.width + 'px';
        overlay.style.height = rect.height + 'px';

        label.textContent = summarizeElement(el);
        label.style.display = 'block';

        const labelWidth = Math.min(460, Math.max(160, label.offsetWidth || 220));
        const left = clamp(rect.left, 8, Math.max(8, window.innerWidth - labelWidth - 8));
        const top = rect.top > 38 ? rect.top - 34 : Math.min(window.innerHeight - 34, rect.bottom + 8);
        label.style.left = left + 'px';
        label.style.top = top + 'px';
      }

      function onMouseMove(event) {
        const el = document.elementFromPoint(event.clientX, event.clientY);
        if (!el || isNinjaUi(el)) {
          hide();
          return;
        }
        currentElement = el;
        update(currentElement);
      }

      function onMouseOut(event) {
        if (!event.relatedTarget) hide();
      }

      function onViewportChange() {
        if (currentElement) update(currentElement);
      }

      function install() {
        if (active) return;
        ensureUi();
        document.addEventListener('mousemove', onMouseMove, true);
        document.addEventListener('mouseout', onMouseOut, true);
        window.addEventListener('scroll', onViewportChange, true);
        window.addEventListener('resize', onViewportChange, true);
        document.documentElement.classList.add(ACTIVE_CLASS);
        active = true;
      }

      function uninstall() {
        document.removeEventListener('mousemove', onMouseMove, true);
        document.removeEventListener('mouseout', onMouseOut, true);
        window.removeEventListener('scroll', onViewportChange, true);
        window.removeEventListener('resize', onViewportChange, true);
        document.documentElement.classList.remove(ACTIVE_CLASS);
        currentElement = null;
        active = false;
        if (overlay) overlay.remove();
        if (label) label.remove();
        const style = document.getElementById(STYLE_ID);
        if (style) style.remove();
      }

      return {
        install: install,
        uninstall: uninstall,
        get active() { return active; }
      };
    }

    if (!window.__inspectorNinjaHoverMagic) {
      window.__inspectorNinjaHoverMagic = createController();
    }
    window.__inspectorNinjaHoverMagic.install();
    return { ok: true, active: true };
  })();
`;

const HOVER_HIGHLIGHT_DISABLE_SCRIPT = `
  (function() {
    if (window.__inspectorNinjaHoverMagic && typeof window.__inspectorNinjaHoverMagic.uninstall === 'function') {
      window.__inspectorNinjaHoverMagic.uninstall();
      delete window.__inspectorNinjaHoverMagic;
    }
    const ids = ['__inspectorNinjaHoverMagicOverlay', '__inspectorNinjaHoverMagicLabel', '__inspectorNinjaHoverMagicStyle'];
    ids.forEach(function(id) {
      const el = document.getElementById(id);
      if (el) el.remove();
    });
    document.documentElement.classList.remove('__inspector-ninja-hover-active');
    return { ok: true, active: false };
  })();
`;

hoverHighlightBtn.addEventListener('click', () => {
  if (hoverHighlightActive) {
    deactivateHoverHighlight();
  } else {
    activateHoverHighlight();
  }
});

function updateHoverHighlightButton() {
  hoverHighlightBtn.classList.toggle('active', hoverHighlightActive);
  hoverHighlightBtn.title = hoverHighlightActive
    ? 'Desativar highlight mágico no hover'
    : 'Ativar highlight mágico no hover';
}

async function activateHoverHighlight() {
  hoverHighlightActive = true;
  updateHoverHighlightButton();
  await enableHoverHighlightOnPage({ silent: false });
}

async function deactivateHoverHighlight() {
  hoverHighlightActive = false;
  updateHoverHighlightButton();
  try {
    await webview.executeJavaScript(HOVER_HIGHLIGHT_DISABLE_SCRIPT);
  } catch (err) {
    // A página pode estar trocando de URL; o estado do botão ainda deve desligar.
  }
  logToConsole('🪄 Highlight mágico desativado', 'info');
}

async function enableHoverHighlightOnPage({ silent = false } = {}) {
  try {
    await webview.executeJavaScript(HOVER_HIGHLIGHT_ENABLE_SCRIPT);
    if (!silent) logToConsole('🪄 Highlight mágico ativado — passe o mouse nos elementos', 'info');
  } catch (err) {
    hoverHighlightActive = false;
    updateHoverHighlightButton();
    logToConsole('Erro ao ativar highlight mágico: ' + err.message, 'error');
  }
}

// ===== LISTAR TODOS OS ELEMENTOS DA PÁGINA =====

// Script injetado no webview para coletar todos os elementos.
// Extraído como constante para facilitar leitura e manutenção do handler.
const COLLECT_ALL_ELEMENTS_SCRIPT = `
  (function() {
    function getCssPath(element) {
      const path = [];
      while (element && element.nodeType === Node.ELEMENT_NODE) {
        let selector = element.nodeName.toLowerCase();
        if (element.id) {
          selector += '#' + element.id;
          path.unshift(selector);
          break;
        }
        if (element.className && typeof element.className === 'string') {
          const classes = element.className.trim().split(/\\s+/).filter(c => c);
          if (classes.length > 0) {
            selector += '.' + classes.join('.');
          }
        }
        let sibling = element;
        let nth = 1;
        while (sibling.previousElementSibling) {
          sibling = sibling.previousElementSibling;
          if (sibling.nodeName.toLowerCase() === element.nodeName.toLowerCase()) nth++;
        }
        if (nth > 1 || (element.nextElementSibling && element.nextElementSibling.nodeName === element.nodeName)) {
          selector += ':nth-of-type(' + nth + ')';
        }
        path.unshift(selector);
        element = element.parentElement;
      }
      return path.join(' > ');
    }

    const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'META', 'LINK', 'NOSCRIPT', 'HEAD', 'TITLE']);
    const all = document.querySelectorAll('*');
    const list = [];
    const MAX = 2000;
    for (let i = 0; i < all.length && list.length < MAX; i++) {
      const el = all[i];
      if (SKIP_TAGS.has(el.tagName)) continue;
      const classes = (el.className && typeof el.className === 'string')
        ? el.className.trim().split(/\\s+/).filter(c => c).join(' ')
        : '';
      const text = (el.innerText || el.textContent || '').trim().replace(/\\s+/g, ' ').substring(0, 120);
      list.push({
        tagName: el.tagName.toLowerCase(),
        id: el.id || '',
        classes: classes,
        cssPath: getCssPath(el),
        text: text,
        outerHTML: el.outerHTML.length > 400 ? el.outerHTML.substring(0, 400) + '...' : el.outerHTML
      });
    }
    return {
      total: all.length,
      collected: list.length,
      truncated: all.length > MAX,
      url: window.location.href,
      title: document.title,
      elements: list
    };
  })();
`;

const COPY_ICON_SVG = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
</svg>`;

const CHECK_ICON_SVG = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <polyline points="20 6 9 17 4 12"></polyline>
</svg>`;

elementInspectorBtn.addEventListener('click', handleListAllElements);

async function handleListAllElements() {
  try {
    setInspectorButtonLoading(true);
    logToConsole('Coletando todos os elementos da página...', 'info');

    const result = await webview.executeJavaScript(COLLECT_ALL_ELEMENTS_SCRIPT);

    lastAllElementsResult = result;
    renderAllElementsList(result);
    inspectorSidebar.classList.add('open');
    logToConsole(`✓ ${result.collected} elementos coletados${result.truncated ? ' (limitado a 2000)' : ''}`, 'info');
  } catch (err) {
    logToConsole('Erro ao coletar elementos: ' + err.message, 'error');
  } finally {
    setInspectorButtonLoading(false);
  }
}

function setInspectorButtonLoading(isLoading) {
  elementInspectorBtn.classList.toggle('loading', isLoading);
  elementInspectorBtn.disabled = isLoading;
}

function renderAllElementsList(data) {
  const headerHtml = buildAllElementsHeaderHtml(data);

  if (data.elements.length === 0) {
    inspectorContent.innerHTML = headerHtml +
      `<div class="inspector-empty"><p>Nenhum elemento encontrado nesta página.</p></div>`;
    return;
  }

  const rowsHtml = data.elements.map(buildElementRowHtml).join('');
  const saveBtnHtml = buildSaveTxtButtonHtml();

  inspectorContent.innerHTML = headerHtml + rowsHtml + saveBtnHtml;
}

function buildAllElementsHeaderHtml(data) {
  const countLabel = `${data.collected}${data.truncated ? ' / ' + data.total : ''}`;
  return `
    <div class="all-elements-header">
      <span class="all-elements-header-title">🥷 Todos os Elementos</span>
      <span class="all-elements-count" data-testid="all-elements-count">${countLabel}</span>
    </div>
  `;
}

function buildElementTagDisplay(el) {
  const idPart = el.id ? `<span class="el-id"> #${escapeHtml(el.id)}</span>` : '';
  const classPart = el.classes
    ? `<span class="el-class"> .${escapeHtml(el.classes.split(' ').join(' .'))}</span>`
    : '';
  return `&lt;${el.tagName}&gt;${idPart}${classPart}`;
}

function buildElementRowHtml(el, idx) {
  const tagDisplay = buildElementTagDisplay(el);
  return `
    <div class="element-row" data-testid="element-row-${idx}">
      <div class="element-row-top">
        <div class="element-row-tag">${tagDisplay}</div>
        <span class="element-row-index">#${idx + 1}</span>
      </div>
      <div class="element-row-csspath" title="${escapeHtml(el.cssPath)}">
        <span class="element-row-csspath-label">CSS PATH:</span>${escapeHtml(el.cssPath)}
      </div>
      <div class="element-row-actions">
        <button class="copy-btn" data-testid="copy-element-btn-${idx}" onclick="copyElementToClipboard(${idx}, this)">
          ${COPY_ICON_SVG} COPIAR
        </button>
      </div>
    </div>
  `;
}

function buildSaveTxtButtonHtml() {
  return `
    <div class="save-txt-container">
      <button class="save-txt-btn" id="saveTxtBtn" data-testid="save-txt-btn" onclick="saveAllElementsToTxt(this)">
        💾 Salvar todos os elementos em TXT
      </button>
    </div>
  `;
}

function buildElementCopyText(el) {
  const lines = [];
  lines.push(`<${el.tagName}>`);
  if (el.id) lines.push(`ID: ${el.id}`);
  if (el.classes) lines.push(`Classes: ${el.classes}`);
  lines.push(`CSS Path: ${el.cssPath}`);
  if (el.text) lines.push(`Texto: ${el.text}`);
  if (el.outerHTML) lines.push(`HTML: ${el.outerHTML}`);
  return lines.join('\n');
}

function flashCopiedState(buttonElement) {
  const originalHTML = buttonElement.innerHTML;
  buttonElement.innerHTML = `${CHECK_ICON_SVG} ✓`;
  buttonElement.classList.add('copied');
  setTimeout(() => {
    buttonElement.innerHTML = originalHTML;
    buttonElement.classList.remove('copied');
  }, 2000);
}

window.copyElementToClipboard = async function(index, buttonElement) {
  if (!lastAllElementsResult || !lastAllElementsResult.elements[index]) return;
  const el = lastAllElementsResult.elements[index];
  try {
    await writeClipboardText(buildElementCopyText(el));
    flashCopiedState(buttonElement);
    logToConsole(`✓ Elemento #${index + 1} (<${el.tagName}>) copiado`, 'info');
  } catch (err) {
    flashCopyError(buttonElement);
    logToConsole('Erro ao copiar elemento: ' + (err && err.message ? err.message : err), 'error');
  }
};

window.saveAllElementsToTxt = function(buttonElement) {
  if (!lastAllElementsResult || !lastAllElementsResult.elements.length) {
    logToConsole('Nenhum elemento para salvar', 'warn');
    return;
  }

  const data = lastAllElementsResult;
  const now = new Date();
  const content = buildTxtExportContent(data, now);
  const filename = buildTxtFilename(now);

  triggerTxtDownload(content, filename);
  flashSavedState(buttonElement);
  logToConsole(`💾 ${data.collected} elementos salvos em ${filename}`, 'info');
};

function buildTxtExportContent(data, now) {
  const separator = '='.repeat(80);
  const subSeparator = '-'.repeat(80);
  const header = [
    separator,
    '🥷 INSPECTOR NINJA - EXPORTAÇÃO DE ELEMENTOS',
    separator,
    `URL:     ${data.url}`,
    `Título:  ${data.title}`,
    `Data:    ${now.toLocaleString()}`,
    `Total:   ${data.collected}${data.truncated ? ' (limitado a partir de ' + data.total + ')' : ''}`,
    separator,
    ''
  ];

  const body = data.elements.flatMap((el, idx) => formatElementForTxt(el, idx, subSeparator));
  return header.concat(body).join('\n');
}

function formatElementForTxt(el, idx, subSeparator) {
  const lines = [`[#${idx + 1}] <${el.tagName}>`];
  if (el.id) lines.push(`  ID:        ${el.id}`);
  if (el.classes) lines.push(`  Classes:   ${el.classes}`);
  lines.push(`  CSS Path:  ${el.cssPath}`);
  if (el.text) lines.push(`  Texto:     ${el.text}`);
  if (el.outerHTML) lines.push(`  HTML:      ${el.outerHTML}`);
  lines.push(subSeparator);
  return lines;
}

function buildTxtFilename(now) {
  const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return `ninja-elements-${timestamp}.txt`;
}

function triggerTxtDownload(content, filename) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function flashSavedState(buttonElement) {
  const originalHTML = buttonElement.innerHTML;
  buttonElement.innerHTML = '✓ TXT salvo com sucesso!';
  buttonElement.classList.add('saved');
  setTimeout(() => {
    buttonElement.innerHTML = originalHTML;
    buttonElement.classList.remove('saved');
  }, 2500);
}

logToConsole('Sistema iniciado 🚀', 'info');
logToConsole('Clique com botão direito para inspecionar elementos', 'info');
logToConsole('Ou clique em "🥷 Element Inspector" para listar todos', 'info');

// ===== TOGGLE DEVELOPER TOOLS (CONSOLE PANEL) =====
toggleConsoleBtn.addEventListener('click', () => {
  const isOpen = document.body.classList.toggle('console-open');
  toggleConsoleBtn.classList.toggle('active', isOpen);
  toggleConsoleBtn.title = isOpen ? 'Ocultar Developer Tools' : 'Mostrar Developer Tools';
});

// ===== SISTEMA DE RÉGUA (MEDIR ENTRE 2 ELEMENTOS) =====

const RULER_PICK_SCRIPT = `
  (function(x, y) {
    function getCssPath(element) {
      const path = [];
      while (element && element.nodeType === Node.ELEMENT_NODE) {
        let selector = element.nodeName.toLowerCase();
        if (element.id) { selector += '#' + element.id; path.unshift(selector); break; }
        if (element.className && typeof element.className === 'string') {
          const classes = element.className.trim().split(/\\s+/).filter(c => c);
          if (classes.length > 0) selector += '.' + classes.join('.');
        }
        let sibling = element, nth = 1;
        while (sibling.previousElementSibling) {
          sibling = sibling.previousElementSibling;
          if (sibling.nodeName.toLowerCase() === element.nodeName.toLowerCase()) nth++;
        }
        if (nth > 1) selector += ':nth-of-type(' + nth + ')';
        path.unshift(selector);
        element = element.parentElement;
      }
      return path.join(' > ');
    }
    const el = document.elementFromPoint(x, y);
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return {
      tagName: el.tagName.toLowerCase(),
      id: el.id || '',
      classes: (el.className && typeof el.className === 'string') ? el.className.trim() : '',
      cssPath: getCssPath(el),
      rect: {
        top: rect.top, left: rect.left, right: rect.right, bottom: rect.bottom,
        width: rect.width, height: rect.height,
        centerX: rect.left + rect.width / 2,
        centerY: rect.top + rect.height / 2
      }
    };
  })(__X__, __Y__);
`;

rulerBtn.addEventListener('click', () => {
  if (rulerActive) {
    deactivateRuler();
  } else {
    activateRuler();
  }
});

closeRulerPanel.addEventListener('click', () => {
  deactivateRuler();
});

function activateRuler() {
  rulerActive = true;
  rulerFirstElement = null;
  rulerBtn.classList.add('active');
  rulerPanel.classList.add('open');
  renderRulerInstructions('Clique no <strong>1º elemento</strong> no navegador para começar a medir.');
  logToConsole('📐 Régua ativada — clique no 1º elemento', 'info');
}

function deactivateRuler() {
  rulerActive = false;
  rulerFirstElement = null;
  rulerBtn.classList.remove('active');
  rulerPanel.classList.remove('open');
  logToConsole('📐 Régua desativada', 'info');
}

function renderRulerInstructions(message) {
  rulerPanelBody.innerHTML = `<p class="ruler-instructions">${message}</p>`;
}

webview.addEventListener('context-menu', async (e) => {
  if (!rulerActive) return;
  await handleRulerPick(e.params.x, e.params.y);
});

async function handleRulerPick(x, y) {
  try {
    const script = RULER_PICK_SCRIPT
      .replace('__X__', String(x))
      .replace('__Y__', String(y));
    const elInfo = await webview.executeJavaScript(script);
    if (!elInfo) return;

    if (!rulerFirstElement) {
      rulerFirstElement = elInfo;
      renderRulerFirstPicked(elInfo);
      logToConsole(`📐 1º elemento: <${elInfo.tagName}>`, 'info');
    } else {
      const measurements = computeRulerMeasurements(rulerFirstElement, elInfo);
      renderRulerResult(rulerFirstElement, elInfo, measurements);
      logToConsole(`📐 Medição concluída: gap H=${measurements.gapHorizontal}px V=${measurements.gapVertical}px`, 'info');
      rulerFirstElement = null;
    }
  } catch (err) {
    logToConsole('Erro na régua: ' + err.message, 'error');
  }
}

function elementSummary(el) {
  const id = el.id ? ` #${el.id}` : '';
  const cls = el.classes ? ` .${el.classes.split(/\s+/).join('.')}` : '';
  return `&lt;${el.tagName}&gt;${escapeHtml(id + cls)}`;
}

function buildRulerElementCardHtml(el, label, second) {
  const dim = `${Math.round(el.rect.width)} × ${Math.round(el.rect.height)} px @ (${Math.round(el.rect.left)}, ${Math.round(el.rect.top)})`;
  return `
    <div class="ruler-element-card${second ? ' second' : ''}">
      <div class="ruler-element-card-label">${label}</div>
      <div class="ruler-element-card-tag">${elementSummary(el)}</div>
      <div class="ruler-element-card-dim">${dim}</div>
    </div>
  `;
}

function renderRulerFirstPicked(el) {
  rulerPanelBody.innerHTML =
    buildRulerElementCardHtml(el, '1º Elemento', false) +
    `<p class="ruler-instructions">Agora clique no <strong>2º elemento</strong> para medir.</p>`;
}

function computeRulerMeasurements(a, b) {
  const round = (n) => Math.round(n * 100) / 100;
  // Gap horizontal: distância entre as bordas mais próximas no eixo X (0 se sobrepostos)
  let gapH;
  if (b.rect.left >= a.rect.right) gapH = b.rect.left - a.rect.right;
  else if (a.rect.left >= b.rect.right) gapH = a.rect.left - b.rect.right;
  else gapH = 0;
  // Gap vertical
  let gapV;
  if (b.rect.top >= a.rect.bottom) gapV = b.rect.top - a.rect.bottom;
  else if (a.rect.top >= b.rect.bottom) gapV = a.rect.top - b.rect.bottom;
  else gapV = 0;

  const dxCenters = b.rect.centerX - a.rect.centerX;
  const dyCenters = b.rect.centerY - a.rect.centerY;
  const distanceCenters = Math.sqrt(dxCenters * dxCenters + dyCenters * dyCenters);

  return {
    gapHorizontal: round(gapH),
    gapVertical: round(gapV),
    deltaLeft: round(b.rect.left - a.rect.left),
    deltaTop: round(b.rect.top - a.rect.top),
    deltaCenterX: round(dxCenters),
    deltaCenterY: round(dyCenters),
    distanceCenters: round(distanceCenters),
    widthA: round(a.rect.width),
    heightA: round(a.rect.height),
    widthB: round(b.rect.width),
    heightB: round(b.rect.height)
  };
}

function renderRulerResult(a, b, m) {
  const rows = [
    ['Gap Horizontal',      `${m.gapHorizontal} px`],
    ['Gap Vertical',        `${m.gapVertical} px`],
    ['Δ Left (B - A)',      `${m.deltaLeft} px`],
    ['Δ Top (B - A)',       `${m.deltaTop} px`],
    ['Distância centros',   `${m.distanceCenters} px`],
    ['Δ centro X',          `${m.deltaCenterX} px`],
    ['Δ centro Y',          `${m.deltaCenterY} px`],
    ['Tamanho A',           `${m.widthA} × ${m.heightA} px`],
    ['Tamanho B',           `${m.widthB} × ${m.heightB} px`]
  ];
  const rowsHtml = rows.map(([label, value]) => `
    <div class="ruler-measure-row">
      <span class="ruler-measure-label">${label}</span>
      <span class="ruler-measure-value">${value}</span>
    </div>
  `).join('');

  rulerPanelBody.innerHTML =
    buildRulerElementCardHtml(a, '1º Elemento (A)', false) +
    buildRulerElementCardHtml(b, '2º Elemento (B)', true) +
    `<div class="ruler-measurements">
       <div class="ruler-measurements-title">📏 Medições</div>
       ${rowsHtml}
     </div>
     <div class="ruler-actions">
       <button class="ruler-action-btn copy" data-testid="ruler-copy-btn" onclick="copyRulerMeasurements()">📋 Copiar</button>
       <button class="ruler-action-btn" data-testid="ruler-reset-btn" onclick="resetRuler()">🔄 Nova medição</button>
     </div>`;

  // Guardar último resultado para cópia
  window.__lastRulerResult = { a, b, m };
}

window.copyRulerMeasurements = function() {
  const data = window.__lastRulerResult;
  if (!data) return;
  const { a, b, m } = data;
  const text = [
    '📐 Medição entre elementos',
    `A: <${a.tagName}>  ${a.cssPath}`,
    `B: <${b.tagName}>  ${b.cssPath}`,
    '',
    `Gap horizontal:    ${m.gapHorizontal} px`,
    `Gap vertical:      ${m.gapVertical} px`,
    `Δ left (B-A):      ${m.deltaLeft} px`,
    `Δ top  (B-A):      ${m.deltaTop} px`,
    `Distância centros: ${m.distanceCenters} px`,
    `Δ centro X:        ${m.deltaCenterX} px`,
    `Δ centro Y:        ${m.deltaCenterY} px`,
    `Tamanho A:         ${m.widthA} × ${m.heightA} px`,
    `Tamanho B:         ${m.widthB} × ${m.heightB} px`
  ].join('\n');
  writeClipboardText(text)
    .then(() => logToConsole('📋 Medições copiadas para o clipboard', 'info'))
    .catch((err) => logToConsole('Erro ao copiar medições: ' + (err && err.message ? err.message : err), 'error'));
};

window.resetRuler = function() {
  rulerFirstElement = null;
  renderRulerInstructions('Clique no <strong>1º elemento</strong> no navegador para começar a medir.');
};
