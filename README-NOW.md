TO RUN:


npm i

npm audit fix --force


npm run dev -- --port=30xx

NOVO:

- Botão 🪄 no topo: liga/desliga o highlight mágico no hover.
- A etiqueta agora tenta mostrar o NOME do elemento: aria-label, title, alt, placeholder, name, texto visível, id e só por último classes.
- Botão direito no elemento sob o mouse abre o painel com opções para copiar Nome do Elemento, Resumo Copiável, CSS selector, XPath, HTML, etc.

CORREÇÃO:

- Corrigido: botões COPIAR agora usam o clipboard nativo do Electron, então não dependem mais do navigator.clipboard.
