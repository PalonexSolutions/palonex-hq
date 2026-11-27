# Design system

PaLoNex uses matte black, charcoal, warm ivory and champagne metallic gold. The global CSS variables in `app/globals.css` are the source for both themes.

| Role | Dark | Light |
| --- | --- | --- |
| Canvas | Matte black `#080808` | Warm ivory `#F3EFE5` |
| Secondary surface | Charcoal `#141414` | Warm beige `#EBE5D7` |
| Cards | `#1B1A17` | `#FAF7EF` |
| Text | Warm ivory `#F3EFE5` | Charcoal `#24211C` |
| Secondary text | `#AAA69B` | `#61584B` |
| Accent | Champagne `#C6AD72` | Bronze `#705326` |
| Emphasis | Metallic highlight `#E8D5A0` | Deep bronze `#644820` |
| Borders | `#383127` | `#C9BB9F` |

Use antique gold `#947641` for fine accents and a restrained champagne gradient for primary calls to action. Use solid semantic text colors for reading and token-based focus outlines for all interactive components. Use the shared shell, card radius and system sans-serif typography. The responsive layout adjusts at 920, 760 and 450 CSS pixels.

## Official artwork

- `public/brand/palonex-logo.png` is the 806 × 993 transparent standalone mark. The header and browser icon reference the original PNG.
- `public/brand/palonex-name-slogan.png` is the 602 × 227 wordmark and tagline. The source artwork has an opaque dark background. The footer presents it once on a matching dark plate in both themes.
- Preserve both files, their native proportions and embedded typography. The official tagline is “Tools that think. Steps that work.” Use the supplied lockup for its visual presentation.

## Permanent theme requirement

Every new page, application and component must support both themes from its initial implementation. Use semantic CSS variables on surfaces, dialogs, forms, typography and interaction states. Verify both themes at desktop and mobile sizes.

The root layout runs a small static initializer before paint. It uses the saved `palonex-theme` preference when available, then the OS preference, with dark as fallback. The theme toggle persists the explicit choice and updates the root attribute. CSS uses `color-scheme` and `light-dark()` to resolve semantic tokens and native controls throughout the app.
