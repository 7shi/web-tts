let webTTS = {};

webTTS.langs = {};

webTTS.initVoices = function(languages, table) {
    if (languages) webTTS.langs = languages;
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
            webTTS.setSpeak(td1);
            sel.classList.add("voicelist");
            sel.setAttribute("language", key);
            td2.appendChild(sel);
            tr.appendChild(td1);
            tr.appendChild(td2);
            table.appendChild(tr);
            value.voice = sel;
        }
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

webTTS.setSpeak = function(elem) {
    elem.classList.add("speak");
    if (elem.playStop) {
        elem.textContent = elem.playStop[0];
    } else if (!elem.textContent) {
        elem.language = webTTS.langs[elem.getAttribute("language")];
        elem.textContent = elem.language.name;
    }
    if (!elem.speak) {
        elem.speak = webTTS.speakElem;
        elem.addEventListener("click", () => webTTS.speak(elem));
    }
}

class webTTS_Position {
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
        let e = this.getPos(start + length, false);
        return this.text1.substring(0, s) +
            '<span class="speaking-word">' +
            this.text1.substring(s, e) +
            '</span>' +
            this.text1.substring(e);
    }
}

webTTS.stopSpeaking = () => false;

webTTS.speak = async function(elem) {
    if (!window.speechSynthesis) return;
    while (elem) {
        let cancel = [ elem.classList.contains("speaking") ? null : elem ];
        if (webTTS.stopSpeaking(cancel)) return;
        let result = await elem.speak();
        elem = result ? result[0] : null;
    }
}

