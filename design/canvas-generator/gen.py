import json, os, datetime, re

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "canvas")
P = os.path.join(ROOT, "project")
os.makedirs(P, exist_ok=True)

# ---------- tokens ----------
WHITE = '#FFFFFF'; HASH = '#'; DANGER = '#FF7A6B'
BG = '#0B0A09'; SURF = '#171513'; SURF2 = '#221F1B'; LINE = 'rgba(243,237,228,0.09)'; LINE2 = 'rgba(243,237,228,0.16)'
TEXT = '#F3EDE4'; MUTED = '#A39B91'; DIM = '#8C847A'
EMBER = '#C04B28'; EMBER_T = '#E8693F'; CRIM = EMBER; FM_T = EMBER_T; BONE = '#E6DFD5'
SERIF = "'Newsreader',Georgia,serif"; SANS = "'Manrope',system-ui,sans-serif"; WORD = "'Rationale',sans-serif"

ICONS = {
 'home': '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
 'compass': '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>',
 'plus': '<path d="M12 5v14M5 12h14"/>',
 'user': '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
 'search': '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
 'bell': '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
 'back': '<path d="m15 18-6-6 6-6"/>',
 'chev': '<path d="m9 18 6-6-6-6"/>',
 'bookmark': '<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>',
 'share': '<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="m16 6-4-4-4 4"/><path d="M12 2v13"/>',
 'pin': '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>',
 'sliders': '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
 'camera': '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
 'image': '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>',
 'x': '<path d="M18 6 6 18M6 6l12 12"/>',
 'more': '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
 'nav': '<path d="m3 11 19-9-9 19-2-8z"/>',
 'swap': '<path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>',
 'check': '<path d="M20 6 9 17l-5-5"/>',
 'lock': '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
 'edit': '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
 'mail': '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 6-10 7L2 6"/>',
 'phone': '<rect x="6" y="2" width="12" height="20" rx="2"/><path d="M11 18h2"/>',
 'help': '<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
 'doc': '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>',
 'logout': '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/>',
 'trash': '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>',
 'map': '<path d="M1 6v16l7-4 8 4 7-4V2l-7 4-8-4-7 4z"/><path d="M8 2v16M16 6v16"/>',
 'list': '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
 'link': '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
 'download': '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5M12 15V3"/>',
 'story': '<rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".5"/>',
 'clock': '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
 'locate': '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/><circle cx="12" cy="12" r="7"/>',
 'eye': '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
 'tag': '<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8z"/><circle cx="7" cy="7" r="1.5"/>',
 'chevup': '<path d="m18 15-6-6-6 6"/>',
 'users': '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
}

SKULL_D = "M 1.225 2.328 C 4.235 -0.796 9.278 -0.762 12.302 2.346 C 13.401 3.475 13.831 5.117 13.408 6.634 L 13.26 7.165 C 13.181 7.449 13.153 7.745 13.177 8.039 L 13.296 9.444 C 13.35 10.092 13.26 10.743 13.033 11.352 C 12.717 12.199 12.014 12.843 11.142 13.083 L 10.653 13.217 C 10.146 13.357 9.774 13.788 9.711 14.31 L 9.689 14.491 C 9.603 15.199 9.057 15.763 8.352 15.874 C 7.275 16.042 6.172 16.041 5.095 15.873 C 4.395 15.763 3.846 15.206 3.75 14.504 L 3.726 14.336 C 3.653 13.802 3.258 13.368 2.732 13.249 L 2.635 13.227 C 1.832 13.045 1.152 12.511 0.784 11.774 L 0.727 11.662 C 0.324 10.856 0.161 9.951 0.255 9.055 L 0.36 8.049 C 0.392 7.748 0.371 7.443 0.301 7.148 L 0.118 6.374 C -0.225 4.925 0.192 3.4 1.225 2.328 Z M 6.793 10.8 C 6.352 10.801 5.675 12.113 5.675 12.769 C 5.913 13.549 6.493 12.905 6.793 12.905 C 7.092 12.905 7.813 13.549 7.949 12.769 C 7.949 12.113 7.234 10.8 6.793 10.8 Z M 3.266 8.087 C 2.273 8.087 1.807 9.03 1.807 9.817 C 1.807 10.604 2.816 11.479 3.809 11.479 C 4.802 11.479 5.913 10.604 5.913 9.817 C 5.913 9.03 4.26 8.087 3.266 8.087 Z M 10.29 8.087 C 9.296 8.087 7.643 9.03 7.643 9.817 C 7.643 10.604 8.755 11.479 9.748 11.479 C 10.741 11.479 11.749 10.604 11.75 9.817 C 11.75 9.03 11.283 8.087 10.29 8.087 Z"

def icon(n, s=22, c='currentColor', sw=1.75):
    return f'<svg aria-hidden="true" width="{s}" height="{s}" viewBox="0 0 24 24" fill="none" stroke="{c}" stroke-width="{sw}" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0">{ICONS[n]}</svg>'

def skull(s, c, label=None):
    w = round(s * 13.568 / 16, 2)
    a = f'role="img" aria-label="{label}"' if label else 'aria-hidden="true"'
    return f'<svg {a} width="{w}" height="{s}" viewBox="0 0 13.568 16" style="flex-shrink: 0"><path fill="{c}" fill-rule="evenodd" d="{SKULL_D}"/></svg>'

USERS = {
 'ari': ('Ari Mitchell', 'arimitchell', 'AM', '#7A4B2E'),
 'mike': ('Mike Brennan', 'mikebrennan', 'MB', '#4B5563'),
 'josie': ('Josie Hamilton', 'josiehamilton', 'JH', '#0079A3'),
 'alli': ('Alli Mercer', 'allimercer', 'AM', '#2F6F73'),
 'dev': ('Dev Patel', 'devpatel', 'DP', '#5B4B8A'),
 'sam': ('Sam Okafor', 'samokafor', 'SO', '#3E6B4F'),
}

def av(u, s=36):
    n, h, i, c = USERS[u]
    return f'<span style="width: {s}px; height: {s}px; border-radius: 50%; background: {c}; color: #FFFFFF; display: inline-flex; align-items: center; justify-content: center; font-size: {round(s*0.36)}px; font-weight: 700; flex-shrink: 0; letter-spacing: 0.02em">{i}</span>'

def badge(kind, slot=None):
    if kind == 'fm':
        return f'<span style="display: inline-flex; align-items: center; gap: 6px; height: 26px; padding: 0 10px; border-radius: 999px; background: {CRIM}; color: #FFFFFF; font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; white-space: nowrap">{skull(12, WHITE)}Final Meal{(" · " + HASH + str(slot)) if slot else ""}</span>'
    return f'<span style="display: inline-flex; align-items: center; gap: 6px; height: 26px; padding: 0 10px; border-radius: 999px; background: rgba(11,10,9,0.72); border: 1px solid rgba(230,223,213,0.45); color: {BONE}; font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; white-space: nowrap; box-sizing: border-box">Honorable</span>'

def photo(color, h, extra='', radius=0, inner=''):
    return f'<div style="height: {h}px; background: {color}; border-radius: {radius}px; position: relative; display: flex; align-items: center; justify-content: center; color: rgba(243,237,228,0.28); flex-shrink: 0; {extra}">{icon("image", 28)}{inner}</div>'

def ov(x):
    return '<span style="position: absolute; top: 8px; left: 8px">' + x + '</span>'

def thumb(color, s=56, r=12):
    return f'<span aria-hidden="true" style="width: {s}px; height: {s}px; border-radius: {r}px; background: {color}; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; color: rgba(243,237,228,0.28)">{icon("image", round(s*0.36))}</span>'

def btn(label, href, kind='primary', ic=None, extra=''):
    styles = {
      'primary': f'background: {EMBER}; color: #FFFFFF;',
      'ghost': f'background: transparent; color: {TEXT}; border: 1px solid {LINE2};',
      'light': f'background: {TEXT}; color: {BG};',
      'soft': f'background: {SURF2}; color: {TEXT};',
    }[kind]
    i = icon(ic, 18) if ic else ''
    return f'<a href="{href}" style="display: flex; align-items: center; justify-content: center; gap: 8px; height: 54px; border-radius: 14px; box-sizing: border-box; font-size: 15px; font-weight: 700; letter-spacing: 0.01em; text-decoration: none; {styles} {extra}">{i}{label}</a>'

def iconbtn(n, href, label, bg='rgba(243,237,228,0.06)', c=None, dot=False):
    d = f'<span style="position: absolute; top: 10px; right: 11px; width: 8px; height: 8px; border-radius: 50%; background: {EMBER_T}; border: 2px solid {BG}"></span>' if dot else ''
    return f'<a href="{href}" aria-label="{label}" style="position: relative; width: 44px; height: 44px; border-radius: 50%; background: {bg}; color: {c or TEXT}; display: flex; align-items: center; justify-content: center; flex-shrink: 0">{icon(n, 21)}{d}</a>'

def topbar(title, back, right=''):
    return f'<header style="display: flex; align-items: center; gap: 4px; height: 56px; padding: 0 12px 0 6px; flex-shrink: 0">{iconbtn("back", back, "Back", bg="transparent")}<h1 style="margin: 0; flex: 1; font-size: 17px; font-weight: 700; letter-spacing: 0.01em">{title}</h1>{right}</header>'

def tabbar(active):
    def t(key, label, ic, href):
        on = key == active
        c = TEXT if on else DIM
        return f'<a href="{href}" style="display: flex; flex-direction: column; align-items: center; gap: 4px; width: 72px; padding-top: 2px; color: {c}; font-size: 11px; font-weight: {700 if on else 500}; text-decoration: none; letter-spacing: 0.02em">{icon(ic, 24, sw=2 if on else 1.75)}{label}</a>'
    add = f'<a href="AddDish.dc.html" aria-label="Add a dish" style="width: 52px; height: 52px; margin-top: -4px; border-radius: 16px; background: {EMBER}; color: #FFFFFF; display: flex; align-items: center; justify-content: center">{icon("plus", 26, sw=2.25)}</a>'
    return f'<nav aria-label="Main" style="position: absolute; left: 0; right: 0; bottom: 0; height: 88px; background: #12100E; border-top: 1px solid {LINE}; display: flex; justify-content: space-around; align-items: flex-start; padding: 10px 12px 0; box-sizing: border-box">{t("feed","Feed","home","Feed.dc.html")}{t("discover","Discover","compass","Discover.dc.html")}{add}{t("saved","Saved","bookmark","Saved.dc.html")}{t("you","You","user","Profile.dc.html")}</nav>'

def label(t, extra=''):
    return f'<span style="font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: {DIM}; {extra}">{t}</span>'

def field(fid, lab, value='', ph='', typ='text', prefix='', suffix='', focus=False, h=56):
    border = EMBER_T if focus else LINE2
    v = f' value="{value}"' if value else ''
    pre = f'<span style="color: {MUTED}; font-size: 17px; font-weight: 500">{prefix}</span>' if prefix else ''
    return f'''<div style="display: flex; flex-direction: column; gap: 8px"><label for="{fid}" style="font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: {DIM}">{lab}</label><div style="display: flex; align-items: center; gap: 8px; height: {h}px; padding: 0 16px; border-radius: 14px; background: {SURF}; border: 1px solid {border}; box-sizing: border-box">{pre}<input id="{fid}" type="{typ}"{v} placeholder="{ph}" style="flex: 1; min-width: 0; height: 100%; background: transparent; border: 0; outline: none; color: {TEXT}; font-family: {SANS}; font-size: 17px; font-weight: 500">{suffix}</div></div>'''

def textarea(fid, lab, value, count=None, rows=3):
    c = f'<span style="align-self: flex-end; font-size: 12px; color: {DIM}">{count}</span>' if count else ''
    return f'''<div style="display: flex; flex-direction: column; gap: 8px"><label for="{fid}" style="font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: {DIM}">{lab}</label><textarea id="{fid}" rows="{rows}" style="padding: 14px 16px; border-radius: 14px; background: {SURF}; border: 1px solid {LINE2}; color: {TEXT}; font-family: {SERIF}; font-style: italic; font-size: 17px; line-height: 1.45; resize: none; outline: none; box-sizing: border-box">{value}</textarea>{c}</div>'''

def chip(t, on=False, href=None):
    st = f'background: {TEXT}; color: {BG}; border: 1px solid {TEXT};' if on else f'background: transparent; color: {TEXT}; border: 1px solid {LINE2};'
    return f'<button type="button" aria-pressed="{"true" if on else "false"}" style="height: 36px; padding: 0 14px; border-radius: 999px; font-family: {SANS}; font-size: 13px; font-weight: 600; white-space: nowrap; cursor: pointer; {st}">{t}</button>'

def toggle(lab, sub, on):
    track = EMBER if on else '#3A3530'
    pos = 'flex-end' if on else 'flex-start'
    s = f'<span style="font-size: 13px; color: {MUTED}; line-height: 1.4">{sub}</span>' if sub else ''
    return f'<div style="display: flex; align-items: center; gap: 16px; padding: 14px 0; border-bottom: 1px solid {LINE}"><div style="flex: 1; display: flex; flex-direction: column; gap: 3px"><span style="font-size: 15px; font-weight: 600">{lab}</span>{s}</div><button type="button" role="switch" aria-checked="{"true" if on else "false"}" aria-label="{lab}" style="width: 52px; height: 32px; border-radius: 999px; background: {track}; border: 0; padding: 3px; display: flex; justify-content: {pos}; cursor: pointer; flex-shrink: 0"><span style="width: 26px; height: 26px; border-radius: 50%; background: #FFFFFF; display: block"></span></button></div>'

WORDMARKS = {
 'fraunces':   ("'Fraunces',Georgia,serif", 'font-weight: 650; font-variation-settings: \'opsz\' 144; letter-spacing: -0.015em;', 'Final Meal', 1.25, 'Fraunces Semibold'),
 'newsreader': ("'Newsreader',Georgia,serif", 'font-style: italic; font-weight: 500; letter-spacing: -0.02em;', 'final meal', 1.3, 'Newsreader Italic'),
 'instrument': ("'Instrument Serif',Georgia,serif", 'font-weight: 400; letter-spacing: -0.01em;', 'Final Meal', 1.4, 'Instrument Serif'),
 'bricolage':  ("'Bricolage Grotesque',sans-serif", 'font-weight: 800; letter-spacing: -0.04em;', 'final meal', 1.2, 'Bricolage Grotesque ExtraBold'),
 'syne':       ("'Syne',sans-serif", 'font-weight: 800; letter-spacing: 0.02em; text-transform: uppercase;', 'Final Meal', 1.0, 'Syne ExtraBold'),
 'manrope':    ("'Manrope',sans-serif", 'font-weight: 800; letter-spacing: -0.05em;', 'final meal<span style="color: #E8693F">.</span>', 1.2, 'Manrope ExtraBold'),
}
WM = 'instrument'

def wordmark(size=22, c=TEXT, key=None):
    fam, extra, text, scale, _ = WORDMARKS[key or WM]
    return f'<span style="font-family: {fam}; font-size: {round(size * scale)}px; {extra} color: {c}; line-height: 1; white-space: nowrap">{text}</span>'

HEAD = '''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>@TITLE</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="">
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&amp;family=Newsreader:ital,opsz,wght@0,6..72,300;0,6..72,400;0,6..72,500;1,6..72,300;1,6..72,400;1,6..72,500&amp;family=Playfair+Display:ital,wght@0,400;1,400&amp;family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,600;0,9..144,700;1,9..144,300;1,9..144,400&amp;family=Instrument+Serif&amp;family=Bricolage+Grotesque:opsz,wght@12..96,800&amp;family=Syne:wght@800&amp;display=swap" rel="stylesheet">
<style>
body{margin:0;background:#0B0A09}
a{color:#E8693F;text-decoration:none}a:hover{color:#F08A62}
input::placeholder,textarea::placeholder{color:#8C847A}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
</style>
</helmet>
'''

def tail(w, h, props=None, logic='renderVals() { return {}; }'):
    p = {"$preview": {"width": w, "height": h}}
    if props: p.update(props)
    pj = json.dumps(p, ensure_ascii=False).replace("&", "&amp;").replace("'", "&#39;")
    return f'''</x-dc>
<script type="text/x-dc" data-dc-script data-props='{pj}'>
class Component extends DCLogic {{
  {logic}
}}
</script>
</body>
</html>
'''

def screen(title, body, pad_top=True, bg=BG):
    pt = 'padding-top: 47px;' if pad_top else ''
    return HEAD.replace('@TITLE', title) + f'<div style="width: 390px; height: 844px; box-sizing: border-box; {pt} background: {bg}; color: {TEXT}; font-family: {SANS}; position: relative; overflow: hidden; display: flex; flex-direction: column">' + body + '</div>\n' + tail(390, 844)

FILES = {}

def tagchip(t, size=11):
    return f'<span style="display: inline-flex; align-items: center; height: 24px; padding: 0 9px; border-radius: 999px; background: {SURF2}; color: {BONE}; font-size: {size}px; font-weight: 600; white-space: nowrap; letter-spacing: 0.01em">{t}</span>'

def tags(ts):
    return '<span style="display: flex; flex-wrap: wrap; gap: 6px">' + ''.join(tagchip(t) for t in ts) + '</span>'

def tsel(t, on=False):
    if on:
        st = f'background: rgba(192,75,40,0.14); color: {TEXT}; border: 1.5px solid {EMBER_T};'
        ic = icon("check", 14, EMBER_T, 2.5)
    else:
        st = f'background: transparent; color: {TEXT}; border: 1px solid {LINE2};'
        ic = ''
    return f'<button type="button" aria-pressed="{"true" if on else "false"}" style="height: 36px; padding: 0 13px; border-radius: 999px; display: inline-flex; align-items: center; gap: 6px; font-family: {SANS}; font-size: 13px; font-weight: 600; white-space: nowrap; cursor: pointer; box-sizing: border-box; {st}">{ic}{t}</button>'

def addtag():
    return f'<button type="button" style="height: 36px; padding: 0 13px; border-radius: 999px; display: inline-flex; align-items: center; gap: 6px; font-family: {SANS}; font-size: 13px; font-weight: 600; cursor: pointer; background: transparent; color: {MUTED}; border: 1px dashed {LINE2}">{icon("plus", 14)}Your own</button>'
def out(name, html):
    FILES[name] = html

# ---------- dishes ----------
D = {
 'gyro': ('Pork Gyro', 'Skewers', 'Vancouver', '#6E3A1A'),
 'wagyu': ('Wagyu Beef Don', 'Sushi Itto', 'Tokyo', '#5A2020'),
 'biryani': ('Plain Biryani', 'Spicy Time', 'Saskatoon', '#5C3B12'),
 'lobster': ('Lobster Roll', "Luke's Lobster", 'Portland', '#1F4646'),
 'tacos': ('Tacos Al Pastor', 'El Callejón', 'Mexico City', '#4D3410'),
 'burger': ('Smash Burger', 'J. Grill', 'New York', '#5A2A14'),
 'banhmi': ('Banh Mi', 'Bánh', 'Saigon', '#4A4A1E'),
 'khaosoi': ('Khao Soi', 'Kin Kao', 'Vancouver', '#5E4410'),
 'ramen': ('Tonkotsu Ramen', 'Marutama', 'Vancouver', '#4F3A26'),
 'oshi': ('Aburi Salmon Oshi', 'Miku', 'Vancouver', '#5A2E24'),
 'dandan': ('Vegan Dan Dan Noodles', 'Lotus Noodle Bar', 'Vancouver', '#5B2A12'),
 'bun': ('Cardamom Bun', 'Hearth Bakery', 'Vancouver', '#5A4526'),
 'omakase': ('Omakase', 'Sushi Dai', 'Tokyo', '#2E2A26'),
 'nigiri': ('Nigiri Set', 'Sushi Itto', 'Tokyo', '#3C2A2A'),
 'handroll': ('Toro Hand Roll', 'Nami', 'New York', '#3A2222'),
 'gyoza': ('Pork Gyoza', 'Marutama', 'Vancouver', '#5A3A1E'),
 'crispy': ('Crispy Rice Salad', 'Kin Kao', 'Vancouver', '#4F4416'),
}
AREA = {'Skewers': '4th Ave', 'Marutama': 'Bidwell St', 'Kin Kao': 'Main St', 'Miku': 'Waterfront', 'Lotus Noodle Bar': 'Chinatown', 'Hearth Bakery': 'Main St'}
TAGS = {
 'gyro': ['Greek', 'Late night'], 'wagyu': ['Rice bowl', 'Gluten-free'], 'biryani': ['Indian', 'Vegan', 'Gluten-free'],
 'lobster': ['Seafood'], 'tacos': ['Tacos', 'Gluten-free'], 'burger': ['Burgers'], 'banhmi': ['Sandwiches'],
 'khaosoi': ['Thai', 'Noodles', 'Dairy-free'], 'ramen': ['Ramen', 'Noodles'], 'oshi': ['Sushi', 'Low-FODMAP'],
 'dandan': ['Noodles', 'Vegan', 'Spicy'], 'bun': ['Bakery', 'Gluten-free'], 'omakase': ['Sushi', 'Gluten-free', 'Splurge'],
 'nigiri': ['Sushi', 'Low-FODMAP'], 'handroll': ['Sushi'],
 'gyoza': ['Dumplings', 'Pork'], 'crispy': ['Thai', 'Spicy', 'Gluten-free'],
}

