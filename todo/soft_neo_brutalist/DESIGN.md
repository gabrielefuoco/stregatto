---
name: Soft Neo-Brutalist
colors:
  surface: '#f9f9f9'
  surface-dim: '#dadada'
  surface-bright: '#f9f9f9'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f3f4'
  surface-container: '#eeeeee'
  surface-container-high: '#e8e8e8'
  surface-container-highest: '#e2e2e2'
  on-surface: '#1a1c1c'
  on-surface-variant: '#5b4138'
  inverse-surface: '#2f3131'
  inverse-on-surface: '#f0f1f1'
  outline: '#8f7066'
  outline-variant: '#e3bfb3'
  surface-tint: '#ab3600'
  primary: '#ab3600'
  on-primary: '#ffffff'
  primary-container: '#ff5f1f'
  on-primary-container: '#561700'
  inverse-primary: '#ffb59c'
  secondary: '#5e5e5e'
  on-secondary: '#ffffff'
  secondary-container: '#e2e2e2'
  on-secondary-container: '#646464'
  tertiary: '#5d5f5f'
  on-tertiary: '#ffffff'
  tertiary-container: '#939494'
  on-tertiary-container: '#2b2d2d'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffdbcf'
  primary-fixed-dim: '#ffb59c'
  on-primary-fixed: '#390c00'
  on-primary-fixed-variant: '#832700'
  secondary-fixed: '#e2e2e2'
  secondary-fixed-dim: '#c6c6c6'
  on-secondary-fixed: '#1b1b1b'
  on-secondary-fixed-variant: '#474747'
  tertiary-fixed: '#e2e2e2'
  tertiary-fixed-dim: '#c6c6c7'
  on-tertiary-fixed: '#1a1c1c'
  on-tertiary-fixed-variant: '#454747'
  background: '#f9f9f9'
  on-background: '#1a1c1c'
  surface-variant: '#e2e2e2'
typography:
  headline-xl:
    fontFamily: Space Grotesk
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Space Grotesk
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Space Grotesk
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 34px
  headline-md:
    fontFamily: Space Grotesk
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Work Sans
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Work Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-md:
    fontFamily: Space Grotesk
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
  label-sm:
    fontFamily: Space Grotesk
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
spacing:
  unit: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 40px
  gutter: 20px
  margin-mobile: 16px
  margin-desktop: 64px
---

## Brand & Style

This design system occupies the intersection of raw, structural honesty and modern digital refinement. It leverages the "Neo-Brutalist" aesthetic—characterized by high-contrast borders and un-aliased geometry—but tempers it with a disciplined approach to whitespace and weight.

The brand personality is **confident, transparent, and direct**. It is designed for users who value functional clarity but desire a product with a distinct editorial "edge." By replacing heavy 4px strokes with precise 2px lines and swapping aggressive shadows for tight, graphic offsets, the UI achieves a "clean with character" aesthetic. It avoids the clinical feel of traditional SaaS minimalism while maintaining professional usability.

## Colors

The palette is anchored by a high-voltage **International Orange** used sparingly for primary actions and critical highlights. The foundation of the system is strictly monochromatic to allow the accent color and structural borders to command attention.

- **Primary (#FF5F1F):** Used for primary buttons, active states, and focus indicators.
- **Secondary (#000000):** Used for all structural borders (2px), headings, and icons.
- **Tertiary (#F4F4F4):** A subtle cool gray for background containment and secondary surfaces.
- **Neutral (#FFFFFF):** The default background for cards and the main canvas to ensure maximum legibility.

Backgrounds should remain predominantly white to preserve the "Soft" aspect of the system, using gray only to differentiate specific functional zones.

## Typography

The typographic system utilizes **Space Grotesk** for all structural and display elements to reinforce the technical, geometric nature of the design. Its idiosyncratic letterforms provide the "character" in the design narrative.

For long-form reading and interface labels requiring high utility, **Work Sans** is used. Its grounded, professional rhythm balances the expressive nature of the headlines. All labels and caps-locked text should use Space Grotesk to maintain a consistent graphic identity across the UI. Headlines should be set with tight tracking to emphasize their blocky, architectural feel.

## Layout & Spacing

The layout is built on a rigid 4px baseline grid, ensuring all elements align to a predictable, structural rhythm. 

- **Grid:** A 12-column fluid grid for desktop with fixed 20px gutters. On mobile, transition to a 4-column grid.
- **Philosophy:** Elements are purposefully boxed. Containers should use explicit 2px black borders rather than relying on margin alone to create separation. 
- **Alignment:** Use heavy-handed alignment. Text should often be flush-left against container borders to emphasize the box-model construction. Use generous "air" (xl spacing) between major sections to prevent the bold borders from feeling cluttered.

## Elevation & Depth

This system rejects traditional ambient shadows and blurs in favor of **Graphic Offsets**. 

Depth is conveyed through "Hard Shadows"—solid 2px or 4px black offsets that do not have a blur radius. When an element is "elevated," it shifts up and left by 2px, and a solid black box appears behind it, creating a physical "sticker" or "cut-out" effect.

- **Level 1 (Default):** 2px solid black border, no shadow.
- **Level 2 (Hover/Active):** 2px solid black border + 4px solid black shadow (offset x: 4px, y: 4px).
- **Level 3 (Interactive/Critical):** 2px solid black border + 4px solid Primary Orange shadow.

Surfaces do not use gradients; depth is strictly a matter of layered, bordered rectangles.

## Shapes

To maintain the architectural integrity of the design system, **all corners are sharp (0px radius)**. 

The use of perfect right angles reinforces the "Brutalist" heritage and ensures that the 2px black borders meet in crisp, defined points. This sharpness applies to buttons, input fields, cards, and even decorative elements like tags or chips. The only exception is for circular avatars or specific status indicators where a 100% pill shape is required for immediate recognition.

## Components

- **Buttons:** Rectangular with 2px black borders. The primary button uses the #FF5F1F background with white or black text. On hover, the button should trigger a 4px black hard shadow.
- **Input Fields:** White background, 2px black border. On focus, the border remains black but a 2px Primary Orange shadow appears. Use Space Grotesk for placeholder text to maintain the technical look.
- **Cards:** Use a white background and 2px black border. Use a "Tertiary" gray header bar (separated by a 2px bottom border) for internal organization.
- **Chips/Tags:** Small rectangular boxes with 2px black borders. Use Space Grotesk Bold at 12px.
- **Lists:** Items are separated by 2px horizontal black lines. Hover states should utilize a subtle "Tertiary" gray fill rather than a shadow to keep the list clean.
- **Checkboxes/Radios:** Pure geometric squares (checkboxes) and circles (radios) with 2px strokes. The "checked" state is indicated by a solid Primary Orange fill or a thick black "X" or "Dot."