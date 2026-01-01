# Contributing to libo-secured

## Repository Structure

```
libo-secured/
├── .github/              # GitHub Actions workflows
├── attachments/          # DoD seal, signature images (gitignored)
├── enclosures/           # User PDF enclosures (gitignored)
├── forms/                # NAVMC form templates (future feature)
├── tex/                  # LaTeX source files
│   ├── main.tex          # Master template engine
│   ├── templates/        # 18 document format modules
│   └── *.tex             # Config file templates (CLI mode)
├── web/                  # Web application
│   ├── index.html        # Main application entry
│   ├── css/              # Stylesheets
│   ├── js/               # JavaScript source
│   │   ├── app.js        # Main application logic
│   │   ├── latex-templates.js  # Auto-generated (do not edit)
│   │   └── texlive-packages.js # Auto-generated (do not edit)
│   ├── lib/              # Third-party libraries (SwiftLaTeX, pdf-lib)
│   ├── data/             # JSON data files (references, SSICs, units)
│   └── build-*.sh        # Build scripts for bundling
├── index.html            # Redirect to web/
├── Makefile              # CLI build commands
└── README.md
```

## Code Style Guide

### JavaScript (app.js)

#### Formatting
- **Indentation**: 4 spaces (no tabs)
- **Line length**: 100 characters soft limit, 120 hard limit
- **Semicolons**: Always use semicolons
- **Quotes**: Single quotes for strings, backticks for templates
- **Braces**: Same-line opening brace (K&R style)

```javascript
// Good
function generateDocument(data) {
    const result = processData(data);
    return `Output: ${result}`;
}

// Bad
function generateDocument(data)
{
    const result = processData(data)
    return "Output: " + result
}
```

#### Naming Conventions
- **Functions**: camelCase, verb-first (`generatePdf`, `collectData`, `renderParagraphs`)
- **Variables**: camelCase (`documentType`, `pageWidth`)
- **Constants**: UPPER_SNAKE_CASE (`STORAGE_KEY_DRAFT`, `MAX_PARAGRAPH_LEVELS`)
- **DOM IDs**: camelCase in HTML, accessed via `getElementById('elementName')`
- **CSS Classes**: kebab-case (`paragraph-item`, `drag-over`)

#### Function Documentation
Use JSDoc comments for public functions:

```javascript
/**
 * Generate LaTeX body content from paragraphs
 * @param {Object} data - Collected form data
 * @returns {string} LaTeX source for body.tex
 */
function generateBodyTex(data) {
    // ...
}
```

#### Error Handling
- Use `try/catch` for async operations
- Display user-friendly errors via `showStatus(message, 'error')`
- Log technical details to console for debugging

```javascript
try {
    const pdf = await compileLatex();
    downloadPdf(pdf);
} catch (error) {
    console.error('Compilation failed:', error);
    showStatus('PDF generation failed. Check console for details.', 'error');
}
```

### HTML (index.html)

#### Structure
- Use semantic HTML5 elements (`<section>`, `<nav>`, `<main>`)
- Keep form inputs with associated `<label>` elements
- Use `data-*` attributes for JavaScript hooks

```html
<div class="form-group">
    <label for="ssic">SSIC</label>
    <input type="text" id="ssic" name="ssic" data-validate="ssic">
</div>
```

### CSS (styles.css)

#### Organization
Styles are organized in sections:
1. CSS Variables (`:root`)
2. Base/Reset styles
3. Layout (containers, grid)
4. Components (forms, buttons, modals)
5. Document-specific styles
6. Utility classes
7. Responsive breakpoints

#### Naming
- Use BEM-like naming for components: `.component`, `.component-element`, `.component--modifier`
- Prefix state classes with `is-` or `has-`: `.is-active`, `.has-error`

```css
.paragraph-item { }
.paragraph-item-header { }
.paragraph-item--dragging { }
.is-disabled { }
```

### LaTeX (tex/)

#### Template Files
- Each document type has its own file in `tex/templates/`
- Use `\newcommand` for reusable elements
- Document required config variables at top of file

```latex
%=============================================================================
% NAVAL LETTER FORMAT - SECNAV M-5216.5 Ch 2
% Required config: \DocumentType, \SSIC, \From, \To, \Subject
%=============================================================================
```

#### Config Files
- Config files (`document.tex`, `letterhead.tex`, etc.) define `\set*` commands
- Actual content is loaded via `\input{filename}`

### JSON Data Files (web/data/)

#### Format
- 2-space indentation
- Arrays on multiple lines for readability
- Sorted alphabetically where applicable

```json
{
  "references": [
    {
      "code": "5216",
      "title": "SECNAV M-5216.5",
      "description": "DON Correspondence Manual"
    }
  ]
}
```

## Build Process

### Regenerating Templates

When modifying `tex/*.tex` files, regenerate the bundled templates:

```bash
cd web
./build-templates.sh
```

This updates `js/latex-templates.js` which is loaded by the web app.

### Testing Changes

1. Open `web/index.html` in a browser
2. Select document type and fill sample data
3. Click "Generate PDF" to test compilation
4. Check browser console for errors

## Git Workflow

### Commit Messages
Follow conventional commit format:

```
type: short description

Longer explanation if needed.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Formatting (no code change)
- `refactor`: Code restructuring
- `test`: Adding tests
- `chore`: Maintenance tasks

### Branches
- `main`: Production-ready code
- `feature/*`: New features
- `fix/*`: Bug fixes

## Security Considerations

### Input Sanitization
Always sanitize user input before:
- Inserting into DOM → use `escapeHtml()`
- Inserting into LaTeX → use `escapeLatex()`
- Inserting into URLs → use `escapeLatexUrl()`

### No Dynamic Code
Never use:
- `eval()`
- `new Function()`
- `innerHTML` with unsanitized user input
- `document.write()`

### localStorage
- Data is stored unencrypted
- Suitable for CUI on authorized systems
- Users should clear browser data after sensitive work

## Questions?

Open an issue on GitHub for questions or suggestions.
