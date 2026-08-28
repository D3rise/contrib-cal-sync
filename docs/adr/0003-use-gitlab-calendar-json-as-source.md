# Use GitLab calendar.json as the contribution source

The Source Account's `calendar.json` response is the authoritative input and must be an object whose ISO calendar dates map to non-negative integer Daily Contribution Counts, for example `{"2026-08-28": 1}`. The documented GitLab Events API is not used as a fallback because reconstructing counts from events can diverge from the profile calendar; an incompatible response instead fails explicitly.
