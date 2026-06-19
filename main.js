/* ====================================================
   متجر خطوة — السلوك التفاعلي للصفحة الرئيسية
   البيانات تُقرأ الآن من products.json بدل ملف JS ثابت،
   لأن صفحة الأدمن تحتاج تعدّل JSON مباشرة عبر GitHub API.
   ==================================================== */

const WHATSAPP_NUMBER = "9647857392727";
const DATA_URL = "products.json";

let PRODUCTS = [];
let CATEGORIES = ["الكل"];

/* ---------- أيقونات SVG بسيطة بديلة للصور (placeholders) ----------
   ملاحظة: هذه أيقونات مؤقتة فقط. عند توفر صور حقيقية للمنتجات
   من لوحة التحكم، تُستبدل بـ <img> داخل دالة productMedia() أدناه. */
const SHOE_ICONS = {
  sneaker: `<svg viewBox="0 0 200 120" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M14 78c0-10 8-16 20-18l36-7c8-9 20-15 32-15 6 0 10 4 14 9 10 2 22 6 34 13 9 5 18 7 26 7 6 0 10 4 10 10v9c0 7-6 13-13 13H27c-9 0-15-6-15-12l2-9Z" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/>
    <path d="M14 78c10 6 24 9 40 9h106" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
    <path d="M70 38c4 8 12 14 22 17" stroke="currentColor" stroke-width="3" stroke-linecap="round" class="accent" stroke-dasharray="3 5"/>
  </svg>`,
  sandal: `<svg viewBox="0 0 200 120" fill="none" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="100" cy="92" rx="86" ry="16" stroke="currentColor" stroke-width="4"/>
    <path d="M40 92c0-26 8-58 18-58 6 0 9 10 12 22 4-14 10-26 18-26s13 14 16 30c4-18 10-28 18-28 9 0 16 30 18 60" stroke="currentColor" stroke-width="4" stroke-linecap="round" class="accent"/>
  </svg>`,
  classic: `<svg viewBox="0 0 200 120" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M20 86c0-4 3-7 8-9l40-15c10-12 26-22 44-22 16 0 18 10 20 18 14 3 30 9 42 19 6 5 14 7 12 13-2 7-10 9-20 9H34c-9 0-14-6-14-13Z" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/>
    <path d="M62 62c10-4 22-5 32-2" stroke="currentColor" stroke-width="3" stroke-linecap="round" class="accent" stroke-dasharray="2 5"/>
  </svg>`,
  running: `<svg viewBox="0 0 200 120" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M16 80c2-9 10-13 22-14l30-3c10-10 24-18 36-18 7 0 9 6 11 12 12 1 26 5 38 14 7 5 16 6 22 6 5 0 8 4 7 9l-2 8c-1 6-7 10-13 10H32c-10 0-17-7-16-15Z" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/>
    <path d="M30 80h140" stroke="currentColor" stroke-width="4" stroke-linecap="round" class="accent"/>
  </svg>`
};

const STATUS_TEXT = {
  available: "متوفر",
  limited: "كمية محدودة",
  out: "نفذ من المخزون"
};

const BADGE_TEXT = {
  new: "جديد",
  bestseller: "الأكثر مبيعاً",
  offer: "خصم"
};

function formatPrice(n){
  return n.toLocaleString("ar-IQ") + " د.ع";
}

function stampClassFor(badge){
  if (badge === "new") return "stamp gold";
  if (badge === "bestseller") return "stamp charcoal";
  if (badge === "offer") return "stamp";
  return "";
}

function productMedia(p){
  if (p.image) {
    return `<img src="${p.image}" alt="${p.name}" loading="lazy">`;
  }
  return SHOE_ICONS[p.icon] || SHOE_ICONS.sneaker;
}

function productCardHTML(p){
  const isOut = p.status === "out";
  const badgeStamp = p.badge
    ? `<div class="${stampClassFor(p.badge)} stamp-sm">
         <b>${p.badge === "offer" ? "خصم %" + p.discount : BADGE_TEXT[p.badge]}</b>
       </div>`
    : "";
  const oldPriceHTML = p.oldPrice ? `<span class="price-old">${formatPrice(p.oldPrice)}</span>` : "";
  const sizesHTML = p.sizes.slice(0,6).map(s => `<span>${s}</span>`).join("");

  return `
  <article class="product-card reveal ${isOut ? "is-out" : ""}" data-id="${p.id}" data-category="${p.category}">
    <div class="product-media">
      ${productMedia(p)}
      ${badgeStamp}
      <button class="quick-view" data-quickview="${p.id}">عرض سريع</button>
    </div>
    <div class="product-info">
      <div class="product-cat">${p.category}</div>
      <h3 class="product-name">${p.name}</h3>
      <div class="product-sizes">${sizesHTML}</div>
      <div class="price-row">
        <div class="price-group">
          <span class="price">${formatPrice(p.price)}</span>
          ${oldPriceHTML}
        </div>
        <button class="add-cart-btn" data-add="${p.id}" aria-label="أضف إلى السلة" ${isOut ? "disabled" : ""}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3h2l2.6 13.4a2 2 0 0 0 2 1.6h8.8a2 2 0 0 0 2-1.6L22 7H6"/><circle cx="9" cy="21" r="1.4" fill="currentColor"/><circle cx="18" cy="21" r="1.4" fill="currentColor"/></svg>
        </button>
      </div>
      <div class="stock-note ${p.status}">${dotSVG()} ${STATUS_TEXT[p.status]}</div>
    </div>
  </article>`;
}

