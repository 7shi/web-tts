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
            td1.setAttribute("language", key);
            td1.setAttribute("speak", value.test);
            setSpeak(td1);
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

function setSpeak(elem) {
    elem.classList.add("speak");
    if (elem.playStop) {
        elem.textContent = elem.playStop[0];
    } else if (!elem.textContent) {
        elem.language = langs[elem.getAttribute("language")];
        elem.textContent = elem.language.name;
    }
    if (!elem.speak) {
        elem.speak = speakElem;
        elem.addEventListener("click", () => speak(elem));
    }
}

class Position {
    constructor(elem) {
        this.rawtx = [];
        this.pos1  = [];
        this.pos2  = [];
        this.text1 = "";
        this.text2 = "";
        let p1 = 0, p2 = 0;
        for (let n = elem.firstChild;; n = n.nextSibling) {
            this.pos1.push(p1);
            this.pos2.push(p2);
            if (!n) break;
            let t1 = n.textContent, t2 = null;
            if (n.nodeType != Node.TEXT_NODE) t2 = n.getAttribute("s");
            this.rawtx.push(!t2);
            if (!t2) t2 = t1;
            p1 += t1.length;
            p2 += t2.length;
            this.text1 += t1;
            this.text2 += t2;
        }
    }

    getPos(p, before = true) {
        if (p < 0) return 0;
        let i = this.pos2.findIndex(x => x >= p);
        if (i < 0) return this.pos1[this.pos1.length - 1];
        if (this.pos2[i] == p) return this.pos1[i];
        if (this.rawtx[i - 1]) return this.pos1[i - 1] + (p - this.pos2[i - 1]);
        return before ? this.pos1[i - 1] : this.pos1[i];
    }

    getHTML(start, length) {
        let s = this.getPos(start);
        let e = this.getPos(start + length);
        return this.text1.substring(0, s) +
            '<span class="speaking-word">' +
            this.text1.substring(s, e) +
            '</span>' +
            this.text1.substring(e);
    }
}

var stopSpeaking = () => false;

async function speak(elem) {
    if (!window.speechSynthesis) return;
    while (elem) {
        let cancel = [ elem.classList.contains("speaking") ? null : elem ];
        if (stopSpeaking(cancel)) return;
        elem = (await elem.speak() ?? [null])[0];
    }
}

function speak1(lang, target) {
    return new Promise((resolve, _) => {
        let opt = lang.voice.selectedOptions;
        if (!opt || opt.length == 0) return resolve(false);
        let html = target.innerHTML;
        let p = null;
        let text = target.getAttribute("speak");
        if (!text) {
            p = new Position(target);
            text = p.text2;
        }
        let step = 0;
        let speakend = cancel => {
            speakend = () => false;
            if (step == 1) target.innerHTML = html;
            step = 2;
            if (cancel) speechSynthesis.cancel();
            resolve(cancel);
            return cancel != null;
        };
        stopSpeaking = cancel => speakend(cancel ?? [null]);
        let u = new SpeechSynthesisUtterance(text);
        u.voice = lang.voice.selectedOptions[0].voice;
        u.lang = u.voice.lang;
        u.rate = parseFloat(lang_rate.value);
        u.pitch = lang.pitch;
        u.onend = u.onerror = () => speakend(null);
        if (p) {
            u.onboundary = ev => {
                if (ev.name != "word" || step > 1) return;
                step = 1;
                target.innerHTML = p.getHTML(ev.charIndex, ev.charLength);
            };
        }
        speechSynthesis.speak(u);
    });
}

