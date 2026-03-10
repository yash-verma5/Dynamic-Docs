# Design System: Yash's Works
**Project ID:** 8106528221715051058

## 1. Visual Theme & Atmosphere
A dark, tech-focused, minimal, and sophisticated aesthetic. It relies on deep backgrounds heavily contrasted with vibrant "glow" effects and neon accents to direct attention. Glassmorphism creates a sense of depth and modernity without feeling cluttered.

## 2. Color Palette & Roles
*   **Deep Obsidian Space** (`#0D1117`): Primary app background. Creates a vast, empty canvas that makes accents pop.
*   **Subtle Slate** (`#161B22`): Secondary background for subtle differentiation.
*   **Electric Violet** (`#7C3AED`): Primary accent color. Used for primary CTAs, glowing hover effects, and key branding moments.
*   **Neon Mint** (`#00E5A0`): Secondary accent color. Used for section highlighting and secondary interactive elements.
*   **Frost White** (`#F0F6FC` / `#E6EDF3`): Primary text color, ensuring high legibility against the dark void.
*   **Muted Steel** (`#8B949E` / `#9CA3AF`): Secondary text for descriptions, navigation links, and subdued elements.

## 3. Typography Rules
*   **Headings/Display:** `Syne` (Weights 700, 800). Used for massive hero titles and primary section headers. Features tight tracking (`tracking-tighter`) for a bold, modern feel.
*   **Body Text:** `Inter` (Weights 400, 500, 600). Used for all body copy, UI text, and long-form reading. Highly legible.
*   **Code/Monospace:** `JetBrains Mono`. Used for code snippets, technical references, and developer-centric UI elements.
*   **Accent (Optional):** `Space Grotesk`. Used for subheadings in cards (e.g. uppercase docs title).

## 4. Component Stylings
*   **Primary Buttons:** Pill-shaped or custom rounded (`8px`), filled with Electric Violet (`#7C3AED`), featuring a subtle glowing drop shadow (`shadow-brand/20`) that intensifies on hover. Text is bold and white.
*   **Secondary/Outline Buttons:** Transparent background with a `1px` border of Muted Steel or Neon Mint, depending on context. Text matches the border color.
*   **Glassmorphic Cards:** Gently rounded corners (`12px`). Background is a very sheer white (`rgba(255, 255, 255, 0.04)`) with a faint border (`rgba(255, 255, 255, 0.08)`) and a moderate background blur (`12px`). Hover states introduce a border color transition to Electric Violet and a slight scale-up.
*   **Navigation Bar:** Sticky glass navbar with `80%` opacity of the deep background and a `12px` blur, separated by a `0.1` opacity white bottom border.

## 5. Layout Principles
*   **Whitespace:** Generous padding (`py-20`, `py-32`) to let content breathe.
*   **Grid:** Maximum width containers (`max-w-7xl`) centered on the screen. Content uses standard CSS Grids (1 col mobile, 3 col desktop for cards).
*   **Textures:** Subtle dot grid backgrounds (`radial-gradient`) and radial glow orbs (`radial-gradient(circle at center, rgba(124, 58, 237, 0.08))`) break up flat dark spaces.
