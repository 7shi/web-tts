class webTTS {
    static langs  = {};
    static voices = [];

    static async initVoices(languages, table) {
        if (languages) webTTS.langs = languages;
        if (table) {
            table.classList.add("sentences");
            for (let kv of Object.entries(languages)) {
                let tr = document.createElement("tr");
                webTTS.addLanguage(tr, ...kv);
                table.appendChild(tr);
            }
        }
        if (!window.speechSynthesis) return;

        webTTS.voices = speechSynthesis.getVoices();
        if (!webTTS.voices.length) {
            await new Promise(resolve => speechSynthesis.onvoiceschanged = resolve);
            webTTS.voices = speechSynthesis.getVoices();
        }
        Array.from(document.getElementsByClassName("voicelist")).forEach(webTTS.addVoices);
    }

    static addLanguage(tr, key, value) {
        let td1 = document.createElement("td");
        let td2 = document.createElement("td");
        let sel = document.createElement("select");
        let lang = value.lang ?? key;
        td1.setAttribute("key", key);
        td1.setAttribute("language", lang);
        if (value.test) {
            td1.setAttribute("speak", value.test);
        }
        webTTS.setSpeak(td1);
        sel.classList.add("voicelist");
        sel.setAttribute("language", lang);
        if (value.country) sel.setAttribute("country", value.country);
        if (value.prefer) sel.setAttribute("prefer", value.prefer);
        td2.appendChild(sel);
        tr.appendChild(td1);
        tr.appendChild(td2);
        value.voice = sel;
    }

    static addVoices(elem) {
        let lang = elem.getAttribute("language");
        if (!lang.includes("-")) lang += "-";
        let cntr = elem.getAttribute("country");
        if (cntr && !cntr.includes("-")) cntr = "-" + cntr;
        let prfr = elem.getAttribute("prefer");
        prfr = prfr ? prfr.split(",") : [];
        let prfi = prfr.length, prf = null, nat = null, sel = null;
        for (let v of webTTS.voices) {
            let vl = v.lang.replace(/(?<=^[a-z]+)_/, "-").replace(/_#.+/, ""); // for Android Chrome
            if (!vl.startsWith(lang)) continue;
            let opt = document.createElement("option");
            opt.text = v.name;
            opt.voice = v;
            elem.appendChild(opt);
            if (!cntr || vl.endsWith(cntr)) {
                if (!sel || (sel.localService && !v.localService)) sel = opt;
                if (!nat && v.name.includes("(Natural)")) nat = opt;
                let i = prfr.findIndex(p => v.name.includes(p));
                if (0 <= i && i < prfi) {
                    prfi = i;
                    prf = opt;
                }
            }
        }
        if (prf) sel = prf; else if (nat) sel = nat;
        if (sel) sel.selected = true;
    }

    static setSpeak(elem) {
        if (elem.playStop) {
            elem.textContent = elem.playStop[0];
        } else if (!elem.textContent) {
            elem.language = webTTS.langs[elem.getAttribute("key")];
            elem.textContent = elem.language.name;
        }
        if (elem.hasAttribute("speak") || elem.speakTarget) {
            elem.classList.add("speak");
            if (!elem.speak) {
                elem.speak = webTTS.speakElem;
                elem.addEventListener("click", () => webTTS.speak(elem));
            }
        }
    }

    static speakAsync(uttr) {
        return new Promise((resolve, _) => {
            uttr.onend = () => resolve(true);
            uttr.onerror = () => resolve(false);
            speechSynthesis.speak(uttr);
        });
    }

    static async stopSpeakingDefault() {}
    static stopSpeaking = webTTS.stopSpeakingDefault;

    static async speak(elem) {
        if (!window.speechSynthesis) return;

        let cancel = elem.classList.contains("speaking");
        await webTTS.stopSpeaking();
        if (cancel) return;

        await elem.speak();
    }

    static async speak1(lang, target) {
        const opt = lang.voice.selectedOptions;
        if (!opt || opt.length == 0) return false;

        const html = target.innerHTML;
        let p = null;
        let text = target.getAttribute("speak");
        if (!text) {
            p = new webTTS_Position(target);
            text = p.text2;
        }
        if (text.trim() == "") return false;

        const u = new SpeechSynthesisUtterance(text);
        u.voice = lang.voice.selectedOptions[0].voice;
        u.lang = u.voice.lang;
        if (target.rate) u.rate = parseFloat(target.rate.value);
        if (lang.pitch) u.pitch = lang.pitch;

        let step = 0;
        if (p) {
            u.onboundary = ev => {
                if (ev.name != "word" || step > 1) return;
                step = 1;
                target.innerHTML = p.getHTML(ev.charIndex, ev.charLength);
            };
        }

        let cancel = null;
        webTTS.stopSpeaking = () => new Promise((resolve, _) => {
            cancel = resolve;
            speechSynthesis.cancel();
        });
        await webTTS.speakAsync(u);
        if (step == 1) target.innerHTML = html;
        step = 2;
        webTTS.stopSpeaking = webTTS.stopSpeakingDefault;
        if (cancel) {
            cancel();
            return true;
        }
        return false;
    }

    static async speakElem() {
        for (let elem = this; elem; elem = elem.nextSpeak) {
            if (await webTTS.speakElem1(elem)) return true;
        }
        return false;
    }

    static async speakElem1(elem) {
        elem.classList.add("speaking");
        if (elem.playStop) elem.textContent = elem.playStop[1];
        let cancel = false;
        if (elem.speakTarget) {
            for (let i = 0; i < elem.speakTarget.length; i++) {
                if (elem.speakCheck && !elem.speakCheck[i].checked) continue;
                const t = elem.speakTarget[i];
                if (cancel = await t.speak()) break;
            }
        } else {
            cancel = await webTTS.speak1(elem.language, elem);
        }
        if (elem.playStop) elem.textContent = elem.playStop[0];
        elem.classList.remove("speaking");
        if (cancel) return true;
        return cancel;
    }

    static getTopBottom(...elems) {
        let rects  = elems.map(elem => elem.getBoundingClientRect());
        let top    = Math.min(...rects.map(r => r.top));
        let bottom = Math.max(...rects.map(r => r.bottom));
        return [top, bottom];
    }

    static async speakSpan() {
        let [t, b] = webTTS.getTopBottom(this);
        let ih = innerHeight;
        if (0 <= t && t < ih && ih <= b + ih / 10) {
            let top = scrollY + b - ih * 2 / 3;
            scroll({ top, behavior: "smooth" });
        }
        for (let sp of this.spans)
            sp.classList.add(this == sp ? "speaking2" : "speaking3");
        let cancel = await webTTS.speak1(this.language, this);
        for (let sp of this.spans)
            sp.classList.remove(this == sp ? "speaking2" : "speaking3");
        return cancel;
    }

    static spanTarget = null;

    static spanEnter(ev) {
        if (webTTS.spanTarget) webTTS.spanLeave(null);
        let t = ev.target;
        if (!t.spans || t.classList.contains("speaking2") || t.classList.contains("speaking3"))
            return;
        for (let span of t.spans) span.classList.add("hovering");
        webTTS.spanTarget = ev.target;
    }

    static spanLeave(ev) {
        if (ev && ev.target != webTTS.spanTarget) return;
        for (let span of webTTS.spanTarget.spans) span.classList.remove("hovering");
        webTTS.spanTarget = null;
    }

    static* getSpans(elem) {
        for (let n = elem.firstChild; n; n = n.nextSibling) {
            if (n.tagName == "SPAN") yield n;
        }
    }

    static async initTable(source, button, text, ...languages) {
        const langText = {};
        for (const tr of Array.from(source.getElementsByTagName("tr"))) {
            langText[tr.getAttribute("language")] = Array.from(tr.getElementsByTagName("td"));
        }
        const langs = Object.keys(langText);
        const coln = languages.length;
        if (coln == 0) {
            coln = 2;
            languages = langs.slice(0, coln);
        }
        button.width = text.width = "100%";
        button.classList.add("sentences");
        text  .classList.add("langs");
        const tr = document.createElement("tr");
        const tds = Array.from({ length: coln }, () => document.createElement("td"));
        const cks = Array.from({ length: coln }, () => document.createElement("input"));
        const sls = Array.from({ length: coln }, () => document.createElement("select"));
        const rts = Array.from({ length: coln }, () => document.createElement("select"));
        const xchs = Array.from({ length: coln - 1 }, () => document.createElement("span"));
        const speechRates = [
            [2, "速い"], [1.5, "やや速い"], [1, "普通"], [0.75, "やや遅い"], [0.5, "遅い"]
        ];
        text.rates = rts;
        const w = Math.floor(100 / coln);
        for (let i = 0; i < coln; i++) {
            const td = tds[i];
            if (i == 0) {
                td.style.width = (w + 100 - w * coln) + "%";
            } else {
                td.style.width = w + "%";
            }

            const ck = cks[i];
            ck.type = "checkbox";
            ck.checked = true;

            const rt = rts[i];
            for (const [value, text] of speechRates) {
                let opt = document.createElement("option");
                opt.value = value;
                opt.textContent = text;
                rt.appendChild(opt);
                if (value == 1) opt.selected = true;
            }

            const sl = sls[i];
            for (const lang of langs) {
                const opt = document.createElement("option");
                opt.value = lang;
                opt.textContent = webTTS.langs[lang].name;
                if (lang == languages[i]) opt.selected = true;
                sl.appendChild(opt);
            }
            let stop = false;
            sl.onchange = async () => {
                if (!stop) await webTTS.setTextTable(langText, text, cks, sls.map(x => x.value));
            };

            if (i > 0) {
                const xch = xchs[i - 1];
                xch.style.width = "2em";
                xch.textContent = "⇆";
                xch.classList.add("speak");
                const n = i - 1;
                xch.onclick = async () => {
                    stop = true;
                    [cks[n].checked, ck.checked] = [ck.checked, cks[n].checked];
                    [rts[n].value, rt.value] = [rt.value, rts[n].value];
                    [sls[n].value, sl.value] = [sl.value, sls[n].value];
                    stop = false;
                    await webTTS.setTextTable(langText, text, cks, sls.map(x => x.value));
                };
                td.appendChild(xch);
            }

            td.appendChild(ck);
            td.appendChild(sl);
            td.appendChild(rt);
            tr.appendChild(td);
        }
        button.appendChild(tr);
        await webTTS.setTextTable(langText, text, cks, languages);
    }

    static async setTextTable(langText, table, cks, languages) {
        await webTTS.stopSpeaking();
        table.innerHTML = "";
        const src = languages.map(lang => langText[lang]);
        const len = Math.min(...src.map(x => x.length));
        let prev = null;
        for (let i = 0; i < len; i++) {
            const tr = document.createElement("tr");
            const tds = src.map(x => x[i].cloneNode(true));
            const buttons = [document.createElement("span")];
            buttons[0].playStop = ["⇨", "■"];
            buttons[0].speakTarget = [];
            buttons[0].speakCheck = cks;
            if (prev) {
                prev.nextSpeak = buttons[0]; // make a linked list
            }
            prev = buttons[0];
            for (let j = 0; j < tds.length; j++) {
                const td = tds[j];
                if (i == 0) td.width = "50%";
                td.spans = Array.from(webTTS.getSpans(td));
                const b = document.createElement("span");
                b.speakTarget = [];
                b.playStop = ["▶", "■"];
                buttons.push(b);
                buttons[0].speakTarget.push(b);
                td.insertBefore(b, td.spans[0]);
                tr.appendChild(td);
            }
            tds[0].insertBefore(buttons[0], tds[0].firstChild);
            for (const b of buttons) {
                b.style.width = "1.5em";
                webTTS.setSpeak(b);
            }
            for (let j = 0; j < tds[0].spans.length; j++) {
                const spans = tds.map(td => td.spans[j]);
                for (let k = 0; k < spans.length; k++) {
                    const span = spans[k];
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

    static setSpeakText(source, lang, words) {
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

    static readSource(pre, langs) {
        return webTTS.readSourceText(pre.innerHTML, langs);
    }

    static readSourceText(text, langs) {
        let count = langs.length;
        let lines = Array(count).fill().map(() => []);
        let texts = Array(count).fill().map(() => []);
        let n = 0;
        for (let line of (text.trim() + "\n").split("\n")) {
            line = line.trim();
            if (line.length) {
                lines[n % count].push(line);
                n++;
            } else {
                let len = lines[0].length;
                for (let i = 0; i < count; i++) {
                    if (lines[i].length < len) lines[i].push("");
                    texts[i].push(lines[i]);
                }
                lines = Array(count).fill().map(() => []);
                n = 0;
            }
        }
        return texts;
    }

    static convertTable(texts, langs) {
        let count = langs.length;
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

    static convertSource(pre, ...langs) {
        return webTTS.convertTable(webTTS.readSource(pre, langs), langs);
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
            const isText = n.nodeType == Node.TEXT_NODE;
            const t1 = n.textContent;
            const t2 = isText ? t1 : n.getAttribute("s") ?? "";
            this.rawtx.push(isText);
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
