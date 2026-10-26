#!/usr/bin/env python3
"""Write ../selection.yaml (+ print stats) from the curated unit plan below (stdlib only).

The plan is hand-curated (see ../SELECTION.md for the criteria); this script only adds the
per-sign data (traditional form, HSK 3.0 level/pinyin, CKIP frequency rank, liushu type and
Commons stage count from the pool research) and validates the plan:
  - every sign is in the candidate table, no sign appears twice, units have 6–10 signs;
  - the 36 film characters are placed, and no sign file is planned for them.

Usage: make_selection.py [--candidates ../.cache/candidates_full.tsv] [--check-only]
"""
from __future__ import annotations

import argparse
import csv
import json
import sys
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent
FILM = "日山水林木鸟象草田竹马夫刀舟鱼网燕云雨伞石火龟鹿豕叟虎弓舍羊花门犬子女月"
PALETTE = ["#2fb67c", "#f08a24", "#3d8fe0", "#8b5cf6", "#e8453c", "#d99a00",
           "#0f9488", "#db2777", "#4f6bd8", "#c0622b", "#6b8e23", "#b04fc4"]

# Simplified forms that cover several traditional characters: the sense kids need.
COMPOSITE = {"后": "後", "里": "裡", "几": "幾", "发": "發", "只": "隻", "干": "乾", "钟": "鐘"}
# Characters whose kid sense uses the same traditional form although HSK lists several.
SAME_T = {"了": "了", "面": "面", "杯": "杯", "才": "才", "向": "向", "斗": "斗", "谷": "谷", "游": "游",
          "周": "周", "别": "別", "表": "表", "借": "借", "布": "布"}
# Taiwan-standard traditional forms where they differ from the HSK/Wiktionary main form.
TW = {}
# Primary reading for the chosen sense where HSK lists several (or none).
PINYIN = {"大": "dà", "血": "xuè", "长": "cháng", "角": "jiǎo", "发": "fā", "刃": "rèn", "行": "xíng", "皿": "mǐn",
          "臼": "jiù", "片": "piàn", "中": "zhōng", "要": "yào", "了": "le", "几": "jǐ", "少": "shǎo", "间": "jiān",
          "看": "kàn", "相": "xiāng", "觉": "jué", "为": "wèi", "只": "zhī", "好": "hǎo", "会": "huì", "分": "fēn",
          "别": "bié", "朝": "zhāo", "得": "dé", "教": "jiāo", "乐": "lè", "兴": "xìng", "谁": "shéi", "的": "de",
          "吧": "ba", "啊": "a", "都": "dōu", "难": "nán", "和": "hé", "答": "dá", "喝": "hē", "没": "méi", "打": "dǎ",
          "假": "jià", "过": "guò", "还": "hái", "重": "zhòng", "给": "gěi", "地": "dì", "累": "lèi", "斗": "dǒu"}
# The sense kids need, where the character has several (shown to writers).
SENSE = {"后": "after, behind (後)", "里": "inside (裡)", "几": "how many (幾)", "发": "to send out, to start (發)",
         "只": "measure word for animals and birds (隻)", "钟": "bell, clock (鐘)", "斗": "dipper, ladle (北斗)",
         "谷": "valley (山谷)", "面": "face, side (面)", "了": "particle le", "的": "particle de",
         "为": "for (为什么); also 'to do'", "假": "holiday (放假)", "得": "to get (得到)", "地": "earth, ground",
         "朝": "morning (朝阳)", "乐": "happy (快乐)", "教": "to teach", "觉": "to feel (觉得)", "相": "each other (互相)"}

