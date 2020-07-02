var langs = {};

function initVoices(languages) {
    if (languages) langs = languages;
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
