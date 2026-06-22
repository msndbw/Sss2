/* ====================================================
   متجر خطوة — main.js v2
   سلة مشتريات كاملة، صفحة منتج، فاتورة واتساب
   ==================================================== */

const WHATSAPP_NUMBER = "9647857392727";
const MESSENGER_LINK_DEFAULT = "https://m.me/61590750916432";
const DATA_URL = "products.json";

/* أجور التوصيل: 1000 د.ع لقضاء البدير في محافظة القادسية، و5000 د.ع لبقية مناطق العراق */
const DELIVERY_FEE_SPECIAL = 1000;
const DELIVERY_FEE_DEFAULT = 5000;
const DELIVERY_SPECIAL_PROVINCE = "القادسية";
const DELIVERY_SPECIAL_DISTRICT = "البدير";

function calcDeliveryFee(province, district){
  if (province === DELIVERY_SPECIAL_PROVINCE && district === DELIVERY_SPECIAL_DISTRICT){
    return DELIVERY_FEE_SPECIAL;
  }
  return DELIVERY_FEE_DEFAULT;
}

let PRODUCTS = [];
let CATEGORIES = ["الكل"];
let CONTACT = { whatsapp: WHATSAPP_NUMBER, phone:"", messenger:"", facebook:"", instagram:"", tiktok:"", telegram:"", links: [] };
let currentGalleryIdx = 0;
let currentProductId = null;
let selectedSize = null;
let selectedColor = null;
let selectedQty = 1;
let LAST_ORDER_FIELDS = null; /* نسخة محفوظة من بيانات العميل تبقى متاحة حتى بعد تحويل نافذة الطلب إلى عرض الفاتورة */
let CURRENT_INVOICE_NO = null; /* رقم الفاتورة الحالي المرتبط بآخر طلب تم بناؤه */
let ORDER_ALREADY_SAVED = false; /* يمنع حفظ نفس الطلب أكثر من مرة بقاعدة البيانات لو ضغط الزبون الإرسال مرتين */

/* ================================================
   رقم الفاتورة الفريد
   صيغة: KH-YYMMDD-XXXX (XXXX = عدّاد تسلسلي يومي مخزّن محلياً
   لضمان عدم التكرار حتى لو فُتح الموقع أكثر من مرة بنفس اليوم)
   ================================================ */
function generateInvoiceNo(){
  const now = new Date();
  const ymd = now.getFullYear().toString().slice(-2) +
    String(now.getMonth()+1).padStart(2,"0") +
    String(now.getDate()).padStart(2,"0");
  const counterKey = "khatwa_invoice_counter_" + ymd;
  let n = parseInt(localStorage.getItem(counterKey) || "0", 10) + 1;
  localStorage.setItem(counterKey, String(n));
  return `KH-${ymd}-${String(n).padStart(4,"0")}`;
}

function waNumber(){ return CONTACT.whatsapp || WHATSAPP_NUMBER; }
function messengerLink(){ return CONTACT.messenger || MESSENGER_LINK_DEFAULT; }

/* ---------- رسوم تعبيرية للأحذية ---------- */
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

const STATUS_TEXT = { available:"متوفر", limited:"كمية محدودة", out:"نفذ من المخزون" };
const BADGE_TEXT = { new:"جديد", bestseller:"الأكثر مبيعاً", offer:"خصم" };

const IRAQ_PROVINCES = [
  "بغداد","البصرة","نينوى","أربيل","السليمانية","كركوك","ذي قار","المثنى",
  "القادسية","بابل","واسط","النجف","كربلاء","الأنبار","ديالى","صلاح الدين",
  "دهوك","ميسان","حلبجة"
];

/* أقضية كل محافظة عراقية (المصدر: الجهاز المركزي للإحصاء العراقي) */
const IRAQ_DISTRICTS = {
  "بغداد": ["الرصافة","الكرخ","الأعظمية","الكاظمية","الصدر الأولى","الصدر الثانية","المدائن","المحمودية","أبو غريب","الطارمية","الراشدية","الزهور","الطاجي","الزوراء"],
  "البصرة": ["البصرة","أبو الخصيب","الزبير","القرنة","المدينة","الفاو","الهارثة","شط العرب","سفوان","الدير","الصادق"],
  "نينوى": ["الموصل","تلعفر","تلكيف","الحمدانية","سنجار","الشيخان","البعاج","الحضر","مخمور"],
  "أربيل": ["أربيل","عنكاوة","كويسنجق","شقلاوة","سوران","مخمور","جومان","خبات","رواندوز","قوشتبة","خليفان","بيرمام","ميركةسور","سيدكان"],
  "السليمانية": ["السليمانية","حلبجة","رانية","كلار","دوكان","جمجمال","پشدر","پنجوين","دربندخان","شارباژير","شاره زور","ماوت","بازيان","قرةداغ","سيد صادق","كفري","خانقين","حاجياوة"],
  "كركوك": ["كركوك","الحويجة","الدبس","داقوق"],
  "ذي قار": ["الناصرية","الشطرة","سوق الشيوخ","الرفاعي","الجبايش","قلعة سكر","الفجر","البطحاء","الإصلاح","الغراف","الدواية","النصر","كرمة بني سعيد","سيد دخيل"],
  "المثنى": ["السماوة","الرميثة","الخضر","الوركاء","الهلال","المجد","النجمي","السلمان","السوير"],
  "القادسية": ["الديوانية","عفك","الدغارة","البدير","الحمزة","الشامية","غماس","الشنافية","الشافعية","المهناوية","السنية","السدير","سومر"],
  "بابل": ["الحلة","المسيب","المحاويل","الهاشمية","القاسم","الكفل","كوثى"],
  "واسط": ["الكوت","الحي","النعمانية","الصويرة","العزيزية","بدرة","الأحرار","الزبيدية","الموفقية"],
  "النجف": ["النجف","الكوفة","المناذرة","المشخاب"],
  "كربلاء": ["كربلاء","الهندية","عين التمر","الحر","الحسينية","الجدول الغربي"],
  "الأنبار": ["الرمادي","الفلوجة","هيت","حديثة","عنه","القائم","الرطبة","الكرمة","الحبانية","العامرية","عكاشات"],
  "ديالى": ["بعقوبة","المقدادية","الخالص","خانقين","بلدروز","مندلي","كفري","المنصورية"],
  "صلاح الدين": ["تكريت","سامراء","بيجي","بلد","الدجيل","الضلوعية","الشرقاط","الدور","طوزخورماتو","العلم","آمرلي"],
  "دهوك": ["دهوك","زاخو","سميل","العمادية","عقرة","الشيخان","بردرش","باتيفا"],
  "ميسان": ["العمارة","الكحلاء","المجر الكبير","قلعة صالح","الميمونة","علي الغربي","الكميت"],
  "حلبجة": ["حلبجة","خورمال","سيروان","بياره","بمو"]
};

/* ================================================
   أدوات مساعدة
   ================================================ */
function formatPrice(n){ return Number(n).toLocaleString("ar-IQ") + " د.ع"; }

function stampClassFor(badge){
  if (badge === "new") return "stamp gold";
  if (badge === "bestseller") return "stamp charcoal";
  if (badge === "offer") return "stamp";
  return "";
}

function productMedia(p, large=false){
  const images = getImages(p);
  if (images.length) return `<img src="${images[0]}" alt="${p.name}" loading="lazy">`;
  const icon = SHOE_ICONS[p.icon] || SHOE_ICONS.sneaker;
  return icon;
}

function getImages(p){
  if (p.images && p.images.length) return p.images;
  if (p.image) return [p.image];
  return [];
}

function dotSVG(){ return `<svg width="8" height="8" viewBox="0 0 8 8"><circle cx="4" cy="4" r="4" fill="currentColor"/></svg>`; }

/* تحميل صورة منتج على الجهاز — يجلب الصورة كـ blob لضمان نزولها كملف
   بدل فتحها بتبويب جديد (يعمل مع الروابط النسبية وروابط GitHub Pages) */
async function downloadImage(url, filename){
  if (!url) return;
  try{
    const res = await fetch(url);
    if (!res.ok) throw new Error("fetch failed");
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = filename || "صورة-المنتج.jpg";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(()=>URL.revokeObjectURL(blobUrl), 4000);
  }catch(err){
    // بديل: فتح الصورة بتبويب جديد إن تعذّر التحميل المباشر (مثلاً بسبب CORS)
    window.open(url, "_blank");
  }
}

/* ================================================
   بطاقة المنتج
   ================================================ */
function productCardHTML(p){
  const isOut = p.status === "out";
  const badgeStamp = p.badge
    ? `<div class="${stampClassFor(p.badge)} stamp-sm"><b>${p.badge === "offer" ? "خصم %" + p.discount : BADGE_TEXT[p.badge]}</b></div>`
    : "";
  const oldPriceHTML = p.oldPrice ? `<span class="price-old">${formatPrice(p.oldPrice)}</span>` : "";
  const sizesHTML = p.sizes.slice(0,5).map(s=>`<span>${s}</span>`).join("") + (p.sizes.length>5?`<span>+${p.sizes.length-5}</span>`:"");

  return `
  <article class="product-card reveal ${isOut?"is-out":""}" data-id="${p.id}" data-category="${p.category}">
    <div class="product-media" data-quickview="${p.id}">
      ${productMedia(p)}
      ${badgeStamp}
      <button class="quick-view" data-quickview="${p.id}">عرض المنتج</button>
    </div>
    <div class="product-info">
      <div class="product-cat">${p.category}</div>
      <h3 class="product-name" data-quickview="${p.id}">${p.name}</h3>
      <div class="product-sizes">${sizesHTML}</div>
      <div class="price-row">
        <div class="price-group">
          <span class="price">${formatPrice(p.price)}</span>
          ${oldPriceHTML}
        </div>
        <button class="add-cart-btn" data-add="${p.id}" aria-label="أضف إلى السلة" ${isOut?"disabled":""}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3h2l2.6 13.4a2 2 0 0 0 2 1.6h8.8a2 2 0 0 0 2-1.6L22 7H6"/><circle cx="9" cy="21" r="1.4" fill="currentColor"/><circle cx="18" cy="21" r="1.4" fill="currentColor"/></svg>
        </button>
      </div>
      <div class="stock-note ${p.status}">${dotSVG()} ${STATUS_TEXT[p.status]}</div>
    </div>
  </article>`;
}

function renderGrid(targetId, items){
  const el = document.getElementById(targetId);
  if (!el) return;
  if (!items.length){
    el.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--ink-soft);font-family:var(--font-display);font-weight:700;">لا توجد منتجات تطابق الفلتر</div>`;
    return;
  }
  el.innerHTML = items.map(productCardHTML).join("");
}

/* ================================================
   شرائح الفئات
   ================================================ */
