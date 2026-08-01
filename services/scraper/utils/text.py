import re

from bs4 import BeautifulSoup

# A blanket `\n` separator between every tag boundary (the previous
# implementation) is fine for short, plain content but mangles anything
# with inline formatting: `<code>x</code> = <code>y</code>` gets split
# into three separate lines ("x", "=", "y") instead of reading as one
# line. Live-confirmed on a real dev.to post's code-heavy prose — the
# saved description came back as one token per line, unreadable. Only
# insert a separator BETWEEN block-level elements; text within a block
# (including any inline tags it contains) is extracted with no separator
# so inline content concatenates naturally.
_BLOCK_TAGS = ["p", "div", "li", "h1", "h2", "h3", "h4", "h5", "h6", "pre", "blockquote"]


def strip_html(html: str | None) -> str | None:
    if not html:
        return None
    soup = BeautifulSoup(html, "html.parser")
    # A wrapper like <blockquote><p>...</p></blockquote> matches both tags —
    # counting both would duplicate that text. Keep only "leaf" blocks (no
    # nested block-tag descendant of their own).
    blocks = [b for b in soup.find_all(_BLOCK_TAGS) if not b.find(_BLOCK_TAGS)]
    if blocks:
        parts = [b.get_text().strip() for b in blocks]
        text = "\n\n".join(p for p in parts if p)
    else:
        text = soup.get_text(separator=" ").strip()
    text = re.sub(r"\n{3,}", "\n\n", text).strip()
    return text or None


# LinkedIn's description container has a "Show more"/"Show less" toggle
# button living inside the same element the description text is scraped
# from (div.description__text) — inner_text() has no way to exclude just
# that button, so its label ends up baked into the saved description as
# trailing text that looks like a live UI control but is actually inert
# scraped text. Strip it off after extraction instead.
_TRAILING_TOGGLE_RE = re.compile(r"\s*(show more|show less|see more|see less)\s*$", re.IGNORECASE)


def strip_trailing_toggle(text: str | None) -> str | None:
    if not text:
        return text
    return _TRAILING_TOGGLE_RE.sub("", text).strip() or None


# U+FFFD ("�") shows up in scraped text when a *source site's own backend*
# mis-transcoded a character (e.g. Windows-1252 bytes re-encoded as UTF-8)
# before ever serving it to us — live-confirmed on talentd.in, where the
# replacement character is already baked into the raw JSON payload their
# Next.js page embeds server-side, not introduced by anything in our
# pipeline (Playwright/httpx both decode correctly; the bytes we receive
# are already corrupted). The original character is unrecoverable at that
# point, so this can only clean up the display, not restore the source
# text: collapse a run of one or more U+FFFD (with optional surrounding
# whitespace) into a single plain hyphen, since in every confirmed case so
# far it stood in for an en/em dash acting as a separator.
_REPLACEMENT_CHAR_RE = re.compile(r"\s*�+\s*")


def clean_replacement_chars(text: str | None) -> str | None:
    if not text:
        return text
    return _REPLACEMENT_CHAR_RE.sub(" - ", text).strip() or None
