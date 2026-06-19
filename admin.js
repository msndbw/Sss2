/* ====================================================
   admin.js — منطق لوحة تحكم متجر خطوة
   ==================================================== */

const CFG_KEY = "khatwa_admin_cfg";
const SIZE_RANGE = [38, 39, 40, 41, 42, 43, 44, 45, 46];

let cfg = null;          // { owner, repo, branch, token, pin }
let currentImageBase64 = null; // base64 خام بدون data: prefix
let currentImageExt = "jpg";

/* ---------- تخزين محلي ---------- */
function loadCfg(){
  try { return JSON.parse(localStorage.getItem(CFG_KEY)); }
  catch(e){ return null; }
}
function saveCfg(c){ localStorage.setItem(CFG_KEY, JSON.stringify(c)); }
function wipeCfg(){ localStorage.removeItem(CFG_KEY); }

/* ---------- تنبيهات ---------- */
function showAlert(id, msg){
  const el = document.getElementById(id);
  el.textContent = msg;
  el.classList.add("show");
  if (id === "globalSuccess" || id === "globalError"){
    setTimeout(() => el.classList.remove("show"), 4500);
  }
}
function hideAlert(id){ document.getElementById(id).classList.remove("show"); }

/* ====================================================
   شاشات القفل / الإعداد
   ==================================================== */
function boot(){
  cfg = loadCfg();
  if (!cfg){
    document.getElementById("setupScreen").style.display = "block";
  } else {
    document.getElementById("pinScreen").style.display = "block";
  }
}

document.getElementById("setupForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  hideAlert("setupError");
  const btn = document.getElementById("setupSubmit");
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner"></span> جارٍ التحقق...`;

  const candidate = {
    owner: document.getElementById("cfgOwner").value.trim(),
    repo: document.getElementById("cfgRepo").value.trim(),
    branch: document.getElementById("cfgBranch").value.trim() || "main",
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
    showAlert("setupError", "تعذّر التحقق: " + err.message + " — تأكد من اسم الريبو والتوكن وصلاحياته.");
  }finally{
    btn.disabled = false;
    btn.textContent = "التحقق وحفظ الإعدادات";
  }
});

document.getElementById("pinForm").addEventListener("submit", (e) => {
  e.preventDefault();
  hideAlert("pinError");
  const entered = document.getElementById("pinInput").value.trim();
  if (entered === cfg.pin){
    document.getElementById("pinScreen").style.display = "none";
    unlockDashboard();
  } else {
    showAlert("pinError", "الرمز غير صحيح.");
  }
});

document.getElementById("forgotLink").addEventListener("click", (e) => {
  e.preventDefault();
  if (confirm("هذا سيمسح إعدادات GitHub والرمز من هذا المتصفح. تأكد إنك تعرف التوكن لإعادة الإدخال. متابعة؟")){
    wipeCfg();
    location.reload();
  }
});

document.getElementById("wipeDeviceBtn").addEventListener("click", () => {
  if (confirm("سيتم مسح إعدادات هذا الجهاز فقط (لن يتأثر الريبو). متابعة؟")){
    wipeCfg();
    location.reload();
  }
});

document.getElementById("logoutBtn").addEventListener("click", () => location.reload());

function unlockDashboard(){
  document.getElementById("logoutBtn").style.display = "inline-flex";
  document.getElementById("dashboard").classList.add("show");
  renderSizeChecks();
  loadProductsList();
}

/* ====================================================
   التبويبات
   ==================================================== */
document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(btn.dataset.tab).classList.add("active");
    if (btn.dataset.tab === "listPanel") loadProductsList();
  });
});

/* ====================================================
   نموذج المنتج
   ==================================================== */
function renderSizeChecks(){
  const wrap = document.getElementById("sizeChecks");
  wrap.innerHTML = SIZE_RANGE.map(s =>
    `<label><input type="checkbox" value="${s}" class="size-box"> ${s}</label>`
  ).join("");
}

document.getElementById("imageInput").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  currentImageExt = (file.name.split(".").pop() || "jpg").toLowerCase();
  const reader = new FileReader();
  reader.onload = () => {
    const dataUrl = reader.result;
    currentImageBase64 = dataUrl.split(",")[1];
    const preview = document.getElementById("imagePreview");
    preview.src = dataUrl;
    preview.classList.add("show");
  };
  reader.readAsDataURL(file);
});

function resetForm(){
  document.getElementById("productForm").reset();
  document.getElementById("editingId").value = "";
  document.getElementById("formTitle").textContent = "إضافة منتج جديد";
  document.getElementById("submitBtn").textContent = "حفظ ونشر على الموقع";
  document.getElementById("cancelEditBtn").style.display = "none";
  document.getElementById("imagePreview").classList.remove("show");
  currentImageBase64 = null;
  document.querySelectorAll(".size-box").forEach(cb => cb.checked = false);
}

document.getElementById("cancelEditBtn").addEventListener("click", resetForm);

function fillFormForEdit(p){
  document.getElementById("editingId").value = p.id;
  document.getElementById("formTitle").textContent = "تعديل: " + p.name;
  document.getElementById("submitBtn").textContent = "حفظ التعديلات";
  document.getElementById("cancelEditBtn").style.display = "inline-flex";

  document.getElementById("fName").value = p.name || "";
  document.getElementById("fCategory").value = p.category || "رياضي";
  document.getElementById("fPrice").value = p.price || 0;
  document.getElementById("fOldPrice").value = p.oldPrice || "";
  document.getElementById("fDiscount").value = p.discount || 0;
  document.getElementById("fStatus").value = p.status || "available";
  document.getElementById("fBadge").value = p.badge || "";
  document.getElementById("fDescription").value = p.description || "";

  document.querySelectorAll(".size-box").forEach(cb => {
    cb.checked = (p.sizes || []).includes(Number(cb.value));
  });

  const preview = document.getElementById("imagePreview");
  if (p.image){
    preview.src = p.image;
    preview.classList.add("show");
  } else {
    preview.classList.remove("show");
  }
  currentImageBase64 = null; // ما نرفع صورة جديدة إلا إذا المستخدم اختار وحدة
  window.scrollTo({ top: 0, behavior: "smooth" });
  document.querySelector('.tab-btn[data-tab="addPanel"]').click();
}

