#!/usr/bin/env python3
"""Normalise paper venues in data/papers.json.

For every paper this sets
  venue        the full venue name (filled in when missing, from the ACL Anthology ID,
               an arXiv URL, or the BibTeX journal/booktitle; vague labels such as
               "ACL 2023" or "Conf/Journal 2024" are replaced the same way), and
  venue_short  a merged label used for display and filtering, e.g. "EMNLP",
               "ACL Findings", "LREC", "VarDial", "arXiv", or the journal name.

Re-runnable: run it after adding papers.

    python3 tools/venues.py            # rewrite data/papers.json
    python3 tools/venues.py --check    # only report, change nothing
"""
import json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PAPERS = ROOT / "data/papers.json"

# ACL Anthology event code -> (short label, full name). Full name gets the year appended.
ANTHOLOGY = {
    "acl": ("ACL", "Annual Meeting of the Association for Computational Linguistics (ACL)"),
    "emnlp": ("EMNLP", "Conference on Empirical Methods in Natural Language Processing (EMNLP)"),
    "naacl": ("NAACL", "Conference of the North American Chapter of the ACL (NAACL)"),
    "eacl": ("EACL", "Conference of the European Chapter of the ACL (EACL)"),
    "aacl": ("AACL-IJCNLP", "AACL-IJCNLP"),
    "ijcnlp": ("AACL-IJCNLP", "IJCNLP-AACL"),
    "findings-acl": ("ACL Findings", "Findings of the ACL: ACL"),
    "findings-emnlp": ("EMNLP Findings", "Findings of the ACL: EMNLP"),
    "findings-naacl": ("NAACL Findings", "Findings of the ACL: NAACL"),
    "findings-eacl": ("EACL Findings", "Findings of the ACL: EACL"),
    "coling": ("COLING", "International Conference on Computational Linguistics (COLING)"),
    "lrec": ("LREC", "Language Resources and Evaluation Conference (LREC)"),
    "lrec-main": ("LREC-COLING", "LREC-COLING"),
    "tacl": ("TACL", "Transactions of the Association for Computational Linguistics"),
    "cl": ("Computational Linguistics", "Computational Linguistics"),
    "semeval": ("SemEval", "International Workshop on Semantic Evaluation (SemEval)"),
    "wmt": ("WMT", "Conference on Machine Translation (WMT)"),
    "iwslt": ("IWSLT", "International Conference on Spoken Language Translation (IWSLT)"),
    "ranlp": ("RANLP", "Recent Advances in Natural Language Processing (RANLP)"),
    "paclic": ("PACLIC", "Pacific Asia Conference on Language, Information and Computation (PACLIC)"),
    "starsem": ("*SEM", "Joint Conference on Lexical and Computational Semantics (*SEM)"),
    "gwc": ("GWC", "Global WordNet Conference (GWC)"),
    "icnlsp": ("ICNLSP", "International Conference on Natural Language and Speech Processing (ICNLSP)"),
    "silkroadnlp": ("SilkRoadNLP", "First Workshop on NLP and LLMs for the Iranian Language Family (SilkRoadNLP)"),
    "abjadnlp": ("AbjadNLP", "Workshop on NLP for Languages Using Arabic Script (AbjadNLP)"),
    "vardial": ("VarDial", "Workshop on NLP for Similar Languages, Varieties and Dialects (VarDial)"),
    "nsurl": ("NSURL", "Workshop on NLP Solutions for Under-Resourced Languages (NSURL)"),
    "sltu": ("SLTU", "Workshop on Spoken Language Technologies for Under-resourced Languages (SLTU)"),
    "sigul": ("SIGUL", "Workshop on Resources and Technologies for Indigenous, Endangered and Lesser-resourced Languages (SIGUL)"),
    "loreslm": ("LoResLM", "Workshop on Language Models for Low-Resource Languages (LoResLM)"),
    "eurali": ("EURALI", "Workshop on Resources and Technologies for Eurasian Languages (EURALI)"),
    "fieldmatters": ("Field Matters", "Field Matters Workshop"),
    "nlp4dh": ("NLP4DH", "Workshop on NLP for Digital Humanities (NLP4DH)"),
    "lm4dh": ("LM4DH", "Workshop on Language Models for Digital Humanities (LM4DH)"),
    "nlpcovid19": ("NLP-COVID19", "Workshop on NLP for COVID-19"),
    "wnut": ("W-NUT", "Workshop on Noisy and User-generated Text (W-NUT)"),
    "gem": ("GEM", "Workshop on Generation, Evaluation and Metrics (GEM)"),
    "winlp": ("WiNLP", "Widening NLP Workshop (WiNLP)"),
    "evalmg": ("EvalMG", "Workshop on Multilingual Generation Evaluation (EvalMG)"),
    "eval4nlp": ("Eval4NLP", "Workshop on Evaluation and Comparison of NLP Systems (Eval4NLP)"),
    "signlang": ("SignLang", "Workshop on the Representation and Processing of Sign Languages"),
    "alp": ("ALP", "Workshop on Ancient Language Processing (ALP)"),
    "cawl": ("CAWL", "Workshop on Computation and Written Language (CAWL)"),
    "umrpw": ("UMR", "Uniform Meaning Representation Workshop"),
    "clssts": ("CLSSTS", "Workshop on Computational Linguistics for Spoken and Sign Language"),
    "nlposs": ("NLP-OSS", "Workshop for NLP Open Source Software (NLP-OSS)"),
}
# Old-style IDs (P13-2054): letter -> event code
OLD_IDS = {"P": "acl", "D": "emnlp", "N": "naacl", "E": "eacl", "C": "coling", "L": "lrec", "Q": "tacl", "J": "cl", "S": "semeval"}