async function speakElem() {
    this.classList.add("speaking");
    if (this.playStop) this.textContent = this.playStop[1];
    let cancel = null;
    if (this.speakTarget) {
        for (let t of this.speakTarget) {
            if (cancel = await t.speak()) break;
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

var spanTarget = null;

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

function* getSpans(elem) {
    for (let n = elem.firstChild; n; n = n.nextSibling) {
        if (n.tagName == "SPAN") yield n;
    }
}

function initTable(source, button, text) {
    let langText = {};
    for (let tr of Array.from(source.getElementsByTagName("tr"))) {
        langText[tr.getAttribute("language")] = Array.from(tr.getElementsByTagName("td"));
    }
    let ls = Object.keys(langText);
    button.width = text.width = "100%";
    button.classList.add("sentences");
    text  .classList.add("langs");
    let tr  = document.createElement("tr");
    let td1 = document.createElement("td");
    let td2 = document.createElement("td");
    let sp1 = document.createElement("span");
    let sp2 = document.createElement("span");
    let sp3 = document.createElement("span");
    let sp4 = document.createElement("span");
    let sl1 = document.createElement("select");
    let sl2 = document.createElement("select");
    td1.width = td2.width = "50%";
    sp1.style.width = sp3.style.width = "6em";
    sp2.style.width = sp4.style.width = "2em";
    sp1.playStop = ["⇨ 左→右", "■ 左→右"];
    sp2.playStop = sp4.playStop = ["▶", "■"];
    sp3.textContent = "⇆ 入替";
    for (let [i, lang] of ls.entries()) {
        let opt1 = document.createElement("option");
        opt1.value = lang;
        opt1.textContent = langs[lang].name;
        let opt2 = opt1.cloneNode(true);
        if (i == 0) opt1.selected = true;
        if (i == 1) opt2.selected = true;
        sl1.appendChild(opt1);
        sl2.appendChild(opt2);
    }
    setSpeak(sp1);
    setSpeak(sp2);
    setSpeak(sp4);
    sp3.classList.add("speak");
    td1.appendChild(sp1);
    td1.appendChild(sp2);
    td1.appendChild(sl1);
    td2.appendChild(sp3);
    td2.appendChild(sp4);
    td2.appendChild(sl2);
    tr.appendChild(td1);
    tr.appendChild(td2);
    button.appendChild(tr);
    let stop = false, sps = [sp1, sp2, sp4];
    sl1.onchange = sl2.onchange = () => {
        if (!stop) setTextTable(langText, text, sps, [sl1.value, sl2.value]);
    };
    sp3.onclick = () => {
        stop = true;
        let v = sl1.value;
        sl1.value = sl2.value;
        sl2.value = v;
        stop = false;
        setTextTable(langText, text, sps, [sl1.value, sl2.value]);
    };
    setTextTable(langText, text, sps, [ls[0], ls[1]]);
}

function setTextTable(langText, table, sps, languages) {
    stopSpeaking();
    for (let sp of sps) sp.speakTarget = [];
    table.innerHTML = "";
    let src = languages.map(lang => langText[lang]);
    let len = Math.min(...src.map(x => x.length));
    for (let i = 0; i < len; i++) {
        let tr = document.createElement("tr");
        let tds = src.map(x => x[i].cloneNode(true));
        let buttons = [document.createElement("span")];
        sps[0].speakTarget.push(buttons[0]);
        buttons[0].playStop = ["⇨", "■"];
        for (let [j, td] of tds.entries()) {
            if (i == 0) td.width = "50%";
            td.spans = Array.from(getSpans(td));
            let b = document.createElement("span");
            buttons.push(b);
            sps[j + 1].speakTarget.push(b);
            b.playStop = ["▶", "■"];
            td.insertBefore(b, td.spans[0]);
            tr.appendChild(td);
        }
        tds[0].insertBefore(buttons[0], tds[0].firstChild);
        for (let b of buttons) {
            b.speakTarget = [];
            b.style.width = "1.5em";
            setSpeak(b);
        }
        for (let j = 0; j < tds[0].spans.length; j++) {
            let spans = tds.map(td => td.spans[j]);
            for (let [k, span] of spans.entries()) {
                buttons[0    ].speakTarget.push(span);
                buttons[k + 1].speakTarget.push(span);
                span.language = langs[languages[k]];
                span.spans = spans;
                span.speak = speakSpan;
                span.addEventListener("mouseenter", spanEnter);
                span.addEventListener("mouseleave", spanLeave);
            }
        }
        table.appendChild(tr);
    }
}

function setSpeakText(source, lang, words) {
    for (let tr of Array.from(source.getElementsByTagName("tr"))) {
        if (tr.getAttribute("language") != lang) continue;
        for (let td of Array.from(tr.getElementsByTagName("td"))) {
            for (let span of Array.from(getSpans(td))) {
                let s1 = span.textContent, f = false;
                for (let src in words) {
                    let dst = words[src];
                    let s2 = "", i1 = 0, i2;
                    while ((i2 = s1.indexOf(src, i1)) >= 0) {
                        f = true;
                        s2 += s1.substring(i1, i2) + '<span s="' + dst + '">' + src + '</span>';
                        i1 = i2 + src.length;
                    }
                    s1 = s2 + s1.substring(i1);
                }
                if (f) span.innerHTML = s1;
            }
        }
    }
}