function renderChips(){
  const wrap = document.getElementById("catChips");
  if (!wrap) return;
  wrap.innerHTML = CATEGORIES.map((c,i) =>
    `<button class="chip ${i===0?"active":""}" data-cat="${c}">${c}</button>`
  ).join("");

  wrap.addEventListener("click", (e) => {
    const btn = e.target.closest(".chip");
    if (!btn) return;
    wrap.querySelectorAll(".chip").forEach(c=>c.classList.remove("active"));
    btn.classList.add("active");
    applyFilters();
  });
}

function getCurrentCategory(){
  const active = document.querySelector(".chip.active");
  return active ? active.dataset.cat : "الكل";
}

function applyFilters(){
  const cat = getCurrentCategory();
  const sort = document.getElementById("sortSelect")?.value || "";
  const sizeVal = document.getElementById("sizeFilter")?.value || "";
  const searchQ = document.getElementById("searchInput")?.value.trim().toLowerCase() || "";

  let list = cat === "الكل" ? [...PRODUCTS] : PRODUCTS.filter(p=>p.category===cat);
  if (sizeVal) list = list.filter(p=>p.sizes.map(String).includes(sizeVal));
  if (searchQ) list = list.filter(p=>
    p.name.toLowerCase().includes(searchQ) ||
    p.category.toLowerCase().includes(searchQ) ||
    (p.code||"").toLowerCase().includes(searchQ) ||
    (p.id||"").toLowerCase().includes(searchQ)
  );

  if (sort === "price-asc") list.sort((a,b)=>a.price-b.price);
  else if (sort === "price-desc") list.sort((a,b)=>b.price-a.price);
  else if (sort === "new") list = list.filter(p=>p.badge==="new").concat(list.filter(p=>p.badge!=="new"));
  else if (sort === "bestseller") list = list.filter(p=>p.badge==="bestseller").concat(list.filter(p=>p.badge!=="bestseller"));

  renderGrid("bestSellersGrid", list);
  observeReveals();
}

function populateSizeFilter(){
  const sel = document.getElementById("sizeFilter");
  if (!sel) return;
  const allSizes = [...new Set(PRODUCTS.flatMap(p=>p.sizes))].sort((a,b)=>a-b);
  sel.innerHTML = `<option value="">جميع المقاسات</option>` +
    allSizes.map(s=>`<option value="${s}">${s}</option>`).join("");
}

/* ================================================
   السلة — Cart
   ================================================ */
function getCart(){ try{ return JSON.parse(localStorage.getItem("khatwa_cart"))||[]; }catch(e){ return []; } }
function saveCart(cart){ localStorage.setItem("khatwa_cart", JSON.stringify(cart)); }

function updateCartBadge(){
  const cart = getCart();
  const count = cart.reduce((s,i)=>s + i.qty, 0);
  const badge = document.getElementById("cartCount");
  if (!badge) return;
  badge.textContent = count;
  badge.classList.add("bump");
  setTimeout(()=>badge.classList.remove("bump"), 300);
}

function openCart(){
  document.getElementById("cartOverlay").classList.add("open");
  document.getElementById("cartDrawer").classList.add("open");
  document.body.style.overflow = "hidden";
  renderCartDrawer();
}
function closeCart(){
  document.getElementById("cartOverlay").classList.remove("open");
  document.getElementById("cartDrawer").classList.remove("open");
  document.body.style.overflow = "";
}

function getShoeIcon(p){
  return SHOE_ICONS[p?.icon] || SHOE_ICONS.sneaker;
}

function renderCartDrawer(){
  const cart = getCart();
  const itemsEl = document.getElementById("cartItems");
  const footerEl = document.getElementById("cartFooter");

  if (!cart.length){
    itemsEl.innerHTML = `
      <div class="cart-empty">
        <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M3 3h2l2.6 13.4a2 2 0 0 0 2 1.6h8.8a2 2 0 0 0 2-1.6L22 7H6"/>
          <circle cx="9" cy="21" r="1.4"/><circle cx="18" cy="21" r="1.4"/>
        </svg>
        <span>السلة فارغة</span>
        <button class="btn btn-primary btn-sm" onclick="closeCart()">تصفّح المنتجات</button>
      </div>`;
    footerEl.style.display = "none";
    return;
  }

  let total = 0;
  const html = cart.map(item => {
    const p = PRODUCTS.find(x=>x.id===item.id);
    if (!p) return "";
    const images = getImages(p);
    const thumb = images.length
      ? `<img src="${images[0]}" alt="${p.name}">`
      : getShoeIcon(p);

    const itemTotal = p.price * item.qty;
    total += itemTotal;

    // إذا كان الكمية أكثر من 1، نعرض خيارات لكل قطعة
    let piecesHTML = "";
    if (item.qty > 1){
      const pieces = item.pieces || Array.from({length:item.qty},(_,i)=>({
        size: item.size || (p.sizes[0]||""),
        color: item.color || (p.colors?.[0] || "")
      }));
      piecesHTML = `<div class="cart-pieces">` +
        pieces.map((pc,pi)=>`
          <div class="piece-row">
            <span class="piece-label">قطعة ${pi+1}</span>
            ${p.sizes.length > 0 ? `<select class="piece-select" data-piece="${pi}" data-field="size" data-id="${item.id}" onchange="updatePiece('${item.id}',${pi},'size',this.value)">
              ${p.sizes.map(s=>`<option value="${s}" ${String(pc.size)===String(s)?"selected":""}>${s}</option>`).join("")}
            </select>` : ""}
            ${p.colors?.length ? `<select class="piece-select" data-piece="${pi}" data-field="color" data-id="${item.id}" onchange="updatePiece('${item.id}',${pi},'color',this.value)">
              ${p.colors.map(c=>`<option value="${c}" ${pc.color===c?"selected":""}>${c}</option>`).join("")}
            </select>` : ""}
          </div>`).join("") +
        `</div>`;
    } else {
      // قطعة واحدة
      piecesHTML = `<div class="cart-item-meta">
        ${p.sizes.length ? `<select class="variant-select" data-id="${item.id}" data-field="size" onchange="updateCartVariant('${item.id}','size',this.value)">
          ${p.sizes.map(s=>`<option value="${s}" ${String(item.size)===String(s)?"selected":""}>${s}</option>`).join("")}
        </select>` : ""}
        ${p.colors?.length ? `<select class="variant-select" data-id="${item.id}" data-field="color" onchange="updateCartVariant('${item.id}','color',this.value)">
          ${p.colors.map(c=>`<option value="${c}" ${item.color===c?"selected":""}>${c}</option>`).join("")}
        </select>` : ""}
      </div>`;
    }

    return `
      <div class="cart-item" data-cart-id="${item.id}">
        <div class="cart-item-thumb">${thumb}</div>
        <div class="cart-item-body">
          <div class="cart-item-name">${p.name}</div>
          <span class="cart-item-code">${p.code || p.id}</span>
          ${piecesHTML}
          <div class="cart-item-controls">
            <button class="qty-btn" onclick="changeQty('${item.id}',-1)">−</button>
            <span class="qty-val">${item.qty}</span>
            <button class="qty-btn" onclick="changeQty('${item.id}',1)">+</button>
            <span class="cart-item-price">${formatPrice(itemTotal)}</span>
          </div>
        </div>
        <button class="cart-item-del" onclick="removeFromCart('${item.id}')" aria-label="حذف">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
      </div>`;
  }).join("");

  itemsEl.innerHTML = html;
  document.getElementById("cartTotal").textContent = formatPrice(total);
  footerEl.style.display = "block";
}

function changeQty(id, delta){
  const cart = getCart();
  const item = cart.find(i=>i.id===id);
  if (!item) return;
  item.qty = Math.max(1, item.qty + delta);
  // تعديل pieces عند زيادة/نقص الكمية
  if (!item.pieces) item.pieces = [{size:item.size||"",color:item.color||""}];
  const p = PRODUCTS.find(x=>x.id===id);
  while (item.pieces.length < item.qty) item.pieces.push({size:p?.sizes[0]||"",color:p?.colors?.[0]||""});
  item.pieces = item.pieces.slice(0, item.qty);
  saveCart(cart);
  updateCartBadge();
  renderCartDrawer();
}

function removeFromCart(id){
  let cart = getCart().filter(i=>i.id!==id);
  saveCart(cart);
  updateCartBadge();
  renderCartDrawer();
}

function updateCartVariant(id, field, val){
  const cart = getCart();
  const item = cart.find(i=>i.id===id);
  if (!item) return;
  item[field] = val;
  saveCart(cart);
}

function updatePiece(id, pieceIdx, field, val){
  const cart = getCart();
  const item = cart.find(i=>i.id===id);
  if (!item) return;
  if (!item.pieces) item.pieces = [];
  while(item.pieces.length <= pieceIdx) item.pieces.push({});
  item.pieces[pieceIdx][field] = val;
  saveCart(cart);
}

function handleAddToCart(e){
  const btn = e.target.closest("[data-add]");
  if (!btn) return;
  const id = btn.dataset.add;
  const product = PRODUCTS.find(p=>p.id===id);
  if (!product || product.status === "out") return;

  // إذا للمنتج مقاسات أو ألوان، افتح صفحة المنتج أولاً
  if (product.sizes.length || product.colors?.length){
    openProductModal(id);
    return;
  }

  addToCartSimple(id);
  animateCartBtn(btn);
}

function addToCartSimple(id, size="", color="", qty=1){
  const cart = getCart();
  const existing = cart.find(i=>i.id===id && i.size===size && i.color===color);
  if (existing){
    existing.qty += qty;
    if (!existing.pieces) existing.pieces = [];
    const p = PRODUCTS.find(x=>x.id===id);
    for(let i=0;i<qty;i++) existing.pieces.push({size, color});
    existing.pieces = existing.pieces.slice(0, existing.qty);
  } else {
    const p = PRODUCTS.find(x=>x.id===id);
    const pieces = Array.from({length:qty},()=>({size,color}));
    cart.push({id, qty, size, color, pieces});
  }
  saveCart(cart);
  updateCartBadge();
}

function animateCartBtn(btn){
  btn.classList.add("added");
  const orig = btn.innerHTML;
  btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12l5 5L20 7"/></svg>`;
  setTimeout(()=>{ btn.classList.remove("added"); btn.innerHTML = orig; }, 1300);
}

/* ================================================
   صفحة المنتج — Modal
   ================================================ */
function openProductModal(id){
  const p = PRODUCTS.find(x=>x.id===id);
  if (!p) return;
  currentProductId = id;
  // لا يوجد اختيار مبدئي — يجب على الزبون اختيار المقاس واللون بنفسه قبل تفعيل زر الإضافة للسلة
  selectedSize = null;
  selectedColor = null;
  selectedQty = 1;

  const images = getImages(p);
  currentGalleryIdx = 0;

  // الصور الرئيسية
  renderGallery(p);
  renderProductDetail(p);

  document.getElementById("productModalOverlay").classList.add("open");
  document.body.style.overflow = "hidden";
}

function closeProductModal(){
  document.getElementById("productModalOverlay").classList.remove("open");
  document.body.style.overflow = "";
}

