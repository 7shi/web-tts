var langs = {};

function initVoices(languages) {
    if (languages) langs = languages;
    document.addEventListener("DOMContentLoaded", () => {
        for (let s of Array.from(document.getElementsByClassName("speak"))) {
            let t = s.textContent;
            s.speakTarget = getTarget(s);
            let lang = s.getAttribute("language");
            if (lang) {
                s.language = langs[lang];
                if (!t) t = s.language.name;
            }
            s.textContent = t;
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
            if (!v.localService) {
                sel = opt;
                if (v.name.includes("(Natural)")) nat = opt;
            }
        }
        if (nat != null) sel = nat;
        if (sel != null) sel.selected = true;
    }
    speechSynthesis.addEventListener("voiceschanged", setVoices);
    setVoices();
}

function getTarget(elem) {
    if (elem.getAttribute("speak")) return [elem];
    for (let e = elem.nextSibling; e; e = e.nextSibling) {
        if (e.nodeName == elem.nodeName) return [e];
    }
    return Array.from(elem.parentNode.parentNode.getElementsByTagName("td")).filter(e => e != elem && e.classList.contains("speak"));
}

var stopSpeaking = () => false;

async function speak(elem) {
    if (!window.speechSynthesis) return true;
    let f = elem.classList.contains("speaking");
    if (stopSpeaking() && f) return true;
    elem.classList.add("speaking");
    if (elem.playStop) elem.textContent = elem.playStop[1];
    let cancel = elem.speakTarget.length == 1
        ? await speakLine(elem)
        : await speakMany(elem.speakTarget);
    if (elem.playStop) elem.textContent = elem.playStop[0];
    elem.classList.remove("speaking");
    return cancel;
}

async function speakLine(elem) {
    let opt = elem.language.voice.selectedOptions;
    if (!opt || opt.length == 0) return false;
    let target = elem.speakTarget[0];
    if (target != elem) target.classList.add("speaking2");
    let cancel = target.words
        ? await speakWords(elem.language, target.getElementsByTagName("span"))
        : await speak1(elem.language, target);
    if (target != elem) target.classList.remove("speaking2");
    return cancel;
}

async function speakWords(lang, targets) {
    for (let t of Array.from(targets)) {
        t.classList.add("speaking3");
        let cancel = await speak1(lang, t);
        t.classList.remove("speaking3");
        if (cancel) return true;
    }
    return false;
}

async function speakMany(targets) {
    for (let t of targets) {
        let cancel = await speak(t);
        if (cancel) return true;
    }
    return false;
}

function speak1(lang, target) {
    return new Promise((resolve, _) => {
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

function setPlay(src, insert) {
    let tables = src.getElementsByTagName("table");
    if (tables.length) {
        for (let table of Array.from(tables)) setPlay(table, insert);
        return;
    }
    let src1 = src.getElementsByTagName("tr"), lang;
    for (let i = 0; i < src1.length; i++) {
        let td = src1[i].getElementsByTagName("td")[0];
        if (insert && i >= insert) td = src1[i].insertBefore(document.createElement("td"), td);
        let speak = td.classList.contains("speak");
        let l = td.getAttribute("language");
        let blank = !td.textContent.trim();
        if (speak) { lang = l; if (blank) { td.textContent = langs[l].name; blank = false; } }
        if ((speak && td.colSpan > 1) || (!td.childElementCount && blank)) {
            td.classList.add("speak");
            td.playStop = ["▶", "■"];
            if (!blank) td.playStop = td.playStop.map(t => t + " " + td.textContent.trim()); else td.style.width = "1em";
            td.textContent = td.playStop[0];
            if (lang && !td.getAttribute("language")) td.setAttribute("language", lang);
        }
    }
}

function makeTable(src, dst, skip) {
    let src1 = src.getElementsByClassName("sentences");
    let dst1 = dst.getElementsByClassName("sentences");
    let src2 = [], langs = [];
    for (let i = 0; i < src1.length; i++) {
        let td = src1[i].getElementsByTagName("td");
        let speaks = Array.from(td).filter(td => td.classList.contains("speak"));
        langs.push(speaks.shift().getAttribute("language"));
        src2.push(speaks.map(td => td.nextSibling));
    }
    if (skip) for (let i = 0; i < skip; i++) { src2.shift(); langs.shift(); }
    for (let i = 0; i < dst1.length; i++) {
        let tbody = dst1[i].getElementsByTagName("tr")[0].parentNode;
        for (let j = 0; j < src2.length; j++) {
            let tr = document.createElement("tr");
            let td = document.createElement("td");
            td.classList.add("speak");
            td.setAttribute("language", langs[j]);
            tr.appendChild(td);
            let tdsrc = src2[j][i];
            tdsrc.textContent = tdsrc.textContent;
            tr.appendChild(tdsrc.cloneNode(true));
            tbody.appendChild(tr);
        }
    }
}
