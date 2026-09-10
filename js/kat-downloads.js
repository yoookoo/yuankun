/*
 * KAT-Coder-V2.5-Dev 下载统计（内联在首页 News 的条目里，不是独立模块）
 *
 * 思路与郝进华主页（eric-hao.github.io/assets/js/huggingface-model-stats.js）一致：
 *   1. HTML 里先渲染一份「静态快照」，保证离线 / 接口不可用时页面仍有数字；
 *   2. 页面加载后用 HuggingFace 公开 API 覆盖为实时值；
 *   3. 用 filter=base_model:<id> 把社区的量化 / 微调版本一并统计，得到生态总量。
 *
 * 页面锚点：
 *   [data-kat-downloads]  —— 统计行容器（<li> 里 News 条目的第二行）
 *   [data-kat-stat="..."] —— 单个数字占位，取值：
 *                            ecosystem-downloads / model-downloads / model-likes
 *
 * 只读公开 API，不发送任何用户数据。
 */
(function () {
  "use strict";

  /* 注意：这里不带尾部斜杠。
     单模型接口要拼 /<owner>/<name>，列表接口要拼 ?filter=...，
     若基址带斜杠会拼成 /api/models/?filter=... ，HF 会返回 302，
     浏览器跨域跟随重定向时会失败。 */
  var HF_API = "https://huggingface.co/api/models";
  var MODEL = "Kwaipilot/KAT-Coder-V2.5-Dev";

  var root = document.querySelector("[data-kat-downloads]");
  if (!root || !window.fetch) return;

  function num(n) {
    return Number(n || 0).toLocaleString("en-US");
  }

  function json(url) {
    return fetch(url, { headers: { Accept: "application/json" } }).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    });
  }

  function set(stat, value) {
    var el = root.querySelector('[data-kat-stat="' + stat + '"]');
    if (el) el.textContent = value;
  }

  var modelUrl = HF_API + "/" + MODEL.split("/").map(encodeURIComponent).join("/") +
    "?expand=downloadsAllTime&expand=likes";

  var derivedUrl = HF_API + "?filter=" + encodeURIComponent("base_model:" + MODEL) +
    "&expand=downloadsAllTime&limit=1000";

  Promise.all([
    json(modelUrl),
    // 衍生模型列表拉不到时返回 null，不影响主模型数字展示
    json(derivedUrl).catch(function () { return null; })
  ]).then(function (res) {
    var model = res[0] || {};
    var derived = res[1];

    var selfDl = typeof model.downloadsAllTime === "number" ? model.downloadsAllTime : 0;

    if (selfDl) set("model-downloads", num(selfDl));
    if (typeof model.likes === "number") set("model-likes", num(model.likes));

    if (selfDl && Array.isArray(derived)) {
      var derivedDl = derived.reduce(function (sum, m) {
        return sum + (typeof m.downloadsAllTime === "number" ? m.downloadsAllTime : 0);
      }, 0);
      set("ecosystem-downloads", num(selfDl + derivedDl));
      root.setAttribute("data-hf-live", "full");
    } else if (selfDl) {
      // 只拿到主模型：生态总量保持静态快照，避免显示一个偏小的值
      root.setAttribute("data-hf-live", "model-only");
    }
  }).catch(function () {
    // 静默失败：保留 HTML 里的快照数字
  });
}());