document.getElementById("productForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  hideAlert("globalError");
  const submitBtn = document.getElementById("submitBtn");
  const originalLabel = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.innerHTML = `<span class="spinner"></span> جارٍ النشر...`;

  try{
    const editingId = document.getElementById("editingId").value;
    const sizes = Array.from(document.querySelectorAll(".size-box:checked")).map(cb => Number(cb.value));

    if (sizes.length === 0) throw new Error("اختر مقاس واحد على الأقل");

    // 1) قراءة products.json الحالي
    const file = await GitHubAPI.getTextFile(cfg, "products.json");
    if (!file.content) throw new Error("لم يتم العثور على products.json بالريبو");
    const data = JSON.parse(file.content);

    const id = editingId || ("p" + Date.now());

    // 2) رفع الصورة إن وُجدت
    let imagePath = editingId
      ? (data.products.find(p => p.id === editingId)?.image || "")
      : "";

    if (currentImageBase64){
      imagePath = `images/${id}.${currentImageExt}`;
      await GitHubAPI.putBinaryFile(cfg, imagePath, currentImageBase64, `رفع صورة المنتج ${id}`);
    }

    const productObj = {
      id,
      name: document.getElementById("fName").value.trim(),
      category: document.getElementById("fCategory").value,
      icon: "sneaker",
      image: imagePath,
      price: Number(document.getElementById("fPrice").value) || 0,
      oldPrice: document.getElementById("fOldPrice").value ? Number(document.getElementById("fOldPrice").value) : null,
      discount: Number(document.getElementById("fDiscount").value) || 0,
      sizes,
      status: document.getElementById("fStatus").value,
      badge: document.getElementById("fBadge").value || null,
      description: document.getElementById("fDescription").value.trim(),
      rating: 4.5
    };

    if (editingId){
      const idx = data.products.findIndex(p => p.id === editingId);
      if (idx > -1) data.products[idx] = productObj;
      else data.products.push(productObj);
    } else {
      data.products.push(productObj);
    }

    // 3) حفظ products.json المحدّث
    await GitHubAPI.putTextFile(
      cfg, "products.json",
      JSON.stringify(data, null, 2),
      editingId ? `تعديل منتج: ${productObj.name}` : `إضافة منتج جديد: ${productObj.name}`,
      file.sha
    );

    showAlert("globalSuccess", editingId ? "تم حفظ التعديلات بنجاح ✓" : "تم نشر المنتج بنجاح ✓ (قد يستغرق ظهوره بالموقع دقيقة)");
    resetForm();
    loadProductsList();

  }catch(err){
    showAlert("globalError", "حدث خطأ: " + err.message);
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
  wrap.innerHTML = `<div class="empty-state">جارِ التحميل...</div>`;
  try{
    const file = await GitHubAPI.getTextFile(cfg, "products.json");
    const data = JSON.parse(file.content || '{"products":[]}');
    const products = data.products || [];

    if (products.length === 0){
      wrap.innerHTML = `<div class="empty-state">لا توجد منتجات بعد.</div>`;
      return;
    }

    wrap.innerHTML = products.map(p => `
      <div class="admin-product">
        <div class="thumb">${p.image ? `<img src="${p.image}" alt="">` : "👟"}</div>
        <div class="info">
          <b>${p.name}</b>
          <span>${p.category} · ${Number(p.price).toLocaleString("ar-IQ")} د.ع · ${
            p.status === "available" ? "متوفر" : p.status === "limited" ? "كمية محدودة" : "نفذ من المخزون"
          }</span>
        </div>
        <div class="actions">
          <button class="icon-action" data-edit="${p.id}" aria-label="تعديل">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
          </button>
          <button class="icon-action danger" data-delete="${p.id}" aria-label="حذف">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6"/></svg>
          </button>
        </div>
      </div>
    `).join("");

    wrap.querySelectorAll("[data-edit]").forEach(btn => {
      btn.addEventListener("click", () => {
        const p = products.find(x => x.id === btn.dataset.edit);
        if (p) fillFormForEdit(p);
      });
    });

    wrap.querySelectorAll("[data-delete]").forEach(btn => {
      btn.addEventListener("click", () => deleteProduct(btn.dataset.delete));
    });

  }catch(err){
    wrap.innerHTML = `<div class="empty-state">تعذّر تحميل المنتجات: ${err.message}</div>`;
  }
}

async function deleteProduct(id){
  if (!confirm("حذف هذا المنتج نهائياً من الموقع؟")) return;
  try{
    const file = await GitHubAPI.getTextFile(cfg, "products.json");
    const data = JSON.parse(file.content);
    const product = data.products.find(p => p.id === id);
    data.products = data.products.filter(p => p.id !== id);

    await GitHubAPI.putTextFile(
      cfg, "products.json",
      JSON.stringify(data, null, 2),
      `حذف منتج: ${product ? product.name : id}`,
      file.sha
    );

    showAlert("globalSuccess", "تم حذف المنتج ✓");
    loadProductsList();
  }catch(err){
    showAlert("globalError", "تعذّر الحذف: " + err.message);
  }
}

boot();