# =====================================================================
# BRAND (Main)
# =====================================================================
def brand():
    sw = lambda name, hexv, role, fg='#FFFFFF', border='': f'<div style="display: flex; flex-direction: column; gap: 10px"><div style="height: 96px; border-radius: 14px; background: {hexv}; {border} display: flex; align-items: flex-end; padding: 12px; box-sizing: border-box; color: {fg}; font-size: 12px; font-weight: 700; letter-spacing: 0.04em">{hexv}</div><div style="display: flex; flex-direction: column; gap: 2px"><span style="font-size: 14px; font-weight: 700">{name}</span><span style="font-size: 12px; color: {MUTED}">{role}</span></div></div>'
    body = f'''<div style="width: 1280px; height: 900px; box-sizing: border-box; padding: 64px; background: {BG}; color: {TEXT}; font-family: {SANS}; display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); column-gap: 32px; row-gap: 48px; align-content: start">
<section style="grid-column: span 5; display: flex; flex-direction: column; gap: 28px; padding: 40px; border-radius: 24px; background: {SURF}; border: 1px solid {LINE}; min-height: 420px; justify-content: center; align-items: center">
<svg role="img" aria-label="Final Meal skull mark" width="102" height="120" viewBox="0 0 13.568 16"><path fill="{{{{accent}}}}" fill-rule="evenodd" d="{SKULL_D}"/></svg>
{wordmark(52)}
<span style="font-family: {{{{display}}}}; font-style: italic; font-size: 24px; font-weight: 300; color: {MUTED}">Five dishes. That’s it. Choose.</span>
</section>
<section style="grid-column: span 7; display: flex; flex-direction: column; gap: 22px">
{label("Palette — Candlelit")}
<div style="display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px">
{sw("Night", BG, "Ground", TEXT, f"border: 1px solid {LINE2};")}
{sw("Ash", SURF2, "Surfaces · cards", TEXT, f"border: 1px solid {LINE};")}
{sw("Bone", TEXT, "Text · Honorable", BG)}
{sw("Smoke", MUTED, "Secondary text", BG)}
</div>
<div style="display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px">
<div style="display: flex; flex-direction: column; gap: 10px"><div style="height: 96px; border-radius: 14px; background: {{{{accent}}}}; display: flex; align-items: flex-end; padding: 12px; box-sizing: border-box; color: #FFFFFF; font-size: 12px; font-weight: 700">{{{{accent}}}}</div><div style="display: flex; flex-direction: column; gap: 2px"><span style="font-size: 14px; font-weight: 700">Ember</span><span style="font-size: 12px; color: {MUTED}">Primary actions</span></div></div>
{sw("Ember Glow", EMBER_T, "Accent text · numerals", BG)}
{sw("Ember Wash", "rgba(192,75,40,0.14)", "Selected states", TEXT, "border: 1.5px solid " + EMBER_T + ";")}
<div style="display: flex; flex-direction: column; gap: 10px"><div style="height: 96px; border-radius: 14px; border: 1px solid {LINE}; display: flex; flex-wrap: wrap; align-content: center; gap: 6px; padding: 12px; box-sizing: border-box">{tagchip("Vegan")}{tagchip("Gluten-free")}{tagchip("Sushi")}</div><div style="display: flex; flex-direction: column; gap: 2px"><span style="font-size: 14px; font-weight: 700">Tags</span><span style="font-size: 12px; color: {MUTED}">Ash + Bone</span></div></div>
</div>
</section>
<section style="grid-column: span 7; display: flex; flex-direction: column; gap: 18px">
{label("Type")}
<div style="display: flex; align-items: baseline; gap: 24px; border-bottom: 1px solid {LINE}; padding-bottom: 16px"><span style="font-family: {{{{display}}}}; font-style: italic; font-weight: 300; font-size: 56px; line-height: 1">There can only be five.</span></div>
<div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 24px">
<div style="display: flex; flex-direction: column; gap: 6px"><span style="font-family: {{{{display}}}}; font-style: italic; font-size: 28px">Aa</span><span style="font-size: 13px; font-weight: 700">Display — italic serif</span><span style="font-size: 12px; color: {MUTED}">Headlines, dish names, quotes</span></div>
<div style="display: flex; flex-direction: column; gap: 6px"><span style="font-size: 28px; font-weight: 700">Aa</span><span style="font-size: 13px; font-weight: 700">Manrope</span><span style="font-size: 12px; color: {MUTED}">Interface, labels, buttons</span></div>
<div style="display: flex; flex-direction: column; gap: 6px"><span style="font-family: 'Instrument Serif',Georgia,serif; font-size: 32px; line-height: 1.1">Fm</span><span style="font-size: 13px; font-weight: 700">Instrument Serif</span><span style="font-size: 12px; color: {MUTED}">Wordmark only</span></div>
</div>
</section>
<section style="grid-column: span 5; display: flex; flex-direction: column; gap: 18px">
{label("Components")}
<div style="display: flex; gap: 10px; flex-wrap: wrap; align-items: center">{badge("fm", 1)}{badge("hm")}{tagchip("Low-FODMAP")}{tagchip("Ramen")}</div>
<div style="display: flex; gap: 12px"><a href="#" style="flex: 1; display: flex; align-items: center; justify-content: center; height: 52px; border-radius: 14px; background: {{{{accent}}}}; color: #FFFFFF; font-weight: 700; font-size: 15px">Lock it in</a><a href="#" style="flex: 1; display: flex; align-items: center; justify-content: center; height: 52px; border-radius: 14px; border: 1px solid {LINE2}; color: {TEXT}; font-weight: 700; font-size: 15px">Honorable</a></div>
<div style="display: flex; align-items: center; gap: 16px; padding: 14px 16px; border-radius: 16px; background: {SURF}; border: 1px solid {LINE}"><span style="font-family: {{{{display}}}}; font-style: italic; font-size: 40px; line-height: 1; color: {FM_T}; width: 30px">1</span>{thumb(D["gyro"][3], 52)}<div style="display: flex; flex-direction: column; gap: 3px"><span style="font-size: 16px; font-weight: 700">Pork Gyro</span><span style="font-size: 13px; color: {MUTED}">Skewers · Vancouver</span></div></div>
</section>
</div>
'''
    props = {
      "accent": {"editor": "color", "default": EMBER, "options": [EMBER, "#D9622B", "#B8862F", "#8F3B2A"], "section": "Brand"},
      "display": {"editor": "enum", "default": "'Newsreader',Georgia,serif", "options": ["'Newsreader',Georgia,serif", "'Playfair Display',Georgia,serif", "'Fraunces',Georgia,serif"], "section": "Brand"},
    }
    logic = "renderVals() { return { accent: this.props.accent ?? '%s', display: this.props.display ?? \"'Newsreader',Georgia,serif\" }; }" % (EMBER,)
    return HEAD.replace('@TITLE', 'Brand foundations') + body + '\n' + tail(1280, 900, props, logic)

out('Main.dc.html', brand())

def wordmark_board():
    tiles = ''
    for i, (key, (_, _, _, _, name)) in enumerate(WORDMARKS.items()):
        letter = 'ABCDEF'[i]
        sel = key == WM
        border = f'1.5px solid {EMBER_T}' if sel else f'1px solid {LINE}'
        cur = f'<span style="height: 24px; padding: 0 10px; border-radius: 999px; background: rgba(192,75,40,0.14); color: {EMBER_T}; font-size: 11px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; display: inline-flex; align-items: center">In the screens</span>' if sel else ''
        tiles += f'''<section style="display: flex; flex-direction: column; gap: 18px; padding: 24px; border-radius: 22px; background: {SURF}; border: {border}">
<div style="display: flex; justify-content: space-between; align-items: center; min-height: 24px"><span style="font-size: 12px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: {DIM}">{letter} · {name}</span>{cur}</div>
<div style="height: 120px; display: flex; align-items: center; justify-content: center; gap: 14px">{skull(40, EMBER)}{wordmark(40, TEXT, key)}</div>
<div style="display: flex; gap: 10px">
<div style="flex: 1; height: 52px; border-radius: 14px; background: {BG}; border: 1px solid {LINE}; display: flex; align-items: center; gap: 8px; padding: 0 14px">{skull(18, EMBER)}{wordmark(17, TEXT, key)}</div>
<div style="flex: 1; height: 52px; border-radius: 14px; background: {TEXT}; display: flex; align-items: center; gap: 8px; padding: 0 14px">{skull(18, EMBER)}{wordmark(17, BG, key)}</div>
</div></section>'''
    body = f'''<div style="width: 1280px; height: 900px; box-sizing: border-box; padding: 56px 64px; background: {BG}; color: {TEXT}; font-family: {SANS}; display: flex; flex-direction: column; gap: 28px">
<div style="display: flex; flex-direction: column; gap: 8px">{label("Wordmark explorations")}<h1 style="margin: 0; font-family: {SERIF}; font-style: italic; font-weight: 300; font-size: 40px">Six directions for Final Meal</h1></div>
<div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 20px">{tiles}</div>
</div>'''
    return HEAD.replace('@TITLE', 'Wordmark explorations') + body + '\n' + tail(1280, 900)
out('Wordmark.dc.html', wordmark_board())

# =====================================================================
# ONBOARDING
# =====================================================================
out('Splash.dc.html', screen('Splash', f'''
<div style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 26px; padding: 0 32px">
{skull(96, EMBER, "Final Meal")}
{wordmark(40)}
<p style="margin: 0; font-family: {SERIF}; font-style: italic; font-weight: 300; font-size: 21px; color: {MUTED}; text-align: center">Five dishes. That’s it. Choose.</p>
</div>
<a href="Welcome.dc.html" style="align-self: center; margin-bottom: 56px; padding: 12px 20px; font-size: 13px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: {DIM}">Tap to begin</a>
'''))

def welcome():
    rows = ''.join(f'<li style="display: flex; align-items: baseline; gap: 16px; padding: 12px 0; border-bottom: 1px solid {LINE}; opacity: {op}"><span style="font-family: {SERIF}; font-style: italic; font-size: 30px; color: {FM_T}; width: 22px; line-height: 1">{i}</span><span style="font-family: {SERIF}; font-size: 22px">{d}</span></li>' for i, d, op in [(1,'Wagyu Beef Don',1),(2,'Tacos Al Pastor',0.8),(3,'Lobster Roll',0.6),(4,'Khao Soi',0.4),(5,'?',0.25)])
    return screen('Welcome', f'''
<div style="padding: 24px 28px 0; display: flex; align-items: center; gap: 10px">{skull(22, EMBER)}{wordmark(18)}</div>
<div style="flex: 1; padding: 32px 28px 0; display: flex; flex-direction: column; gap: 24px">
<h1 style="margin: 0; font-family: {SERIF}; font-style: italic; font-weight: 300; font-size: 40px; line-height: 1.1; letter-spacing: -0.01em">If you could only eat five dishes again, what would they be?</h1>
<ol style="margin: 0; padding: 0; list-style: none">{rows}</ol>
</div>
<div style="padding: 0 24px 34px; display: flex; flex-direction: column; gap: 12px">
{btn("Continue with Apple", "OnbName.dc.html", "light")}
{btn("Continue with Google", "OnbName.dc.html", "ghost")}
{btn("Sign up with phone or email", "OnbName.dc.html", "primary")}
<p style="margin: 6px 0 0; text-align: center; font-size: 14px; color: {MUTED}">Already have a table? <a href="Feed.dc.html" style="color: {TEXT}; font-weight: 700">Log in</a></p>
<p style="margin: 0; text-align: center; font-size: 12px; color: {DIM}; line-height: 1.5">By continuing you agree to our <a href="#" style="color: {MUTED}; text-decoration: underline">Terms</a> and <a href="#" style="color: {MUTED}; text-decoration: underline">Privacy Policy</a>.</p>
</div>
''')
def welcome_buttons():
    return f'''<div style="padding: 0 24px 34px; display: flex; flex-direction: column; gap: 12px">
{btn("Continue with Apple", "OnbName.dc.html", "light")}
{btn("Continue with Google", "OnbName.dc.html", "ghost")}
{btn("Continue with email", "OnbEmail.dc.html", "primary", "mail")}
<p style="margin: 4px 0 0; text-align: center; font-size: 14px; color: {MUTED}">Already have an account? <a href="OnbEmail.dc.html" style="color: {TEXT}; font-weight: 700">Log in</a></p>
</div>'''

def mini_pick(u, k, kind, slot, rot, extra=''):
    dish, rest, city, col = D[k]
    return f'<div style="position: absolute; {extra} width: 250px; transform: rotate({rot}deg); background: {SURF}; border: 1px solid {LINE2}; border-radius: 18px; overflow: hidden; box-shadow: 0 18px 40px rgba(0,0,0,0.5)">{photo(col, 110, inner=ov(badge(kind, slot)))}<div style="padding: 10px 14px 12px; display: flex; flex-direction: column; gap: 4px"><span style="font-family: {SERIF}; font-size: 21px; line-height: 1.1">{dish}</span><span style="display: flex; align-items: center; gap: 6px; font-size: 12px; color: {MUTED}">{av(u, 18)}@{USERS[u][1]} · {city}</span></div></div>'

def welcome_a():
    toast = f'<div style="position: absolute; left: 40px; top: 300px; display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-radius: 14px; background: {TEXT}; color: {BG}; font-size: 13px; font-weight: 600; box-shadow: 0 12px 30px rgba(0,0,0,0.5)">{icon("swap", 16, EMBER, 2.25)}<span><strong>Ari</strong> dethroned Tacos Al Pastor</span></div>'
    return screen('Welcome — feed preview', f'''
<div style="padding: 20px 28px 0; display: flex; align-items: center; gap: 10px">{skull(22, EMBER)}{wordmark(18)}</div>
<div aria-hidden="true" style="position: relative; height: 360px; flex-shrink: 0">{mini_pick("mike", "wagyu", "fm", 2, -6, "left: 28px; top: 28px;")}{mini_pick("dev", "khaosoi", "hm", None, 5, "right: 22px; top: 120px;")}{toast}</div>
<div style="flex: 1; padding: 8px 28px 0; display: flex; flex-direction: column; gap: 12px">
<h1 style="margin: 0; font-family: {SERIF}; font-style: italic; font-weight: 300; font-size: 38px; line-height: 1.08">Five dishes. That’s it. Choose.</h1>
<p style="margin: 0; font-size: 15px; line-height: 1.5; color: {MUTED}">Pick your Final Meal, share your lists, and find your next favourite from people you trust.</p>
</div>
{welcome_buttons()}''')

def welcome_b():
    pins = pin_fm(150, 170, 44, True) + pin_fm(60, 260) + pin_fm(280, 120) + pin_hm(110, 120) + pin_hm(220, 250) + pin_hm(320, 230) + pin_hm(40, 160)
    return screen('Welcome', f'''
<div aria-hidden="true" style="position: relative; height: 400px; overflow: hidden; flex-shrink: 0">{map_svg()}{pins}<span style="position: absolute; left: 112px; top: 222px; padding: 6px 10px; border-radius: 10px; background: {TEXT}; color: {BG}; font-size: 12px; font-weight: 700">Marutama · on 14 Final Meals</span><div style="position: absolute; left: 0; right: 0; top: 0; padding: 67px 28px 0; display: flex; align-items: center; gap: 10px">{skull(22, EMBER)}{wordmark(18)}</div></div>
<div style="flex: 1; padding: 22px 28px 0; display: flex; flex-direction: column; gap: 12px">
<h1 style="margin: 0; font-family: {SERIF}; font-style: italic; font-weight: 300; font-size: 36px; line-height: 1.1">Eat where people would eat their last meal.</h1>
<p style="margin: 0; font-size: 15px; line-height: 1.5; color: {MUTED}">Every pin is someone’s favourite dish, not a star rating.</p>
</div>
{welcome_buttons()}''', pad_top=False)

def welcome_c():
    return screen('Welcome — one quote', f'''
<div style="padding: 20px 28px 0; display: flex; align-items: center; gap: 10px">{skull(22, EMBER)}{wordmark(18)}</div>
<div style="flex: 1; padding: 40px 28px 0; display: flex; flex-direction: column; gap: 22px">
<span style="font-family: {SERIF}; font-style: italic; font-weight: 300; font-size: 64px; line-height: 0.95; letter-spacing: -0.02em">Everyone has five.</span>
<figure style="margin: 0; display: flex; flex-direction: column; gap: 14px; padding: 18px; border-radius: 18px; background: {SURF}; border: 1px solid {LINE}">
<span style="display: flex">{badge("fm", 2)}</span>
<blockquote style="margin: 0; font-family: {SERIF}; font-size: 26px; line-height: 1.2">Wagyu Beef Don, Sushi Itto. <span style="font-style: italic; color: {BONE}">“God tier. I still dream about it.”</span></blockquote>
<figcaption style="display: flex; align-items: center; gap: 8px; font-size: 13px; color: {MUTED}">{av("mike", 24)}@mikebrennan · Tokyo</figcaption>
</figure>
<p style="margin: 0; font-size: 15px; line-height: 1.5; color: {MUTED}">What are yours?</p>
</div>
{welcome_buttons()}''')


def onb(title, step, back, nxt, heading, sub, inner, cta='Continue', skip=None, foot=''):
    prog = ''.join(f'<span style="flex: 1; height: 3px; border-radius: 2px; background: {EMBER if i <= step else "rgba(243,237,228,0.14)"}"></span>' for i in range(1, 7))
    sk = f'<a href="{skip}" style="width: 44px; text-align: right; font-size: 14px; font-weight: 600; color: {MUTED}">Skip</a>' if skip else '<span style="width: 44px"></span>'
    return screen(title, f'''
<div style="display: flex; align-items: center; gap: 12px; height: 56px; padding: 0 20px 0 6px; flex-shrink: 0">{iconbtn("back", back, "Back", bg="transparent")}<div role="progressbar" aria-label="Sign-up progress" aria-valuemin="1" aria-valuemax="6" aria-valuenow="{step}" style="flex: 1; display: flex; gap: 6px">{prog}</div>{sk}</div>
<div style="flex: 1; display: flex; flex-direction: column; gap: 28px; padding: 20px 24px 0; min-height: 0">
<div style="display: flex; flex-direction: column; gap: 12px">
{label(f"Step {step} of 6")}
<h1 style="margin: 0; font-family: {SERIF}; font-style: italic; font-weight: 300; font-size: 36px; line-height: 1.12; letter-spacing: -0.01em">{heading}</h1>
<p style="margin: 0; font-size: 15px; line-height: 1.5; color: {MUTED}">{sub}</p>
</div>
{inner}
</div>
<div style="padding: 16px 24px 34px; display: flex; flex-direction: column; gap: 14px">{btn(cta, nxt)}{foot}</div>
''')

out('OnbName.dc.html', onb('Your name', 3, 'OnbOtp.dc.html', 'OnbUsername.dc.html', 'What should we call you?', 'This shows on your profile and on every pick. Signed in with Apple or Google? We’ve filled it in.',
    f'<div style="display: flex; flex-direction: column; gap: 18px">{field("first","First name","Josie")}{field("last","Last name","Hamilton",focus=True)}</div>'))

out('OnbEmail.dc.html', onb('Your email', 1, 'Welcome.dc.html', 'OnbOtp.dc.html', 'What’s your email?', 'We’ll send a code to sign you in. No passwords to remember.',
    field("email","Email","","you@example.com","email",focus=True), cta='Send code',
    foot=f'<p style="margin: 0; text-align: center; font-size: 12px; color: {DIM}">We never share your email. <a href="#" style="color: {MUTED}; text-decoration: underline">Privacy Policy</a></p>'))

