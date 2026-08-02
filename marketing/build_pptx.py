"""
Build the ScoreFlow sales presentation as a real .pptx file.

    python marketing/build_pptx.py

WHY A SCRIPT AND NOT A HAND-BUILT FILE. Copy changes. The price changes, the trial
length changes, the product grows a feature. A generated deck is rebuilt in two
seconds; a hand-built one quietly goes stale, which is exactly the drift the landing
page suffered twice (M23, M40) and the reason /pitch is generated from the real app.

WHAT'S IN HERE THAT POWERPOINT LIBRARIES USUALLY CAN'T DO. python-pptx has no API for
slide transitions or element animations, so both are written as raw OOXML and appended
to each slide (see `set_transition` and `animate`). A .pptx is a zip of XML, and
PowerPoint reads exactly these elements — the deck animates natively when opened, with
nothing to install.

INTERACTIVITY. Slide 2 is a menu whose tiles jump to sections, every content slide has
a "Menu" button that jumps back, and the last slide's button opens the signup page in a
browser. All via real PowerPoint click actions, so they work in Slide Show mode.

IMAGES. Screenshots of the actual product, captured from /pitch. Nothing is redrawn.
"""

from pathlib import Path

from PIL import Image
from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import MSO_ANCHOR, PP_ALIGN
from pptx.oxml import parse_xml
from pptx.oxml.ns import nsdecls
from pptx.util import Emu, Inches, Pt

HERE = Path(__file__).parent
ASSETS = HERE / "assets"
OUT = HERE / "ScoreFlow.pptx"

# ── The brand, lifted from the app's own tokens ──────────────────────────────
INK = RGBColor(0x1D, 0x1D, 0x1F)      # near-black — the app's text colour
PAPER = RGBColor(0xFF, 0xFF, 0xFF)
MIST = RGBColor(0xF5, 0xF5, 0xF7)     # the light page background
GREY = RGBColor(0x6E, 0x6E, 0x73)     # secondary text
FAINT = RGBColor(0xAE, 0xAE, 0xB2)    # kickers, captions
LINE = RGBColor(0xD2, 0xD2, 0xD7)     # hairlines
AMBER = RGBColor(0xF5, 0x9E, 0x0B)    # the single accent
RED = RGBColor(0xDC, 0x26, 0x26)
GREEN = RGBColor(0x16, 0xA3, 0x4A)

FONT = "Segoe UI"  # the Windows system face — the app deliberately uses the OS font

W, H = Inches(13.333), Inches(7.5)  # 16:9 widescreen
MARGIN = Inches(0.9)

SIGNUP_URL = "https://scoreflow-six.vercel.app/signup"


# ═══════════════════════════════════════════════════════════════════════════
#  Raw-OOXML helpers: transitions and animations
# ═══════════════════════════════════════════════════════════════════════════

def set_transition(slide, kind="fade", speed="med"):
    """Give the slide an entry transition.

    Written as raw XML because python-pptx has no transition API. The element must sit
    after <p:cSld>/<p:clrMapOvr> in the slide, which appending achieves — the schema
    order is cSld, clrMapOvr, transition, timing.

    `kind` is any of PowerPoint's built-in transitions in the main namespace: fade,
    push, wipe, split, cover, zoom, wheel, dissolve, cut, comb, randomBar. These are
    used in preference to the fancier p14 set (glitter, vortex, morph…) because they
    need no AlternateContent fallback and render identically in PowerPoint, Keynote,
    LibreOffice and Google Slides.
    """
    inner = {
        "push": '<p:push dir="u"/>',
        "wipe": '<p:wipe dir="d"/>',
        "cover": '<p:cover dir="u"/>',
        "split": '<p:split orient="horz" dir="out"/>',
        "wheel": '<p:wheel spokes="4"/>',
        "zoom": '<p:zoom dir="in"/>',
        "dissolve": "<p:dissolve/>",
    }.get(kind, "<p:fade/>")

    slide._element.append(
        parse_xml(f'<p:transition {nsdecls("p")} spd="{speed}">{inner}</p:transition>')
    )


# Entrance-effect presets. The filter is what PowerPoint actually plays; presetID only
# decides the name shown in the animation pane, so they're kept honest.
_PRESETS = {
    "fade": (10, "fade"),
    "rise": (2, "slide(fromBottom)"),
    "wipe": (22, "wipe(up)"),
    "circle": (27, "circle(in)"),
    "left": (2, "slide(fromLeft)"),
}


