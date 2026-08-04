#!/usr/bin/env bash
# POE2 Challenge HTML fetch — example/stub
#
# Status: SCAFFOLD. Verify URL khi POE2 0.5 live (~29/05/2026).
# Skill agentic — không gọi script này tự động. Đây là reference snippet
# cho agent copy-paste vào Playwriter session khi cần.
#
# Usage: rerun bằng playwriter trực tiếp (xem SKILL.md Step 1), không
# pipe shell script — Playwriter cần session id của project hiện tại.

# TODO khi POE2 0.5 live:
# 1. Login pathofexile.com trong Chrome (account hopthuxacnhan-3062)
# 2. Navigate tới challenge page POE2 manually, copy URL chính xác từ browser bar
# 3. Update URL_POE2 dưới đây nếu khác assumption
# 4. Verify .achievement-list / .achievement-container selector vẫn match POE2 markup
#    (POE2 có thể redesign UI — check DOM trong DevTools)

ACCOUNT="hopthuxacnhan-3062"

# Assumption (MEDIUM confidence — verify khi live):
URL_POE2="https://www.pathofexile.com/account/view-profile/${ACCOUNT}/challenges?game=poe2"

# Alternative URL candidate (nếu assumption trên fail):
# URL_POE2_ALT="https://www.pathofexile.com/poe2/account/view-profile/${ACCOUNT}/challenges"

cat <<EOF
[fetch-html.example.sh] This is a stub. Run Playwriter snippet from SKILL.md Step 1 directly:

playwriter -s <session-id> --timeout 60000 -e "<JS from SKILL.md>"

Verify URL when 0.5 launches:
  ${URL_POE2}

Output file: tmp/challenges-poe2.html
EOF
