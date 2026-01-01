# libo-secured

**USMC Correspondence Generator** - A browser-based LaTeX document generator for creating SECNAV M-5216.5 and MCO 5216.20B compliant military correspondence.

> *"Libo isn't secured until the paperwork is done."*

## Features

- **18 Document Types** - Naval letters, MFRs, memorandums, business letters, endorsements, and more
- **SECNAV M-5216.5 Compliant** - Proper formatting per DON Correspondence Manual
- **MCO 5216.20B Compliant** - Marine Corps supplement requirements
- **8-Level Paragraph Nesting** - Full hierarchical paragraph support (1., a., (1), (a), underlined 5-8)
- **Client-Side Only** - All processing in browser, no server communication
- **Offline Capable** - Bundled TeX Live packages for air-gapped operation
- **Enclosure System** - Auto-numbered, hyperlinked PDF enclosures with merge
- **CUI/Classification Support** - Proper markings per DoDI 5200.48
- **Profile System** - Save/load signatory and unit information
- **Reference Library** - 2,100+ military references searchable by SSIC

## Supported Document Types

### Letters
- `naval_letter` - Standard Naval Letter (Ch 2)
- `standard_letter` - Standard Letter on Plain Bond (Ch 2)
- `business_letter` - Business Letter (Ch 11)
- `multiple_address_letter` - Multiple-Address Letter (Ch 8)
- `joint_letter` - Joint Letter (Ch 7)

### Endorsements
- `same_page_endorsement` - Same-Page Endorsement (Ch 9)
- `new_page_endorsement` - New-Page Endorsement (Ch 9)

### Memorandums
- `mfr` - Memorandum for the Record (Ch 10)
- `plain_paper_memorandum` - Plain-Paper Memorandum (Ch 10)
- `letterhead_memorandum` - Letterhead Memorandum (Ch 10)
- `decision_memorandum` - Decision Memorandum (Ch 10)
- `moa` - Memorandum of Agreement (Ch 10)
- `mou` - Memorandum of Understanding (Ch 10)
- `joint_memorandum` - Joint Memorandum (Ch 7)

### Executive Memorandums (HqDON/OSD)
- `standard_memorandum` - Standard Memorandum (Ch 12)
- `action_memorandum` - Action Memorandum (Ch 12)
- `information_memorandum` - Information Memorandum (Ch 12)

### USMC-Specific
- `mf` - "Memorandum For" (MCO 5216.20B)

---

## Architecture

### How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│                        BROWSER (Client-Side)                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │   index.html │───>│    app.js    │───>│ SwiftLaTeX   │       │
│  │   (Form UI)  │    │  (5000+ LOC) │    │  (WASM)      │       │
│  └──────────────┘    └──────────────┘    └──────────────┘       │
│         │                   │                   │                │
│         v                   v                   v                │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │ localStorage │    │ latex-       │    │   PDF        │       │
│  │ (Draft Save) │    │ templates.js │    │   Output     │       │
│  └──────────────┘    └──────────────┘    └──────────────┘       │
│                             │                   │                │
│                             v                   v                │
│                      ┌──────────────┐    ┌──────────────┐       │
│                      │ TeX Live     │    │   pdf-lib    │       │
│                      │ (Bundled)    │    │ (PDF Merge)  │       │
│                      └──────────────┘    └──────────────┘       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ NO NETWORK CALLS
                              v
                    ┌─────────────────┐
                    │  Downloaded PDF │
                    └─────────────────┘
