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
      "Accept": "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28"
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

  return { verifyAccess, getTextFile, putTextFile, putBinaryFile, deleteFile };
})();
