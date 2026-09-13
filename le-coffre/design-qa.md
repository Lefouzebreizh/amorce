# Design QA — Mon Tiroir Secret

## Evidence

- Source visual truth: `/workspace/scratch/9f2eee4cd5c3/upload/03-1000033361.jpg` (mobile reference, 920 × 2048 px) and the supplied Lefouzèbreizh Studio art direction.
- Implementation: `http://terminal.local:4173/`.
- Browser-rendered implementation screenshot: `/home/oai/share/tiroir-secret-hero-qa.jpg` (browser-side capture; the shared-file mirror did not expose a main-container path).
- Viewport: 1363 × 936 CSS px, device pixel ratio 1.
- State: public landing page, hero at page start; connection and expanded privacy states were also inspected.
- Normalization: this is an art-direction and hierarchy comparison rather than a pixel-identical reconstruction. The 920 × 2048 Android reference includes browser/device chrome and was compared with the unframed desktop implementation. Density and framing differences were excluded from findings.

## Full-view comparison evidence

The source and implementation were opened in the same comparison pass. The former stacked a standalone header, scenic panel, dark copy card, step pills, and connection card with almost no breathing room. The implementation replaces that stack with one edge-to-edge cinematic scene, places the copy directly in the negative space, makes the real open vault the central 3D subject, and moves access into a separate calm section below.

## Focused-region comparison evidence

Focused checks covered the hero title/CTA, the open-vault crop, the three-step line, the connection form, and the privacy disclosure. The hero retains clear contrast without a text card. The access form is the only elevated panel in its section. The disclosure opens without layout breakage. No additional focused crop was needed because all critical text and controls were readable at the captured viewport.

## Required fidelity surfaces

- Fonts and typography: display serif and compact sans-serif produce a clear editorial hierarchy; weights, line heights, wrapping, and optical scale are coherent at the tested viewport.
- Spacing and layout rhythm: the scene is full-height, the content occupies the image's dark negative space, the steps use hairlines instead of pills, and the access section has generous vertical and column gaps.
- Colors and visual tokens: near-black foundation with turquoise, blue, and violet accents matches the Studio signature; amber is confined to the physical vault lighting.
- Image quality and asset fidelity: the generated 1586 × 992 cinematic vault image is used directly through `next/image`; no visible key asset is recreated with CSS shapes, emoji, or placeholder geometry.
- Copy and content: the promise is shorter and calmer while retaining the product's privacy, passwordless login, encryption, and AI-transparency information.

## Findings

- No actionable P0, P1, or P2 differences remain.
- P3: the browser surface available for this QA has a fixed desktop viewport. The mobile breakpoint was reviewed in the responsive CSS and production build, but a separate browser-rendered Android capture remains a useful post-preview polish check.

## Primary interactions tested

- `Ouvrir mon coffre` updates the URL to `#connexion` and scrolls the access region into view.
- `Comment tes documents sont-ils protégés ?` expands and reveals the encryption explanation.
- Interactive targets measured 48–60 px high at the tested viewport.
- `document.documentElement.scrollWidth` equals `clientWidth` (1348 px): no horizontal overflow.

## Console

- No application warning or error was recorded.
- Browser-extension metadata errors were observed from a `chrome-extension://` URL and classified as external to the application.

## Comparison history

- Initial implementation pass: preview rendered blank because the isolated preview did not receive placeholder Supabase build variables.
- Fix: added ignored local preview variables and restarted the preview. This was preview infrastructure, not a visual design change.
- Post-fix evidence: the full hero, access section, navigation, and disclosure rendered and were inspected successfully. No P0/P1/P2 visual correction was required after the rendered comparison.
- Private-app iteration: the authenticated dashboard originally used a CSS-drawn vault and hid it below 700 px. The fake vault was removed and the same real coastal-vault asset is now rendered as a panoramic dashboard scene. A data-free local QA state rendered the actual `/coffre` component at 1363 × 936 CSS px: vault, lighthouse, copy, logout action and both status counters were visible with no overlap. The QA-only state was removed before commit.

## Implementation checklist

- [x] One cinematic hero scene instead of stacked rectangles.
- [x] Real 3D vault asset with Brittany/ocean/lighthouse context.
- [x] Calm, separate access section with one functional panel.
- [x] Responsive rules and reduced-motion fallback.
- [x] Core public interactions, overflow, target sizing, and console checked.

final result: passed
