/* Centro Recreativo El Manzano - app.js (FASE 1)
   - Render dinámico desde assets/data/catalog.json
   - Carrito en localStorage
   - Transiciones y animaciones reveal
   - Unidades de cobro:
     - persona_noche => precio * personas * noches
     - persona_dia   => precio * personas * dias
     - persona       => precio * personas
     - dia           => precio * dias
*/

(() => {
  "use strict";

  const CATALOG_URL = "assets/data/catalog.json";
  const CART_KEY = "elmanzano_cart_v2";

  // IMPORTANTE:
  // En un sitio estático, un token "secreto" en el frontend NO es realmente secreto.
  // Se deja aquí por requisito de la FASE 1; en producción se protege en el lado servidor + Cloudflare.
  const WEBHOOK_BASE = "https://hooks.elmanzano.homfsain.com";
  const WEBHOOK_TOKEN = "[TOKEN_SEGURO_AQUI]";

  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));

  function formatMoneyCLP(value) {
    try {
      return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(value);
    } catch {
      return `$${Math.round(value)}`;
    }
  }

  function toast(msg) {
    let t = $(".toast");
    if (!t) {
      t = document.createElement("div");
      t.className = "toast";
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add("show");
    window.clearTimeout(toast._timer);
    toast._timer = window.setTimeout(() => t.classList.remove("show"), 2600);
  }

  // ---------------------------
  // Page transitions (fade out)
  // ---------------------------
  function enablePageTransitions() {
    const wrap = $(".page-fade");
    if (!wrap) return;

    requestAnimationFrame(() => wrap.classList.add("ready"));

    document.addEventListener("click", (e) => {
      const a = e.target.closest("a");
      if (!a) return;
      const href = a.getAttribute("href") || "";
      const isExternal = a.target === "_blank" || href.startsWith("http") || href.startsWith("mailto:") || href.startsWith("tel:");
      const isHashOnly = href.startsWith("#");
      if (isExternal || isHashOnly) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      e.preventDefault();
      wrap.classList.add("leaving");
      window.setTimeout(() => (window.location.href = href), 180);
    });
  }

  // ---------------------------
  // Reveal on scroll
  // ---------------------------
  function enableReveal() {
    const items = $$(".reveal");
    if (!items.length) return;

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) en.target.classList.add("is-visible");
        });
      },
      { threshold: 0.15 }
    );
    items.forEach((el) => io.observe(el));
  }

  // ---------------------------
  // Catalog
  // ---------------------------
  async function loadCatalog() {
    const res = await fetch(CATALOG_URL, { cache: "no-store" });
    if (!res.ok) throw new Error("No se pudo cargar el catálogo");
    return res.json();
  }

  function groupBy(arr, key) {
    return arr.reduce((acc, it) => {
      const k = it[key] || "Otros";
      acc[k] = acc[k] || [];
      acc[k].push(it);
      return acc;
    }, {});
  }

  // ---------------------------
  // Billing helpers
  // ---------------------------
  function normalizeUnidad(u) {
    const unit = String(u || "persona_noche").toLowerCase().trim();
    if (["persona_noche", "persona_dia", "persona", "dia"].includes(unit)) return unit;
    return "persona_noche";
  }

  function billingLegendHTML(service) {
    const u = normalizeUnidad(service.unidad_cobro);
    if (u === "dia") return `IVA incluido <em>POR DÍA</em>`;
    if (u === "persona") return `IVA incluido <em>POR PERSONA</em>`;
    if (u === "persona_dia") return `IVA incluido <em>POR PERSONA POR DÍA</em>`;
    return `IVA incluido <em>POR PERSONA POR NOCHE</em>`;
  }

  function billingShortLabel(u) {
    const unit = normalizeUnidad(u);
    if (unit === "dia") return "POR DÍA";
    if (unit === "persona") return "POR PERSONA";
    if (unit === "persona_dia") return "POR PERSONA POR DÍA";
    return "POR PERSONA POR NOCHE";
  }

  function calcItemSubtotal(it) {
    const unit = normalizeUnidad(it.unidad_cobro);
    const precio = Number(it.precio || 0);

    const personas = Math.max(1, Number(it.personas || 1));
    const noches = Math.max(1, Number(it.noches || 1));
    const dias = Math.max(1, Number(it.dias || 1));

    if (unit === "dia") return precio * dias;
    if (unit === "persona") return precio * personas;
    if (unit === "persona_dia") return precio * personas * dias;
    return precio * personas * noches; // persona_noche
  }

  function itemKey(it) {
    const unit = normalizeUnidad(it.unidad_cobro);
    // Para separar variantes por noches/días
    if (unit === "persona_noche") return `${it.id}|${unit}|n${it.noches || 1}`;
    if (unit === "persona_dia" || unit === "dia") return `${it.id}|${unit}|d${it.dias || 1}`;
    return `${it.id}|${unit}`;
  }

  // ---------------------------
  // Cart
  // item shape:
  // {
  //   id, nombre, precio, unidad_cobro,
  //   personas?, noches?, dias?,
  //   imagen, categoria
  // }
  // ---------------------------
  function getCart() {
    try {
      const raw = localStorage.getItem(CART_KEY);
      const cart = raw ? JSON.parse(raw) : [];
      return Array.isArray(cart) ? cart : [];
    } catch {
      return [];
    }
  }

  function saveCart(cart) {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
    updateCartBadge();
  }

  function cartTotal(cart = getCart()) {
    return cart.reduce((sum, it) => sum + calcItemSubtotal(it), 0);
  }

  function cartCount(cart = getCart()) {
    // Badge: suma de "cantidad" razonable según unidad
    return cart.reduce((sum, it) => {
      const unit = normalizeUnidad(it.unidad_cobro);
      if (unit === "dia") return sum + Math.max(1, Number(it.dias || 1));
      if (unit === "persona") return sum + Math.max(1, Number(it.personas || 1));
      if (unit === "persona_dia") return sum + Math.max(1, Number(it.personas || 1));
      return sum + Math.max(1, Number(it.personas || 1)); // persona_noche
    }, 0);
  }

  function updateCartBadge() {
    const el = $("#cartCount");
    if (!el) return;
    const c = cartCount();
    el.textContent = c ? String(c) : "0";
  }

  function addToCart(service, values = {}) {
    const unit = normalizeUnidad(service.unidad_cobro);

    const personas = Math.max(1, Number(values.personas || 1));
    const noches = Math.max(1, Number(values.noches || 1));
    const dias = Math.max(1, Number(values.dias || 1));

    const cart = getCart();

    const newItem = {
      id: service.id,
      nombre: service.nombre,
      precio: service.precio_por_persona_noche,
      unidad_cobro: unit,
      // campos por unidad:
      personas: unit === "dia" ? 1 : personas,
      noches: unit === "persona_noche" ? noches : 1,
      dias: unit === "persona_dia" || unit === "dia" ? dias : 1,
      imagen: (service.imagenes && service.imagenes[0]) || "",
      categoria: service.categoria || "",
    };

    const k = itemKey(newItem);
    const existing = cart.find((x) => itemKey(x) === k);

    if (existing) {
      // Merge: suma personas si aplica, sino suma días
      if (unit === "dia") existing.dias = Math.max(1, Number(existing.dias || 1)) + dias;
      else existing.personas = Math.max(1, Number(existing.personas || 1)) + personas;
    } else {
      cart.push(newItem);
    }

    saveCart(cart);
    toast("Agregado al carrito ✅");
  }

  function findCartItem(cart, data) {
    const id = String(data.id);
    const unit = normalizeUnidad(data.unidad_cobro);
    const noches = Number(data.noches || 1);
    const dias = Number(data.dias || 1);

    return cart.find((x) => {
      if (String(x.id) !== id) return false;
      if (normalizeUnidad(x.unidad_cobro) !== unit) return false;

      if (unit === "persona_noche") return Number(x.noches || 1) === noches;
      if (unit === "persona_dia" || unit === "dia") return Number(x.dias || 1) === dias;
      return true;
    });
  }

  function removeFromCart(data) {
    const cart = getCart().filter((x) => itemKey(x) !== itemKey(data));
    saveCart(cart);
  }

  function setCartPersonas(data, value) {
    const v = Math.max(1, Math.min(99, Number(value) || 1));
    const cart = getCart();
    const it = findCartItem(cart, data);
    if (!it) return;

    // En unidad "dia" personas no aplica
    if (normalizeUnidad(it.unidad_cobro) === "dia") return;

    it.personas = v;
    saveCart(cart);
  }

  function setCartNoches(data, value) {
    const v = Math.max(1, Math.min(30, Number(value) || 1));
    const cart = getCart();
    const it = findCartItem(cart, data);
    if (!it) return;

    if (normalizeUnidad(it.unidad_cobro) !== "persona_noche") return;

    // cambiar noches cambia la "variante", así que removemos y reinsertamos
    const updated = { ...it, noches: v };
    const filtered = cart.filter((x) => itemKey(x) !== itemKey(it));
    // merge con existente si existe
    const existing = filtered.find((x) => itemKey(x) === itemKey(updated));
    if (existing) existing.personas = Math.max(1, Number(existing.personas || 1)) + Math.max(1, Number(updated.personas || 1));
    else filtered.push(updated);

    saveCart(filtered);
  }

  function setCartDias(data, value) {
    const v = Math.max(1, Math.min(30, Number(value) || 1));
    const cart = getCart();
    const it = findCartItem(cart, data);
    if (!it) return;

    const unit = normalizeUnidad(it.unidad_cobro);
    if (unit !== "persona_dia" && unit !== "dia") return;

    const updated = { ...it, dias: v };
    const filtered = cart.filter((x) => itemKey(x) !== itemKey(it));
    const existing = filtered.find((x) => itemKey(x) === itemKey(updated));

    if (existing) {
      // merge: suma personas (si aplica) o días
      if (unit === "dia") existing.dias = Math.max(1, Number(existing.dias || 1)) + v;
      else existing.personas = Math.max(1, Number(existing.personas || 1)) + Math.max(1, Number(updated.personas || 1));
    } else {
      filtered.push(updated);
    }

    saveCart(filtered);
  }

  // ---------------------------
  // Webhook POST
  // ---------------------------
  async function postWebhook(path, payload) {
    const url = `${WEBHOOK_BASE}${path}`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-ELMANZANO-TOKEN": WEBHOOK_TOKEN,
      },
      body: JSON.stringify(payload),
    });

    let data = null;
    try {
      data = await res.json();
    } catch {
      // ignore
    }

    if (!res.ok) {
      const detail = (data && (data.message || data.error)) || `HTTP ${res.status}`;
      throw new Error(detail);
    }
    return data;
  }

  // ---------------------------
  // Render: servicios.html
  // ---------------------------
  async function renderServicios() {
    const root = $("#servicesRoot");
    if (!root) return;

    root.innerHTML = `<div class="badge">Cargando servicios…</div>`;
    try {
      const { servicios } = await loadCatalog();
      const groups = groupBy(servicios, "categoria");

      const chunks = Object.keys(groups)
        .sort()
        .map((cat) => {
          const cards = groups[cat]
            .map((s) => {
              const img = (s.imagenes && s.imagenes[0]) || "assets/img/hero.jpg";
              const price = formatMoneyCLP(s.precio_por_persona_noche);
              const legend = billingLegendHTML(s);

              return `
                <article class="card reveal">
                  <a href="servicio.html?id=${encodeURIComponent(s.id)}" aria-label="Ver ${escapeHtml(s.nombre)}">
                    <div class="media"><img src="${img}" alt="${escapeHtml(s.nombre)}" loading="lazy"></div>
                    <div class="body">
                      <span class="badge">${escapeHtml(s.categoria)}</span>
                      <h3>${escapeHtml(s.nombre)}</h3>
                      <p>${escapeHtml(s.descripcion_corta || s.descripcion || "")}</p>
                      <div class="meta">
                        <div class="price">
                          <strong>${price}</strong>
                          <span>${legend}</span>
                        </div>
                        <span class="btn small ghost">Ver detalle →</span>
                      </div>
                    </div>
                  </a>
                </article>`;
            })
            .join("");

          return `
            <section class="section" id="${slugify(cat)}">
              <div class="section-head">
                <div>
                  <h2>${escapeHtml(cat)}</h2>
                  <p>Explora opciones y arma tu cotización en minutos.</p>
                </div>
                <a class="btn small primary" href="cotizar.html">Cotizar ahora</a>
              </div>
              <div class="grid cards auto">${cards}</div>
            </section>`;
        })
        .join("");

      root.innerHTML = chunks;
      enableReveal();
      toast("Servicios listos ✨");
    } catch (err) {
      root.innerHTML = `<div class="badge">No se pudo cargar el catálogo. (${escapeHtml(String(err.message || err))})</div>`;
    }
  }

  // ---------------------------
  // Render: servicio.html?id=
  // ---------------------------
  async function renderServicioDetalle() {
    const root = $("#serviceDetail");
    if (!root) return;

    const id = new URLSearchParams(window.location.search).get("id");
    if (!id) {
      root.innerHTML = `<div class="badge">Falta el parámetro <b>?id=</b></div>`;
      return;
    }

    root.innerHTML = `<div class="badge">Cargando…</div>`;

    try {
      const { servicios } = await loadCatalog();
      const s = servicios.find((x) => String(x.id) === String(id));
      if (!s) {
        root.innerHTML = `<div class="badge">Servicio no encontrado: <b>${escapeHtml(id)}</b></div>`;
        return;
      }

      const unit = normalizeUnidad(s.unidad_cobro);
      const price = formatMoneyCLP(s.precio_por_persona_noche);
      const legend = billingLegendHTML(s);
      const imgs = (s.imagenes || []).slice(0, 6);

      const gallery = imgs
        .map((src, i) => {
          const cls = i === 0 ? "g-col-8" : "g-col-4";
          return `<img class="${cls}" src="${src}" alt="${escapeHtml(s.nombre)} foto ${i + 1}" loading="lazy">`;
        })
        .join("");

      const inputsHTML = (() => {
        if (unit === "persona_noche") {
          return `
            <div class="grid" style="grid-template-columns: repeat(2, minmax(0,1fr)); gap:.8rem; margin-top:1rem;">
              <div class="field">
                <label for="personas">Personas</label>
                <input class="input" id="personas" type="number" min="1" max="99" value="2">
              </div>
              <div class="field">
                <label for="noches">Noches</label>
                <input class="input" id="noches" type="number" min="1" max="30" value="1">
              </div>
            </div>
            <div class="help" style="margin-top:.9rem;">
              Total: <b>precio × personas × noches</b>.
            </div>
          `;
        }
        if (unit === "persona_dia") {
          return `
            <div class="grid" style="grid-template-columns: repeat(2, minmax(0,1fr)); gap:.8rem; margin-top:1rem;">
              <div class="field">
                <label for="personas">Personas</label>
                <input class="input" id="personas" type="number" min="1" max="99" value="2">
              </div>
              <div class="field">
                <label for="dias">Días</label>
                <input class="input" id="dias" type="number" min="1" max="30" value="1">
              </div>
            </div>
            <div class="help" style="margin-top:.9rem;">
              Total: <b>precio × personas × días</b>.
            </div>
          `;
        }
        if (unit === "dia") {
          return `
            <div class="grid" style="grid-template-columns: 1fr; gap:.8rem; margin-top:1rem;">
              <div class="field">
                <label for="dias">Días</label>
                <input class="input" id="dias" type="number" min="1" max="30" value="1">
              </div>
            </div>
            <div class="help" style="margin-top:.9rem;">
              Total: <b>precio × días</b>.
            </div>
          `;
        }
        // persona
        return `
          <div class="grid" style="grid-template-columns: 1fr; gap:.8rem; margin-top:1rem;">
            <div class="field">
              <label for="personas">Personas</label>
              <input class="input" id="personas" type="number" min="1" max="99" value="2">
            </div>
          </div>
          <div class="help" style="margin-top:.9rem;">
            Total: <b>precio × personas</b>.
          </div>
        `;
      })();

      root.innerHTML = `
        <div class="split">
          <div class="panel">
            <div class="pad">
              <span class="badge">${escapeHtml(s.categoria)}</span>
              <h2 style="margin:.6rem 0 .3rem;">${escapeHtml(s.nombre)}</h2>
              <p style="margin:.2rem 0 1rem;">${escapeHtml(s.descripcion)}</p>

              <div class="price" style="margin:1rem 0 1rem; max-width: 360px;">
                <strong>${price}</strong>
                <span>${legend}</span>
              </div>

              ${inputsHTML}

              <div class="hero-actions" style="margin-top:1rem;">
                <button class="btn primary" id="btnAddCart">Agregar al carrito</button>
                <a class="btn ghost" href="cotizar.html">Ir a cotizar</a>
              </div>
            </div>
          </div>

          <div class="panel">
            <div class="panel-media" style="height:100%;">
              <div class="gallery" style="padding: .95rem;">
                ${gallery || `<img class="g-col-12" src="assets/img/hero.jpg" alt="Imagen" loading="lazy">`}
              </div>
            </div>
          </div>
        </div>
      `;

      $("#btnAddCart").addEventListener("click", () => {
        const unit = normalizeUnidad(s.unidad_cobro);

        const personas = Number($("#personas")?.value || 1);
        const noches = Number($("#noches")?.value || 1);
        const dias = Number($("#dias")?.value || 1);

        if (unit === "persona_noche") addToCart(s, { personas: Math.max(1, personas), noches: Math.max(1, noches) });
        else if (unit === "persona_dia") addToCart(s, { personas: Math.max(1, personas), dias: Math.max(1, dias) });
        else if (unit === "dia") addToCart(s, { dias: Math.max(1, dias) });
        else addToCart(s, { personas: Math.max(1, personas) });
      });

      document.title = `${s.nombre} | Centro Recreativo El Manzano`;
      toast("Detalle listo ✅");
    } catch (err) {
      root.innerHTML = `<div class="badge">Error: ${escapeHtml(String(err.message || err))}</div>`;
    }
  }

  // ---------------------------
  // Render: cotizar.html
  // ---------------------------
  function renderCartUI() {
    const root = $("#cartRoot");
    if (!root) return;

    const cart = getCart();
    if (!cart.length) {
      root.innerHTML = `
        <div class="cart">
          <div class="cart-head">
            <b>Tu carrito</b>
            <span class="badge">0 items</span>
          </div>
          <div class="cart-body">
            <p>Tu carrito está vacío. Explora servicios y vuelve para cotizar.</p>
            <a class="btn primary" href="servicios.html">Ver servicios</a>
          </div>
        </div>`;
      $("#cotizacionTotal").textContent = formatMoneyCLP(0);
      return;
    }

    const rows = cart
      .map((it) => {
        const unit = normalizeUnidad(it.unidad_cobro);
        const subtotal = calcItemSubtotal(it);

        const labelUnidad = billingShortLabel(unit);
        const precio = formatMoneyCLP(it.precio || 0);

        const nochesOrDiasBlock = (() => {
          if (unit === "persona_noche") {
            return `
              <small>Noches</small><br>
              <input class="input" style="padding:.55rem .6rem; border-radius:10px;" type="number" min="1" max="30"
                value="${escapeHtml(String(it.noches || 1))}"
                data-act="noches" data-id="${escapeHtml(it.id)}" data-unit="${unit}">
            `;
          }
          if (unit === "persona_dia" || unit === "dia") {
            return `
              <small>Días</small><br>
              <input class="input" style="padding:.55rem .6rem; border-radius:10px;" type="number" min="1" max="30"
                value="${escapeHtml(String(it.dias || 1))}"
                data-act="dias" data-id="${escapeHtml(it.id)}" data-unit="${unit}">
            `;
          }
          return `<small>Duración</small><br><b>—</b>`;
        })();

        const qtyControls = (() => {
          const disabled = unit === "dia" ? "disabled" : "";
          const val = unit === "dia" ? 1 : (it.personas || 1);
          return `
            <div class="qty">
              <button type="button" ${disabled} aria-label="Restar" data-act="minus" data-id="${escapeHtml(it.id)}" data-unit="${unit}" data-noches="${it.noches || 1}" data-dias="${it.dias || 1}">−</button>
              <input type="number" ${disabled} min="1" max="99" value="${escapeHtml(String(val))}"
                data-act="input" data-id="${escapeHtml(it.id)}" data-unit="${unit}" data-noches="${it.noches || 1}" data-dias="${it.dias || 1}">
              <button type="button" ${disabled} aria-label="Sumar" data-act="plus" data-id="${escapeHtml(it.id)}" data-unit="${unit}" data-noches="${it.noches || 1}" data-dias="${it.dias || 1}">+</button>
            </div>
          `;
        })();

        const qtyLabel = unit === "dia" ? "Cantidad" : "Personas";

        return `
          <div class="cart-row">
            <div>
              <b>${escapeHtml(it.nombre)}</b><br>
              <small>${escapeHtml(it.categoria || "")}</small>
            </div>

            <div>
              <small>Precio</small><br>
              <b>${precio}</b><br>
              <small style="text-transform:uppercase; letter-spacing:.3px;">
                <b style="color:var(--brand-gold)">${escapeHtml(labelUnidad)}</b><br>
                <span style="opacity:.85;">IVA incluido</span>
              </small>
            </div>

            <div>
              ${nochesOrDiasBlock}
            </div>

            <div>
              <small>${escapeHtml(qtyLabel)}</small><br>
              ${qtyControls}
            </div>

            <div style="text-align:right;">
              <small>Subtotal</small><br>
              <b>${formatMoneyCLP(subtotal)}</b><br>
              <button class="btn small ghost" type="button"
                data-act="remove" data-id="${escapeHtml(it.id)}" data-unit="${unit}" data-noches="${it.noches || 1}" data-dias="${it.dias || 1}">
                Quitar
              </button>
            </div>
          </div>
        `;
      })
      .join("");

    root.innerHTML = `
      <div class="cart">
        <div class="cart-head">
          <b>Tu carrito</b>
          <span class="badge">${escapeHtml(String(cart.length))} items</span>
        </div>
        <div class="cart-body">${rows}</div>
      </div>
    `;

    root.addEventListener("click", (e) => {
      const btn = e.target.closest("button");
      if (!btn) return;

      const act = btn.dataset.act;
      const id = btn.dataset.id;
      const unit = normalizeUnidad(btn.dataset.unit);
      const noches = Number(btn.dataset.noches || 1);
      const dias = Number(btn.dataset.dias || 1);

      const cartNow = getCart();
      const it = findCartItem(cartNow, { id, unidad_cobro: unit, noches, dias });
      if (!it) return;

      if (act === "minus") setCartPersonas(it, (it.personas || 1) - 1);
      if (act === "plus") setCartPersonas(it, (it.personas || 1) + 1);
      if (act === "remove") removeFromCart(it);

      renderCartUI();
      $("#cotizacionTotal").textContent = formatMoneyCLP(cartTotal());
    });

    root.addEventListener("input", (e) => {
      const inp = e.target;
      if (!(inp instanceof HTMLInputElement)) return;

      const act = inp.dataset.act;
      const id = inp.dataset.id;
      const unit = normalizeUnidad(inp.dataset.unit);
      const noches = Number(inp.dataset.noches || 1);
      const dias = Number(inp.dataset.dias || 1);

      const cartNow = getCart();
      const it = findCartItem(cartNow, { id, unidad_cobro: unit, noches, dias });
      if (!it) return;

      if (act === "input") setCartPersonas(it, inp.value);
      if (act === "noches") setCartNoches(it, inp.value);
      if (act === "dias") setCartDias(it, inp.value);

      renderCartUI();
      $("#cotizacionTotal").textContent = formatMoneyCLP(cartTotal());
    });

    $("#cotizacionTotal").textContent = formatMoneyCLP(cartTotal());
  }

  // ---------------------------
  // enviarCotizacion / enviarContacto
  // ---------------------------
  async function enviarCotizacion() {
    const hp = ($("#hp")?.value || "").trim();
    if (hp) {
      toast("Gracias 🙌");
      return; // bot
    }

    const cart = getCart();
    if (!cart.length) {
      toast("Tu carrito está vacío");
      return;
    }

    const payload = {
      tipo: "cotizacion",
      created_at: new Date().toISOString(),
      carrito: cart,
      total: cartTotal(cart),
      cliente: {
        nombre: ($("#nombre")?.value || "").trim(),
        email: ($("#email")?.value || "").trim(),
        telefono: ($("#telefono")?.value || "").trim(),
        fecha_inicio: ($("#fecha_inicio")?.value || "").trim(),
        fecha_fin: ($("#fecha_fin")?.value || "").trim(),
        mensaje: ($("#mensaje")?.value || "").trim(),
      },
      hp: hp,
      user_agent: navigator.userAgent,
      referrer: document.referrer || "",
      page: window.location.href,
    };

    if (!payload.cliente.nombre || !payload.cliente.email) {
      toast("Completa nombre y email");
      return;
    }

    const btn = $("#btnEnviarCotizacion");
    const old = btn?.textContent;
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Enviando…";
    }

    try {
      await postWebhook("/webhook/cotizacion", payload);
      toast("Solicitud enviada ✅");
      localStorage.removeItem(CART_KEY);
      updateCartBadge();
      renderCartUI();
      $("#cotizacionTotal").textContent = formatMoneyCLP(0);
      $("#cotizarForm")?.reset();
    } catch (err) {
      toast(`Error: ${String(err.message || err)}`);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = old || "Enviar cotización";
      }
    }
  }

  async function enviarContacto() {
    const hp = ($("#hp_contacto")?.value || "").trim();
    if (hp) {
      toast("Gracias 🙌");
      return;
    }

    const payload = {
      tipo: "contacto",
      created_at: new Date().toISOString(),
      contacto: {
        nombre: ($("#c_nombre")?.value || "").trim(),
        email: ($("#c_email")?.value || "").trim(),
        telefono: ($("#c_telefono")?.value || "").trim(),
        mensaje: ($("#c_mensaje")?.value || "").trim(),
      },
      hp: hp,
      user_agent: navigator.userAgent,
      referrer: document.referrer || "",
      page: window.location.href,
    };

    if (!payload.contacto.nombre || !payload.contacto.email || !payload.contacto.mensaje) {
      toast("Completa nombre, email y mensaje");
      return;
    }

    const btn = $("#btnEnviarContacto");
    const old = btn?.textContent;
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Enviando…";
    }

    try {
      await postWebhook("/webhook/contacto", payload);
      toast("Mensaje enviado ✅");
      $("#contactoForm")?.reset();
    } catch (err) {
      toast(`Error: ${String(err.message || err)}`);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = old || "Enviar";
      }
    }
  }

  // ---------------------------
  // Misc helpers
  // ---------------------------
  function slugify(str){
    return String(str || "")
      .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
      .replace(/[^a-zA-Z0-9]+/g,"-")
      .replace(/(^-|-$)/g,"")
      .toLowerCase();
  }

  function escapeHtml(str) {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function setActiveNav() {
    const path = (window.location.pathname.split("/").pop() || "index.html").toLowerCase();
    $$(".navlinks a").forEach((a) => {
      const href = (a.getAttribute("href") || "").toLowerCase();
      if (href === path) a.classList.add("active");
    });
  }

  // ---------------------------
  // Boot
  // ---------------------------
  function boot() {
    enablePageTransitions();
    enableReveal();
    setActiveNav();
    updateCartBadge();

    const page = document.body?.dataset?.page || "";

    if (page === "servicios") renderServicios();
    if (page === "servicio") renderServicioDetalle();
    if (page === "cotizar") {
      renderCartUI();
      $("#btnEnviarCotizacion")?.addEventListener("click", (e) => {
        e.preventDefault();
        enviarCotizacion();
      });
    }

    $("#btnEnviarContacto")?.addEventListener("click", (e) => {
      e.preventDefault();
      enviarContacto();
    });

    const v = $("#heroVideo");
    if (v) {
      v.muted = true;
      const play = () => v.play().catch(() => {});
      play();
      document.addEventListener("visibilitychange", () => {
        if (!document.hidden) play();
      });
    }
  }

  window.enviarCotizacion = enviarCotizacion;
  window.enviarContacto = enviarContacto;
  window.postWebhook = postWebhook;

  document.addEventListener("DOMContentLoaded", boot);
})();