function renderGallery(p){
  const images = getImages(p);
  const mainEl = document.getElementById("galleryMainContent");
  const thumbsEl = document.getElementById("galleryThumbs");
  const navEl = document.getElementById("galleryNav");
  const expandBtn = document.getElementById("galleryExpandBtn");
  const downloadBtn = document.getElementById("galleryDownloadBtn");

  if (images.length){
    mainEl.innerHTML = `<img id="galleryMainImg" src="${images[currentGalleryIdx]}" alt="${p.name}">`;
    navEl.style.display = images.length > 1 ? "flex" : "none";
    if (expandBtn) expandBtn.style.display = "flex";
    if (downloadBtn) downloadBtn.style.display = "flex";
    thumbsEl.innerHTML = images.map((img,i)=>`
      <div class="gallery-thumb ${i===0?"active":""}" data-gi="${i}">
        <img src="${img}" alt="">
      </div>`).join("");
  } else {
    mainEl.innerHTML = SHOE_ICONS[p.icon]||SHOE_ICONS.sneaker;
    navEl.style.display = "none";
    if (expandBtn) expandBtn.style.display = "none";
    if (downloadBtn) downloadBtn.style.display = "none";
    thumbsEl.innerHTML = "";
  }
}

function setGalleryImage(p, idx){
  const images = getImages(p);
  if (!images.length) return;
  currentGalleryIdx = (idx + images.length) % images.length;
  const mainImg = document.getElementById("galleryMainImg");
  if (mainImg) mainImg.src = images[currentGalleryIdx];
  document.querySelectorAll(".gallery-thumb").forEach((t,i)=>t.classList.toggle("active", i===currentGalleryIdx));
}

/* ================================================
   التنقل بالسحب داخل معرض الصور (الصفحة الرئيسية)
   ================================================ */
function setupGallerySwipe(){
  const stage = document.getElementById("galleryMain");
  if (!stage) return;
  let startX = 0, startY = 0, dragging = false;

  stage.addEventListener("touchstart", (e)=>{
    if (e.touches.length !== 1) return;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    dragging = true;
  }, { passive: true });

  stage.addEventListener("touchend", (e)=>{
    if (!dragging) return;
    dragging = false;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - startX;
    const dy = touch.clientY - startY;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)){
      const p = PRODUCTS.find(x=>x.id===currentProductId);
      if (p) setGalleryImage(p, currentGalleryIdx + (dx < 0 ? 1 : -1));
    }
  }, { passive: true });
}

/* ================================================
   صندوق العرض الكامل للصورة — Lightbox
   تكبير/تصغير بالقرص (pinch) أو عجلة الفأرة، سحب للتنقل
   بين الصور، سحب للتحريك عند التكبير، نقر مزدوج للتكبير السريع
   ================================================ */
const Lightbox = (() => {
  let images = [];
  let idx = 0;
  let scale = 1, panX = 0, panY = 0;
  let pinchStartDist = 0, pinchStartScale = 1;
  let dragStartX = 0, dragStartY = 0, dragging = false;
  let lastTapTime = 0;

  function els(){
    return {
      overlay: document.getElementById("lightboxOverlay"),
      stage: document.getElementById("lightboxStage"),
      img: document.getElementById("lightboxImg"),
      counter: document.getElementById("lightboxCounter"),
      nav: document.getElementById("lightboxNav")
    };
  }

  function open(imgs, startIdx){
    images = imgs; idx = startIdx || 0;
    scale = 1; panX = 0; panY = 0;
    const { overlay, counter, nav } = els();
    overlay.classList.add("open");
    document.body.style.overflow = "hidden";
    counter.style.display = images.length > 1 ? "block" : "none";
    nav.style.display = images.length > 1 ? "flex" : "none";
    render();
  }

  function close(){
    els().overlay.classList.remove("open");
    document.body.style.overflow = "";
  }

  function render(){
    const { img, counter } = els();
    img.src = images[idx];
    counter.textContent = `${idx+1} / ${images.length}`;
    applyTransform();
  }

  function applyTransform(){
    els().img.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
  }

  function go(delta){
    if (!images.length) return;
    idx = (idx + delta + images.length) % images.length;
    scale = 1; panX = 0; panY = 0;
    render();
  }

  function setScale(s, originX, originY){
    scale = Math.min(Math.max(s, 1), 4);
    if (scale === 1){ panX = 0; panY = 0; }
    applyTransform();
  }

  function dist(t1, t2){
    return Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
  }

  function bindEvents(){
    const { overlay, stage, img } = els();
    if (!overlay) return;

    document.getElementById("lightboxClose").addEventListener("click", close);
    document.getElementById("lightboxPrev").addEventListener("click", ()=>go(-1));
    document.getElementById("lightboxNext").addEventListener("click", ()=>go(1));
    document.getElementById("lightboxZoomIn").addEventListener("click", ()=>setScale(scale+0.6));
    document.getElementById("lightboxZoomOut").addEventListener("click", ()=>setScale(scale-0.6));
    document.getElementById("lightboxZoomReset").addEventListener("click", ()=>setScale(1));
    document.getElementById("lightboxDownload")?.addEventListener("click", ()=>{
      const url = images[idx];
      const ext = (url.split(".").pop()||"jpg").split("?")[0].slice(0,4);
      downloadImage(url, `صورة-${idx+1}.${ext}`);
    });

    overlay.addEventListener("click", (e)=>{ if (e.target === overlay) close(); });

    document.addEventListener("keydown", (e)=>{
      if (!overlay.classList.contains("open")) return;
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
    });

    // عجلة الفأرة للتكبير (سطح المكتب)
    stage.addEventListener("wheel", (e)=>{
      e.preventDefault();
      setScale(scale + (e.deltaY < 0 ? 0.3 : -0.3));
    }, { passive: false });

    // نقر مزدوج للتكبير السريع
    stage.addEventListener("dblclick", ()=> setScale(scale > 1 ? 1 : 2.4));

    // اللمس: قرص للتكبير، سحب للتحريك أو التنقل
    let touchStartX = 0, touchStartY = 0;
    stage.addEventListener("touchstart", (e)=>{
      if (e.touches.length === 2){
        pinchStartDist = dist(e.touches[0], e.touches[1]);
        pinchStartScale = scale;
      } else if (e.touches.length === 1){
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        dragStartX = panX; dragStartY = panY;
        dragging = true;
      }
    }, { passive: true });

    stage.addEventListener("touchmove", (e)=>{
      if (e.touches.length === 2){
        e.preventDefault();
        const d = dist(e.touches[0], e.touches[1]);
        setScale(pinchStartScale * (d / pinchStartDist));
      } else if (e.touches.length === 1 && dragging){
        const dx = e.touches[0].clientX - touchStartX;
        const dy = e.touches[0].clientY - touchStartY;
        if (scale > 1){
          panX = dragStartX + dx;
          panY = dragStartY + dy;
          applyTransform();
        }
      }
    }, { passive: false });

    stage.addEventListener("touchend", (e)=>{
      const wasDragging = dragging;
      dragging = false;
      if (e.touches.length > 0) return;
      const touch = e.changedTouches[0];
      const dx = touch.clientX - touchStartX;
      const dy = touch.clientY - touchStartY;

      // نقر مزدوج باللمس
      const now = Date.now();
      if (now - lastTapTime < 300 && Math.abs(dx) < 10 && Math.abs(dy) < 10){
        setScale(scale > 1 ? 1 : 2.4);
      }
      lastTapTime = now;

      // سحب للتنقل بين الصور عندما لا يوجد تكبير
      if (scale <= 1 && wasDragging && Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)){
        go(dx < 0 ? 1 : -1);
      }
    });
  }

  return { open, close, bindEvents };
})();


/* يتحقق هل اختار الزبون كل الخيارات المطلوبة (مقاس/لون) قبل تفعيل زر الإضافة للسلة */
function canAddToCart(p){
  if (p.sizes?.length && !selectedSize) return false;
  if (p.colors?.length && !selectedColor) return false;
  return true;
}

function renderProductDetail(p){
  const el = document.getElementById("productDetail");
  const oldPriceHTML = p.oldPrice ? `<span class="product-detail-old">${formatPrice(p.oldPrice)}</span>` : "";
  const badgeHTML = p.badge === "offer" ? `<span class="product-detail-badge">خصم ${p.discount}%</span>` : (p.badge ? `<span class="product-detail-badge">${BADGE_TEXT[p.badge]}</span>` : "");

  // مقاسات
  const sizesHTML = p.sizes.length ? `
    <div class="detail-label">المقاس: <span style="color:var(--ember)">*</span></div>
    <div class="size-picker" id="sizePicker">
      ${p.sizes.map(s=>`<button class="size-option ${String(selectedSize)===String(s)?"active":""}" data-size="${s}" onclick="selectSize(${s})">${s}</button>`).join("")}
    </div>` : "";

  // ألوان
  const colorsHTML = p.colors?.length ? `
    <div class="detail-label">اللون: <span style="color:var(--ember)">*</span></div>
    <div class="color-picker" id="colorPicker">
      ${p.colors.map(c=>`<button class="color-option ${selectedColor===c?"active":""}" data-color="${c}" onclick="selectColor('${c}')">${c}</button>`).join("")}
    </div>` : "";

  const needsChoice = (p.sizes?.length && !selectedSize) || (p.colors?.length && !selectedColor);
  const addDisabled = p.status === "out" || needsChoice;
  const addLabel = needsChoice ? "اختر المقاس واللون أولاً" : "إضافة إلى السلة";

  el.innerHTML = `
    <div class="product-detail-cat">${p.category}</div>
    <span class="product-detail-code">${p.code || p.id}</span>
    <h2 class="product-detail-name">${p.name}</h2>
    <div class="product-detail-price-row">
      <span class="product-detail-price">${formatPrice(p.price)}</span>
      ${oldPriceHTML}
      ${badgeHTML}
    </div>
    <p class="product-detail-desc">${p.description || ""}</p>
    ${sizesHTML}
    ${colorsHTML}
    <div class="detail-qty">
      <span class="detail-qty-label">الكمية:</span>
      <div class="detail-qty-controls">
        <button class="detail-qty-btn" onclick="changeDetailQty(-1)">−</button>
        <span class="detail-qty-val" id="detailQtyVal">1</span>
        <button class="detail-qty-btn" onclick="changeDetailQty(1)">+</button>
      </div>
    </div>
    <div class="stock-note ${p.status}" style="margin-bottom:18px;">${dotSVG()} ${STATUS_TEXT[p.status]}</div>
    ${p.status !== "out" ? `<button class="btn btn-primary detail-add-btn" id="addToCartDetailBtn" onclick="addFromModal()" ${addDisabled?"disabled":""}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3h2l2.6 13.4a2 2 0 0 0 2 1.6h8.8a2 2 0 0 0 2-1.6L22 7H6"/><circle cx="9" cy="21" r="1.4" fill="currentColor"/><circle cx="18" cy="21" r="1.4" fill="currentColor"/></svg>
      ${addLabel}
    </button>` : `<button class="btn btn-outline detail-add-btn" disabled>نفذ من المخزون</button>`}
    <button class="btn btn-whatsapp detail-add-btn" onclick="quickOrderWhatsapp('${p.id}')">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.5 14.4c-.3-.1-1.7-.8-2-.9-.3-.1-.5-.1-.6.1-.2.3-.7.9-.9 1.1-.2.2-.3.2-.6.1-1.6-.7-2.7-1.6-3.6-3.1-.1-.2-.1-.4.1-.6l.5-.6c.1-.2.1-.3 0-.5-.1-.2-.6-1.5-.8-2-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.2.2-.9.9-.9 2.2 0 1.3.9 2.5 1 2.7.1.2 1.8 2.8 4.5 3.9 2.7 1.1 2.7.7 3.2.7.5 0 1.6-.6 1.8-1.2.2-.6.2-1.1.1-1.2-.1-.1-.3-.2-.5-.3Z"/><path d="M12 2C6.5 2 2 6.5 2 12c0 1.8.5 3.6 1.4 5.1L2 22l5.1-1.3c1.4.8 3.1 1.2 4.9 1.2 5.5 0 10-4.5 10-10S17.5 2 12 2Zm0 18.2c-1.6 0-3.1-.4-4.4-1.2l-.3-.2-3 .8.8-2.9-.2-.3C4.2 15 3.8 13.5 3.8 12c0-4.5 3.7-8.2 8.2-8.2s8.2 3.7 8.2 8.2-3.7 8.2-8.2 8.2Z"/></svg>
      اطلب مباشرة عبر واتساب
    </button>`;
}

