
function normalizeDriveImageUrl(url, size = 2000) {
  const raw = String(url || "").trim();
  if (!raw) return "";
  const match = raw.match(/[?&]id=([^&]+)/) || raw.match(/\/d\/([^/]+)/);
  if (match && raw.includes("drive.google.com")) {
    return `https://drive.google.com/thumbnail?id=${match[1]}&sz=w${size}`;
  }
  return raw;
}

/*
  VALYR — Catálogo conectado a Google Sheets + carrito de reserva

  Solución aplicada:
  - No usa fetch() directo al CSV de Google, porque puede ser bloqueado por CORS.
  - Lee la pestaña PRODUCTOS mediante Google Visualization JSONP.
  - Mantiene Google Sheets como panel de productos.
*/

const SHEET_ID = "1hqtdJniMw3n-5Btbsb3n5AS-NRLmvaY0ZsYz5VO_smo";
const SHEET_NAME = "PRODUCTOS";
const WHATSAPP_NUMBER = "584146460088";
const CART_STORAGE_KEY = "valyr_reservation_cart_session_v2";
const PAGE_TYPE = document.body?.dataset.page || "home";

const fallbackProducts = [
  {
    id: "VLR-001",
    activo: "SI",
    destacado: "SI",
    nombre: "Oversized Core Black",
    marca: "Essentials",
    categoria: "TEES",
    genero: "UNISEX",
    precio: "35",
    moneda: "$",
    tallas: "M / L / XL",
    color: "Negro",
    estado: "Disponible",
    imagen_frontal: "",
    imagen_trasera: "",
    imagenes_extra: "",
    descripcion: "Fit oversize. Presencia limpia. Stock limitado.",
    drop: "THE DROP 01",
    orden: "1"
  },
  {
    id: "VLR-002",
    activo: "SI",
    destacado: "SI",
    nombre: "Oversized Core White",
    marca: "Hellstar",
    categoria: "TEES",
    genero: "HOMBRE",
    precio: "45",
    moneda: "$",
    tallas: "M / L / XL",
    color: "Blanco",
    estado: "Disponible",
    imagen_frontal: "",
    imagen_trasera: "",
    imagenes_extra: "",
    descripcion: "Pieza clara de contraste fuerte para rotación premium.",
    drop: "THE DROP 01",
    orden: "2"
  },
  {
    id: "VLR-003",
    activo: "SI",
    destacado: "NO",
    nombre: "Washed Denim Piece",
    marca: "Amiri Style",
    categoria: "DENIM",
    genero: "UNISEX",
    precio: "78",
    moneda: "$",
    tallas: "30 / 32 / 34",
    color: "Gris lavado",
    estado: "Reservado",
    imagen_frontal: "",
    imagen_trasera: "",
    imagenes_extra: "",
    descripcion: "Denim lavado con carácter nocturno y silueta marcada.",
    drop: "PRIVATE VAULT",
    orden: "3"
  },
  {
    id: "VLR-004",
    activo: "SI",
    destacado: "NO",
    nombre: "Soft Vault Tee",
    marca: "Valyr",
    categoria: "TEES",
    genero: "MUJER",
    precio: "38",
    moneda: "$",
    tallas: "S / M / L",
    color: "Negro",
    estado: "Disponible",
    imagen_frontal: "",
    imagen_trasera: "",
    imagenes_extra: "",
    descripcion: "Silueta limpia. Presencia femenina. Drop limitado.",
    drop: "PRIVATE VAULT",
    orden: "4"
  }
];

let allProducts = [];
let currentCategory = getInitialParam("categoria", "ALL");
let currentGender = getInitialParam("genero", "ALL");
let cart = [];

const els = {
  dropGrid: document.querySelector("#dropGrid"),
  productGrid: document.querySelector("#productGrid"),
  filterBar: document.querySelector("#filterBar"),
  audienceBar: document.querySelector("#audienceBar"),
  productDetail: document.querySelector("#productDetail"),
  similarGrid: document.querySelector("#similarGrid"),
  productCount: document.querySelector("#productCount"),
  emptyState: document.querySelector("#emptyState"),
  mainWhatsapp: document.querySelector("#mainWhatsapp"),
  year: document.querySelector("#year"),
  cartDrawer: document.querySelector("#cartDrawer"),
  cartPanel: document.querySelector(".cart-panel"),
  cartFloating: document.querySelector("#cartFloating"),
  cartNavBtn: document.querySelector("#cartNavBtn"),
  cartOpenButtons: document.querySelectorAll("[data-cart-open], #cartNavBtn"),
  mobileMenu: document.querySelector("#mobileMenu"),
  mobileMenuBtn: document.querySelector("#mobileMenuBtn"),
  mobileMenuCloseButtons: document.querySelectorAll("[data-mobile-menu-close]"),
  cartClose: document.querySelector("#cartClose"),
  cartItems: document.querySelector("#cartItems"),
  cartEmpty: document.querySelector("#cartEmpty"),
  cartTotal: document.querySelector("#cartTotal"),
  cartWhatsapp: document.querySelector("#cartWhatsapp"),
  cartClear: document.querySelector("#cartClear"),
  cartCountNav: document.querySelector("#cartCountNav"),
  cartCountFloating: document.querySelector("#cartCountFloating"),
  cartCountMobile: document.querySelector("#cartCountMobile"),
  cartCountNodes: document.querySelectorAll("[data-cart-count]"),
  vaultTotal: document.querySelector("#vaultTotal"),
  newsletterForm: document.querySelector("#newsletterForm"),
  newsletterEmail: document.querySelector("#newsletterEmail"),
  newsletterStatus: document.querySelector("#newsletterStatus")
};