def animate(slide, steps, start_delay=200, dur=520):
    """Stagger entrance animations for shapes, playing automatically on slide entry.

    `steps` is a list of (shape, effect) pairs in the order they should appear; each
    waits `start_delay` ms after the one before. Effects come from _PRESETS.

    The whole build lives in ONE click-group whose start condition is `delay="0"`, so
    it runs as soon as the slide appears rather than waiting for a click — a deck that
    needs six clicks per slide to reveal itself is a deck nobody enjoys presenting.
    """
    if not steps:
        return

    tid = iter(range(10, 10 + len(steps) * 3 + 10))
    effects = []
    for i, (shape, effect) in enumerate(steps):
        preset_id, filt = _PRESETS[effect]
        sid = shape.shape_id
        a, b, c = next(tid), next(tid), next(tid)
        effects.append(
            f'<p:par><p:cTn id="{a}" presetID="{preset_id}" presetClass="entr"'
            f' presetSubtype="0" fill="hold" grpId="0" nodeType="withEffect">'
            f'<p:stCondLst><p:cond delay="{i * start_delay}"/></p:stCondLst>'
            f"<p:childTnLst>"
            f"<p:set><p:cBhvr>"
            f'<p:cTn id="{b}" dur="1" fill="hold">'
            f'<p:stCondLst><p:cond delay="0"/></p:stCondLst></p:cTn>'
            f'<p:tgtEl><p:spTgt spid="{sid}"/></p:tgtEl>'
            f"<p:attrNameLst><p:attrName>style.visibility</p:attrName></p:attrNameLst>"
            f'</p:cBhvr><p:to><p:strVal val="visible"/></p:to></p:set>'
            f'<p:animEffect transition="in" filter="{filt}"><p:cBhvr>'
            f'<p:cTn id="{c}" dur="{dur}"/>'
            f'<p:tgtEl><p:spTgt spid="{sid}"/></p:tgtEl>'
            f"</p:cBhvr></p:animEffect>"
            f"</p:childTnLst></p:cTn></p:par>"
        )

    slide._element.append(
        parse_xml(
            f'<p:timing {nsdecls("p")}><p:tnLst><p:par>'
            f'<p:cTn id="1" dur="indefinite" restart="never" nodeType="tmRoot">'
            f'<p:childTnLst><p:seq concurrent="1" nextAc="seek">'
            f'<p:cTn id="2" dur="indefinite" nodeType="mainSeq"><p:childTnLst>'
            f'<p:par><p:cTn id="3" fill="hold">'
            f'<p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst>'
            f'<p:par><p:cTn id="4" fill="hold">'
            f'<p:stCondLst><p:cond delay="0"/></p:stCondLst>'
            f"<p:childTnLst>{''.join(effects)}</p:childTnLst>"
            f"</p:cTn></p:par>"
            f"</p:childTnLst></p:cTn></p:par>"
            f"</p:childTnLst></p:cTn>"
            f'<p:prevCondLst><p:cond evt="onPrev" delay="0">'
            f"<p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:prevCondLst>"
            f'<p:nextCondLst><p:cond evt="onNext" delay="0">'
            f"<p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:nextCondLst>"
            f"</p:seq></p:childTnLst></p:cTn></p:par></p:tnLst></p:timing>"
        )
    )


# ═══════════════════════════════════════════════════════════════════════════
#  Small building blocks
# ═══════════════════════════════════════════════════════════════════════════

def add_slide(prs, bg):
    """A blank slide painted a solid colour. Layout 6 is the empty one."""
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    fill = slide.background.fill
    fill.solid()
    fill.fore_color.rgb = bg
    return slide


def text(slide, s, left, top, width, height, size, color=INK, bold=False,
         align=PP_ALIGN.LEFT, spacing=1.0, italic=False):
    """A text box. Returns the shape so it can be animated."""
    box = slide.shapes.add_textbox(left, top, width, height)
    tf = box.text_frame
    tf.word_wrap = True
    tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0

    for i, line in enumerate(s.split("\n")):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = align
        p.line_spacing = spacing
        run = p.add_run()
        run.text = line
        f = run.font
        f.name, f.size, f.bold, f.italic = FONT, Pt(size), bold, italic
        f.color.rgb = color
    return box


