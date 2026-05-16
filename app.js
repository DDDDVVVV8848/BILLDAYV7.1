const categories = ["餐饮", "交通", "购物", "房租水电", "娱乐", "医疗", "学习", "通讯", "信用卡/账单", "收入", "其他"];
const categoryRules = {
  餐饮: ["美团", "饿了么", "外卖", "餐", "饭", "咖啡", "奶茶", "星巴克", "瑞幸", "麦当劳", "肯德基", "火锅", "超市"],
  交通: ["地铁", "公交", "滴滴", "高德", "打车", "出租", "加油", "停车", "铁路", "机票", "12306"],
  购物: ["淘宝", "天猫", "京东", "拼多多", "抖音商城", "得物", "小红书", "购买", "商店", "便利店"],
  房租水电: ["房租", "租金", "水费", "电费", "燃气", "物业", "宽带"],
  娱乐: ["电影", "游戏", "会员", "音乐", "视频", "影院", "KTV", "旅游"],
  医疗: ["医院", "药", "诊所", "医保", "体检"],
  学习: ["课程", "书", "培训", "考试", "订阅", "知识"],
  通讯: ["话费", "流量", "移动", "联通", "电信"],
  "信用卡/账单": ["信用卡", "花呗", "白条", "还款", "账单", "分期", "贷款"]
};
const storageKey = "bill-day-pocket-state-v2";
const receiptCropBase = { width: 1260, height: 2736 };
const receiptCropBox = {
  left: 388,
  top: 528,
  right: 955,
  bottom: 891
};
const money = new Intl.NumberFormat("zh-CN", { style: "currency", currency: "CNY", maximumFractionDigits: 2 });
let state = loadState();
let entryType = "expense";

const $ = (id) => document.getElementById(id);
const today = () => new Date().toISOString().slice(0, 10);
const monthKey = (date) => date.slice(0, 7);

function loadState() {
  const fallback = {
    entries: [],
    settings: { billDay: "", monthlyBillEstimate: "", savingGoal: "" }
  };
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
    const merged = saved ? { ...fallback, ...saved, settings: { ...fallback.settings, ...(saved.settings || {}) } } : fallback;
    if (!merged.settings.userTargetsMigrated) {
      if (merged.settings.billDay === 20) merged.settings.billDay = "";
      if (merged.settings.monthlyBillEstimate === 3000) merged.settings.monthlyBillEstimate = "";
      if (merged.settings.savingGoal === 1200) merged.settings.savingGoal = "";
      delete merged.settings.monthlyIncomeTarget;
      merged.settings.userTargetsMigrated = true;
      localStorage.setItem(storageKey, JSON.stringify(merged));
    }
    return merged;
  } catch {
    return fallback;
  }
}

function persist() {
  localStorage.setItem(storageKey, JSON.stringify(state));
}

function daysUntilBill(day) {
  const billDay = Number(day);
  if (!Number.isFinite(billDay) || billDay < 1 || billDay > 28) return null;
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(now.getFullYear(), now.getMonth(), billDay);
  if (target < start) target.setMonth(target.getMonth() + 1);
  return Math.ceil((target.getTime() - start.getTime()) / 86400000);
}

function classifyText(input) {
  const text = input.trim();
  const scores = Object.entries(categoryRules).map(([category, words]) => ({
    category,
    score: words.reduce((sum, word) => sum + (text.includes(word) ? 1 : 0), 0)
  }));
  scores.sort((a, b) => b.score - a.score);
  return scores[0] && scores[0].score > 0 ? scores[0].category : "其他";
}

function extractAmount(input) {
  const matches = input.match(/(?:￥|¥|CNY|RMB)?\s*(-?\d+(?:,\d{3})*(?:\.\d{1,2})?)/gi);
  if (!matches) return "";
  const nums = matches.map((item) => Number(item.replace(/[^\d.-]/g, ""))).filter((item) => Number.isFinite(item) && Math.abs(item) > 0);
  if (!nums.length) return "";
  return Math.max(...nums.map((item) => Math.abs(item))).toString();
}

function makeSuggestion(category, total) {
  if (category === "餐饮") return "餐饮支出容易被小单累积放大，可以试试每周设一个外卖上限。";
  if (category === "交通") return "交通类可以关注月卡、拼车或减少临时打车。";
  if (category === "购物") return "购物建议加入 24 小时冷静清单，账单日前尤其有效。";
  if (category === "娱乐") return "娱乐订阅可以集中清理一次，保留最常用的 1-2 个。";
  if (category === "信用卡/账单") return "账单类优先保证按时还款，避免利息和滞纳金吞掉储蓄。";
  if (total > 1000) return "这个类别本月占比偏高，适合先设一个可执行的小上限。";
  return "保持记录就已经在帮你省钱了，下一步是找出最常重复的小额消费。";
}

