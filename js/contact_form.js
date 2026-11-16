(function () {
    'use strict';

    var form = document.getElementById('contact_form_element');
    var modal = document.getElementById('form_modal');

    if (!form || !modal) {
        return;
    }

    var root = document.documentElement;
    var body = document.body;
    var submitButton = form.querySelector('.form_submit');
    var statusBox = form.querySelector('.form_status');
    var mailLink = form.querySelector('.form_mail_link');
    var honeypot = form.querySelector('.form_honeypot');
    var accessKeyInput = form.querySelector('input[name="access_key"]');
    var modalBody = modal.querySelector('.form_modal_body');
    var modalList = modal.querySelector('.form_modal_list');
    var modalClose = modal.querySelector('.form_modal_close');

    var ENDPOINT = form.getAttribute('action') || 'https://api.web3forms.com/submit';
    var KEY_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    var EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    var STORAGE_KEY = 'contact_form_last_sent';
    var MODAL_FADE_MS = 300;
    var MAX_MAILTO_BODY = 1500;

    function readSeconds(attributeName, fallback) {
        var value = parseFloat(form.getAttribute(attributeName));
        return isFinite(value) && value >= 0 ? value : fallback;
    }

    var SUCCESS_RESET_MS = readSeconds('data-success-reset-seconds', 4) * 1000;
    var ERROR_RESET_MS = readSeconds('data-error-reset-seconds', 4) * 1000;
    var COOLDOWN_MS = readSeconds('data-cooldown-seconds', 30) * 1000;
    var MIN_FILL_MS = readSeconds('data-min-fill-seconds', 2) * 1000;
    var TIMEOUT_MS = readSeconds('data-timeout-seconds', 15) * 1000;

    var fields = [];
    var loadedAt = Date.now();
    var interactionAt = 0;
    var isSending = false;
    var resetTimer = null;
    var memoryLastSent = 0;

    var isModalOpen = false;
    var isLocked = false;
    var unlockTimer = null;
    var inertAdded = [];
    var firstInvalidField = null;
    var touchStartY = 0;

    function each(list, callback) {
        Array.prototype.forEach.call(list, callback);
    }

    function updateValueState(field) {
        field.control.classList.toggle('has_value', field.input.value.length > 0);
    }

    function setInvalid(field, invalid) {
        field.wrapper.classList.toggle('is_invalid', invalid);
        field.input.setAttribute('aria-invalid', invalid ? 'true' : 'false');
    }

    function checkField(field) {
        var value = field.input.value.trim();
        if (!value) {
            return field.input.getAttribute('data-msg-required') || '';
        }
        if (field.input.type === 'email' && !EMAIL_PATTERN.test(value)) {
            return field.input.getAttribute('data-msg-invalid') || field.input.getAttribute('data-msg-required') || '';
        }
        return '';
    }

    function markInteraction() {
        if (!interactionAt) {
            interactionAt = Date.now();
        }
    }

    function readLastSent() {
        try {
            return parseInt(window.localStorage.getItem(STORAGE_KEY), 10) || memoryLastSent;
        } catch (error) {
            return memoryLastSent;
        }
    }

    function writeLastSent(timestamp) {
        memoryLastSent = timestamp;
        try {
            window.localStorage.setItem(STORAGE_KEY, String(timestamp));
        } catch (error) {
            memoryLastSent = timestamp;
        }
    }

    function showStatus(type, key, seconds) {
        var text = statusBox.getAttribute('data-msg-' + key) || '';
        text = text.replace('{seconds}', String(seconds));
        statusBox.textContent = text;
        statusBox.setAttribute('data-type', type);
        statusBox.classList.toggle('is_visible', text.length > 0);
    }

    function hideStatus() {
        statusBox.textContent = '';
        statusBox.removeAttribute('data-type');
        statusBox.classList.remove('is_visible');
    }

    function setState(state) {
        submitButton.setAttribute('data-state', state);
        submitButton.setAttribute('aria-busy', state === 'sending' ? 'true' : 'false');
        submitButton.disabled = state !== 'idle';
    }

    function scheduleIdle(delay) {
        window.clearTimeout(resetTimer);
        resetTimer = window.setTimeout(function () {
            setState('idle');
        }, delay);
    }

    function getValue(name) {
        var element = form.querySelector('[name="' + name + '"]');
        return element ? element.value.trim() : '';
    }

    function updateMailLink() {
        if (!mailLink) {
            return;
        }
        var address = mailLink.getAttribute('data-mailto') || '';
        var lines = [];
        if (getValue('name')) {
            lines.push('姓名：' + getValue('name'));
        }
        if (getValue('email')) {
            lines.push('Email：' + getValue('email'));
        }
        if (getValue('message')) {
            lines.push('');
            lines.push(getValue('message'));
        }
        var mailBody = lines.join('\n').slice(0, MAX_MAILTO_BODY);
        mailLink.setAttribute('href', 'mailto:' + address +
            '?subject=' + encodeURIComponent(getValue('subject')) +
            '&body=' + encodeURIComponent(mailBody));
    }

    function resetForm() {
        form.reset();
        fields.forEach(function (field) {
            field.touched = false;
            setInvalid(field, false);
            updateValueState(field);
        });
        interactionAt = 0;
    }

    function lockPage() {
        if (isLocked) {
            return;
        }
        var scrollbarWidth = window.innerWidth - root.clientWidth;
        body.style.transition = 'none';
        root.style.transition = 'none';
        root.classList.add('modal_locked');
        body.style.paddingRight = scrollbarWidth > 0 ? scrollbarWidth + 'px' : '';
        void body.offsetWidth;
        body.style.transition = '';
        root.style.transition = '';
        isLocked = true;
    }

    function unlockPage() {
        if (!isLocked) {
            return;
        }
        body.style.transition = 'none';
        root.style.transition = 'none';
        root.classList.remove('modal_locked');
        body.style.paddingRight = '';
        void body.offsetWidth;
        body.style.transition = '';
        root.style.transition = '';
        isLocked = false;
    }

    function setPageInert(on) {
        if (on) {
            inertAdded = [];
            each(document.querySelectorAll('header, main, footer'), function (block) {
                if (!block.hasAttribute('inert')) {
                    block.setAttribute('inert', '');
                    inertAdded.push(block);
                }
            });
        } else {
            inertAdded.forEach(function (block) {
                block.removeAttribute('inert');
            });
            inertAdded = [];
        }
    }

    function openModal(errors) {
        window.clearTimeout(unlockTimer);
        modalList.innerHTML = '';
        errors.forEach(function (error) {
            var item = document.createElement('li');
            var label = document.createElement('span');
            var message = document.createElement('span');
            item.className = 'form_modal_item';
            label.className = 'form_modal_item_label';
            message.className = 'form_modal_item_msg';
            label.textContent = error.label;
            message.textContent = error.message;
            item.appendChild(label);
            item.appendChild(message);
            modalList.appendChild(item);
        });
        modalBody.scrollTop = 0;
        firstInvalidField = errors.length ? errors[0].field : null;
        lockPage();
        isModalOpen = true;
        modal.classList.add('is_open');
        setPageInert(true);
        modalClose.focus();
    }

    function closeModal() {
        if (!isModalOpen) {
            return;
        }
        isModalOpen = false;
        modal.classList.remove('is_open');
        setPageInert(false);
        unlockTimer = window.setTimeout(unlockPage, MODAL_FADE_MS);
        if (firstInvalidField) {
            firstInvalidField.input.focus();
        }
    }

    function handleResult(result) {
        if (result.ok && result.data && result.data.success === true) {
            isSending = false;
            setState('success');
            showStatus('success', 'success');
            writeLastSent(Date.now());
            resetForm();
            scheduleIdle(SUCCESS_RESET_MS);
        } else {
            handleFailure('error');
        }
    }

    function handleFailure(key) {
        isSending = false;
        setState('error');
        showStatus('error', key);
        updateMailLink();
        scheduleIdle(ERROR_RESET_MS);
    }

    function sendMessage() {
        if (!window.fetch || !window.Promise) {
            handleFailure('network');
            return;
        }
        isSending = true;
        window.clearTimeout(resetTimer);
        setState('sending');
        showStatus('info', 'sending');

        var payload = {
            access_key: accessKeyInput.value.trim(),
            name: getValue('name'),
            email: getValue('email'),
            subject: getValue('subject'),
            message: getValue('message')
        };
        var controller = window.AbortController ? new AbortController() : null;
        var timeoutId = null;
        var timeoutPromise = new Promise(function (resolve, reject) {
            timeoutId = window.setTimeout(function () {
                if (controller) {
                    controller.abort();
                }
                reject(new Error('timeout'));
            }, TIMEOUT_MS);
        });
        var request = window.fetch(ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(payload),
            signal: controller ? controller.signal : undefined
        }).then(function (response) {
            return response.json().then(function (data) {
                return { ok: response.ok, data: data };
            }, function () {
                return { ok: response.ok, data: null };
            });
        });

        Promise.race([request, timeoutPromise]).then(function (result) {
            window.clearTimeout(timeoutId);
            handleResult(result);
        }, function () {
            window.clearTimeout(timeoutId);
            handleFailure('network');
        });
    }

    function handleSubmit() {
        if (document.activeElement && document.activeElement.blur) {
            document.activeElement.blur();
        }

        var errors = [];
        fields.forEach(function (field) {
            var message = checkField(field);
            setInvalid(field, !!message);
            if (message) {
                errors.push({
                    field: field,
                    label: field.input.getAttribute('data-label') || '',
                    message: message
                });
            }
        });
        if (errors.length) {
            hideStatus();
            openModal(errors);
            return;
        }

        var now = Date.now();
        var startedAt = interactionAt || loadedAt;
        if ((honeypot && honeypot.checked) || now - startedAt < MIN_FILL_MS) {
            setState('error');
            showStatus('error', 'spam');
            scheduleIdle(ERROR_RESET_MS);
            return;
        }

        var remaining = COOLDOWN_MS - (now - readLastSent());
        if (remaining > 0) {
            showStatus('error', 'cooldown', Math.ceil(remaining / 1000));
            return;
        }

        if (!accessKeyInput || !KEY_PATTERN.test(accessKeyInput.value.trim())) {
            if (window.console && console.warn) {
                console.warn('[contact_form] 尚未設定有效的 Web3Forms Access Key，訊息未送出。請修改 contact_fixed.html 內 name="access_key" 的 value。');
            }
            handleFailure('nokey');
            return;
        }

        sendMessage();
    }

    each(form.querySelectorAll('.form_field'), function (wrapper) {
        var input = wrapper.querySelector('.form_input');
        var control = wrapper.querySelector('.form_control');
        var clear = wrapper.querySelector('.form_clear');
        if (!input || !control) {
            return;
        }
        var field = { wrapper: wrapper, control: control, input: input, clear: clear, touched: false };
        fields.push(field);

        input.addEventListener('focus', markInteraction);

        input.addEventListener('input', function () {
            markInteraction();
            field.touched = true;
            updateValueState(field);
            if (wrapper.classList.contains('is_invalid') && !checkField(field)) {
                setInvalid(field, false);
            }
            if (!isSending && submitButton.getAttribute('data-state') === 'idle') {
                hideStatus();
            }
        });

        input.addEventListener('change', function () {
            updateValueState(field);
        });

        input.addEventListener('blur', function () {
            if (field.touched) {
                setInvalid(field, !!checkField(field));
            }
        });

        if (clear) {
            clear.addEventListener('mousedown', function (event) {
                event.preventDefault();
            });
            clear.addEventListener('click', function () {
                input.value = '';
                updateValueState(field);
                input.focus();
            });
        }

        updateValueState(field);
    });

    form.addEventListener('submit', function (event) {
        event.preventDefault();
        if (isSending || submitButton.disabled) {
            return;
        }
        handleSubmit();
    });

    modalClose.addEventListener('click', closeModal);

    modal.addEventListener('click', function (event) {
        if (event.target === modal) {
            closeModal();
        }
    });

    document.addEventListener('keydown', function (event) {
        if (!isModalOpen) {
            return;
        }
        if (event.key === 'Escape' || event.key === 'Esc') {
            closeModal();
        } else if (event.key === 'Tab') {
            var first = modalClose;
            var last = modalBody;
            if (!modal.contains(document.activeElement)) {
                event.preventDefault();
                first.focus();
            } else if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        }
    });

    modal.addEventListener('touchstart', function (event) {
        touchStartY = event.touches[0].clientY;
    }, { passive: true });

    modal.addEventListener('touchmove', function (event) {
        var scroller = event.target.closest ? event.target.closest('.form_modal_body') : null;
        if (!scroller || scroller.scrollHeight <= scroller.clientHeight) {
            event.preventDefault();
            return;
        }
        var deltaY = event.touches[0].clientY - touchStartY;
        var atTop = scroller.scrollTop <= 0;
        var atBottom = scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 1;
        if ((atTop && deltaY > 0) || (atBottom && deltaY < 0)) {
            event.preventDefault();
        }
    }, { passive: false });

    window.addEventListener('pageshow', function (event) {
        if (event.persisted) {
            closeModal();
        }
    });
})();