webTTS.speak1 = function(lang, target) {
    return new Promise((resolve, _) => {
        let opt = lang.voice.selectedOptions;
        if (!opt || opt.length == 0) return resolve(false);
        let html = target.innerHTML;
        let p = null;
        let text = target.getAttribute("speak");
        if (!text) {
            p = new webTTS_Position(target);
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
        webTTS.stopSpeaking = cancel => speakend(cancel ? cancel : [null]);
        let u = new SpeechSynthesisUtterance(text);
        u.voice = lang.voice.selectedOptions[0].voice;
        u.lang = u.voice.lang;
        if (target.rate) u.rate = parseFloat(target.rate.value);
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

webTTS.speakElem = async function() {
    this.classList.add("speaking");
    if (this.playStop) this.textContent = this.playStop[1];
    let cancel = null;
    if (this.speakTarget) {
        for (let t of this.speakTarget) {
            if (cancel = await t.speak()) break;
        }
    } else {
        cancel = await webTTS.speak1(this.language, this);
    }
    if (this.playStop) this.textContent = this.playStop[0];
    this.classList.remove("speaking");
    return cancel;
}

webTTS.getTopBottom = function(...elems) {
    let rects  = elems.map(elem => elem.getBoundingClientRect());
    let top    = Math.min(...rects.map(r => r.top));
    let bottom = Math.max(...rects.map(r => r.bottom));
    return [top, bottom];
}

webTTS.speakSpan = async function() {
    let [t, b] = webTTS.getTopBottom(this);
    let ih = innerHeight;
    if (0 <= t && t < ih && ih <= b + ih / 10) {
        let top = pageYOffset + b - ih * 2 / 3;
        scroll({ top, behavior: "smooth" });
    }
    for (let sp of this.spans)
        sp.classList.add(this == sp ? "speaking2" : "speaking3");
    let cancel = await webTTS.speak1(this.language, this);
    for (let sp of this.spans)
        sp.classList.remove(this == sp ? "speaking2" : "speaking3");
    return cancel;
}

webTTS.spanTarget = null;

webTTS.spanEnter = function(ev) {
    if (webTTS.spanTarget) webTTS.spanLeave(null);
    let t = ev.target;
    if (!t.spans || t.classList.contains("speaking2") || t.classList.contains("speaking3"))
        return;
    for (let span of t.spans) span.classList.add("hovering");
    webTTS.spanTarget = ev.target;
}

webTTS.spanLeave = function(ev) {
    if (ev && ev.target != webTTS.spanTarget) return;
    for (let span of webTTS.spanTarget.spans) span.classList.remove("hovering");
    webTTS.spanTarget = null;
}

webTTS.getSpans = function*(elem) {
    for (let n = elem.firstChild; n; n = n.nextSibling) {
        if (n.tagName == "SPAN") yield n;
    }
}

webTTS.initTable = function(source, button, text, ...languages) {
    if (!languages.length) languages = [ls[0], ls[1]];
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
    let sl3 = document.createElement("select");
    let sl4 = document.createElement("select");
    let speechRates = [
        [2, "速い"], [1.5, "やや速い"], [1, "普通"], [0.75, "やや遅い"], [0.5, "遅い"]
    ];
    text.rates = [sl2, sl4];
    for (let sl of text.rates) {
        for (let [value, text] of speechRates) {
            let opt = document.createElement("option");
            opt.value = value;
            opt.textContent = text;
            sl.appendChild(opt);
            if (value == 1) opt.selected = true;
        }
    }
    td1.width = td2.width = "50%";
    for (let sp of [sp1, sp2, sp3, sp4]) sp.style.width = "2em";
    sp1.playStop = ["⇨", "■"];
    sp2.playStop = sp4.playStop = ["▶", "■"];
    sp3.textContent = "⇆";
    for (let lang of ls) {
        let opt1 = document.createElement("option");
        opt1.value = lang;
        opt1.textContent = webTTS.langs[lang].name;
        let opt2 = opt1.cloneNode(true);
        if (lang == languages[0]) opt1.selected = true;
        if (lang == languages[1]) opt2.selected = true;
        sl1.appendChild(opt1);
        sl3.appendChild(opt2);
    }
    webTTS.setSpeak(sp1);
    webTTS.setSpeak(sp2);
    webTTS.setSpeak(sp4);
    sp3.classList.add("speak");
    td1.appendChild(sp1);
    td1.appendChild(sp2);
    td1.appendChild(sl1);
    td1.appendChild(sl2);
    td2.appendChild(sp3);
    td2.appendChild(sp4);
    td2.appendChild(sl3);
    td2.appendChild(sl4);
    tr.appendChild(td1);
    tr.appendChild(td2);
    button.appendChild(tr);
    let stop = false, sps = [sp1, sp2, sp4];
    sl1.onchange = sl3.onchange = () => {
        if (!stop) webTTS.setTextTable(langText, text, sps, [sl1.value, sl3.value]);
    };
    sp3.onclick = () => {
        stop = true;
        let v = sl1.value;
        sl1.value = sl3.value;
        sl3.value = v;
        v = sl2.value;
        sl2.value = sl4.value;
        sl4.value = v;
        stop = false;
        webTTS.setTextTable(langText, text, sps, [sl1.value, sl3.value]);
    };
    webTTS.setTextTable(langText, text, sps, languages);
}

webTTS.setTextTable = function(langText, table, sps, languages) {
    webTTS.stopSpeaking();
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
            td.spans = Array.from(webTTS.getSpans(td));
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
            webTTS.setSpeak(b);
        }
        for (let j = 0; j < tds[0].spans.length; j++) {
            let spans = tds.map(td => td.spans[j]);
            for (let [k, span] of spans.entries()) {
                buttons[0    ].speakTarget.push(span);
                buttons[k + 1].speakTarget.push(span);
                span.language = webTTS.langs[languages[k]];
                span.spans = spans;
                span.speak = webTTS.speakSpan;
                span.rate  = table.rates[k];
                span.addEventListener("mouseenter", webTTS.spanEnter);
                span.addEventListener("mouseleave", webTTS.spanLeave);
            }
        }
        table.appendChild(tr);
    }
}

webTTS.setSpeakText = function(source, lang, words) {
    for (let tr of Array.from(source.getElementsByTagName("tr"))) {
        if (tr.getAttribute("language") != lang) continue;
        for (let td of Array.from(tr.getElementsByTagName("td"))) {
            for (let span of Array.from(webTTS.getSpans(td))) {
                let s1 = span.innerHTML, s2 = s1;
                for (let src in words) {
                    let dst = '<span s="' + words[src] + '">$&</span>';
                    s2 = s2.replace(RegExp(src, "g"), dst);
                }
                if (s1 != s2) span.innerHTML = s2;
            }
        }
    }
}

webTTS.convertSource = function(pre, ...langs) {
    let count = langs.length;
    let texts = [];
    let lines = [];
    for (let i = 0; i < count; i++) {
        texts.push([]);
        lines.push([]);
    }
    let n = 0;
    for (let line of (pre.innerHTML.trim() + "\n").split("\n")) {
        line = line.trim();
        if (line.length) {
            lines[n % count].push(line);
            n++;
        } else {
            let bak = lines;
            lines = [];
            let len = Math.max(...bak.map(x => x.length));
            for (let i = 0; i < count; i++) {
                if (bak[i].length < len) bak[i].push("");
                texts[i].push(bak[i]);
                lines.push([]);
            }
        }
    }
    let table = document.createElement("table");
    for (let i = 0; i < count; i++) {
        let tr = document.createElement("tr");
        let lang = langs[i];
        tr.setAttribute("language", lang);
        let s = lang == "ja" || lang == "zh" ? "" : " ";
        let span = "</span>" + s + "<span>";
        for (let t of texts[i]) {
            let td = document.createElement("td");
            td.innerHTML = "<span>" + t.join(span) + "</span>";
            tr.appendChild(td);
        }
        table.appendChild(tr);
    }
    return table;
}
