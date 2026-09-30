// Data Foundry - web version. The page address describes the table:
//   ?theme=retail_sales&rows=10&cols=6&seed=12345&d=2026-01-01
(function () {
  "use strict";
  var CFG = window.FOUNDRY;
  var DEFAULT_ROWS = 10, DEFAULT_COLS = 6, MAX_SEED = 999999999;
  var root = document.getElementById("drawer-root");
  var engine = document.getElementById("engine");
  var worker = new Worker("worker.js", { type: "module" });
  worker.onerror = function (e) {
    engine.textContent = "The Python engine could not start (" + (e.message || "worker error") + ")";
    engine.className = "engine bad";
  };
  var pending = {}, nextId = 1, engineReady = false, renderToken = 0;

  // ---- talking to the Python worker ------------------------------------
  worker.onmessage = function (e) {
    var m = e.data;
    if (m.type === "ready") {
      engineReady = true;
      engine.textContent = "Python engine ready";
      engine.className = "engine ok";
      render();
    } else if (m.type === "failed") {
      engine.textContent = "The Python engine failed to load: " + m.error;
      engine.className = "engine bad";
      if (currentParams()) { root.innerHTML = ""; showDrawerMessage("The Python engine could not start. Check your connection and reload."); }
    } else if (pending[m.id]) {
      var p = pending[m.id]; delete pending[m.id];
      if (m.ok) { p.resolve(m.result); } else { p.reject(new Error(m.error)); }
    }
  };
  function py(fn, args) {
    return new Promise(function (resolve, reject) {
      var id = nextId++;
      pending[id] = { resolve: resolve, reject: reject };
      worker.postMessage({ id: id, fn: fn, args: args });
    });
  }

  // ---- reading and writing the address ---------------------------------
  function clampInt(text, dflt, lo, hi) {
    var v = parseInt(text, 10);
    if (isNaN(v)) { v = dflt; }
    if (v === null) { return null; }
    return Math.max(lo, Math.min(v, hi));
  }
  function today() {
    var d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function validDate(text) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text || "")) { return null; }
    var d = new Date(text + "T00:00:00");
    if (isNaN(d)) { return null; }
    var now = new Date(), limit = new Date(); limit.setFullYear(now.getFullYear() - 5);
    return d <= now && d >= limit ? text : null;
  }
  function newSeed() { return 1 + Math.floor(Math.random() * MAX_SEED); }
  function currentParams() {
    var q = new URLSearchParams(location.search), theme = q.get("theme");
    if (CFG.themes.indexOf(theme) < 0) { return null; }
    return {
      theme: theme,
      rows: clampInt(q.get("rows"), DEFAULT_ROWS, 1, CFG.maxRows),
      cols: clampInt(q.get("cols"), DEFAULT_COLS, 1, CFG.maxCols),
      seed: clampInt(q.get("seed"), null, 0, MAX_SEED),
      d: validDate(q.get("d"))
    };
  }
  function toQuery(p) {
    var q = new URLSearchParams();
    q.set("theme", p.theme); q.set("rows", p.rows); q.set("cols", p.cols);
    if (p.seed !== null && p.seed !== undefined) { q.set("seed", p.seed); }
    if (p.d) { q.set("d", p.d); }
    return "?" + q.toString();
  }
  function go(query, replace) {
    var url = location.pathname + query;
    if (replace) { history.replaceState(null, "", url); } else { history.pushState(null, "", url); }
    render();
  }

  // ---- drawing ----------------------------------------------------------
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function art(t) { return '<div class="art" style="background:' + esc(t.hue) + '"><i>' + esc(t.title[0]) + "</i><b>" + esc(t.title) + "</b></div>"; }
  function shell(inner, title, hue) {
    return '<a class="veil on" href="' + location.pathname + '" data-close aria-label="Close"></a>' +
      '<aside class="drawer on" aria-label="' + esc(title || "Dataset") + '">' + inner + "</aside>";
  }
  function showDrawerMessage(text) {
    document.body.classList.add("has-drawer");
    root.innerHTML = shell('<a class="close" href="' + location.pathname + '" data-close aria-label="Close">&times;</a><p class="loading">' + esc(text) + "</p>");
  }
  function closeDrawer() { document.body.classList.remove("has-drawer"); root.innerHTML = ""; document.title = "Data Foundry"; }

  function drawTable(t, p) {
    var head = t.cols.map(function (c) { return "<th>" + esc(c) + "</th>"; }).join("");
    var body = t.rows.map(function (r) {
      return "<tr>" + r.map(function (v, i) { return "<td" + (t.numeric[i] ? ' class="num"' : "") + ">" + esc(v) + "</td>"; }).join("") + "</tr>";
    }).join("");
    var docs = t.docs.map(function (d) { return "<dt>" + esc(d[0]) + "</dt><dd>" + esc(d[1]) + "</dd>"; }).join("");
    var home = location.pathname;
    var inner =
      '<div class="dh">' + art(t) + "</div>" +
      '<a class="close" href="' + home + '" data-close aria-label="Close">&times;</a>' +
      '<div class="dbody"><p class="meaning">' + esc(t.row_meaning) + "</p>" +
      '<form class="ctl" id="ctl">' +
      '<div><label for="rows">Rows</label><input id="rows" name="rows" type="number" min="1" max="' + CFG.maxRows + '" value="' + t.n_rows + '"></div>' +
      '<div><label for="cols">Columns</label><input id="cols" name="cols" type="number" min="1" max="' + CFG.maxCols + '" value="' + t.n_cols + '"></div>' +
      '<div><label for="seed">Seed</label><input id="seed" name="seed" type="number" min="0" max="' + MAX_SEED + '" value="' + t.seed + '" class="wide"></div>' +
      '<button class="go" type="submit" style="background:' + esc(t.hue) + '">Update</button>' +
      '<a class="b2" href="#" id="fresh">New random table</a></form>' +
      '<p class="hint">' + esc(t.title) + " supplies " + t.min_cols + "&ndash;" + t.max_cols + " columns. Same seed and settings give the same table.</p>" +
      (t.note ? '<div class="note">' + esc(t.note) + "</div>" : "") +
      '<div class="tw"><table><thead><tr>' + head + "</tr></thead><tbody>" + body + "</tbody></table></div>" +
      '<div class="bar"><button class="b2" type="button" id="dl-csv">Download CSV</button>' +
      '<button class="b2" type="button" id="dl-xlsx">Download Excel</button>' +
      '<button class="b2" type="button" id="copy">Copy pandas line</button></div>' +
      "<details open><summary>What the columns mean</summary><dl>" + docs + "</dl></details></div>";
    document.body.classList.add("has-drawer");
    root.innerHTML = shell(inner, t.title);
    document.title = t.title + " - Data Foundry";

    document.getElementById("ctl").addEventListener("submit", function (e) {
      e.preventDefault();
      var f = e.target;
      go(toQuery({
        theme: p.theme,
        rows: clampInt(f.rows.value, DEFAULT_ROWS, 1, CFG.maxRows),
        cols: clampInt(f.cols.value, DEFAULT_COLS, 1, CFG.maxCols),
        seed: clampInt(f.seed.value, newSeed(), 0, MAX_SEED),
        d: p.d
      }));
    });
    document.getElementById("fresh").addEventListener("click", function (e) {
      e.preventDefault();
      go(toQuery({ theme: p.theme, rows: p.rows, cols: p.cols, seed: newSeed(), d: today() }));
    });
    document.getElementById("dl-csv").addEventListener("click", function () { download(p, "make_csv", t.csv_name, "text/csv", this); });
    document.getElementById("dl-xlsx").addEventListener("click", function () {
      download(p, "make_xlsx", t.xlsx_name, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", this);
    });
    var copy = document.getElementById("copy");
    copy.addEventListener("click", function () {
      var text = 'import pandas as pd\n\ndf = pd.read_csv("' + t.csv_name + '")\ndf.head()';
      if (navigator.clipboard) { navigator.clipboard.writeText(text); copy.textContent = "Copied"; }
    });
  }

  function download(p, fn, name, type, button) {
    var label = button.textContent;
    button.textContent = fn === "make_xlsx" ? "Preparing Excel..." : "Preparing...";
    button.disabled = true;
    py(fn, [p.theme, p.rows, p.cols, p.seed, p.d]).then(function (data) {
      var url = URL.createObjectURL(new Blob([data], { type: type }));
      var a = document.createElement("a");
      a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
      button.textContent = label;
    }).catch(function (err) {
      button.textContent = "Failed - " + (fn === "make_xlsx" ? "Excel needs a connection to load" : "try again");
      console.error(err);
    }).finally(function () { button.disabled = false; });
  }

  function render() {
    var p = currentParams();
    if (!p) { closeDrawer(); return; }
    if (p.seed === null || !p.d) {          // complete the address so a reload gives the same table
      p.seed = p.seed === null ? newSeed() : p.seed;
      p.d = p.d || today();
      history.replaceState(null, "", location.pathname + toQuery(p));
    }
    if (!engineReady) { showDrawerMessage("Starting the Python engine - the first visit takes a few seconds."); return; }
    var token = ++renderToken;
    py("make_table", [p.theme, p.rows, p.cols, p.seed, p.d]).then(function (json) {
      if (token === renderToken) { drawTable(JSON.parse(json), p); }
    }).catch(function (err) {
      if (token === renderToken) { showDrawerMessage("Could not build that table: " + err.message); }
    });
  }

  // ---- navigation -------------------------------------------------------
  document.addEventListener("click", function (e) {
    var a = e.target.closest("a");
    if (!a) { return; }
    if (a.id === "surprise") {
      e.preventDefault();
      go("?theme=" + CFG.themes[Math.floor(Math.random() * CFG.themes.length)]);
    } else if (a.dataset.theme) {
      e.preventDefault();
      go("?theme=" + a.dataset.theme);
    } else if (a.hasAttribute("data-close")) {
      e.preventDefault();
      history.pushState(null, "", location.pathname);
      closeDrawer();
    }
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && document.body.classList.contains("has-drawer")) {
      history.pushState(null, "", location.pathname);
      closeDrawer();
    }
  });
  window.addEventListener("popstate", render);
  render();
})();
