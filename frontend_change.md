# Frontend Design Specification: "Precision Architectural Slate"

This document establishes the strict architectural and design rules for `/frontend`, removing all AI design tropes and establishing a custom, high-contrast, editorial layout engine.

---

## 1. Locked Typography Specification (Non-Default Google Fonts)

- **Primary Body & Interface**: `'Plus Jakarta Sans'`, sans-serif  
  - Usage: Inputs, buttons, general paragraph text, navigation labels.
- **Display & Headings**: `'Syne'`, sans-serif (Weights: 700, 800)  
  - Usage: Page titles, brand logotype, modal headers, marketing hero slogans.
- **Technical & Tabular Metadata**: `'JetBrains Mono'`, monospace  
  - Usage: File sizes, dates, SHA-256 block hashes, IP addresses, tabular numbers, keyboard shortcut badges (`⌘K`, `/`, `ESC`).

---

## 2. Locked Hex Color Matrix & Strict Roles

| Role | Variable / Class | Exact Hex Code | Usage |
| :--- | :--- | :--- | :--- |
| **Canvas / Background** | `bg-arch-950` | `#090a0c` | Main application backdrop |
| **Surface / Panel / Dialog** | `bg-arch-900` | `#111317` | Sidebar, navbar, modals, cards |
| **Elevated Surface / Hover** | `bg-arch-850` | `#15181e` | Table row hover, active menu item, input fill |
| **Boundary / 1px Divider** | `border-arch-border` | `#242830` | Structural 1px rules, card boundaries |
| **Primary Action Accent** | `bg-amber-500` / `text-amber-400` | `#f59e0b` / `#fbbf24` | Primary CTA buttons, active indicators, focus rings |
| **Destructive Action** | `border-rose-900` / `text-rose-400` | `#9f1239` / `#fb7185` | Delete buttons, error alerts |
| **Primary Heading Text** | `text-zinc-50` | `#fafafa` | Titles, modal names, file names |
| **Body / Label Text** | `text-zinc-300` | `#d4d4d8` | Subtitles, input labels, menu text |
| **Muted Metadata Text** | `text-zinc-500` | `#71717a` | File dates, sizes, helper text |

---

## 3. Asymmetrical & Editorial Layout Architecture

- **Auth Pages (`Login.tsx`, `Register.tsx`, `ForgotPassword.tsx`)**:  
  - Asymmetrical 2-Column Split Layout:  
    - **Left Column (40% width)**: Deep Charcoal `#090a0c` brand showcase featuring `'Syne'` display logotype, live platform status ticker (`JetBrains Mono`), and structural 1px right border rule (`#242830`).  
    - **Right Column (60% width)**: High-contrast form container with precision inputs, amber focus rings, and direct auth triggers.
- **Explorer Dashboard (`Dashboard.tsx`)**:  
  - Editorial header section with inline storage metrics (`JetBrains Mono`), high-density search input with `/` key pill badge, and asymmetrical right inspector drawer for file details.

---

## 4. Component Refactoring Checklist

- [x] `index.html` (Loaded Google Fonts: Plus Jakarta Sans, Syne, JetBrains Mono)
- [x] `tailwind.config.js` (Configured arch colors & font families)
- [x] `index.css` (Configured sharp scrollbar & `.bg-arch-grid` texture)
- [x] `ui/Button.tsx` (Refactored to 6px radius, Electric Amber CTA & slate variants)
- [x] `ui/Input.tsx` (Refactored to 1px arch border & amber focus outline)
- [x] `ui/Modal.tsx` (Refactored to sharp slate dialog panel `#111317` with 1px border)
- [x] `ui/Alert.tsx` (Refactored to solid left-border indicator callout)
- [x] `Sidebar.tsx` (Refactored to architectural dark sidebar with amber active state)
- [x] `Navbar.tsx` (Refactored to precision header with `/` search shortcut pill)
- [x] `Breadcrumbs.tsx` (Refactored to monospaced path trail)
- [x] `BulkActionBar.tsx` (Refactored to floating bottom bar with monospaced counter)
- [x] `ListView.tsx` (Refactored to high-density monospaced table)
- [ ] `GridView.tsx` (Refactoring next...)
- [ ] `ContextMenu.tsx` (Refactoring next...)
- [ ] `FileDetailsSidebar.tsx` (Refactoring next...)
- [ ] `UploadQueue.tsx` (Refactoring next...)
- [ ] `Dashboard.tsx` (Refactoring next...)
- [ ] Modals (`SettingsModal`, `UpdatePasswordModal`, `ActiveSessionsModal`, `ShareModal`, etc.)
- [ ] Auth Pages (`Login.tsx`, `Register.tsx`, `ForgotPassword.tsx`, `ResetPassword.tsx`, `Verify.tsx`)
