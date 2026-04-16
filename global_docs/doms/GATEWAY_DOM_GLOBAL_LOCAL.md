# GATEWAY DOM - Global vs Local Classes

Legenda:
- G = classe global (importada de templates/styles/*)
- L = classe local do modulo gateway (gateway/src/public/styles/scss/_auth.scss e _errors.scss)
- S = classe sem regra CSS propria no estado atual (semantica/JS)

## 1) Apps Shell (gateway/src/views/apps/index.ejs)

body.main-page[G]
|- div.mobile-shell[G]
|  |- header.mobile-header[G]
|  |  \- div.mobile-header-content[G]
|  |     |- div > h1
|  |     |- div.mobile-user[G] > strong + span
|  |     \- form.mobile-logout[G] > button
|  |- main.mobile-main[G]
|  |  |- h2
|  |  \- div.mobile-apps-grid[G]
|  |     \- div.mobile-app-card[G] (repetido por app)
|  |        |- h3
|  |        |- p
|  |        \- a
|  \- footer.mobile-footer[G]
\- div.desktop-shell[G]
   |- header.desktop-titlebar[G]
   |  |- div.titlebar-left[G]
   |  |  |- span.traffic-light.red[G]
   |  |  |- span.traffic-light.yellow[G]
   |  |  |- span.traffic-light.green[G]
   |  |  \- strong.desktop-brand[G]
   |  |- div.titlebar-center[G] > span.desktop-clock[G]
   |  \- div.titlebar-right[G]
   |     |- span.desktop-user[G] > strong + span.desktop-user-role[G]
   |     \- form.titlebar-logout[G] > button
   |- main.desktop-workspace[G]
   |  \- section.desktop-icons[G]
   |     \- a.desktop-icon[G] (+ .is-disabled[G] quando aplicavel)
   |        |- span.desktop-icon-glyph[G]
   |        \- span.desktop-icon-name[G]
   \- nav.desktop-dock[G]
      \- div.dock-inner[G]
         |- a.dock-item[G] (+ .is-disabled[G] quando aplicavel) > span.dock-item-glyph[G]
         \- form.dock-logout[G] > button

## 2) Login (gateway/src/views/auth/login.ejs)

body
\- main.card[L]
   |- h1
   |- form#login-form
   |  |- label
   |  |- input
   |  \- button
   |- div#status.status[S]
   |  \- span.error[S]
   \- p.hint[L]

## 3) Errors (gateway/src/views/errors/401.ejs e 404.ejs)

body
\- main.card[L]
   |- p.error-code[L]
   |- h1.error-title[L]
   |- p.error-message[L]
   |- div.action-links[L]
   |  \- a (+ .secondary[L] quando aplicavel)
   \- p.hint[L].error-hint[L]

## 4) Classes sem estilo dedicado no estado atual (S)

- desktopClock (id)
- status
- error

## 5) Origem dos estilos

Globais (templates/styles):
- shell-mobile/_shell.scss
- shell-mobile/_navigation.scss
- shell-mobile/_launcher.scss
- shell-desktop/_shell.scss
- shell-desktop/_titlebar.scss
- shell-desktop/_launcher.scss

Locais (gateway):
- gateway/src/public/styles/scss/_auth.scss
- gateway/src/public/styles/scss/_errors.scss

Entry:
- gateway/src/public/styles/scss/app.scss