function selectSize(s){
  selectedSize = s;
  document.querySelectorAll(".size-option").forEach(b=>{
    b.classList.toggle("active", String(b.dataset.size)===String(s));
  });
  refreshAddToCartState();
}

function selectColor(c){
  selectedColor = c;
  document.querySelectorAll(".color-option").forEach(b=>{
    b.classList.toggle("active", b.dataset.color===c);
  });
  refreshAddToCartState();
}

/* تحديث حالة زر الإضافة للسلة فوراً بعد كل اختيار، دون إعادة رسم الصفحة كاملة */
function refreshAddToCartState(){
  const p = PRODUCTS.find(x=>x.id===currentProductId);
  if (!p) return;
  const btn = document.getElementById("addToCartDetailBtn");
  if (!btn) return;
  const needsChoice = (p.sizes?.length && !selectedSize) || (p.colors?.length && !selectedColor);
  btn.disabled = needsChoice;
  btn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3h2l2.6 13.4a2 2 0 0 0 2 1.6h8.8a2 2 0 0 0 2-1.6L22 7H6"/><circle cx="9" cy="21" r="1.4" fill="currentColor"/><circle cx="18" cy="21" r="1.4" fill="currentColor"/></svg>
      ${needsChoice ? "اختر المقاس واللون أولاً" : "إضافة إلى السلة"}`;
}

function changeDetailQty(d){
  selectedQty = Math.max(1, selectedQty+d);
  const el = document.getElementById("detailQtyVal");
  if (el) el.textContent = selectedQty;
}

function addFromModal(){
  if (!currentProductId) return;
  addToCartSimple(currentProductId, String(selectedSize||""), selectedColor||"", selectedQty);
  closeProductModal();
  setTimeout(()=>{ openCart(); }, 200);
}

function quickOrderWhatsapp(id){
  const p = PRODUCTS.find(x=>x.id===id);
  if (!p) return;
  let msg = `السلام عليكم 🌹\nأريد الطلب:\n\n`;
  msg += `👟 *${p.name}*\n`;
  msg += `رمز المنتج: ${p.code || p.id}\n`;
  if (selectedSize) msg += `المقاس: ${selectedSize}\n`;
  if (selectedColor) msg += `اللون: ${selectedColor}\n`;
  msg += `الكمية: ${selectedQty}\n`;
  msg += `السعر: ${formatPrice(p.price * selectedQty)}\n`;
  window.open(`https://wa.me/${waNumber()}?text=${encodeURIComponent(msg)}`);
}

/* ================================================
   نافذة الطلب والفاتورة
   ================================================ */
function openOrderModal(){
  const cart = getCart();
  if (!cart.length){ openCart(); return; }
  closeCart();
  LAST_ORDER_FIELDS = null;
  CURRENT_INVOICE_NO = null; /* طلب جديد = رقم فاتورة جديد */
  ORDER_ALREADY_SAVED = false;

  const orderOverlay = document.getElementById("orderOverlay");
  const orderContent = document.getElementById("orderContent");

  // بناء ملخص الطلب
  let subtotal = 0;
  const itemsHTML = cart.map(item=>{
    const p = PRODUCTS.find(x=>x.id===item.id);
    if (!p) return "";
    const images = getImages(p);
    const thumb = images.length
      ? `<img src="${images[0]}" alt="${p.name}">`
      : `<div style="width:56px;height:56px;display:flex;align-items:center;justify-content:center;background:var(--mist);border-radius:8px;">${(SHOE_ICONS[p.icon]||SHOE_ICONS.sneaker).replace('viewBox="0 0 200 120"','viewBox="0 0 200 120" width="36" height="36"')}</div>`;

    const itemTotal = p.price * item.qty;
    subtotal += itemTotal;

    let tags = [`رمز: ${p.code || p.id}`, `الكمية: ${item.qty}`];
    if (item.qty > 1 && item.pieces?.length){
      // عرض القطع المختلفة
      item.pieces.forEach((pc,i)=>{
        let t = `ق${i+1}:`;
        if (pc.size) t += ` مقاس ${pc.size}`;
        if (pc.color) t += ` ${pc.color}`;
        tags.push(t);
      });
    } else {
      if (item.size) tags.push(`مقاس: ${item.size}`);
      if (item.color) tags.push(item.color);
    }

    return `<div class="order-item">
      <div class="order-item-thumb">${thumb}</div>
      <div class="order-item-info">
        <div class="order-item-name">${p.name}</div>
        <div class="order-item-tags">${tags.map(t=>`<span class="order-item-tag">${t}</span>`).join("")}</div>
        <div class="order-item-price">${formatPrice(itemTotal)}</div>
      </div>
    </div>`;
  }).join("");

  const provincesHTML = IRAQ_PROVINCES.map(pr=>`<option value="${pr}">${pr}</option>`).join("");

  orderContent.innerHTML = `
    <div class="order-modal-body">
      <div class="order-summary">
        <div class="order-summary-title">📦 ملخص الطلب</div>
        ${itemsHTML}
        <div class="order-total order-subtotal-row">
          <span>المجموع الفرعي</span>
          <span id="ordSubtotalVal">${formatPrice(subtotal)}</span>
        </div>
        <div class="order-total order-delivery-row">
          <span>أجور التوصيل</span>
          <span id="ordDeliveryVal">—</span>
        </div>
        <div class="order-total order-grand-row">
          <span>المجموع الكلي</span>
          <span id="ordGrandVal">${formatPrice(subtotal)}</span>
        </div>
      </div>

      <div class="order-fields">
        <div class="order-field">
          <label>الاسم (اختياري)</label>
          <input type="text" id="ordName" placeholder="اسمك">
        </div>
        <div class="order-field">
          <label>رقم الهاتف <span style="color:var(--ember)">*</span></label>
          <input type="tel" id="ordPhone" placeholder="07xxxxxxxxx" required>
        </div>
        <div class="order-field-row">
          <div class="order-field">
            <label>المحافظة <span style="color:var(--ember)">*</span></label>
            <select id="ordProvince" required onchange="onProvinceChange()">
              <option value="">اختر المحافظة</option>
              ${provincesHTML}
            </select>
          </div>
          <div class="order-field">
            <label>القضاء <span style="color:var(--ember)">*</span></label>
            <select id="ordDistrict" required onchange="onDistrictChange()" disabled>
              <option value="">اختر المحافظة أولاً</option>
            </select>
          </div>
        </div>
        <div class="order-field">
          <label>الناحية (اختياري)</label>
          <input type="text" id="ordSubdistrict" placeholder="اسم الناحية إن وُجدت">
        </div>
        <div class="order-field">
          <label>أقرب نقطة دالة</label>
          <input type="text" id="ordLandmark" placeholder="مثال: قرب جامع، مدرسة، محطة وقود...">
        </div>
        <div class="order-field">
          <label>ملاحظات إضافية (اختياري)</label>
          <textarea id="ordNotes" rows="2" placeholder="أي تفاصيل أخرى..."></textarea>
        </div>
        <div class="order-field">
          <label>طريقة إرسال الطلب</label>
          <div class="send-method-row">
            <button type="button" class="send-method-btn active" id="sendMethodWa" onclick="setSendMethod('whatsapp')">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.5 14.4c-.3-.1-1.7-.8-2-.9-.3-.1-.5-.1-.6.1-.2.3-.7.9-.9 1.1-.2.2-.3.2-.6.1-1.6-.7-2.7-1.6-3.6-3.1-.1-.2-.1-.4.1-.6l.5-.6c.1-.2.1-.3 0-.5-.1-.2-.6-1.5-.8-2-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.2.2-.9.9-.9 2.2 0 1.3.9 2.5 1 2.7.1.2 1.8 2.8 4.5 3.9 2.7 1.1 2.7.7 3.2.7.5 0 1.6-.6 1.8-1.2.2-.6.2-1.1.1-1.2-.1-.1-.3-.2-.5-.3Z"/><path d="M12 2C6.5 2 2 6.5 2 12c0 1.8.5 3.6 1.4 5.1L2 22l5.1-1.3c1.4.8 3.1 1.2 4.9 1.2 5.5 0 10-4.5 10-10S17.5 2 12 2Zm0 18.2c-1.6 0-3.1-.4-4.4-1.2l-.3-.2-3 .8.8-2.9-.2-.3C4.2 15 3.8 13.5 3.8 12c0-4.5 3.7-8.2 8.2-8.2s8.2 3.7 8.2 8.2-3.7 8.2-8.2 8.2Z"/></svg>
              واتساب
            </button>
            <button type="button" class="send-method-btn" id="sendMethodFb" onclick="setSendMethod('messenger')">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.15 2 11.27c0 2.91 1.44 5.51 3.7 7.21V22l3.38-1.86c.9.25 1.86.38 2.92.38 5.52 0 10-4.15 10-9.27S17.52 2 12 2Zm1.04 12.48-2.55-2.72-4.98 2.72 5.48-5.82 2.61 2.72 4.92-2.72-5.48 5.82Z"/></svg>
              ماسنجر
            </button>
          </div>
        </div>
      </div>
    </div>
    <div class="order-modal-foot">
      <button class="btn btn-whatsapp" id="orderSendBtn" onclick="sendOrderWithInvoice()">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.5 14.4c-.3-.1-1.7-.8-2-.9-.3-.1-.5-.1-.6.1-.2.3-.7.9-.9 1.1-.2.2-.3.2-.6.1-1.6-.7-2.7-1.6-3.6-3.1-.1-.2-.1-.4.1-.6l.5-.6c.1-.2.1-.3 0-.5-.1-.2-.6-1.5-.8-2-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.2.2-.9.9-.9 2.2 0 1.3.9 2.5 1 2.7.1.2 1.8 2.8 4.5 3.9 2.7 1.1 2.7.7 3.2.7.5 0 1.6-.6 1.8-1.2.2-.6.2-1.1.1-1.2-.1-.1-.3-.2-.5-.3Z"/><path d="M12 2C6.5 2 2 6.5 2 12c0 1.8.5 3.6 1.4 5.1L2 22l5.1-1.3c1.4.8 3.1 1.2 4.9 1.2 5.5 0 10-4.5 10-10S17.5 2 12 2Zm0 18.2c-1.6 0-3.1-.4-4.4-1.2l-.3-.2-3 .8.8-2.9-.2-.3C4.2 15 3.8 13.5 3.8 12c0-4.5 3.7-8.2 8.2-8.2s8.2 3.7 8.2 8.2-3.7 8.2-8.2 8.2Z"/></svg>
        إرسال الطلب عبر واتساب
      </button>
      <button class="btn btn-outline" onclick="previewInvoice()">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
        معاينة الفاتورة
      </button>
    </div>`;

  orderOverlay.classList.add("open");
  document.body.style.overflow = "hidden";
}

