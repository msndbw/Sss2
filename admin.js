/* ====================================================
   admin.js v3 — لوحة تحكم متجر خطوة (مطور)
   ==================================================== */

const CFG_KEY = "khatwa_admin_cfg";
const DEFAULT_SIZES = [38,39,40,41,42,43,44,45,46];

let cfg = null;
let pendingImages = [];
let currentColors = [];
let customSizes = [];
let adminProducts = [];
let adminCategories = [];

/* ---------- تنسيق الأسعار ---------- */
function formatAdminPrice(raw){
  const n = parseInt(String(raw).replace(/[,\s]/g,"")) || 0;
  return n ? n.toLocaleString("ar-IQ") : "";
}
function parseAdminPrice(val){
  return parseInt(String(val).replace(/[,\s]/g,"")) || 0;
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
  if (!cfg){ document.getElementById("setupScreen").style.display = "block"; }
  else { document.getElementById("pinScreen").style.display = "block"; }
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
  loadSettings();
  updateStats();
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
    if (btn.dataset.tab==="settingsPanel") loadSettings();
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
    updateStats();
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

function generateProductId(products){
  // توليد معرف فريد بصيغة PID-XXX
  const existing = products.map(p=>{
    const match = p.id.match(/PID-(\d+)/);
    return match ? parseInt(match[1]) : 0;
  });
  const max = existing.length ? Math.max(...existing) : 0;
  const next = (max + 1).toString().padStart(3, '0');
  return `PID-${next}`;
}

function fillFormForEdit(p){
  document.getElementById("editingId").value = p.id;
  document.getElementById("formTitle").textContent = "تعديل: " + p.name;
  document.getElementById("submitBtn").textContent = "حفظ التعديلات";
  document.getElementById("cancelEditBtn").style.display = "inline-flex";

  document.getElementById("fName").value = p.name||"";
  document.getElementById("fStatus").value = p.status||"available";
  document.getElementById("fBadge").value = p.badge||"";
  document.getElementById("fDescription").value = p.description||"";
  document.getElementById("fDiscount").value = p.discount||0;

  const priceEl = document.getElementById("fPrice");
  const oldPriceEl = document.getElementById("fOldPrice");
  priceEl.value = p.price||"";
  oldPriceEl.value = p.oldPrice||"";
  if (p.price) document.getElementById("fPriceHint").textContent = Number(p.price).toLocaleString("ar-IQ")+" د.ع";
  if (p.oldPrice) document.getElementById("fOldPriceHint").textContent = Number(p.oldPrice).toLocaleString("ar-IQ")+" د.ع";

  setTimeout(()=>{ document.getElementById("fCategory").value = p.category||""; }, 100);

  customSizes = (p.sizes||[]).filter(s=>!DEFAULT_SIZES.includes(s));
  renderSizeChecks();
  setTimeout(()=>{
    document.querySelectorAll(".size-box").forEach(cb=>{
      cb.checked = (p.sizes||[]).map(Number).includes(Number(cb.value));
    });
  }, 50);

  currentColors = [...(p.colors||[])];
  renderColorTags();

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

    let id = editingId;
    if (!id) {
      id = generateProductId(data.products || []);
    }

    // رفع الصور الجديدة
    const uploadedImages = [];
    for (const img of pendingImages){
      if (img.base64){
        const imgPath = `images/${id}_${Date.now()}_${uploadedImages.length}.${img.ext}`;
        await GitHubAPI.putBinaryFile(cfg, imgPath, img.base64, `رفع صورة ${id}`);
        uploadedImages.push(imgPath);
      } else if (img.url){
        uploadedImages.push(img.url);
      }
    }

    const productObj = {
      id,
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
      description: document.getElementById("fDescription").value.trim(),
      rating: 4.5,
      hidden: false // الوضع الافتراضي
    };

    if (editingId){
      const idx = data.products.findIndex(p=>p.id===editingId);
      if (idx>-1) {
        // الحفاظ على حالة الإخفاء القديمة إذا كانت موجودة
        const oldHidden = data.products[idx].hidden || false;
        productObj.hidden = oldHidden;
        data.products[idx] = productObj;
      } else data.products.push(productObj);
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
    updateStats();

  }catch(err){
    showAlert("globalError","حدث خطأ: "+err.message);
  }finally{
    submitBtn.disabled = false;
    submitBtn.textContent = originalLabel;
  }
});

