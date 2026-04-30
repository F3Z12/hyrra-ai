"""
Keyword extraction — frequency-based with stop word filtering.

Extracts the most notable terms from job text by word frequency,
filtering out common English stop words and short fragments.
"""

import re


# Common English stop words + job posting boilerplate terms
_STOP_WORDS = {
    "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
    "of", "with", "by", "from", "is", "are", "was", "were", "be", "been",
    "being", "have", "has", "had", "do", "does", "did", "will", "would",
    "shall", "should", "may", "might", "can", "could", "this", "that",
    "these", "those", "it", "its", "you", "your", "we", "our", "they",
    "their", "them", "as", "if", "not", "no", "all", "any", "each",
    "such", "than", "too", "very", "also", "about", "up", "out", "so",
    "what", "which", "who", "whom", "how", "when", "where", "while",
    "into", "through", "during", "before", "after", "above", "below",
    "between", "under", "over", "again", "further", "then", "once",
    "here", "there", "some", "more", "most", "other", "only", "own",
    "same", "just", "because", "both", "few", "many", "much", "well",
    "still", "already", "since", "like", "make", "work", "new", "use",
    "one", "two", "way", "need", "know", "look", "time", "year", "per",
    "within", "across", "including", "ability", "strong", "experience",
    "working", "using", "based", "related", "etc", "role", "join",
    "team", "company", "position", "candidate", "candidates", "ideal",
    "able", "ensure", "help", "part", "must", "required", "preferred",
}


def extract_keywords(job_text: str, limit: int = 15) -> list[str]:
    """
    Extract notable keywords from job text using word frequency.

    Filters out stop words and very short terms. Returns the top N
    most frequent meaningful words.

    Args:
        job_text: The job posting text (will be lowercased internally).
        limit: Maximum number of keywords to return (default 15).

    Returns:
        List of keyword strings, ordered by frequency (most frequent first).
    """
    text_lower = job_text.lower()
    words = re.findall(r"[a-z][a-z+#.]+", text_lower)

    freq: dict[str, int] = {}
    for w in words:
        if w not in _STOP_WORDS and len(w) >= 3:
            freq[w] = freq.get(w, 0) + 1

    sorted_words = sorted(freq.items(), key=lambda x: x[1], reverse=True)
    return [word for word, _ in sorted_words[:limit]]