out('OnbUsername.dc.html', onb('Your handle', 4, 'OnbName.dc.html', 'OnbLocation.dc.html', 'Claim your handle.', 'This is how friends find your Final Meal.',
    field("handle","Username","josiehamilton","","text","@", f'<span style="display: flex; align-items: center; gap: 4px; color: {BONE}; font-size: 13px; font-weight: 600">{icon("check", 16, BONE, 2.25)}Available</span>', focus=True)
    + f'<p style="margin: -18px 0 0; font-size: 13px; color: {DIM}">Letters, numbers and underscores. You can change it later.</p>'))

def otp():
    digits = ['4', '8', '1', '9', '', '']
    boxes = ''.join(f'<input aria-label="Digit {i+1}" inputmode="numeric" maxlength="1" value="{d}" style="width: 48px; height: 60px; border-radius: 14px; background: {SURF}; border: 1px solid {EMBER_T if i == 4 else LINE2}; color: {TEXT}; text-align: center; font-family: {SANS}; font-size: 24px; font-weight: 700; outline: none; box-sizing: border-box">' for i, d in enumerate(digits))
    return onb('Check your email', 2, 'OnbEmail.dc.html', 'OnbName.dc.html', 'Check your email.', 'Enter the 6-digit code we sent to you@example.com.',
        f'<div style="display: flex; justify-content: space-between">{boxes}</div><div style="display: flex; justify-content: space-between; margin-top: -10px; font-size: 14px"><span style="color: {DIM}">Resend in 0:24</span><a href="OnbEmail.dc.html" style="color: {MUTED}; font-weight: 600">Change email</a></div>{btn("Open mail app", HASH, "soft", "mail", "height: 48px; font-size: 14px")}', cta='Verify')
out('OnbOtp.dc.html', otp())

def loc():
    sug = ''.join(f'<li><a href="OnbPhoto.dc.html" style="display: flex; align-items: center; gap: 12px; padding: 14px 4px; border-bottom: 1px solid {LINE}; color: {TEXT}; font-size: 15px">{icon("pin", 18, MUTED)}<span><strong style="font-weight: 700">{a}</strong>{b}</span></a></li>' for a, b in [('Vanc', 'ouver, BC, Canada'), ('Vanc', 'ouver, WA, USA'), ('Vanc', 'ouver Island, BC')])
    return onb('Your city', 5, 'OnbUsername.dc.html', 'OnbPhoto.dc.html', 'What’s your home city?', 'We’ll show you the best picks nearby. You can change it anytime.',
        f'''<div style="display: flex; flex-direction: column; gap: 4px">{field("city","City","Vanc","Search your city",focus=True)}<ul style="margin: 4px 0 0; padding: 0; list-style: none">{sug}</ul></div>
<a href="OnbPhoto.dc.html" style="display: flex; align-items: center; gap: 10px; margin-top: -12px; font-size: 15px; font-weight: 700; color: {EMBER_T}">{icon("locate", 18, EMBER_T)}Use my current location</a>''', skip='OnbPhoto.dc.html')
out('OnbLocation.dc.html', loc())

def vis_cards(sel):
    def card(key, ic, title, lines):
        on = key == sel
        dot = '<span style="width: 10px; height: 10px; border-radius: 50%; background: ' + EMBER_T + '"></span>' if on else ''
        bullets = ''.join(f'<li style="display: flex; gap: 8px; font-size: 13px; line-height: 1.45; color: {MUTED}">{icon("check", 15, EMBER_T if on else DIM, 2.25)}<span>{l}</span></li>' for l in lines)
        return f'<label style="display: flex; flex-direction: column; gap: 10px; padding: 16px; border-radius: 18px; border: {"1.5px solid " + EMBER_T if on else "1px solid " + LINE2}; background: {"rgba(192,75,40,0.14)" if on else SURF}; cursor: pointer"><input class="sr" type="radio" name="vis" {"checked" if on else ""}><span style="display: flex; align-items: center; gap: 10px"><span style="width: 36px; height: 36px; border-radius: 50%; background: {SURF2}; display: flex; align-items: center; justify-content: center; color: {TEXT}">{icon(ic, 18)}</span><span style="flex: 1; font-size: 17px; font-weight: 700">{title}</span><span aria-hidden="true" style="width: 22px; height: 22px; border-radius: 50%; border: 2px solid {EMBER_T if on else LINE2}; display: flex; align-items: center; justify-content: center">{dot}</span></span><ul style="margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 6px">{bullets}</ul></label>'
    return '<div role="radiogroup" aria-label="Profile visibility" style="display: flex; flex-direction: column; gap: 12px">' + card('pub', 'users', 'Public', ['Your name shows on your picks on Discover and nearby lists', 'Anyone can open your profile and follow you']) + card('priv', 'lock', 'Private', ['Your picks still help the map, but show without your name', 'Nobody can open your profile from Discover', 'Lists you share by link still show you']) + '</div>'


out('OnbPhoto.dc.html', onb('Profile photo', 6, 'OnbLocation.dc.html', 'OnbFirstPick.dc.html', 'Put a face to the plate.', 'Optional, but people follow faces.',
    f'''<div style="display: flex; flex-direction: column; align-items: center; gap: 24px; padding-top: 8px">
<div style="width: 148px; height: 148px; border-radius: 50%; border: 1.5px dashed {LINE2}; background: {SURF}; display: flex; align-items: center; justify-content: center; color: {MUTED}">{icon("camera", 36)}</div>
<div style="display: flex; flex-direction: column; gap: 10px; align-self: stretch">{btn("Take a photo", "OnbFirstPick.dc.html", "soft", "camera")}{btn("Choose from library", "OnbFirstPick.dc.html", "soft", "image")}</div></div>''', skip='OnbFirstPick.dc.html'))

out('OnbFirstPick.dc.html', screen('The hard part', f'''
<div style="flex: 1; display: flex; flex-direction: column; justify-content: center; gap: 22px; padding: 0 32px">
{skull(64, EMBER)}
<h1 style="margin: 0; font-family: {SERIF}; font-style: italic; font-weight: 300; font-size: 44px; line-height: 1.08; letter-spacing: -0.01em">Now for the hard part.</h1>
<p style="margin: 0; font-size: 17px; line-height: 1.5; color: {MUTED}">Five dishes. Forever. What’s the first one on your Final Meal?</p>
<div aria-hidden="true" style="display: flex; gap: 10px; padding-top: 8px">{''.join(f'<span style="width: 40px; height: 40px; border-radius: 12px; border: 1.5px {"solid" if i == 1 else "dashed"} {FM_T if i == 1 else LINE2}; display: flex; align-items: center; justify-content: center; font-family: {SERIF}; font-style: italic; font-size: 20px; color: {FM_T if i == 1 else DIM}">{i}</span>' for i in range(1, 6))}</div>
</div>
<div style="padding: 0 24px 34px; display: flex; flex-direction: column; gap: 6px">{btn(f'{skull(16, WHITE)}Add my first pick', "OnbAddFirst.dc.html")}<a href="OnbTransition.dc.html" style="align-self: center; padding: 12px; font-size: 14px; font-weight: 600; color: {MUTED}">Skip for now</a></div>
'''))

def restaurant_field(val, city, focus=False):
    return f'''<div style="display: flex; flex-direction: column; gap: 8px"><label for="rest" style="font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: {DIM}">Restaurant</label>
<div style="display: flex; align-items: center; gap: 12px; height: 64px; padding: 0 16px; border-radius: 14px; background: {SURF}; border: 1px solid {EMBER_T if focus else LINE2}; box-sizing: border-box">{icon("pin", 20, EMBER_T)}<div style="flex: 1; display: flex; flex-direction: column; gap: 2px; min-width: 0"><input id="rest" value="{val}" style="background: transparent; border: 0; outline: none; color: {TEXT}; font-family: {SANS}; font-size: 16px; font-weight: 600; padding: 0"><span style="font-size: 12px; color: {MUTED}">{city}</span></div><span style="font-size: 13px; font-weight: 600; color: {MUTED}">Change</span></div></div>'''

out('OnbAddFirst.dc.html', screen('Your first pick', topbar('Your first pick', 'OnbFirstPick.dc.html', f'<span style="font-size: 13px; font-weight: 700; color: {FM_T}">#1 of 5</span>') + f'''
<div style="flex: 1; display: flex; flex-direction: column; gap: 18px; padding: 12px 24px 0">
<button type="button" style="height: 104px; border-radius: 18px; border: 1.5px dashed {LINE2}; background: {SURF}; color: {MUTED}; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; font-family: {SANS}; font-size: 14px; font-weight: 600; cursor: pointer">{icon("camera", 28)}Add a photo (optional)</button>
{field("dish","Dish","Pork Gyro","e.g. Wagyu Beef Don")}
{restaurant_field("Skewers", "4th Ave · Vancouver, BC")}
<div style="display: flex; flex-direction: column; gap: 10px">{label("Tags (optional)")}<div style="display: flex; flex-wrap: wrap; gap: 8px">{tsel("Greek", True)}{tsel("Late night", True)}{tsel("Vegan")}{tsel("Gluten-free")}{addtag()}</div></div>
{textarea("note","Why this one? (optional)","Delicious. I’d fly back for it.",rows=1)}
</div>
<div style="padding: 16px 24px 34px">{btn(f'{skull(16, WHITE)}Lock it in', "OnbTransition.dc.html")}</div>
'''))

out('OnbTransition.dc.html', screen('There can only be five', f'''
<a href="FirstLand.dc.html" aria-label="Loading your feed" style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 28px; color: {TEXT}; padding: 0 32px">
{skull(72, CRIM)}
<span style="font-family: {SERIF}; font-style: italic; font-weight: 300; font-size: 40px; text-align: center; line-height: 1.15">There can only be five.</span>
<span aria-hidden="true" style="display: flex; gap: 10px">{''.join(f'<span style="width: 10px; height: 10px; border-radius: 50%; background: {FM_T if i == 0 else "rgba(243,237,228,0.18)"}"></span>' for i in range(5))}</span>
<span role="status" style="margin-top: 40px; display: flex; flex-direction: column; align-items: center; gap: 12px"><span aria-hidden="true" style="width: 160px; height: 3px; border-radius: 2px; background: rgba(243,237,228,0.12); overflow: hidden; display: block"><span style="display: block; width: 62%; height: 100%; background: {EMBER}"></span></span><span style="font-size: 13px; color: {DIM}">Setting your table…</span></span>
</a>
'''))

# =====================================================================
# CORE
# =====================================================================
def feed_card(u, dk, kind, slot, when, note, lists, h=230, has_photo=True):
    n, handle, _, _ = USERS[u]
    dish, rest, city, col = D[dk]
    verb = f'added to their Final Meal' if kind == 'fm' else 'gave an Honorable Mention'
    ov_badge = '<span style="position: absolute; top: 12px; left: 12px">' + badge(kind, slot) + '</span>'
    media = f'<a href="PickDetail.dc.html" aria-label="Open {dish}" style="display: block">{photo(col, h, inner=ov_badge)}</a>' if has_photo else ''
    badge_row = '' if has_photo else f'<span style="display: flex; padding-bottom: 4px">{badge(kind, slot)}</span>'
    return f'''<article style="background: {SURF}; border: 1px solid {LINE}; border-radius: 20px; overflow: hidden; flex-shrink: 0">
<div style="display: flex; align-items: center; gap: 10px; padding: 12px 14px">{av(u, 34)}<div style="flex: 1; display: flex; flex-direction: column; gap: 1px; min-width: 0"><a href="OtherProfile.dc.html" style="font-size: 14px; font-weight: 700; color: {TEXT}">@{handle}</a><span style="font-size: 12px; color: {DIM}">{verb} · {when}</span></div><button type="button" aria-label="More options" style="width: 44px; height: 44px; border: 0; background: transparent; color: {MUTED}; display: flex; align-items: center; justify-content: center">{icon("more", 20)}</button></div>
{media}
<div style="padding: {"14px" if has_photo else "2px"} 16px 8px; display: flex; flex-direction: column; gap: 6px">{badge_row}
<h2 style="margin: 0; font-family: {SERIF}; font-weight: 400; font-size: 26px; line-height: 1.1">{dish}</h2>
<span style="display: flex; align-items: center; gap: 6px; font-size: 13px; color: {MUTED}">{icon("pin", 14)}{rest} · {city}</span>
{tags(TAGS[dk])}
<p style="margin: 4px 0 0; font-family: {SERIF}; font-style: italic; font-size: 16px; line-height: 1.4; color: {BONE}">“{note}”</p>
</div>
<div style="display: flex; align-items: center; padding: 0 6px 6px">
<button type="button" style="height: 44px; padding: 0 10px; border: 0; background: transparent; color: {TEXT}; display: flex; align-items: center; gap: 6px; font-family: {SANS}; font-size: 13px; font-weight: 600">{icon("bookmark", 19)}Save</button>
<span style="flex: 1; font-size: 13px; color: {DIM}">On {lists} lists</span>
<button type="button" aria-label="Share" style="width: 44px; height: 44px; border: 0; background: transparent; color: {MUTED}; display: flex; align-items: center; justify-content: center">{icon("share", 19)}</button>
</div></article>'''

def feed_header():
    return f'''<header style="display: flex; align-items: center; gap: 8px; height: 60px; padding: 0 16px; flex-shrink: 0"><span style="display: flex; align-items: center; gap: 10px; flex: 1">{skull(22, EMBER)}{wordmark(20)}</span>{iconbtn("search", "Search.dc.html", "Search")}{iconbtn("bell", "Notifications.dc.html", "Notifications", dot=True)}</header>'''

def seg(items, active, extra=''):
    return f'<div role="tablist" style="display: flex; gap: 24px; padding: 0 20px; border-bottom: 1px solid {LINE}; flex-shrink: 0; {extra}">' + ''.join(
        f'<a role="tab" aria-selected="{"true" if i == active else "false"}" href="{h}" style="padding: 12px 0; font-size: 14px; font-weight: 700; color: {TEXT if i == active else DIM}; border-bottom: 2px solid {EMBER_T if i == active else "transparent"}; margin-bottom: -1px">{t}</a>' for i, (t, h) in enumerate(items)) + '</div>'

out('Feed.dc.html', screen('Feed', feed_header() + seg([('Following', 'Feed.dc.html'), ('Nearby', 'Discover.dc.html'), ('Trending', 'Feed.dc.html')], 0) + f'''
<div style="flex: 1; display: flex; flex-direction: column; gap: 14px; padding: 14px 12px 100px; overflow: hidden">
{feed_card("ari", "gyro", "fm", 1, "2h", "Delicious. I’d fly back for it.", 8)}
{feed_card("mike", "wagyu", "fm", 2, "5h", "God tier. I still dream about it.", 23)}
</div>
''' + tabbar('feed')))

def ad_card():
    return f'''<article aria-label="Sponsored" style="background: {SURF}; border: 1px solid {LINE}; border-radius: 20px; overflow: hidden; flex-shrink: 0">
<div style="display: flex; align-items: center; gap: 10px; padding: 12px 14px"><span style="width: 34px; height: 34px; border-radius: 10px; background: {D["bun"][3]}; flex-shrink: 0"></span><div style="flex: 1; display: flex; flex-direction: column; gap: 1px; min-width: 0"><span style="font-size: 14px; font-weight: 700">Hearth Bakery</span><span style="font-size: 12px; color: {DIM}">Sponsored · Main St, Vancouver</span></div><button type="button" aria-label="Ad options" style="width: 44px; height: 44px; border: 0; background: transparent; color: {MUTED}; display: flex; align-items: center; justify-content: center">{icon("more", 20)}</button></div>
{photo(D["bun"][3], 170)}
<div style="padding: 14px 16px 6px; display: flex; flex-direction: column; gap: 6px"><h2 style="margin: 0; font-family: {SERIF}; font-weight: 400; font-size: 24px; line-height: 1.15">Gluten-free cardamom buns, every Saturday.</h2><span style="font-size: 13px; color: {MUTED}">On 31 Vancouver lists</span></div>
<div style="display: flex; gap: 10px; padding: 8px 16px 14px">{btn("View menu", HASH, "soft", None, "flex: 1; height: 44px; font-size: 14px")}{btn("Directions", HASH, "ghost", "nav", "flex: 1; height: 44px; font-size: 14px")}</div>
<a href="RemoveAds.dc.html" style="display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-top: 1px solid {LINE}; font-size: 12px; color: {MUTED}">Ads keep Final Meal free.<span style="color: {EMBER_T}; font-weight: 700">Remove ads · $5 once</span></a>
</article>'''

def feed_ad():
    return screen('Feed with Honorable Mention and ad', feed_header() + seg([('Following', 'Feed.dc.html'), ('Nearby', 'Discover.dc.html'), ('Trending', 'Feed.dc.html')], 0) + f'''
<div style="flex: 1; display: flex; flex-direction: column; gap: 14px; padding: 14px 12px 100px; overflow: hidden">
{feed_card("dev", "khaosoi", "hm", None, "1h", "Not quite top five, but I’d cross town for it.", 6, has_photo=False)}
{ad_card()}
{feed_card("alli", "biryani", "fm", 3, "6h", "The spice level was absolutely perfect.", 11)}
</div>
''' + tabbar('feed'))
out('FeedAd.dc.html', feed_ad())

def remove_ads():
    pt = lambda t: f'<li style="display: flex; align-items: center; gap: 12px; padding: 12px 0; border-bottom: 1px solid {LINE}; font-size: 15px">{icon("check", 18, EMBER_T, 2.5)}{t}</li>'
    return screen('Remove ads', topbar('', 'Settings.dc.html') + f'''
<div style="flex: 1; display: flex; flex-direction: column; gap: 22px; padding: 12px 28px 0">
{skull(56, EMBER)}
<h1 style="margin: 0; font-family: {SERIF}; font-style: italic; font-weight: 300; font-size: 44px; line-height: 1.05">Go ad-free.</h1>
<p style="margin: 0; font-size: 17px; line-height: 1.5; color: {MUTED}"><strong style="color: {TEXT}">$5, once.</strong> No subscription, no renewals.</p>
<ul style="margin: 0; padding: 0; list-style: none">{pt("No ads in your feed or on Discover")}{pt("Yours forever, on every device you sign into")}{pt("Helps keep Final Meal independent")}</ul>
</div>
<div style="padding: 16px 24px 34px; display: flex; flex-direction: column; gap: 6px">{btn("Remove ads — $5", "Feed.dc.html")}<button type="button" style="height: 44px; border: 0; background: transparent; color: {MUTED}; font-family: {SANS}; font-size: 14px; font-weight: 600">Restore purchase</button><p style="margin: 0; text-align: center; font-size: 12px; color: {DIM}; line-height: 1.5">One-time purchase through the App Store or Google Play. Price shown in local currency.</p></div>
''')
out('RemoveAds.dc.html', remove_ads())

def feed_empty():
    sugg = ''.join(f'<li style="display: flex; align-items: center; gap: 12px; padding: 12px 0; border-bottom: 1px solid {LINE}">{av(u, 44)}<div style="flex: 1; display: flex; flex-direction: column; gap: 2px; min-width: 0"><span style="font-size: 15px; font-weight: 700">{USERS[u][0]}</span><span style="font-size: 13px; color: {MUTED}">#1 · {D[d][0]}</span></div><button type="button" style="height: 36px; padding: 0 16px; border-radius: 999px; border: 0; background: {TEXT}; color: {BG}; font-family: {SANS}; font-size: 13px; font-weight: 700">Follow</button></li>' for u, d in [('mike', 'wagyu'), ('alli', 'biryani'), ('ari', 'gyro'), ('dev', 'khaosoi')])
    return screen('Feed — empty', feed_header() + f'''
<div style="flex: 1; display: flex; flex-direction: column; gap: 28px; padding: 24px 24px 100px">
<div style="display: flex; flex-direction: column; gap: 12px; padding: 28px 24px; border-radius: 20px; border: 1px solid {LINE}; background: {SURF}">
{skull(36, DIM)}
<h1 style="margin: 0; font-family: {SERIF}; font-style: italic; font-weight: 300; font-size: 32px; line-height: 1.15">An empty table.</h1>
<p style="margin: 0; font-size: 15px; line-height: 1.5; color: {MUTED}">Follow a few people and their picks show up here. Better yet, bring your friends.</p>
<div style="display: flex; gap: 10px; padding-top: 6px">{btn("Invite friends", "ShareCard.dc.html", "primary", "users", "flex: 1; height: 46px; font-size: 14px")}{btn("Find people", "Search.dc.html", "ghost", None, "flex: 1; height: 46px; font-size: 14px")}</div>
</div>
<div style="display: flex; flex-direction: column; gap: 4px">{label("Popular near Vancouver")}<ul style="margin: 0; padding: 0; list-style: none">{sugg}</ul></div>
</div>
''' + tabbar('feed'))
out('FeedEmpty.dc.html', feed_empty())

