#!/bin/bash
# Fetch PoE build data from mobalytics.gg (PoE 1 and PoE 2)
# Usage: ./fetch.sh [--poe1] <url-or-slug>
# Output: YAML formatted build data (PoE 2) or pobCode + metadata (PoE 1)

set -e

# Parse flags
FORCE_POE1=false
while [[ "$1" == --* ]]; do
  case "$1" in
    --poe1) FORCE_POE1=true; shift ;;
    *) echo "Unknown flag: $1" >&2; exit 1 ;;
  esac
done

INPUT="$1"
if [ -z "$INPUT" ]; then
  echo "Usage: $0 [--poe1] <mobalytics-url-or-slug>" >&2
  exit 1
fi

# Detect game version from URL
GAME_VERSION="poe2"
if [[ "$INPUT" == *"mobalytics.gg/poe/builds/"* ]] || [ "$FORCE_POE1" = true ]; then
  GAME_VERSION="poe1"
elif [[ "$INPUT" == *"mobalytics.gg/poe-2/builds/"* ]]; then
  GAME_VERSION="poe2"
fi

# Extract slug from URL or use as-is
if [[ "$INPUT" == *"mobalytics.gg"* ]]; then
  SLUG=$(echo "$INPUT" | sed -E 's|.*/poe(-2)?/builds/([^/?]+).*|\2|')
else
  SLUG="$INPUT"
fi

# === PoE 1: Extract pobCode from HTML ===
if [ "$GAME_VERSION" = "poe1" ]; then
  echo "=== Fetching PoE 1 build from mobalytics.gg ===" >&2

  HTML=$(curl -s "$INPUT" -H "user-agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36")

  # Extract pobCode from embedded __NEXT_DATA__ JSON
  POB_CODE=$(echo "$HTML" | sed -n 's/.*"pobCode":"\([^"]*\)".*/\1/p' | head -1)

  if [ -z "$POB_CODE" ]; then
    echo "ERROR: Could not extract pobCode from page HTML" >&2
    exit 1
  fi

  # Try to extract metadata from __NEXT_DATA__
  BUILD_NAME=$(echo "$HTML" | sed -n 's/.*"name":"\([^"]*\)".*"pobCode".*/\1/p' | head -1)
  AUTHOR=$(echo "$HTML" | sed -n 's/.*"author":{"name":"\([^"]*\)".*/\1/p' | head -1)

  # Output as YAML
  echo "game: poe1"
  echo "name: ${BUILD_NAME:-unknown}"
  echo "author: ${AUTHOR:-unknown}"
  echo "slug: $SLUG"
  echo "pobCode: |"
  echo "  $POB_CODE"
  exit 0
fi

# === PoE 2: GraphQL API ===

# GraphQL query - optimized for essential build data
read -r -d '' QUERY << 'EOF' || true
query Poe2UgFeaturedDocumentQuery($input: Poe2UserGeneratedDocumentInputBySlug!) {
  game: poe2 {
    documents {
      userGeneratedDocumentBySlug(input: $input) {
        error
        data {
          id
          slugifiedName
          data {
            name
            pobCode
            buildVariants {
              values {
                id
                equipment {
                  mainHand { set1 { commonItem { name slug isUnique } providedSkill { name gemSlug } } set2 { commonItem { name slug isUnique } providedSkill { name gemSlug } } }
                  offHand { set1 { commonItem { name slug isUnique } } set2 { commonItem { name slug isUnique } } }
                  helmet { commonItem { name slug isUnique } }
                  body { commonItem { name slug isUnique } }
                  gloves { commonItem { name slug isUnique } }
                  boots { commonItem { name slug isUnique } }
                  amulet { commonItem { name slug isUnique } }
                  leftRing { commonItem { name slug isUnique } }
                  rightRing { commonItem { name slug isUnique } }
                  belt { commonItem { name slug isUnique } }
                  flask1 { commonItem { name slug isUnique } }
                  flask2 { commonItem { name slug isUnique } }
                  charm1 { commonItem { name slug isUnique } }
                  charm2 { commonItem { name slug isUnique } }
                  charm3 { commonItem { name slug isUnique } }
                }
                skillGems {
                  gems {
                    activeSkill { name gemSlug }
                    subSkills { gemSlug gemType }
                    weaponSet
                  }
                }
                passiveTree {
                  mainTree { selectedSlugs }
                  ascendancyTree { selectedSlugs }
                }
              }
            }
          }
          tags {
            data { groupSlug name slug }
          }
          author { name }
          content {
            __typename
            ... on NgfDocumentCmWidgetRichTextSimplifiedV1 {
              data { title optionalContent: content }
            }
            ... on NgfDocumentCmWidgetRichTextSimplifiedV2 {
              data { title simplifiedContent: content { value } }
            }
            ... on NgfDocumentCmWidgetStrengthsAndWeaknessesV1 {
              data { strengths { value } weaknesses { value } }
            }
          }
        }
      }
    }
  }
}
EOF

# Escape query for JSON
QUERY_ESCAPED=$(echo "$QUERY" | tr '\n' ' ' | sed 's/"/\\"/g')

# Build request body
REQUEST_BODY=$(cat << BODY
{"operationName":"Poe2UgFeaturedDocumentQuery","variables":{"input":{"slug":"$SLUG","type":"builds","widgetsOverride":[]}},"query":"$QUERY_ESCAPED"}
BODY
)

