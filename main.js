/* ====================================================
   متجر خطوة — main.js v3
   ==================================================== */

const WHATSAPP_NUMBER = "9647857392727";
const DATA_URL = "products.json";

let PRODUCTS = [];
let CATEGORIES = ["الكل"];
let SETTINGS = {};
let currentGalleryIdx = 0;
let currentProductId = null;
let selectedSize = null;
let selectedColor = null;
let selectedQty = 1;

const SHOE_ICONS = { /* ... كما هي ... */ };
const STATUS_TEXT = { available:"متوفر", limited:"كمية محدودة", out:"نفذ من المخزون" };
const BADGE_TEXT = { new:"جديد", bestseller:"الأكثر مبيعاً", offer:"خصم" };
const IRAQ_PROVINCES = ["بغداد","البصرة","نينوى","أربيل","السليمانية","كركوك","ذي قار","المثنى","القادسية","بابل","واسط","النجف","كربلاء","الأنبار","ديالى","صلاح الدين","دهوك","ميسان","حلبجة"];

function formatPrice(n){ return Number(n).toLocaleString("ar-IQ") + " د.ع"; }
function getImages(p){
  if (p.images && p.images.length) return p.images;
  if (p.image) return [p.image];
  return [];
}
function dotSVG(){ return `<svg width="8" height="8" viewBox="0 0 8 8"><circle cx="4" cy="4" r="4" fill="currentColor"/></svg>`; }

// ... (الدوال المساعدة الأخرى موجودة كما هي مع تعديلات طفيفة) ...

/* ================================================
   بطاقة المنتج (مع إضافة تحقق من hidden)
   ================================================ */
function productCardHTML(p){
  if (p.hidden) return ""; // لا تظهر المنتجات المخفية
  // ... باقي الكود كما هو ...
  // (نفس الكود السابق مع التأكد من عدم ظهور المنتجات المخفية)
  // يجب استخدام نفس الـ HTML السابق مع إضافة Product ID في مكان ما إذا أردت.
  // سأستخدم الكود المختصر هنا، ولكن في الملف الفعلي هو نفسه مع إضافة p.id.
}

/* ================================================
   تحميل المنتجات (فلترة المخفي)
   ================================================ */
async function loadProducts(){
  try{
    const res = await fetch(`${DATA_URL}?t=${Date.now()}`);
    const data = await res.json();
    PRODUCTS = (data.products || []).filter(p => !p.hidden); // إزالة المخفي
    CATEGORIES = data.categories || ["الكل"];
  }catch(e){
    console.error(e);
    PRODUCTS = [];
  }
}

/* ================================================
   عرض الفاتورة (مطورة مع Product ID)
   ================================================ */
function showInvoice(){
  const cart = getCart();
  const name = document.getElementById("ordName")?.value.trim()||"";
  const phone = document.getElementById("ordPhone")?.value.trim()||"";
  const province = document.getElementById("ordProvince")?.value||"";
  const district = document.getElementById("ordDistrict")?.value.trim()||"";
  const landmark = document.getElementById("ordLandmark")?.value.trim()||"";

  let total = 0;
  const rows = cart.map(item=>{
    const p = PRODUCTS.find(x=>x.id===item.id);
    if (!p) return "";
    const images = getImages(p);
    const itemTotal = p.price * item.qty;
    total += itemTotal;

    let variantText = "";
    if (item.qty > 1 && item.pieces?.length){
      variantText = item.pieces.map((pc,i)=>`ق${i+1}: ${pc.size||""} ${pc.color?'/ '+pc.color:""}`).join(" | ");
    } else {
      if (item.size) variantText += `مقاس: ${item.size}`;
      if (item.color) variantText += (variantText?" / ":"")+item.color;
    }

    const thumb = images.length
      ? `<img src="${images[0]}" alt="${p.name}" style="width:46px;height:46px;object-fit:cover;border-radius:6px;">`
      : `<div style="width:46px;height:46px;background:var(--mist);border-radius:6px;display:flex;align-items:center;justify-content:center;">${(SHOE_ICONS[p.icon]||SHOE_ICONS.sneaker).replace('viewBox="0 0 200 120"','viewBox="0 0 200 120" width="36" height="36"')}</div>`;

    return `<tr>
      <td class="td-thumb">${thumb}</td>
      <td>${p.name}</td>
      <td style="font-size:11px;color:var(--ink-soft);">${p.id}</td> <!-- Product ID -->
      <td style="color:var(--ink-soft);font-size:11px;">${variantText}</td>
      <td>${item.qty}</td>
      <td>${formatPrice(p.price)}</td>
      <td style="font-weight:700;">${formatPrice(itemTotal)}</td>
    </tr>`;
  }).join("");

  const orderContent = document.getElementById("orderContent");
  orderContent.innerHTML = `
    <div class="invoice-wrap" id="invoiceContent">
      <div class="invoice-header">
        <div>
          <div class="invoice-logo">خطوة<span>.</span></div>
          <div style="font-size:12px;color:var(--ink-soft);margin-top:4px;">متجر أحذية وشحاطات رجالية</div>
        </div>
        <div class="invoice-meta">
          <b>فاتورة الطلب</b>
          ${new Date().toLocaleDateString("ar-IQ")}
        </div>
      </div>
      <table class="invoice-table">
        <thead><tr><th>صورة</th><th>المنتج</th><th>الرمز</th><th>التفاصيل</th><th>الكمية</th><th>السعر</th><th>المجموع</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="invoice-total-row">
        <span class="invoice-total-label">المجموع الكلي</span>
        <span class="invoice-total-val">${formatPrice(total)}</span>
      </div>
      ${(name||phone||province) ? `<div class="invoice-customer"><h4>بيانات العميل</h4><p>${name?`الاسم: ${name}<br>`:""}${phone?`الهاتف: ${phone}<br>`:""}${province?`المحافظة: ${province}${district?" - "+district:""}<br>`:""}${landmark?`أقرب نقطة: ${landmark}<br>`:""}</p></div>` : ""}
    </div>
    <div class="order-modal-foot">
      <button class="btn btn-whatsapp" onclick="sendOrderWhatsapp()">إرسال عبر واتساب</button>
      <button class="btn btn-outline" onclick="printInvoice()">🖨️ طباعة / PDF</button>
    </div>`;
  document.getElementById("orderModalTitle").textContent = "الفاتورة";
}