/* اختيار طريقة الإرسال (واتساب / ماسنجر) */
let SEND_METHOD = "whatsapp";
function setSendMethod(method){
  SEND_METHOD = method;
  document.getElementById("sendMethodWa")?.classList.toggle("active", method==="whatsapp");
  document.getElementById("sendMethodFb")?.classList.toggle("active", method==="messenger");
  const sendBtn = document.getElementById("orderSendBtn");
  if (sendBtn){
    sendBtn.classList.toggle("btn-whatsapp", method==="whatsapp");
    sendBtn.classList.toggle("btn-messenger", method==="messenger");
    sendBtn.innerHTML = method==="whatsapp"
      ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.5 14.4c-.3-.1-1.7-.8-2-.9-.3-.1-.5-.1-.6.1-.2.3-.7.9-.9 1.1-.2.2-.3.2-.6.1-1.6-.7-2.7-1.6-3.6-3.1-.1-.2-.1-.4.1-.6l.5-.6c.1-.2.1-.3 0-.5-.1-.2-.6-1.5-.8-2-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.2.2-.9.9-.9 2.2 0 1.3.9 2.5 1 2.7.1.2 1.8 2.8 4.5 3.9 2.7 1.1 2.7.7 3.2.7.5 0 1.6-.6 1.8-1.2.2-.6.2-1.1.1-1.2-.1-.1-.3-.2-.5-.3Z"/><path d="M12 2C6.5 2 2 6.5 2 12c0 1.8.5 3.6 1.4 5.1L2 22l5.1-1.3c1.4.8 3.1 1.2 4.9 1.2 5.5 0 10-4.5 10-10S17.5 2 12 2Zm0 18.2c-1.6 0-3.1-.4-4.4-1.2l-.3-.2-3 .8.8-2.9-.2-.3C4.2 15 3.8 13.5 3.8 12c0-4.5 3.7-8.2 8.2-8.2s8.2 3.7 8.2 8.2-3.7 8.2-8.2 8.2Z"/></svg> إرسال الطلب عبر واتساب`
      : `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.15 2 11.27c0 2.91 1.44 5.51 3.7 7.21V22l3.38-1.86c.9.25 1.86.38 2.92.38 5.52 0 10-4.15 10-9.27S17.52 2 12 2Zm1.04 12.48-2.55-2.72-4.98 2.72 5.48-5.82 2.61 2.72 4.92-2.72-5.48 5.82Z"/></svg> إرسال الطلب عبر ماسنجر`;
  }
}

/* عند اختيار المحافظة: تعبئة قائمة الأقضية التابعة لها */
function onProvinceChange(){
  const provinceEl = document.getElementById("ordProvince");
  const districtEl = document.getElementById("ordDistrict");
  const province = provinceEl?.value || "";
  const districts = IRAQ_DISTRICTS[province] || [];

  if (!districtEl) return;
  if (!province || !districts.length){
    districtEl.innerHTML = `<option value="">اختر المحافظة أولاً</option>`;
    districtEl.disabled = true;
  } else {
    districtEl.innerHTML = `<option value="">اختر القضاء</option>` +
      districts.map(d=>`<option value="${d}">${d}</option>`).join("");
    districtEl.disabled = false;
  }
  updateOrderTotals();
}

function onDistrictChange(){
  updateOrderTotals();
}

/* تحديث المجموع الفرعي + أجور التوصيل + المجموع الكلي حسب المحافظة/القضاء المختارين */
function updateOrderTotals(){
  const cart = getCart();
  let subtotal = 0;
  cart.forEach(item=>{
    const p = PRODUCTS.find(x=>x.id===item.id);
    if (p) subtotal += p.price * item.qty;
  });

  const province = document.getElementById("ordProvince")?.value || "";
  const district = document.getElementById("ordDistrict")?.value || "";
  const deliveryEl = document.getElementById("ordDeliveryVal");
  const grandEl = document.getElementById("ordGrandVal");
  const subtotalEl = document.getElementById("ordSubtotalVal");
  if (subtotalEl) subtotalEl.textContent = formatPrice(subtotal);

  if (!province || !district){
    if (deliveryEl) deliveryEl.textContent = "يُحدّد بعد اختيار المنطقة";
    if (grandEl) grandEl.textContent = formatPrice(subtotal);
    return;
  }

  const fee = calcDeliveryFee(province, district);
  if (deliveryEl) deliveryEl.textContent = formatPrice(fee);
  if (grandEl) grandEl.textContent = formatPrice(subtotal + fee);
}

/* تحقق بسيط من صيغة رقم الهاتف العراقي (07 + 9 أرقام = 11 رقم بالمجموع) */
function isValidIraqiPhone(phone){
  const digits = String(phone||"").replace(/[^0-9]/g,"");
  return /^07[3-9][0-9]{8}$/.test(digits);
}

/* قراءة بيانات العميل من النموذج وحفظها — يتم استدعاؤها قبل تحويل النافذة لعرض الفاتورة
   حتى لا تُفقد القيم بعد إزالة الحقول من الصفحة (DOM) */
function readOrderFields(){
  const nameEl = document.getElementById("ordName");
  const phoneEl = document.getElementById("ordPhone");
  const provinceEl = document.getElementById("ordProvince");
  const districtEl = document.getElementById("ordDistrict");
  const subdistrictEl = document.getElementById("ordSubdistrict");
  const landmarkEl = document.getElementById("ordLandmark");
  const notesEl = document.getElementById("ordNotes");

  // إن كانت حقول النموذج موجودة بالصفحة، نقرأ منها ونحدّث النسخة المحفوظة
  if (phoneEl){
    LAST_ORDER_FIELDS = {
      name: nameEl?.value.trim()||"",
      phone: phoneEl?.value.trim()||"",
      province: provinceEl?.value||"",
      district: districtEl?.value||"",
      subdistrict: subdistrictEl?.value.trim()||"",
      landmark: landmarkEl?.value.trim()||"",
      notes: notesEl?.value.trim()||""
    };
  }

  // نعيد النسخة المحفوظة (سواء كانت حديثة أو من قبل، مثل حالة عرض الفاتورة بعد حذف النموذج)
  return LAST_ORDER_FIELDS || { name:"", phone:"", province:"", district:"", subdistrict:"", landmark:"", notes:"" };
}

/* ================================================
   إرسال الطلب — النسخة المُصلَحة
   ----------------------------------------------------
   المشكلة القديمة: كان الموقع يبني صورة الفاتورة أولاً
   (عملية غير متزامنة تستغرق وقت) ثم يحاول يفتح واتساب
   بعدها — وهذا يخلي المتصفح (خصوصاً بالموبايل) يحجب
   فتح النافذة لأنها ما عادت ناتجة "مباشرة" عن ضغطة
   المستخدم. الحل: نفتح نافذة واتساب/ماسنجر فوراً ضمن
   نفس اللحظة التي يضغط فيها الزبون الزر (بدون أي await
   قبلها)، ثم نكمل حفظ الطلب بقاعدة البيانات بالخلفية.
   ================================================ */
/* معاينة الفاتورة فقط (بدون إرسال ولا حفظ بقاعدة البيانات) — تتيح للزبون مراجعة طلبه قبل التأكيد */
function previewInvoice(){
  const fields = readOrderFields();
  if (!fields.phone || !isValidIraqiPhone(fields.phone)){
    alert("الرجاء إدخال رقم هاتف عراقي صحيح (مثال: 07xxxxxxxxx)");
    return;
  }
  if (!fields.province){ alert("الرجاء اختيار المحافظة"); return; }
  if (!fields.district){ alert("الرجاء اختيار القضاء"); return; }
  showInvoice();
  // بمعاينة الفاتورة فقط، لا نعرض شريط "تم الحفظ" لأن الطلب لم يُرسل بعد فعلياً
  const statusEl = document.getElementById("orderSaveStatus");
  if (statusEl) statusEl.innerHTML = `<span style="color:var(--ink-soft);">📝 هذه معاينة فقط — اضغط "إرسال الطلب" لتأكيده وحفظه.</span>`;
}

async function sendOrderWithInvoice(){
  const fields = readOrderFields();
  if (!fields.phone || !isValidIraqiPhone(fields.phone)){
    alert("الرجاء إدخال رقم هاتف عراقي صحيح (مثال: 07xxxxxxxxx)");
    return;
  }
  if (!fields.province){ alert("الرجاء اختيار المحافظة"); return; }
  if (!fields.district){ alert("الرجاء اختيار القضاء"); return; }

  // رقم فاتورة جديد يُولَّد لحظة الإرسال فقط (وليس عند مجرد فتح نافذة الطلب)
  if (!CURRENT_INVOICE_NO) CURRENT_INVOICE_NO = generateInvoiceNo();

  const text = buildOrderText();
  if (!text) return;

  // الخطوة الحرجة: نفتح نافذة التواصل فوراً ومتزامنة مع الضغطة،
  // قبل أي عملية async، حتى لا يحجبها المتصفح
  if (SEND_METHOD === "messenger"){
    window.open(`${messengerLink()}?text=${encodeURIComponent(text)}`, "_blank");
  } else {
    window.open(`https://wa.me/${waNumber()}?text=${encodeURIComponent(text)}`, "_blank");
  }

  // نعرض للزبون شاشة الفاتورة + رقم الفاتورة فوراً
  showInvoice();

  // نحفظ الطلب بقاعدة البيانات بالخلفية مرة واحدة فقط (لا تمنع ولا تؤخر فتح واتساب أعلاه)
  if (!ORDER_ALREADY_SAVED){
    ORDER_ALREADY_SAVED = true;
    saveOrderToDatabase().catch(()=>{ /* الخطأ يُعرض من داخل الدالة نفسها */ });
  } else {
    setOrderSaveStatus("saved", CURRENT_INVOICE_NO);
  }
}

