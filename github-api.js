/* ====================================================
   github-api.js
   طبقة رفيعة فوق GitHub Contents API — تُستخدم فقط من
   admin.html. كل الطلبات تنطلق من متصفح الأدمن مباشرة
   إلى api.github.com، والتوكن لا يُرسل لأي مكان آخر.
   ==================================================== */

const GitHubAPI = (() => {

  function utf8ToBase64(str){
    const bytes = new TextEncoder().encode(str);
    let binary = "";
    bytes.forEach(b => binary += String.fromCharCode(b));
    return btoa(binary);
  }

  function base64ToUtf8(b64){
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  function headers(token){
    return {
      "Authorization": `Bearer ${token}`,
      "Accept": "application/vnd.github+json"
    };
  }

  function baseUrl(cfg, path){
    return `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${path}`;
  }

  /** يتحقق من صلاحية التوكن والوصول للريبو */
  async function verifyAccess(cfg){
    const res = await fetch(`https://api.github.com/repos/${cfg.owner}/${cfg.repo}`, {
      headers: headers(cfg.token)
    });
    if (!res.ok) throw new Error(`تعذّر الوصول للريبو (${res.status})`);
    return res.json();
  }

  /** يقرأ ملف نصي (مثل products.json) ويرجع المحتوى + sha */
  async function getTextFile(cfg, path){
    const res = await fetch(`${baseUrl(cfg, path)}?ref=${cfg.branch}&t=${Date.now()}`, {
      headers: headers(cfg.token)
    });
    if (res.status === 404) return { content: null, sha: null };
    if (!res.ok) throw new Error(`فشل قراءة ${path} (${res.status})`);
    const data = await res.json();
    return { content: base64ToUtf8(data.content), sha: data.sha };
  }

  /** يكتب/يحدّث ملف نصي */
  async function putTextFile(cfg, path, contentStr, message, sha){
    const body = {
      message,
      content: utf8ToBase64(contentStr),
      branch: cfg.branch
    };
    if (sha) body.sha = sha;

    const res = await fetch(baseUrl(cfg, path), {
      method: "PUT",
      headers: headers(cfg.token),
      body: JSON.stringify(body)
    });
    if (!res.ok){
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `فشل حفظ ${path} (${res.status})`);
    }
    return res.json();
  }

  /** يرفع ملف صورة (يستقبل base64 خام بدون تحويل ترميز) */
  async function putBinaryFile(cfg, path, base64Content, message){
    const res = await fetch(baseUrl(cfg, path), {
      method: "PUT",
      headers: headers(cfg.token),
      body: JSON.stringify({
        message,
        content: base64Content,
        branch: cfg.branch
      })
    });
    if (!res.ok){
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `فشل رفع الصورة (${res.status})`);
    }
    return res.json();
  }

  async function deleteFile(cfg, path, sha, message){
    const res = await fetch(baseUrl(cfg, path), {
      method: "DELETE",
      headers: headers(cfg.token),
      body: JSON.stringify({ message, sha, branch: cfg.branch })
    });
    if (!res.ok){
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `فشل حذف الملف (${res.status})`);
    }
    return res.json();
  }

  /* ====================================================
     طبقة قاعدة بيانات الطلبات (GitHub Issues API)
     ----------------------------------------------------
     كل طلب = Issue واحد في ريبو منفصل مخصص للطلبات فقط
     (orders repo). هذا الريبو يُدار بتوكنين منفصلين:
     - توكن قراءة فقط (عام، مضمّن بكود الموقع) لأجل البحث
       برقم الفاتورة من صفحة الموقع العامة.
     - توكن كتابة محدود الصلاحية (Issues فقط) يُستخدم من
       متصفح الزبون لحظة إرسال الطلب لحفظه تلقائياً، ومن
       لوحة التحكم لتحديث حالة الطلب (عبر تعليق/Label).
     هذا الفصل يحمي بقية الريبو (المنتجات/الصور) حتى لو
     تسرّب توكن القراءة العام، لأنه لا يملك أي صلاحية كتابة.
     ==================================================== */
  function ordersHeaders(token){
    const h = {
      "Accept": "application/vnd.github+json"
    };
    if (token) h["Authorization"] = `Bearer ${token}`;
    return h;
  }

  function ordersBase(ordersCfg){
    return `https://api.github.com/repos/${ordersCfg.owner}/${ordersCfg.repo}`;
  }

  /** ينشئ طلباً جديداً كـ GitHub Issue. يرجّع رقم الفاتورة ورقم الـ issue. */
  async function createOrderIssue(ordersCfg, order){
    const title = `طلب ${order.invoiceNo} — ${order.customer.name || order.customer.phone}`;
    const body = "```json\n" + JSON.stringify(order, null, 2) + "\n```";
    const res = await fetch(`${ordersBase(ordersCfg)}/issues`, {
      method: "POST",
      headers: { ...ordersHeaders(ordersCfg.writeToken), "Content-Type": "application/json" },
      body: JSON.stringify({ title, body, labels: ["new-order"] })
    });
    if (!res.ok){
      const err = await res.json().catch(()=>({}));
      throw new Error(err.message || `فشل حفظ الطلب (${res.status})`);
    }
    return res.json();
  }

  /** يبحث عن طلب برقم الفاتورة (قراءة فقط، يمكن استخدامه بدون توكن أو بتوكن قراءة محدود) */
  async function findOrderByInvoice(ordersCfg, invoiceNo){
    const q = encodeURIComponent(`repo:${ordersCfg.owner}/${ordersCfg.repo} in:title "${invoiceNo}"`);
    const res = await fetch(`https://api.github.com/search/issues?q=${q}`, {
      headers: ordersHeaders(ordersCfg.readToken)
    });
    if (!res.ok) throw new Error(`تعذّر البحث (${res.status})`);
    const data = await res.json();
    const match = (data.items||[]).find(it => it.title.includes(invoiceNo));
    if (!match) return null;
    return parseOrderIssue(match);
  }

  /** يجلب كل الطلبات (لوحة التحكم) — يدعم فلترة بالحالة عبر label */
  async function listOrderIssues(ordersCfg, state="all"){
    const res = await fetch(`${ordersBase(ordersCfg)}/issues?state=${state}&per_page=100&sort=created&direction=desc`, {
      headers: ordersHeaders(ordersCfg.readToken || ordersCfg.writeToken)
    });
    if (!res.ok) throw new Error(`تعذّر جلب الطلبات (${res.status})`);
    const issues = await res.json();
    return issues.filter(it => !it.pull_request).map(parseOrderIssue).filter(Boolean);
  }

  function parseOrderIssue(issue){
    const m = /```json\n([\s\S]*?)\n```/.exec(issue.body || "");
    if (!m) return null;
    try{
      const order = JSON.parse(m[1]);
      order._issueNumber = issue.number;
      order._issueState = issue.state;
      order._labels = (issue.labels||[]).map(l => typeof l === "string" ? l : l.name);
      return order;
    }catch(e){ return null; }
  }

  /** يحدّث حالة الطلب (يضيف Label + تعليق توضيحي) دون لمس بقية الريبو */
  async function updateOrderStatus(ordersCfg, issueNumber, newStatusLabel, comment){
    const headersWrite = { ...ordersHeaders(ordersCfg.writeToken), "Content-Type": "application/json" };

    await fetch(`${ordersBase(ordersCfg)}/issues/${issueNumber}`, {
      method: "PATCH",
      headers: headersWrite,
      body: JSON.stringify({ labels: ["order", newStatusLabel] })
    });

    if (comment){
      await fetch(`${ordersBase(ordersCfg)}/issues/${issueNumber}/comments`, {
        method: "POST",
        headers: headersWrite,
        body: JSON.stringify({ body: comment })
      });
    }

    if (newStatusLabel === "done" || newStatusLabel === "cancelled"){
      await fetch(`${ordersBase(ordersCfg)}/issues/${issueNumber}`, {
        method: "PATCH",
        headers: headersWrite,
        body: JSON.stringify({ state: "closed" })
      });
    }
  }

  return {
    verifyAccess, getTextFile, putTextFile, putBinaryFile, deleteFile,
    createOrderIssue, findOrderByInvoice, listOrderIssues, updateOrderStatus
  };
})();
