/* ====================================================
   admin.js v2 — لوحة تحكم متجر خطوة
   ==================================================== */

const CFG_KEY = "khatwa_admin_cfg";
const DEFAULT_SIZES = [38,39,40,41,42,43,44,45,46];

let cfg = null;
let pendingImages = [];   // [{base64, ext}]
let currentColors = [];   // ["أسود","أبيض",...]
let customSizes = [];     // مقاسات مخصصة مضافة يدوياً
let adminProducts = [];   // قائمة المنتجات المحملة
let adminCategories = []; // الفئات بدون "الكل"

/* ---------- تنسيق الأسعار ---------- */
function formatAdminPrice(raw){
  const n = parseInt(String(raw).replace(/[,\s]/g,"")) || 0;
  return n ? n.toLocaleString("ar-IQ") : "";
}
function parseAdminPrice(val){
  return parseInt(String(val).replace(/[,\s]/g,"")) || 0;
}

/* ---------- توليد رمز منتج تلقائي (KH-0001, KH-0002, ...) ---------- */
function nextProductCode(products){
  let max = 0;
  (products||[]).forEach(p=>{
    const m = /^KH-(\d+)$/.exec(p.code||"");
    if (m) max = Math.max(max, parseInt(m[1],10));
  });
  return "KH-" + String(max+1).padStart(4,"0");
}

/* ---------- أدوات LocalStorage ---------- */
function loadCfg(){ try{ return JSON.parse(localStorage.getItem(CFG_KEY)); }catch(e){ return null; } }
function saveCfg(c){ localStorage.setItem(CFG_KEY, JSON.stringify(c)); }
function wipeCfg(){ localStorage.removeItem(CFG_KEY); }

/* ---------- تنبيهات ---------- */
function showAlert(id, msg){
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.classList.add("show");
  if (id==="globalSuccess"||id==="globalError"){
    setTimeout(()=>el.classList.remove("show"), 5000);
  }
}
function hideAlert(id){ document.getElementById(id)?.classList.remove("show"); }

/* ====================================================
   شاشات القفل
   ==================================================== */
function boot(){
  cfg = loadCfg();
  if (!cfg){
    document.getElementById("setupScreen").style.display = "block";
  } else {
    document.getElementById("pinScreen").style.display = "block";
  }
}

document.getElementById("setupForm").addEventListener("submit", async (e)=>{
  e.preventDefault();
  hideAlert("setupError");
  const btn = document.getElementById("setupSubmit");
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner"></span> جارٍ التحقق...`;

  const candidate = {
    owner: document.getElementById("cfgOwner").value.trim(),
    repo: document.getElementById("cfgRepo").value.trim(),
    branch: document.getElementById("cfgBranch").value.trim()||"main",
    token: document.getElementById("cfgToken").value.trim(),
    pin: document.getElementById("cfgPin").value.trim()
  };

  try{
    await GitHubAPI.verifyAccess(candidate);
    saveCfg(candidate);
    cfg = candidate;
    document.getElementById("setupScreen").style.display = "none";
    unlockDashboard();
  }catch(err){
    showAlert("setupError","تعذّر التحقق: "+err.message+" — تأكد من اسم الريبو والتوكن.");
  }finally{
    btn.disabled = false;
    btn.textContent = "التحقق وحفظ الإعدادات";
  }
});

document.getElementById("pinForm").addEventListener("submit", (e)=>{
  e.preventDefault();
  hideAlert("pinError");
  const entered = document.getElementById("pinInput").value.trim();
  if (entered===cfg.pin){
    document.getElementById("pinScreen").style.display = "none";
    unlockDashboard();
  } else {
    showAlert("pinError","الرمز غير صحيح.");
  }
});

document.getElementById("forgotLink").addEventListener("click", (e)=>{
  e.preventDefault();
  if (confirm("هذا سيمسح إعدادات GitHub والرمز من هذا المتصفح. متابعة؟")){
    wipeCfg(); location.reload();
  }
});

document.getElementById("wipeDeviceBtn").addEventListener("click", ()=>{
  if (confirm("سيتم مسح إعدادات هذا الجهاز فقط. متابعة؟")){
    wipeCfg(); location.reload();
  }
});

document.getElementById("logoutBtn").addEventListener("click", ()=>location.reload());

function unlockDashboard(){
  document.getElementById("logoutBtn").style.display = "inline-flex";
  document.getElementById("dashboard").classList.add("show");
  renderSizeChecks();
  loadProductsList();
  loadAdminCategories();
}

/* ====================================================
   التبويبات
   ==================================================== */