function closeOrderModal(){
  document.getElementById("orderOverlay").classList.remove("open");
  document.body.style.overflow = "";
}

function buildOrderText(){
  const cart = getCart();
  const { name, phone, province, district, subdistrict, landmark, notes } = readOrderFields();

  if (!phone){ alert("الرجاء إدخال رقم الهاتف"); return null; }
  if (!province){ alert("الرجاء اختيار المحافظة"); return null; }
  if (!district){ alert("الرجاء اختيار القضاء"); return null; }

  let subtotal = 0;
  let msg = `🌹 *طلب جديد من متجر خطوة*\n`;
  if (CURRENT_INVOICE_NO) msg += `🧾 رقم الفاتورة: *${CURRENT_INVOICE_NO}*\n`;
  msg += `━━━━━━━━━━━━━━━━━\n`;
  msg += `👤 *بيانات العميل*\n`;
  if (name) msg += `الاسم: ${name}\n`;
  msg += `الهاتف: ${phone}\n`;
  msg += `المحافظة: ${province}\n`;
  msg += `القضاء: ${district}\n`;
  if (subdistrict) msg += `الناحية: ${subdistrict}\n`;
  if (landmark) msg += `أقرب نقطة: ${landmark}\n`;
  msg += `\n📦 *تفاصيل الطلب*\n`;

  cart.forEach(item=>{
    const p = PRODUCTS.find(x=>x.id===item.id);
    if (!p) return;
    const itemTotal = p.price * item.qty;
    subtotal += itemTotal;
    msg += `━━━━━━━━━━━━━━━━━\n`;
    msg += `👟 ${p.name}\n`;
    msg += `رمز المنتج: ${p.code || p.id}\n`;
    msg += `السعر: ${formatPrice(p.price)}\n`;
    msg += `الكمية: ${item.qty}\n`;

    if (item.qty > 1 && item.pieces?.length){
      item.pieces.forEach((pc,i)=>{
        msg += `  • قطعة ${i+1}:`;
        if (pc.size) msg += ` مقاس ${pc.size}`;
        if (pc.color) msg += ` - لون ${pc.color}`;
        msg += "\n";
      });
    } else {
      if (item.size) msg += `المقاس: ${item.size}\n`;
      if (item.color) msg += `اللون: ${item.color}\n`;
    }
    msg += `المجموع: ${formatPrice(itemTotal)}\n`;
  });

  const deliveryFee = calcDeliveryFee(province, district);
  msg += `━━━━━━━━━━━━━━━━━\n`;
  msg += `المجموع الفرعي: ${formatPrice(subtotal)}\n`;
  msg += `أجور التوصيل: ${formatPrice(deliveryFee)}\n`;
  msg += `💰 *المجموع الكلي: ${formatPrice(subtotal + deliveryFee)}*\n`;
  if (notes) msg += `\n📝 ملاحظات: ${notes}\n`;
  msg += `\n🚚 الدفع عند الاستلام`;
  return msg;
}

function sendOrderWhatsapp(){
  const text = buildOrderText();
  if (!text) return;
  window.open(`https://wa.me/${waNumber()}?text=${encodeURIComponent(text)}`, "_blank");
}

function sendOrderMessenger(){
  const text = buildOrderText();
  if (!text) return;
  window.open(`${messengerLink()}?text=${encodeURIComponent(text)}`, "_blank");
}

/* ================================================
   حفظ الطلب تلقائياً بقاعدة البيانات (GitHub Issues)
   ----------------------------------------------------
   لا حاجة بعد الآن لأي نسخ/لصق يدوي. بمجرد إرسال الطلب
   يُحفظ تلقائياً بريبو الطلبات المنفصل (orders-config.js)
   ويصبح فوراً قابلاً للبحث برقم الفاتورة من الموقع نفسه
   أو من لوحة التحكم.
   ================================================ */
function buildOrderRecord(){
  const cart = getCart();
  const { name, phone, province, district, subdistrict, landmark, notes } = readOrderFields();
  if (!phone || !province || !district) return null;

  let subtotal = 0;
  const items = cart.map(item=>{
    const p = PRODUCTS.find(x=>x.id===item.id);
    if (!p) return null;
    const itemTotal = p.price * item.qty;
    subtotal += itemTotal;
    return {
      name: p.name,
      code: p.code || p.id,
      image: getImages(p)[0] || "",
      price: p.price,
      qty: item.qty,
      size: item.size || "",
      color: item.color || "",
      pieces: item.pieces || [],
      total: itemTotal
    };
  }).filter(Boolean);

  const deliveryFee = calcDeliveryFee(province, district);

  return {
    id: "ORD-" + Date.now(),
    invoiceNo: CURRENT_INVOICE_NO || generateInvoiceNo(),
    date: new Date().toISOString(),
    status: "new",
    sendMethod: SEND_METHOD,
    customer: { name, phone, province, district, subdistrict, landmark, notes },
    items,
    subtotal,
    deliveryFee,
    total: subtotal + deliveryFee
  };
}

/* حالة شريط حفظ الطلب التي تظهر للزبون أسفل الفاتورة */
function setOrderSaveStatus(state, extra){
  const el = document.getElementById("orderSaveStatus");
  if (!el) return;
  if (state === "saving"){
    el.className = "order-save-status saving";
    el.innerHTML = `<span class="spinner"></span> جارٍ حفظ طلبك بقاعدة البيانات...`;
  } else if (state === "saved"){
    el.className = "order-save-status saved";
    el.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M5 12l5 5L20 7"/></svg> تم حفظ طلبك بنجاح — رقم الفاتورة: <b>${extra||""}</b>`;
  } else if (state === "error"){
    el.className = "order-save-status error";
    el.innerHTML = `⚠️ تم إرسال طلبك عبر الرسالة بنجاح، لكن تعذّر حفظه تلقائياً بقاعدة البيانات (${extra||"خطأ غير معروف"}). احتفظ برقم الفاتورة <b>${CURRENT_INVOICE_NO||""}</b> لمتابعة طلبك.`;
  } else {
    el.className = "order-save-status";
    el.innerHTML = "";
  }
}

async function saveOrderToDatabase(){
  const record = buildOrderRecord();
  if (!record){ setOrderSaveStatus("error","بيانات ناقصة"); return; }

  if (typeof ORDERS_CONFIG === "undefined" || !ORDERS_CONFIG.writeToken){
    // لم تُهيّأ قاعدة البيانات بعد من قبل صاحب المتجر — لا نوقف الطلب، فقط ننبّه بهدوء
    setOrderSaveStatus("error","لم يتم تفعيل الحفظ التلقائي بعد");
    return;
  }

  setOrderSaveStatus("saving");
  try{
    await GitHubAPI.createOrderIssue(ORDERS_CONFIG, record);
    setOrderSaveStatus("saved", record.invoiceNo);
  }catch(err){
    setOrderSaveStatus("error", err.message);
  }
}

/* ================================================
   تتبّع الطلب برقم الفاتورة (متاح لكل زائر من الموقع)
   ================================================ */
function openTrackModal(){
  document.getElementById("trackOverlay").classList.add("open");
  document.body.style.overflow = "hidden";
  document.getElementById("trackResult").innerHTML = "";
  document.getElementById("trackInvoiceInput").value = "";
  setTimeout(()=>document.getElementById("trackInvoiceInput")?.focus(), 100);
}
function closeTrackModal(){
  document.getElementById("trackOverlay")?.classList.remove("open");
  document.body.style.overflow = "";
}

const ORDER_STATUS_LABELS = {
  "new-order": "🆕 طلب جديد",
  "new": "🆕 طلب جديد",
  "confirmed": "📞 تم التأكيد",
  "processing": "📦 قيد التجهيز",
  "shipped": "🚚 في الطريق للتوصيل",
  "done": "✅ تم التسليم",
  "cancelled": "❌ ملغي"
};

async function searchOrderByInvoice(){
  const input = document.getElementById("trackInvoiceInput");
  const resultEl = document.getElementById("trackResult");
  const invoiceNo = input.value.trim().toUpperCase();

  if (!invoiceNo){ resultEl.innerHTML = `<div class="track-msg error">الرجاء إدخال رقم الفاتورة</div>`; return; }

  if (typeof ORDERS_CONFIG === "undefined" || !ORDERS_CONFIG.repo){
    resultEl.innerHTML = `<div class="track-msg error">نظام تتبّع الطلبات غير مفعّل حالياً، تواصل معنا مباشرة عبر واتساب.</div>`;
    return;
  }

  resultEl.innerHTML = `<div class="track-msg loading"><span class="spinner"></span> جارٍ البحث...</div>`;

  try{
    const order = await GitHubAPI.findOrderByInvoice(ORDERS_CONFIG, invoiceNo);
    if (!order){
      resultEl.innerHTML = `<div class="track-msg error">لم يتم العثور على طلب بهذا الرقم. تأكد من كتابته بشكل صحيح.</div>`;
      return;
    }
    renderTrackResult(order);
  }catch(err){
    resultEl.innerHTML = `<div class="track-msg error">تعذّر البحث حالياً: ${err.message}</div>`;
  }
}

function renderTrackResult(order){
  const resultEl = document.getElementById("trackResult");
  const c = order.customer || {};
  const statusLabel = ORDER_STATUS_LABELS[order._labels?.find(l=>l!=="order")] || ORDER_STATUS_LABELS[order.status] || "🆕 طلب جديد";
  const dateStr = order.date ? new Date(order.date).toLocaleDateString("ar-IQ") : "";

  const itemsHTML = (order.items||[]).map(it=>{
    const thumb = it.image ? `<img src="${it.image}" alt="">` : getShoeIcon({icon:"sneaker"});
    let variant = "";
    if (it.pieces?.length > 1){
      variant = it.pieces.map((pc,i)=>`ق${i+1}: ${pc.size||""}${pc.color?" / "+pc.color:""}`).join(" | ");
    } else {
      const parts = [];
      if (it.size) parts.push(`مقاس ${it.size}`);
      if (it.color) parts.push(it.color);
      variant = parts.join(" / ");
    }
    return `<div class="track-item">
      <div class="track-item-thumb">${thumb}</div>
      <div class="track-item-body">
        <div class="track-item-name">${it.name}</div>
        <div class="track-item-meta">${variant} — الكمية: ${it.qty}</div>
      </div>
      <div class="track-item-price">${formatPrice(it.total)}</div>
    </div>`;
  }).join("");

  resultEl.innerHTML = `
    <div class="track-result-card">
      <div class="track-result-head">
        <span class="track-invoice-no">${order.invoiceNo}</span>
        <span class="track-status-badge">${statusLabel}</span>
      </div>
      <div class="track-result-date">تاريخ الطلب: ${dateStr}</div>
      <div class="track-result-section">
        <h4>بيانات التوصيل</h4>
        <p>
          ${c.name?`الاسم: ${c.name}<br>`:""}
          الهاتف: ${c.phone||""}<br>
          ${c.province?`المحافظة: ${c.province}${c.district?" - "+c.district:""}${c.subdistrict?" - "+c.subdistrict:""}<br>`:""}
          ${c.landmark?`أقرب نقطة: ${c.landmark}<br>`:""}
        </p>
      </div>
      <div class="track-result-section">
        <h4>المنتجات</h4>
        ${itemsHTML}
      </div>
      <div class="track-result-totals">
        <div><span>المجموع الفرعي</span><span>${formatPrice(order.subtotal)}</span></div>
        <div><span>أجور التوصيل</span><span>${formatPrice(order.deliveryFee)}</span></div>
        <div class="track-grand"><span>المجموع الكلي</span><span>${formatPrice(order.total)}</span></div>
      </div>
    </div>`;
}