# Regex on the venue string -> short label. First match wins.
RULES = [
    (r"findings of the (association for computational linguistics|acl)\W+(acl|emnlp|naacl|eacl|aacl)", lambda m: f"{m[2].upper()} Findings"),
    (r"silk ?road|iranian language family", "SilkRoadNLP"),
    (r"languages using arabic script|abjadnlp", "AbjadNLP"),
    (r"semeval|semantic evaluation", "SemEval"),
    (r"spoken language translation|iwslt", "IWSLT"),
    (r"\bvardial\b|similar languages, varieties", "VarDial"),
    (r"lrec[- ]coling|joint international conference on computational linguistics, language resources", "LREC-COLING"),
    (r"language resources and evaluation conference|^lrec\b|\(lrec \d{4}\)", "LREC"),
    (r"empirical methods in natural language processing|^emnlp\b", "EMNLP"),
    (r"north american chapter|nations of the americas|^naacl\b", "NAACL"),
    (r"european chapter of the association|^eacl\b", "EACL"),
    (r"asia-pacific chapter|\bijcnlp\b|\baacl\b", "AACL-IJCNLP"),
    (r"annual meeting of the association for computational linguistics|^acl\b", "ACL"),
    (r"^transactions of the association for computational linguistics", "TACL"),
    (r"computational linguistics \(coling\)|international conference on computational linguistics|^coling\b", "COLING"),
    (r"acm trans(actions|\.) (on )?asian (and )?low", "ACM TALLIP"),
    (r"^interspeech\b", "Interspeech"),
    (r"^aro\W+the scientific journal of koya", "ARO (Koya University)"),
    (r"neurips|neural information processing systems", "NeurIPS"),
    (r"^(researchgate\.net|academia\.edu)$", None),  # hosting sites, not venues
    (r"\((WeCNLP)\)", lambda m: m[1]),
    (r"arxiv", "arXiv"),
    (r"ssrn", "SSRN"),
    (r"research ?square", "Research Square"),
    (r"preprints\.org", "Preprints.org"),
    (r"\b(ICDAR)\b", lambda m: m[1]),
    (r"\(([A-Z][A-Za-z]*[A-Z]{2,}[A-Za-z]*)\)\s*$", lambda m: m[1]),  # "... Conference ... (ICCKE)"
]
VAGUE = re.compile(r"^(ACL|LREC|EMNLP|NAACL|EACL|COLING|IEEE|Conf/Journal|arXiv) \d{4}$|^Journal Name$", re.I)

# A few papers have only a vague label and a URL that names the journal.
URL_VENUES = [
    (r"link\.springer\.com/article/10\.1007/s11042-", "Multimedia Tools and Applications"),
    (r"sciencedirect\.com/science/article/(abs/)?pii/S08852308", "Computer Speech & Language"),
    (r"academic\.oup\.com/dsh/", "Digital Scholarship in the Humanities"),
    (r"jad\.shahroodut\.ac\.ir", "Journal of AI and Data Mining"),
    (r"preprints\.org", "Preprints.org"),
    (r"ieeexplore\.ieee\.org", "IEEE"),
]
# Corrections to the venue string itself, by paper title prefix.
TITLE_FIXES = {
    "GlotScript: A Resource and Tool for Script Identification": "LREC-COLING 2024",
}