def first_land():
    dish, rest, city, col = D["gyro"]
    seats = ''.join(f'<span style="width: 30px; height: 30px; border-radius: 9px; border: 1.5px {"solid" if i == 1 else "dashed"} {EMBER_T if i == 1 else LINE2}; background: {"rgba(192,75,40,0.14)" if i == 1 else "transparent"}; display: flex; align-items: center; justify-content: center; font-family: {SERIF}; font-style: italic; font-size: 16px; color: {EMBER_T if i == 1 else DIM}">{i}</span>' for i in range(1, 6))
    stack = ''.join(f'<span style="margin-left: {0 if i == 0 else -8}px; border: 2px solid {SURF}; border-radius: 50%; display: inline-flex">{av(u, 22)}</span>' for i, u in enumerate(['ari', 'dev', 'sam']))
    return screen('First landing', feed_header() + f'''
<div style="flex: 1; display: flex; flex-direction: column; gap: 16px; padding: 8px 12px 100px; overflow: hidden">
<div style="display: flex; flex-direction: column; gap: 4px; padding: 0 6px">{label("Welcome, Josie")}<h1 style="margin: 0; font-family: {SERIF}; font-style: italic; font-weight: 300; font-size: 32px; line-height: 1.1">Your Final Meal has begun.</h1></div>
<article style="background: {SURF}; border: 1px solid {LINE2}; border-radius: 22px; overflow: hidden; flex-shrink: 0">
<a href="PickDetail.dc.html" aria-label="Open {dish}" style="display: block">{photo(col, 150, inner=ov(badge("fm", 1)))}</a>
<div style="padding: 14px 16px 16px; display: flex; flex-direction: column; gap: 8px">
<h2 style="margin: 0; font-family: {SERIF}; font-weight: 400; font-size: 28px; line-height: 1.05">{dish}</h2>
<span style="display: flex; align-items: center; gap: 6px; font-size: 13px; color: {MUTED}">{icon("pin", 14)}{rest} · {city}</span>
<p style="margin: 0; font-family: {SERIF}; font-style: italic; font-size: 16px; color: {BONE}">“Delicious. I’d fly back for it.”</p>
<span style="display: flex; align-items: center; gap: 8px; font-size: 12px; color: {MUTED}"><span style="display: flex">{stack}</span>8 others in Vancouver have Skewers on their list</span>
<div style="height: 1px; background: {LINE}; margin: 4px 0"></div>
<div style="display: flex; align-items: center; gap: 12px"><span aria-label="1 of 5 chosen" style="display: flex; gap: 6px">{seats}</span><span style="flex: 1; font-size: 13px; color: {MUTED}">4 seats left</span></div>
{btn("Add your next dish", "AddDish.dc.html", "primary", "plus", "height: 46px; font-size: 14px")}
</div></article>
<div style="display: flex; align-items: baseline; justify-content: space-between; padding: 6px 6px 0"><h2 style="margin: 0; font-family: {SERIF}; font-style: italic; font-weight: 300; font-size: 24px">Nearby in Vancouver</h2><a href="Discover.dc.html" style="font-size: 13px; font-weight: 700; color: {EMBER_T}">See the map</a></div>
{feed_card("dev", "ramen", "fm", 1, "3h", "The broth is a religious experience.", 14, h=150)}
</div>''' + tabbar('feed'))
out('FirstLand.dc.html', first_land())

def tier_card(title, sub, on, kind):
    border = f'1.5px solid {FM_T}' if on else f'1px solid {LINE2}'
    mark = skull(16, FM_T) if kind == 'fm' else f'<span style="width: 12px; height: 12px; border-radius: 50%; border: 1.5px solid {BONE}"></span>'
    return f'<label style="flex: 1; display: flex; flex-direction: column; gap: 6px; padding: 14px; border-radius: 16px; border: {border}; background: {"rgba(192,75,40,0.14)" if on else "transparent"}; cursor: pointer; box-sizing: border-box"><input class="sr" type="radio" name="tier" {"checked" if on else ""}><span style="display: flex; align-items: center; gap: 8px; font-size: 15px; font-weight: 700">{mark}{title}</span><span style="font-size: 12px; color: {MUTED}; line-height: 1.4">{sub}</span></label>'

out('AddDish.dc.html', screen('Add a dish', f'''
<div aria-hidden="true" style="position: absolute; inset: 0; background: #050404"></div>
<section aria-label="Add a dish" style="position: absolute; left: 0; right: 0; bottom: 0; top: 60px; background: {SURF}; border-radius: 28px 28px 0 0; border-top: 1px solid {LINE2}; display: flex; flex-direction: column; padding: 10px 20px 34px; gap: 16px; box-sizing: border-box">
<span aria-hidden="true" style="align-self: center; width: 40px; height: 5px; border-radius: 3px; background: {LINE2}"></span>
<div style="display: flex; align-items: center; justify-content: space-between"><h1 style="margin: 0; font-family: {SERIF}; font-style: italic; font-weight: 300; font-size: 30px">Add a dish</h1>{iconbtn("x", "Feed.dc.html", "Close")}</div>
<div style="display: flex; gap: 12px; align-items: center"><button type="button" style="width: 72px; height: 72px; border-radius: 16px; border: 1.5px dashed {LINE2}; background: {BG}; color: {MUTED}; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; font-family: {SANS}; font-size: 12px; font-weight: 600">{icon("camera", 22)}Photo</button><p style="margin: 0; flex: 1; font-size: 13px; line-height: 1.5; color: {MUTED}"><strong style="color: {TEXT}; font-weight: 700">Photo (optional).</strong> Only your own. We never use stock images.</p></div>
{field("dish2","Dish","Tonkotsu Ramen","e.g. Smash Burger")}
{restaurant_field("Marutama Ramen", "Bidwell St · Vancouver, BC")}
<div style="display: flex; flex-direction: column; gap: 8px">{label("Add to")}<div role="radiogroup" aria-label="List" style="display: flex; gap: 10px">{tier_card("Final Meal", "5 of 5 used. You’ll choose one to replace.", True, "fm")}{tier_card("Honorable", "Unlimited runners-up.", False, "hm")}</div></div>
{textarea("note2","Note (optional)","The broth is a religious experience.",rows=1)}
<a href="AddDishTags.dc.html" style="display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-radius: 14px; border: 1px dashed {LINE2}; color: {TEXT}">{icon("tag", 20, EMBER_T)}<span style="flex: 1; display: flex; flex-direction: column; gap: 2px"><span style="font-size: 15px; font-weight: 700">Add tags</span><span style="font-size: 12px; color: {MUTED}">Optional · food type, dietary, your own</span></span>{icon("plus", 18, MUTED)}</a>
<div style="margin-top: auto">{btn(f'{skull(16, WHITE)}Add to Final Meal', "Swap.dc.html")}</div>
</section>
''', pad_top=False))

def morechip(href):
    return f'<a href="{href}" style="height: 36px; padding: 0 13px; border-radius: 999px; display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 700; color: {EMBER_T}; border: 1px dashed {EMBER_T}; box-sizing: border-box">{icon("search", 14)}More</a>'

def tag_search():
    res = [('Korean', True), ('Korean BBQ', False), ('Korean fried chicken', False), ('Kimchi jjigae', False), ('Kombucha', False)]
    rows = ''.join(f'<li style="display: flex; align-items: center; gap: 12px; padding: 0 2px; min-height: 52px; border-bottom: 1px solid {LINE}"><span style="flex: 1; font-size: 15px; font-weight: 600"><strong style="font-weight: 800">{t[:3]}</strong>{t[3:]}</span><button type="button" aria-pressed="{"true" if on else "false"}" aria-label="Add {t}" style="width: 32px; height: 32px; border-radius: 9px; border: {"0" if on else "1px solid " + LINE2}; background: {EMBER if on else "transparent"}; color: {WHITE if on else MUTED}; display: flex; align-items: center; justify-content: center">{icon("check" if on else "plus", 16, sw=2.5)}</button></li>' for t, on in res)
    pop = ''.join(tsel(t) for t in ['Dim sum', 'Pho', 'Pizza', 'Curry', 'Dumplings', 'BBQ', 'Brunch', 'Ice cream'])
    return screen('Find a tag', topbar('Add food type', 'AddDishTags.dc.html', f'<a href="AddDishTags.dc.html" style="font-size: 15px; font-weight: 700; color: {EMBER_T}; padding: 8px">Done</a>') + f'''
<div style="padding: 4px 16px 0">{fmt_toggle_labels("Food type", "Dietary", 0)}</div>
<div style="padding: 12px 16px 0"><div style="height: 48px; border-radius: 14px; background: {SURF}; border: 1px solid {EMBER_T}; display: flex; align-items: center; gap: 10px; padding: 0 14px">{icon("search", 18, MUTED)}<label class="sr" for="tq">Search food types</label><input id="tq" type="search" value="kor" style="flex: 1; min-width: 0; background: transparent; border: 0; outline: none; color: {TEXT}; font-family: {SANS}; font-size: 16px; font-weight: 500"></div></div>
<div style="flex: 1; display: flex; flex-direction: column; gap: 20px; padding: 10px 20px 0">
<ul style="margin: 0; padding: 0; list-style: none">{rows}</ul>
<a href="AddDishTags.dc.html" style="display: flex; align-items: center; gap: 10px; font-size: 14px; color: {MUTED}">{icon("plus", 16, EMBER_T)}<span>Not here? Add <strong style="color: {TEXT}">“kor”</strong> to <strong style="color: {TEXT}">Your tags</strong> instead</span></a>
<div style="display: flex; flex-direction: column; gap: 10px">{label("Popular")}<div style="display: flex; flex-wrap: wrap; gap: 8px">{pop}</div></div>
</div>''')

def fmt_toggle_labels(a, b2, active):
    def b(t, on):
        st = f'background: {SURF2}; color: {TEXT};' if on else f'background: transparent; color: {MUTED};'
        return f'<button type="button" aria-pressed="{"true" if on else "false"}" style="flex: 1; height: 38px; border: 0; border-radius: 10px; font-family: {SANS}; font-size: 13px; font-weight: 700; cursor: pointer; {st}">{t}</button>'
    return f'<div style="display: flex; gap: 4px; padding: 4px; border-radius: 14px; background: {SURF}; border: 1px solid {LINE}">{b(a, active == 0)}{b(b2, active == 1)}</div>'

def add_tags():
    food = ''.join([tsel("Ramen", True), tsel("Noodles", True), tsel("Japanese"), tsel("Soup"), tsel("Pork"), morechip("TagSearch.dc.html")])
    diet = ''.join([tsel("Vegan"), tsel("Vegetarian"), tsel("Gluten-free"), tsel("Low-FODMAP"), tsel("Dairy-free", True), tsel("Nut-free"), tsel("Halal"), morechip("TagSearch.dc.html")])
    mine = ''.join([tsel("Rainy day", True), addtag()])
    grp = lambda t, hint, body: f'<div style="display: flex; flex-direction: column; gap: 10px"><div style="display: flex; justify-content: space-between; align-items: baseline">{label(t)}<span style="font-size: 12px; color: {DIM}">{hint}</span></div><div style="display: flex; flex-wrap: wrap; gap: 8px">{body}</div></div>'
    return screen('Add a dish — tags open', f'''
<div aria-hidden="true" style="position: absolute; inset: 0; background: #050404"></div>
<section aria-label="Add a dish" style="position: absolute; left: 0; right: 0; bottom: 0; top: 60px; background: {SURF}; border-radius: 28px 28px 0 0; border-top: 1px solid {LINE2}; display: flex; flex-direction: column; padding: 10px 20px 34px; gap: 16px; box-sizing: border-box; overflow: hidden">
<span aria-hidden="true" style="align-self: center; width: 40px; height: 5px; border-radius: 3px; background: {LINE2}"></span>
<div style="display: flex; align-items: center; justify-content: space-between"><h1 style="margin: 0; font-family: {SERIF}; font-style: italic; font-weight: 300; font-size: 30px">Add a dish</h1>{iconbtn("x", "Feed.dc.html", "Close")}</div>
<div style="display: flex; align-items: center; gap: 12px; padding: 10px 12px; border-radius: 14px; background: {BG}; border: 1px solid {LINE}">{thumb(D["ramen"][3], 40, 10)}<span style="flex: 1; display: flex; flex-direction: column; gap: 2px"><span style="font-size: 15px; font-weight: 700">Tonkotsu Ramen</span><span style="font-size: 12px; color: {MUTED}">Marutama · Vancouver · note added</span></span><span style="display: flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: {EMBER_T}">{skull(12, EMBER_T)}Final Meal</span></div>
<div style="display: flex; flex-direction: column; gap: 16px; padding: 14px; border-radius: 18px; border: 1px solid {LINE2}">
<a href="AddDish.dc.html" style="display: flex; align-items: center; gap: 10px; color: {TEXT}">{icon("tag", 18, EMBER_T)}<span style="flex: 1; font-size: 15px; font-weight: 700">Tags <span style="font-weight: 500; color: {MUTED}">· optional</span></span><span style="display: flex; align-items: center; gap: 4px; font-size: 13px; font-weight: 600; color: {MUTED}">Hide{icon("chevup", 16)}</span></a>
{grp("Food type", "Suggested", food)}
{grp("Dietary", "Any that apply", diet)}
{grp("Your tags", "Just for you", mine)}
</div>
<div style="margin-top: auto">{btn(f'{skull(16, WHITE)}Add to Final Meal', "Swap.dc.html")}</div>
</section>
''', pad_top=False)
out('AddDishTags.dc.html', add_tags())
out('TagSearch.dc.html', tag_search())

def swap():
    cur = [('gyro', 1), ('wagyu', 2), ('biryani', 3), ('lobster', 4), ('tacos', 5)]
    rows = ''.join(f'''<label style="display: flex; align-items: center; gap: 14px; padding: 12px 14px; border-radius: 16px; border: {"1.5px solid " + FM_T if s == 4 else "1px solid " + LINE}; background: {"rgba(192,75,40,0.14)" if s == 4 else SURF}; cursor: pointer"><input class="sr" type="radio" name="swap" {"checked" if s == 4 else ""}><span style="font-family: {SERIF}; font-style: italic; font-size: 30px; line-height: 1; color: {FM_T}; width: 20px">{s}</span>{thumb(D[k][3], 44, 10)}<span style="flex: 1; display: flex; flex-direction: column; gap: 2px; min-width: 0"><span style="font-size: 15px; font-weight: 700{"; text-decoration: line-through; text-decoration-color: " + FM_T if s == 4 else ""}">{D[k][0]}</span><span style="font-size: 12px; color: {MUTED}">{D[k][1]} · {D[k][2]}</span></span><span aria-hidden="true" style="width: 22px; height: 22px; border-radius: 50%; border: 2px solid {FM_T if s == 4 else LINE2}; display: flex; align-items: center; justify-content: center">{f'<span style="width: 10px; height: 10px; border-radius: 50%; background: {FM_T}"></span>' if s == 4 else ''}</span></label>''' for k, s in cur)
    return screen('Swap a dish', topbar('Your five are full', 'AddDish.dc.html') + f'''
<div style="flex: 1; display: flex; flex-direction: column; gap: 18px; padding: 8px 20px 0; min-height: 0">
<h2 style="margin: 0; font-family: {SERIF}; font-style: italic; font-weight: 300; font-size: 34px; line-height: 1.1">Something has to go.</h2>
<div style="display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-radius: 16px; border: 1.5px dashed {EMBER_T}">{thumb(D["ramen"][3], 44, 10)}<span style="flex: 1; display: flex; flex-direction: column; gap: 2px"><span style="font-size: 15px; font-weight: 700">Tonkotsu Ramen</span><span style="font-size: 12px; color: {MUTED}">Marutama · Vancouver</span></span><span style="font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: {EMBER_T}">Incoming</span></div>
<p style="margin: 0; font-size: 14px; line-height: 1.5; color: {MUTED}">Pick the dish it replaces. That one moves to your Honorable Mentions — nothing is deleted.</p>
<div role="radiogroup" aria-label="Dish to replace" style="display: flex; flex-direction: column; gap: 8px">{rows}</div>
</div>
<div style="padding: 16px 20px 34px; display: flex; flex-direction: column; gap: 4px">{btn(f'{icon("swap", 18)}Replace Lobster Roll', "Profile.dc.html")}<a href="Feed.dc.html" style="align-self: center; padding: 12px; font-size: 14px; font-weight: 600; color: {MUTED}">Cancel</a></div>
''')
out('Swap.dc.html', swap())

def pick_detail():
    dish, rest, city, col = D['wagyu']
    stack = ''.join(f'<span style="margin-left: {0 if i == 0 else -10}px; border: 2px solid {BG}; border-radius: 50%; display: inline-flex">{av(u, 32)}</span>' for i, u in enumerate(['ari', 'alli', 'dev', 'sam']))
    return screen('Pick detail', f'''
<div style="position: relative">{photo(col, 400)}
<div style="position: absolute; top: 47px; left: 12px; right: 12px; display: flex; justify-content: space-between">{iconbtn("back", "Feed.dc.html", "Back", "rgba(11,10,9,0.6)")}<span style="display: flex; gap: 8px">{iconbtn("share", "ShareHub.dc.html", "Share", "rgba(11,10,9,0.6)")}{iconbtn("bookmark", "Saved.dc.html", "Save", "rgba(11,10,9,0.6)")}</span></div>
<span style="position: absolute; left: 20px; bottom: 16px">{badge("fm", 2)}</span></div>
<div style="flex: 1; display: flex; flex-direction: column; gap: 18px; padding: 20px 20px 0">
<div style="display: flex; flex-direction: column; gap: 6px"><h1 style="margin: 0; font-family: {SERIF}; font-weight: 400; font-size: 40px; line-height: 1.05; letter-spacing: -0.01em">{dish}</h1><span style="display: flex; align-items: center; gap: 6px; font-size: 15px; color: {MUTED}">{icon("pin", 16)}{rest} · Shibuya, {city}</span>{tags(["Rice bowl", "Japanese", "Gluten-free", "Splurge"])}</div>
<div style="display: flex; gap: 10px">{btn("Directions", HASH, "ghost", "nav", "flex: 1; height: 48px; font-size: 14px")}{btn("Save to try", "Saved.dc.html", "primary", "bookmark", "flex: 1; height: 48px; font-size: 14px")}</div>
<figure style="margin: 0; padding: 16px; border-radius: 18px; background: {SURF}; border: 1px solid {LINE}; display: flex; flex-direction: column; gap: 12px"><blockquote style="margin: 0; font-family: {SERIF}; font-style: italic; font-size: 19px; line-height: 1.4; color: {BONE}">“God tier. I still dream about it.”</blockquote><figcaption style="display: flex; align-items: center; gap: 10px">{av("mike", 28)}<span style="font-size: 13px; color: {MUTED}"><a href="OtherProfile.dc.html" style="color: {TEXT}; font-weight: 700">@mikebrennan</a> · #2 on his Final Meal</span></figcaption></figure>
<a href="#" style="display: flex; align-items: center; gap: 12px; color: {TEXT}"><span style="display: flex">{stack}</span><span style="flex: 1; font-size: 14px; font-weight: 600">On 23 Final Meals</span>{icon("chev", 18, MUTED)}</a>
</div>
''', pad_top=False)
out('PickDetail.dc.html', pick_detail())

def share_card():
    mine = [('gyro', 'Skewers'), ('wagyu', 'Sushi Itto'), ('biryani', 'Spicy Time'), ('lobster', "Luke's Lobster"), ('tacos', 'El Callejón')]
    items = ''.join(f'<li style="display: flex; align-items: baseline; gap: 12px; padding: 9px 0; border-bottom: 1px solid {LINE}"><span style="font-family: {SERIF}; font-style: italic; font-size: 24px; line-height: 1; color: {FM_T}; width: 16px">{i+1}</span><span style="display: flex; flex-direction: column; gap: 1px"><span style="font-family: {SERIF}; font-size: 18px">{D[k][0]}</span><span style="font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; color: {DIM}">{r}</span></span></li>' for i, (k, r) in enumerate(mine))
    act = lambda ic, t: f'<button type="button" style="display: flex; flex-direction: column; align-items: center; gap: 8px; border: 0; background: transparent; color: {TEXT}; font-family: {SANS}; font-size: 12px; font-weight: 600; cursor: pointer"><span style="width: 56px; height: 56px; border-radius: 50%; background: {SURF2}; display: flex; align-items: center; justify-content: center">{icon(ic, 22)}</span>{t}</button>'
    return screen('Share your Final Meal', topbar('Share your Final Meal', 'ShareHub.dc.html') + f'''
<div style="flex: 1; display: flex; align-items: center; justify-content: center; padding: 8px 0">
<div style="width: 280px; height: 498px; border-radius: 22px; background: #000000; border: 1px solid {LINE2}; padding: 28px 24px; box-sizing: border-box; display: flex; flex-direction: column; gap: 18px">
<div style="display: flex; align-items: center; gap: 8px">{skull(18, EMBER)}{wordmark(13)}</div>
<div style="display: flex; flex-direction: column; gap: 4px"><span style="font-size: 10px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: {DIM}">The Final Meal of</span><span style="font-family: {SERIF}; font-style: italic; font-weight: 300; font-size: 32px; line-height: 1">Josie Hamilton</span></div>
<ol style="margin: 0; padding: 0; list-style: none; flex: 1">{items}</ol>
<span style="font-size: 11px; color: {MUTED}">[app link]/@josiehamilton</span>
</div></div>
<div style="display: flex; justify-content: space-around; padding: 8px 16px 40px">{act("story", "Story")}{act("link", "Copy link")}{act("download", "Save image")}{act("more", "More")}</div>
''')
out('ShareCard.dc.html', share_card())