function showInvoice(){
  const cart = getCart();
  const { name, phone, province, district, subdistrict, landmark } = readOrderFields();

  let subtotal = 0;
  const rows = cart.map(item=>{
    const p = PRODUCTS.find(x=>x.id===item.id);
    if (!p) return "";
    const images = getImages(p);
    const itemTotal = p.price * item.qty;
    subtotal += itemTotal;

    let variantText = "";
    if (item.qty > 1 && item.pieces?.length){
      variantText = item.pieces.map((pc,i)=>`ق${i+1}: ${pc.size||""} ${pc.color?'/ '+pc.color:""}`).join(" | ");
    } else {
      if (item.size) variantText += `مقاس: ${item.size}`;
      if (item.color) variantText += (variantText?" / ":"")+item.color;
    }

    const thumb = images.length
      ? `<img src="${images[0]}" alt="${p.name}" crossorigin="anonymous" style="width:46px;height:46px;object-fit:cover;border-radius:6px;">`
      : `<div style="width:46px;height:46px;background:var(--mist);border-radius:6px;display:flex;align-items:center;justify-content:center;">${(SHOE_ICONS[p.icon]||SHOE_ICONS.sneaker).replace('viewBox="0 0 200 120"','viewBox="0 0 200 120" width="36" height="36"')}</div>`;

    return `<tr>
      <td class="td-thumb">${thumb}</td>
      <td data-label="المنتج">${p.name}<br><span style="font-size:10px;color:var(--ink-soft);">${p.code || p.id}</span></td>
      <td data-label="التفاصيل" style="color:var(--ink-soft);font-size:11px;">${variantText}</td>
      <td data-label="الكمية">${item.qty}</td>
      <td data-label="السعر">${formatPrice(p.price)}</td>
      <td data-label="المجموع" style="font-weight:700;">${formatPrice(itemTotal)}</td>
    </tr>`;
  }).join("");

  const deliveryFee = (province && district) ? calcDeliveryFee(province, district) : 0;
  const grandTotal = subtotal + deliveryFee;

  const orderContent = document.getElementById("orderContent");
  const now = new Date();
  const dateStr = now.toLocaleDateString("ar-IQ");
  if (!CURRENT_INVOICE_NO) CURRENT_INVOICE_NO = generateInvoiceNo();

  orderContent.innerHTML = `
    <div class="invoice-wrap" id="invoiceContent">
      <div class="invoice-header">
        <div class="invoice-brand">
          <img src="logo.png" alt="خطوة" class="invoice-logo-img">
          <div style="font-size:12px;color:var(--ink-soft);margin-top:4px;">متجر أحذية وشحاطات رجالية</div>
        </div>
        <div class="invoice-meta">
          <b>فاتورة رقم ${CURRENT_INVOICE_NO}</b>
          ${dateStr}
        </div>
      </div>

      <table class="invoice-table">
        <thead>
          <tr>
            <th>صورة</th>
            <th>المنتج / الرمز</th>
            <th>التفاصيل</th>
            <th>الكمية</th>
            <th>السعر</th>
            <th>المجموع</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>

      <div class="invoice-total-row" style="border-top:none;padding-top:4px;">
        <span style="font-size:12px;color:var(--ink-soft);">المجموع الفرعي</span>
        <span style="font-size:13px;color:var(--ink-soft);">${formatPrice(subtotal)}</span>
      </div>
      <div class="invoice-total-row" style="border-top:none;padding-top:0;">
        <span style="font-size:12px;color:var(--ink-soft);">أجور التوصيل</span>
        <span style="font-size:13px;color:var(--ink-soft);">${formatPrice(deliveryFee)}</span>
      </div>
      <div class="invoice-total-row">
        <span class="invoice-total-label">المجموع الكلي</span>
        <span class="invoice-total-val">${formatPrice(grandTotal)}</span>
      </div>

      ${(name||phone||province) ? `<div class="invoice-customer">
        <h4>بيانات العميل</h4>
        <p>
          ${name?`الاسم: ${name}<br>`:""}
          ${phone?`الهاتف: ${phone}<br>`:""}
          ${province?`المحافظة: ${province}${district?" - "+district:""}${subdistrict?" - "+subdistrict:""}<br>`:""}
          ${landmark?`أقرب نقطة: ${landmark}<br>`:""}
        </p>
      </div>` : ""}
    </div>

    <div class="invoice-number-banner">
      🧾 احتفظ برقم الفاتورة هذا لمتابعة طلبك لاحقاً:
      <span class="invoice-number-big">${CURRENT_INVOICE_NO}</span>
    </div>
    <div class="order-save-status" id="orderSaveStatus"></div>

    <div class="order-modal-foot">
      <button class="btn ${SEND_METHOD==='messenger'?'btn-messenger':'btn-whatsapp'}" id="invoiceConfirmSendBtn" onclick="sendOrderWithInvoice()">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.5 14.4c-.3-.1-1.7-.8-2-.9-.3-.1-.5-.1-.6.1-.2.3-.7.9-.9 1.1-.2.2-.3.2-.6.1-1.6-.7-2.7-1.6-3.6-3.1-.1-.2-.1-.4.1-.6l.5-.6c.1-.2.1-.3 0-.5-.1-.2-.6-1.5-.8-2-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.2.2-.9.9-.9 2.2 0 1.3.9 2.5 1 2.7.1.2 1.8 2.8 4.5 3.9 2.7 1.1 2.7.7 3.2.7.5 0 1.6-.6 1.8-1.2.2-.6.2-1.1.1-1.2-.1-.1-.3-.2-.5-.3Z"/><path d="M12 2C6.5 2 2 6.5 2 12c0 1.8.5 3.6 1.4 5.1L2 22l5.1-1.3c1.4.8 3.1 1.2 4.9 1.2 5.5 0 10-4.5 10-10S17.5 2 12 2Zm0 18.2c-1.6 0-3.1-.4-4.4-1.2l-.3-.2-3 .8.8-2.9-.2-.3C4.2 15 3.8 13.5 3.8 12c0-4.5 3.7-8.2 8.2-8.2s8.2 3.7 8.2 8.2-3.7 8.2-8.2 8.2Z"/></svg>
        تأكيد وإرسال الطلب عبر ${SEND_METHOD==='messenger'?'ماسنجر':'واتساب'}
      </button>
      <div class="invoice-export-row">
        <button class="btn btn-outline" onclick="downloadInvoiceImage('png')">📷 صورة PNG</button>
        <button class="btn btn-outline" onclick="downloadInvoiceImage('jpg')">📷 صورة JPG</button>
        <button class="btn btn-outline" onclick="printInvoice()">🖨️ طباعة / PDF</button>
      </div>
    </div>`;

  document.getElementById("orderModalTitle").textContent = "الفاتورة";
}

/* تحويل الفاتورة إلى صورة وتنزيلها بصيغة PNG أو JPG
   ملاحظة مهمة: صور المنتجات قد تكون محمّلة من نطاق مختلف (مثل GitHub) لذلك
   نستخدم useCORS لتفادي تلوّث الـ canvas (tainted canvas) الذي كان يمنع تصدير
   الصورة بصمت ويُفشل إرسال الفاتورة عبر واتساب دون أي رسالة واضحة للمستخدم */
async function renderInvoiceCanvas(){
  const el = document.getElementById("invoiceContent");
  if (!el || typeof html2canvas === "undefined") return null;
  // نضمن أن كل صور الفاتورة تحمل crossOrigin قبل التصوير حتى لا تُلوّث الـ canvas
  el.querySelectorAll("img").forEach(img => {
    if (!img.crossOrigin) img.crossOrigin = "anonymous";
  });
  return await html2canvas(el, {
    scale: 2,
    backgroundColor: "#ffffff",
    useCORS: true,
    allowTaint: false,
    imageTimeout: 8000
  });
}

async function downloadInvoiceImage(type){
  try{
    const canvas = await renderInvoiceCanvas();
    if (!canvas) throw new Error("no-canvas");
    const mime = type === "jpg" ? "image/jpeg" : "image/png";
    const link = document.createElement("a");
    link.download = `فاتورة-خطوة.${type}`;
    link.href = canvas.toDataURL(mime, 0.95);
    link.click();
  }catch(err){
    alert("تعذّر إنشاء صورة الفاتورة كملف بسبب مصدر إحدى الصور. يمكنك استخدام خيار الطباعة / PDF بدلاً من ذلك.");
  }
}

function printInvoice(){
  let content = document.getElementById("invoiceContent")?.innerHTML;
  if (!content) return;
  // نافذة الطباعة تُفتح بصفحة فارغة (about:blank)، فالمسارات النسبية للصور
  // (مثل images/logo.png) لن تُحلّ بشكل صحيح إلا إذا حوّلناها لمسار مطلق أولاً
  const absoluteLogoUrl = new URL("logo.png", window.location.href).href;
  content = content.replace(/src="images\/logo\.png"/g, `src="${absoluteLogoUrl}"`);
  const win = window.open("","_blank");
  win.document.write(`<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<title>فاتورة خطوة</title>
<link href="https://fonts.googleapis.com/css2?family=Almarai:wght@400;700;800&family=Tajawal:wght@700;800;900&display=swap" rel="stylesheet">
<style>
:root{--ember:#ff4d1c;--mist:#f4f5f7;--line:#e7e8ea;--ink:#16181b;--ink-soft:#4a4f57;}
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:'Almarai',sans-serif;color:var(--ink);direction:rtl;padding:30px;}
.invoice-logo-img{height:42px;width:auto;display:block;}
.invoice-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:22px;padding-bottom:16px;border-bottom:2px solid var(--ink);}
.invoice-meta{text-align:left;font-size:12px;color:var(--ink-soft);}
.invoice-meta b{display:block;font-size:14px;color:var(--ink);}
table{width:100%;border-collapse:collapse;margin-bottom:16px;}
th{background:var(--mist);padding:8px 12px;font-family:'Tajawal',sans-serif;font-weight:800;font-size:12px;text-align:right;border-bottom:1px solid var(--line);}
td{padding:10px 12px;font-size:13px;border-bottom:1px solid var(--line);vertical-align:middle;}
.invoice-total-row{display:flex;justify-content:flex-end;padding:12px 0;border-top:2px solid var(--ink);gap:24px;}
.invoice-total-label{font-family:'Tajawal',sans-serif;font-weight:700;font-size:15px;}
.invoice-total-val{font-family:'Tajawal',sans-serif;font-weight:900;font-size:18px;color:var(--ember);}
.invoice-customer{background:var(--mist);border-radius:10px;padding:14px;margin-top:16px;}
.invoice-customer h4{font-family:'Tajawal',sans-serif;font-weight:800;font-size:13px;margin-bottom:8px;}
.invoice-customer p{font-size:12px;line-height:1.9;color:var(--ink-soft);}
@media print{body{padding:15px;}}
</style>
</head>
<body>${content}</body>
</html>`);
  win.document.close();
  win.focus();
  setTimeout(()=>win.print(), 600);
}

