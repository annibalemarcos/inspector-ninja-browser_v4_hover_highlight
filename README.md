# 🥷 Inspector Ninja Browser

Navegador leve com inspetor de elementos integrado, highlight mágico no hover com nome amigável do elemento, exportação em TXT e sistema de régua para medir distâncias entre elementos.

## ✨ Recursos

- 🔍 **Inspetor individual** (clique direito) — captura o elemento sob o mouse, mostra o nome amigável e oferece botões para copiar nome, resumo, HTML, CSS path, XPath, classes, id e atributos úteis.
- 🥷 **Element Inspector (botão)** — lista TODOS os elementos da página com CSS path e botão de copiar em cada um.
- 🪄 **Highlight mágico no hover** — botão liga/desliga que destaca visualmente a `div`, tag ou elemento sob o mouse, com etiqueta usando **Nome do elemento** em vez de despejar classe tipo `small`, `big`, etc.
- 💾 **Salvar em TXT** — exporta toda a lista de elementos em arquivo `.txt`.
- 📐 **Régua** — mede distâncias e dimensões entre 2 elementos (clique direito em cada um após ativar).
- 📟 **Developer Tools (console)** — oculto por padrão, toggle pelo botão `📟`.
- 📋 **Cópia blindada** — botões de copiar usam o clipboard nativo do Electron, evitando falhas do `navigator.clipboard` em `file://`/webview.

## 🚀 Como rodar (dev)

```bash
npm install
npm start         # ou: npm run dev
```

## 📦 Como gerar o `.exe` (Windows installer + portable)

No **Windows** (recomendado):

```bash
npm install
npm run build:win
```

Os artefatos saem em `dist/`:
- `Inspector Ninja Browser-1.3.1-x64.exe`     → instalador NSIS (com atalhos)
- `Inspector Ninja Browser-1.3.1-x64-portable.exe` → portátil (sem instalar)

Outros alvos:
```bash
npm run build:mac     # .dmg (rode no macOS)
npm run build:linux   # AppImage + .deb
```

> 💡 **Cross-build (Linux → Windows)** requer Wine instalado.
> No Windows, basta `npm run build:win`.

## 🌐 Versão Web

Está em `../Ninja_Browser_Web/` — basta abrir `index.html` em um navegador moderno.

Limitações da versão web:
- Sites com `X-Frame-Options: DENY/SAMEORIGIN` ou CSP `frame-ancestors` **não carregam** no iframe (limitação do navegador, não do app).
- Para esses sites, use o **botão "HTML"** e cole o markup que quer inspecionar.
- A versão `.exe` desktop não tem essa limitação.

## 🎯 Como usar

| Ação | Como fazer |
|---|---|
| Listar todos elementos | Clique em **🥷 Element Inspector** |
| Inspecionar/copiar o elemento atual | Clique direito no elemento destacado/sob o mouse |
| Destacar elementos no hover | Clique em **🪄** e passe o mouse pela página; a etiqueta tenta mostrar o nome humano do elemento |
| Medir entre 2 elementos | Clique em **📐**, depois clique direito no 1º elemento e no 2º |
| Mostrar/Ocultar console | Clique em **📟** |
| Salvar elementos em TXT | Lista de elementos → botão **💾 Salvar todos em TXT** |
| Fechar painéis | Tecla **Esc** |

---

Inspector Ninja Team 🥷
