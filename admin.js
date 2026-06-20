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
    if (btn.dataset.tab==="catsPanel") renderAdminCategories();
    if (btn.dataset.tab==="contactPanel") loadContactInfo();
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
  wrap.innerHTML = pendingImages.map((img,i)=>`
    <div class="multi-img-item">
      <img src="${img.dataUrl||img.url||""}" alt="">
      <span class="multi-img-del" onclick="removeImage(${i})">✕</span>
    </div>`).join("");
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
async function loadContactInfo(){
  const wrap = document.getElementById("contactPanel");
  try{
    const file = await GitHubAPI.getTextFile(cfg, "products.json");
    const data = JSON.parse(file.content||'{}');
    const c = data.contact || {};
    document.getElementById("ctWhatsapp").value = c.whatsapp || "";
    document.getElementById("ctPhone").value = c.phone || "";
    document.getElementById("ctFacebook").value = c.facebook || "";
    document.getElementById("ctInstagram").value = c.instagram || "";
    document.getElementById("ctTiktok").value = c.tiktok || "";
    document.getElementById("ctTelegram").value = c.telegram || "";
  }catch(err){
    showAlert("globalError","تعذّر تحميل معلومات التواصل: "+err.message);
  }
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
      phone: document.getElementById("ctPhone").value.trim(),
      facebook: document.getElementById("ctFacebook").value.trim(),
      instagram: document.getElementById("ctInstagram").value.trim(),
      tiktok: document.getElementById("ctTiktok").value.trim(),
      telegram: document.getElementById("ctTelegram").value.trim()
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
        const filtered = q ? adminProducts.filter(p=>p.name.toLowerCase().includes(q)||p.category.toLowerCase().includes(q)) : adminProducts;
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

boot();