/* ================================================
   إعداد الأحداث
   ================================================ */
function setupEvents(){
  // السلة
  document.getElementById("cartBtn").addEventListener("click", openCart);
  document.getElementById("cartClose").addEventListener("click", closeCart);
  document.getElementById("cartOverlay").addEventListener("click", closeCart);
  document.getElementById("checkoutBtn").addEventListener("click", openOrderModal);

  // إغلاق نافذة الطلب
  document.getElementById("orderClose").addEventListener("click", closeOrderModal);
  document.getElementById("orderOverlay").addEventListener("click", (e)=>{ if(e.target===e.currentTarget) closeOrderModal(); });

  // تتبّع الطلب برقم الفاتورة
  document.getElementById("trackOrderLink")?.addEventListener("click", (e)=>{ e.preventDefault(); openTrackModal(); });
  document.getElementById("trackClose")?.addEventListener("click", closeTrackModal);
  document.getElementById("trackOverlay")?.addEventListener("click", (e)=>{ if(e.target===e.currentTarget) closeTrackModal(); });
  document.getElementById("trackInvoiceInput")?.addEventListener("keydown", (e)=>{ if(e.key==="Enter") searchOrderByInvoice(); });

  // إضافة للسلة
  document.body.addEventListener("click", (e)=>{
    // زر إضافة للسلة
    const addBtn = e.target.closest("[data-add]");
    if (addBtn){ handleAddToCart(e); return; }

    // فتح صفحة المنتج
    const qvBtn = e.target.closest("[data-quickview]");
    if (qvBtn){ openProductModal(qvBtn.dataset.quickview); return; }
  });

  // إغلاق نافذة المنتج
  document.getElementById("productModalClose").addEventListener("click", closeProductModal);
  document.getElementById("productModalOverlay").addEventListener("click", (e)=>{ if(e.target===e.currentTarget) closeProductModal(); });

  // معرض الصور
  document.getElementById("galleryPrev").addEventListener("click", ()=>{
    const p = PRODUCTS.find(x=>x.id===currentProductId);
    if (p) setGalleryImage(p, currentGalleryIdx-1);
  });
  document.getElementById("galleryNext").addEventListener("click", ()=>{
    const p = PRODUCTS.find(x=>x.id===currentProductId);
    if (p) setGalleryImage(p, currentGalleryIdx+1);
  });
  document.getElementById("galleryThumbs").addEventListener("click", (e)=>{
    const thumb = e.target.closest(".gallery-thumb");
    if (!thumb) return;
    const p = PRODUCTS.find(x=>x.id===currentProductId);
    if (p) setGalleryImage(p, parseInt(thumb.dataset.gi));
  });

  // فتح صندوق العرض الكامل للصورة عند الضغط على الصورة أو زر التكبير
  document.getElementById("galleryMain").addEventListener("click", (e)=>{
    if (e.target.closest("#galleryExpandBtn") || e.target.closest("#galleryDownloadBtn")) return; // تُعالَج بشكل مستقل أدناه
    const p = PRODUCTS.find(x=>x.id===currentProductId);
    if (!p) return;
    const images = getImages(p);
    if (images.length) Lightbox.open(images, currentGalleryIdx);
  });
  document.getElementById("galleryExpandBtn")?.addEventListener("click", (e)=>{
    e.stopPropagation();
    const p = PRODUCTS.find(x=>x.id===currentProductId);
    if (!p) return;
    const images = getImages(p);
    if (images.length) Lightbox.open(images, currentGalleryIdx);
  });
  document.getElementById("galleryDownloadBtn")?.addEventListener("click", (e)=>{
    e.stopPropagation();
    const p = PRODUCTS.find(x=>x.id===currentProductId);
    if (!p) return;
    const images = getImages(p);
    const url = images[currentGalleryIdx];
    if (!url) return;
    const ext = (url.split(".").pop()||"jpg").split("?")[0].slice(0,4);
    downloadImage(url, `${p.code||p.id}-${currentGalleryIdx+1}.${ext}`);
  });
  setupGallerySwipe();
  Lightbox.bindEvents();

  // ESC لإغلاق النوافذ
  document.addEventListener("keydown", (e)=>{
    if (e.key==="Escape"){
      closeProductModal();
      closeCart();
      closeOrderModal();
      closeTrackModal();
    }
  });

  // شريط الفلترة
  document.getElementById("sortSelect")?.addEventListener("change", applyFilters);
  document.getElementById("sizeFilter")?.addEventListener("change", applyFilters);

  // البحث
  document.getElementById("searchInput")?.addEventListener("input", applyFilters);

  // الهيدر عند التمرير
  const header = document.getElementById("siteHeader");
  window.addEventListener("scroll", ()=>header.classList.toggle("scrolled", window.scrollY>12), {passive:true});

  // القائمة الموبايل
  const burger = document.getElementById("burgerBtn");
  const nav = document.getElementById("mainNav");
  burger?.addEventListener("click", ()=>nav.classList.toggle("open"));
  nav?.querySelectorAll("a").forEach(a=>a.addEventListener("click", ()=>nav.classList.remove("open")));

  // واتساب
  setupWhatsappLinks();
}

function setupWhatsappLinks(){
  document.querySelectorAll("[data-wa-general]").forEach(el=>{
    const msg = encodeURIComponent("السلام عليكم، أحتاج مساعدة بخصوص منتجات متجر خطوة 👟");
    el.href = `https://wa.me/${waNumber()}?text=${msg}`;
    el.target = "_blank";
    el.rel = "noopener";
  });
  const fbLink = document.getElementById("floatMessengerLink");
  if (fbLink) fbLink.href = messengerLink();
}

/* ================================================
   روابط التواصل الاجتماعي (تُبنى من لوحة التحكم)
   ================================================ */
const SOCIAL_ICONS = {
  facebook: `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.3c-1.2 0-1.6.8-1.6 1.6V12h2.8l-.4 2.9h-2.4v7A10 10 0 0 0 22 12Z"/></svg>`,
  instagram: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1"/></svg>`,
  tiktok: `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M16.6 5.8c-.8-.8-1.3-1.9-1.3-3.1h-3v13.4c0 1.4-1.1 2.5-2.5 2.5s-2.5-1.1-2.5-2.5 1.1-2.5 2.5-2.5c.3 0 .5 0 .8.1v-3.1c-.3 0-.5-.1-.8-.1-3 0-5.5 2.5-5.5 5.6s2.5 5.6 5.5 5.6 5.5-2.5 5.5-5.6V9.2c1.2.9 2.7 1.4 4.3 1.4V7.6c-1.1 0-2.2-.4-3-1.1-.4-.3-.7-.6-1-1Z"/></svg>`,
  telegram: `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M21.5 4.5 2.7 11.9c-.9.4-.9 1.6.1 1.9l4.5 1.5 1.7 5.5c.3.9 1.5 1.1 2 .3l2.5-3.3 4.6 3.4c.7.5 1.7.1 1.9-.7l3.1-14.5c.2-1-.7-1.8-1.6-1.5ZM8.6 14l8.6-6.9c.3-.2.6.1.4.4l-7.1 7.6c-.3.3-.5.7-.5 1.1l-.2 2.6-1.2-3.8c-.1-.4-.3-.7-.7-.9Z"/></svg>`,
  custom: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M2 12h20M12 2c2.5 2.7 4 6.2 4 10s-1.5 7.3-4 10c-2.5-2.7-4-6.2-4-10s1.5-7.3 4-10Z"/></svg>`
};
function renderSocialIcons(){
  const wrap = document.getElementById("socialsRow");
  if (!wrap) return;
  const links = [];
  if (CONTACT.facebook) links.push({href:CONTACT.facebook, key:"facebook", label:"فيسبوك"});
  if (CONTACT.instagram) links.push({href:CONTACT.instagram, key:"instagram", label:"انستغرام"});
  if (CONTACT.tiktok) links.push({href:CONTACT.tiktok, key:"tiktok", label:"تيك توك"});
  if (CONTACT.telegram) links.push({href:CONTACT.telegram, key:"telegram", label:"تلغرام"});
  // روابط مخصّصة إضافية تُدار بالكامل من لوحة التحكم دون أي تعديل بالكود
  (CONTACT.links || []).forEach(l=>{
    if (l && l.href) links.push({href:l.href, key:"custom", label:l.label||"رابط"});
  });
  wrap.innerHTML = links.map(l=>
    `<a href="${l.href}" target="_blank" rel="noopener" aria-label="${l.label}">${SOCIAL_ICONS[l.key]||SOCIAL_ICONS.custom}</a>`
  ).join("");

  // رقم الهاتف في الفوتر (إن وُجد)
  const waLi = document.getElementById("footerWa");
  if (waLi && CONTACT.phone){
    const li = document.createElement("li");
    li.innerHTML = `<a href="tel:${CONTACT.phone}">هاتف: ${CONTACT.phone}</a>`;
    waLi.appendChild(li);
  }
}

/* ================================================
   Intersection Observer
   ================================================ */
function observeReveals(){
  const items = document.querySelectorAll(".reveal:not(.in)");
  const obs = new IntersectionObserver((entries)=>{
    entries.forEach(entry=>{
      if (entry.isIntersecting){ entry.target.classList.add("in"); obs.unobserve(entry.target); }
    });
  }, {threshold:0.12});
  items.forEach(it=>obs.observe(it));
}

/* ================================================
   تحميل المنتجات
   ================================================ */
async function loadProducts(){
  try{
    const res = await fetch(`${DATA_URL}?t=${Date.now()}`);
    const data = await res.json();
    PRODUCTS = (data.products || []).filter(p => p.visible !== false);
    CATEGORIES = data.categories || ["الكل"];
    if (data.contact) CONTACT = { ...CONTACT, ...data.contact };
  }catch(e){
    console.error("تعذّر تحميل المنتجات:", e);
    PRODUCTS = [];
  }
}

/* ================================================
   تهيئة
   ================================================ */
async function init(){
  await loadProducts();
  renderChips();
  populateSizeFilter();
  renderGrid("bestSellersGrid", PRODUCTS);
  setupEvents();
  updateCartBadge();
  observeReveals();
  renderSocialIcons();
}

document.addEventListener("DOMContentLoaded", init);
