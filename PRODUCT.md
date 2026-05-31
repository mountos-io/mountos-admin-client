## Design Context

### Users

Infrastructure operators and provider admins managing mountOS deployments. They work with accounts, users, regions, storage, volumes, and service nodes. They need to monitor system health, manage quotas, review audit logs, and control access. They are technical users who value precision and data density over decorative UI.

### Brand Personality

**Technical, Precise, Bold.** Engineering-forward, no-nonsense, confident. The interface speaks the operator's language, no hand-holding, no fluff. Every element earns its place.

**Emotional goal:** Confidence & Control. Operators feel in command of their infrastructure, trust the data, and feel secure in every action.

### Aesthetic Direction

- **Visual tone:** Cyberpunk-technical. Angular geometry (corner brackets, skewed clip-paths, grid patterns) combined with clean data presentation.
- **Color system:** OKLch color space for perceptual uniformity. Warm brown/rust primary in light mode, golden primary in dark mode. Grayscale charts. Destructive actions in red-orange.
- **Typography:** System font stack with OpenType features (`cv02`, `cv03`, `cv04`, `cv11`). Fluid clamp-based sizing. Tight letter-spacing on headings (-0.02em), generous line-height on body (1.7).
- **Radius:** Near-zero; sharp edges reinforce the technical aesthetic.
- **Theme:** Full light + dark mode with system preference detection. Dark mode is the power-user default.
  - **Icons:** Lucide (outline style, consistent stroke width).
- **Anti-patterns:** Avoid rounded/bubbly/playful aesthetics. No gratuitous gradients. No decorative illustrations. No marketing-style hero sections.

### Design Principles

1. **Data density over decoration.** Show more information in less space. Every pixel should serve the operator's decision-making. Prefer tables and stat cards over charts when exact values matter.

2. **Sharp geometry, deliberate ornamentation.** Corner brackets, angled cuts, and grid patterns are the brand's visual signature. Use them consistently but sparingly; they frame content, never compete with it.

3. **Contrast through restraint.** The color palette is intentionally narrow. Use the warm primary accent to draw attention to what matters most. Let the grayscale foundation do the heavy lifting.

4. **System-grade reliability.** The UI should feel as dependable as the infrastructure it manages. Predictable layouts, consistent spacing, no surprises. WCAG AA compliance for all interactive elements.

5. **Command-line sensibility.** Keyboard-first navigation (Cmd+K palette, numbered shortcuts). Dense information display. Technical language without dumbing down. Operators are experts; treat them as such.

### Tech Stack

- **Framework:** SvelteKit 2 + Svelte 5
- **Styling:** Tailwind CSS 4 + tailwind-variants + tailwind-merge
- **Components:** bits-ui (headless primitives) + custom Tailwind compositions
- **Icons:** @lucide/svelte
- **Animations:** tw-animate-css
- **Accessibility:** WCAG AA target
