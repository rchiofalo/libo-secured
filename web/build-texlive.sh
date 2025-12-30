#!/bin/bash
# Bundle TeX Live packages into JavaScript for SwiftLaTeX
# This avoids HTTP fetching issues and works fully offline

OUTPUT="web/js/texlive-packages.js"

echo "/**" > "$OUTPUT"
echo " * TeX Live Packages for SwiftLaTeX Browser Compilation" >> "$OUTPUT"
echo " * Auto-generated - DO NOT EDIT" >> "$OUTPUT"
echo " * Generated: $(date)" >> "$OUTPUT"
echo " */" >> "$OUTPUT"
echo "" >> "$OUTPUT"
echo "const TEXLIVE_PACKAGES = {" >> "$OUTPUT"

# Function to add a file
add_file() {
    local filepath="$1"
    local key="$2"
    
    if [ -f "$filepath" ]; then
        echo "  '$key': \`" >> "$OUTPUT"
        # Escape backticks and backslashes for JS template literal
        sed 's/\\/\\\\/g; s/`/\\`/g; s/\$/\\$/g' "$filepath" >> "$OUTPUT"
        echo "\`," >> "$OUTPUT"
        echo "  Added: $key"
    fi
}

# Add all .cls files (document classes)
for f in web/lib/texlive/pdftex/26/*.cls; do
    [ -f "$f" ] && add_file "$f" "$(basename "$f")"
done

# Add all .clo files (class options)  
for f in web/lib/texlive/pdftex/26/*.clo; do
    [ -f "$f" ] && add_file "$f" "$(basename "$f")"
done

# Add all .sty files (style packages)
for f in web/lib/texlive/pdftex/27/*.sty; do
    [ -f "$f" ] && add_file "$f" "$(basename "$f")"
done

# Add all .def files
for f in web/lib/texlive/pdftex/32/*.def; do
    [ -f "$f" ] && add_file "$f" "$(basename "$f")"
done

# Add .fd files (font definitions)
for f in web/lib/texlive/pdftex/28/*.fd; do
    [ -f "$f" ] && add_file "$f" "$(basename "$f")"
done

# Add .cfg files
for f in web/lib/texlive/pdftex/10/*.cfg; do
    [ -f "$f" ] && add_file "$f" "$(basename "$f")"
done

echo "};" >> "$OUTPUT"
echo "" >> "$OUTPUT"
echo "// Font metrics (binary - base64 encoded)" >> "$OUTPUT"
echo "const TEXLIVE_FONTS = {" >> "$OUTPUT"

# Add font metrics as base64
for f in web/lib/texlive/pdftex/3/*; do
    if [ -f "$f" ] && [[ ! "$f" == *.tfm ]]; then
        basename=$(basename "$f")
        echo "  '$basename': '$(base64 < "$f" | tr -d '\n')'," >> "$OUTPUT"
        echo "  Added font: $basename"
    fi
done

echo "};" >> "$OUTPUT"

echo ""
echo "Generated $OUTPUT"
