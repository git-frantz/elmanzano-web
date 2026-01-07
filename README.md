# Centro Recreativo El Manzano — FASE 1 (Web estática)

Este entregable incluye **solo** la Fase 1: sitio estático (HTML/CSS/JS) con catálogo dinámico y carrito en localStorage.

## Estructura

```
elmanzano-web/
  index.html
  servicios.html
  servicio.html
  politicas.html
  calendario.html
  cotizar.html
  app.js
  assets/
    css/theme.css
    data/catalog.json
    img/ (imágenes + logo)
    video/hero.mp4
    docs/Politicas_El_Manzano.pdf
```

## Checkpoint 1 — Ejecutar localmente

En la carpeta `elmanzano-web/`:

```bash
python3 -m http.server 8080
```

Abre: http://localhost:8080

> Importante: Si abres el HTML con doble clic (file://) puede fallar el `fetch` del `catalog.json`.
> Usa un servidor local.

## Checkpoint 2 — Probar flujo completo

1. `Servicios` → abrir un servicio.
2. `Agregar al carrito` con personas y noches.
3. `Cotizar` → revisar carrito + total.
4. Enviar cotización (en dev fallará si no existe el webhook).

## Ajustes para producción

- Reemplaza en `app.js`:
  - `WEBHOOK_TOKEN = "[TOKEN_SEGURO_AQUI]"`
  - (si aplica) `WEBHOOK_BASE`

- Pega la URL pública (solo lectura) del calendario Outlook en `calendario.html`.

- Reemplaza el placeholder del PDF por el documento oficial:
  - `assets/docs/Politicas_El_Manzano.pdf`

## Nota sobre seguridad del token

El token en frontend **no es secreto**. En Fase 2 lo reforzamos con:
- Nginx + allowlist de rutas
- Cloudflare Access (para n8n)
- WAF / Rate limiting en hooks