function setMode(nextType) {
  entryType = nextType;
  $("expenseMode").classList.toggle("active", nextType === "expense");
  $("incomeMode").classList.toggle("active", nextType === "income");
  $("categoryWrap").hidden = nextType === "income";
  document.body.classList.toggle("income-mode", nextType === "income");
}

function addEntry(source = "manual") {
  const amount = Number($("amount").value);
  if (!Number.isFinite(amount) || amount <= 0) {
    $("amount").focus();
    return;
  }
  state.entries.unshift({
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    type: entryType,
    amount,
    category: entryType === "income" ? "收入" : $("category").value,
    note: $("note").value.trim(),
    date: $("date").value || today(),
    source
  });
  $("amount").value = "";
  $("note").value = "";
  $("receiptText").value = "";
  persist();
  render();
}

function removeEntry(id) {
  state.entries = state.entries.filter((entry) => entry.id !== id);
  persist();
  render();
}

function updateSetting(id) {
  const raw = $(id).value.trim();
  state.settings[id] = raw === "" ? "" : Number(raw);
  persist();
  render();
}

function setOcrStatus(message) {
  const status = $("ocrStatus");
  if (status) status.textContent = message;
}

function fillReceiptResult(text) {
  const detected = classifyText(text);
  const amount = extractAmount(text);
  setMode("expense");
  $("category").value = detected;
  if (amount) $("amount").value = amount;
  $("note").value = text.split(/\n|，|,|。/).find(Boolean)?.slice(0, 28) || "截图账单";
  setOcrStatus(`已识别为“${detected}”${amount ? `，金额约 ${money.format(Number(amount))}` : ""}。`);
}

function loadOcrLibrary() {
  if (window.Tesseract) return Promise.resolve(window.Tesseract);
  setOcrStatus("正在加载 OCR 组件。页面会继续可用，请稍等。");
  return new Promise((resolve, reject) => {
    const existing = document.querySelector("script[data-ocr]");
    if (existing) {
      existing.addEventListener("load", () => resolve(window.Tesseract));
      existing.addEventListener("error", reject);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
    script.async = true;
    script.dataset.ocr = "true";
    script.onload = () => resolve(window.Tesseract);
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

function cropReceiptRegion(imageElement) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const scaleX = image.naturalWidth / receiptCropBase.width;
      const scaleY = image.naturalHeight / receiptCropBase.height;
      const sourceX = receiptCropBox.left * scaleX;
      const sourceY = receiptCropBox.top * scaleY;
      const sourceWidth = (receiptCropBox.right - receiptCropBox.left) * scaleX;
      const sourceHeight = (receiptCropBox.bottom - receiptCropBox.top) * scaleY;
      const canvas = document.createElement("canvas");
      const outputScale = 2;
      canvas.width = Math.max(1, Math.round(sourceWidth * outputScale));
      canvas.height = Math.max(1, Math.round(sourceHeight * outputScale));
      const context = canvas.getContext("2d");
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/png"));
    };
    image.onerror = reject;
    image.src = imageElement.src;
  });
}

async function analyzeReceipt() {
  const typedText = $("receiptText").value.trim();
  if (typedText) {
    fillReceiptResult(typedText);
    return;
  }

  const preview = $("imagePreview");
  if (!preview.src) {
    setOcrStatus("请先上传截图，或粘贴账单文字。");
    return;
  }

  const button = $("analyzeReceipt");
  button.disabled = true;
  button.textContent = "识别中...";
  setOcrStatus("正在裁剪店铺名称和付款金额区域，然后识别文字。首次使用可能需要 10-30 秒。");

  try {
    const Tesseract = await loadOcrLibrary();
    if (!Tesseract) throw new Error("OCR library unavailable");
    const croppedImage = await cropReceiptRegion(preview);
    const result = await Tesseract.recognize(croppedImage, "chi_sim+eng", {
      logger: (info) => {
        if (info.status === "recognizing text") {
          setOcrStatus(`正在识别文字：${Math.round((info.progress || 0) * 100)}%`);
        } else if (info.status) {
          setOcrStatus(`OCR 准备中：${info.status}`);
        }
      }
    });
    const text = (result.data && result.data.text ? result.data.text : "").trim();
    if (!text) {
      setOcrStatus("没有从截图中识别到文字。可以试试更清晰的截图，或复制 iPhone 实况文本后粘贴。");
      return;
    }
    $("receiptText").value = text;
    fillReceiptResult(text);
  } catch (error) {
    setOcrStatus("图片识别失败。请确认手机能联网，或复制 iPhone 实况文本后粘贴。");
  } finally {
    button.disabled = false;
    button.textContent = "分析类别";
  }
}

function categoryIcon(name) {
  return { 餐饮: "餐", 交通: "行", 购物: "购", 房租水电: "住", 娱乐: "娱", 医疗: "医", 学习: "学", 通讯: "话", "信用卡/账单": "卡" }[name] || "账";
}