/* ====================================================
   قائمة المنتجات (مع إخفاء/إظهار)
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

    const searchEl = document.getElementById("adminSearch");
    if (searchEl){
      searchEl.removeEventListener("input", searchFilter);
      searchEl.addEventListener("input", searchFilter);
    }

  }catch(err){
    wrap.innerHTML = `<div class="empty-state">تعذّر التحميل: ${err.message}</div>`;
  }
}

function searchFilter(){
  const q = document.getElementById("adminSearch").value.trim().toLowerCase();
  const filtered = q ? adminProducts.filter(p=>p.name.toLowerCase().includes(q)||p.category.toLowerCase().includes(q)) : adminProducts;
  renderProductsList(filtered);
}

async function toggleProductVisibility(id){
  try{
    const file = await GitHubAPI.getTextFile(cfg, "products.json");
    const data = JSON.parse(file.content);
    const idx = data.products.findIndex(p=>p.id===id);
    if (idx===-1) throw new Error("المنتج غير موجود");
    data.products[idx].hidden = !data.products[idx].hidden;
    await GitHubAPI.putTextFile(cfg, "products.json", JSON.stringify(data,null,2), `تغيير حالة ${data.products[idx].name}`, file.sha);
    showAlert("globalSuccess", "تم تحديث حالة المنتج ✓");
    loadProductsList();
    updateStats();
  }catch(err){
    showAlert("globalError", "تعذّر التحديث: "+err.message);
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
    const hiddenText = p.hidden ? "🔒 مخفي" : "👁️ ظاهر";
    return `
    <div class="admin-product">
      <div class="thumb">${thumb}</div>
      <div class="info">
        <b>${p.name} <span style="font-size:11px;color:var(--ink-soft);font-weight:400;">${p.id}</span></b>
        <span>${p.category} · ${Number(p.price).toLocaleString("ar-IQ")} د.ع · ${statusText} · ${hiddenText}</span>
        ${images.length>1?`<span style="font-size:11px;color:var(--ember);">${images.length} صور</span>`:""}
      </div>
      <div class="actions">
        <button class="icon-action" onclick="toggleProductVisibility('${p.id}')" aria-label="إخفاء/إظهار" style="color:${p.hidden ? '#c63b3b' : 'var(--success)'};">
          ${p.hidden ? '🔓' : '🔒'}
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
    updateStats();
  }catch(err){
    showAlert("globalError","تعذّر الحذف: "+err.message);
  }
}

/* ====================================================
   الإحصائيات
   ==================================================== */
function updateStats(){
  const total = adminProducts.length;
  const visible = adminProducts.filter(p=>!p.hidden).length;
  const hidden = adminProducts.filter(p=>p.hidden).length;
  document.getElementById("statTotal").textContent = total;
  document.getElementById("statVisible").textContent = visible;
  document.getElementById("statHidden").textContent = hidden;
  document.getElementById("statCats").textContent = adminCategories.length;
}

/* ====================================================
   إعدادات التواصل (settings.json)
   ==================================================== */
async function loadSettings(){
  try{
    const file = await GitHubAPI.getTextFile(cfg, "settings.json");
    const data = file.content ? JSON.parse(file.content) : {};
    document.getElementById("setPhone").value = data.phone || "";
    document.getElementById("setFacebook").value = data.facebook || "";
    document.getElementById("setInstagram").value = data.instagram || "";
    document.getElementById("setTiktok").value = data.tiktok || "";
    document.getElementById("setTelegram").value = data.telegram || "";
  }catch(e){
    // الملف غير موجود
    document.getElementById("setPhone").value = "";
    document.getElementById("setFacebook").value = "";
    document.getElementById("setInstagram").value = "";
    document.getElementById("setTiktok").value = "";
    document.getElementById("setTelegram").value = "";
  }
}

document.getElementById("settingsForm").addEventListener("submit", async (e)=>{
  e.preventDefault();
  const btn = document.getElementById("settingsSubmit");
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner"></span> جارٍ الحفظ...`;
  try{
    const data = {
      phone: document.getElementById("setPhone").value.trim(),
      facebook: document.getElementById("setFacebook").value.trim(),
      instagram: document.getElementById("setInstagram").value.trim(),
      tiktok: document.getElementById("setTiktok").value.trim(),
      telegram: document.getElementById("setTelegram").value.trim()
    };
    const file = await GitHubAPI.getTextFile(cfg, "settings.json");
    await GitHubAPI.putTextFile(cfg, "settings.json", JSON.stringify(data, null, 2), "تحديث إعدادات التواصل", file.sha);
    document.getElementById("settingsStatus").innerHTML = `<div class="alert alert-success show">✅ تم حفظ الإعدادات بنجاح!</div>`;
    setTimeout(()=>{ document.getElementById("settingsStatus").innerHTML = ""; }, 4000);
  }catch(err){
    document.getElementById("settingsStatus").innerHTML = `<div class="alert alert-error show">❌ خطأ: ${err.message}</div>`;
  }finally{
    btn.disabled = false;
    btn.innerHTML = "💾 حفظ الإعدادات";
  }
});

boot();