/*
==========================================================
逐行說明（為什麼這樣寫）
==========================================================

★ 如何調整秒數（不需要改這支 JS）
  所有秒數都寫在 contact_fixed.html 的 <form> 標籤上，直接改數字即可（單位：秒，可以寫小數）：
    data-success-reset-seconds="4"  → 發送成功後，按鈕幾秒後恢復成「送出訊息」
    data-error-reset-seconds="4"    → 發送失敗後，按鈕幾秒後恢復成「送出訊息」
    data-cooldown-seconds="30"      → 成功送出後，幾秒內不能再次送出
    data-min-fill-seconds="2"       → 從第一次操作欄位起，至少幾秒才允許送出
    data-timeout-seconds="15"       → 超過幾秒沒有回應就視為送出失敗
  例如想把冷卻時間改成 60 秒：把 data-cooldown-seconds="30" 改成 data-cooldown-seconds="60"。
  設成 0 代表不限制（冷卻、最短填寫時間）。
  按鈕的動畫速度（.3 秒）則寫在 contact_form.css 的 transition 裡，與上面的秒數無關。

【整體包裝】
(function () { ... })();
  立即執行函式，所有變數包在裡面，不會與 navigation.js 或其他 JS（例如 accordion_panel.js 使用了全域變數 acc 與 i）互相覆蓋。
'use strict';
  嚴格模式，寫錯變數名稱時直接報錯，方便除錯。

【抓取元素】
var form = document.getElementById('contact_form_element');
  取得表單。
var modal = document.getElementById('form_modal');
  取得驗證彈跳視窗。
if (!form || !modal) { return; }
  頁面上缺少表單或彈跳視窗就不啟動，避免其他頁面引用這支 JS 時出錯。
var root / body
  <html> 與 <body>，用來鎖定背景捲動。
var submitButton / statusBox / mailLink / honeypot / accessKeyInput
  送出按鈕、結果提示區、備用 Email 連結、蜜罐欄位、Access Key 欄位。
var modalBody / modalList / modalClose
  彈跳視窗的內容區、錯誤清單、關閉按鈕。

【常數】
var ENDPOINT = form.getAttribute('action') || '...';
  送出網址，讀取表單的 action，沒有就使用 Web3Forms 的網址。
var KEY_PATTERN = /^[0-9a-f]{8}-...$/i;
  Web3Forms 的 Access Key 是 UUID 格式（8-4-4-4-12 個英數字）。用來判斷 key 是否有效，佔位字串 YOUR_ACCESS_KEY_HERE 不符合，所以沒設定 key 時不會送出。
var EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  簡易 Email 格式檢查：@ 前後都要有字、@ 後面要有「.」加 2 個字以上的網域。
var STORAGE_KEY = 'contact_form_last_sent';
  在瀏覽器暫存「上次成功送出的時間」所用的名稱，重新整理頁面也不能繞過冷卻時間。
var MODAL_FADE_MS = 300;
  彈跳視窗淡出時間，要與 form_modal.css 的 .3s 一致。
var MAX_MAILTO_BODY = 1500;
  備用 Email 連結帶入的內文字數上限，太長的 mailto 連結在部分信箱程式會失效。

function readSeconds(attributeName, fallback) { ... }
  從 <form> 讀取秒數設定。parseFloat 轉成數字；isFinite 與 >= 0 確認是有效數字，無效時使用預設值（fallback）。
var SUCCESS_RESET_MS ... TIMEOUT_MS
  把秒轉成毫秒（乘以 1000），瀏覽器的計時器使用毫秒。

【狀態變數】
var fields = [];
  所有欄位的資料（外框、輸入框、清除按鈕、是否被編輯過）。
var loadedAt = Date.now();
  頁面載入時間，當使用者沒有操作過欄位（例如被自動填入）時，用它當作計算「最短填寫時間」的起點。
var interactionAt = 0;
  使用者第一次操作欄位的時間。
var isSending = false;
  送出中旗標，防止重複提交。
var resetTimer = null;
  按鈕恢復預設狀態的計時器。
var memoryLastSent = 0;
  無法使用瀏覽器儲存（例如 Safari 無痕模式）時，改用記憶體暫存上次送出時間。
var isModalOpen / isLocked / unlockTimer / inertAdded / firstInvalidField / touchStartY
  彈跳視窗是否開啟、背景是否已鎖定、延遲解鎖計時器、被設為 inert 的區塊、第一個錯誤欄位（關閉後要把游標放回去）、手指觸控起點。

【工具函式】
function each(list, callback) { ... }
  讓 NodeList 也能使用 forEach，舊版 Safari 也安全。
function updateValueState(field) { field.control.classList.toggle('has_value', ...); }
  欄位有文字時加上 has_value，CSS 就會顯示右側的清除按鈕。
function setInvalid(field, invalid) { ... }
  切換紅色線框（is_invalid）與 aria-invalid，讓讀屏軟體也知道這個欄位有錯。
function checkField(field) { ... }
  檢查單一欄位，回傳錯誤文字（空字串代表沒問題）。
var value = field.input.value.trim();
  去除前後空白，避免使用者只輸入空白就通過。
getAttribute('data-msg-required') / 'data-msg-invalid'
  錯誤文字讀自 HTML 欄位上的 data- 屬性，所以文案只要改 HTML。
field.input.type === 'email' && !EMAIL_PATTERN.test(value)
  Email 欄位另外檢查格式。
function markInteraction() { if (!interactionAt) { interactionAt = Date.now(); } }
  只記錄「第一次」操作的時間。

function readLastSent() / writeLastSent(timestamp)
  讀取與寫入上次成功送出的時間。用 try / catch 包住是因為 Safari 無痕模式等情況使用 localStorage 會丟出錯誤，這時就退回使用記憶體變數。

function showStatus(type, key, seconds) { ... }
  顯示結果提示。key 對應 HTML 提示區的 data-msg-XXX；把文字中的 {seconds} 換成剩餘秒數；type 決定顏色（success、error、info）；文字為空時不展開。
function hideStatus() { ... }
  清空並收合提示區。
function setState(state) { ... }
  切換送出按鈕狀態：把 data-state 改成 idle / sending / success / error，CSS 依此切換圖示與文字動畫；aria-busy 告知讀屏軟體處理中；只有 idle 狀態按鈕才可點擊（disabled），這就是「送出期間避免重複提交」的第一道防線。
function scheduleIdle(delay) { ... }
  經過 delay 毫秒後把按鈕恢復成 idle。先清掉舊計時器，避免多個計時器互相干擾。
function getValue(name) { ... }
  依欄位 name 取得去除前後空白的值。
function updateMailLink() { ... }
  送出失敗時，把使用者已填寫的姓名、Email、訊息、主旨帶入備用 Email 連結，使用者點擊後可以直接用信箱程式寄出。
encodeURIComponent(...)
  把中文與特殊符號轉成網址可用的格式。.slice(0, MAX_MAILTO_BODY) 限制長度。
function resetForm() { ... }
  成功送出後清空表單：form.reset() 還原所有欄位，並清掉紅框、清除按鈕狀態與第一次操作時間。

【背景鎖定（與燈箱相同的做法）】
function lockPage() { ... }
  彈跳視窗開啟時，禁止捲動背景。
if (isLocked) { return; }
  已鎖定就不重複執行。
var scrollbarWidth = window.innerWidth - root.clientWidth;
  電腦版捲軸寬度（手機通常是 0），要在隱藏捲軸前計算。
body.style.transition = 'none'; root.style.transition = 'none';
  base.css 的 html 與 body 有 transition: all .3s，補償 padding 時會產生慢慢位移的晃動，所以暫時關閉。
root.classList.add('modal_locked');
  替 <html> 加上 overflow: hidden（CSS 設定）。刻意不使用 position: fixed，因為會讓捲動位置歸零並觸發 navigation.js 的捲動監聽，導覽列會誤切換。
body.style.paddingRight = ...
  捲軸消失後頁面變寬，補上同寬度的 padding 讓內容不位移。
void body.offsetWidth;
  強迫瀏覽器立刻套用變更，之後還原 transition 才不會被當成動畫。
function unlockPage() { ... }
  解除鎖定，步驟相反。

function setPageInert(on) { ... }
  彈跳視窗開啟時，把 header、main、footer 設為 inert，讓導覽列與頁面內容無法被點擊或用鍵盤選到。只移除自己加過的 inert，不影響 navigation.js。

【彈跳視窗】
function openModal(errors) { ... }
window.clearTimeout(unlockTimer);
  剛關閉又馬上打開時，取消延遲解鎖。
modalList.innerHTML = '';
  清空舊的錯誤清單。
document.createElement('li') ... textContent
  用 createElement 與 textContent 建立清單項目（不使用 innerHTML 塞入文字，避免任何文字被當成 HTML 執行）。
label.textContent = error.label; message.textContent = error.message;
  欄位名稱與錯誤文字，內容都來自 HTML 的 data- 屬性。
modalBody.scrollTop = 0;
  每次開啟都從內容最上方開始。
firstInvalidField = ...
  記錄第一個錯誤欄位，關閉後游標回到這裡。
lockPage(); isModalOpen = true; modal.classList.add('is_open');
  鎖定背景、更新狀態、顯示視窗（CSS 由下往上模糊淡入）。
setPageInert(true); modalClose.focus();
  鎖住背後頁面，並把鍵盤焦點移到關閉按鈕。

function closeModal() { ... }
  關閉視窗（CSS 由上往下模糊淡出），解除 inert，等淡出結束（MODAL_FADE_MS）再解除背景鎖定，最後把游標放回第一個錯誤欄位。

【送出結果處理】
function handleResult(result) { ... }
  收到 Web3Forms 回應後判斷。
if (result.ok && result.data && result.data.success === true)
  必須「HTTP 狀態正常」且「回傳內容 success 為 true」才算成功，只要有一項不符就視為失敗，不會假裝成功。
成功時：setState('success')、顯示成功文字、記錄成功時間（冷卻用）、清空表單、SUCCESS_RESET_MS 後恢復按鈕。
function handleFailure(key) { ... }
  失敗時：按鈕變成失敗狀態、顯示對應文字（error：伺服器拒絕 / network：網路或逾時 / nokey：沒設定 Key / spam：疑似機器人）、更新備用 Email 連結、ERROR_RESET_MS 後恢復按鈕。

function sendMessage() { ... }
if (!window.fetch || !window.Promise) { handleFailure('network'); return; }
  非常舊的瀏覽器不支援 fetch 時，直接視為失敗，並提供備用 Email。
isSending = true; window.clearTimeout(resetTimer); setState('sending'); showStatus('info', 'sending');
  進入送出中：鎖定、按鈕顯示「發送中」。
var payload = { access_key, name, email, subject, message };
  要送出的資料。欄位名稱必須是 Web3Forms 規定的名稱。
var controller = window.AbortController ? new AbortController() : null;
  取得可以中止請求的物件（舊瀏覽器沒有就設為 null）。
var timeoutPromise = new Promise(...)
  設定逾時：超過 TIMEOUT_MS 毫秒沒有回應，就中止請求並視為失敗。
var request = window.fetch(ENDPOINT, { method: 'POST', headers..., body: JSON.stringify(payload), signal })
  用 JSON 格式送出到 Web3Forms（官方文件支援的寫法）。
.then(function (response) { return response.json().then(...) })
  讀取回應內容；如果回應不是 JSON（例如伺服器錯誤頁），就把 data 設為 null，後面會被判為失敗。
Promise.race([request, timeoutPromise]).then(成功處理, 失敗處理)
  「請求完成」與「逾時」誰先發生就用誰的結果；任何網路錯誤也會進入失敗處理。每次都 clearTimeout，避免計時器殘留。

function handleSubmit() { ... }
  按下送出後的完整檢查流程，依序如下：
document.activeElement.blur();
  先讓輸入框失去焦點，手機的鍵盤會收起來，彈跳視窗才不會被鍵盤擠壓。
1. 逐一檢查所有欄位 → 有錯就標紅框、開啟彈跳視窗、結束，不會送出。
2. 防垃圾訊息：蜜罐被勾選（機器人才會勾）、或從第一次操作到送出少於 MIN_FILL_MS（人類不可能這麼快）→ 不送出。
3. 冷卻時間：距離上次成功送出不到 COOLDOWN_MS → 顯示剩餘秒數，不送出。
4. Access Key 檢查：不是有效格式 → 在主控台提醒你設定，按鈕顯示失敗與「訊息尚未送出」，不會假裝成功。
5. 全部通過才呼叫 sendMessage() 真正送出。

【欄位事件】
each(form.querySelectorAll('.form_field'), function (wrapper) { ... });
  替每個欄位綁定事件，並存進 fields。
focus → markInteraction：記錄第一次操作時間。
input：使用者輸入時，標記為編輯過（touched）、更新清除按鈕、若原本有紅框且現在內容正確就立刻移除紅框；如果上次的結果提示還在（按鈕為 idle），輸入時清掉它。
change：處理瀏覽器自動填入，同樣更新清除按鈕。
blur：離開欄位時，只有「編輯過」的欄位才檢查並顯示紅框，所以只是用 Tab 經過空欄位不會亂跳紅框。
clear 的 mousedown preventDefault：避免點清除按鈕時，輸入框先失去焦點而觸發紅框。
clear 的 click：清空內容、更新按鈕狀態、把游標放回輸入框（手機鍵盤保持開啟，方便重新輸入）。
updateValueState(field);
  頁面載入時就先檢查一次（瀏覽器可能保留舊內容）。

form.addEventListener('submit', ...)
  攔截表單送出（按按鈕或在單行欄位按 Enter 都會進來）。event.preventDefault() 阻止瀏覽器直接跳轉頁面；若正在送出或按鈕被鎖定就不處理，這是「避免重複提交」的第二道防線。

【彈跳視窗事件】
modalClose click → 關閉。
modal click：if (event.target === modal) → 只有點到視窗以外的空白處（遮罩）才關閉，點到視窗內不會關閉。
keydown：只在視窗開啟時處理。Esc 關閉；Tab 只會在「關閉按鈕」與「內容區（可用鍵盤捲動）」之間循環，不會跑到被鎖住的頁面。
touchstart：記錄手指起點。
touchmove（{ passive: false }）：
  手機上滑動時，若手指不在內容區、或內容沒有超出高度，就阻止滑動（避免背景頁面跟著捲動）；
  若在內容區內滑動，允許捲動，但捲到最上方還往下拉、或捲到最下方還往上拉時阻止，避免捲動「穿透」到背景。這是 iOS Safari 對 overflow: hidden 支援不穩定時最可靠的補強。passive: false 才能使用 preventDefault。
pageshow：Safari 的「上一頁」可能從快取還原整個頁面，若彈跳視窗是開著的就關閉，避免卡住。
*/
