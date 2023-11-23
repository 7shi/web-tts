class webTTS {
    static langs  = {};
    static voices = [];

    static async stopSpeakingDefault() {}
    static stopSpeaking = webTTS.stopSpeakingDefault;

    static copyStaticMethods(cls) {
        const methods = Object.getOwnPropertyDescriptors(webTTS);
        for (const name of Object.getOwnPropertyNames(cls)) {
            if (!(name in methods) && typeof cls[name] == "function") {
                webTTS[name] = cls[name];
            }
        }
    }
}

class webTTS_Voice {
    static async getVoices() {
        if (!window.speechSynthesis) return [];
        const ready = new Promise(resolve => speechSynthesis.onvoiceschanged = resolve);
        let ret = speechSynthesis.getVoices();
        if (!ret.length) {
            await ready;
            ret = speechSynthesis.getVoices();
        }
        return ret;
    }

    static async initVoices(languages, table) {
        if (languages) webTTS.langs = languages;
        if (table) {
            table.classList.add("sentences");
            for (let kv of Object.entries(languages)) {
                let tr = document.createElement("tr");
                webTTS_Voice.addLanguage(tr, ...kv);
                table.appendChild(tr);
            }
        }
        if (!webTTS.voices.length) webTTS.voices = await webTTS_Voice.getVoices();
        if (!webTTS.voices.length) return;
        Array.from(document.getElementsByClassName("voicelist")).forEach(webTTS_Voice.addVoices);
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
        webTTS_Speak.setSpeak(td1);
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
}
webTTS.copyStaticMethods(webTTS_Voice);

class webTTS_Speak {
    static speakAsync(uttr) {
        return new Promise((resolve, reject) => {
            uttr.onend = () => resolve();
            uttr.onerror = ev => reject(ev);
            speechSynthesis.speak(uttr);
        });
    }

    static setSpeak(elem, language = "", ...targets) {
        // targets: {lang1: {span1, span2, ...}, ...}
        if (targets.length) {
            elem.speakTarget = targets;
            for (const t of targets) {
                if (!language) continue;
                t.language = webTTS.langs[language];
                t.spans = targets;
                t.speak = webTTS_Speak.speakSpan; // use as `t.speak()`
            }
        }
        if (targets && typeof targets == "string") {
            for (const [lang, spans] of Object.entries(targets)) {
                if (!lang) {
                    elem.speakTarget = elem.speakTarget.concat(spans);
                    continue;
                }
                if (!(lang in webTTS.langs)) {
                    console.error("unknown language: " + lang);
                    continue;
                }
            }
        }
        if (elem.playStop) {
            elem.textContent = elem.playStop[0];
        } else if (!elem.textContent) {
            elem.language = webTTS.langs[elem.getAttribute("key")];
            elem.textContent = elem.language.name;
        }
        if (elem.hasAttribute("speak") || elem.speakTarget) {
            elem.classList.add("speak");
            if (!elem.speak) {
                elem.speak = webTTS_Speak.speakElem;
                elem.addEventListener("click", () => webTTS_Speak.speak(elem));
            }
        }
    }

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
        try {
            await webTTS_Speak.speakAsync(u);
        } catch {
            // ignore error
        }
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
        // `this` is set because of calling from `elem.speak()`
        for (let elem = this; elem; elem = elem.nextSpeak) {
            if (await webTTS_Speak.speakElem1(elem)) return true;
        }
        return false;
    }

    static async speakElem1(elem) {
        elem.classList.add("speaking");
        if (elem.playStop) elem.textContent = elem.playStop[1];
        let cancel = false;
        if (elem.speakTarget) {
            for (let i = 0; i < elem.speakTarget.length; i++) {
                if (elem.speakCheck && !elem.speakCheck[i % elem.speakCheck.length].checked) continue;
                const t = elem.speakTarget[i];
                if (cancel = await t.speak()) break;
            }
        } else {
            cancel = await webTTS_Speak.speak1(elem.language, elem);
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
        // `this` is set because of calling from `elem.speak()`
        let [t, b] = webTTS_Speak.getTopBottom(this);
        let ih = innerHeight;
        if (0 <= t && t < ih && ih <= b + ih / 10) {
            let top = scrollY + b - ih * 2 / 3;
            scroll({ top, behavior: "smooth" });
        }
        for (let sp of this.spans)
            sp.classList.add(this == sp ? "speaking2" : "speaking3");
        let cancel = await webTTS_Speak.speak1(this.language, this);
        for (let sp of this.spans)
            sp.classList.remove(this == sp ? "speaking2" : "speaking3");
        return cancel;
    }
}
webTTS.copyStaticMethods(webTTS_Speak);

class webTTS_Table {
    static spanTarget = null;