def optchip(name, n, href=HASH):
    return f'<a href="{href}" style="display: inline-flex; align-items: center; gap: 8px; height: 42px; padding: 0 14px; border-radius: 12px; background: {SURF}; border: 1px solid {LINE}; color: {TEXT}; font-size: 14px; font-weight: 600; white-space: nowrap; box-sizing: border-box">{name}<span style="color: {EMBER_T}; font-weight: 800">{n}</span></a>'

def share_hub():
    big = lambda href, mark, t, sub: f'<a href="{href}" style="display: flex; flex-direction: column; gap: 10px; padding: 16px; border-radius: 18px; background: {SURF}; border: 1px solid {LINE}; color: {TEXT}">{mark}<span style="display: flex; flex-direction: column; gap: 2px"><span style="font-family: {SERIF}; font-size: 22px; line-height: 1.1">{t}</span><span style="font-size: 12px; color: {MUTED}">{sub}</span></span></a>'
    sec = lambda t, body: f'<div style="display: flex; flex-direction: column; gap: 10px"><div style="display: flex; justify-content: space-between; align-items: baseline">{label(t)}<a href="MyLists.dc.html" style="font-size: 13px; font-weight: 700; color: {EMBER_T}">See all</a></div><div style="display: flex; flex-wrap: wrap; gap: 8px">{body}</div></div>'
    cities = optchip("Vancouver", 8, "ShareList.dc.html") + optchip("Tokyo", 3) + optchip("New York", 2) + optchip("+4 more", "")
    food = optchip("Sushi", 4, "ShareImage.dc.html") + optchip("Noodles", 3) + optchip("Tacos", 1) + optchip("Bakery", 1)
    tg = optchip("Gluten-free", 6) + optchip("Vegan", 2) + optchip("Low-FODMAP", 2)
    return screen('Share hub', topbar('Share', 'Profile.dc.html') + f'''
<div style="flex: 1; display: flex; flex-direction: column; gap: 22px; padding: 4px 20px 0">
<div style="display: flex; flex-direction: column; gap: 8px"><h2 style="margin: 0; font-family: {SERIF}; font-style: italic; font-weight: 300; font-size: 34px; line-height: 1.1">What are you sharing?</h2><p style="margin: 0; font-size: 14px; line-height: 1.5; color: {MUTED}">Send a link to the list that fits. Links stay live, so new picks show up for whoever has it.</p></div>
<div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px">{big("ShareCard.dc.html", skull(22, EMBER_T), "Final Meal", "Your five")}{big("ShareList.dc.html", icon("list", 22, EMBER_T), "Everything", "17 picks · 7 cities")}</div>
{sec("By city", cities)}
{sec("By food type", food)}
{sec("By tag", tg)}
<a href="ShareList.dc.html" style="display: flex; align-items: center; gap: 12px; padding: 14px 16px; border-radius: 16px; border: 1px dashed {LINE2}; color: {TEXT}">{icon("sliders", 20, EMBER_T)}<span style="flex: 1; display: flex; flex-direction: column; gap: 2px"><span style="font-size: 15px; font-weight: 700">Build a custom list</span><span style="font-size: 12px; color: {MUTED}">Mix a city, food type and tags, e.g. vegan in Tokyo</span></span>{icon("chev", 18, DIM)}</a>
</div>''')
out('ShareHub.dc.html', share_hub())

def fmt_toggle(active):
    def b(t, on):
        st = f'background: {SURF2}; color: {TEXT};' if on else f'background: transparent; color: {MUTED};'
        return f'<button type="button" aria-pressed="{"true" if on else "false"}" style="flex: 1; height: 38px; border: 0; border-radius: 10px; font-family: {SANS}; font-size: 13px; font-weight: 700; cursor: pointer; {st}">{t}</button>'
    return f'<div aria-label="Share format" style="display: flex; gap: 4px; padding: 4px; border-radius: 14px; background: {SURF}; border: 1px solid {LINE}">{b("Link", active == 0)}{b("Story image", active == 1)}</div>'

def mini_row(k, slot=None, check=True, show_tags=False, save=False):
    dish, rest, city, col = D[k]
    mark = f'<span style="display: inline-flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: {EMBER_T}">{skull(11, EMBER_T)}Final Meal #{slot}</span>' if slot else f'<span style="font-size: 11px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: {BONE}">Honorable</span>'
    right = ''
    if check:
        right = f'<span aria-hidden="true" style="width: 24px; height: 24px; border-radius: 7px; background: {EMBER}; display: flex; align-items: center; justify-content: center">{icon("check", 15, WHITE, 2.75)}</span>'
    if save:
        right = f'<button type="button" aria-label="Save {dish}" style="width: 44px; height: 44px; border-radius: 50%; border: 1px solid {LINE2}; background: transparent; color: {TEXT}; display: flex; align-items: center; justify-content: center">{icon("bookmark", 18)}</button>'
    tg = tags(TAGS[k]) if show_tags else ''
    return f'<li style="display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid {LINE}">{thumb(col, 48, 10)}<span style="flex: 1; display: flex; flex-direction: column; gap: 3px; min-width: 0"><span style="font-family: {SERIF}; font-size: 18px; line-height: 1.1">{dish}</span><span style="font-size: 12px; color: {MUTED}">{rest} · {mark}</span>{tg}</span>{right}</li>'

def rgroup(rest, items, mode='view', tags_on=True):
    """One restaurant with its dishes nested under it. mode: view | own | check | save | websave"""
    city = D[items[0][0]][2]
    area = AREA.get(rest, city)
    n = len(items)
    count = f' · <strong style="color: {TEXT}; font-weight: 700">{n} dishes</strong>' if n > 1 else ''
    if mode == 'check':
        right = f'<span aria-hidden="true" style="width: 24px; height: 24px; border-radius: 7px; background: {EMBER}; display: flex; align-items: center; justify-content: center">{icon("check", 15, WHITE, 2.75)}</span>'
    elif mode in ('save', 'websave'):
        right = f'<a href="#" aria-label="Directions to {rest}" style="width: 36px; height: 36px; border-radius: 50%; border: 1px solid {LINE2}; color: {TEXT}; display: flex; align-items: center; justify-content: center">{icon("nav", 15)}</a>'
    else:
        right = icon("chev", 18, DIM)
    head = f'<div style="display: flex; align-items: center; gap: 12px"><span style="width: 40px; height: 40px; border-radius: 12px; background: {SURF2}; display: flex; align-items: center; justify-content: center; color: {EMBER_T}; flex-shrink: 0">{icon("pin", 18)}</span><span style="flex: 1; display: flex; flex-direction: column; gap: 2px; min-width: 0"><span style="font-size: 16px; font-weight: 800; letter-spacing: 0.005em">{rest}</span><span style="font-size: 12px; color: {MUTED}">{area} · {city}{count}</span></span>{right}</div>'
    dishes = ''
    for k, slot in items:
        dish, _, _, col = D[k]
        mark = f'<span style="display: inline-flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: {EMBER_T}">{skull(11, EMBER_T)}Final Meal #{slot}</span>' if slot else f'<span style="font-size: 11px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: {BONE}">Honorable</span>'
        tg = tags(TAGS[k]) if tags_on else ''
        act = ''
        if mode == 'own' and not slot:
            act = f'<button type="button" aria-label="Promote {dish} to Final Meal" style="width: 36px; height: 36px; border-radius: 50%; border: 1px solid {LINE2}; background: transparent; display: flex; align-items: center; justify-content: center; flex-shrink: 0">{skull(14, FM_T)}</button>'
        elif mode == 'save':
            act = f'<button type="button" aria-label="Save {dish}" style="width: 36px; height: 36px; border-radius: 50%; border: 1px solid {LINE2}; background: transparent; color: {TEXT}; display: flex; align-items: center; justify-content: center; flex-shrink: 0">{icon("bookmark", 15)}</button>'
        elif mode == 'websave':
            act = f'<a href="WebSignup.dc.html" aria-label="Save {dish}" style="width: 36px; height: 36px; border-radius: 50%; border: 1px solid {LINE2}; color: {TEXT}; display: flex; align-items: center; justify-content: center; flex-shrink: 0">{icon("bookmark", 15)}</a>'
        dishes += f'<a href="PickDetail.dc.html" style="display: flex; align-items: center; gap: 12px; color: {TEXT}">{thumb(col, 42, 10)}<span style="flex: 1; display: flex; flex-direction: column; gap: 3px; min-width: 0"><span style="font-family: {SERIF}; font-size: 18px; line-height: 1.1">{dish}</span>{mark}{tg}</span>{act}</a>'
    return f'<li style="display: flex; flex-direction: column; gap: 10px; padding: 14px 0; border-bottom: 1px solid {LINE}">{head}<div style="display: flex; flex-direction: column; gap: 12px; margin-left: 19px; padding-left: 32px; border-left: 1px solid {LINE2}">{dishes}</div></li>'

VAN = [('Skewers', [('gyro', 1)]), ('Marutama', [('ramen', None), ('gyoza', None)]), ('Kin Kao', [('khaosoi', None), ('crispy', None)]), ('Miku', [('oshi', None)]), ('Lotus Noodle Bar', [('dandan', None)]), ('Hearth Bakery', [('bun', None)])]

def rlist(groups, mode='view', tags_on=True):
    return '<ul style="margin: 0; padding: 0; list-style: none">' + ''.join(rgroup(rn, it, mode, tags_on) for rn, it in groups) + '</ul>'

def live_pill():
    return f'<span style="display: inline-flex; align-items: center; gap: 6px; height: 24px; padding: 0 9px; border-radius: 999px; background: rgba(192,75,40,0.14); color: {EMBER_T}; font-size: 11px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; white-space: nowrap; flex-shrink: 0"><span style="width: 6px; height: 6px; border-radius: 50%; background: {EMBER_T}"></span>Live</span>'

def view_toggle(active, list_href, map_href):
    def b(t, ic, on, href):
        st = f'background: {SURF2}; color: {TEXT};' if on else f'background: transparent; color: {MUTED};'
        return f'<a href="{href}" aria-current="{"page" if on else "false"}" style="flex: 1; height: 38px; border-radius: 10px; display: flex; align-items: center; justify-content: center; gap: 6px; font-size: 13px; font-weight: 700; {st}">{icon(ic, 16)}{t}</a>'
    return f'<div style="display: flex; gap: 4px; padding: 4px; border-radius: 14px; background: {SURF}; border: 1px solid {LINE}; flex-shrink: 0">{b("List", "list", active == 0, list_href)}{b("Map", "map", active == 1, map_href)}</div>'

def share_list():
    filt = ''.join([tsel("Final Meal", True), tsel("Honorable", True), tsel("Vegan"), tsel("Gluten-free"), tsel("Low-FODMAP")])
    return screen('Share a list', topbar('Share a list', 'ShareHub.dc.html') + f'''
<div style="flex: 1; display: flex; flex-direction: column; gap: 16px; padding: 0 20px; min-height: 0">
<div style="display: flex; flex-direction: column; gap: 6px"><label for="ln" style="font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: {DIM}">List name</label><input id="ln" value="Josie’s Vancouver" style="background: transparent; border: 0; border-bottom: 1px solid {LINE2}; padding: 4px 0 8px; outline: none; color: {TEXT}; font-family: {SERIF}; font-style: italic; font-weight: 300; font-size: 30px"><span style="display: flex; align-items: center; gap: 6px; font-size: 13px; color: {MUTED}">{icon("pin", 14)}Vancouver, BC · 8 picks at 6 spots</span></div>
<div style="display: flex; gap: 8px; overflow: hidden; flex-shrink: 0">{filt}</div>
{rlist(VAN[:3], 'check', False)}
<span style="font-size: 13px; color: {DIM}; margin-top: -8px">+ Miku, Lotus Noodle Bar, Hearth Bakery. New Vancouver picks join automatically.</span>

</div>
<div style="padding: 14px 20px 34px; display: flex; flex-direction: column; gap: 12px"><div style="display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-radius: 12px; background: {SURF}; border: 1px solid {LINE}">{live_pill()}<span style="flex: 1; font-size: 13px; color: {MUTED}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">[app link]/l/josies-vancouver</span></div>{fmt_toggle(0)}<div style="display: flex; gap: 10px">{btn("Copy link", HASH, "ghost", "link", "flex: 1")}{btn("Send", "SharedList.dc.html", "primary", "share", "flex: 1")}</div></div>
''')
out('ShareList.dc.html', share_list())

def share_image():
    groups = [('Vancouver', [('oshi', 'Miku')]), ('Tokyo', [('omakase', 'Sushi Dai'), ('nigiri', 'Sushi Itto')]), ('New York', [('handroll', 'Nami')])]
    body = ''
    for city, items in groups:
        body += f'<li style="display: flex; flex-direction: column; gap: 6px; padding: 10px 0; border-bottom: 1px solid {LINE}"><span style="font-size: 9px; font-weight: 800; letter-spacing: 0.16em; text-transform: uppercase; color: {EMBER_T}">{city}</span>'
        body += ''.join(f'<span style="display: flex; justify-content: space-between; align-items: baseline; gap: 8px"><span style="font-family: {SERIF}; font-size: 17px">{D[k][0]}</span><span style="font-size: 10px; color: {DIM}; white-space: nowrap">{rname}</span></span>' for k, rname in items)
        body += '</li>'
    act = lambda ic, t: f'<button type="button" style="display: flex; flex-direction: column; align-items: center; gap: 8px; border: 0; background: transparent; color: {TEXT}; font-family: {SANS}; font-size: 12px; font-weight: 600; cursor: pointer"><span style="width: 56px; height: 56px; border-radius: 50%; background: {SURF2}; display: flex; align-items: center; justify-content: center">{icon(ic, 22)}</span>{t}</button>'
    return screen('Share a list as an image', topbar('Share a list', 'ShareHub.dc.html') + f'''
<div style="padding: 0 20px">{fmt_toggle(1)}</div>
<div style="flex: 1; display: flex; align-items: center; justify-content: center; padding: 14px 0">
<div style="width: 270px; height: 480px; border-radius: 22px; background: #000000; border: 1px solid {LINE2}; padding: 26px 22px; box-sizing: border-box; display: flex; flex-direction: column; gap: 16px">
<div style="display: flex; align-items: center; gap: 8px">{skull(16, EMBER)}{wordmark(12)}</div>
<div style="display: flex; flex-direction: column; gap: 4px"><span style="font-size: 10px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: {DIM}">Josie’s</span><span style="font-family: {SERIF}; font-style: italic; font-weight: 300; font-size: 32px; line-height: 1">Sushi, around the world</span></div>
<ol style="margin: 0; padding: 0; list-style: none; flex: 1">{body}</ol>
<span style="font-size: 10px; color: {MUTED}">[app link]/@josiehamilton/sushi</span>
</div></div>
<div style="display: flex; justify-content: space-around; padding: 4px 16px 36px">{act("story", "Story")}{act("link", "Copy link")}{act("download", "Save image")}{act("more", "More")}</div>
''')
out('ShareImage.dc.html', share_image())

def shared_list():
    pins = pin_fm(60, 60, 30) + pin_hm(170, 40) + pin_hm(250, 90) + pin_hm(120, 100) + pin_hm(300, 50)
    return screen('Shared list — friend view', topbar('', 'Feed.dc.html', iconbtn("share", "ShareHub.dc.html", "Share this list", "transparent")) + f'''
<div style="flex: 1; display: flex; flex-direction: column; gap: 14px; padding: 0 20px; min-height: 0">
<span style="display: flex; align-items: center; gap: 8px; font-size: 13px; color: {MUTED}">{av("josie", 26)}Shared by <a href="OtherProfile.dc.html" style="color: {TEXT}; font-weight: 700">@josiehamilton</a></span>
<div style="display: flex; flex-direction: column; gap: 6px"><h1 style="margin: 0; font-family: {SERIF}; font-style: italic; font-weight: 300; font-size: 38px; line-height: 1.05">Josie’s Vancouver</h1><span style="display: flex; align-items: center; gap: 8px; font-size: 13px; color: {MUTED}">{live_pill()}8 picks at 6 spots · updated 2 days ago</span></div>
<p style="margin: 0; padding: 12px 14px; border-radius: 14px; background: {SURF}; border: 1px solid {LINE}; font-family: {SERIF}; font-style: italic; font-size: 17px; color: {BONE}">“Kin Kao first. Trust me.”</p>
{view_toggle(0, "SharedList.dc.html", "WebMap.dc.html")}
<div style="position: relative; height: 110px; border-radius: 16px; overflow: hidden; border: 1px solid {LINE}; flex-shrink: 0">{map_svg()}{pins}</div>
{rlist([VAN[0], VAN[2], VAN[1]], 'save')}
</div>
<div style="padding: 12px 20px 34px; display: flex; gap: 10px; background: {BG}; border-top: 1px solid {LINE}">{btn("Follow Josie", HASH, "ghost", None, "flex: 1")}{btn("Save all 8", "Saved.dc.html", "primary", "bookmark", "flex: 1.4")}</div>
''')


def map_svg(h=844, dim=False):
    o = 0.5 if dim else 1
    return f'''<svg aria-hidden="true" width="390" height="{h}" viewBox="0 0 390 844" preserveAspectRatio="xMidYMid slice" style="position: absolute; inset: 0; opacity: {o}">
<rect width="390" height="844" fill="#141210"/>
<path d="M0 520 C 80 500 120 560 210 540 S 340 470 390 500 L 390 640 C 300 660 240 610 160 640 S 40 690 0 660 Z" fill="#0F1A1F"/>
<path d="M260 0 C 270 80 330 120 390 130 L 390 0 Z" fill="#0F1A1F"/>
<g stroke="rgba(243,237,228,0.07)" stroke-width="1.5" fill="none">
<path d="M0 120 L390 160"/><path d="M0 260 L390 230"/><path d="M0 380 L390 400"/><path d="M0 760 L390 720"/>
<path d="M60 0 L90 844"/><path d="M170 0 L150 520"/><path d="M290 140 L320 844"/><path d="M210 640 L230 844"/>
</g>
<g stroke="rgba(243,237,228,0.12)" stroke-width="3" fill="none"><path d="M0 330 C 120 300 240 340 390 300"/><path d="M120 0 C 140 200 100 400 140 844"/></g>
<rect x="190" y="280" width="70" height="60" rx="6" fill="#16201A"/>
</svg>'''

def pin_fm(x, y, s=38, sel=False):
    ring = f'box-shadow: 0 0 0 4px rgba(232,105,63,0.35);' if sel else ''
    return f'<button type="button" aria-label="Final Meal pick" style="position: absolute; left: {x}px; top: {y}px; width: {s}px; height: {s}px; border-radius: 50%; background: {CRIM}; border: 2px solid {BG}; display: flex; align-items: center; justify-content: center; padding: 0; cursor: pointer; {ring}">{skull(round(s*0.45), WHITE)}</button>'

def pin_hm(x, y):
    return f'<button type="button" aria-label="Honorable Mention pick" style="position: absolute; left: {x}px; top: {y}px; width: 18px; height: 18px; border-radius: 50%; background: {BONE}; border: 3px solid {BG}; padding: 0; cursor: pointer"></button>'