def anthology(p):
    urls = " ".join([p.get("url") or ""] + [u for u in (p.get("links") or {}).values() if u])
    m = re.search(r"(?:aclanthology\.org|aclweb\.org/anthology)/(\d{4})\.([a-z0-9]+(?:-[a-z]+)?)-", urls)
    if m:
        year, code = m[1], m[2]
        if code not in ANTHOLOGY and "-" in code:   # e.g. ranlp-srw, acl-long
            code = code.split("-")[0] if code.split("-")[0] in ANTHOLOGY else code
        return code, year
    m = re.search(r"(?:aclanthology\.org|aclweb\.org/anthology)/([A-Z])(\d{2})-", urls)
    if m and m[1] in OLD_IDS:
        yy = int(m[2])
        return OLD_IDS[m[1]], str(1900 + yy if yy > 50 else 2000 + yy)
    return None, None


def bib_field(p, *names):
    b = p.get("bibtex") or ""
    for n in names:
        m = re.search(rf"\b{n}\s*=\s*[{{\"](.+?)[}}\"]\s*,?\s*\n", b, re.I | re.S)
        if m:
            return re.sub(r"\s+", " ", m[1].replace("{", "").replace("}", "").replace("\\&", "&")).strip()
    return None


def short_of(venue):
    for pat, out in RULES:
        case_sensitive = pat.startswith(r"\([A-Z]") or "ICDAR" in pat
        m = re.search(pat, venue, 0 if case_sensitive else re.I)
        if m:
            return out(m) if callable(out) else out
    v = re.sub(r"^(The )?Proceedings of (the )?", "", venue).replace("\\", "").strip()
    v = re.sub(r"\s*\(\d{4}-\d{4}\)$", "", v)  # ISSN tail
    v = re.sub(r"\s+\d{4}$", "", v)                # trailing year
    if v.isupper() and len(v) > 12:                  # SHOUTED JOURNAL NAMES
        v = " ".join(w if len(w) <= 3 and "-" not in w else w.capitalize() for w in v.title().split())
        v = re.sub(r"\b(Of|The|And|In|For|On)\b", lambda m: m[1].lower(), v)
    return v[:1].upper() + v[1:]


def normalise(p):
    venue = (p.get("venue") or "").strip()
    for prefix, fixed in TITLE_FIXES.items():
        if p["title"].startswith(prefix):
            venue = fixed
    code, year = anthology(p)
    if code == "lrec" and year == "2024":
        code = "lrec-main"
    if code in ANTHOLOGY:
        short, full = ANTHOLOGY[code]
        if not venue or VAGUE.match(venue):
            venue = f"{full} {year}" if not full.endswith(year) else full
        # The anthology ID is authoritative for the short label
        return venue, short
    urls = " ".join([p.get("url") or ""] + [u for u in (p.get("links") or {}).values() if u])
    if not venue or VAGUE.match(venue):
        if re.search(r"arxiv\.org", urls) and not re.search(r"(journal|booktitle)\s*=", p.get("bibtex") or "", re.I):
            venue = "arXiv"
        else:
            found = next((name for pat, name in URL_VENUES if re.search(pat, urls)), None)
            venue = bib_field(p, "journal", "booktitle") or found or ("arXiv" if "arxiv.org" in urls else venue)
            if venue and VAGUE.match(venue):
                venue = found or ""
    if not venue:
        return None, None
    return venue, short_of(venue)


def main():
    check = "--check" in sys.argv
    papers = json.loads(PAPERS.read_text())
    changed = 0
    for p in papers:
        venue, short = normalise(p)
        if venue != p.get("venue") or short != p.get("venue_short"):
            changed += 1
            if check:
                print(f"{p['id']}: {p.get('venue')!r} -> {venue!r} [{short}]")
        p["venue"], p["venue_short"] = venue, short
    # keep venue_short right after venue in each record
    papers = [{k2: v2 for k, v in p.items() if k != "venue_short"
               for k2, v2 in ([(k, v), ("venue_short", p["venue_short"])] if k == "venue" else [(k, v)])} for p in papers]
    if not check:
        PAPERS.write_text(json.dumps(papers, ensure_ascii=False, indent=2) + "\n")
    missing = sum(1 for p in papers if not p.get("venue_short"))
    print(f"{changed} papers updated, {missing} without a venue", file=sys.stderr)


if __name__ == "__main__":
    main()