# (en, zh-Hans, zh-Hant, signs)
UNITS: list[tuple[str, str, str, str]] = [
    # ── Pictographs: pictures you can still see ──
    ("People Big and Small", "大人和小孩", "大人和小孩", "人大立介夫子女儿父母"),
    ("My Face", "我的脸", "我的臉", "口目耳面首页牙齿舌眉"),
    ("Hands and Feet", "手和脚", "手和腳", "手又左右足止爪力"),
    ("Body and Beards", "身体和胡子", "身體和鬍子", "身心皮肉血毛而须长老"),
    ("Sky, Hills and Rivers", "天空、高山和河流", "天空、高山和河流", "天日月山水火石田土川"),
    ("Wind, Rain and Lightning", "刮风、下雨和闪电", "颳風、下雨和閃電", "雨云风气申电泉谷丘原"),
    ("Trees and Grain", "树木和庄稼", "樹木和莊稼", "木林竹草花禾米瓜果生"),
    ("On the Farm", "农场里的动物", "農場裡的動物", "马牛羊犬豕鸟鱼角"),
    ("Wild Animals", "野生动物", "野生動物", "象虎鹿龟燕龙鼠兔"),
    ("Wings and Wrigglers", "会飞会爬的小动物", "會飛會爬的小動物", "虫它蛇贝羽飞"),
    ("Weapons and Tools", "兵器和工具", "兵器和工具", "刀弓矢发戈斤工王刃"),
    ("Boats, Nets and Roads", "小船、渔网和道路", "小船、漁網和道路", "舟网车行走永"),
    ("Gates and Houses", "大门和房子", "大門和房子", "门户开关舍井高京仓宫"),
    ("Things at Home", "家里的东西", "家裡的東西", "衣巾伞皿豆鼎瓦册臼"),
    ("Scoops and Rulers", "量一量", "量一量", "斗升尺寸片丰"),
    ("Shells, Lamps and Jade", "贝壳、油灯和玉", "貝殼、油燈和玉", "包主示玉周美元"),
    ("Old Pictures, New Jobs", "老图画，新本领", "老圖畫，新本領", "同非再次告回带用必事"),
    ("Which Way?", "东南西北", "東南西北", "东西南北中方向"),
    ("Borrowed Pictures", "借来的图画", "借來的圖畫", "我来能自要求其午"),
    ("Little Words, Old Pictures", "小字的老图画", "小字的老圖畫", "不了也以己已才者且由"),
    # ── Ideograms: signs that point ──
    ("Counting One to Ten", "从一数到十", "從一數到十", "一二三四五六七八九十"),
    ("How Many?", "有多少", "有多少", "百千万两半几多少"),
    ("Up, Down, In and Out", "上下里外", "上下裡外", "上下小入至内外里间"),
    ("Marks That Point", "会指路的记号", "會指路的記號", "本末朱今古文言音"),
    # ── Compounds: pictures put together ──
    ("Twos and Threes", "两个和三个", "兩個和三個", "从比众森炎双品"),
    ("What Are They Doing?", "他们在做什么", "他們在做什麼", "休坐交听哭吹笑"),
    ("Look!", "看一看", "看一看", "看见直相视觉现"),
    ("Under One Roof", "屋顶下面", "屋頂下面", "安家字寒床因"),
    ("Busy Hands", "忙碌的手", "忙碌的手", "取受争印为只"),
    ("Good Friends", "好朋友", "好朋友", "好男朋友欢帮玩球"),
    ("All Together", "大家一起来", "大家一起來", "合共全公会对就加"),
    ("Cut It Up!", "切一切", "切一切", "分利别新解初"),
    ("Morning and Night", "早上和晚上", "早上和晚上", "明早朝晨晚夜星晴昨"),
    ("Four Seasons", "一年四季", "一年四季", "春夏秋冬年岁时期"),
    ("Coming and Going", "来来去去", "來來去去", "出去进先后前步退正"),
    ("Shells and Money", "贝壳和钱", "貝殼和錢", "买卖得有贵宝"),
    ("At School", "上学啦", "上學啦", "学习师教书典班考"),
    ("Happy Hearts", "快乐的心", "快樂的心", "喜乐兴爱知念名息"),
    ("Fire, Light and Shadow", "火、光和影子", "火、光和影子", "光灰赤热灯点影叟"),
    # ── Phono-semantic: a meaning part + a sound part ──
    ("Me, You and Them", "你、我、他", "你、我、他", "你他她们您谁这那"),
    ("My Family", "我的家人", "我的家人", "爸妈爷奶哥姐弟妹孩"),
    ("Little Helper Words", "小小帮手字", "小小幫手字", "的么吗呢吧啊很都最"),
    ("More Helper Words", "更多帮手字", "更多幫手字", "是在个等样怎太常真难"),
    ("Mouth Words", "口字旁的字", "口字旁的字", "叫唱喊歌问和号"),
    ("Talking Words", "会说话的字", "會說話的字", "说话语请谢认识读记"),
    ("Reading and Writing", "读书写字", "讀書寫字", "写画课汉诉图答第"),
    ("My Head and Body", "我的头和身体", "我的頭和身體", "头脑眼睛脸嘴脚腿"),
    ("Yum, Time to Eat!", "吃饭啦", "吃飯啦", "吃喝饭饿饱渴菜茶蛋食"),
    ("Water Words", "三点水的字", "三點水的字", "河海湖洗游汽油清没"),
    ("Snow and Ice", "冰和雪", "冰和雪", "冰冷凉雪雷零"),
    ("Hand Words", "提手旁的字", "提手旁的字", "打找拿拉推把接放"),
    ("Person Words", "单人旁的字", "單人旁的字", "住作做体位信候假"),
    ("Heart Words", "心里的字", "心裡的字", "想忘思快忙慢怕意"),
    ("On the Move", "走来走去", "走來走去", "过还送远近边道"),
    ("Run, Walk and Stand", "跑一跑，站一站", "跑一跑，站一站", "跑路跟起站到动重"),
    ("Pets and Birds", "小动物和小鸟", "小動物和小鳥", "狗猫猪狼鸡鸭鹅熊"),
    ("Colors", "五颜六色", "五顏六色", "白黑黄青红绿蓝色"),
    ("Metal and Money", "金属和钱", "金屬和錢", "金钱钟银铁错"),
    ("Trees and Wood", "木头做的东西", "木頭做的東西", "树机杯桌椅板校楼条"),
    ("Silk and Clothes", "丝线和衣服", "絲線和衣服", "穿服鞋丝线纸给"),
    ("Places", "各种地方", "各種地方", "地国房店客旁坏块"),
    ("Feeling Well", "身体好", "身體好", "病医累睡康备"),
]