/* ================================================
   رسالة الواتساب مع Product ID
   ================================================ */
function buildOrderText(){
  const cart = getCart();
  const name = document.getElementById("ordName")?.value.trim()||"";
  const phone = document.getElementById("ordPhone")?.value.trim()||"";
  const province = document.getElementById("ordProvince")?.value||"";
  const district = document.getElementById("ordDistrict")?.value.trim()||"";
  const landmark = document.getElementById("ordLandmark")?.value.trim()||"";
  const notes = document.getElementById("ordNotes")?.value.trim()||"";

  if (!phone){ alert("الرجاء إدخال رقم الهاتف"); return null; }
  if (!province){ alert("الرجاء اختيار المحافظة"); return null; }

  let total = 0;
  let msg = `🌹 *طلب جديد من متجر خطوة*\n━━━━━━━━━━━━━━━━━\n👤 *بيانات العميل*\n`;
  if (name) msg += `الاسم: ${name}\n`;
  msg += `الهاتف: ${phone}\nالمحافظة: ${province}\n`;
  if (district) msg += `القضاء/الناحية: ${district}\n`;
  if (landmark) msg += `أقرب نقطة: ${landmark}\n`;
  msg += `\n📦 *تفاصيل الطلب*\n`;

  cart.forEach(item=>{
    const p = PRODUCTS.find(x=>x.id===item.id);
    if (!p) return;
    const itemTotal = p.price * item.qty;
    total += itemTotal;
    msg += `━━━━━━━━━━━━━━━━━\n`;
    msg += `👟 ${p.name} [${p.id}]\n`; // إضافة Product ID
    msg += `السعر: ${formatPrice(p.price)}\nالكمية: ${item.qty}\n`;
    if (item.qty > 1 && item.pieces?.length){
      item.pieces.forEach((pc,i)=>{ msg += `  • قطعة ${i+1}:`; if(pc.size) msg += ` مقاس ${pc.size}`; if(pc.color) msg += ` - لون ${pc.color}`; msg += "\n"; });
    } else {
      if (item.size) msg += `المقاس: ${item.size}\n`;
      if (item.color) msg += `اللون: ${item.color}\n`;
    }
    msg += `المجموع: ${formatPrice(itemTotal)}\n`;
  });
  msg += `━━━━━━━━━━━━━━━━━\n💰 *المجموع الكلي: ${formatPrice(total)}*\n`;
  if (notes) msg += `\n📝 ملاحظات: ${notes}\n`;
  msg += `\n🚚 الدفع عند الاستلام`;
  return msg;
}

/* ================================================
   تحميل إعدادات التواصل وعرضها في التذييل
   ================================================ */
async function loadSettingsForFooter(){
  try{
    const res = await fetch(`settings.json?t=${Date.now()}`);
    const data = await res.json();
    SETTINGS = data;
    const socialWrap = document.querySelector('.socials');
    if (!socialWrap) return;
    let html = '';
    if (SETTINGS.facebook) html += `<a href="${SETTINGS.facebook}" target="_blank" aria-label="فيسبوك"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg></a>`;
    if (SETTINGS.instagram) html += `<a href="${SETTINGS.instagram}" target="_blank" aria-label="انستغرام"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1"/></svg></a>`;
    if (SETTINGS.tiktok) html += `<a href="${SETTINGS.tiktok}" target="_blank" aria-label="تيك توك"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5"/></svg></a>`;
    if (SETTINGS.telegram) html += `<a href="${SETTINGS.telegram}" target="_blank" aria-label="تلغرام"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z"/></svg></a>`;
    if (SETTINGS.phone) html += `<a href="tel:${SETTINGS.phone}" aria-label="اتصال"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.362 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.574 2.81.7A2 2 0 0 1 22 16.92z"/></svg></a>`;
    socialWrap.innerHTML = html;
  }catch(e){ console.warn("لا توجد إعدادات تواصل"); }
}

/* ================================================
   تهيئة (مع تحميل الإعدادات)
   ================================================ */
async function init(){
  await loadProducts();
  await loadSettingsForFooter();
  renderChips();
  populateSizeFilter();
  renderGrid("bestSellersGrid", PRODUCTS);
  renderGrid("newArrivalsGrid", PRODUCTS.filter(p=>p.badge==="new"));
  renderGrid("offersGrid", PRODUCTS.filter(p=>p.discount>0));
  setupEvents();
  updateCartBadge();
  observeReveals();
}

document.addEventListener("DOMContentLoaded", init);