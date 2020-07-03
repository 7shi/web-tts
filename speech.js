var langs = {};

function initVoices(languages, table) {
    if (languages) langs = languages;
    if (table) {
        table.classList.add("sentences");
        for (let key in languages) {
            let value = languages[key];
            let tr  = document.createElement("tr");
            let td1 = document.createElement("td");
            let td2 = document.createElement("td");
            let sel = document.createElement("select");
            td1.classList.add("speak");
            td1.setAttribute("language", key);
            td1.setAttribute("speak", value.test);
            sel.classList.add("voicelist");
            sel.setAttribute("language", key);
            td2.appendChild(sel);
            tr.appendChild(td1);
            tr.appendChild(td2);
            table.appendChild(tr);
            value.voice = sel;
        }
        let tr  = document.createElement("tr");
        let td1 = document.createElement("td");
        let td2 = document.createElement("td");
        td1.textContent = "読み上げ速度";
        lang_rate = document.createElement("select");
        let rates = [
            [2, "速い"], [1.5, "やや速い"], [1, "普通"], [0.75, "やや遅い"], [0.5, "遅い"]
        ];
        for (let [value, text] of rates) {
            let opt = document.createElement("option");
            opt.value = value;
            opt.textContent = text;
            lang_rate.appendChild(opt);
            if (value == 1) opt.selected = true;
        }
        td2.appendChild(lang_rate);
        tr.appendChild(td1);
        tr.appendChild(td2);
        table.appendChild(tr);
    }
    document.addEventListener("DOMContentLoaded", () => {
        for (let s of Array.from(document.getElementsByClassName("speak"))) {
            if (!s.textContent) {
                s.language = langs[s.getAttribute("language")];
                s.textContent = s.language.name;
            }
            if (!s.speak) s.speak = speakElem;
            s.addEventListener("click", () => speak(s));
        }
    });
    if (!window.speechSynthesis) return;
    let voices = [];
    function setVoices() {
        if (voices.length) return;
        voices = speechSynthesis.getVoices();
        if (!voices.length) return;
        Array.from(document.getElementsByClassName("voicelist")).forEach(addVoices);
    }
    function addVoices(elem) {
        let lang = elem.getAttribute("language");
        let nat = null, sel = null;
        for (let v of voices.filter(v => v.lang.startsWith(lang))) {
            let opt = document.createElement("option");
            opt.text = v.name;
            opt.voice = v;
            elem.appendChild(opt);
            if (v.name.includes("Online")) sel = opt;
            if (v.name.includes("(Natural)")) nat = opt;
        }
        if (nat != null) sel = nat;
        if (sel != null) sel.selected = true;
    }
    speechSynthesis.addEventListener("voiceschanged", setVoices);
    setVoices();
}

var stopSpeaking = () => false;

async function speak(elem) {
    if (!window.speechSynthesis) return true;
    let f = elem.classList.contains("speaking");
    if (stopSpeaking() && f) return true;
    return await elem.speak();
}

function speak1(lang, target) {
    return new Promise((resolve, _) => {
        let opt = lang.voice.selectedOptions;
        if (!opt || opt.length == 0) return resolve(false);
        let speakend = cancel => {
            speakend = () => false;
            if (cancel) speechSynthesis.cancel();
            resolve(cancel);
            return cancel;
        };
        stopSpeaking = () => speakend(true);
        let text = target.getAttribute("speak");
        if (!text) text = target.getAttribute("s");
        if (!text) text = target.textContent;
        let u = new SpeechSynthesisUtterance(text);
        u.voice = lang.voice.selectedOptions[0].voice;
        u.lang = u.voice.lang;
        u.rate = parseFloat(lang_rate.value);
        u.pitch = lang.pitch;
        u.onend = u.onerror = () => speakend(false);
        speechSynthesis.speak(u);
    });
}

async function speakElem() {
    this.classList.add("speaking");
    if (this.playStop) this.textContent = this.playStop[1];
    let cancel = false;
    if (this.speakTarget) {
        for (let t of this.speakTarget) {
            if (await t.speak()) {
                cancel = true;
                break;
            }
        }
    } else {
        cancel = await speak1(this.language, this);
    }
    if (this.playStop) this.textContent = this.playStop[0];
    this.classList.remove("speaking");
    return cancel;
}