document.querySelectorAll(".tab-btn").forEach(btn=>{
  btn.addEventListener("click", ()=>{
    document.querySelectorAll(".tab-btn").forEach(b=>b.classList.remove("active"));
    document.querySelectorAll(".panel").forEach(p=>p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(btn.dataset.tab).classList.add("active");
    if (btn.dataset.tab==="listPanel") loadProductsList();
    if (btn.dataset.tab==="ordersPanel") loadOrdersList();
    if (btn.dataset.tab==="customersPanel") loadCustomersList();
    if (btn.dataset.tab==="catsPanel") renderAdminCategories();
    if (btn.dataset.tab==="contactPanel") loadContactInfo();
    if (btn.dataset.tab==="dbPanel") checkOrdersDbStatus();
  });
});

/* ====================================================
   الصور المتعددة
   ==================================================== */
document.getElementById("imageInput").addEventListener("change", (e)=>{
  const files = Array.from(e.target.files).slice(0, 10 - pendingImages.length);
  let loaded = 0;
  files.forEach(file=>{
    const ext = (file.name.split(".").pop()||"jpg").toLowerCase();
    const reader = new FileReader();
    reader.onload = ()=>{
      const b64 = reader.result.split(",")[1];
      pendingImages.push({base64:b64, ext, dataUrl:reader.result});
      loaded++;
      if (loaded===files.length) renderImagePreviews();
    };
    reader.readAsDataURL(file);
  });
  e.target.value = "";
});

function renderImagePreviews(){
  const wrap = document.getElementById("multiImagesPreview");
  wrap.innerHTML = pendingImages.map((img,i)=>{
    const src = img.dataUrl||img.url||"";
    return `
    <div class="multi-img-item">
      <img src="${src}" alt="">
      <span class="multi-img-del" onclick="removeImage(${i})">✕</span>
      ${src?`<span class="multi-img-download" onclick="downloadAdminImage(${i})" title="تحميل الصورة">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M12 3v12m0 0 4-4m-4 4-4-4M4 19h16"/></svg>
      </span>`:""}
    </div>`;
  }).join("");
}

function downloadAdminImage(idx){
  const img = pendingImages[idx];
  if (!img) return;
  const src = img.dataUrl || img.url || "";
  if (!src) return;
  const ext = (img.ext || "jpg").split("?")[0];
  downloadImage(src, `صورة-${idx+1}.${ext}`);
}

/* تحميل صورة على الجهاز — يجلب الصورة كـ blob لضمان نزولها كملف
   (يدعم أيضاً روابط data: المُولّدة من معاينة الصور قبل الرفع) */
async function downloadImage(url, filename){
  if (!url) return;
  try{
    const res = await fetch(url);
    if (!res.ok) throw new Error("fetch failed");
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = filename || "صورة.jpg";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(()=>URL.revokeObjectURL(blobUrl), 4000);
  }catch(err){
    window.open(url, "_blank");
  }
}

function removeImage(idx){
  pendingImages.splice(idx,1);
  renderImagePreviews();
}

/* ====================================================
   المقاسات
   ==================================================== */
function renderSizeChecks(){
  const wrap = document.getElementById("sizeChecks");
  const allSizes = [...new Set([...DEFAULT_SIZES,...customSizes])].sort((a,b)=>a-b);
  wrap.innerHTML = allSizes.map(s=>
    `<label><input type="checkbox" value="${s}" class="size-box"> ${s}</label>`
  ).join("");
}

function addCustomSize(){
  const input = document.getElementById("newSizeInput");
  const val = parseInt(input.value);
  if (!val || val<20||val>60){ alert("أدخل مقاساً صحيحاً"); return; }
  if (!customSizes.includes(val)&&!DEFAULT_SIZES.includes(val)){
    customSizes.push(val);
    renderSizeChecks();
  }
  input.value = "";
}

/* ====================================================
   الألوان الديناميكية
   ==================================================== */
function renderColorTags(){
  const wrap = document.getElementById("colorTags");
  wrap.innerHTML = currentColors.map((c,i)=>`
    <div class="dynamic-tag">${c} <span class="remove-tag" onclick="removeColor(${i})">✕</span></div>`).join("");
}

function addColor(){
  const input = document.getElementById("newColorInput");
  const vals = input.value.split(/[,،]/).map(v=>v.trim()).filter(Boolean);
  vals.forEach(v=>{ if (!currentColors.includes(v)) currentColors.push(v); });
  input.value = "";
  renderColorTags();
}

document.getElementById("newColorInput")?.addEventListener("keydown", (e)=>{
  if (e.key==="Enter"){ e.preventDefault(); addColor(); }
});

function removeColor(idx){
  currentColors.splice(idx,1);
  renderColorTags();
}

/* ====================================================
   إدارة الفئات
   ==================================================== */
async function loadAdminCategories(){
  try{
    const file = await GitHubAPI.getTextFile(cfg, "products.json");
    const data = JSON.parse(file.content||'{"categories":[]}');
    adminCategories = (data.categories||["الكل"]).filter(c=>c!=="الكل");
    renderAdminCategories();
    populateCategorySelect();
  }catch(err){
    console.error("تعذّر تحميل الفئات:", err);
  }
}

function renderAdminCategories(){
  const wrap = document.getElementById("adminCatTags");
  if (!wrap) return;
  wrap.innerHTML = adminCategories.map((c,i)=>`
    <div class="dynamic-tag">${c} <span class="remove-tag" onclick="removeCategory(${i})">✕</span></div>`).join("");
}

function addCategory(){
  const input = document.getElementById("newCatInput");
  const val = input.value.trim();
  if (!val) return;
  if (!adminCategories.includes(val)) adminCategories.push(val);
  input.value = "";
  renderAdminCategories();
  populateCategorySelect();
}

document.getElementById("newCatInput")?.addEventListener("keydown", (e)=>{
  if (e.key==="Enter"){ e.preventDefault(); addCategory(); }
});

function removeCategory(idx){
  adminCategories.splice(idx,1);
  renderAdminCategories();
  populateCategorySelect();
}

async function saveCategoriesBtn(){
  try{
    const file = await GitHubAPI.getTextFile(cfg, "products.json");
    const data = JSON.parse(file.content||'{"categories":[],"products":[]}');
    data.categories = ["الكل", ...adminCategories];
    await GitHubAPI.putTextFile(cfg, "products.json", JSON.stringify(data,null,2), "تحديث الفئات", file.sha);
    showAlert("globalSuccess","تم حفظ الفئات ✓");
  }catch(err){
    showAlert("globalError","تعذّر حفظ الفئات: "+err.message);
  }
}

function populateCategorySelect(){
  const sel = document.getElementById("fCategory");
  if (!sel) return;
  sel.innerHTML = `<option value="">اختر الفئة</option>` +
    adminCategories.map(c=>`<option value="${c}">${c}</option>`).join("");
}

/* ====================================================
   معلومات التواصل
   ==================================================== */
let customContactLinks = [];

async function loadContactInfo(){
  const wrap = document.getElementById("contactPanel");
  try{
    const file = await GitHubAPI.getTextFile(cfg, "products.json");
    const data = JSON.parse(file.content||'{}');
    const c = data.contact || {};
    document.getElementById("ctWhatsapp").value = c.whatsapp || "";
    document.getElementById("ctMessenger").value = c.messenger || "";
    document.getElementById("ctPhone").value = c.phone || "";
    document.getElementById("ctFacebook").value = c.facebook || "";
    document.getElementById("ctInstagram").value = c.instagram || "";
    document.getElementById("ctTiktok").value = c.tiktok || "";
    document.getElementById("ctTelegram").value = c.telegram || "";
    customContactLinks = Array.isArray(c.links) ? c.links : [];
    renderCustomLinks();
  }catch(err){
    showAlert("globalError","تعذّر تحميل معلومات التواصل: "+err.message);
  }
}

function renderCustomLinks(){
  const wrap = document.getElementById("customLinksList");
  if (!wrap) return;
  if (!customContactLinks.length){
    wrap.innerHTML = `<p style="font-size:12px;color:var(--ink-soft);">لا توجد روابط إضافية بعد.</p>`;
    return;
  }
  wrap.innerHTML = customContactLinks.map((l,i)=>`
    <div class="custom-link-row">
      <span>${l.label}</span>
      <a href="${l.href}" target="_blank" style="font-size:11px;color:var(--ink-soft);">${l.href}</a>
      <button type="button" class="btn btn-outline btn-sm" onclick="removeCustomLink(${i})">حذف</button>
    </div>`).join("");
}

function addCustomLink(){
  const labelEl = document.getElementById("newLinkLabel");
  const hrefEl = document.getElementById("newLinkHref");
  const label = labelEl.value.trim();
  const href = hrefEl.value.trim();
  if (!label || !href){ alert("الرجاء تعبئة اسم المنصة والرابط"); return; }
  customContactLinks.push({ label, href });
  labelEl.value = ""; hrefEl.value = "";
  renderCustomLinks();
}

function removeCustomLink(i){
  customContactLinks.splice(i,1);
  renderCustomLinks();
}

async function saveContactInfo(){
  const btn = document.getElementById("saveContactBtn");
  const originalLabel = btn.textContent;
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner"></span> جارٍ الحفظ...`;
  try{
    const file = await GitHubAPI.getTextFile(cfg, "products.json");
    const data = JSON.parse(file.content||'{"categories":[],"products":[]}');
    data.contact = {
      whatsapp: document.getElementById("ctWhatsapp").value.trim(),
      messenger: document.getElementById("ctMessenger").value.trim(),
      phone: document.getElementById("ctPhone").value.trim(),
      facebook: document.getElementById("ctFacebook").value.trim(),
      instagram: document.getElementById("ctInstagram").value.trim(),
      tiktok: document.getElementById("ctTiktok").value.trim(),
      telegram: document.getElementById("ctTelegram").value.trim(),
      links: customContactLinks
    };
    await GitHubAPI.putTextFile(cfg, "products.json", JSON.stringify(data,null,2), "تحديث معلومات التواصل", file.sha);
    showAlert("globalSuccess","تم حفظ معلومات التواصل ✓");
  }catch(err){
    showAlert("globalError","تعذّر الحفظ: "+err.message);
  }finally{
    btn.disabled = false;
    btn.textContent = originalLabel;
  }
}

/* ====================================================
   تنسيق الأسعار تلقائياً
   ==================================================== */
["fPrice","fOldPrice"].forEach(id=>{
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener("input", ()=>{
    const raw = el.value.replace(/[,\s]/g,"");
    const n = parseInt(raw)||0;
    const hintId = id+"Hint";
    const hint = document.getElementById(hintId);
    if (hint && n) hint.textContent = n.toLocaleString("ar-IQ") + " د.ع";
    else if (hint) hint.textContent = "";
  });
});

/* ====================================================
   نموذج المنتج
   ==================================================== */
function resetForm(){
  document.getElementById("productForm").reset();
  document.getElementById("editingId").value = "";
  document.getElementById("formTitle").textContent = "إضافة منتج جديد";
  document.getElementById("submitBtn").textContent = "حفظ ونشر على الموقع";
  document.getElementById("cancelEditBtn").style.display = "none";
  pendingImages = [];
  currentColors = [];
  customSizes = [];
  renderImagePreviews();
  renderColorTags();
  renderSizeChecks();
  document.getElementById("fPriceHint").textContent = "";
  document.getElementById("fOldPriceHint").textContent = "";
}

document.getElementById("cancelEditBtn").addEventListener("click", resetForm);

function fillFormForEdit(p){
  document.getElementById("editingId").value = p.id;
  document.getElementById("formTitle").textContent = `تعديل: ${p.name} (${p.code||p.id})`;
  document.getElementById("submitBtn").textContent = "حفظ التعديلات";
  document.getElementById("cancelEditBtn").style.display = "inline-flex";

  document.getElementById("fName").value = p.name||"";
  document.getElementById("fStatus").value = p.status||"available";
  document.getElementById("fBadge").value = p.badge||"";
  document.getElementById("fDescription").value = p.description||"";
  document.getElementById("fDiscount").value = p.discount||0;

  // الأسعار
  const priceEl = document.getElementById("fPrice");
  const oldPriceEl = document.getElementById("fOldPrice");
  priceEl.value = p.price||"";
  oldPriceEl.value = p.oldPrice||"";
  if (p.price) document.getElementById("fPriceHint").textContent = Number(p.price).toLocaleString("ar-IQ")+" د.ع";
  if (p.oldPrice) document.getElementById("fOldPriceHint").textContent = Number(p.oldPrice).toLocaleString("ar-IQ")+" د.ع";

  // الفئة
  setTimeout(()=>{
    document.getElementById("fCategory").value = p.category||"";
  }, 100);

  // المقاسات
  customSizes = (p.sizes||[]).filter(s=>!DEFAULT_SIZES.includes(s));
  renderSizeChecks();
  setTimeout(()=>{
    document.querySelectorAll(".size-box").forEach(cb=>{
      cb.checked = (p.sizes||[]).map(Number).includes(Number(cb.value));
    });
  }, 50);

  // الألوان
  currentColors = [...(p.colors||[])];
  renderColorTags();

  // الصور
  const images = p.images?.length ? p.images : (p.image ? [p.image] : []);
  pendingImages = images.map(url=>({dataUrl:url, url, base64:null, ext:"jpg"}));
  renderImagePreviews();

  window.scrollTo({top:0, behavior:"smooth"});
  document.querySelector('.tab-btn[data-tab="addPanel"]').click();
}

document.getElementById("productForm").addEventListener("submit", async (e)=>{
  e.preventDefault();
  hideAlert("globalError");
  const submitBtn = document.getElementById("submitBtn");
  const originalLabel = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.innerHTML = `<span class="spinner"></span> جارٍ النشر...`;

  try{
    const editingId = document.getElementById("editingId").value;
    const sizes = Array.from(document.querySelectorAll(".size-box:checked")).map(cb=>Number(cb.value));

    if (sizes.length===0) throw new Error("اختر مقاس واحد على الأقل");

    const file = await GitHubAPI.getTextFile(cfg, "products.json");
    if (!file.content) throw new Error("لم يتم العثور على products.json");
    const data = JSON.parse(file.content);

    const id = editingId || ("p" + Date.now());
    const existingProduct = editingId ? data.products.find(p=>p.id===editingId) : null;

    // رفع الصور الجديدة
    const uploadedImages = [];

    // الصور الموجودة مسبقاً (من التعديل)
    for (const img of pendingImages){
      if (img.base64){
        // صورة جديدة تحتاج رفع
        const imgPath = `images/${id}_${Date.now()}_${uploadedImages.length}.${img.ext}`;
        await GitHubAPI.putBinaryFile(cfg, imgPath, img.base64, `رفع صورة ${id}`);
        uploadedImages.push(imgPath);
      } else if (img.url){
        // صورة موجودة مسبقاً
        uploadedImages.push(img.url);
      }
    }

    const productObj = {
      id,
      code: existingProduct?.code || nextProductCode(data.products),
      name: document.getElementById("fName").value.trim(),
      category: document.getElementById("fCategory").value,
      icon: "sneaker",
      image: uploadedImages[0]||"",
      images: uploadedImages,
      price: parseAdminPrice(document.getElementById("fPrice").value),
      oldPrice: document.getElementById("fOldPrice").value ? parseAdminPrice(document.getElementById("fOldPrice").value) : null,
      discount: Number(document.getElementById("fDiscount").value)||0,
      sizes,
      colors: currentColors,
      status: document.getElementById("fStatus").value,
      badge: document.getElementById("fBadge").value||null,
      visible: existingProduct ? (existingProduct.visible !== false) : true,
      description: document.getElementById("fDescription").value.trim(),
      rating: existingProduct?.rating || 4.5
    };

    if (editingId){
      const idx = data.products.findIndex(p=>p.id===editingId);
      if (idx>-1) data.products[idx] = productObj;
      else data.products.push(productObj);
    } else {
      data.products.push(productObj);
    }

    await GitHubAPI.putTextFile(
      cfg, "products.json",
      JSON.stringify(data,null,2),
      editingId ? `تعديل منتج: ${productObj.name}` : `إضافة منتج: ${productObj.name}`,
      file.sha
    );

    showAlert("globalSuccess", editingId ? "تم حفظ التعديلات ✓" : "تم نشر المنتج ✓ (قد يستغرق ظهوره دقيقة)");
    resetForm();
    loadProductsList();

  }catch(err){
    showAlert("globalError","حدث خطأ: "+err.message);
  }finally{
    submitBtn.disabled = false;
    submitBtn.textContent = originalLabel;
  }
});

/* ====================================================
   قائمة المنتجات
   ==================================================== */
async function loadProductsList(){
  const wrap = document.getElementById("productsList");
  if (!wrap) return;
  wrap.innerHTML = `<div class="empty-state">جارِ التحميل...</div>`;
  try{
    const file = await GitHubAPI.getTextFile(cfg, "products.json");
    const data = JSON.parse(file.content||'{"products":[]}');
    adminProducts = data.products||[];
    renderProductsList(adminProducts);

    // بحث إداري
    const searchEl = document.getElementById("adminSearch");
    if (searchEl){
      searchEl.addEventListener("input", ()=>{
        const q = searchEl.value.trim().toLowerCase();
        const filtered = q ? adminProducts.filter(p=>
          p.name.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          (p.code||"").toLowerCase().includes(q) ||
          (p.id||"").toLowerCase().includes(q)
        ) : adminProducts;
        renderProductsList(filtered);
      });
    }

  }catch(err){
    wrap.innerHTML = `<div class="empty-state">تعذّر التحميل: ${err.message}</div>`;
  }
}

function renderProductsList(products){
  const wrap = document.getElementById("productsList");
  if (!products.length){
    wrap.innerHTML = `<div class="empty-state">لا توجد منتجات.</div>`;
    return;
  }
  wrap.innerHTML = products.map(p=>{
    const images = p.images?.length ? p.images : (p.image ? [p.image] : []);
    const thumb = images.length ? `<img src="${images[0]}" alt="">` : "👟";
    const statusText = p.status==="available"?"✅ متوفر":p.status==="limited"?"⚠️ محدود":"❌ نفذ";
    const isHidden = p.visible === false;
    return `
    <div class="admin-product ${isHidden?"is-hidden":""}">
      <div class="thumb">${thumb}</div>
      <div class="info">
        <b>${p.name}</b> <span class="product-code-tag">${p.code||p.id}</span>${isHidden?`<span class="hidden-tag">مخفي</span>`:""}
        <span>${p.category} · ${Number(p.price).toLocaleString("ar-IQ")} د.ع · ${statusText}</span>
        ${images.length>1?`<span style="font-size:11px;color:var(--ember);">${images.length} صور</span>`:""}
      </div>
      <div class="actions">
        <button class="icon-action ${isHidden?"":"active-toggle"}" data-toggle="${p.id}" aria-label="${isHidden?"إظهار":"إخفاء"}">
          ${isHidden
            ? `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z"/><circle cx="12" cy="12" r="3"/></svg>`
            : `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`}
        </button>
        ${images.length?`<button class="icon-action" data-download="${p.id}" aria-label="تحميل الصورة">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v12m0 0 4-4m-4 4-4-4M4 19h16"/></svg>
        </button>`:""}
        <button class="icon-action" data-edit="${p.id}" aria-label="تعديل">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
        </button>
        <button class="icon-action danger" data-delete="${p.id}" aria-label="حذف">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6"/></svg>
        </button>
      </div>
    </div>`;
  }).join("");

  wrap.querySelectorAll("[data-edit]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const p = adminProducts.find(x=>x.id===btn.dataset.edit);
      if (p) fillFormForEdit(p);
    });
  });
  wrap.querySelectorAll("[data-delete]").forEach(btn=>{
    btn.addEventListener("click", ()=>deleteProduct(btn.dataset.delete));
  });
  wrap.querySelectorAll("[data-toggle]").forEach(btn=>{
    btn.addEventListener("click", ()=>toggleProductVisibility(btn.dataset.toggle));
  });
  wrap.querySelectorAll("[data-download]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const p = adminProducts.find(x=>x.id===btn.dataset.download);
      if (!p) return;
      const images = p.images?.length ? p.images : (p.image ? [p.image] : []);
      if (!images.length) return;
      const ext = (images[0].split(".").pop()||"jpg").split("?")[0].slice(0,4);
      downloadImage(images[0], `${p.code||p.id}.${ext}`);
    });
  });

  renderAdminStats();
}

/* إخفاء/إظهار منتج دون حذف بياناته */
async function toggleProductVisibility(id){
  try{
    const file = await GitHubAPI.getTextFile(cfg, "products.json");
    const data = JSON.parse(file.content);
    const product = data.products.find(p=>p.id===id);
    if (!product) return;
    product.visible = product.visible === false ? true : false;
    await GitHubAPI.putTextFile(
      cfg, "products.json", JSON.stringify(data,null,2),
      `${product.visible?"إظهار":"إخفاء"} منتج: ${product.name}`, file.sha
    );
    showAlert("globalSuccess", product.visible ? "تم إظهار المنتج ✓" : "تم إخفاء المنتج عن الموقع ✓");
    loadProductsList();
  }catch(err){
    showAlert("globalError","تعذّر تحديث حالة الظهور: "+err.message);
  }
}

/* ====================================================
   الإحصائيات السريعة
   ==================================================== */
function renderAdminStats(){
  const wrap = document.getElementById("adminStats");
  if (!wrap) return;
  const total = adminProducts.length;
  const available = adminProducts.filter(p=>p.status==="available").length;
  const limited = adminProducts.filter(p=>p.status==="limited").length;
  const out = adminProducts.filter(p=>p.status==="out").length;
  const hidden = adminProducts.filter(p=>p.visible===false).length;

  wrap.innerHTML = `
    <div class="admin-stat-card"><b>${total}</b><span>إجمالي المنتجات</span></div>
    <div class="admin-stat-card"><b>${available}</b><span>متوفر</span></div>
    <div class="admin-stat-card warn"><b>${limited}</b><span>كمية محدودة</span></div>
    <div class="admin-stat-card danger"><b>${out}</b><span>نفذ من المخزون</span></div>
    <div class="admin-stat-card"><b>${hidden}</b><span>منتج مخفي</span></div>
  `;
}

async function deleteProduct(id){
  if (!confirm("حذف هذا المنتج نهائياً؟")) return;
  try{
    const file = await GitHubAPI.getTextFile(cfg, "products.json");
    const data = JSON.parse(file.content);
    const product = data.products.find(p=>p.id===id);
    data.products = data.products.filter(p=>p.id!==id);
    await GitHubAPI.putTextFile(cfg,"products.json",JSON.stringify(data,null,2),`حذف: ${product?.name||id}`,file.sha);
    showAlert("globalSuccess","تم الحذف ✓");
    loadProductsList();
  }catch(err){
    showAlert("globalError","تعذّر الحذف: "+err.message);
  }
}


/* ====================================================
   إدارة الطلبات — النسخة الجديدة (GitHub Issues API)
   ----------------------------------------------------
   لا حاجة لأي نسخ/لصق يدوي بعد الآن. الطلبات تصل وتُحفظ
   تلقائياً من الموقع العام، وهذه اللوحة فقط تعرضها وتديرها.
   ==================================================== */
let adminOrders = [];
let currentOrdersFilter = "all";

function ordersDbReady(){
  return typeof ORDERS_CONFIG !== "undefined" && ORDERS_CONFIG.repo && ORDERS_CONFIG.owner;
}

async function loadOrdersList(){
  const wrap = document.getElementById("ordersList");
  const notice = document.getElementById("dbNotConfiguredNotice");
  if (!wrap) return;

  if (!ordersDbReady()){
    if (notice) notice.style.display = "block";
    wrap.innerHTML = "";
    return;
  }
  if (notice) notice.style.display = "none";

  wrap.innerHTML = `<div class="empty-state">جارِ التحميل...</div>`;
  try{
    adminOrders = await GitHubAPI.listOrderIssues(ORDERS_CONFIG, "all");
    renderOrdersList(filterOrdersForDisplay());
    renderAdminStats();
  }catch(err){
    wrap.innerHTML = `<div class="empty-state">تعذّر التحميل: ${err.message}</div>`;
  }
}

function filterOrdersForDisplay(){
  const q = (document.getElementById("ordersSearchInput")?.value || "").trim().toLowerCase();
  let list = [...adminOrders];

  if (currentOrdersFilter !== "all"){
    list = list.filter(o => (o._labels||[]).includes(currentOrdersFilter));
  }
  if (q){
    list = list.filter(o =>
      (o.invoiceNo||"").toLowerCase().includes(q) ||
      (o.customer?.name||"").toLowerCase().includes(q) ||
      (o.customer?.phone||"").includes(q)
    );
  }
  return list;
}

document.getElementById("ordersSearchInput")?.addEventListener("input", ()=>{
  renderOrdersList(filterOrdersForDisplay());
});
document.getElementById("ordersStatusFilter")?.addEventListener("click", (e)=>{
  const btn = e.target.closest(".chip");
  if (!btn) return;
  document.querySelectorAll("#ordersStatusFilter .chip").forEach(c=>c.classList.remove("active"));
  btn.classList.add("active");
  currentOrdersFilter = btn.dataset.status;
  renderOrdersList(filterOrdersForDisplay());
});

const ADMIN_STATUS_LABELS = {
  "new-order": "🆕 جديد",
  "confirmed": "📞 مؤكَّد",
  "processing": "📦 قيد التجهيز",
  "shipped": "🚚 بالطريق",
  "done": "✅ مُسلَّم",
  "cancelled": "❌ ملغي"
};
const STATUS_FLOW = ["new-order","confirmed","processing","shipped","done"];

function currentOrderStatus(o){
  return (o._labels||[]).find(l => l!=="order") || "new-order";
}

function renderOrdersList(orders){
  const wrap = document.getElementById("ordersList");
  if (!orders.length){
    wrap.innerHTML = `<div class="empty-state">لا توجد طلبات مطابقة.</div>`;
    return;
  }

  wrap.innerHTML = orders.map(o=>{
    const c = o.customer || {};
    const dateStr = o.date ? new Date(o.date).toLocaleString("ar-IQ") : "";
    const status = currentOrderStatus(o);
    const statusLabel = ADMIN_STATUS_LABELS[status] || "🆕 جديد";

    const itemsHTML = (o.items||[]).map(it=>{
      const thumb = it.image ? `<img src="${it.image}" alt="" style="width:40px;height:40px;object-fit:cover;border-radius:6px;">` : `<div style="width:40px;height:40px;background:var(--mist);border-radius:6px;display:flex;align-items:center;justify-content:center;">👟</div>`;
      let variant = "";
      if (it.pieces?.length > 1){
        variant = it.pieces.map((pc,i)=>`ق${i+1}: ${pc.size||""}${pc.color?" / "+pc.color:""}`).join(" | ");
      } else {
        const parts = [];
        if (it.size) parts.push(`مقاس ${it.size}`);
        if (it.color) parts.push(it.color);
        variant = parts.join(" / ");
      }
      return `<div style="display:flex;gap:10px;align-items:center;padding:8px 0;border-bottom:1px solid var(--line);">
        ${thumb}
        <div style="flex:1;">
          <div style="font-weight:700;font-size:13px;">${it.name} <span style="color:var(--ink-soft);font-weight:400;">(${it.code})</span></div>
          <div style="font-size:11px;color:var(--ink-soft);">${variant} — الكمية: ${it.qty}</div>
        </div>
        <div style="font-weight:700;font-size:13px;">${formatAdminPrice(it.total)} د.ع</div>
      </div>`;
    }).join("");

    const nextStatusIdx = STATUS_FLOW.indexOf(status);
    const nextStatus = nextStatusIdx>-1 && nextStatusIdx < STATUS_FLOW.length-1 ? STATUS_FLOW[nextStatusIdx+1] : null;

    return `
    <div class="card order-card" style="margin-bottom:14px;border:2px solid ${status==='done'?'var(--line)':status==='cancelled'?'var(--line)':'var(--ember)'};">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px;margin-bottom:10px;">
        <div>
          <div style="font-family:var(--font-display);font-weight:800;font-size:14px;">${o.invoiceNo || o.id}</div>
          <div style="font-size:11px;color:var(--ink-soft);">${dateStr}</div>
        </div>
        <span class="order-status-badge">${statusLabel}</span>
      </div>

      <div style="background:var(--mist);border-radius:10px;padding:12px;margin-bottom:12px;font-size:13px;line-height:1.9;">
        <b>${c.name || "بدون اسم"}</b> — <a href="tel:${c.phone}">${c.phone||""}</a><br>
        ${c.province||""} ${c.district?" / "+c.district:""} ${c.subdistrict?" / "+c.subdistrict:""}<br>
        ${c.landmark?`أقرب نقطة: ${c.landmark}<br>`:""}
        ${c.notes?`ملاحظات: ${c.notes}<br>`:""}
      </div>

      <div style="margin-bottom:12px;">${itemsHTML}</div>

      <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--ink-soft);margin-bottom:4px;">
        <span>المجموع الفرعي</span><span>${formatAdminPrice(o.subtotal)} د.ع</span>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--ink-soft);margin-bottom:10px;">
        <span>أجور التوصيل</span><span>${formatAdminPrice(o.deliveryFee)} د.ع</span>
      </div>
      <div style="display:flex;justify-content:space-between;font-family:var(--font-display);font-weight:800;font-size:15px;margin-bottom:14px;">
        <span>المجموع الكلي</span><span style="color:var(--ember);">${formatAdminPrice(o.total)} د.ع</span>
      </div>

      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <a href="https://wa.me/${(c.phone||"").replace(/[^0-9]/g,"")}" target="_blank" class="btn btn-whatsapp btn-sm">تواصل عبر واتساب</a>
        ${nextStatus ? `<button class="btn btn-outline btn-sm" onclick="advanceOrderStatus(${o._issueNumber},'${nextStatus}')">➡️ ${ADMIN_STATUS_LABELS[nextStatus]}</button>` : ""}
        ${status!=="cancelled" && status!=="done" ? `<button class="btn btn-outline btn-sm" onclick="setOrderStatus(${o._issueNumber},'cancelled')">❌ إلغاء</button>` : ""}
      </div>
    </div>`;
  }).join("");
}

async function advanceOrderStatus(issueNumber, newStatus){
  if (!ordersDbReady() || !ORDERS_CONFIG.writeToken){ alert("توكن الكتابة غير مُهيّأ — راجع تبويب قاعدة البيانات."); return; }
  try{
    await GitHubAPI.updateOrderStatus(ORDERS_CONFIG, issueNumber, newStatus, `تم تحديث حالة الطلب إلى: ${ADMIN_STATUS_LABELS[newStatus]}`);
    loadOrdersList();
  }catch(err){
    alert("تعذّر تحديث حالة الطلب: "+err.message);
  }
}
async function setOrderStatus(issueNumber, status){
  if (status==="cancelled" && !confirm("هل تريد إلغاء هذا الطلب؟")) return;
  await advanceOrderStatus(issueNumber, status);
}

function renderAdminStats(){
  const el = document.getElementById("adminStats");
  if (!el) return;
  const totalProducts = adminProducts.length;
  const newOrders = adminOrders.filter(o=>currentOrderStatus(o)==="new-order").length;
  const doneOrders = adminOrders.filter(o=>currentOrderStatus(o)==="done").length;
  const revenue = adminOrders.filter(o=>currentOrderStatus(o)==="done").reduce((s,o)=>s+(o.total||0),0);

  el.innerHTML = `
    <div class="admin-stat-card"><b>${totalProducts}</b><span>منتج</span></div>
    <div class="admin-stat-card"><b>${newOrders}</b><span>طلب جديد</span></div>
    <div class="admin-stat-card"><b>${doneOrders}</b><span>طلب مُسلَّم</span></div>
    <div class="admin-stat-card"><b>${formatAdminPrice(revenue)}</b><span>إيرادات مُحقَّقة (د.ع)</span></div>`;
}

/* ====================================================
   سجل الزبائن — يُبنى تلقائياً من الطلبات المحفوظة
   ==================================================== */
async function loadCustomersList(){
  const wrap = document.getElementById("customersList");
  if (!wrap) return;
  if (!ordersDbReady()){
    wrap.innerHTML = `<div class="empty-state">فعّل قاعدة بيانات الطلبات أولاً من تبويب "قاعدة البيانات".</div>`;
    return;
  }
  wrap.innerHTML = `<div class="empty-state">جارِ التحميل...</div>`;
  try{
    if (!adminOrders.length) adminOrders = await GitHubAPI.listOrderIssues(ORDERS_CONFIG, "all");
    renderCustomersList(adminOrders);
  }catch(err){
    wrap.innerHTML = `<div class="empty-state">تعذّر التحميل: ${err.message}</div>`;
  }
}

document.getElementById("customersSearchInput")?.addEventListener("input", (e)=>{
  const q = e.target.value.trim().toLowerCase();
  const filtered = adminOrders.filter(o=>
    (o.customer?.name||"").toLowerCase().includes(q) || (o.customer?.phone||"").includes(q)
  );
  renderCustomersList(q ? filtered : adminOrders);
});

function renderCustomersList(orders){
  const wrap = document.getElementById("customersList");
  const byPhone = {};
  orders.forEach(o=>{
    const phone = o.customer?.phone || "بدون رقم";
    if (!byPhone[phone]) byPhone[phone] = { customer:o.customer, orders:[] };
    byPhone[phone].orders.push(o);
  });

  const customers = Object.values(byPhone).sort((a,b)=>b.orders.length - a.orders.length);
  if (!customers.length){
    wrap.innerHTML = `<div class="empty-state">لا يوجد زبائن مسجّلين بعد.</div>`;
    return;
  }

  wrap.innerHTML = customers.map(cu=>{
    const c = cu.customer || {};
    const totalSpent = cu.orders.reduce((s,o)=>s+(o.total||0),0);
    return `<div class="card" style="margin-bottom:12px;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px;">
        <div>
          <div style="font-weight:800;font-size:14px;">${c.name||"بدون اسم"}</div>
          <div style="font-size:12px;color:var(--ink-soft);"><a href="tel:${c.phone}">${c.phone||""}</a></div>
          <div style="font-size:11px;color:var(--ink-soft);margin-top:4px;">${c.province||""} ${c.district?" / "+c.district:""}</div>
        </div>
        <div style="text-align:left;">
          <div style="font-family:var(--font-display);font-weight:800;color:var(--ember);">${cu.orders.length} طلب</div>
          <div style="font-size:11px;color:var(--ink-soft);">${formatAdminPrice(totalSpent)} د.ع إجمالي</div>
        </div>
      </div>
    </div>`;
  }).join("");
}

/* ====================================================
   حالة قاعدة بيانات الطلبات (تبويب الإعدادات)
   ==================================================== */
async function checkOrdersDbStatus(){
  const box = document.getElementById("dbConfigStatus");
  if (!box) return;
  hideAlert("dbConfigError");

  if (typeof ORDERS_CONFIG === "undefined"){
    box.innerHTML = `<div class="db-status-row error">⚠️ ملف orders-config.js غير موجود بالموقع.</div>`;
    return;
  }
  if (!ORDERS_CONFIG.owner || !ORDERS_CONFIG.repo){
    box.innerHTML = `<div class="db-status-row error">⚠️ لم يتم تعبئة owner/repo في orders-config.js بعد.</div>`;
    return;
  }
  if (!ORDERS_CONFIG.writeToken){
    box.innerHTML = `<div class="db-status-row error">⚠️ ريبو الطلبات معرَّف (${ORDERS_CONFIG.owner}/${ORDERS_CONFIG.repo}) لكن لا يوجد توكن كتابة — الحفظ التلقائي للطلبات الجديدة متوقف حالياً.</div>`;
    return;
  }

  box.innerHTML = `<div class="db-status-row loading"><span class="spinner"></span> جارٍ التحقق من الاتصال...</div>`;
  try{
    const orders = await GitHubAPI.listOrderIssues(ORDERS_CONFIG, "all");
    box.innerHTML = `<div class="db-status-row ok">✅ متصل بنجاح بريبو <b>${ORDERS_CONFIG.owner}/${ORDERS_CONFIG.repo}</b> — يوجد حالياً ${orders.length} طلب محفوظ.</div>`;
  }catch(err){
    box.innerHTML = `<div class="db-status-row error">❌ تعذّر الاتصال: ${err.message}</div>`;
  }
}

boot();
