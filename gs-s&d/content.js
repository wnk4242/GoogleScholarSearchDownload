(function () {
  'use strict';

  /******************************************************************
   * 1. WAIT UNTIL SCHOLAR IS REALLY READY
   ******************************************************************/
  function waitForScholarReady(cb) {
    const obs = new MutationObserver(() => {
      if (document.querySelector("#gs_top")) {
        obs.disconnect();
        setTimeout(cb, 300);
      }
    });
    obs.observe(document.body, { childList: true, subtree: true });
  }

  waitForScholarReady(init);

  /******************************************************************
   * 2. ROUTER
   ******************************************************************/
  function init() {
    const params = new URL(location.href).searchParams;
    const isLibrary = params.has("scilib");

    if (isLibrary) {
      initLibraryDownloader();
    } else {
      initBatchSearch();
    }
  }

  /******************************************************************
   * ===================== DRAG HELPER ===============================
   ******************************************************************/
  function makeDraggable(panel, handle) {
    let dragging = false;
    let offsetX = 0;
    let offsetY = 0;

    handle.addEventListener("mousedown", e => {
      dragging = true;
      const rect = panel.getBoundingClientRect();
      offsetX = e.clientX - rect.left;
      offsetY = e.clientY - rect.top;
      document.body.style.userSelect = "none";
    });

    document.addEventListener("mousemove", e => {
      if (!dragging) return;
      panel.style.left = `${e.clientX - offsetX}px`;
      panel.style.top  = `${e.clientY - offsetY}px`;
      panel.style.right = "auto";
      panel.style.bottom = "auto";
    });

    document.addEventListener("mouseup", () => {
      if (!dragging) return;
      dragging = false;
      document.body.style.userSelect = "";
    });
  }

  /******************************************************************
   * ===================== LIBRARY PDF DOWNLOADER ====================
   ******************************************************************/
  function initLibraryDownloader() {
    if (document.getElementById("gsLibraryDownloader")) return;

    const openBtn = document.createElement("button");
    openBtn.id = "gsLibraryDownloader";
    openBtn.textContent = "📚 Library PDF Downloader";
    openBtn.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 9999;
      padding: 10px 14px;
      background: #1a73e8;
      color: white;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
    `;
    document.body.appendChild(openBtn);

    const panel = document.createElement("div");
    panel.style.cssText = `
      position: fixed;
      bottom: 70px;
      right: 20px;
      width: 460px;
      max-height: 60vh;
      overflow-y: auto;
      background: white;
      border: 1px solid #ccc;
      border-radius: 8px;
      padding: 0;
      z-index: 9999;
      display: none;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      font-size: 13px;
    `;
    document.body.appendChild(panel);

    // ----- Header (drag handle) -----
    const header = document.createElement("div");
    header.textContent = "📄 Library PDF Downloader";
    header.style.cssText = `
      padding: 8px 10px;
      font-weight: bold;
      cursor: move;
      background: #f1f3f4;
      border-bottom: 1px solid #ddd;
      border-radius: 8px 8px 0 0;
    `;
    panel.appendChild(header);

    const content = document.createElement("div");
    content.style.padding = "10px";
    panel.appendChild(content);

    makeDraggable(panel, header);

    openBtn.onclick = () => {
      panel.style.display = panel.style.display === "none" ? "block" : "none";
      if (!panel.dataset.loaded) loadLibrary();
    };

    function loadLibrary() {
      content.innerHTML = "";

      const controls = document.createElement("div");

      const selectAll = document.createElement("button");
      selectAll.textContent = "Select all";

      const deselectAll = document.createElement("button");
      deselectAll.textContent = "Deselect all";

      const download = document.createElement("button");
      download.textContent = "⬇ Download selected PDFs";
      download.style.background = "#1a73e8";
      download.style.color = "white";

      controls.append(selectAll, deselectAll, download);
      content.appendChild(controls);

      const list = document.createElement("div");
      list.style.marginTop = "8px";
      content.appendChild(list);

      const items = [];
      document.querySelectorAll(".gs_scl").forEach(entry => {
        const title = entry.querySelector(".gs_rt")?.innerText || "Paper";
        const pdf = [...entry.querySelectorAll("a")]
          .find(a => a.textContent.startsWith("[PDF]"));
        if (!pdf) return;
        items.push({ title, url: pdf.href });
      });

      items.forEach(it => {
        const row = document.createElement("div");
        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.checked = true;
        row.append(cb, " ", it.title);
        list.appendChild(row);
        it.cb = cb;
      });

      selectAll.onclick   = () => items.forEach(i => i.cb.checked = true);
      deselectAll.onclick = () => items.forEach(i => i.cb.checked = false);
        download.onclick = () => {
        items.forEach(i => {
            if (!i.cb.checked) return;

            const filename =
            i.title
                .replace(/[\\/:*?"<>|]+/g, "")
                .slice(0, 150) + ".pdf";

            chrome.runtime.sendMessage({
            action: "download",
            url: i.url,
            filename: filename
            });
        });
        };


      panel.dataset.loaded = "true";
    }
  }

  /******************************************************************
   * ========================= BATCH SEARCH ==========================
   ******************************************************************/
  function initBatchSearch() {
    if (document.getElementById("gsBatchPanel")) return;

    const STORAGE_KEY = "gs_paper_queue";

    const panel = document.createElement("div");
    panel.id = "gsBatchPanel";
    panel.style.cssText = `
      position: fixed;
      top: 80px;
      right: 20px;
      width: 340px;
      background: white;
      border: 2px solid #4285f4;
      padding: 0;
      z-index: 9999;
      font-size: 13px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    `;

    // ----- Header (drag handle) -----
    const header = document.createElement("div");
    header.textContent = "🔍 Scholar Batch Search";
    header.style.cssText = `
      padding: 8px;
      font-weight: bold;
      cursor: move;
      background: #e8f0fe;
      border-bottom: 1px solid #c6dafc;
    `;
    panel.appendChild(header);

    const content = document.createElement("div");
    content.style.padding = "8px";
    panel.appendChild(content);

    content.innerHTML = `
      <textarea id="gsInput"
        style="width:100%; height:90px;"
        placeholder="One title or DOI per line"></textarea>

      <div style="margin-top:8px; display:flex; gap:6px;">
        <button data-a="begin">Begin</button>
        <button data-a="clear">Clear</button>
        <button data-a="save">Save</button>
        <button data-a="next">Next</button>
      </div>

      <div id="gsNow" style="margin-top:10px;"></div>
      <div id="gsNext" style="font-size:11px;color:#666;"></div>
    `;

    document.body.appendChild(panel);

    makeDraggable(panel, header);

    panel.addEventListener("click", e => {
      const a = e.target.dataset.a;
      if (!a) return;
      if (a === "begin") begin();
      if (a === "clear") clear();
      if (a === "save") save();
      if (a === "next") next();
    });

    function load() {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    }
    function store(q) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(q));
    }
    function update() {
      const q = load();
      panel.querySelector("#gsNow").innerHTML =
        q[0] ? `<b>Current:</b> ${q[0]}` : `No active paper`;
      panel.querySelector("#gsNext").innerHTML =
        q[1] ? `Next: ${q[1]}` : ``;
    }
    function normalizeQuery(q) {
      return q
        .replace(/^https?:\/\/(dx\.)?doi\.org\//i, "")
        .trim();
    }

    function begin() {
      const lines = panel.querySelector("#gsInput").value
        .split("\n")
        .map(l => normalizeQuery(l))
        .filter(Boolean);

      if (!lines.length) return;
      store(lines);
      update();
      search();
    }

    function search() {
      const q = load(); if (!q.length) return;
      location.href =
        "https://scholar.google.com/scholar?q=" +
        encodeURIComponent(q[0]);
    }
    function save() {
      document.querySelector("a.gs_or_sav")?.click();
    }
    function next() {
      const q = load(); q.shift(); store(q); update(); search();
    }
    function clear() {
      localStorage.removeItem(STORAGE_KEY); update();
    }

    update();
  }

})();