def kicker(slide, s, left, top, color=FAINT):
    """The small upper-case label above a headline."""
    return text(slide, s.upper(), left, top, Inches(8), Inches(0.35), 13,
                color=color, bold=True)


def picture(slide, name, left, top, width):
    """Place an image, height derived from its real aspect ratio."""
    path = ASSETS / name
    w_px, h_px = Image.open(path).size
    height = Emu(int(width * h_px / w_px))
    return slide.shapes.add_picture(str(path), left, top, width=width, height=height)


def card(slide, left, top, width, height, fill=PAPER, line=LINE, radius=0.06):
    """A rounded panel — the app's own card shape."""
    shape = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left, top, width, height)
    shape.adjustments[0] = radius
    shape.fill.solid()
    shape.fill.fore_color.rgb = fill
    if line is None:
        shape.line.fill.background()
    else:
        shape.line.color.rgb = line
        shape.line.width = Pt(1)
    shape.shadow.inherit = False
    return shape


def label(shape, s, size=15, color=INK, bold=False, align=PP_ALIGN.CENTER):
    """Put text inside a shape (shapes have their own text frame)."""
    tf = shape.text_frame
    tf.word_wrap = True
    tf.vertical_anchor = MSO_ANCHOR.MIDDLE
    p = tf.paragraphs[0]
    p.alignment = align
    run = p.add_run()
    run.text = s
    run.font.name, run.font.size, run.font.bold = FONT, Pt(size), bold
    run.font.color.rgb = color
    return shape


def accent_rule(slide, left, top, width=Inches(1.1)):
    """A short amber bar — the deck's one flash of colour."""
    bar = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, left, top, width, Pt(5))
    bar.fill.solid()
    bar.fill.fore_color.rgb = AMBER
    bar.line.fill.background()
    bar.shadow.inherit = False
    return bar


def notes(slide, s):
    """Speaker notes — what to actually say. Visible in Presenter View."""
    slide.notes_slide.notes_text_frame.text = s


# ═══════════════════════════════════════════════════════════════════════════
#  The deck
# ═══════════════════════════════════════════════════════════════════════════