def load_candidates(path: Path) -> dict[str, dict]:
    return {r["s"]: r for r in csv.DictReader(path.open(encoding="utf-8"), delimiter="\t")}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--candidates", type=Path, default=BASE / ".cache" / "candidates_full.tsv")
    ap.add_argument("--research", type=Path, default=BASE / ".cache" / "pool_research")
    ap.add_argument("--check-only", action="store_true")
    a = ap.parse_args()
    cand = load_candidates(a.candidates)

    seen: dict[str, int] = {}
    problems: list[str] = []
    signs: list[dict] = []
    units: list[dict] = []
    for n, (en, zhs, zht, chars) in enumerate(UNITS, 1):
        ids = []
        if not 6 <= len(chars) <= 10:
            problems.append(f"unit {n} {en}: {len(chars)} signs")
        for ch in chars:
            if ch in seen:
                problems.append(f"{ch} twice (units {seen[ch]} and {n})")
                continue
            seen[ch] = n
            if ch in FILM:
                ids.append(ch)
                continue
            r = cand.get(ch)
            if not r:
                problems.append(f"{ch} not in the candidate table")
                continue
            t = COMPOSITE.get(ch) or SAME_T.get(ch) or r["id"].split("-")[-1]
            sid = f"{ch}-{t}" if ch in COMPOSITE else ch
            ids.append(sid)
            signs.append({"id": sid, "s": ch, "t": TW.get(ch, t), "unit": n, "hsk": r["hsk"],
                          "pinyin": r["pinyin"], "ckip": int(r["ckip"]) if r["ckip"] else None,
                          "type": r["type"], "stages": int(r["stages"] or 0)})
        units.append({"n": n, "title": {"en": en, "zh-Hans": zhs, "zh-Hant": zht},
                      "color": PALETTE[(n - 1) % len(PALETTE)], "signs": ids})
    missing_film = [c for c in FILM if c not in seen]
    if missing_film:
        problems.append("film characters not placed: " + "".join(missing_film))

    from collections import Counter
    total = sum(len(u["signs"]) for u in units)
    print(f"units {len(units)}, signs {total} (new {len(signs)}, film {total - len(signs)})")
    lv = Counter(s["hsk"] for s in signs)
    print("by HSK:", dict(sorted(lv.items())))
    print("by type:", dict(Counter(s["type"] for s in signs)))
    print("by stages:", dict(sorted(Counter(s["stages"] for s in signs).items())))
    left = [c for c, r in cand.items() if r["hsk"] == "I-1" and c not in seen]
    print(f"HSK I-1 not selected ({len(left)}):", "".join(left))
    left2 = [c for c, r in cand.items() if r["hsk"] == "I-2" and c not in seen and r["type"] != "phono-semantic"]
    print(f"HSK I-2 non-phono-semantic not selected ({len(left2)}):", "".join(left2))
    for p in problems:
        print("PROBLEM:", p)
    if a.check_only or problems:
        return 1 if problems else 0

    lines = ["# han-500 selection: generated by tools/make_selection.py from its curated unit plan.",
             "# Read by research.py and fetch_glyphs_list.py (stdlib) and by check.mjs / to_yaml.mjs.",
             "# Format: YAML whose values are JSON flow nodes (see tools/selection.py).",
             "# signs[].journey (optional) overrides the default oracle/bronze/seal/clerical plan.",
             json_line("meta", {"total": total, "new": len(signs), "film": total - len(signs),
                                "sources": ["HSK 3.0 (GF 0025-2021) via Wiktionary appendix",
                                            "CKIP word frequency via Wiktionary appendix",
                                            "Wiktionary glyph origins", "Wikimedia Commons ACC project"]}),
             json_line("film", list(FILM)),
             "units:"]
    lines += ["  - " + json.dumps(u, ensure_ascii=False) for u in units]
    lines.append("signs:")
    for s in signs:
        o = {"id": s["id"], "s": s["s"], "t": s["t"], "unit": s["unit"], "hsk": s["hsk"],
             "pinyin": PINYIN.get(s["s"], s["pinyin"]), "ckip": s["ckip"]}
        if s["s"] in SENSE:
            o["sense"] = SENSE[s["s"]]
        if s["id"] in OVERRIDES:
            o["journey"] = OVERRIDES[s["id"]]
        if "/" in o["pinyin"] or not o["pinyin"]:
            raise SystemExit(f"{s['id']}: choose one reading (PINYIN)")
        lines.append("  - " + json.dumps(o, ensure_ascii=False))
    (BASE / "selection.yaml").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print("wrote selection.yaml")
    return 0