# Fetch data
RESPONSE=$(curl -s "https://mobalytics.gg/api/poe-2/v1/graphql/query" \
  -H "accept: */*" \
  -H "content-type: application/json" \
  -H "x-moba-client: mobalytics-web" \
  -H "x-moba-proxy-gql-ops-name: Poe2UgFeaturedDocumentQuery" \
  -d "$REQUEST_BODY")

# Check for errors
ERROR=$(echo "$RESPONSE" | jq -r '.data.game.documents.userGeneratedDocumentBySlug.error // empty')
if [ -n "$ERROR" ] && [ "$ERROR" != "null" ]; then
  echo "Error: $ERROR" >&2
  exit 1
fi

# Transform to YAML using jq
# Note: Lexical JSON (rich text) is parsed recursively to extract text nodes
echo "$RESPONSE" | jq -r '
# Helper function to extract text from Lexical JSON format
def extract_text:
  if type == "object" then
    if .type == "text" then .text
    elif .type == "static-data-widget" then .label
    elif .children then [.children[] | extract_text] | join("")
    elif .root then .root | extract_text
    else ""
    end
  elif type == "array" then
    [.[] | extract_text] | join("")
  else ""
  end;

# Helper to extract list items from Lexical
def extract_list_items:
  if type == "object" then
    if .type == "listitem" then [. | extract_text]
    elif .children then [.children[] | extract_list_items] | flatten
    elif .root then .root | extract_list_items
    else []
    end
  elif type == "array" then
    [.[] | extract_list_items] | flatten
  else []
  end;

.data.game.documents.userGeneratedDocumentBySlug.data as $doc |
($doc.data.buildVariants.values[0] // {}) as $variant |

"name: " + ($doc.data.name // "unknown") + "\n" +
"author: " + ($doc.author.name // "unknown") + "\n" +
"slug: " + ($doc.slugifiedName // "unknown") + "\n" +
"pobCode: |\n  " + (($doc.data.pobCode // "") | split("\n") | join("\n  ")) + "\n" +

"tags:\n" + ([$doc.tags.data[]? | "  - group: " + .groupSlug + "\n    name: " + .name + "\n    slug: " + .slug] | join("\n")) + "\n" +

"equipment:\n" + (
  [
    ["mainHand", $variant.equipment.mainHand.set1.commonItem],
    ["mainHand2", $variant.equipment.mainHand.set2.commonItem],
    ["offHand", $variant.equipment.offHand.set1.commonItem],
    ["offHand2", $variant.equipment.offHand.set2.commonItem],
    ["helmet", $variant.equipment.helmet.commonItem],
    ["body", $variant.equipment.body.commonItem],
    ["gloves", $variant.equipment.gloves.commonItem],
    ["boots", $variant.equipment.boots.commonItem],
    ["amulet", $variant.equipment.amulet.commonItem],
    ["leftRing", $variant.equipment.leftRing.commonItem],
    ["rightRing", $variant.equipment.rightRing.commonItem],
    ["belt", $variant.equipment.belt.commonItem],
    ["flask1", $variant.equipment.flask1.commonItem],
    ["flask2", $variant.equipment.flask2.commonItem],
    ["charm1", $variant.equipment.charm1.commonItem],
    ["charm2", $variant.equipment.charm2.commonItem],
    ["charm3", $variant.equipment.charm3.commonItem]
  ] | map(select(.[1] != null)) | map(
    "  " + .[0] + ":\n    name: " + .[1].name + "\n    unique: " + (.[1].isUnique | tostring)
  ) | join("\n")
) + "\n" +

"skills:\n" + (
  [$variant.skillGems.gems[]? |
    "  - active: " + .activeSkill.name + " (" + .activeSkill.gemSlug + ")\n" +
    "    supports:\n" + ([.subSkills[]? | "      - " + .gemSlug] | join("\n"))
  ] | join("\n")
) + "\n" +

"passiveTree:\n" +
"  main: " + (($variant.passiveTree.mainTree.selectedSlugs // []) | length | tostring) + " nodes\n" +
"  ascendancy: " + (($variant.passiveTree.ascendancyTree.selectedSlugs // []) | length | tostring) + " nodes\n" +

"content:\n" + (
  [$doc.content[]? | select(.data != null) |
    if .__typename == "NgfDocumentCmWidgetRichTextSimplifiedV1" then
      "  - type: text\n    title: " + (.data.title // "") + "\n    content: |\n      " + ((.data.optionalContent // "") | gsub("\n"; "\n      "))
    elif .__typename == "NgfDocumentCmWidgetRichTextSimplifiedV2" then
      "  - type: text\n    title: " + (.data.title // "") + "\n    content: |\n      " + ((.data.simplifiedContent.value // {}) | extract_text | gsub("\n"; "\n      "))
    elif .__typename == "NgfDocumentCmWidgetStrengthsAndWeaknessesV1" then
      "  - type: pros_cons\n    strengths:\n" +
        ([(.data.strengths.value // {}) | extract_list_items | .[]? | "      - " + .] | join("\n")) +
        "\n    weaknesses:\n" +
        ([(.data.weaknesses.value // {}) | extract_list_items | .[]? | "      - " + .] | join("\n"))
    else empty end
  ] | join("\n")
)
'
