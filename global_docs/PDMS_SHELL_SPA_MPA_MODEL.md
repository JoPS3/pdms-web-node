# PDMS Shell SPA + Apps MPA Model

## Objetivo

Definir o modelo de navegacao alvo para o PDMS:

- A shell funciona como SPA (desktop, icons, janelas de menu).
- As funcionalidades reais de cada modulo funcionam como MPA (paginas proprias).
- O gateway continua como ponto de entrada unico e proxy canonico.

## Estado Atual (Referencia)

No `gateway`, o padrao atual ja esta alinhado com esta direcao:

1. Login e feito no gateway.
2. A pagina `apps` funciona como launcher/menu.
3. A navegacao para modulos passa pelo gateway (`/apps/<app>` ou rotas equivalentes por app).

Ou seja: launcher centralizado no gateway e funcionalidades reais nas apps.

## Decisao Arquitetural

### 1) Shell SPA (camada de navegacao)

A shell e responsavel por:

- Renderizar wallpaper, titlebar, dock e icons de modulo.
- Abrir janelas de menu por modulo (sub-menu de acoes).
- Gerir estado visual da shell (janela ativa, foco, posicao, abertura/fecho).

A shell NAO deve conter logica de negocio das funcionalidades.

### 2) Apps MPA (camada funcional)

Cada modulo (`usuarios`, `mapas`, `compras`, `vendas`, `rh`, etc.) e responsavel por:

- Paginas reais de funcionalidade.
- Regras de negocio e validacoes.
- Fluxos de CRUD/listagem/detalhe.

A shell apenas encaminha para estas paginas via links.

### 3) Estrutura canonica de views (padrao permanente)

Para todas as apps com shell desktop/mobile, a organizacao de `views/` deve seguir o padrao:

- `app/`: view principal da shell (`index.ejs`) e componentes SPA de janelas (`window-*`)
- `<dominio>/`: paginas MPA reais (views de endpoint), quando existirem
- `errors/`: views de erro (`404`, `500`, etc.)

Exemplo canonico:

```
views/
	app/
		index.ejs
		window-session.ejs
		window-users.ejs
		window-onedrive.ejs
	users/
		user-edit.ejs
	errors/
		404.ejs
		error.ejs
```

Regras obrigatorias deste padrao:

1. `res.render()` deve usar path completo por pasta (`app/index`, `users/user-edit`, `errors/404`).
2. Includes de janelas SPA devem ser `app/window-*`.
3. Novas janelas desktop (`desktop-window`) entram em `app/` e nao em pastas de MPA.
4. Pastas por dominio devem conter apenas views MPA de endpoint (quando existirem).

## Modelo de Interacao

### Fluxo principal

1. Utilizador entra no gateway e autentica.
2. Shell apresenta os icons de modulo.
3. Clique num icon abre a janela de menu desse modulo.
4. Clique num item do submenu muda para uma pagina funcional MPA.
5. A pagina funcional pode expor acao de regresso ao launcher/shell.

### Exemplo

- Icon: `Utilizadores`
- Janela do modulo: `Criar`, `Listar`, `Perfis`, `Permissoes`
- Clique em `Listar` -> navegacao para pagina real da app de utilizadores.

## Contrato de Menu (Proposto)

Cada modulo deve ser descrito por um registry simples:

- `id`: identificador do modulo
- `label`: nome visivel
- `icon`: icon do modulo
- `window`: metadados da janela (titulo, dimensoes iniciais opcionais)
- `items[]`: lista de entradas de submenu

Cada item de submenu deve ter:

- `id`
- `label`
- `icon`
- `href` (destino final MPA)
- `permission` (opcional, para filtragem por perfil)

## Regras de UX

1. A janela de modulo e um menu contextual, nao uma funcionalidade final.
2. O clique no submenu deve navegar para pagina funcional real (MPA).
3. Reduzir efeitos sem ganho funcional (ex.: resize livre) para manter simplicidade.
4. Drag de janela e opcional; manter apenas se ajudar no uso real.

## Regras de Seguranca

1. Itens do menu podem ser filtrados por permissao na shell.
2. Mesmo com filtragem visual, a autorizacao final e sempre validada no backend da app.
3. Nao assumir seguranca por ocultacao de menu.

## Integracao com o Gateway

Este modelo depende e reforca os docs existentes:

- `global_docs/GATEWAY_ACCESS_MODEL.md`
- `gateway/docs/APPS_ROUTING_STANDARD.md`

Pontos chave:

- Gateway permanece como entrypoint canonico.
- Token contract e validacao continuam centralizados.
- Apps continuam a implementar as suas rotas e auth de forma consistente.

## Plano de Implementacao

### Fase 1 - Shell Menu Base

- Implementar janela de submenu por modulo na shell.
- Ligar cada item a `href` funcional real.
- Sem resize de janela; tamanho inicial por preset do modulo.

### Fase 2 - Registry de Modulos

- Criar estrutura unica de configuracao de icons + submenu items.
- Permitir render dinamico da shell a partir desse registry.

### Fase 3 - Permissoes

- Filtrar modulos e submenu items por role/permissoes.
- Garantir fallback backend (401/403) nas apps.

### Fase 4 - Experiencia de retorno

- Definir padrao de "voltar a shell" nas paginas MPA.
- Opcional: persistir ultimo modulo aberto na shell.

## Nao Objetivos (neste momento)

- Transformar funcionalidades de negocio em SPA dentro da shell.
- Simular um sistema operativo completo com window manager avancado.
- Investir em animacoes complexas sem impacto no fluxo funcional.

## Resultado Esperado

- Navegacao moderna e consistente no topo (shell SPA).
- Funcionalidades robustas e simples de manter (apps MPA).
- Evolucao incremental sem quebrar o modelo atual do gateway.
