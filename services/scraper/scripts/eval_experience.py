"""Eval harness for the experience extractor.

Run it before and after ANY change to utils/experience.py, role_aliases.py
or the ai_extract prompt:

    python -m scripts.eval_experience                 # fixtures only
    python -m scripts.eval_experience --from-db 200   # sample real rows too

Without this you cannot tell whether a regex tweak helped or hurt. The
failure mode that motivated this whole workstream — the old query-time
pattern quietly classifying senior postings as fresher — is invisible in
manual spot-checks precisely because the filter still RETURNS results. It
returns the wrong ones, confidently. A scored fixture set is the only thing
that catches that class of bug.

The metric that matters most is FRESHER PRECISION: of everything we label
fresher, what fraction really is. A fresher-first product that surfaces
5-year roles to graduates is worse than one that surfaces fewer jobs.
"""

from __future__ import annotations

import argparse
import sys
from collections import Counter

sys.path.insert(0, ".")

from utils.experience import extract_experience  # noqa: E402

# (title, description, expected_band). Extend this whenever a real posting
# is misclassified — a regression fixture is cheaper than re-debugging the
# same phrasing twice.
FIXTURES: list[tuple[str, str | None, str]] = [
    # --- title-only (the stub case the old query-time filter could not see)
    ("Software Engineer Intern", None, "fresher"),
    ("Graduate Engineer Trainee", None, "fresher"),
    ("SDE-1", None, "fresher"),
    ("SDE 2", None, "junior"),
    ("Junior Python Developer", None, "junior"),
    ("Senior Backend Engineer", None, "senior"),
    ("Principal Architect", None, "lead"),
    ("Engineering Manager", None, "lead"),
    ("Software Developer", None, "unknown"),
    # --- phrasings the old EXPERIENCE_PATTERN could not match at all
    ("Backend Developer", "5+ years of hands-on experience with Go and Python.", "senior"),
    ("Backend Developer", "3 years' experience building REST APIs.", "mid"),
    ("Data Engineer", "Experience: 4+ years in data pipelines.", "mid"),
    ("QA Engineer", "Minimum 3 year exp in automation required.", "mid"),
    ("Analyst", "5-7 years in financial modelling.", "senior"),
    ("DevOps Engineer", "atleast 8 years experience running production systems.", "lead"),
    ("Frontend Developer", "Qualifications:\n2-4 years of experience in React.", "junior"),
    ("Mobile Developer", "6 months to 2 years of experience with Flutter.", "fresher"),
    # --- the false-positive traps
    ("Software Developer", "We have served customers for 20 years. Apply today!", "unknown"),
    ("Support Engineer", "A 15 year old company with a 2 year bond.", "unknown"),
    ("Java Developer", "Founded 12 years ago.\nRequirements:\n0-1 years experience.", "fresher"),
    # --- title vs description conflicts (the reconciliation rules)
    ("Software Engineer Intern", "Our engineers typically have 10+ years of experience.", "fresher"),
    ("Senior Data Scientist", "Freshers may apply to our graduate programme separately.", "senior"),
    ("Senior Software Engineer", "5+ years of experience required.", "senior"),
    # --- fresher phrasing without any number
    ("Full Stack Developer", "Freshers welcome. No prior experience required.", "fresher"),
    ("Marketing Executive", "2025 batch pass outs preferred. Campus hiring drive.", "fresher"),
    ("Business Analyst", "Final year students may apply.", "fresher"),
    # --- word numbers
    ("Product Designer", "Two years of relevant experience in product design.", "junior"),
    # --- boundary values (these are where an inclusive/exclusive slip shows)
    ("Engineer A", "1 year of experience required.", "fresher"),
    ("Engineer B", "3 years of experience required.", "mid"),
    ("Engineer C", "5 years of experience required.", "senior"),
    ("Engineer D", "8 years of experience required.", "lead"),
]


def run_fixtures(verbose: bool = True) -> tuple[int, int]:
    passed = 0
    for title, description, expected in FIXTURES:
        signal = extract_experience(title, description)
        ok = signal.band == expected
        passed += ok
        if verbose and not ok:
            print(
                f"  FAIL  {title!r}\n"
                f"        expected={expected}  got={signal.band}  "
                f"min={signal.min_years} src={signal.source} evidence={signal.evidence!r}"
            )
    return passed, len(FIXTURES)


def run_against_db(limit: int) -> None:
    """Unlabeled sanity sweep over real rows. Cannot measure accuracy
    without labels, but it surfaces the two shapes that always signal
    trouble: an implausible band distribution (if 'fresher' is >50% of your
    inventory, something is over-matching, which is exactly how the old
    filter failed), and a coverage collapse."""
    from db.repository import connect

    conn = connect()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT title, description FROM jobs WHERE is_active = true "
                "ORDER BY random() LIMIT %(limit)s",
                {"limit": limit},
            )
            rows = cur.fetchall()
    finally:
        conn.close()

    bands = Counter()
    sources = Counter()
    for row in rows:
        signal = extract_experience(row["title"], row["description"])
        bands[signal.band] += 1
        sources[signal.source] += 1

    total = len(rows) or 1
    print(f"\nSampled {len(rows)} live postings")
    print("  band distribution:")
    for band, count in bands.most_common():
        print(f"    {band:9} {count:5}  {count / total:6.1%}")
    print("  resolved by:")
    for source, count in sources.most_common():
        print(f"    {source:12} {count:5}  {count / total:6.1%}")
    unknown = bands["unknown"] / total
    print(f"\n  coverage (non-unknown): {1 - unknown:.1%}  <- this is what the LLM pass has to close")
    if bands["fresher"] / total > 0.5:
        print("  ⚠️  fresher is >50% of the sample — check for over-matching before shipping")


def main() -> int:
    parser = argparse.ArgumentParser(description="Evaluate the experience extractor.")
    parser.add_argument("--from-db", type=int, default=0, metavar="N",
                        help="also sample N random live postings for a distribution check")
    args = parser.parse_args()

    print("Fixture set:")
    passed, total = run_fixtures()
    print(f"\n  {passed}/{total} passed ({passed / total:.0%})")

    if args.from_db:
        run_against_db(args.from_db)

    return 0 if passed == total else 1


if __name__ == "__main__":
    raise SystemExit(main())
