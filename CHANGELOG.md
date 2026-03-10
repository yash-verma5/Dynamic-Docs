# Changelog
All notable changes to this project during the Stitch redesign integration will be documented in this file.

## [Unreleased]

### Added
- Created `DESIGN.md` as the source of truth for design tokens, typography, and styling rules extracted from the Stitch UI.
- `HomepageHero` component with responsive styling, animations, and glassmorphic elements defined via CSS Modules.
- `ExploreSection` component featuring documentation cards built with a glassmorphic design and grid layout.
- `BlogCard` reusable component matching the Stitch layout, tag styling, and visual hover effects.
- Added Google Fonts (`Inter`, `Syne`, `JetBrains Mono`) to `src/css/custom.css`.
- Manual wrapper components for `@docusaurus/theme-classic/Navbar` and `@docusaurus/theme-classic/Footer` to inject dark, glassmorphic styling without fully overriding default theme features.

### Changed
- Replaced `src/pages/index.js` to use the new `HomepageHero` and `ExploreSection` components.
- Updated `docusaurus.config.js` to enforce a default dark color mode (`respectPrefersColorScheme: false`, `disableSwitch: false`).
- Updated `custom.css` with CSS variables reflecting the `DESIGN.md` tokens for primary colors, background surfaces, fonts, and navbar styling.

### Notes
- Visual QA checks were performed locally against `http://localhost:3000`. The layout matches the Stitch concepts, adopting the dark background (`#0D1117`), glassmorphic cards (`rgba(255, 255, 255, 0.04)`), and primary accent (`#7C3AED`).
- The `BlogCard` component is ready to be integrated into the blog list view through a subsequent Docusaurus theme swizzle of the `BlogPostItem` or `BlogList` pages (not implemented in this PR to limit scope).