init();

async function init() {
  if (els.year) els.year.textContent = new Date().getFullYear();
  if (els.mainWhatsapp) els.mainWhatsapp.href = buildGeneralWhatsappLink();

  cart = loadCart();
  allProducts = await loadProducts();
  allProducts = sanitizeProducts(allProducts);

  updateVaultStats(allProducts);
  renderAudienceFilters(allProducts);
  renderFilters(allProducts);
  renderDrop(allProducts);
  renderCatalog();
  renderProductDetail();
  bindCartEvents();
  bindMobileMenuEvents();
  bindProductNavigation();
  bindNewsletterEvents();
  renderCart();
}

async function loadProducts() {
  if (!SHEET_ID || !SHEET_NAME) {
    return fallbackProducts;
  }

  try {
    return await loadProductsFromGoogleSheet();
  } catch (error) {
    console.warn("Usando productos de ejemplo:", error);
    return fallbackProducts;
  }
}

function loadProductsFromGoogleSheet() {
  return new Promise((resolve, reject) => {
    const callbackName = `__valyrSheetResponse_${Date.now()}`;
    const query = encodeURIComponent("select *");
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?sheet=${encodeURIComponent(SHEET_NAME)}&headers=1&tq=${query}&tqx=out:json;responseHandler:${callbackName}`;
    const script = document.createElement("script");

    const cleanup = () => {
      clearTimeout(timeout);
      delete window[callbackName];
      script.remove();
    };

    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("Tiempo de espera agotado al cargar Google Sheets"));
    }, 10000);

    window[callbackName] = (response) => {
      cleanup();

      if (!response || response.status !== "ok" || !response.table) {
        reject(new Error("Google Sheets no devolvió una tabla válida"));
        return;
      }

      resolve(gvizTableToProducts(response.table));
    };

    script.onerror = () => {
      cleanup();
      reject(new Error("No se pudo cargar Google Sheets"));
    };

    script.src = url;
    document.head.appendChild(script);
  });
}

function gvizTableToProducts(table) {
  const headers = (table.cols || []).map((column) => String(column.label || column.id || "").trim());

  return (table.rows || []).map((row) => {
    const product = {};

    headers.forEach((header, index) => {
      const cell = row.c?.[index];
      product[header] = String(cell?.f ?? cell?.v ?? "").trim();
    });

    return product;
  });
}

function sanitizeProducts(products) {
  return products
    .map((product) => normalizeKeys(product))
    .map((product) => ({
      ...product,
      categoria: String(product.categoria || "VALYR PIECES").trim().toUpperCase(),
      genero: normalizeGender(product.genero || product.audiencia || product.gender || "UNISEX")
    }))
    .filter((product) => normalize(product.activo) !== "no")
    .sort((a, b) => Number(a.orden || 999) - Number(b.orden || 999));
}

function normalizeKeys(product) {
  const normalized = {};
  Object.entries(product).forEach(([key, value]) => {
    const cleanKey = key.trim().toLowerCase().replaceAll(" ", "_");
    normalized[cleanKey] = String(value ?? "").trim();
  });
  return normalized;
}

function updateVaultStats(products) {
  if (!els.vaultTotal) return;
  const count = products.length;
  els.vaultTotal.textContent = `${count} pieza${count === 1 ? "" : "s"} activas`;
}

function renderAudienceFilters(products) {
  if (!els.audienceBar) return;

  const audiences = ["ALL", "HOMBRE", "MUJER", "UNISEX"];

  els.audienceBar.innerHTML = audiences
    .map((audience) => `<button class="audience-filter-btn ${audience === currentGender ? "active" : ""}" data-genero="${escapeAttr(audience)}">${escapeHTML(audience === "ALL" ? "TODO" : audience)}</button>`)
    .join("");

  els.audienceBar.querySelectorAll(".audience-filter-btn").forEach((button) => {
    button.addEventListener("click", () => {
      currentGender = button.dataset.genero;
      updateCatalogUrlState();
      renderAudienceFilters(allProducts);
      renderCatalog();
    });
  });
}

function renderFilters(products) {
  if (!els.filterBar) return;

  const baseCategories = ["ALL", "TEES", "HOODIES", "DENIM", "CAPS", "SNEAKERS", "ACCESSORIES", "VALYR PIECES"];
  const productCategories = products.map((p) => String(p.categoria || "").trim().toUpperCase()).filter(Boolean);
  const categories = [...new Set([...baseCategories, ...productCategories])];

  els.filterBar.innerHTML = categories
    .map((category) => `<button class="filter-btn ${category === currentCategory ? "active" : ""}" data-category="${escapeAttr(category)}">${escapeHTML(category)}</button>`)
    .join("");

  els.filterBar.querySelectorAll(".filter-btn").forEach((button) => {
    button.addEventListener("click", () => {
      currentCategory = button.dataset.category;
      updateCatalogUrlState();
      renderFilters(allProducts);
      renderCatalog();
    });
  });
}

function renderDrop(products) {
  if (!els.dropGrid) return;
  const featured = products.filter((product) => normalize(product.destacado) === "si");
  const source = featured.length ? featured : products;
  const limit = PAGE_TYPE === "home" ? 4 : 6;
  els.dropGrid.innerHTML = source.slice(0, limit).map(createProductCard).join("");
}

function renderCatalog() {
  if (!els.productGrid) return;

  const filtered = filterProducts(allProducts);

  const visibleProducts = PAGE_TYPE === "home" ? filtered.slice(0, 4) : filtered;

  els.productGrid.innerHTML = visibleProducts.map(createProductCard).join("");

  if (els.productCount) {
    const label = PAGE_TYPE === "home" && filtered.length > visibleProducts.length
      ? `${visibleProducts.length} de ${filtered.length} piezas`
      : `${filtered.length} pieza${filtered.length === 1 ? "" : "s"}`;
    els.productCount.textContent = label;
  }

  if (els.emptyState) els.emptyState.hidden = filtered.length !== 0;
}

function createProductCard(product) {
  const status = getStatus(product.estado);
  const isAvailable = status.key === "available";
  const actionText = isAvailable ? "RESERVAR PIEZA" : status.action;
  const sizeOptions = getSizeOptions(product.tallas);

  return `
    <article class="product-card" data-product-id="${escapeAttr(product.id)}" role="link" tabindex="0" aria-label="Ver detalle de ${escapeAttr(product.nombre || "Pieza Valyr")}">
      <div class="product-image">
        <span class="status-pill ${status.key}">${status.label}</span>
        ${renderProductImages(product)}
      </div>
      <div class="product-body">
        <div class="product-brand-row">
          <div class="product-brand">${escapeHTML(product.marca || "VALYR")}</div>
          <span class="audience-pill">${escapeHTML(product.genero || "UNISEX")}</span>
        </div>
        <h3 class="product-title">${escapeHTML(product.nombre || "Pieza sin nombre")}</h3>
        <div class="product-price">${escapeHTML(product.moneda || "$")}${escapeHTML(product.precio || "0")}</div>
        <div class="product-meta">
          <span>Tallas: ${escapeHTML(product.tallas || "Consultar")}</span>
          <span>Color: ${escapeHTML(product.color || "Consultar")}</span>
          <span>${escapeHTML(product.genero || "UNISEX")}</span>
        </div>
        ${renderSizeSelector(sizeOptions, isAvailable)}
        <p class="product-desc">${escapeHTML(product.descripcion || "Pieza seleccionada por Valyr.")}</p>
        <button class="btn btn-ghost card-action add-to-cart ${isAvailable ? "" : "disabled"}" type="button" data-product-id="${escapeAttr(product.id)}" ${isAvailable ? "" : "disabled"}>${actionText}</button>
      </div>
    </article>
  `;
}

function renderSizeSelector(sizeOptions, isAvailable) {
  if (!isAvailable) {
    return "";
  }

  if (!sizeOptions.length) {
    return `<input class="size-select hidden-size" value="Consultar" aria-label="Talla" readonly>`;
  }

  return `
    <label class="size-field">
      <span>Seleccionar talla</span>
      <select class="size-select" aria-label="Seleccionar talla">
        ${sizeOptions.map((size) => `<option value="${escapeAttr(size)}">${escapeHTML(size)}</option>`).join("")}
      </select>
    </label>
  `;
}

function renderProductImages(product) {
  const images = getProductImages(product);
  const front = images[0] || "";
  const back = images[1] || "";

  if (!front && !back) {
    return `<div class="image-placeholder"><span>VALYR</span><small>NO CROWD / PRIVATE PIECE</small></div>`;
  }

  const frontImg = front
    ? `<img class="front" src="${escapeAttr(front)}" alt="${escapeAttr(product.nombre || "Pieza Valyr")}" loading="lazy">`
    : `<div class="image-placeholder"><span>VALYR</span><small>NO CROWD / PRIVATE PIECE</small></div>`;

  const backImg = back
    ? `<img class="back" src="${escapeAttr(back)}" alt="Parte trasera de ${escapeAttr(product.nombre || "Pieza Valyr")}" loading="lazy">`
    : "";

  return `${frontImg}${backImg}`;
}

function getProductImages(product = {}) {
  const images = [];
  const addImage = (value) => {
    const clean = normalizeDriveImageUrl(value, 2000);
    if (!clean) return;
    if (!images.some((image) => image === clean)) images.push(clean);
  };

  [
    "imagen_frontal",
    "imagen_trasera",
    "imagen_3",
    "imagen_4",
    "imagen_5",
    "imagen_6",
    "imagen_extra_1",
    "imagen_extra_2",
    "imagen_extra_3",
    "imagen_extra_4",
    "imagen_extra_5",
    "imagen_extra_6"
  ].forEach((key) => addImage(product[key]));

  [
    "imagenes_extra",
    "imagenes_adicionales",
    "galeria",
    "imagenes"
  ].forEach((key) => {
    splitGalleryImages(product[key]).forEach(addImage);
  });

  return images;
}

function splitGalleryImages(value = "") {
  return String(value || "")
    .split(/\s*(?:\r?\n|\||;)\s*/)
    .map((image) => image.trim())
    .filter(Boolean);
}

function getProductImageLabel(index) {
  if (index === 0) return "FRONT";
  if (index === 1) return "BACK";
  return `EXTRA ${String(index - 1).padStart(2, "0")}`;
}

function getStatus(rawStatus = "") {
  const status = normalize(rawStatus);

  if (status.includes("agot") || status.includes("sold")) {
    return { key: "soldout", label: "SOLD OUT", action: "FUERA DEL DROP" };
  }

  if (status.includes("reserv") || status.includes("hold")) {
    return { key: "hold", label: "ON HOLD", action: "BAJO RESERVA" };
  }

  return { key: "available", label: "AVAILABLE", action: "AGREGAR AL PEDIDO" };
}

function bindCartEvents() {
  [els.dropGrid, els.productGrid, els.similarGrid].filter(Boolean).forEach((grid) => {
    grid.addEventListener("click", (event) => {
      const button = event.target.closest(".add-to-cart");
      if (!button || button.disabled) return;

      const product = findProduct(button.dataset.productId);
      if (!product) return;

      const card = button.closest(".product-card");
      const selectedSize = card?.querySelector(".size-select")?.value || "Consultar";
      addToCart(product, selectedSize);

      const previousText = button.textContent;
      button.textContent = "AGREGADO";
      button.classList.add("added");
      setTimeout(() => {
        button.textContent = previousText;
        button.classList.remove("added");
      }, 950);
    });
  });

  els.productDetail?.addEventListener("click", (event) => {
    const thumb = event.target.closest(".detail-thumb");
    if (thumb) {
      const mainImage = els.productDetail.querySelector("#detailMainImage");
      const mainLabel = els.productDetail.querySelector("#detailMainLabel");
      const mainFigure = els.productDetail.querySelector(".detail-main-figure");
      const src = thumb.dataset.imageSrc || "";
      const label = thumb.dataset.imageLabel || "PIEZA";

      els.productDetail.querySelectorAll(".detail-thumb").forEach((item) => item.classList.remove("active"));
      thumb.classList.add("active");

      if (mainImage && src) {
        mainImage.src = src;
        mainImage.alt = thumb.dataset.imageAlt || "Pieza Valyr";
      }

      if (mainLabel) mainLabel.textContent = label;
      if (mainFigure) mainFigure.dataset.label = label;
      return;
    }

    const button = event.target.closest(".add-to-cart");
    if (!button || button.disabled) return;

    const product = findProduct(button.dataset.productId);
    if (!product) return;

    const selectedSize = els.productDetail.querySelector(".size-select")?.value || "Consultar";
    addToCart(product, selectedSize);
  });

  els.cartFloating?.addEventListener("click", openCart);
  els.cartOpenButtons?.forEach((button) => {
    button.addEventListener("click", () => {
      closeMobileMenu();
      openCart();
    });
  });
  els.cartClose?.addEventListener("click", closeCart);
  els.cartDrawer?.addEventListener("click", (event) => {
    if (event.target === els.cartDrawer) closeCart();
  });

  els.cartItems?.addEventListener("click", (event) => {
    const removeButton = event.target.closest(".cart-remove");
    const qtyButton = event.target.closest(".cart-qty-btn");

    if (removeButton) {
      removeFromCart(removeButton.dataset.cartKey);
      return;
    }

    if (qtyButton) {
      updateCartQuantity(qtyButton.dataset.cartKey, qtyButton.dataset.action);
    }
  });

  els.cartClear?.addEventListener("click", clearCartSession);

  els.cartWhatsapp?.addEventListener("click", () => {
    if (!cart.length) return;
    setTimeout(clearCartSession, 500);
  });
}

function bindMobileMenuEvents() {
  if (!els.mobileMenu || !els.mobileMenuBtn) return;

  els.mobileMenuBtn.addEventListener("click", () => {
    if (els.mobileMenu.classList.contains("open")) {
      closeMobileMenu();
    } else {
      openMobileMenu();
    }
  });

  els.mobileMenuCloseButtons?.forEach((button) => {
    button.addEventListener("click", closeMobileMenu);
  });

  els.mobileMenu.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", closeMobileMenu);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeMobileMenu();
    }
  });
}

function openMobileMenu() {
  if (!els.mobileMenu || !els.mobileMenuBtn) return;
  els.mobileMenu.classList.add("open");
  els.mobileMenu.setAttribute("aria-hidden", "false");
  els.mobileMenuBtn.setAttribute("aria-expanded", "true");
  document.body.classList.add("mobile-menu-open");
}

function closeMobileMenu() {
  if (!els.mobileMenu || !els.mobileMenuBtn) return;
  els.mobileMenu.classList.remove("open");
  els.mobileMenu.setAttribute("aria-hidden", "true");
  els.mobileMenuBtn.setAttribute("aria-expanded", "false");
  document.body.classList.remove("mobile-menu-open");
}

function bindProductNavigation() {
  [els.dropGrid, els.productGrid, els.similarGrid].filter(Boolean).forEach((grid) => {
    grid.addEventListener("click", (event) => {
      if (event.target.closest("button, a, input, select, label")) return;
      const card = event.target.closest(".product-card");
      if (!card?.dataset.productId) return;
      window.location.href = buildProductDetailUrl(card.dataset.productId);
    });

    grid.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      const card = event.target.closest(".product-card");
      if (!card?.dataset.productId) return;
      event.preventDefault();
      window.location.href = buildProductDetailUrl(card.dataset.productId);
    });
  });
}

function renderProductDetail() {
  if (PAGE_TYPE !== "detail" || !els.productDetail) return;

  const productId = getProductIdFromUrl();
  const product = productId ? findProduct(productId) : null;

  if (!product) {
    els.productDetail.innerHTML = `
      <div class="detail-not-found">
        <p class="eyebrow">PIEZA NO ENCONTRADA</p>
        <h1>Esta pieza ya no está dentro del vault.</h1>
        <p>Puede haber sido ocultada, reservada o movida a otro drop.</p>
        <a class="btn btn-primary" href="catalogo.html">VOLVER AL VAULT</a>
      </div>
    `;
    return;
  }

  document.title = `Valyr — ${product.nombre || product.id}`;
  const status = getStatus(product.estado);
  const isAvailable = status.key === "available";
  const sizeOptions = getSizeOptions(product.tallas);
  const productImages = getProductImages(product);
  const galleryImages = productImages.length ? productImages : [""];
  const mainSrc = galleryImages[0] || "";
  const mainLabel = getProductImageLabel(0);
  const mainAlt = `${product.nombre || "Pieza Valyr"} ${mainLabel}`;

  els.productDetail.innerHTML = `
    <div class="detail-commerce-layout">
      <div class="detail-thumbs" aria-label="Galería de imágenes de producto">
        ${galleryImages.map((src, index) => renderDetailThumb(src, product.nombre, getProductImageLabel(index), index === 0)).join("")}
      </div>

      <div class="detail-main-media">
        ${mainSrc ? `
          <figure class="detail-main-figure" data-label="${escapeAttr(mainLabel)}">
            <img id="detailMainImage" src="${escapeAttr(mainSrc)}" alt="${escapeAttr(mainAlt)}" loading="eager" decoding="async">
            <figcaption id="detailMainLabel">${escapeHTML(mainLabel)}</figcaption>
          </figure>
        ` : `
          <div class="detail-main-figure detail-main-placeholder" data-label="${escapeAttr(mainLabel)}">
            <span>VALYR</span>
            <small id="detailMainLabel">${escapeHTML(mainLabel)} / PRIVATE PIECE</small>
          </div>
        `}
      </div>

      <aside class="detail-buy-panel">
        <a class="detail-back" href="catalogo.html">← VOLVER AL VAULT</a>
        <div class="detail-kicker">
          <span class="status-pill ${status.key}">${status.label}</span>
          <span class="audience-pill">${escapeHTML(product.genero || "UNISEX")}</span>
        </div>
        <p class="eyebrow">${escapeHTML(product.drop || "PRIVATE VAULT")}</p>
        <h1>${escapeHTML(product.nombre || "Pieza Valyr")}</h1>
        <p class="detail-brand">${escapeHTML(product.marca || "VALYR")} / ${escapeHTML(product.categoria || "VALYR PIECES")}</p>
        <div class="detail-price">${escapeHTML(product.moneda || "$")}${escapeHTML(product.precio || "0")}</div>
        <p class="detail-desc">${escapeHTML(product.descripcion || "Pieza seleccionada por Valyr. Stock limitado. Reserva directa.")}</p>
        <div class="detail-size-block">
          ${renderSizeSelector(sizeOptions, isAvailable)}
        </div>
        <button class="btn btn-primary detail-reserve-btn add-to-cart ${isAvailable ? "" : "disabled"}" type="button" data-product-id="${escapeAttr(product.id)}" ${isAvailable ? "" : "disabled"}>${isAvailable ? "AGREGAR AL PEDIDO" : status.action}</button>
        <small class="detail-note">La disponibilidad final se confirma manualmente por WhatsApp.</small>
      </aside>
    </div>

    <div class="detail-value-row" aria-label="Información de reserva y entrega">
      <article>
        <span>01</span>
        <strong>Reserva privada</strong>
        <small>Selecciona talla y genera tu pedido por WhatsApp.</small>
      </article>
      <article>
        <span>02</span>
        <strong>Entrega coordinada</strong>
        <small>Maracaibo y Trujillo. Punto acordado y confirmación manual.</small>
      </article>
      <article>
        <span>03</span>
        <strong>Acceso manual</strong>
        <small>Valyr confirma disponibilidad antes del pago.</small>
      </article>
    </div>

    <div class="detail-attributes-row" aria-label="Atributos de la pieza">
      ${renderAttribute("Código", product.id)}
      ${renderAttribute("Género", product.genero || "UNISEX")}
      ${renderAttribute("Marca", product.marca || "VALYR")}
      ${renderAttribute("Categoría", product.categoria)}
      ${renderAttribute("Color", product.color || "Consultar")}
      ${renderAttribute("Tallas", product.tallas || "Consultar")}
      ${renderAttribute("Estado", product.estado || "Disponible")}
      ${renderAttribute("Imágenes", `${productImages.length || 0}`)}
    </div>
  `;

  renderSimilarProducts(product);
}

function renderDetailThumb(src, name, label, isActive = false) {
  const activeClass = isActive ? " active" : "";
  const safeLabel = escapeAttr(label);
  const safeName = escapeAttr(name || "Pieza Valyr");

  if (!src) {
    return `
      <button class="detail-thumb${activeClass}" type="button" data-image-src="" data-image-label="${safeLabel}" data-image-alt="${safeName} ${safeLabel}" aria-label="Ver imagen ${safeLabel}">
        <span>VALYR</span>
      </button>
    `;
  }

  return `
    <button class="detail-thumb${activeClass}" type="button" data-image-src="${escapeAttr(src)}" data-image-label="${safeLabel}" data-image-alt="${safeName} ${safeLabel}" aria-label="Ver imagen ${safeLabel}">
      <img src="${escapeAttr(src)}" alt="" loading="lazy">
    </button>
  `;
}


function renderDetailImage(src, name, label) {
  if (!src) {
    return `<div class="detail-image-placeholder"><span>VALYR</span><small>${escapeHTML(label)} / NO CROWD</small></div>`;
  }

  return `<figure class="detail-image" data-label="${escapeAttr(label)}"><img src="${escapeAttr(src)}" alt="${escapeAttr(name || "Pieza Valyr")} ${escapeAttr(label)}" loading="lazy"></figure>`;
}

function renderAttribute(label, value) {
  return `<div class="detail-attribute"><span>${escapeHTML(label)}</span><strong>${escapeHTML(value || "Consultar")}</strong></div>`;
}

function renderSimilarProducts(product) {
  if (!els.similarGrid) return;

  const similar = allProducts
    .filter((item) => item.id !== product.id)
    .map((item) => {
      let score = 0;
      if (item.categoria === product.categoria) score += 3;
      if (item.genero === product.genero) score += 2;
      if (normalize(item.marca) === normalize(product.marca)) score += 1;
      return { item, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ item }) => item)
    .slice(0, 4);

  const source = similar.length ? similar : allProducts.filter((item) => item.id !== product.id).slice(0, 4);
  els.similarGrid.innerHTML = source.map(createProductCard).join("");
}

function addToCart(product, selectedSize) {
  const key = getCartKey(product.id, selectedSize);
  const existing = cart.find((item) => item.key === key);

  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({
      key,
      id: product.id,
      nombre: product.nombre,
      marca: product.marca,
      precio: product.precio,
      moneda: product.moneda || "$",
      talla: selectedSize || "Consultar",
      color: product.color || "Consultar",
      genero: product.genero || "UNISEX",
      qty: 1
    });
  }

  saveCart();
  renderCart();
  openCart();
}

function removeFromCart(key) {
  cart = cart.filter((item) => item.key !== key);
  saveCart();
  renderCart();
}

function updateCartQuantity(key, action) {
  const item = cart.find((cartItem) => cartItem.key === key);
  if (!item) return;

  if (action === "increase") item.qty += 1;
  if (action === "decrease") item.qty -= 1;

  if (item.qty <= 0) {
    removeFromCart(key);
  } else {
    saveCart();
    renderCart();
  }
}

function renderCart() {
  if (!els.cartItems || !els.cartEmpty || !els.cartTotal || !els.cartWhatsapp) return;
  const itemCount = cart.reduce((total, item) => total + Number(item.qty || 1), 0);
  const total = cart.reduce((sum, item) => sum + parsePrice(item.precio) * Number(item.qty || 1), 0);
  const currency = cart[0]?.moneda || "$";

  if (els.cartCountFloating) els.cartCountFloating.textContent = itemCount;
  if (els.cartCountNav) els.cartCountNav.textContent = itemCount;
  if (els.cartCountMobile) els.cartCountMobile.textContent = itemCount;
  els.cartCountNodes?.forEach((node) => { node.textContent = itemCount; });
  els.cartFloating?.classList.toggle("has-items", itemCount > 0);
  els.cartEmpty.hidden = cart.length !== 0;
  els.cartItems.hidden = cart.length === 0;
  els.cartTotal.textContent = `${currency}${formatMoney(total)}`;

  els.cartItems.innerHTML = cart.map(createCartItem).join("");

  if (cart.length) {
    els.cartWhatsapp.href = buildCartWhatsappLink();
    els.cartWhatsapp.classList.remove("disabled");
  } else {
    els.cartWhatsapp.href = "#";
    els.cartWhatsapp.classList.add("disabled");
  }
}

function createCartItem(item) {
  const qty = Number(item.qty || 1);
  const itemTotal = parsePrice(item.precio) * qty;

  return `
    <article class="cart-item">
      <div class="cart-item-main">
        <span class="cart-code">${escapeHTML(item.id)}</span>
        <strong>${escapeHTML(item.nombre)}</strong>
        <small>${escapeHTML(item.marca)} · Talla ${escapeHTML(item.talla)} · ${escapeHTML(item.moneda)}${escapeHTML(item.precio)}</small>
      </div>
      <div class="cart-item-side">
        <div class="cart-qty">
          <button class="cart-qty-btn" type="button" data-action="decrease" data-cart-key="${escapeAttr(item.key)}">−</button>
          <span>${qty}</span>
          <button class="cart-qty-btn" type="button" data-action="increase" data-cart-key="${escapeAttr(item.key)}">+</button>
        </div>
        <span class="cart-line-total">${escapeHTML(item.moneda)}${formatMoney(itemTotal)}</span>
        <button class="cart-remove" type="button" data-cart-key="${escapeAttr(item.key)}">Quitar</button>
      </div>
    </article>
  `;
}

function filterProducts(products) {
  return products.filter((product) => {
    const matchesCategory = currentCategory === "ALL" || String(product.categoria || "").trim().toUpperCase() === currentCategory;
    const matchesGender = currentGender === "ALL" || normalizeGender(product.genero || "UNISEX") === currentGender;
    return matchesCategory && matchesGender;
  });
}

function updateCatalogUrlState() {
  if (PAGE_TYPE !== "catalog") return;
  const params = new URLSearchParams(window.location.search);

  if (currentCategory && currentCategory !== "ALL") params.set("categoria", currentCategory);
  else params.delete("categoria");

  if (currentGender && currentGender !== "ALL") params.set("genero", currentGender);
  else params.delete("genero");

  const query = params.toString();
  const nextUrl = query ? `${window.location.pathname}?${query}` : window.location.pathname;
  window.history.replaceState({}, "", nextUrl);
}

function buildProductDetailUrl(productId) {
  return `producto.html?id=${encodeURIComponent(productId)}`;
}

function getProductIdFromUrl() {
  return new URLSearchParams(window.location.search).get("id");
}

function getInitialParam(name, fallback) {
  const value = new URLSearchParams(window.location.search).get(name);
  return value ? String(value).trim().toUpperCase() : fallback;
}

function normalizeGender(value = "UNISEX") {
  const gender = normalize(value);

  if (gender.includes("muj") || gender.includes("woman") || gender.includes("female")) return "MUJER";
  if (gender.includes("hom") || gender.includes("man") || gender.includes("male")) return "HOMBRE";
  if (gender.includes("uni")) return "UNISEX";
  return "UNISEX";
}

function buildCartWhatsappLink() {
  const oneItem = cart.length === 1 && Number(cart[0].qty || 1) === 1;
  const intro = oneItem
    ? "Hola Valyr. Quiero reservar esta pieza:"
    : "Hola Valyr. Quiero reservar estas piezas:";

  const body = cart.map((item, index) => {
    const number = oneItem ? "" : `${index + 1}. `;
    const quantityLine = Number(item.qty || 1) > 1 ? `\nCantidad: ${item.qty}` : "";

    return `${number}Código: ${item.id || "Sin código"}\nPrenda: ${item.nombre || "Pieza Valyr"}\nMarca: ${item.marca || "Valyr"}\nGénero: ${item.genero || "UNISEX"}\nPrecio: ${(item.moneda || "$") + (item.precio || "0")}\nTalla: ${item.talla || "Consultar"}${quantityLine}`;
  }).join("\n\n");

  const text = `${intro}\n\n${body}\n\nQuedo atento para confirmar disponibilidad.`;
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
}

function buildGeneralWhatsappLink() {
  const text = "Valyr, quiero entrar al catálogo y consultar disponibilidad.";
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
}

function bindNewsletterEvents() {
  if (!els.newsletterForm || !els.newsletterEmail || !els.newsletterStatus) return;

  els.newsletterForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const email = String(els.newsletterEmail.value || "").trim();

    if (!email || !els.newsletterEmail.checkValidity()) {
      els.newsletterStatus.textContent = "Coloca un correo válido para entrar a la drop list.";
      return;
    }

    try {
      localStorage.setItem("valyr_drop_list_email", email);
    } catch (error) {
      console.warn("No se pudo guardar el correo localmente:", error);
    }

    const text = `Hola Valyr. Quiero unirme a la drop list. Correo: ${email}`;
    els.newsletterStatus.textContent = "Solicitud lista. Se abrirá WhatsApp para confirmar tu acceso.";
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`, "_blank", "noopener");
  });
}