def discover_top():
    return f'''<div style="position: absolute; top: 47px; left: 0; right: 0; padding: 8px 16px; display: flex; flex-direction: column; gap: 10px">
<div style="display: flex; gap: 10px"><a href="DiscoverSearch.dc.html" style="flex: 1; height: 48px; border-radius: 999px; background: rgba(23,21,19,0.94); border: 1px solid {LINE2}; display: flex; align-items: center; gap: 10px; padding: 0 16px; color: {MUTED}; font-size: 15px">{icon("search", 19)}Dishes, spots, people</a>{iconbtn("sliders", "DiscoverFilters.dc.html", "Filters", "rgba(23,21,19,0.94)")}</div>
<div style="display: flex; gap: 8px">{chip("All", True)}{chip("Final Meals")}{chip("Honorable")}{chip("Following")}</div></div>'''

def legend():
    return f'<div style="position: absolute; right: 16px; top: 170px; display: flex; flex-direction: column; gap: 8px; padding: 10px 12px; border-radius: 12px; background: rgba(23,21,19,0.94); border: 1px solid {LINE}; font-size: 12px; color: {MUTED}"><span style="display: flex; align-items: center; gap: 8px"><span style="width: 18px; height: 18px; border-radius: 50%; background: {EMBER}; display: flex; align-items: center; justify-content: center">{skull(9, WHITE)}</span>Final Meal</span><span style="display: flex; align-items: center; gap: 8px"><span style="width: 18px; display: flex; justify-content: center"><span style="width: 12px; height: 12px; border-radius: 50%; background: {BONE}"></span></span>Honorable</span></div>'

def discover():
    def mini(k, kind, slot, lists):
        dish, rest, city, col = D[k]
        return f'<a href="PickDetail.dc.html" style="width: 240px; flex-shrink: 0; display: flex; gap: 12px; padding: 10px; border-radius: 16px; background: {SURF2}; color: {TEXT}">{thumb(col, 64, 12)}<span style="display: flex; flex-direction: column; gap: 3px; min-width: 0"><span style="font-family: {SERIF}; font-size: 19px; line-height: 1.1">{dish}</span><span style="font-size: 12px; color: {MUTED}">{rest}</span><span style="font-size: 11px; font-weight: 700; color: {FM_T if kind == "fm" else BONE}; letter-spacing: 0.06em; text-transform: uppercase">{"Final Meal" if kind == "fm" else "Honorable"} · {lists} lists</span></span></a>'
    return screen('Discover', map_svg() + pin_fm(150, 300, 44, True) + pin_fm(70, 420) + pin_fm(270, 240) + pin_fm(300, 420, 34) + pin_hm(110, 230) + pin_hm(220, 380) + pin_hm(330, 330) + pin_hm(40, 300) + pin_hm(250, 470) +
        f'<span style="position: absolute; left: 112px; top: 352px; padding: 6px 10px; border-radius: 10px; background: {TEXT}; color: {BG}; font-size: 12px; font-weight: 700; white-space: nowrap">Marutama · 14 lists</span>' + discover_top() + legend() + f'''
<section aria-label="Picks nearby" style="position: absolute; left: 0; right: 0; bottom: 88px; background: {SURF}; border-radius: 24px 24px 0 0; border-top: 1px solid {LINE2}; padding: 8px 0 16px; display: flex; flex-direction: column; gap: 12px">
<span aria-hidden="true" style="align-self: center; width: 40px; height: 5px; border-radius: 3px; background: {LINE2}"></span>
<div style="display: flex; align-items: baseline; justify-content: space-between; padding: 0 20px"><h2 style="margin: 0; font-size: 17px; font-weight: 700">12 picks near Vancouver</h2><a href="#" style="font-size: 13px; font-weight: 700; color: {EMBER_T}">List view</a></div>
<div style="display: flex; gap: 10px; padding: 0 20px; overflow: hidden">{mini("ramen", "fm", 1, 14)}{mini("khaosoi", "hm", None, 6)}</div>
</section>''' + tabbar('discover'), pad_top=False)
out('Discover.dc.html', discover())

def discover_hm():
    sel = f'<button type="button" aria-label="Honorable Mention pick, selected" style="position: absolute; left: 214px; top: 374px; width: 26px; height: 26px; border-radius: 50%; background: {BONE}; border: 3px solid {BG}; box-shadow: 0 0 0 5px rgba(230,223,213,0.3); padding: 0"></button>'
    dish, rest, city, col = D["khaosoi"]
    return screen('Discover — Honorable selected', map_svg() + pin_fm(150, 300, 38) + pin_fm(70, 420) + pin_fm(270, 240) + pin_fm(300, 420, 34) + pin_hm(110, 230) + pin_hm(330, 330) + pin_hm(40, 300) + pin_hm(250, 470) + sel +
        f'<span style="position: absolute; left: 160px; top: 334px; padding: 6px 10px; border-radius: 10px; background: {TEXT}; color: {BG}; font-size: 12px; font-weight: 700; white-space: nowrap">Kin Kao · 6 lists</span>' + discover_top() + legend() + f'''
<section aria-label="Selected pick" style="position: absolute; left: 0; right: 0; bottom: 88px; background: {SURF}; border-radius: 24px 24px 0 0; border-top: 1px solid {LINE2}; padding: 8px 20px 16px; display: flex; flex-direction: column; gap: 12px">
<span aria-hidden="true" style="align-self: center; width: 40px; height: 5px; border-radius: 3px; background: {LINE2}"></span>
<a href="PickDetail.dc.html" style="display: flex; gap: 14px; color: {TEXT}">{thumb(col, 84, 14)}<span style="flex: 1; display: flex; flex-direction: column; gap: 5px; min-width: 0"><span style="display: flex">{badge("hm")}</span><span style="font-family: {SERIF}; font-size: 22px; line-height: 1.1">{dish}</span><span style="font-size: 13px; color: {MUTED}">{rest} · Main St · 1.8 km</span></span></a>
<div style="display: flex; align-items: center; gap: 10px; font-size: 13px; color: {MUTED}"><span style="display: flex">{av("dev", 24)}<span style="margin-left: -8px; border: 2px solid {SURF}; border-radius: 50%; display: inline-flex">{av("sam", 24)}</span></span>Honorable for 6 people · Final Meal for 2</div>
</section>''' + tabbar('discover'), pad_top=False)
out('DiscoverHM.dc.html', discover_hm())

def filters():
    cats = [('Sushi', True), ('Noodles', True), ('Burgers', False), ('Tacos', False), ('Pizza', False), ('BBQ', False), ('Bakery', False), ('Seafood', False)]
    diet = [('Vegan', False), ('Vegetarian', False), ('Gluten-free', True), ('Low-FODMAP', False), ('Dairy-free', False), ('Halal', False)]
    return screen('Discover filters', map_svg(dim=True) + f'''
<div aria-hidden="true" style="position: absolute; inset: 0; background: rgba(0,0,0,0.55)"></div>
<section aria-label="Filters" style="position: absolute; left: 0; right: 0; bottom: 0; background: {SURF}; border-radius: 28px 28px 0 0; border-top: 1px solid {LINE2}; padding: 10px 20px 34px; display: flex; flex-direction: column; gap: 24px">
<span aria-hidden="true" style="align-self: center; width: 40px; height: 5px; border-radius: 3px; background: {LINE2}"></span>
<div style="display: flex; align-items: center; justify-content: space-between"><h1 style="margin: 0; font-family: {SERIF}; font-style: italic; font-weight: 300; font-size: 30px">Filters</h1><button type="button" style="height: 44px; border: 0; background: transparent; color: {MUTED}; font-family: {SANS}; font-size: 14px; font-weight: 600">Reset</button></div>
<div style="display: flex; flex-direction: column; gap: 10px">{label("Pick type")}<div style="display: flex; gap: 8px">{chip("All", True)}{chip("Final Meals")}{chip("Honorable")}</div></div>
<div style="display: flex; flex-direction: column; gap: 10px"><div style="display: flex; justify-content: space-between">{label("Distance")}<span style="font-size: 14px; font-weight: 700; color: {EMBER_T}">25 km</span></div><label class="sr" for="rad">Distance in kilometres</label><input id="rad" type="range" min="1" max="100" value="25" style="width: 100%; accent-color: {EMBER}"></div>
<div style="display: flex; flex-direction: column; gap: 10px">{label("Food type")}<div style="display: flex; gap: 8px; flex-wrap: wrap">{"".join(tsel(c, on) for c, on in cats)}</div></div>
<div style="display: flex; flex-direction: column; gap: 10px">{label("Dietary")}<div style="display: flex; gap: 8px; flex-wrap: wrap">{"".join(tsel(c, on) for c, on in diet)}</div></div>
{btn("Show 9 picks", "Discover.dc.html")}
</section>''', pad_top=False)
out('DiscoverFilters.dc.html', filters())

def search_bar(val, back):
    return f'''<div style="display: flex; align-items: center; gap: 10px; padding: 8px 16px; flex-shrink: 0"><div style="flex: 1; height: 48px; border-radius: 999px; background: {SURF}; border: 1px solid {EMBER_T}; display: flex; align-items: center; gap: 10px; padding: 0 16px; box-sizing: border-box">{icon("search", 19, MUTED)}<label class="sr" for="q">Search</label><input id="q" type="search" value="{val}" style="flex: 1; min-width: 0; background: transparent; border: 0; outline: none; color: {TEXT}; font-family: {SANS}; font-size: 16px; font-weight: 500">{icon("x", 16, MUTED)}</div><a href="{back}" style="font-size: 15px; font-weight: 600; color: {TEXT}; padding: 8px 0">Cancel</a></div>'''

def discover_search():
    dishes = ''.join(f'<li><a href="PickDetail.dc.html" style="display: flex; align-items: center; gap: 12px; padding: 10px 0; color: {TEXT}">{thumb(D[k][3], 48, 10)}<span style="flex: 1; display: flex; flex-direction: column; gap: 2px"><span style="font-size: 15px; font-weight: 700">{D[k][0] if not alt else alt}</span><span style="font-size: 13px; color: {MUTED}">{sub}</span></span><span style="font-size: 12px; font-weight: 700; color: {FM_T}">{n} lists</span></a></li>' for k, alt, sub, n in [('ramen', None, 'Marutama · 1.2 km', 14), ('ramen', 'Spicy Miso Ramen', 'Kintaro · 2.0 km', 9), ('ramen', 'Tsukemen', 'Danbo · 3.4 km', 5)])
    spots = ''.join(f'<li style="display: flex; align-items: center; gap: 12px; padding: 12px 0; border-bottom: 1px solid {LINE}"><span style="width: 40px; height: 40px; border-radius: 50%; background: {SURF2}; display: flex; align-items: center; justify-content: center; color: {MUTED}">{icon("pin", 18)}</span><span style="flex: 1; display: flex; flex-direction: column; gap: 2px"><span style="font-size: 15px; font-weight: 600">{a}</span><span style="font-size: 13px; color: {MUTED}">{b}</span></span></li>' for a, b in [('Marutama Ramen', 'Bidwell St · 1.2 km'), ('Ramen Danbo', 'W 4th Ave · 3.4 km')])
    lists = ''.join(f'<li><a href="SharedList.dc.html" style="display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid {LINE}; color: {TEXT}"><span style="width: 40px; height: 40px; border-radius: 12px; background: {SURF2}; display: flex; align-items: center; justify-content: center; color: {EMBER_T}">{icon("list", 18)}</span><span style="flex: 1; display: flex; flex-direction: column; gap: 2px"><span style="font-size: 15px; font-weight: 700">{a}</span><span style="font-size: 13px; color: {MUTED}">{b}</span></span>{icon("chev", 18, DIM)}</a></li>' for a, b in [('Ramen in Vancouver', '@josiehamilton · 2 picks'), ('Gluten-free noodles, Tokyo', '@mikebrennan · 7 picks')])
    return screen('Discover search', search_bar('ramen', 'Discover.dc.html') + f'''
<div style="flex: 1; display: flex; flex-direction: column; gap: 22px; padding: 12px 20px 0">
<div>{label("Dishes")}<ul style="margin: 6px 0 0; padding: 0; list-style: none">{dishes}</ul></div>
<div>{label("Shared lists")}<ul style="margin: 6px 0 0; padding: 0; list-style: none">{lists}</ul></div>
<div>{label("Spots")}<ul style="margin: 6px 0 0; padding: 0; list-style: none">{spots}</ul></div>
</div>''')
out('DiscoverSearch.dc.html', discover_search())

def person_row(u, sub, state='follow', href='OtherProfile.dc.html'):
    n, h, _, _ = USERS[u]
    if state == 'follow':
        b = f'<button type="button" style="height: 36px; padding: 0 16px; border-radius: 999px; border: 0; background: {TEXT}; color: {BG}; font-family: {SANS}; font-size: 13px; font-weight: 700">Follow</button>'
    elif state == 'back':
        b = f'<button type="button" style="height: 36px; padding: 0 16px; border-radius: 999px; border: 0; background: {EMBER}; color: #FFFFFF; font-family: {SANS}; font-size: 13px; font-weight: 700">Follow back</button>'
    else:
        b = f'<button type="button" style="height: 36px; padding: 0 16px; border-radius: 999px; border: 1px solid {LINE2}; background: transparent; color: {TEXT}; font-family: {SANS}; font-size: 13px; font-weight: 700">Following</button>'
    return f'<li style="display: flex; align-items: center; gap: 12px; padding: 12px 0; border-bottom: 1px solid {LINE}"><a href="{href}" style="display: flex; align-items: center; gap: 12px; flex: 1; min-width: 0; color: {TEXT}">{av(u, 46)}<span style="display: flex; flex-direction: column; gap: 2px; min-width: 0"><span style="font-size: 15px; font-weight: 700">{n}</span><span style="font-size: 13px; color: {MUTED}">{sub}</span></span></a>{b}</li>'

out('Search.dc.html', screen('Search', search_bar('al', 'Feed.dc.html') + seg([('People', 'Search.dc.html'), ('Dishes', 'DiscoverSearch.dc.html'), ('Spots', 'DiscoverSearch.dc.html')], 0) + f'''
<div style="flex: 1; padding: 6px 20px 0"><ul style="margin: 0; padding: 0; list-style: none">
{person_row("alli", "@allimercer · 567 followers")}
{person_row("ari", "@arimitchell · 234 followers", "following")}
</ul>
<div style="margin-top: 26px">{label("Suggested for you")}<ul style="margin: 6px 0 0; padding: 0; list-style: none">{person_row("mike", "Also has Wagyu Beef Don")}{person_row("dev", "Popular in Vancouver")}{person_row("sam", "Followed by Ari")}</ul></div>
</div>'''))

def notifications():
    def row(u, text, when, right='', unread=False, special=False):
        bg = 'rgba(192,75,40,0.08)' if unread else 'transparent'
        lead = f'<span style="width: 46px; height: 46px; border-radius: 50%; background: {CRIM}; display: flex; align-items: center; justify-content: center; flex-shrink: 0">{skull(20, WHITE)}</span>' if special else av(u, 46)
        dot = f'<span aria-label="Unread" style="width: 8px; height: 8px; border-radius: 50%; background: {EMBER_T}; flex-shrink: 0"></span>' if unread else '<span style="width: 8px"></span>'
        return f'<li style="display: flex; align-items: center; gap: 12px; padding: 14px 20px; background: {bg}">{dot}{lead}<span style="flex: 1; display: flex; flex-direction: column; gap: 3px; min-width: 0"><span style="font-size: 14px; line-height: 1.45">{text}</span><span style="font-size: 12px; color: {DIM}">{when}</span></span>{right}</li>'
    b = lambda u: f'<strong style="font-weight: 700">{USERS[u][0]}</strong>'
    s = lambda t: f'<span style="font-family: {SERIF}; font-style: italic; font-size: 15px">{t}</span>'
    fb = '<button type="button" style="height: 34px; padding: 0 14px; border-radius: 999px; border: 0; background: ' + EMBER + '; color: ' + WHITE + '; font-family: ' + SANS + '; font-size: 12px; font-weight: 700">Follow back</button>'
    fl = '<button type="button" style="height: 34px; padding: 0 14px; border-radius: 999px; border: 1px solid ' + LINE2 + '; background: transparent; color: ' + TEXT + '; font-family: ' + SANS + '; font-size: 12px; font-weight: 700">Following</button>'
    today = ''.join([
        row("ari", b('ari') + " dethroned " + s('Tacos Al Pastor') + " with " + s('Smash Burger') + " on their Final Meal.", "2m", thumb(D["burger"][3], 44, 10), True),
        row("alli", b('alli') + " started following you.", "14m", fb, True),
        row("mike", b('mike') + " saved your " + s('Pork Gyro') + ".", "1h", thumb(D["gyro"][3], 44, 10)),
    ])
    earlier = ''.join([
        row("josie", "Your " + s('Pork Gyro') + " is now on 8 Final Meals. People trust your taste.", "Yesterday", '', False, True),
        row("mike", b('mike') + " saved 4 picks from your list " + s('Josie’s Vancouver') + ".", "2d", thumb(D["khaosoi"][3], 44, 10)),
        row("sam", b('sam') + " joined from your invite.", "4d", fl),
    ])
    mark = '<a href="Settings.dc.html" style="font-size: 13px; font-weight: 700; color: ' + MUTED + '">Mark all read</a>'
    return screen('Notifications', topbar('Activity', 'Feed.dc.html', mark) + f'''
<div style="flex: 1; display: flex; flex-direction: column">
<h2 style="margin: 0; padding: 14px 20px 6px">{label("Today")}</h2>
<ul style="margin: 0; padding: 0; list-style: none">{today}</ul>
<h2 style="margin: 0; padding: 18px 20px 6px">{label("Earlier")}</h2>
<ul style="margin: 0; padding: 0; list-style: none">{earlier}</ul></div>''')
out('Notifications.dc.html', notifications())

def ov(x):
    return '<span style="position: absolute; top: 8px; left: 8px">' + x + '</span>'

def saved():
    items = [('wagyu', 'mike', 'fm'), ('biryani', 'alli', 'fm'), ('tacos', 'ari', 'hm'), ('ramen', 'dev', 'fm')]
    cards = ''.join(f'<a href="PickDetail.dc.html" style="display: flex; flex-direction: column; gap: 8px; color: {TEXT}">{photo(D[k][3], 168, radius=16, inner=ov(badge(kind)))}<span style="display: flex; flex-direction: column; gap: 2px"><span style="font-family: {SERIF}; font-size: 19px; line-height: 1.15">{D[k][0]}</span><span style="font-size: 12px; color: {MUTED}">{D[k][1]} · {D[k][2]}</span><span style="font-size: 12px; color: {DIM}">via @{USERS[u][1]}</span></span></a>' for k, u, kind in items)
    return screen('Saved', f'<header style="display: flex; align-items: center; height: 60px; padding: 0 20px; flex-shrink: 0"><h1 style="margin: 0; flex: 1; font-family: {SERIF}; font-style: italic; font-weight: 300; font-size: 32px">Saved to try</h1>{iconbtn("map", "Discover.dc.html", "Map view")}</header>' + f'''
<div style="display: flex; gap: 8px; padding: 6px 20px 16px">{chip("All", True)}{chip("Final Meals")}{chip("Honorable")}{chip("Nearby")}</div>
<div style="flex: 1; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 20px 14px; padding: 0 20px 100px; align-content: start">{cards}</div>
''' + tabbar('saved'))
out('Saved.dc.html', saved())

# =====================================================================
# PROFILE & SOCIAL
# =====================================================================
def profile_head(u, own=True, bio='Chasing the perfect meal.', city='Vancouver, BC', stats=(14, 62, 17)):
    n, h, _, _ = USERS[u]
    if own:
        top = f'<header style="display: flex; align-items: center; gap: 8px; height: 52px; padding: 0 12px 0 20px; flex-shrink: 0"><span style="flex: 1; font-size: 16px; font-weight: 700">@{h}</span>{iconbtn("share", "ShareHub.dc.html", "Share", "transparent")}{iconbtn("sliders", "Settings.dc.html", "Settings", "transparent")}</header>'
        actions = f'<div style="display: flex; gap: 10px">{btn("Edit profile", "EditProfile.dc.html", "ghost", None, "flex: 1; height: 40px; font-size: 14px")}{btn("Share a list", "ShareHub.dc.html", "primary", "share", "flex: 1; height: 40px; font-size: 14px")}</div>'
        common = ''
    else:
        top = topbar(f'@{h}', 'Search.dc.html', iconbtn("more", HASH, "More options", "transparent"))
        actions = f'<div style="display: flex; gap: 10px">{btn("Follow", HASH, "primary", None, "flex: 1; height: 40px; font-size: 14px")}{btn("Share", HASH, "ghost", "share", "flex: 1; height: 40px; font-size: 14px")}</div>'
        common = f'<div style="display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 12px; background: {SURF}; border: 1px solid {LINE}; font-size: 13px; color: {MUTED}">{skull(14, FM_T)}<span>You both love <strong style="color: {TEXT}; font-weight: 700">Plain Biryani</strong> + 1 more</span></div>'
    st = lambda v, l, href: f'<a href="{href}" style="color: {MUTED}; font-size: 13px"><strong style="color: {TEXT}; font-weight: 800">{v}</strong> {l}</a>'
    return top + f'''<div style="display: flex; flex-direction: column; gap: 12px; padding: 0 20px 14px; flex-shrink: 0">
<div style="display: flex; align-items: center; gap: 14px">{av(u, 64)}<div style="display: flex; flex-direction: column; gap: 3px; min-width: 0"><h1 style="margin: 0; font-family: {SERIF}; font-weight: 400; font-size: 26px; line-height: 1.1">{n}</h1><span style="display: flex; align-items: center; gap: 4px; font-size: 13px; color: {MUTED}">{icon("pin", 13)}{city} · <span style="color: {BONE}">{bio}</span></span></div></div>
<div style="display: flex; gap: 18px">{st(stats[0], "followers", "Followers.dc.html")}{st(stats[1], "following", "Followers.dc.html")}{st(stats[2], "dishes", HASH)}</div>
{actions}{common}</div>'''