function dotSVG(){
  return `<svg width="8" height="8" viewBox="0 0 8 8"><circle cx="4" cy="4" r="4" fill="currentColor"/></svg>`;
}

function renderGrid(targetId, items){
  const el = document.getElementById(targetId);
  if (!el) return;
  el.innerHTML = items.map(productCardHTML).join("");
}

function renderChips(){
  const wrap = document.getElementById("catChips");
  if (!wrap) return;
  wrap.innerHTML = CATEGORIES.map((c,i) =>
    `<button class="chip ${i===0 ? "active" : ""}" data-cat="${c}">${c}</button>`
  ).join("");

  wrap.addEventListener("click", (e) => {
    const btn = e.target.closest(".chip");
    if (!btn) return;
    wrap.querySelectorAll(".chip").forEach(c => c.classList.remove("active"));
    btn.classList.add("active");
    const cat = btn.dataset.cat;
    const filtered = cat === "الكل" ? PRODUCTS : PRODUCTS.filter(p => p.category === cat);
    renderGrid("bestSellersGrid", filtered);
    observeReveals();
  });
}

/* ---------- السلة (عداد فقط في هذه المرحلة) ---------- */
function getCart(){
  try { return JSON.parse(localStorage.getItem("khatwa_cart")) || []; }
  catch(e){ return []; }
}
function saveCart(cart){ localStorage.setItem("khatwa_cart", JSON.stringify(cart)); }
function updateCartBadge(){
  const cart = getCart();
  const count = cart.reduce((s,i) => s + i.qty, 0);
  const badge = document.getElementById("cartCount");
  if (badge) badge.textContent = count;
}

function handleAddToCart(e){
  const btn = e.target.closest("[data-add]");
  if (!btn) return;
  const id = btn.dataset.add;
  const product = PRODUCTS.find(p => p.id === id);
  if (!product) return;

  const cart = getCart();
  const existing = cart.find(i => i.id === id);
  if (existing) existing.qty += 1;
  else cart.push({ id, qty: 1, size: product.sizes[0] });
  saveCart(cart);
  updateCartBadge();

  btn.classList.add("added");
  btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12l5 5L20 7"/></svg>`;
  setTimeout(() => {
    btn.classList.remove("added");
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3h2l2.6 13.4a2 2 0 0 0 2 1.6h8.8a2 2 0 0 0 2-1.6L22 7H6"/><circle cx="9" cy="21" r="1.4" fill="currentColor"/><circle cx="18" cy="21" r="1.4" fill="currentColor"/></svg>`;
  }, 1300);
}

/* ---------- القائمة على الموبايل ---------- */
function setupMobileNav(){
  const burger = document.getElementById("burgerBtn");
  const nav = document.getElementById("mainNav");
  if (!burger || !nav) return;
  burger.addEventListener("click", () => {
    nav.classList.toggle("open");
  });
  nav.querySelectorAll("a").forEach(a => a.addEventListener("click", () => nav.classList.remove("open")));
}

/* ---------- هيدر يتقلص عند التمرير ---------- */
function setupStickyHeader(){
  const header = document.getElementById("siteHeader");
  if (!header) return;
  window.addEventListener("scroll", () => {
    header.classList.toggle("scrolled", window.scrollY > 12);
  }, { passive:true });
}

/* ---------- كشف الأقسام عند التمرير ---------- */
function observeReveals(){
  const items = document.querySelectorAll(".reveal:not(.in)");
  const obs = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting){
        entry.target.classList.add("in");
        obs.unobserve(entry.target);
      }
    });
  }, { threshold:0.15 });
  items.forEach(it => obs.observe(it));
}

/* ---------- زر واتساب: رسالة استفسار عامة ---------- */
function setupWhatsappLinks(){
  document.querySelectorAll("[data-wa-general]").forEach(el => {
    const msg = encodeURIComponent("السلام عليكم، أحتاج مساعدة بخصوص منتجات متجر خطوة 👟");
    el.href = `https://wa.me/${WHATSAPP_NUMBER}?text=${msg}`;
  });
}

/* ---------- البحث الفوري ضمن الصفحة ---------- */
function setupSearch(){
  const input = document.getElementById("searchInput");
  if (!input) return;
  input.addEventListener("input", () => {
    const q = input.value.trim().toLowerCase();
    const filtered = q
      ? PRODUCTS.filter(p => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q))
      : PRODUCTS;
    renderGrid("bestSellersGrid", filtered);
    observeReveals();
  });
}

async function loadProducts(){
  try{
    const res = await fetch(`${DATA_URL}?t=${Date.now()}`);
    const data = await res.json();
    PRODUCTS = data.products || [];
    CATEGORIES = data.categories || ["الكل"];
  }catch(e){
    console.error("تعذّر تحميل المنتجات:", e);
    PRODUCTS = [];
  }
}

async function init(){
  await loadProducts();
  renderChips();
  renderGrid("bestSellersGrid", PRODUCTS);
  renderGrid("newArrivalsGrid", PRODUCTS.filter(p => p.badge === "new"));
  renderGrid("offersGrid", PRODUCTS.filter(p => p.discount > 0));

  document.body.addEventListener("click", handleAddToCart);
  setupMobileNav();
  setupStickyHeader();
  setupWhatsappLinks();
  setupSearch();
  updateCartBadge();
  observeReveals();
}

document.addEventListener("DOMContentLoaded", init);