function openCart() {
  if (!els.cartDrawer) return;
  els.cartDrawer.classList.add("open");
  els.cartDrawer.setAttribute("aria-hidden", "false");
  document.body.classList.add("cart-open");
}

function closeCart() {
  if (!els.cartDrawer) return;
  els.cartDrawer.classList.remove("open");
  els.cartDrawer.setAttribute("aria-hidden", "true");
  document.body.classList.remove("cart-open");
}

function findProduct(id) {
  return allProducts.find((product) => product.id === id);
}

function getCartKey(productId, size) {
  return `${productId}__${normalize(size || "consultar")}`;
}

function getSizeOptions(rawSizes = "") {
  return String(rawSizes)
    .split(/[/,|]/)
    .map((size) => size.trim())
    .filter(Boolean);
}

function loadCart() {
  try {
    const raw = sessionStorage.getItem(CART_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    console.warn("No se pudo leer el pedido de esta sesión:", error);
    return [];
  }
}

function saveCart() {
  try {
    if (!cart.length) {
      sessionStorage.removeItem(CART_STORAGE_KEY);
      return;
    }

    sessionStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  } catch (error) {
    console.warn("No se pudo guardar el pedido de esta sesión:", error);
  }
}

function clearCartSession() {
  cart = [];
  saveCart();
  renderCart();
}

function parsePrice(value = "0") {
  const clean = String(value).replace(/[^0-9.,]/g, "").replace(",", ".");
  return Number.parseFloat(clean) || 0;
}

function formatMoney(value) {
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(2);
}

function normalize(value = "") {
  return String(value)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function escapeHTML(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value = "") {
  return escapeHTML(value).replaceAll("`", "&#096;");
}

function parseCSV(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let insideQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && insideQuotes && next === '"') {
      cell += '"';
      i += 1;
    } else if (char === '"') {
      insideQuotes = !insideQuotes;
    } else if (char === "," && !insideQuotes) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !insideQuotes) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }

  const headers = rows.shift()?.map((header) => header.trim()) || [];

  return rows
    .filter((r) => r.some((value) => String(value).trim() !== ""))
    .map((r) => Object.fromEntries(headers.map((header, index) => [header, r[index] || ""])));
}