def listchip(name, n, on=False, href=HASH):
    st = f'background: {TEXT}; color: {BG}; border: 1px solid {TEXT};' if on else f'background: {SURF}; color: {TEXT}; border: 1px solid {LINE};'
    nc = BG if on else EMBER_T
    return f'<a href="{href}" aria-current="{"true" if on else "false"}" style="display: inline-flex; align-items: center; gap: 7px; height: 36px; padding: 0 13px; border-radius: 999px; font-size: 13px; font-weight: 700; white-space: nowrap; box-sizing: border-box; flex-shrink: 0; {st}">{name}<span style="color: {nc}; font-weight: 800; opacity: {0.6 if on else 1}">{n}</span></a>'

def lists_bar(active='All', own=True, chips=None):
    chips = chips or [('All', 15, 'Profile.dc.html'), ('Vancouver', 6, 'ProfileHM.dc.html'), ('Sushi', 4, 'ProfileMap.dc.html'), ('Tokyo', 3, HASH), ('Gluten-free', 6, HASH), ('New York', 2, HASH)]
    row = ''.join(listchip(n, c, n == active, h) for n, c, h in chips)
    see = f'<a href="MyLists.dc.html" style="font-size: 13px; font-weight: 700; color: {EMBER_T}">See all lists</a>' if own else ''
    return f'<div style="display: flex; flex-direction: column; gap: 10px; padding: 0 0 12px; flex-shrink: 0"><div style="display: flex; justify-content: space-between; align-items: baseline; padding: 0 20px">{label("Lists" if own else "Her lists")}{see}</div><div style="display: flex; gap: 8px; padding: 0 20px; overflow: hidden">{row}</div></div>'

def pfilters(active='All', chips=None, summary=None, share_href='ShareList.dc.html'):
    chips = chips or [('All', 'Profile.dc.html'), ('Vancouver', 'ProfileHM.dc.html'), ('Sushi', 'ProfileMap.dc.html'), ('Tokyo', HASH), ('Gluten-free', HASH), ('Vegan', HASH)]
    row = ''.join(f'<a href="{h}" aria-current="{"true" if n == active else "false"}" style="display: inline-flex; align-items: center; gap: 6px; height: 32px; padding: 0 12px; border-radius: 999px; font-size: 13px; font-weight: 600; white-space: nowrap; flex-shrink: 0; box-sizing: border-box; {"background: rgba(192,75,40,0.14); color: " + TEXT + "; border: 1.5px solid " + EMBER_T + ";" if n == active else "background: transparent; color: " + MUTED + "; border: 1px solid " + LINE2 + ";"}">{icon("check", 13, EMBER_T, 2.5) if n == active and n != "All" else ""}{n}</a>' for n, h in chips)
    filt_btn = f'<button type="button" aria-label="More filters" style="width: 32px; height: 32px; border-radius: 50%; border: 1px solid {LINE2}; background: transparent; color: {MUTED}; display: flex; align-items: center; justify-content: center; flex-shrink: 0">{icon("sliders", 15)}</button>'
    line = ''
    if summary:
        line = f'<div style="display: flex; justify-content: space-between; align-items: center; padding: 0 20px"><span style="font-size: 13px; color: {MUTED}">{summary}</span><a href="{share_href}" style="display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 700; color: {EMBER_T}">{icon("share", 15)}Share these</a></div>'
    return f'<div style="display: flex; flex-direction: column; gap: 10px; padding: 12px 0 6px; flex-shrink: 0"><div style="display: flex; gap: 8px; padding: 0 20px; overflow: hidden">{filt_btn}{row}</div>{line}</div>'

def list_context(name, summary, open_href='MyList.dc.html', share_href='ShareList.dc.html'):
    return f'<div style="display: flex; align-items: center; gap: 10px; margin: 0 20px 12px; padding: 10px 10px 10px 14px; border-radius: 14px; background: rgba(192,75,40,0.14); border: 1px solid rgba(232,105,63,0.35); flex-shrink: 0"><span style="flex: 1; display: flex; flex-direction: column; gap: 1px; min-width: 0"><span style="font-size: 14px; font-weight: 800">{name}</span><span style="font-size: 12px; color: {MUTED}">{summary}</span></span><a href="{open_href}" style="height: 36px; padding: 0 12px; border-radius: 10px; background: {SURF2}; color: {TEXT}; display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 700">{icon("list", 15)}Open</a><a href="{share_href}" style="height: 36px; padding: 0 12px; border-radius: 10px; background: {EMBER}; color: {WHITE}; display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 700">{icon("share", 15)}Share</a></div>'

def slot_row(i, k, href='PickDetail.dc.html'):
    if k is None:
        return f'<li><a href="AddDish.dc.html" style="display: flex; align-items: center; gap: 14px; padding: 12px 0; color: {MUTED}"><span style="font-family: {SERIF}; font-style: italic; font-size: 38px; line-height: 1; width: 26px; color: {DIM}">{i}</span><span style="width: 56px; height: 56px; border-radius: 12px; border: 1.5px dashed {LINE2}; display: flex; align-items: center; justify-content: center">{icon("plus", 20)}</span><span style="flex: 1; font-family: {SERIF}; font-style: italic; font-size: 17px">One seat left. Choose wisely.</span></a></li>'
    dish, rest, city, col = D[k]
    return f'<li><a href="{href}" style="display: flex; align-items: center; gap: 14px; padding: 10px 0; border-bottom: 1px solid {LINE}; color: {TEXT}"><span style="font-family: {SERIF}; font-style: italic; font-size: 38px; line-height: 1; width: 26px; color: {FM_T}">{i}</span>{thumb(col, 56)}<span style="flex: 1; display: flex; flex-direction: column; gap: 3px; min-width: 0"><span style="font-family: {SERIF}; font-size: 20px; line-height: 1.1">{dish}</span><span style="font-size: 13px; color: {MUTED}">{rest} · {city}</span></span>{icon("chev", 18, DIM)}</a></li>'

def ptabs(active, own=True, counts=('4', '13', '')):
    base = 'Profile' if own else 'OtherProfile'
    lab = lambda t, c: f'{t} <span style="color: {DIM}; font-weight: 600">{c}</span>' if c else t
    items = [(lab('Final Meal', counts[0]), f'{base}.dc.html'), (lab('Honorable', counts[1]), 'ProfileHM.dc.html' if own else '#'), ('Map', 'ProfileMap.dc.html' if own else '#')]
    return seg(items, active)

out('Profile.dc.html', screen('Profile — Final Meal', profile_head('josie') + ptabs(0) + pfilters('All') + f'''
<div style="flex: 1; padding: 0 20px 100px"><ul style="margin: 0; padding: 0; list-style: none">
{slot_row(1, "gyro")}{slot_row(2, "wagyu")}{slot_row(3, "biryani")}{slot_row(4, "lobster")}{slot_row(5, None)}
</ul></div>''' + tabbar('you')))

def hm_row(k, note=None):
    dish, rest, city, col = D[k]
    note = tags(TAGS[k])
    return f'<li style="display: flex; align-items: center; gap: 14px; padding: 12px 0; border-bottom: 1px solid {LINE}">{thumb(col, 52)}<a href="PickDetail.dc.html" style="flex: 1; display: flex; flex-direction: column; gap: 3px; min-width: 0; color: {TEXT}"><span style="font-family: {SERIF}; font-size: 19px; line-height: 1.1">{dish}</span><span style="font-size: 13px; color: {MUTED}">{rest} · {city}</span>{note}</a><button type="button" aria-label="Promote {dish} to Final Meal" style="width: 44px; height: 44px; border-radius: 50%; border: 1px solid {LINE2}; background: transparent; display: flex; align-items: center; justify-content: center; cursor: pointer">{skull(16, FM_T)}</button></li>'

out('ProfileHM.dc.html', screen('Profile — Honorable, filtered to Vancouver', profile_head('josie') + ptabs(1, counts=('1', '7', '')) + pfilters('Vancouver', summary='Vancouver · 8 picks at 6 spots') + f'''
<div style="flex: 1; padding: 0 20px 100px; display: flex; flex-direction: column; gap: 4px">
{rlist(VAN[1:], 'own')}
</div>''' + tabbar('you')))

def profile_map():
    return screen('Profile — Map, filtered to Sushi', profile_head('josie') + ptabs(2, counts=('0', '4', '')) + pfilters('Sushi', summary='Sushi · 4 picks in 3 cities', share_href='ShareImage.dc.html') + f'''
<div style="position: relative; flex: 1; margin: 6px 20px 100px; border-radius: 20px; overflow: hidden; border: 1px solid {LINE}">
<svg aria-hidden="true" width="100%" height="100%" viewBox="0 0 350 300" preserveAspectRatio="xMidYMid slice" style="position: absolute; inset: 0"><rect width="350" height="300" fill="#0F1A1F"/><path d="M20 60 C 60 40 110 50 130 80 C 140 120 110 150 120 190 C 100 220 70 200 60 170 C 40 140 10 110 20 60 Z" fill="#1B1916"/><path d="M200 50 C 240 40 300 60 320 90 C 330 130 300 150 280 140 C 250 150 230 120 210 110 C 195 90 190 70 200 50 Z" fill="#1B1916"/><path d="M150 210 C 170 200 200 210 210 240 C 200 270 170 280 150 260 Z" fill="#1B1916"/></svg>
{pin_hm(60, 80)}{pin_hm(286, 96)}{pin_hm(300, 112)}{pin_hm(96, 150)}
<div style="position: absolute; left: 12px; right: 12px; bottom: 12px; padding: 12px 14px; border-radius: 14px; background: rgba(23,21,19,0.94); display: flex; justify-content: space-between; font-size: 13px"><span><strong>Sushi</strong> <span style="color: {MUTED}">· Vancouver, Tokyo, New York</span></span><span style="display: flex; gap: 12px; color: {MUTED}"><span style="display: flex; align-items: center; gap: 6px"><span style="width: 10px; height: 10px; border-radius: 50%; background: {CRIM}"></span>Final</span><span style="display: flex; align-items: center; gap: 6px"><span style="width: 10px; height: 10px; border-radius: 50%; background: {BONE}"></span>Honorable</span></span></div>
</div>''' + tabbar('you'))
out('ProfileMap.dc.html', profile_map())

def my_lists():
    def card(name, n, sub, ks, href=HASH):
        th = ''.join(f'<span style="margin-left: {0 if i == 0 else -10}px; border: 2px solid {SURF}; border-radius: 10px; display: inline-flex">{thumb(D[k][3], 30, 8)}</span>' for i, k in enumerate(ks))
        return f'<div style="display: flex; flex-direction: column; gap: 10px; padding: 14px; border-radius: 18px; background: {SURF}; border: 1px solid {LINE}"><a href="{href}" style="display: flex; flex-direction: column; gap: 10px; color: {TEXT}"><span style="display: flex">{th}</span><span style="display: flex; flex-direction: column; gap: 2px"><span style="font-family: {SERIF}; font-size: 21px; line-height: 1.1">{name}</span><span style="font-size: 12px; color: {MUTED}">{n} picks · {sub}</span></span></a><a href="ShareList.dc.html" style="align-self: flex-start; display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 700; color: {EMBER_T}">{icon("share", 14)}Share</a></div>'
    grid = lambda cards: f'<div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px">{cards}</div>'
    sec = lambda t, body: f'<div style="display: flex; flex-direction: column; gap: 10px">{label(t)}{body}</div>'
    return screen('Your lists', topbar('Your lists', 'ShareHub.dc.html') + f'''
<div style="flex: 1; display: flex; flex-direction: column; gap: 22px; padding: 4px 20px 0; overflow: hidden">
<p style="margin: 0; font-size: 14px; line-height: 1.5; color: {MUTED}">Built automatically from your picks and tags. Open any list, or share it as a live link.</p>
{sec("Cities", grid(card("Vancouver", 8, "6 spots", ["gyro", "ramen", "khaosoi"], "MyList.dc.html") + card("Tokyo", 3, "1 Final Meal", ["wagyu", "omakase", "nigiri"])))}
{sec("Food types", grid(card("Sushi", 4, "3 cities", ["oshi", "omakase", "handroll"]) + card("Noodles", 3, "Vancouver", ["ramen", "khaosoi", "dandan"])))}
{sec("Tags", grid(card("Gluten-free", 6, "4 cities", ["biryani", "tacos", "bun"]) + card("Rainy day", 2, "Your tag", ["ramen", "khaosoi"])))}
</div>''')
out('MyLists.dc.html', my_lists())

def my_list():
    filt = ''.join([tsel("Final Meal", True), tsel("Honorable", True), tsel("Noodles"), tsel("Sushi"), tsel("Vegan")])
    rows = ''.join(rgroup(rn, it, 'view') for rn, it in VAN)
    return screen('Your Vancouver list', topbar('', 'Profile.dc.html', iconbtn("share", "ShareList.dc.html", "Share this list", "transparent")) + f'''
<div style="flex: 1; display: flex; flex-direction: column; gap: 14px; padding: 0 20px; min-height: 0; overflow: hidden">
<div style="display: flex; flex-direction: column; gap: 4px">{label("Your list")}<h1 style="margin: 0; font-family: {SERIF}; font-style: italic; font-weight: 300; font-size: 40px; line-height: 1.05">Vancouver</h1><span style="font-size: 13px; color: {MUTED}">8 picks at 6 spots · 1 Final Meal · 7 Honorable</span></div>
{view_toggle(0, "MyList.dc.html", "ProfileMap.dc.html")}
<div style="display: flex; gap: 8px; overflow: hidden; flex-shrink: 0">{filt}</div>
<ul style="margin: 0; padding: 0; list-style: none">{rows}</ul>
</div>
<div style="padding: 12px 20px 34px; border-top: 1px solid {LINE}; background: {BG}">{btn("Share this list", "ShareList.dc.html", "primary", "share")}</div>
''')
out('MyList.dc.html', my_list())

out('OtherProfile.dc.html', screen('Other profile', profile_head('alli', False, 'Spice level: nuclear.', 'Saskatoon, SK', (567, 203, 9)) + ptabs(0, False, ('3', '6', '')) + pfilters('All', [('All', HASH), ('Saskatoon', HASH), ('Indian', HASH), ('Spicy', HASH), ('Mexico City', HASH)]) + f'''
<div style="flex: 1; padding: 0 20px 0"><ul style="margin: 0; padding: 0; list-style: none">
{slot_row(1, "biryani")}{slot_row(2, "khaosoi")}{slot_row(3, "tacos")}
</ul></div>'''))

out('Followers.dc.html', screen('Followers', topbar('@josiehamilton', 'Profile.dc.html') + seg([('14 Followers', 'Followers.dc.html'), ('62 Following', 'Followers.dc.html')], 0) + f'''
<div style="padding: 14px 20px 0"><div style="height: 44px; border-radius: 12px; background: {SURF}; display: flex; align-items: center; gap: 10px; padding: 0 14px">{icon("search", 18, MUTED)}<label class="sr" for="fq">Search followers</label><input id="fq" placeholder="Search" style="flex: 1; background: transparent; border: 0; outline: none; color: {TEXT}; font-family: {SANS}; font-size: 15px"></div></div>
<div style="flex: 1; padding: 6px 20px 0"><ul style="margin: 0; padding: 0; list-style: none">
{person_row("alli", "@allimercer", "back")}{person_row("ari", "@arimitchell", "following")}{person_row("mike", "@mikebrennan", "following")}{person_row("dev", "@devpatel", "back")}{person_row("sam", "@samokafor", "following")}
</ul></div>'''))

# =====================================================================
# SETTINGS
# =====================================================================
def srow(ic, t, href='#', val='', danger=False):
    c = DANGER if danger else TEXT
    v = f'<span style="font-size: 14px; color: {MUTED}">{val}</span>' if val else ''
    ch = '' if danger else icon("chev", 18, DIM)
    return f'<li><a href="{href}" style="display: flex; align-items: center; gap: 14px; min-height: 54px; padding: 0 4px; border-bottom: 1px solid {LINE}; color: {c}">{icon(ic, 20, DANGER if danger else MUTED)}<span style="flex: 1; font-size: 15px; font-weight: 600">{t}</span>{v}{ch}</a></li>'

def sgroup(title, rows):
    return f'<div style="display: flex; flex-direction: column; gap: 4px">{label(title)}<ul style="margin: 0; padding: 0; list-style: none">{rows}</ul></div>'

out('Settings.dc.html', screen('Settings', topbar('Settings', 'Profile.dc.html') + f'''
<div style="flex: 1; display: flex; flex-direction: column; gap: 22px; padding: 8px 20px 0">
{sgroup("Account", srow("edit", "Edit profile", "EditProfile.dc.html") + srow("mail", "Sign-in method", HASH, "Apple") + srow("eye", "Remove ads", "RemoveAds.dc.html", "$5 once"))}
{sgroup("Preferences", srow("bell", "Notifications", "NotificationSettings.dc.html") + srow("lock", "Privacy & safety", "Privacy.dc.html") + srow("pin", "Home city", HASH, "Vancouver"))}
{sgroup("Support", srow("help", "Help & feedback") + srow("doc", "Terms of Service") + srow("doc", "Privacy Policy"))}
<ul style="margin: 0; padding: 0; list-style: none">{srow("logout", "Log out", "Splash.dc.html", danger=True)}</ul>
<p style="margin: 0; text-align: center; font-size: 12px; color: {DIM}">Final Meal · version 1.0.0</p>
</div>'''))

out('EditProfile.dc.html', screen('Edit profile', topbar('Edit profile', 'Settings.dc.html', f'<a href="Profile.dc.html" style="font-size: 15px; font-weight: 700; color: {EMBER_T}; padding: 8px">Save</a>') + f'''
<div style="flex: 1; display: flex; flex-direction: column; gap: 20px; padding: 12px 24px 0">
<div style="display: flex; flex-direction: column; align-items: center; gap: 10px"><span style="position: relative">{av("josie", 96)}<span style="position: absolute; right: -2px; bottom: -2px; width: 32px; height: 32px; border-radius: 50%; background: {SURF2}; border: 2px solid {BG}; display: flex; align-items: center; justify-content: center">{icon("camera", 16)}</span></span><button type="button" style="height: 36px; border: 0; background: transparent; color: {EMBER_T}; font-family: {SANS}; font-size: 14px; font-weight: 700">Change photo</button></div>
{field("en","Name","Josie Hamilton")}
{field("eu","Username","josiehamilton","","text","@")}
{textarea("eb","Bio","Chasing the perfect meal.","25 / 100",2)}
{field("ec","Home city","Vancouver, BC")}
</div>'''))

out('NotificationSettings.dc.html', screen('Notification settings', topbar('Notifications', 'Settings.dc.html') + f'''
<div style="flex: 1; display: flex; flex-direction: column; gap: 22px; padding: 12px 20px 0">
<div>{label("Push")}
{toggle("Dethronings", "When someone you follow swaps a dish out of their five.", True)}
{toggle("New followers", "", True)}
{toggle("Saves of your picks", "", True)}
{toggle("Friends’ new Final Meals", "", True)}
{toggle("Picks near you", "Popular dishes trending in your city.", False)}
</div>
<div>{label("Email")}
{toggle("Weekly digest", "The week’s best picks from your table.", False)}
{toggle("Product news", "", False)}
</div></div>'''))