def json_line(key: str, val) -> str:
    return f"{key}: {json.dumps(val, ensure_ascii=False)}"


# Journey overrides (stage, form) for signs whose ancient forms are filed under another character.
# Checked against Commons with fetch_glyphs_list.py --index-only (see SELECTION.md).
OVERRIDES: dict[str, list[dict]] = {
    # 气 is the original vapour pictograph; 米 was added later (氣); simplification went back to 气.
    "气": [{"stage": "oracle", "form": "气"}, {"stage": "bronze", "form": "气"},
          {"stage": "seal", "form": "氣"}, {"stage": "clerical", "form": "氣"}],
    # 从 (two people walking) is the original; 辵 was added later (從); simplification went back to 从.
    "从": [{"stage": "oracle", "form": "从"}, {"stage": "bronze", "form": "從"}, {"stage": "seal", "form": "從"}],
    # 虫 (a snake) is the original pictograph; 蟲 triples it. Commons files the early forms under 虫.
    "虫": [{"stage": "oracle", "form": "虫"}, {"stage": "bronze", "form": "虫"}, {"stage": "seal", "form": "虫"}],
    # Commons files the ancient forms of 兩 and 內 under the variants 两 and 内.
    "两": [{"stage": "bronze", "form": "两"}, {"stage": "seal", "form": "两"}],
    "内": [{"stage": "oracle", "form": "内"}, {"stage": "bronze", "form": "内"},
          {"stage": "seal", "form": "内"}, {"stage": "clerical", "form": "内"}],
}

if __name__ == "__main__":
    sys.exit(main())