```

### Key Components

| Component | File | Description |
|-----------|------|-------------|
| **UI** | `web/index.html` | Form interface, document type selector |
| **Logic** | `web/js/app.js` | 145+ functions, form handling, LaTeX generation |
| **Templates** | `web/js/latex-templates.js` | Auto-generated from `tex/*.tex` files |
| **Styles** | `web/css/styles.css` | Responsive UI styling |
| **Engine** | SwiftLaTeX | PdfTeX compiled to WebAssembly |
| **PDF Merge** | pdf-lib | Client-side PDF manipulation |

### Data Flow

1. **User Input** → Form fields collected by `collectData()`
2. **LaTeX Generation** → Dynamic `.tex` files created:
   - `document.tex` - Document type, SSIC, From/To
   - `letterhead.tex` - Unit information
   - `body.tex` - Paragraph content with hierarchical numbering
   - `references.tex` - Reference list
   - `encl-config.tex` - Enclosure definitions
3. **Compilation** → SwiftLaTeX compiles to PDF in-browser
4. **PDF Merge** → Enclosure PDFs appended via pdf-lib
5. **Download** → Final PDF delivered to user

### Data Storage

All data persisted to browser `localStorage`:

| Key | Contents |
|-----|----------|
| `libo_profiles` | Saved signatory/unit profiles |
| `libo_draft` | Current document form data |
| `libo_draft_refs` | References list |
| `libo_draft_encls` | Enclosure metadata |
| `libo_draft_copytos` | Distribution list |
| `libo_draft_paragraphs` | Body paragraphs with levels |

---

## NIST 800-53 Security Compliance Assessment

### Overview

This application is designed for **client-side only operation** with no external network dependencies. This architecture provides inherent security benefits for handling sensitive correspondence.

### Control Family Assessment

#### Access Control (AC)

| Control | Status | Notes |
|---------|--------|-------|
| AC-2 Account Management | N/A | Single-user browser application |
| AC-3 Access Enforcement | **Satisfied** | No privilege escalation possible |
| AC-6 Least Privilege | **Satisfied** | Runs with browser permissions only |
| AC-17 Remote Access | **Satisfied** | No remote access capability |
| AC-20 External Systems | **Satisfied** | No external system connections |

#### System & Communications Protection (SC)

| Control | Status | Notes |
|---------|--------|-------|
| SC-7 Boundary Protection | **Satisfied** | No network calls, client-side only |
| SC-8 Transmission Confidentiality | **Satisfied** | No data transmission |
| SC-12 Cryptographic Key Management | N/A | No cryptographic operations |
| SC-13 Cryptographic Protection | N/A | No encryption implemented |
| SC-28 Protection at Rest | **Partial** | localStorage unencrypted (see mitigations) |

#### System & Information Integrity (SI)

| Control | Status | Notes |
|---------|--------|-------|
| SI-3 Malicious Code Protection | **Satisfied** | No `eval()`, `new Function()`, or dynamic code |
| SI-10 Information Input Validation | **Satisfied** | HTML escaping, LaTeX escaping, PDF MIME validation |
| SI-11 Error Handling | **Satisfied** | Graceful error handling with user feedback |

#### Audit & Accountability (AU)

| Control | Status | Notes |
|---------|--------|-------|
| AU-2 Audit Events | **Partial** | Console logging for debugging (dev mode) |
| AU-3 Content of Audit Records | N/A | No persistent audit log |

### Security Features Implemented

1. **Input Sanitization**
   - `escapeHtml()` - Prevents XSS in DOM manipulation
   - `escapeLatex()` - Prevents LaTeX injection (handles `\ & % $ # _ { } ~ ^`)
   - `escapeLatexUrl()` - URL-safe escaping for hyperlinks

2. **No Dangerous Patterns**
   - No `eval()` or `new Function()`
   - No `innerHTML` with raw user input
   - No `document.write()`
   - No dynamic script loading

3. **Client-Side Isolation**
   - Zero network calls after initial page load
   - All TeX Live packages bundled locally
   - PDF generation entirely in-browser

4. **Data Handling**
   - No cookies used
   - No tracking or analytics
   - No third-party dependencies at runtime

### Mitigations & Recommendations

#### For CUI Handling

| Risk | Mitigation |
|------|------------|
| localStorage unencrypted | Use on authorized systems only; clear browser data after use |
| Browser memory persistence | Close browser/clear cache when handling sensitive documents |
| Screen capture risk | Use in physically secured environment |

#### Operational Security

1. **Air-Gapped Use** - Application works fully offline after initial load
2. **Browser Hygiene** - Clear localStorage after processing sensitive documents
3. **System Authorization** - Use only on systems authorized for data classification level
4. **Physical Security** - Standard OPSEC for viewing/printing classified documents

### Compliance Summary

| Category | Rating | Notes |
|----------|--------|-------|
| **Data in Transit** | Strong | No network transmission |
| **Data at Rest** | Moderate | Unencrypted localStorage (browser-dependent) |
| **Input Validation** | Strong | Multiple sanitization layers |
| **Code Injection** | Strong | No dynamic code execution |
| **Access Control** | N/A | Single-user client application |

**Overall Assessment**: Suitable for CUI and below when operated on authorized systems following operational security procedures. For classified use, additional system-level controls required per agency policy.

---

## Quick Start

### Web UI (Recommended)

1. Open `web/index.html` in your browser
2. Select document type
3. Fill in form fields
4. Click "Generate PDF"
5. Download your document

**No installation required** - all dependencies bundled.

### Command Line (Advanced)

Prerequisites: TeX Live or MacTeX with `pdflatex` in PATH

```bash
# Clone repository
git clone https://github.com/yourusername/libo-secured.git
cd libo-secured

# Edit config files in config/ folder
# Then compile:
make build

# Output: main.pdf
```

## File Structure

```
libo-secured/
├── web/
│   ├── index.html           # Main web application
│   ├── js/
│   │   ├── app.js           # Application logic (5000+ LOC)
│   │   └── latex-templates.js # Bundled LaTeX templates
│   ├── css/
│   │   └── styles.css       # UI styling
│   ├── lib/                  # Bundled dependencies
│   │   ├── swiftlatex/      # PdfTeX WASM engine
│   │   ├── pdf-lib/         # PDF manipulation
│   │   └── texlive/         # TeX Live packages
│   └── data/
│       ├── references.json   # 2100+ military references
│       ├── ssic.json        # Subject codes
│       └── units.json       # Unit directory
├── tex/
│   ├── main.tex             # Master template
│   └── templates/           # 18 document format modules
├── config/                   # User configuration (CLI mode)
├── Makefile                  # Build commands
└── README.md
```

## References

- [SECNAV M-5216.5](https://www.secnav.navy.mil/doni/SECNAV%20Manuals1/5216.5.pdf) - DON Correspondence Manual
- MCO 5216.20B W/ADMIN CH-4 - Marine Corps Correspondence Manual
- DoDI 5200.48 - CUI Marking Requirements
- NIST SP 800-53 Rev. 5 - Security and Privacy Controls

## License

Public Domain - Created for use by DoD personnel.

---

*Semper Fidelis*