    static spanEnter(ev) {
        if (webTTS_Table.spanTarget) webTTS_Table.spanLeave(null);
        let t = ev.target;
        if (!t.spans || t.classList.contains("speaking2") || t.classList.contains("speaking3"))
            return;
        for (let span of t.spans) span.classList.add("hovering");
        webTTS_Table.spanTarget = ev.target;
    }

    static spanLeave(ev) {
        if (ev && ev.target != webTTS_Table.spanTarget) return;
        for (let span of webTTS_Table.spanTarget.spans) span.classList.remove("hovering");
        webTTS_Table.spanTarget = null;
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
        button.style.width = text.style.width = "100%";
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
                if (!(lang in webTTS.langs)) continue;
                const opt = document.createElement("option");
                opt.value = lang;
                opt.textContent = webTTS.langs[lang].name;
                if (lang == languages[i]) opt.selected = true;
                sl.appendChild(opt);
            }
            let stop = false;
            sl.onchange = async () => {
                if (!stop) await webTTS_Table.setTextTable(langText, text, cks, sls.map(x => x.value));
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
                    await webTTS_Table.setTextTable(langText, text, cks, sls.map(x => x.value));
                };
                td.appendChild(xch);
            }

            td.appendChild(ck);
            td.appendChild(sl);
            td.appendChild(rt);
            tr.appendChild(td);
        }
        button.appendChild(tr);
        await webTTS_Table.setTextTable(langText, text, cks, languages);
    }

    static async setTextTable(langText, table, cks, languages) {
        await webTTS.stopSpeaking();
        table.innerHTML = "";
        const src = languages.map(lang => langText[lang]);
        const len = Math.min(...src.map(x => x.length));
        const hasHeader = "" in langText;
        let prev = null;
        for (let i = 0; i < len; i++) {
            const tr = document.createElement("tr");
            const tds = src.map(x => x[i].cloneNode(true));
            const buttons = [document.createElement("span")];
            buttons[0].playStop = ["⇨", "■"];
            buttons[0].speakCheck = cks;
            if (prev) {
                prev.nextSpeak = buttons[0]; // make a linked list
            }
            prev = buttons[0];
            for (let j = 0; j < tds.length; j++) {
                const td = tds[j];
                if (i == 0) td.style.width = cks[j].parentNode.style.width;
                td.spans = Array.from(webTTS_Table.getSpans(td));
                const b = document.createElement("span");
                b.playStop = ["▶", "■"];
                buttons.push(b);
                td.insertBefore(b, td.spans[0]);
                tr.appendChild(td);
            }
            tds[0].insertBefore(buttons[0], tds[0].firstChild);
            for (const b of buttons) {
                b.speakTarget = [];
                b.style.width = "1.5em";
                webTTS_Speak.setSpeak(b);
            }
            if (hasHeader) {
                const hspans = Array.from(webTTS_Table.getSpans(langText[""][i]));
                if (hspans.length) {
                    tds[0].insertBefore(hspans[0].cloneNode(true), tds[0].spans[0]);
                }
            }
            for (let j = 0; j < tds[0].spans.length; j++) {
                const spans = tds.map(td => td.spans[j]);
                for (let k = 0; k < spans.length; k++) {
                    const span = spans[k];
                    buttons[0    ].speakTarget.push(span);
                    buttons[k + 1].speakTarget.push(span);
                    span.language = webTTS.langs[languages[k]];
                    span.spans = spans;
                    span.speak = webTTS_Speak.speakSpan;
                    span.rate  = table.rates[k];
                    span.addEventListener("mouseenter", webTTS_Table.spanEnter);
                    span.addEventListener("mouseleave", webTTS_Table.spanLeave);
                }
            }
            table.appendChild(tr);
        }
    }

    static * getSpans(elem) {
        for (let n = elem.firstChild; n; n = n.nextSibling) {
            if (n.tagName == "SPAN") yield n;
        }
    }

    static convertSource(pre, ...langs) {
        return webTTS_Table.convertTable(webTTS_Source.readSource(pre, langs), langs);
    }

    static convertTable(texts, langs, hasHeader = false) {
        if (hasHeader) langs = ["", ...langs];
        const table = document.createElement("table");
        for (let i = 0; i < langs.length; i++) {
            const tr = document.createElement("tr");
            const lang = langs[i];
            tr.setAttribute("language", lang);
            const s = lang == "ja" || lang == "zh" ? "" : " ";
            const span = "</span>" + s + "<span>";
            for (const t of texts[i]) {
                const td = document.createElement("td");
                let html = "<span>" + t.join(span) + "</span>";
                if (!lang) {
                    html = !t || (t.length == 1 && !t[0]) ? "" : `<span>${html} </span>`;
                }
                td.innerHTML = html;
                tr.appendChild(td);
            }
            table.appendChild(tr);
        }
        return table;
    }

    static setSpeakText(source, lang, words) {
        for (let tr of Array.from(source.getElementsByTagName("tr"))) {
            if (tr.getAttribute("language") != lang) continue;
            for (let td of Array.from(tr.getElementsByTagName("td"))) {
                for (let span of Array.from(webTTS_Table.getSpans(td))) {
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
}
webTTS.copyStaticMethods(webTTS_Table);

class webTTS_Source {
    static readSource(pre, langs, lineBreak = false) {
        return webTTS_Source.readSourceAuto(pre.innerHTML, langs, lineBreak);
    }

    static readSourceAuto(text, langs, lineBreak = false) {
        if (langs.length == 0) {
            return webTTS_Source.readSourceMarkdown(text, lineBreak);
        } else if (text.includes("\t")) {
            text = text.trim().replace(/\n/g, "\n\n").replace(/\t/g, "\n");
        } else if (text.includes("    ")) {
            text = text.replace(/\n/g, "\n\n").replace(/    /g, "\n");
        }
        return webTTS_Source.readSourceText(text, langs, lineBreak);
    }

    static readSourceMarkdown(text, lineBreak = false) {
        const rows = webTTS_Source.trim(text.split("\n")).map(line => {
            line = line.trim();
            if (line.startsWith("|") && line.endsWith("|")) {
                line = line.substring(1, line.length - 1);
            }
            return line.split("|").map(x => x.trim());
        });
        return webTTS_Source.readSourceTable(rows.slice(2), rows[0], lineBreak);
    }

    static readSourceText(text, langs, lineBreak = false) {
        // text: "1\n2\n3\n\n4\n5\n6" => table: [["1", "2", "3"], [], ["4", "5", "6"]]]
        const lines = webTTS_Source.trim((text.trim() + "\n").split("\n"));
        const table = [];
        let i = 0;
        while (i < lines.length) {
            if (lines[i].trim()) {
                table.push(lines.slice(i, i + langs.length));
                i += langs.length;
            } else {
                table.push([]);
                i++;
            }
        }
        return webTTS_Source.readSourceTable(table, langs, lineBreak);
    }

    static readSourceTable(table, langs, lineBreak = false) {
        const len = langs.length;
        const lines = Array(len).fill().map(() => []);
        const texts = Array(len).fill().map(() => []);
        for (const row of table.concat([[]])) {
            if (row.length) {
                for (let i = 0; i < len; i++) {
                    lines[i].push(i < row.length ? row[i] : "");
                }
            }
            if (!row.length || lineBreak) {
                for (let i = 0; i < len; i++) {
                    if (lines[i].length) {
                        texts[i].push(lines[i]);
                        lines[i] = [];
                    }
                }
            }
        }
        return texts;
    }

    static trim(stringArray) {
        let start = 0;
        while (start < stringArray.length && stringArray[start].trim() == "") start++;
        let end = stringArray.length;
        while (end > start && stringArray[end - 1].trim() == "") end--;
        return stringArray.slice(start, end);
    }
}
webTTS.copyStaticMethods(webTTS_Source);

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