function ensureVisible(margin, ...elems) {
    let rs = elems.map(elem => elem.getBoundingClientRect());
    let tp = Math.min(...rs.map(r => r.top   )) - margin;
    let bt = Math.max(...rs.map(r => r.bottom)) + margin;
    if (tp < 0) {
        let top = pageYOffset + tp;
        scroll({top: top, behavior: "smooth"});
    } else if (bt > innerHeight) {
        let top = pageYOffset + tp - (innerHeight - (bt - tp));
        scroll({top: top, behavior: "smooth"});
    }
}

async function speakSpan() {
    ensureVisible(innerHeight / 10, ...this.spans);
    for (let sp of this.spans)
        sp.classList.add(this == sp ? "speaking2" : "speaking3");
    let cancel = await speak1(this.language, this);
    for (let sp of this.spans)
        sp.classList.remove(this == sp ? "speaking2" : "speaking3");
    return cancel;
}

let spanTarget = null;

function spanEnter(ev) {
    if (spanTarget) spanLeave(null);
    let t = ev.target;
    if (!t.spans || t.classList.contains("speaking2") || t.classList.contains("speaking3"))
        return;
    for (let span of t.spans) span.classList.add("hovering");
    spanTarget = ev.target;
}

function spanLeave(ev) {
    if (ev && ev.target != spanTarget) return;
    for (let span of spanTarget.spans) span.classList.remove("hovering");
    spanTarget = null;
}

function makePairTable(table1, table2) {
    let langs1 = table1.getAttribute("languages").replace(/;/g, "|").split("|");
    let langs2 = table2.getAttribute("languages").split("|").map(ls => ls.split(";"));
    let langs3 = langs2.map(ls1 => ls1.find(ls2 => ls2.split(",").length == 1).replace(/^\[.*?\]/, ""));
    let buttons1 = {};
    for (let [i, button] of Array.from(table1.getElementsByTagName("td")).entries()) {
        let play = "▶", ls = langs1[i];
        let m = ls.match(/^\[(.*?)\](.*)$/);
        if (m) { play = m[1]; ls = m[2]; }
        buttons1[ls] = button;
        button.languages = ls;
        button.classList.add("speak");
        if (play) {
            let t = button.textContent;
            if (!t) t = ls.split(",").map(l => langs[l].name).join("→");
            button.playStop = [play + " " + t, "■ " + t];
            button.textContent = button.playStop[0];
        }
        button.speakTarget = [];
    }
    for (let tr of Array.from(table2.getElementsByTagName("tr"))) {
        let buttons2 = [];
        let tds = Array.from(tr.getElementsByTagName("td"));
        for (let [i, td] of tds.entries()) {
            td.spans = Array.from(td.getElementsByTagName("span"));
            for (let [j, ls] of langs2[i].entries()) {
                let play = "▶";
                let m = ls.match(/^\[(.*?)\](.*)$/);
                if (m) { play = m[1]; ls = m[2]; }
                let button = document.createElement("span");
                buttons2.push(button);
                button.classList.add("speak");
                button.speakTarget = [];
                button.languages = ls.split(",");
                button.style.width = "1.5em";
                button.playStop = [play, "■"];
                button.textContent = button.playStop[0];
                td.insertBefore(button, td.spans[0]);
                if (ls in buttons1) buttons1[ls].speakTarget.push(button);
            }
        }
        for (let i = 0; i < tds[0].spans.length; i++) {
            let spans = tds.map(td => td.spans[i]);
            let splangs = {};
            for (let [j, span] of spans.entries()) {
                let lang = langs3[j];
                splangs[lang] = span;
                span.language = langs[lang];
                span.spans = spans;
                span.speak = speakSpan;
                span.textContent = span.textContent;
                span.addEventListener("mouseenter", spanEnter);
                span.addEventListener("mouseleave", spanLeave);
            }
            for (let button of buttons2) {
                for (let lang of button.languages) {
                    button.speakTarget.push(splangs[lang]);
                }
            }
        }
    }
}