def build():
    prs = Presentation()
    prs.slide_width, prs.slide_height = W, H

    menu_buttons = []  # wired to the menu slide once every slide exists
    sections = {}      # section name -> slide, for the menu's jump targets

    # ── 1. Title ─────────────────────────────────────────────────────────────
    s1 = add_slide(prs, INK)
    a = text(s1, "SCOREFLOW", MARGIN, Inches(2.0), Inches(8), Inches(0.4), 15,
             color=AMBER, bold=True)
    b = accent_rule(s1, MARGIN, Inches(2.65))
    c = text(s1, "Hear it at the table.\nNot on Google.", MARGIN, Inches(3.0),
             Inches(9.5), Inches(2.2), 54, color=PAPER, bold=True, spacing=1.05)
    d = text(s1, "Guests rate their meal in ten seconds. If someone's unhappy, "
                 "you know before they've left the building — and you know which dish.",
             MARGIN, Inches(5.3), Inches(9.0), Inches(1.0), 17, color=RGBColor(0xB0, 0xB0, 0xB6))
    picture(s1, "slide-5-full.png", Inches(10.3), Inches(1.5), Inches(2.4))
    set_transition(s1, "fade", "slow")
    animate(s1, [(a, "fade"), (b, "left"), (c, "rise"), (d, "fade")], start_delay=260)
    notes(s1, "One line: restaurants find out their food was bad from a public review, "
              "days later. We move that moment to the table.")

    # ── 2. Menu (the interactive hub) ────────────────────────────────────────
    s2 = add_slide(prs, MIST)
    kicker(s2, "Contents", MARGIN, Inches(0.8))
    m_title = text(s2, "Five minutes.", MARGIN, Inches(1.25), Inches(9), Inches(0.9),
                   40, bold=True)
    text(s2, "Click any card to jump straight there.", MARGIN, Inches(2.15),
         Inches(9), Inches(0.4), 15, color=GREY)

    menu_items = [
        ("01", "The problem", "A guest leaves unhappy\nand says nothing."),
        ("02", "How it works", "A card on the table.\nTen seconds, no app."),
        ("03", "Which dish", "The part nobody else does."),
        ("04", "Why trust it", "Every guest gets\nthe review link."),
        ("05", "Price & setup", "Live tonight.\nNothing to buy."),
    ]
    tiles = []
    tile_w, gap = Inches(2.15), Inches(0.28)
    x = MARGIN
    for num, title, sub in menu_items:
        t = card(s2, x, Inches(3.0), tile_w, Inches(2.5))
        text(s2, num, x + Inches(0.28), Inches(3.28), Inches(1), Inches(0.3), 12,
             color=AMBER, bold=True)
        text(s2, title, x + Inches(0.28), Inches(3.72), tile_w - Inches(0.5),
             Inches(0.6), 19, bold=True)
        text(s2, sub, x + Inches(0.28), Inches(4.45), tile_w - Inches(0.5),
             Inches(0.9), 13, color=GREY, spacing=1.25)
        tiles.append(t)
        x += tile_w + gap
    set_transition(s2, "push")
    animate(s2, [(m_title, "rise")] + [(t, "rise") for t in tiles], start_delay=140)
    notes(s2, "This slide is clickable in Slide Show mode. Use it if someone asks to "
              "skip ahead — jump straight to 'Which dish'.")

    # ── helper: a content slide with a Menu button ───────────────────────────
    def content(bg=MIST, transition="push"):
        sl = add_slide(prs, bg)
        btn = card(sl, W - Inches(1.85), Inches(0.55), Inches(1.0), Inches(0.42),
                   fill=PAPER if bg is not INK else RGBColor(0x2C, 0x2C, 0x2E),
                   line=LINE if bg is not INK else RGBColor(0x3A, 0x3A, 0x3C),
                   radius=0.5)
        label(btn, "Menu", size=12, color=INK if bg is not INK else PAPER)
        menu_buttons.append(btn)
        set_transition(sl, transition)
        return sl

    # ── 3. The problem ───────────────────────────────────────────────────────
    s3 = content(INK, "cover")
    sections["01"] = s3
    kicker(s3, "01 · The problem", MARGIN, Inches(0.9), color=RGBColor(0x8E, 0x8E, 0x93))
    t = text(s3, "A guest hated the burger.\nThey didn't tell you.", MARGIN,
             Inches(1.5), Inches(7.2), Inches(1.9), 40, color=PAPER, bold=True,
             spacing=1.1)
    p = text(s3, "They told Google. Four days later. In public — where every person "
                 "deciding where to eat tonight can read it.",
             MARGIN, Inches(3.6), Inches(6.6), Inches(1.2), 17,
             color=RGBColor(0xB0, 0xB0, 0xB6))
    img = picture(s3, "review-card.png", Inches(7.6), Inches(2.4), Inches(4.8))
    animate(s3, [(t, "rise"), (p, "fade"), (img, "rise")], start_delay=320)
    notes(s3, "The moment the money is lost is silent. Nobody complains — they just "
              "don't come back, and they warn everyone else.")

    # ── 4. Why it hurts ──────────────────────────────────────────────────────
    s4 = content(PAPER)
    kicker(s4, "01 · The problem", MARGIN, Inches(0.9))
    t = text(s4, "A bad review isn't one bad night.", MARGIN, Inches(1.4),
             Inches(10), Inches(0.9), 38, bold=True)
    cols = [
        ("Public", "Anyone choosing a restaurant tonight sees it first."),
        ("Permanent", "It outlives the shift, the chef, and the recipe."),
        ("Unanswerable", "By the time you read it, they're long gone."),
    ]
    shapes = []
    x = MARGIN
    cw = Inches(3.6)
    for head, body in cols:
        bar = accent_rule(s4, x, Inches(2.9), Inches(0.7))
        text(s4, head, x, Inches(3.25), cw, Inches(0.5), 24, bold=True)
        text(s4, body, x, Inches(3.95), cw - Inches(0.3), Inches(1.4), 16,
             color=GREY, spacing=1.3)
        shapes.append(bar)
        x += cw + Inches(0.35)
    animate(s4, [(t, "rise")] + [(s, "left") for s in shapes], start_delay=220)
    notes(s4, "No statistics here on purpose — we don't invent numbers. These three "
              "facts are self-evident to any owner.")

    # ── 5. The turn ──────────────────────────────────────────────────────────
    s5 = content(MIST, "split")
    kicker(s5, "The idea", MARGIN, Inches(1.6))
    t = text(s5, "What if you knew\nin 30 seconds?", MARGIN, Inches(2.15),
             Inches(11), Inches(2.4), 60, bold=True, spacing=1.05)
    p = text(s5, "A problem you hear about at the table is a free dessert.\n"
                 "The same problem on Google is a one-star, forever.",
             MARGIN, Inches(4.9), Inches(10), Inches(1.2), 20, color=GREY, spacing=1.4)
    animate(s5, [(t, "rise"), (p, "fade")], start_delay=420, dur=700)
    notes(s5, "Pause here. This is the pivot of the whole pitch.")

    # ── 6. How it works ──────────────────────────────────────────────────────
    s6 = content(PAPER)
    sections["02"] = s6
    kicker(s6, "02 · How it works", MARGIN, Inches(0.9))
    t = text(s6, "A card on the table.", MARGIN, Inches(1.4), Inches(8), Inches(0.9),
             38, bold=True)
    p = text(s6, "They scan it and rate the meal out of ten. No app to download, "
                 "nothing to sign up for, no typing.",
             MARGIN, Inches(2.3), Inches(5.6), Inches(1.2), 17, color=GREY)
    steps = []
    for i, (n, line) in enumerate([
        ("1", "You print the cards — we generate them"),
        ("2", "One goes on each table"),
        ("3", "That's it. You're live tonight."),
    ]):
        y = Inches(3.7 + i * 0.72)
        dot = slide_dot(s6, MARGIN, y)
        label(dot, n, size=13, color=PAPER, bold=True)
        text(s6, line, MARGIN + Inches(0.62), y + Inches(0.05), Inches(5.4),
             Inches(0.4), 16)
        steps.append(dot)
    img = picture(s6, "table-card-phone.png", Inches(7.3), Inches(2.2), Inches(5.2))
    animate(s6, [(t, "rise"), (p, "fade"), (img, "rise")] + [(d, "left") for d in steps],
            start_delay=220)
    notes(s6, "Ten seconds is the whole trick. Ask for more and guests don't finish.")

    # ── 7. Or tap ────────────────────────────────────────────────────────────
    s7 = content(MIST)
    kicker(s7, "02 · How it works", MARGIN, Inches(0.9))
    t = text(s7, "No camera? Tap instead.", MARGIN, Inches(1.4), Inches(9),
             Inches(0.9), 38, bold=True)
    p = text(s7, "Load the same link onto a reusable NFC chip and guests just tap "
                 "their phone to the table. Buy the chips once — they last years.",
             MARGIN, Inches(2.35), Inches(7.4), Inches(1.2), 17, color=GREY)
    img = picture(s7, "nfc-pill.png", MARGIN, Inches(4.1), Inches(7.0))
    animate(s7, [(t, "rise"), (p, "fade"), (img, "wipe")], start_delay=280)
    notes(s7, "NFC came first on this product; QR was added so there's nothing to buy. "
              "Both work — same link.")

    # ── 8. The alert ─────────────────────────────────────────────────────────
    s8 = content(PAPER)
    kicker(s8, "02 · How it works", MARGIN, Inches(0.9))
    t = text(s8, "Your phone buzzes\nbefore they've paid.", MARGIN, Inches(1.4),
             Inches(6.4), Inches(1.9), 38, bold=True, spacing=1.1)
    p = text(s8, "A poor score reaches you with the table number, the order and what "
                 "went wrong — while they're still sitting there.",
             MARGIN, Inches(3.5), Inches(5.8), Inches(1.3), 17, color=GREY)
    q = text(s8, "You have about four minutes.", MARGIN, Inches(5.0), Inches(6),
             Inches(0.6), 22, color=AMBER, bold=True)
    img = picture(s8, "alert-card.png", Inches(7.3), Inches(2.3), Inches(5.2))
    animate(s8, [(t, "rise"), (p, "fade"), (img, "rise"), (q, "circle")],
            start_delay=300)
    notes(s8, "Four minutes is the window to send over a dessert and turn it around.")

    # ── 9. WHICH DISH — the slide that closes it ─────────────────────────────
    s9 = content(INK, "zoom")
    sections["03"] = s9
    kicker(s9, "03 · The part nobody else does", MARGIN, Inches(0.9),
           color=RGBColor(0x8E, 0x8E, 0x93))
    t = text(s9, "It tells you which dish.", MARGIN, Inches(1.45), Inches(8),
             Inches(1.0), 42, color=PAPER, bold=True)
    p = text(s9, "Your till says what was on the order, so a poor score is tied to "
                 "the food it was actually about. Guests are asked nothing extra.",
             MARGIN, Inches(2.6), Inches(6.0), Inches(1.6), 17,
             color=RGBColor(0xB0, 0xB0, 0xB6), spacing=1.35)
    q = text(s9, "“Someone was unhappy” is a worry.\n"
                 "“The chicken burger is dry” is a job.",
             MARGIN, Inches(4.6), Inches(6.2), Inches(1.4), 19, color=AMBER,
             spacing=1.35, italic=True)
    img = picture(s9, "by-dish.png", Inches(7.2), Inches(2.3), Inches(5.3))
    animate(s9, [(t, "rise"), (p, "fade"), (img, "rise"), (q, "fade")],
            start_delay=380, dur=650)
    notes(s9, "THIS is the slide that sells it. Slow down. An alert says something is "
              "wrong; this says what to fix on Monday morning.")

    # ── 10. How the dish part works ──────────────────────────────────────────
    s10 = content(PAPER)
    kicker(s10, "03 · Which dish", MARGIN, Inches(0.9))
    t = text(s10, "It works because your till already knows.", MARGIN, Inches(1.4),
             Inches(11), Inches(0.9), 34, bold=True)
    flow = [
        ("Your till", "sends the order —\ntable 4, chicken burger"),
        ("The guest", "rates the meal 3/10\nand taps “dry”"),
        ("ScoreFlow", "matches the two\nand names the dish"),
    ]
    boxes = []
    x = MARGIN
    bw = Inches(3.5)
    for i, (head, body) in enumerate(flow):
        bx = card(s10, x, Inches(2.9), bw, Inches(2.1),
                  fill=MIST if i < 2 else INK, line=None)
        text(s10, head, x + Inches(0.35), Inches(3.2), bw - Inches(0.6), Inches(0.4),
             18, bold=True, color=INK if i < 2 else PAPER)
        text(s10, body, x + Inches(0.35), Inches(3.8), bw - Inches(0.6), Inches(1.1),
             14, color=GREY if i < 2 else RGBColor(0xB0, 0xB0, 0xB6), spacing=1.3)
        boxes.append(bx)
        if i < 2:
            text(s10, "→", x + bw + Inches(0.06), Inches(3.75), Inches(0.4),
                 Inches(0.5), 22, color=FAINT)
        x += bw + Inches(0.42)
    n = text(s10, "One-off setup by whoever supports your till. We publish the "
                  "integration guide — no vendor approval needed.",
             MARGIN, Inches(5.5), Inches(10.5), Inches(0.8), 15, color=GREY)
    animate(s10, [(t, "rise")] + [(b, "rise") for b in boxes] + [(n, "fade")],
            start_delay=200)
    notes(s10, "If they ask 'will this work with my POS?' — yes, it's a generic "
               "endpoint with a per-restaurant key. See docs/POS_INTEGRATION.md.")

    # ── 11. Why trust it ─────────────────────────────────────────────────────
    s11 = content(MIST)
    sections["04"] = s11
    kicker(s11, "04 · Why you can trust it", MARGIN, Inches(0.9))
    t = text(s11, "Every guest gets the review link.\nEven the unhappy one.",
             MARGIN, Inches(1.4), Inches(9), Inches(1.8), 34, bold=True, spacing=1.15)
    img = picture(s11, "platforms.png", MARGIN, Inches(3.5), Inches(5.0))
    p = text(s11, "Tools that hide the review link from unhappy guests break Google's "
                  "rules and UK review law. We never hide it — that's the product, "
                  "not a compromise.",
             MARGIN, Inches(4.5), Inches(6.4), Inches(1.6), 17, color=GREY, spacing=1.35)
    q = card(s11, Inches(8.0), Inches(2.6), Inches(4.4), Inches(2.6), fill=PAPER)
    label(q, "If a competitor filters your bad\nreviews, the risk is yours —\nnot theirs.",
          size=19, color=INK)
    animate(s11, [(t, "rise"), (img, "left"), (p, "fade"), (q, "rise")],
            start_delay=260)
    notes(s11, "This is the one thing a competitor can't copy without changing their "
               "own product. Worth labouring if they've been sold review-gating before.")

    # ── 12. Price & setup ────────────────────────────────────────────────────
    s12 = content(PAPER)
    sections["05"] = s12
    kicker(s12, "05 · Price & setup", MARGIN, Inches(0.9))
    t = text(s12, "Live tonight. Nothing to buy.", MARGIN, Inches(1.4), Inches(9),
             Inches(0.9), 38, bold=True)
    img = picture(s12, "steps.png", MARGIN, Inches(2.7), Inches(6.2))
    price = card(s12, Inches(8.1), Inches(2.5), Inches(4.3), Inches(3.2), fill=INK,
                 line=None)
    text(s12, "£29", Inches(8.5), Inches(2.85), Inches(3), Inches(1.0), 54,
         color=PAPER, bold=True)
    text(s12, "per location, per month", Inches(8.5), Inches(3.95), Inches(3.5),
         Inches(0.4), 15, color=RGBColor(0xB0, 0xB0, 0xB6))
    # Kept to one line each — the longer single string wrapped onto two lines and
    # collided with the VAT note underneath.
    text(s12, "14 days free · no card", Inches(8.5), Inches(4.45), Inches(3.5),
         Inches(0.4), 15, color=AMBER)
    text(s12, "Cancel whenever. Prices exclude VAT.", Inches(8.5), Inches(4.95),
         Inches(3.5), Inches(0.3), 12, color=RGBColor(0x8E, 0x8E, 0x93))
    animate(s12, [(t, "rise"), (img, "left"), (price, "rise")], start_delay=280)
    notes(s12, "A printer is the only equipment. If they already have NFC chips, "
               "those work too.")

    # ── 13. Close ────────────────────────────────────────────────────────────
    s13 = add_slide(prs, INK)
    set_transition(s13, "fade", "slow")
    t = text(s13, "The next unhappy guest\ntells you, not Google.", MARGIN,
             Inches(2.3), Inches(7.6), Inches(2.2), 44, color=PAPER, bold=True,
             spacing=1.1)
    cta = card(s13, MARGIN, Inches(4.9), Inches(3.4), Inches(0.75), fill=AMBER,
               line=None, radius=0.5)
    label(cta, "Start 14 days free", size=17, color=INK, bold=True)
    cta.click_action.hyperlink.address = SIGNUP_URL
    # ⚠️ `qr-only`, not `qr-block`. The block asset carries the words "The next unhappy
    # guest tells you, not Google" inside it — the same sentence as this slide's
    # headline — so the deck printed it twice, which reads as a mistake rather than a
    # refrain. Only caught by looking at the exported slide.
    img = picture(s13, "qr-only.png", Inches(9.4), Inches(2.5), Inches(2.1))
    hint = text(s13, "Scan it — this code is live.", Inches(8.9), Inches(4.8),
                Inches(3.2), Inches(0.4), 14, color=RGBColor(0x8E, 0x8E, 0x93),
                align=PP_ALIGN.CENTER)
    animate(s13, [(t, "rise"), (cta, "rise"), (img, "fade"), (hint, "fade")],
            start_delay=300)
    notes(s13, "The QR is real and resolves to the signup page — let them scan it "
               "off the screen.")

    # ── Wire the interactivity now that every slide exists ───────────────────
    for btn in menu_buttons:
        btn.click_action.target_slide = s2
    for tile, key in zip(tiles, ["01", "02", "03", "04", "05"]):
        tile.click_action.target_slide = sections[key]

    prs.save(OUT)
    return prs


def slide_dot(slide, left, top):
    """A small dark numbered circle used in the step lists."""
    dot = slide.shapes.add_shape(MSO_SHAPE.OVAL, left, top, Inches(0.42), Inches(0.42))
    dot.fill.solid()
    dot.fill.fore_color.rgb = INK
    dot.line.fill.background()
    dot.shadow.inherit = False
    return dot


if __name__ == "__main__":
    prs = build()
    print(f"wrote {OUT}  ({len(prs.slides.__iter__.__self__._sldIdLst)} slides)")