out('Privacy.dc.html', screen('Privacy and safety', topbar('Privacy & safety', 'Settings.dc.html') + f'''
<div style="flex: 1; display: flex; flex-direction: column; gap: 16px; padding: 4px 20px 0">
<div style="display: flex; flex-direction: column; gap: 10px">{label("Profile visibility")}{vis_cards("pub")}<p style="margin: 0; font-size: 13px; color: {DIM}">Everyone starts public.</p></div>
<div>{toggle("Show my home city", "", True)}</div>
{sgroup("Safety", srow("users", "Blocked accounts", HASH, "0") + srow("eye", "Muted words"))}
{sgroup("Your data", srow("download", "Download my data") + srow("trash", "Delete account", HASH, danger=True))}
</div>'''))

out('SharedList.dc.html', shared_list())
out('Welcome.dc.html', welcome_b())

def web_header(cta=True):
    right = f'<a href="WebSignup.dc.html" style="height: 36px; padding: 0 14px; border-radius: 999px; background: {EMBER}; color: {WHITE}; display: flex; align-items: center; font-size: 13px; font-weight: 700">Open in app</a>' if cta else ''
    return f'<header style="display: flex; align-items: center; gap: 10px; height: 60px; padding: 0 16px; border-bottom: 1px solid {LINE}; flex-shrink: 0"><span style="flex: 1; display: flex; align-items: center; gap: 8px">{skull(18, EMBER)}{wordmark(15)}</span>{right}</header>'

def web_banner(compact=False):
    head = '' if compact else f'<span style="font-family: {SERIF}; font-style: italic; font-weight: 300; font-size: 24px; line-height: 1.15">What would your five be?</span>'
    sub = '' if compact else f'<span style="font-size: 13px; color: {MUTED}; line-height: 1.45">Save Josie’s picks, follow her list and build your own Final Meal. Free.</span>'
    return f'<div style="position: absolute; left: 12px; right: 12px; bottom: 16px; padding: 16px; border-radius: 20px; background: {SURF2}; border: 1px solid {LINE2}; display: flex; flex-direction: column; gap: 10px">{head}{sub}{btn(f"{skull(16, WHITE)}Create your Final Meal", "WebSignup.dc.html", "primary", None, "height: 48px")}</div>'

def web_list():
    rows = ''.join(rgroup(rn, it, 'websave') for rn, it in [VAN[0], VAN[2], VAN[1]])
    filt = ''.join([tsel("All", True), tsel("Noodles"), tsel("Sushi"), tsel("Vegan"), tsel("Gluten-free")])
    return screen('Shared list on the web', web_header() + f"""
<div style="flex: 1; display: flex; flex-direction: column; gap: 14px; padding: 16px 20px 0; min-height: 0">
<span style="display: flex; align-items: center; gap: 8px; font-size: 13px; color: {MUTED}">{av("josie", 26)}<strong style="color: {TEXT}; font-weight: 700">@josiehamilton</strong> shared a list</span>
<div style="display: flex; flex-direction: column; gap: 6px"><h1 style="margin: 0; font-family: {SERIF}; font-style: italic; font-weight: 300; font-size: 38px; line-height: 1.05">Josie’s Vancouver</h1><span style="display: flex; align-items: center; gap: 8px; font-size: 13px; color: {MUTED}">{live_pill()}8 picks at 6 spots · updated 2 days ago</span></div>
<p style="margin: 0; font-family: {SERIF}; font-style: italic; font-size: 17px; color: {BONE}">“Kin Kao first. Trust me.”</p>
{view_toggle(0, "WebList.dc.html", "WebMap.dc.html")}
<div style="display: flex; gap: 8px; overflow: hidden; flex-shrink: 0">{filt}</div>
<ul style="margin: 0; padding: 0; list-style: none">{rows}</ul>
</div>
{web_banner()}
""", pad_top=False)
out('WebList.dc.html', web_list())

def web_map():
    pins = pin_fm(80, 330, 34) + pin_hm(210, 300) + pin_hm(300, 380) + pin_hm(140, 450) + pin_hm(260, 520) + pin_fm(190, 410, 44, True)
    dish, rest, city, col = D["khaosoi"]
    card = f'<a href="WebSignup.dc.html" style="position: absolute; left: 12px; right: 12px; bottom: 112px; display: flex; gap: 12px; align-items: center; padding: 12px; border-radius: 18px; background: {SURF}; border: 1px solid {LINE2}; color: {TEXT}">{thumb(col, 64, 12)}<span style="flex: 1; display: flex; flex-direction: column; gap: 4px; min-width: 0"><span style="font-family: {SERIF}; font-size: 20px; line-height: 1.1">{dish}</span><span style="font-size: 12px; color: {MUTED}">{rest} · Main St · 1.8 km</span>{tags(TAGS["khaosoi"])}</span><span style="width: 44px; height: 44px; border-radius: 50%; border: 1px solid {LINE2}; display: flex; align-items: center; justify-content: center">{icon("bookmark", 18)}</span></a>'
    return screen('Shared list on the web — map', map_svg() + pins + f"""
<div style="position: absolute; top: 0; left: 0; right: 0; background: rgba(11,10,9,0.94); display: flex; flex-direction: column">{web_header()}
<div style="display: flex; flex-direction: column; gap: 10px; padding: 12px 16px 14px"><div style="display: flex; align-items: baseline; justify-content: space-between; gap: 10px"><h1 style="margin: 0; font-family: {SERIF}; font-style: italic; font-weight: 300; font-size: 26px">Josie’s Vancouver</h1>{live_pill()}</div>{view_toggle(1, "WebList.dc.html", "WebMap.dc.html")}</div></div>
{card}
<div style="position: absolute; left: 12px; right: 12px; bottom: 16px; display: flex; gap: 10px; align-items: center; padding: 10px 10px 10px 16px; border-radius: 18px; background: {SURF2}; border: 1px solid {LINE2}"><span style="flex: 1; font-size: 13px; line-height: 1.4; color: {BONE}">Save these to your own list</span>{btn("Join free", "WebSignup.dc.html", "primary", None, "height: 44px; padding: 0 18px; font-size: 14px")}</div>
""", pad_top=False)
out('WebMap.dc.html', web_map())

def web_signup():
    return screen('Web sign-up prompt', web_header(False) + f"""
<div aria-hidden="true" style="flex: 1; padding: 16px 20px; opacity: 0.25; display: flex; flex-direction: column; gap: 10px"><span style="font-family: {SERIF}; font-style: italic; font-weight: 300; font-size: 38px">Josie’s Vancouver</span></div>
<div aria-hidden="true" style="position: absolute; inset: 0; background: rgba(0,0,0,0.6)"></div>
<section aria-label="Create an account" style="position: absolute; left: 0; right: 0; bottom: 0; background: {SURF}; border-radius: 28px 28px 0 0; border-top: 1px solid {LINE2}; padding: 10px 24px 34px; display: flex; flex-direction: column; gap: 16px">
<span aria-hidden="true" style="align-self: center; width: 40px; height: 5px; border-radius: 3px; background: {LINE2}"></span>
<div style="display: flex; justify-content: space-between; align-items: flex-start">{skull(40, EMBER)}{iconbtn("x", "WebList.dc.html", "Close")}</div>
<h1 style="margin: 0; font-family: {SERIF}; font-style: italic; font-weight: 300; font-size: 34px; line-height: 1.1">Save Josie’s picks to your own list.</h1>
<p style="margin: 0; font-size: 15px; line-height: 1.5; color: {MUTED}">A free Final Meal account lets you save picks, follow live lists like this one, and choose your own five.</p>
<div style="display: flex; flex-direction: column; gap: 10px">{btn("Continue with Apple", "OnbName.dc.html", "light")}{btn("Continue with Google", "OnbName.dc.html", "ghost")}{btn("Continue with email", "OnbEmail.dc.html", "primary", "mail")}</div>
<p style="margin: 0; text-align: center; font-size: 14px; color: {MUTED}">Have an account? <a href="Feed.dc.html" style="color: {TEXT}; font-weight: 700">Log in</a></p>
<div style="display: flex; align-items: center; gap: 10px; color: {DIM}; font-size: 12px"><span style="flex: 1; height: 1px; background: {LINE}"></span>or get the app<span style="flex: 1; height: 1px; background: {LINE}"></span></div>
<div style="display: flex; gap: 10px">{btn("App Store", HASH, "soft", "download", "flex: 1; height: 46px; font-size: 14px")}{btn("Google Play", HASH, "soft", "download", "flex: 1; height: 46px; font-size: 14px")}</div>
</section>
""", pad_top=False)
out('WebSignup.dc.html', web_signup())

def web_desktop():
    rows = ''.join(rgroup(rn, it, 'websave') for rn, it in VAN)
    filt = ''.join([tsel("All", True), tsel("Noodles"), tsel("Sushi"), tsel("Vegan"), tsel("Gluten-free")])
    def pp(l, t, fm=False, sel=False):
        if fm:
            ring = 'box-shadow: 0 0 0 5px rgba(232,105,63,0.35);' if sel else ''
            return f'<button type="button" aria-label="Final Meal pick" style="position: absolute; left: {l}%; top: {t}%; width: 44px; height: 44px; border-radius: 50%; background: {EMBER}; border: 2px solid {BG}; display: flex; align-items: center; justify-content: center; padding: 0; {ring}">{skull(20, WHITE)}</button>'
        return f'<button type="button" aria-label="Honorable Mention pick" style="position: absolute; left: {l}%; top: {t}%; width: 20px; height: 20px; border-radius: 50%; background: {BONE}; border: 3px solid {BG}; padding: 0"></button>'
    pins = pp(30, 38, True, True) + pp(55, 30) + pp(68, 52) + pp(42, 62) + pp(20, 70) + pp(75, 22)
    body = f"""<div style="background: {BG}; color: {TEXT}; font-family: {SANS}; display: flex; flex-direction: column">
<header style="display: flex; align-items: center; gap: 16px; flex-wrap: wrap; padding: 16px clamp(16px, 4vw, 40px); border-bottom: 1px solid {LINE}"><span style="flex: 1; display: flex; align-items: center; gap: 10px">{skull(22, EMBER)}{wordmark(18)}</span><a href="Feed.dc.html" style="font-size: 14px; font-weight: 700; color: {TEXT}">Log in</a><a href="WebSignup.dc.html" style="height: 40px; padding: 0 18px; border-radius: 999px; background: {EMBER}; color: {WHITE}; display: flex; align-items: center; font-size: 14px; font-weight: 700">Create your list</a></header>
<main style="width: 100%; max-width: 1280px; margin: 0 auto; box-sizing: border-box; padding: 32px clamp(16px, 4vw, 40px); display: flex; flex-wrap: wrap; gap: 32px">
<section style="flex: 1 1 380px; min-width: 0; display: flex; flex-direction: column; gap: 18px">
<span style="display: flex; align-items: center; gap: 10px; font-size: 14px; color: {MUTED}">{av("josie", 32)}<strong style="color: {TEXT}; font-weight: 700">Josie Hamilton</strong> shared a list</span>
<h1 style="margin: 0; font-family: {SERIF}; font-style: italic; font-weight: 300; font-size: clamp(40px, 5vw, 60px); line-height: 1">Josie’s Vancouver</h1>
<span style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap; font-size: 14px; color: {MUTED}">{live_pill()}8 picks at 6 spots · 1 Final Meal · updated 2 days ago</span>
<p style="margin: 0; font-family: {SERIF}; font-style: italic; font-size: 20px; color: {BONE}">“Kin Kao first. Trust me.”</p>
<div style="display: flex; gap: 8px; flex-wrap: wrap">{filt}</div>
<ul style="margin: 0; padding: 0; list-style: none">{rows}</ul>
</section>
<section aria-label="Map of picks" style="flex: 999 1 520px; min-width: 0; height: 640px; position: relative; border-radius: 24px; overflow: hidden; border: 1px solid {LINE}">
<svg aria-hidden="true" width="100%" height="100%" viewBox="0 0 390 844" preserveAspectRatio="xMidYMid slice" style="position: absolute; inset: 0"><rect width="390" height="844" fill="#141210"/><path d="M0 520 C 80 500 120 560 210 540 S 340 470 390 500 L 390 640 C 300 660 240 610 160 640 S 40 690 0 660 Z" fill="#0F1A1F"/><g stroke="rgba(243,237,228,0.07)" stroke-width="1.5" fill="none"><path d="M0 120 L390 160"/><path d="M0 260 L390 230"/><path d="M0 380 L390 400"/><path d="M60 0 L90 844"/><path d="M170 0 L150 520"/><path d="M290 140 L320 844"/></g><g stroke="rgba(243,237,228,0.12)" stroke-width="3" fill="none"><path d="M0 330 C 120 300 240 340 390 300"/><path d="M120 0 C 140 200 100 400 140 844"/></g></svg>
{pins}
<div style="position: absolute; left: 16px; bottom: 16px; display: flex; gap: 14px; padding: 10px 14px; border-radius: 12px; background: rgba(23,21,19,0.94); font-size: 13px; color: {MUTED}"><span style="display: flex; align-items: center; gap: 6px"><span style="width: 10px; height: 10px; border-radius: 50%; background: {EMBER}"></span>Final Meal</span><span style="display: flex; align-items: center; gap: 6px"><span style="width: 10px; height: 10px; border-radius: 50%; background: {BONE}"></span>Honorable</span></div>
</section>
</main>
<section style="border-top: 1px solid {LINE}; background: {SURF}">
<div style="max-width: 1280px; margin: 0 auto; box-sizing: border-box; padding: 40px clamp(16px, 4vw, 40px); display: flex; flex-wrap: wrap; align-items: center; gap: 24px">
<div style="flex: 1 1 360px; display: flex; flex-direction: column; gap: 8px"><h2 style="margin: 0; font-family: {SERIF}; font-style: italic; font-weight: 300; font-size: 36px">What would your five be?</h2><p style="margin: 0; font-size: 15px; color: {MUTED}">Save Josie’s picks, follow live lists, and choose your own Final Meal. Free.</p></div>
<div style="display: flex; gap: 12px; flex-wrap: wrap">{btn("Create your Final Meal", "WebSignup.dc.html", "primary", None, "padding: 0 24px")}{btn("Get the app", HASH, "ghost", "download", "padding: 0 20px")}</div>
</div></section>
<footer style="max-width: 1280px; width: 100%; margin: 0 auto; box-sizing: border-box; padding: 20px clamp(16px, 4vw, 40px) 32px; display: flex; flex-wrap: wrap; gap: 20px; font-size: 13px; color: {DIM}"><span style="flex: 1">© Final Meal</span><a href="#" style="color: {MUTED}">Terms</a><a href="#" style="color: {MUTED}">Privacy</a><a href="#" style="color: {MUTED}">Report this list</a></footer>
</div>"""
    return HEAD.replace('@TITLE', 'Shared list — desktop web') + body + '\n' + tail(1280, 1260)
out('WebDesktop.dc.html', web_desktop())


# =====================================================================
# CANVAS INDEX
# =====================================================================
rows = [
 ('onb', 'Welcome & sign-up', [('Splash', '01 Splash'), ('Welcome', 'Welcome'), ('OnbEmail', 'Email'), ('OnbOtp', 'Email code'), ('OnbName', 'Name'), ('OnbUsername', 'Username'), ('OnbLocation', 'Home city'), ('OnbPhoto', '09 Photo'), ('OnbFirstPick', '10 The hard part'), ('OnbAddFirst', '11 First pick'), ('OnbTransition', 'Loading'), ('FirstLand', 'First landing')]),
 ('core', 'Feed, adding & discovering', [('Feed', 'Feed'), ('FeedAd', 'Feed — Honorable + ad'), ('FeedEmpty', 'Feed — empty'), ('AddDish', '15 Add a dish'), ('AddDishTags', 'Add a dish — tags open'), ('TagSearch', 'Find a tag'), ('Swap', '17 Swap (list full)'), ('PickDetail', '18 Pick detail'), ('Discover', 'Discover map'), ('DiscoverHM', 'Discover — Honorable selected'), ('DiscoverFilters', '20 Filters'), ('DiscoverSearch', '21 Discover search'), ('Search', '22 People search'), ('Notifications', '23 Activity'), ('Saved', '24 Saved')]),
 ('share', 'Sharing lists', [('ShareHub', '25 Share — what to share'), ('ShareList', '26 Share — city list (link)'), ('ShareImage', '27 Share — food type (image)'), ('ShareCard', '28 Share — Final Meal (image)'), ('SharedList', '29 Friend opens a shared list')]),
 ('web', 'Shared lists on the web (no app needed)', [('WebList', '30 Web — list view'), ('WebMap', '31 Web — map view'), ('WebSignup', '32 Web — join prompt'), ('WebDesktop', '33 Web — desktop')]),
 ('social', 'Profile & social', [('Profile', 'Profile — Final Meal'), ('ProfileHM', 'Profile — Honorable, Vancouver (by restaurant)'), ('ProfileMap', 'Profile — Map, Sushi filter'), ('MyLists', 'Your lists'), ('MyList', 'Your Vancouver list'), ('OtherProfile', '37 Someone else'), ('Followers', '38 Followers')]),
 ('settings', 'Settings & account', [('Settings', 'Settings'), ('RemoveAds', 'Remove ads — $5'), ('EditProfile', '40 Edit profile'), ('NotificationSettings', '41 Notifications'), ('Privacy', '42 Privacy & safety')]),
]
boards = {'Main.dc.html': {'x': 0, 'y': 0, 'w': 1280, 'h': 900, 'title': 'Brand foundations'}, 'Wordmark.dc.html': {'x': 1360, 'y': 0, 'w': 1280, 'h': 900, 'title': 'Wordmark explorations'}}
order = ['Main.dc.html', 'Wordmark.dc.html']
notes = {
 'brandtitle': {'x': 0, 'y': -300, 'text': 'Final Meal — brand & screens', 'kind': 'title1', 'maxW': 2640},
 'questions': {'x': 2720, 'y': 0, 'w': 440, 'fill': 'orange', 'text': 'Open questions\n\n1. Skull: keep as-is, soften, or pair with a plate/knife mark?\n2. Private members: can followers still see their name? Can they be followed at all?\n3. Ads: how often in the feed (every 5th card?), and sold directly to restaurants or through an ad network?\n4. Web link domain + list URL format.'},
 'decided': {'x': 3220, 'y': 0, 'w': 440, 'fill': 'green', 'text': 'Decided\n\n• Name: Final Meal\n• Wordmark: Instrument Serif\n• Colour: ember + ember glow only\n• Skull marks Final Meal only; Honorable is a bone dot / outline badge\n• Sharing is link-first; shared lists are live\n• Links open on the web unless the app is installed; the web page pushes sign-up\n• Welcome: map version\n• Sign-in: Apple, Google or email code; no phone number\n• Everyone starts Public; Private is a setting (private picks stay on the map without a name)\n• Add a dish is one step; tags expand inline\n• Lists and Honorable are grouped by restaurant; the Final Meal tab always shows the five separately\n• Photo, note and tags are all optional\n• Tags: fixed list (searchable, larger) + personal custom tags\n• Money: ads in the feed; $5 one-time to remove'},
}
y = 900 + 120 + 300
NUM = [0]
for key, title, items in rows:
    notes[f't_{key}'] = {'x': 0, 'y': y - 260, 'text': title, 'kind': 'title1', 'maxW': len(items) * 470 - 80}
    x = 0; rh = 844
    for i, (f, t) in enumerate(items):
        NUM[0] += 1
        t = f"{NUM[0]:02d} " + re.sub(r'^\d+ ', '', t)
        fn = f'{f}.dc.html'
        w, h = (1280, 1260) if f == 'WebDesktop' else (390, 844)
        boards[fn] = {'x': x, 'y': y, 'w': w, 'h': h, 'title': t, 'is_interactive': True}
        if f == 'WebDesktop':
            boards[fn]['expand'] = 'fill'
        order.append(fn)
        x += w + 80; rh = max(rh, h)
    notes[f't_{key}']['maxW'] = x - 80
    y += rh + 120 + 260

canvas = {'v': 3, 'createdOnFiles': {'v': 1, 'at': '2026-10-25T21:04:36Z'},
          'title': 'Final Meal — App Screens', 'launch': {'view': 'canvas'}, 'pages': [], 'boards': boards, 'order': order, 'notes': notes, 'designSystems': []}
with open(os.path.join(P, 'canvas.json'), 'w') as f:
    json.dump(canvas, f, ensure_ascii=False, indent=1)
missing = [b for b in order if b not in FILES]
assert not missing, missing
for n, h in FILES.items():
    with open(os.path.join(P, n), 'w') as f:
        f.write(h)
print(ROOT)
print(json.dumps({f'project/{n}': f'project/{n}' for n in order[1:]}))