function render() {
  const currentMonth = today().slice(0, 7);
  const monthEntries = state.entries.filter((entry) => monthKey(entry.date) === currentMonth);
  const income = monthEntries.filter((entry) => entry.type === "income").reduce((sum, entry) => sum + entry.amount, 0);
  const expense = monthEntries.filter((entry) => entry.type === "expense").reduce((sum, entry) => sum + entry.amount, 0);
  const balance = income - expense;
  const billCountdown = daysUntilBill(state.settings.billDay);
  const billEstimate = Number(state.settings.monthlyBillEstimate) || 0;
  const savingGoal = Number(state.settings.savingGoal) || 0;
  const requiredReserve = billEstimate + savingGoal;
  const available = balance - requiredReserve;
  const dailySafeSpend = billCountdown && billCountdown > 0 ? Math.max(0, available / billCountdown) : 0;
  const categoryTotals = categories
    .map((name) => ({
      name,
      total: monthEntries.filter((entry) => entry.type === "expense" && entry.category === name).reduce((sum, entry) => sum + entry.amount, 0)
    }))
    .filter((item) => item.total > 0)
    .sort((a, b) => b.total - a.total);

  $("billCountdown").textContent = billCountdown === null ? "未设置" : `${billCountdown} 天`;
  $("balance").textContent = money.format(balance);
  $("income").textContent = money.format(income);
  $("expense").textContent = money.format(expense);
  $("dailySafeSpend").textContent = money.format(dailySafeSpend);
  $("requiredReserve").textContent = money.format(requiredReserve);
  $("reserveProgress").style.width = `${Math.min(100, Math.max(6, (balance / Math.max(requiredReserve, 1)) * 100))}%`;
  $("reserveStatus").className = available >= 0 ? "good" : "warn";
  $("reserveStatus").textContent =
    billCountdown === null
      ? "请先设置账单日、预计账单和储蓄目标。"
      : available >= 0
        ? `目前还有 ${money.format(available)} 可自由安排。`
        : `还差 ${money.format(Math.abs(available))} 才能覆盖账单和储蓄目标。`;
  $("advice").textContent = categoryTotals[0] ? makeSuggestion(categoryTotals[0].name, categoryTotals[0].total) : "先记录几笔支出，我会开始识别最值得优化的类别。";

  const chartMax = Math.max(income, expense, 1);
  $("barChart").innerHTML = [
    { label: "收入", value: income, className: "income" },
    { label: "支出", value: expense, className: "expense" }
  ]
    .map((item) => {
      const height = Math.max(8, Math.round((item.value / chartMax) * 100));
      return `<div class="bar-item">
        <div class="bar-value">${money.format(item.value)}</div>
        <div class="bar-column"><span class="${item.className}" style="height:${height}%"></span></div>
        <strong>${item.label}</strong>
      </div>`;
    })
    .join("");

  $("categoryList").innerHTML = categoryTotals.length
    ? categoryTotals.map((item) => `<div class="category-row"><span><i>${categoryIcon(item.name)}</i>${item.name}</span><strong>${money.format(item.total)}</strong></div>`).join("")
    : `<p class="hint">本月还没有支出记录。</p>`;

  $("entryList").innerHTML = state.entries.length
    ? state.entries
        .map(
          (entry) => `<div class="entry">
            <div class="entry-icon ${entry.type}">${entry.type === "income" ? "+" : "-"}</div>
            <div><strong>${escapeHtml(entry.note || entry.category)}</strong><span>${entry.date} · ${entry.category}</span></div>
            <b class="${entry.type}">${entry.type === "income" ? "+" : "-"}${money.format(entry.amount)}</b>
            <button class="icon-button" data-delete="${entry.id}" aria-label="删除记录">删</button>
          </div>`
        )
        .join("")
    : `<p class="hint">还没有记录，先从今天的一笔消费开始。</p>`;
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
}

function boot() {
  $("date").value = today();
  $("category").innerHTML = categories.filter((item) => item !== "收入").map((item) => `<option>${item}</option>`).join("");
  for (const id of ["billDay", "monthlyBillEstimate", "savingGoal"]) {
    $(id).value = state.settings[id] ?? "";
    $(id).addEventListener("input", () => updateSetting(id));
  }
  $("expenseMode").addEventListener("click", () => setMode("expense"));
  $("incomeMode").addEventListener("click", () => setMode("income"));
  $("saveEntry").addEventListener("click", () => addEntry("manual"));
  $("analyzeReceipt").addEventListener("click", analyzeReceipt);
  $("saveReceipt").addEventListener("click", () => addEntry("screenshot"));
  $("entryList").addEventListener("click", (event) => {
    const id = event.target.dataset.delete;
    if (id) removeEntry(id);
  });
  $("imageInput").addEventListener("change", (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      $("imagePreview").src = String(reader.result);
      $("imagePreview").hidden = false;
      $("uploadHint").textContent = "已选择截图";
      setOcrStatus("截图已上传，点“分析类别”开始识别。");
    };
    reader.readAsDataURL(file);
  });
  setMode("expense");
  render();
}

boot();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => undefined));
}
