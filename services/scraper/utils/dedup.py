import hashlib
import re

_SUFFIXES = (" inc", " inc.", " ltd", " ltd.", " llc", " llc.", " corp", " corp.")


def normalize(value: str | None) -> str:
    if not value:
        return ""
    text = value.strip().lower()
    text = re.sub(r"[^\w\s]", "", text)
    text = re.sub(r"\s+", " ", text).strip()
    for suffix in _SUFFIXES:
        stripped_suffix = suffix.replace(".", "")
        if text.endswith(stripped_suffix):
            text = text[: -len(stripped_suffix)].strip()
            break
    return text


def make_dedup_key(company: str, title: str, location: str | None) -> str:
    parts = "|".join(
        [normalize(company), normalize(title), normalize(location) or "remote"]
    )
    return hashlib.sha256(parts.encode("utf-8")).hexdigest()


# Contests dedup on (platform, source_url) rather than jobs' fuzzy
# (company, title, location) match — a contest has one canonical URL per
# platform, unlike jobs which get re-posted with slightly different
# wording across many boards. No trigram fuzzy-match fallback needed.
def make_contest_dedup_key(platform: str, source_url: str) -> str:
    parts = "|".join([normalize(platform), normalize(source_url)])
    return hashlib.sha256(parts.encode("utf-8")).hexdigest()
